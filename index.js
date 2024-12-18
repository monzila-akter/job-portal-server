const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://job-portal-client-auth.web.app',
    'https://job-portal-client-auth.firebaseapp.com'

  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// verify token middleware

const verifyToken = (req, res, next) => {
  // console.log('logged in verify token', req.cookies)
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'UnAuthorized token'})
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'UnAuthorized token'})
    }
    
    req.user = decoded;
    next();
  })

  
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vo9th.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const jobCollection = client.db("jobPortalDB").collection("jobs");
    const jobApplicationCollection = client.db("jobPortalDB").collection("applications");

  //  auth related api
      app.post("/jwt", async(req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_SECRET, {expiresIn: '10h'});
        res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
        })
        .send({success: true })
      })

      app.post("/logout", (req, res) => {
        res
        .clearCookie('token', {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
        })
        .send({success: true})
      })
  

    app.get("/jobs", async(req, res) => {
      const email = req.query.email;
      let query = {}
      if(email){
        query = {hr_email: email}
      }

        const cursor = jobCollection.find(query)
        const result = await cursor.toArray()
        res.send(result);
    })

   app.post("/jobs", async(req, res) => {
    const newJob = req.body;
    const result = await jobCollection.insertOne(newJob);
    res.send(result);
   })

    app.get("/jobs/:id", async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await jobCollection.findOne(query);
        res.send(result);
    })

    app.post("/job-applications", async(req, res) => {
        const application = req.body;
        const result = await jobApplicationCollection.insertOne(application);

        // bad way to get data

        const id = application.job_id;
        const query = {_id: new ObjectId(id)}
        const job = await jobCollection.findOne(query);
        let newCount = 0;
        if(job.applicationCount){
          newCount = job.applicationCount + 1;
        }
        else{
          newCount = 1;
        }

        // update data 

        const filter = {_id: new ObjectId(id)}
        const updateDoc = {
          $set: {
            applicationCount: newCount
          }
        }

        const updateResult = await jobCollection.updateOne(filter, updateDoc)

        res.send(result);
    })

    app.patch("/job-applications/:id", async(req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          status: data.status
        }
      }
      const result = await jobApplicationCollection.updateOne(filter, updateDoc);
      res.send(result);

    })


    app.get("/job-applications/jobs/:job_id", async(req, res) => {
      const jobId = req.params.job_id;
      const query = {job_id: jobId};
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    })

    app.get("/job-applications", verifyToken, async(req, res) => {
      const email = req.query.email;
      const query = {applicant_email: email};

      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'Forbidden access'})
      }

      const result = await jobApplicationCollection.find(query).toArray();

    //bad way to aggregate data

    for(const application of result){
        const query1 = {_id: new ObjectId(application.job_id)}
        const job = await jobCollection.findOne(query1)
        if(job){
            application.title = job.title,
            application.company = job.company,
            application.company_logo = job.company_logo,
            application.location = job.location,
            application.jobType = job.jobType,
            application.category = job.category
        }
    }

      res.send(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("job are falling from the sky")
})

app.listen(port, () => {
    console.log(`job is waiting at: ${port}`)
})
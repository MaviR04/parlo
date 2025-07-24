import express from "express";
import pgp from "pg-promise";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';
import {RedisStore} from "connect-redis"
import {createClient} from "redis"
import db from "../db.js"
dotenv.config() 

const router = express.Router();
const saltRounds = 10;


router.use(express.json());


//add a new school
router.post("/school", (req, res) => {
  if (req.body && req.session.userID) {
    const postVars = [req.body.schoolName];
    if (checkPostVariables(postVars)) {
      db.none("INSERT INTO Schools (SchoolName,RootUser) VALUES ($1,$2)", [
        req.body.schoolName,
        req.session.UserID,
      ])
      .then(()=>{
        res.status(200).json({success:true})
      })
      .catch((err) => {
        console.log(err);
        res.status(400).json({success:false})
      });
    }
    else{
      res.status(400).json({error:"POST variables not set"})
    }
  }
});
 
router.get("/test",(req,res)=>{
  res.json([req.session.schoolID, req.session.userID]);
})

//register a new account
router.post("/account", (req, res) => {  
  if (req.body) {
    const postVars = [
      req.body.fname,
      req.body.lname,
      req.body.role,
      req.body.password,
      req.body.email,
    ];
    //checks if all post variables are set
    const isSet =  checkPostVariables(postVars)

    if (isSet) {
      //hash password & insert it into db
      bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
        db.none(
          "INSERT INTO Users (Fname, Lname, Role, PasswordHash, Email) VALUES ($1, $2, $3, $4, $5)",
          [req.body.fname, req.body.lname, req.body.role, hash, req.body.email]
        )       
          .then(() => {
            res.status(200).json({ success: true });
          })
          .catch((err) => {
            res.status(400).json({error:err.message})
          });

        if (err) {
          console.log(err.message);
        }
      });
    }
    else{
      res.status(400).json({error:"Missing post variables"})
    }
  }
  else{
    res.status(400).json({error:"No post body setn"})
  }
});

router.post("/", async (req, res) => {
  if (req.body) {
    const postVar = [req.body.email, req.body.password];

    if (checkPostVariables(postVar)) {
      db.one("SELECT * FROM users WHERE email = $1", [
        req.body.email
      ]).then((data) => {
  
        bcrypt.compare(req.body.password, data.passwordhash, (err, result) => {
          if (result) {
            req.session.userID = data.userid;
            req.session.userRole = data.role;
            req.session.name = data.fname + " " + data.lname;
            req.session.schoolID = data.schoolid || null;
             req.session.save((err) => {
                if (err) {
                  console.log("Session save error:", err);
                  return res.status(500).json({ success: false });
                }
                
                res.status(200).json({ success: true, userRole: data.role, name:data.fname + " " + data.lname,userID:data.userid });
              });

            
          } else {
            res.status(400).json({ success: false });
            console.log("this")
          }
          if(err){
            console.log(err)
            console.log(data.password)
          }

        });
      })
      .catch((err)=>{
        console.log(err)
      })
    }
    else{
      res.status(400).json({success: false})
    }
  }
});





//checks if all post variables are set and returns true/false
function checkPostVariables(postArr) {
  let allSet = true;
  postArr.forEach((e) => {
    console.log(e)
    if (!e) {
      allSet = false;
    }
  });

  return allSet;
}

export default router;
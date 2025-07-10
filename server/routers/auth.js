import express from 'express';
import crypto from 'crypto';
import pgp from 'pg-promise';
import session from 'express-session';

const router = express.Router();
const db = pgp(`postgres://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`)


router.use(express.json());
router.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 60000, httpOnly: true }
}))

//add a new school
router.post('/school',(req,res)=>{
    if(req.body && req.session.UserID){
        const postVars = [req.body.schoolName]
            if(checkPostVariables(postVars)){
                 db.none("INSERT INTO Schools (SchoolName,RootUser) VALUES ($1,$2)",[req.body.schoolName,req.session.UserID])
                 .catch(err =>{
                    console.log(err)
                 })
                 
            }
    }
})

//register a new account
router.post('/account',(req,res)=>{
    if(req.body){
        const postVars = [req.body.fname,req.body.lname,req.body.role,req.body.password,req.body.email];

        const salt = crypto.randomBytes(128).toString('base64');
        const hash = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512');

        if(checkPostVariables(postVars)){
            db.none("INSERT INTO Users (Fname, Lname, Role, PasswordHash, Email) VALUES ($1, $2, $3, $4, $5)",[req.body.fname,req.body.lname,req.body.role,hash,req.body.email])
            .catch(err =>{
                console.log(err)
            })
        }

        //reminder to use crypto.timingSafeEqual to verify hashes
    }
})




//checks if all post variables are set and returns true/false
function checkPostVariables(postArr){
    let allSet = true;
    postArr.forEach(e => {
        if(!e || e == ''){
            allSet = false;
        }
    });

    return allSet;
}
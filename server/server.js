import express from 'express';
import crypto from 'crypto';
import auth from './routers/auth.js';
import msg from './routers/msg.js'
import { Server } from "socket.io"; 
import {RedisStore} from "connect-redis"
import {createClient} from "redis"
import session from "express-session"
import cors from "cors";
import users from './routers/users.js';


const app = express();
const connectedUsers = [];

app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true
}))

app.use(
  session({
     resave: false,
     secret: process.env.SESSION_SECRET,
     cookie: { maxAge: 60000 * 60 * 24, httpOnly: true },
     saveUninitialized: false,
   })
);
app.use(express.json());

app.use('/auth',auth);
app.use('/msg',msg)
app.use('/admin',users);



const server = app.listen(process.env.API_PORT,()=>{
    console.log(`API running on Port:${process.env.API_PORT}`)
})
const io = new Server(server,{
    cors:{
      origin:"http://localhost:5173"
    }
  });

io.engine.use(session);


io.on('connection', (socket) => {
  console.log('a user connected');
  const session = socket.request.session;

  if(!connectedUsers.includes(session.userID)){
    connectedUsers.push(session.userID)
  }
  
});



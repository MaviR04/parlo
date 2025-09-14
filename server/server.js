import express from 'express';
import crypto from 'crypto';
import auth from './routers/auth.js';
import msg from './routers/msg.js'
import { Server } from "socket.io";
import path from 'path'
import session from "express-session"
import cors from "cors";
import users from './routers/users.js';
import announcement from './routers/announcement.js';
import teacher from "./routers/teacher.js";
import termRoutes from "./routers/term.js";
import behaviourRouter from "./routers/behaviour.js";
import gradesRouter from "./routers/grades.js";
import coachRouter from "./routers/coach.js";
import childrenRouter from "./routers/children.js";
import generalCmtsRouter from "./routers/generalCmts.js";
import usersRouter from "./routers/users.js";
import academicsRouter from "./routers/academics.js";
import activitiesRouter from "./routers/activities.js";
import commentsRouter from "./routers/p-comments.js";
import pBehaviourRouter from "./routers/p-behaviour.js";
import parentRoutes from "./routers/parent.js";
import dotenv from 'dotenv';
import availabilityRouter from "./routers/availability.js";
import teachersRouter from "./routers/teacher.js";
import meetingsRouter from "./routers/meetings.js";
dotenv.config();


const app = express();
const connectedUsers = [];

if(process.env.ENV == "prod"){
  // Serve static files from the Vite dist folder
  app.use(express.static(path.resolve('client/dist')))

// Catch-all for client-side routing
  app.get('/*splat', (req, res) => {
    res.sendFile(path.resolve('client/dist/index.html'))
  }) 
}



app.use(cors({
  origin: ['http://localhost:5173','http://112.134.131.151'],
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

app.use("/users", usersRouter);
app.use('/auth', auth);
app.use('/msg', msg)
app.use('/admin', users);
app.use('/announcement', announcement);
app.use('/teacher', teacher);
app.use("/terms", termRoutes);
app.use("/behaviour", behaviourRouter);
app.use("/grades", gradesRouter);
app.use("/coach", coachRouter);
app.use("/children", childrenRouter);
app.use("/general-comments", generalCmtsRouter);
app.use("/academics", academicsRouter);
app.use("/activities", activitiesRouter);
app.use("/p-comments", commentsRouter);
app.use("/p-behaviour", pBehaviourRouter);
app.use("/parent", parentRoutes);
app.use("/availability", availabilityRouter);
app.use("/teachers", teachersRouter);
app.use("/api/meetings", meetingsRouter);


const server = app.listen(process.env.API_PORT, () => {
  console.log(`API running on Port:${process.env.API_PORT}`)
})
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173","http://13.60.249.224:3001"]
  }
});

io.engine.use(session);


io.on('connection', (socket) => {
  console.log('a user connected');
  const session = socket.request.session;

  if (!connectedUsers.includes(session.userID)) {
    connectedUsers.push(session.userID)
  }

});



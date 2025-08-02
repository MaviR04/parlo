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


const app = express();
const connectedUsers = [];

// Serve static files from the Vite dist folder
//app.use(express.static(path.resolve('client/dist')))

// Catch-all for client-side routing
/*app.get('/*splat', (req, res) => {
  res.sendFile(path.resolve('client/dist/index.html'))
}) */

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

app.use('/auth', auth);
app.use('/msg', msg)
app.use('/admin', users);
app.use('/announcement', announcement);
app.use('/teacher', teacher);


const server = app.listen(process.env.API_PORT, () => {
  console.log(`API running on Port:${process.env.API_PORT}`)
})
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173"
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



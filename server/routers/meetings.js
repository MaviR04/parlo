// routes/meetings.js
import express from "express";
import db from "../db.js";


function requireLogin(req, res, next) {
  if (!req.session.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}

const router = express.Router();

router.post("/", requireLogin, async (req, res) => {
  try {
    const { title, description, teacherId, requestedSlot } = req.body;

    if (!requestedSlot) {
      return res.status(400).json({ message: "Slot not selected" });
    }

    const { weekday, start, end } = requestedSlot;

    const parentId = req.session.userID;

    const result = await db.query(
      `INSERT INTO meetings 
        (title, description, parent_id, teacher_id, weekday, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description || null, parentId, teacherId, weekday, start, end]
    );

    res.status(201).json({ meeting: result.rows[0], success: true });
  } catch (err) {
    console.error("Error booking meeting:", err.message);
    res.status(500).json({ message: "Error booking meeting" });
  }
});




export default router;

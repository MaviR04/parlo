// routes/events.js
import express from "express";
import db from "../db.js";

const router = express.Router();

// POST /events → save new event
router.post("/", async (req, res) => {
  try {
    const {  event_name, classification, event_data } = req.body;
    const parentId = req.session.userID
    if ( !event_name || !classification) {
      return res.status(400).json({ error: " event_name, and classification are required" });
    }

    await db.none(
      `INSERT INTO user_events (user_id, event_name, classification, event_data)
       VALUES ($1, $2, $3, $4)`,
      [parentId, event_name, classification, event_data ? event_data : null]
    );

    res.json({ success: true, message: "Event recorded" });
  } catch (err) {
    console.error("Error saving event:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// GET /events/:userId → fetch events for a user
router.get("user/:userId", async (req, res) => {
  try {
    const rows = await db.any(
      `SELECT * FROM user_events WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userID]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// (Optional) GET /events/:userId/:classification → filter by classification
router.get("/:userId/:classification", async (req, res) => {
  try {
    const rows = await db.any(
      `SELECT * FROM user_events
       WHERE user_id = $1 AND classification = $2
       ORDER BY created_at DESC`,
      [req.params.userId, req.params.classification]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching events by classification:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/designation", async (req, res) => {
  try {
    const parentId = req.session.userID; // from session 

    if (!parentId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const result = await db.oneOrNone(
      `SELECT designation
       FROM parents
       WHERE parentid = $1`,
      [parentId]
    );

    if (!result) {
      return res.status(404).json({ error: "Parent not found" });
    }

    res.json({ designation: result.designation });
  } catch (err) {
    console.error("Error fetching designation:", err);
    res.status(500).json({ error: "Failed to fetch designation" });
  }
});

export default router;

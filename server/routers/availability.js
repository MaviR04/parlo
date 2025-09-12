// server/routes/availability.js
import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

function requireTeacherOrCoach(req, res, next) {
  if (!["Teacher", "Coach"].includes(req.user?.userRole)) {
    return res.status(403).json({ error: "Teachers or Coaches only" });
  }
  next();
}

// GET /availability/me
router.get("/me", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const rows = await db.any(
      `
      SELECT weekday,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time,   'HH24:MI') AS end_time
      FROM teacher_availability_slots
      WHERE teacher_id = $1
      ORDER BY weekday, start_time
      `,
      [teacherId]
    );
    res.json({ slots: rows });
  } catch (e) {
    console.error("GET /availability/me error", e);
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// POST /availability/replace
router.post("/replace", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const { slots } = req.body || {};

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: "slots must be an array" });
    }

    for (const s of slots) {
      const bad =
        typeof s.weekday !== "number" ||
        s.weekday < 0 ||
        s.weekday > 6 ||
        !/^\d{2}:\d{2}$/.test(s.start) ||
        !/^\d{2}:\d{2}$/.test(s.end) ||
        s.start >= s.end;
      if (bad) {
        return res.status(400).json({ error: "Invalid slot format" });
      }
    }

    await db.tx(async (tx) => {
      await tx.none(
        "DELETE FROM teacher_availability_slots WHERE teacher_id = $1",
        [teacherId]
      );

      for (const s of slots) {
        await tx.none(
          `INSERT INTO teacher_availability_slots
             (teacher_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3::time, $4::time)`,
          [teacherId, s.weekday, s.start, s.end]
        );
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /availability/replace error:", e);
    res.status(500).json({ error: e.message || "Failed to save availability" });
  }
});

// GET /availability/for/:teacherId
router.get("/for/:teacherId", async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);
    if (!Number.isInteger(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher id" });
    }
    const rows = await db.any(
      `
      SELECT weekday,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time,   'HH24:MI') AS end_time
      FROM teacher_availability_slots
      WHERE teacher_id = $1
      ORDER BY weekday, start_time
      `,
      [teacherId]
    );
    res.json({ slots: rows });
  } catch (e) {
    console.error("GET /availability/for/:teacherId error", e);
    res.status(500).json({ error: "Failed to load availability" });
  }
});

// GET /availability/my-meetings
router.get("/my-meetings", requireAuth, requireTeacherOrCoach, async (req, res) => {
  try {
    const teacherId = req.user.userid;
    const rows = await db.any(
      `
      SELECT m.meeting_id,
             m.weekday,
             to_char(m.start_time, 'HH24:MI') AS start_time,
             to_char(m.end_time, 'HH24:MI')   AS end_time,
             m.status,
             u.fname || ' ' || u.lname AS parent_name
      FROM meetings m
      JOIN users u ON m.parent_id = u.userid
      WHERE m.teacher_id = $1
      ORDER BY m.weekday, m.start_time
      `,
      [teacherId]
    );
    res.json({ meetings: rows });
  } catch (e) {
    console.error("GET /availability/my-meetings error", e);
    res.status(500).json({ error: "Failed to load meetings" });
  }
});


export default router;

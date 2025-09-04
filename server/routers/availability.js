// server/routes/availability.js
import express from "express";
import db from "../db.js";                 // your pg-promise instance
import { requireAuth } from "../middleware/requireAuth.js"; // must set req.user

const router = express.Router();

// Only teachers can manage their own availability
function requireTeacher(req, res, next) {
  if (req.user?.userRole !== "Teacher") {
    return res.status(403).json({ error: "Teachers only" });
  }
  next();
}

/**
 * GET /availability/me
 * Returns: { slots: [{ weekday: 1, start_time: "13:45", end_time: "14:15" }, ...] }
 */
router.get("/me", requireAuth, requireTeacher, async (req, res) => {
  try {
    // IMPORTANT: use req.user.userid (not id)
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

/**
 * POST /availability/replace
 * Body: { slots: [{ weekday: number (0-6), start: "HH:MM", end: "HH:MM" }, ...] }
 * Replaces ALL availability for the current teacher with the provided set.
 */
router.post("/replace", async (req, res) => {
  try {
    const teacherId = req.session?.userID;
    const role = req.session?.userRole;

    if (!teacherId) return res.status(401).json({ error: "Not authenticated" });
    if (role !== "Teacher") return res.status(403).json({ error: "Teachers only" });

    const { slots } = req.body || {};
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: "slots must be an array" });
    }

    for (const s of slots) {
      const bad =
        typeof s.weekday !== "number" ||
        s.weekday < 0 || s.weekday > 6 ||
        !/^\d{2}:\d{2}$/.test(s.start) ||
        !/^\d{2}:\d{2}$/.test(s.end) ||
        s.start >= s.end;
      if (bad) {
        return res.status(400).json({ error: "Invalid slot format" });
      }
    }

    // Simple tx: delete then insert rows
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

export default router;

import express from "express";
import db from "../db.js";

const router = express.Router();

// Middleware: Require login
function requireLogin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// GET /terms - fetch all terms + Whole Year virtual term
router.get("/", requireLogin, async (req, res) => {
  try {
    const terms = await db.any(`
      SELECT termid, name, start_date, end_date
      FROM terms
      ORDER BY start_date
    `);

    const wholeYearRange = await db.one(`
      SELECT MIN(start_date) AS start_date, MAX(end_date) AS end_date FROM terms
    `);

    const allTerms = [
      {
        termid: 0,
        name: "Whole Year",
        start_date: wholeYearRange.start_date,
        end_date: wholeYearRange.end_date,
      },
      ...terms,
    ];

    res.json(allTerms);
  } catch (err) {
    console.error("Failed to fetch terms", err);
    res.status(500).json({ error: "Failed to load terms" });
  }
});

export default router;

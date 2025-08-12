import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userID) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

router.get("/", requireLogin, async (req, res) => {
  try {
    const terms = await db.any(`
      SELECT termid, name, start_date, end_date
      FROM terms
      ORDER BY start_date
    `);

    const groups = {};

    for (const term of terms) {
      const start = new Date(term.start_date);

      let startYear, endYear;
      if (start.getMonth() >= 7) {
        // Aug–Dec months start a new school year
        startYear = start.getFullYear();
        endYear = startYear + 1;
      } else {
        // Jan–Jul months belong to previous school year
        startYear = start.getFullYear() - 1;
        endYear = start.getFullYear();
      }

      const schoolYear = `${startYear}-${endYear}`;
      if (!groups[schoolYear]) groups[schoolYear] = [];
      groups[schoolYear].push(term);
    }

    const result = Object.entries(groups)
      .map(([schoolYear, terms]) => ({
        schoolYear,
        terms: terms.sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
      }))
      .sort((a, b) => (a.schoolYear < b.schoolYear ? 1 : -1));

    res.json(result);
  } catch (err) {
    console.error("Failed to fetch terms", err);
    res.status(500).json({ error: "Failed to load terms" });
  }
});


router.get("/current", requireLogin, async (req, res) => {
  try {
    const term = await db.oneOrNone(
      `
            SELECT termid, name, start_date, end_date
            FROM terms
            WHERE CURRENT_DATE BETWEEN start_date AND end_date
            LIMIT 1
            `
    );

    if (!term) {
      return res.status(404).json({ error: "No current term found" });
    }

    // Calculate school year
    const start = new Date(term.start_date);
    let startYear, endYear;
    if (start.getMonth() >= 7) {
      startYear = start.getFullYear();
      endYear = startYear + 1;
    } else {
      startYear = start.getFullYear() - 1;
      endYear = start.getFullYear();
    }
    term.schoolYear = `${startYear}-${endYear}`;

    res.json(term);
  } catch (err) {
    console.error("Failed to fetch current term:", err);
    res.status(500).json({ error: "Failed to load current term" });
  }
});

// Get all terms
router.get("/", requireLogin, async (req, res) => {
  try {
    const terms = await db.any("SELECT * FROM terms ORDER BY start_date DESC");
    res.json(terms);
  } catch (err) {
    console.error("Error fetching terms:", err);
    res.status(500).json({ error: "Failed to fetch terms" });
  }
});

// Add term
router.post("/", requireLogin, async (req, res) => {
  const { name, start_date, end_date } = req.body;
  try {
    const inserted = await db.one(
      `INSERT INTO terms (name, start_date, end_date) 
             VALUES ($1, $2, $3) RETURNING *`,
      [name, start_date, end_date]
    );
    res.json(inserted);
  } catch (err) {
    console.error("Error adding term:", err);
    res.status(500).json({ error: "Failed to add term" });
  }
});

// Delete term
router.delete("/:id", requireLogin, async (req, res) => {
  try {
    await db.none("DELETE FROM terms WHERE termid = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting term:", err);
    res.status(500).json({ error: "Failed to delete term" });
  }
});

export default router;

// routers/behaviour.js
import express from "express";
import db from "../db.js";

const router = express.Router();

/** Require logged-in user (session-based) */
function requireLogin(req, res, next) {
    if (!req.session?.userID) return res.status(401).json({ error: "Not logged in" });
    next();
}

/** Helpers */
function isValidISODate(str) {
    // Expect YYYY-MM-DD; Date parse can be messy so we do a quick shape check first
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str + "T00:00:00Z");
    return !Number.isNaN(d.getTime());
}

// Get Monday (week start) for a given ISO date string (YYYY-MM-DD)
function getWeekStartDate(dateStr) {
    const date = new Date(dateStr + "T00:00:00Z");
    const day = date.getUTCDay(); // Sunday=0 ... Saturday=6 (UTC to avoid TZ drift)
    const diff = (day === 0 ? -6 : 1) - day; // Shift Sunday to previous Monday
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + diff);
    return monday.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Validate ratings are integers 1–3
function validateRatings({ focus_engagement, respect_kindness, self_management }) {
    const fields = { focus_engagement, respect_kindness, self_management };
    for (const [key, value] of Object.entries(fields)) {
        if (![1, 2, 3].includes(Number(value))) {
            return `${key} must be an integer in {1,2,3}`;
        }
    }
    return null;
}

/** =========================
 *  ROUTES
 *  ========================= */

/**
 * GET current active term for behaviour marking
 */
router.get("/current-term", requireLogin, async (req, res) => {
    try {
        const term = await db.oneOrNone(
            `SELECT termid, name, start_date, end_date
       FROM terms
       WHERE NOW()::date BETWEEN start_date AND end_date`
        );
        if (!term) return res.status(404).json({ error: "No current term found" });
        res.json(term);
    } catch (err) {
        console.error("Error fetching current term:", err);
        res.status(500).json({ error: "Failed to fetch current term" });
    }
});

/**
 * GET behaviour record for specific child & term (optionally by week_start_date)
 * Query param: week (optional, default = current week's Monday)
 */
router.get("/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;
    let { week } = req.query;

    try {
        // Default week to current
        if (!week) {
            week = getWeekStartDate(new Date().toISOString().slice(0, 10));
        } else {
            if (!isValidISODate(week)) {
                return res.status(400).json({ error: "Invalid 'week' format. Use YYYY-MM-DD." });
            }
            week = getWeekStartDate(week); // normalize to Monday
        }

        const row = await db.oneOrNone(
            `SELECT id, child_id, term_id, week_start_date,
              focus_engagement, respect_kindness, self_management,
              weekly_note, recorded_by, created_at, updated_at
       FROM behaviour
       WHERE child_id = $1 AND term_id = $2 AND week_start_date = $3`,
            [childId, termId, week]
        );

        return res.json(row || null);
    } catch (err) {
        console.error("Error fetching behaviour record:", err);
        res.status(500).json({ error: "Failed to load behaviour data" });
    }
});

/**
 * POST upsert behaviour record (single)
 * Body: { child_id, term_id, week_start_date, focus_engagement, respect_kindness, self_management, weekly_note }
 * Notes:
 *  - week_start_date will be normalized to Monday
 *  - ratings must be 1..3
 */
router.post("/", requireLogin, async (req, res) => {
    const {
        child_id,
        term_id,
        week_start_date,
        focus_engagement,
        respect_kindness,
        self_management,
        weekly_note = null,
    } = req.body;

    if (!child_id || !term_id) {
        return res.status(400).json({ error: "child_id and term_id are required" });
    }
    if (!week_start_date || !isValidISODate(week_start_date)) {
        return res.status(400).json({ error: "week_start_date (YYYY-MM-DD) is required" });
    }

    const normalizedWeek = getWeekStartDate(week_start_date);
    const ratingError = validateRatings({ focus_engagement, respect_kindness, self_management });
    if (ratingError) return res.status(400).json({ error: ratingError });

    const recordedBy = req.session.userID;

    try {
        // Upsert via ON CONFLICT on (child_id, term_id, week_start_date)
        await db.none(
            `INSERT INTO behaviour (
          child_id, term_id, week_start_date,
          focus_engagement, respect_kindness, self_management,
          weekly_note, recorded_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (child_id, term_id, week_start_date)
        DO UPDATE SET
          focus_engagement = EXCLUDED.focus_engagement,
          respect_kindness = EXCLUDED.respect_kindness,
          self_management  = EXCLUDED.self_management,
          weekly_note      = EXCLUDED.weekly_note,
          recorded_by      = EXCLUDED.recorded_by,
          updated_at       = NOW()`,
            [
                child_id,
                term_id,
                normalizedWeek,
                Number(focus_engagement),
                Number(respect_kindness),
                Number(self_management),
                weekly_note,
                recordedBy,
            ]
        );

        res.json({ message: "Behaviour saved successfully", week_start_date: normalizedWeek });
    } catch (err) {
        console.error("Error saving behaviour:", err);
        res.status(500).json({ error: "Failed to save behaviour data" });
    }
});

/**
 * POST /bulk
 * Upsert many weekly records in one go (for efficiency with 40–100+ students).
 * Body: { items: [ { child_id, term_id, week_start_date, focus_engagement, respect_kindness, self_management, weekly_note? }, ... ] }
 */
router.post("/bulk", requireLogin, async (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items[] is required" });
    }

    // Validate all first
    for (const [idx, it] of items.entries()) {
        const {
            child_id,
            term_id,
            week_start_date,
            focus_engagement,
            respect_kindness,
            self_management,
        } = it || {};
        if (!child_id || !term_id || !week_start_date) {
            return res.status(400).json({ error: `items[${idx}] missing required fields` });
        }
        if (!isValidISODate(week_start_date)) {
            return res.status(400).json({ error: `items[${idx}].week_start_date must be YYYY-MM-DD` });
        }
        const ratingError = validateRatings({ focus_engagement, respect_kindness, self_management });
        if (ratingError) {
            return res.status(400).json({ error: `items[${idx}]: ${ratingError}` });
        }
    }

    const recordedBy = req.session.userID;

    try {
        // Use a single multi-row INSERT with ON CONFLICT for speed
        // Build value placeholders dynamically
        const cols =
            "(child_id, term_id, week_start_date, focus_engagement, respect_kindness, self_management, weekly_note, recorded_by, created_at, updated_at)";
        const values = [];
        const params = [];

        items.forEach((it, i) => {
            const normalizedWeek = getWeekStartDate(it.week_start_date);
            // push placeholders: ($1,$2,...)
            const base = i * 10;
            values.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, NOW(), NOW())`
            );
            params.push(
                it.child_id,
                it.term_id,
                normalizedWeek,
                Number(it.focus_engagement),
                Number(it.respect_kindness),
                Number(it.self_management),
                it.weekly_note ?? null,
                recordedBy
            );
        });

        const sql = `
      INSERT INTO behaviour ${cols}
      VALUES ${values.join(",")}
      ON CONFLICT (child_id, term_id, week_start_date)
      DO UPDATE SET
        focus_engagement = EXCLUDED.focus_engagement,
        respect_kindness = EXCLUDED.respect_kindness,
        self_management  = EXCLUDED.self_management,
        weekly_note      = EXCLUDED.weekly_note,
        recorded_by      = EXCLUDED.recorded_by,
        updated_at       = NOW()
    `;

        await db.none(sql, params);
        res.json({ message: "Bulk behaviour save successful", count: items.length });
    } catch (err) {
        console.error("Error saving bulk behaviour:", err);
        res.status(500).json({ error: "Failed to save bulk behaviour data" });
    }
});

/**
 * GET behaviour summary for a child and term
 * Returns:
 *  - latest weekly record
 *  - averages across the term for the 3 metrics
 */
router.get("/term-summary/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        const latest = await db.oneOrNone(
            `SELECT id, child_id, term_id, week_start_date,
              focus_engagement, respect_kindness, self_management,
              weekly_note, recorded_by, created_at, updated_at
       FROM behaviour
       WHERE child_id = $1 AND term_id = $2
       ORDER BY week_start_date DESC
       LIMIT 1`,
            [childId, termId]
        );

        const averages = await db.oneOrNone(
            `SELECT
          ROUND(AVG(focus_engagement)::numeric, 2) AS focus_engagement_avg,
          ROUND(AVG(respect_kindness)::numeric, 2) AS respect_kindness_avg,
          ROUND(AVG(self_management)::numeric, 2)  AS self_management_avg,
          COUNT(*) AS weeks_count
       FROM behaviour
       WHERE child_id = $1 AND term_id = $2`,
            [childId, termId]
        );

        res.json({ latest, averages });
    } catch (err) {
        console.error("Error fetching behaviour term summary:", err);
        res.status(500).json({ error: "Failed to load behaviour summary" });
    }
});


/* =========================
 *  OVERVIEW ENDPOINTS
 * ========================= */

/**
 * Helper: fetch students in a class.
 * Adjust table/column names if yours differ:
 * - class_students(class_id, child_id)
 * - children(childid, fname, lname)
 */
// Get all students in a class from childclasses + children
async function getStudentsInClass(classId) {
    return db.manyOrNone(
        `SELECT ch.childid, ch.fname, ch.lname
     FROM childclasses cc
     JOIN children ch ON ch.childid = cc.childid
     WHERE cc.classid = $1
     ORDER BY ch.lname, ch.fname`,
        [classId]
    );
}

// GET /behaviour/class-overview?class_id=4&term_id=6
router.get("/class-overview", async (req, res) => {
    const { class_id, term_id } = req.query;

    if (!class_id || !term_id) {
        return res.status(400).json({ error: "Missing class_id or term_id" });
    }

    try {
        const result = await db.any(`
            SELECT 
                c.childid,
                c.fname,
                c.lname,
                ROUND(AVG(b.focus_engagement)::numeric, 2) AS avg_focus_engagement,
                ROUND(AVG(b.respect_kindness)::numeric, 2) AS avg_respect_kindness,
                ROUND(AVG(b.self_management)::numeric, 2) AS avg_self_management,
                ROUND((
                    COALESCE(AVG(b.focus_engagement), 0) +
                    COALESCE(AVG(b.respect_kindness), 0) +
                    COALESCE(AVG(b.self_management), 0)
                ) / 3.0, 2) AS overall_avg,
                COUNT(b.id) AS weeks_recorded
            FROM childclasses cc
            JOIN children c 
                ON cc.childid = c.childid
            LEFT JOIN behaviour b
                ON b.child_id = c.childid
                AND b.term_id = $2
            WHERE cc.classid = $1
            GROUP BY c.childid, c.fname, c.lname
            ORDER BY c.lname, c.fname
        `, [class_id, term_id]);

        res.json(result);
    } catch (err) {
        console.error("Error fetching behaviour overview:", err);
        res.status(500).json({ error: "Failed to load class overview" });
    }
});



/**
 * GET /behaviour/student-weeks/:childId/:termId
 * Returns all weeks for a student in a term:
 * [
 *   { week_start_date, focus_engagement, respect_kindness, self_management,
 *     weekly_note, overall, delta }  // delta vs previous week overall
 * ]
 */
router.get("/student-weeks/:childId/:termId", requireLogin, async (req, res) => {
    const { childId, termId } = req.params;

    try {
        const list = await db.manyOrNone(
            `SELECT week_start_date,
              focus_engagement, respect_kindness, self_management,
              weekly_note,
              (focus_engagement + respect_kindness + self_management) / 3.0 AS overall
       FROM behaviour
       WHERE child_id = $1 AND term_id = $2
       ORDER BY week_start_date ASC`,
            [childId, termId]
        );

        // compute delta vs previous overall
        for (let i = 1; i < list.length; i++) {
            list[i].delta = Number(list[i].overall) - Number(list[i - 1].overall);
        }
        if (list.length) list[0].delta = null;

        res.json(list);
    } catch (err) {
        console.error("student-weeks error:", err);
        res.status(500).json({ error: "Failed to load student weeks" });
    }
});


// GET /behaviour/class-trend
router.get("/class-trend", async (req, res) => {
    const { class_id, term_id } = req.query;

    if (!class_id || !term_id) {
        return res.status(400).json({ error: "Missing class_id or term_id" });
    }

    try {
        const result = await db.any(
            `
      SELECT 
        b.week_start_date,
        ROUND(AVG((b.focus_engagement + b.respect_kindness + b.self_management) / 3.0)::numeric, 2) AS overall_avg
      FROM childclasses cc
      JOIN children c 
        ON cc.childid = c.childid
      JOIN behaviour b
        ON b.child_id = c.childid
        AND b.term_id = $2
      WHERE cc.classid = $1
      GROUP BY b.week_start_date
      ORDER BY b.week_start_date ASC
      `,
            [class_id, term_id]
        );

        res.json(result);
    } catch (err) {
        console.error("Error fetching class trend:", err);
        res.status(500).json({ error: "Failed to load class trend" });
    }
});


// GET /behaviour/student-trend
router.get("/student-trend", async (req, res) => {
    const { student_id, term_id } = req.query;

    if (!student_id || !term_id) {
        return res.status(400).json({ error: "Missing student_id or term_id" });
    }

    try {
        const result = await db.any(
            `
      SELECT 
        b.week_start_date,
        b.focus_engagement,
        b.respect_kindness,
        b.self_management,
        ROUND(((b.focus_engagement + b.respect_kindness + b.self_management) / 3.0)::numeric, 2) AS overall_avg
      FROM behaviour b
      WHERE b.child_id = $1
        AND b.term_id = $2
      ORDER BY b.week_start_date ASC
      `,
            [student_id, term_id]
        );

        res.json(result);
    } catch (err) {
        console.error("Error fetching student trend:", err);
        res.status(500).json({ error: "Failed to load student trend" });
    }
});



// GET /behaviour/at-risk?class_id=4&term_id=6&limit=5
router.get("/at-risk", async (req, res) => {
    const { class_id, term_id, limit = 5 } = req.query;
    if (!class_id || !term_id) {
        return res.status(400).json({ error: "Missing class_id or term_id" });
    }

    try {
        const rows = await db.any(
            `
      WITH weeks AS (
        SELECT
          c.childid,
          c.fname,
          c.lname,
          b.week_start_date::date AS week_start_date,
          (b.focus_engagement + b.respect_kindness + b.self_management) / 3.0 AS overall
        FROM childclasses cc
        JOIN children c ON c.childid = cc.childid
        LEFT JOIN behaviour b
          ON b.child_id = c.childid
         AND b.term_id = $2
        WHERE cc.classid = $1
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY childid ORDER BY week_start_date DESC) AS rn
        FROM weeks
        WHERE week_start_date IS NOT NULL
      ),
      agg AS (
        SELECT
          childid, fname, lname,
          COUNT(*) FILTER (WHERE overall IS NOT NULL) AS weeks_recorded,
          ROUND(AVG(overall)::numeric, 2) AS overall_avg,
          ROUND(AVG(overall) FILTER (WHERE rn <= 3)::numeric, 2) AS last3_avg,
          ROUND(AVG(overall) FILTER (WHERE rn BETWEEN 4 AND 6)::numeric, 2) AS prev3_avg
        FROM ranked
        GROUP BY childid, fname, lname
      )
      SELECT
        childid, fname, lname, weeks_recorded, overall_avg, last3_avg, prev3_avg,
        ROUND((COALESCE(prev3_avg, last3_avg) - COALESCE(last3_avg, 0))::numeric, 2) AS recent_drop
      FROM agg
      WHERE weeks_recorded >= 3
      ORDER BY
        -- prioritize low recent performance, then big recent drops
        last3_avg NULLS LAST,
        (COALESCE(prev3_avg, last3_avg) - COALESCE(last3_avg, 0)) DESC NULLS LAST
      LIMIT $3
      `,
            [class_id, term_id, Number(limit)]
        );

        // Attach simple reasons for UI
        const flagged = rows
            .map(r => {
                const reasons = [];
                if (r.last3_avg !== null && r.last3_avg <= 2.0) reasons.push("Low recent avg (≤ 2.0)");
                if (r.recent_drop !== null && r.recent_drop >= 0.3) reasons.push(`Recent drop (−${r.recent_drop.toFixed(2)})`);
                return { ...r, reasons };
            })
            .filter(r => r.reasons.length > 0);

        res.json(flagged);
    } catch (err) {
        console.error("Error fetching at-risk list:", err);
        res.status(500).json({ error: "Failed to load at-risk students" });
    }
});

export default router;

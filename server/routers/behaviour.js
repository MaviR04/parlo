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
    const date = new Date(dateStr + "T00:00:00"); // local time
    const day = date.getDay(); // 0..6 (Sun..Sat)
    const diff = (day === 0 ? -6 : 1) - day;      // shift to Monday
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, "0");
    const d = String(monday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;                      // YYYY-MM-DD (no UTC conversion)
}


function normalizeWeekParam(weekStr) {
    if (!weekStr) return null;
    const s = String(weekStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return getWeekStartDate(s);
    const head10 = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(head10)) return getWeekStartDate(head10);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return getWeekStartDate(d.toISOString().slice(0, 10));
    throw new Error("INVALID_WEEK");
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
    const userId = req.session.userID;

    try {
        if (!week) {
            week = getWeekStartDate(new Date().toISOString().slice(0, 10));
        } else {
            if (!isValidISODate(week)) {
                return res.status(400).json({ error: "Invalid 'week' format. Use YYYY-MM-DD." });
            }
            week = getWeekStartDate(week);
        }

        const row = await db.oneOrNone(
            `SELECT id, child_id, term_id, week_start_date,
              focus_engagement, respect_kindness, self_management,
              weekly_note, recorded_by, created_at, updated_at
       FROM behaviour
       WHERE child_id = $1
         AND term_id = $2
         AND week_start_date = $3
         AND recorded_by = $4`,
            [childId, termId, week, userId]
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
        await db.none(
            `INSERT INTO behaviour (
         child_id, term_id, week_start_date,
         focus_engagement, respect_kindness, self_management,
         weekly_note, recorded_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (child_id, term_id, week_start_date, recorded_by)
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
                recordedBy
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

    for (const [idx, it] of items.entries()) {
        const { child_id, term_id, week_start_date, focus_engagement, respect_kindness, self_management } = it || {};
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
        const cols = `(child_id, term_id, week_start_date, focus_engagement, respect_kindness, self_management, weekly_note, recorded_by, created_at, updated_at)`;
        const values = [];
        const params = [];

        items.forEach((it, i) => {
            const normalizedWeek = getWeekStartDate(it.week_start_date);
            const base = i * 8; // FIXED: 8 params before NOW()

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
      ON CONFLICT (child_id, term_id, week_start_date, recorded_by)
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
router.get("/class-trend", requireLogin, async (req, res) => {
  const userId = req.session.userID;
  const { class_id, term_id } = req.query;
  let { teacher_id, subject } = req.query;
  let source = (req.query.source || "all").toLowerCase(); // all | class | subject

  if (!class_id || !term_id) {
    return res.status(400).json({ error: "Missing class_id or term_id" });
  }

  try {
    const cls = await db.oneOrNone(
      "SELECT classteacher FROM classes WHERE classid = $1",
      [class_id]
    );
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const isCT = Number(cls.classteacher) === Number(userId);
    const uc = await db.oneOrNone(
      "SELECT 1 FROM userclasses WHERE classid = $1 AND userid = $2",
      [class_id, userId]
    );
    const isST = !!uc;

    if (!isCT && !isST) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }

    if (!isCT) {
      // subject teachers only see their own rows
      teacher_id = userId;
      subject = null;
      source = "subject";
    }

    const params = [class_id, term_id];
    let pi = params.length;
    const filters = [];

    // Apply source for CTs
    if (isCT) {
      if (source === "class") {
        filters.push(`b.recorded_by = cls.classteacher`);
      } else if (source === "subject") {
        filters.push(`b.recorded_by <> cls.classteacher`);
      }
    }

    if (teacher_id) {
      filters.push(`b.recorded_by = $${++pi}`);
      params.push(Number(teacher_id));
    }

    if (subject) {
      filters.push(`
        EXISTS (
          SELECT 1 FROM userclasses uc
          WHERE uc.userid = b.recorded_by
            AND uc.classid = $${++pi}
            AND uc.role ILIKE $${++pi}
        )
      `);
      params.push(Number(class_id), `%${subject}%`);
    }

    const filterSql = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const rows = await db.any(
      `
      SELECT 
        to_char(b.week_start_date, 'YYYY-MM-DD') AS week_ymd,
        ROUND(AVG((b.focus_engagement + b.respect_kindness + b.self_management) / 3.0)::numeric, 2) AS overall_avg
      FROM behaviour b
      JOIN childclasses cc ON cc.childid = b.child_id
      JOIN classes cls ON cls.classid = cc.classid
      WHERE cc.classid = $1
        AND b.term_id = $2
        ${filterSql}
      GROUP BY b.week_start_date
      ORDER BY b.week_start_date ASC
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching class trend:", err);
    res.status(500).json({ error: "Failed to load class trend" });
  }
});


// GET /behaviour/student-trend

router.get("/student-trend", requireLogin, async (req, res) => {
  const userId = req.session.userID;
  const { student_id, term_id } = req.query;
  let { teacher_id, subject, class_id } = req.query;
  let source = (req.query.source || "all").toLowerCase(); // all | class | subject

  if (!student_id || !term_id) {
    return res.status(400).json({ error: "Missing student_id or term_id" });
  }

  try {
    // Are you a CT or a subject teacher for ANY class this student is in?
    const vis = await db.one(
      `
      SELECT
        EXISTS (
          SELECT 1
          FROM classes cls
          JOIN childclasses cc ON cc.classid = cls.classid
          WHERE cc.childid = $1 AND cls.classteacher = $2
        ) AS is_ct,
        EXISTS (
          SELECT 1
          FROM childclasses cc
          JOIN userclasses uc ON uc.classid = cc.classid
          WHERE cc.childid = $1 AND uc.userid = $2
        ) AS is_st
      `,
      [student_id, userId]
    );

    if (!vis.is_ct && !vis.is_st) {
      return res.status(403).json({ error: "You are not assigned to this student" });
    }

    // Non-CTs can only see their own rows; ignore incoming filters
    if (!vis.is_ct) {
      teacher_id = userId;
      subject = null;
      class_id = null;
      source = "subject"; // sanity
    }

    const params = [student_id, term_id];
    let pi = params.length;
    const filters = [];

    // If CT, allow "source" to filter by who recorded the rating,
    // without needing class_id (works across the student's classes).
    if (vis.is_ct) {
      if (source === "class") {
        filters.push(`
          EXISTS (
            SELECT 1
            FROM childclasses cc2
            JOIN classes cls2 ON cls2.classid = cc2.classid
            WHERE cc2.childid = b.child_id
              AND cls2.classteacher = b.recorded_by
          )
        `);
      } else if (source === "subject") {
        filters.push(`
          NOT EXISTS (
            SELECT 1
            FROM childclasses cc2
            JOIN classes cls2 ON cls2.classid = cc2.classid
            WHERE cc2.childid = b.child_id
              AND cls2.classteacher = b.recorded_by
          )
        `);
      }
    }

    if (teacher_id) {
      filters.push(`b.recorded_by = $${++pi}`);
      params.push(Number(teacher_id));
    }

    // Subject filter only applied when a concrete class is given
    if (subject && class_id) {
      filters.push(`
        EXISTS (
          SELECT 1
          FROM userclasses uc
          WHERE uc.userid = b.recorded_by
            AND uc.classid = $${++pi}
            AND uc.role ILIKE $${++pi}
        )
      `);
      params.push(Number(class_id), `%${subject}%`);
    }

    const filterSql = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const rows = await db.any(
      `
      SELECT 
        to_char(b.week_start_date, 'YYYY-MM-DD') AS week_ymd,
        ROUND(AVG(b.focus_engagement)::numeric, 2) AS focus_engagement,
        ROUND(AVG(b.respect_kindness)::numeric, 2) AS respect_kindness,
        ROUND(AVG(b.self_management)::numeric, 2)  AS self_management,
        ROUND(((AVG(b.focus_engagement)+AVG(b.respect_kindness)+AVG(b.self_management))/3.0)::numeric, 2) AS overall_avg
      FROM behaviour b
      WHERE b.child_id = $1
        AND b.term_id = $2
        ${filterSql}
      GROUP BY b.week_start_date
      ORDER BY b.week_start_date ASC
      `,
      params
    );

    res.json(rows);
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


// Weeks that have behaviour for this class+term (role-aware)
router.get("/available-weeks", requireLogin, async (req, res) => {
    const { class_id, term_id } = req.query;
    if (!class_id || !term_id) {
        return res.status(400).json({ error: "class_id and term_id are required" });
    }
    const userId = req.session.userID;

    try {
        const cls = await db.oneOrNone(
            "SELECT classteacher FROM classes WHERE classid = $1",
            [class_id]
        );
        if (!cls) return res.status(404).json({ error: "Class not found" });

        const isClassTeacher = Number(cls.classteacher) === Number(userId);
        const uc = await db.oneOrNone(
            "SELECT 1 FROM userclasses WHERE classid = $1 AND userid = $2",
            [class_id, userId]
        );
        const isSubjectTeacherForClass = !!uc;

        if (!isClassTeacher && !isSubjectTeacherForClass) {
            return res.status(403).json({ error: "You are not assigned to this class" });
        }

        const params = [class_id, term_id];
        let pi = params.length;

        const ownOnlyFilter = isClassTeacher ? "" : `AND b.recorded_by = $${++pi}`;
        if (!isClassTeacher) params.push(userId);

        // Return clean YYYY-MM-DD strings
        const weeks = await db.any(
            `
      SELECT DISTINCT to_char(b.week_start_date, 'YYYY-MM-DD') AS week_start_date
      FROM behaviour b
      JOIN childclasses cc ON cc.childid = b.child_id
      WHERE cc.classid = $1
        AND b.term_id = $2
        ${ownOnlyFilter}
      ORDER BY week_start_date DESC
      `,
            params
        );

        res.json(weeks.map((w) => w.week_start_date));
    } catch (err) {
        console.error("available-weeks error:", err);
        res.status(500).json({ error: "Failed to load available weeks" });
    }
});


//  * GET /behaviour/overview-grouped?class_id=...&term_id=...&source=all|class|subject&week=YYYY-MM-DD
//  */
router.get("/overview-grouped", requireLogin, async (req, res) => {
    const { class_id, term_id } = req.query;
    let source = (req.query.source || "all").toLowerCase();
    let week = null;

    if (!class_id || !term_id) {
        return res.status(400).json({ error: "class_id and term_id are required" });
    }

    try {
        if (req.query.week) week = normalizeWeekParam(req.query.week);
    } catch {
        return res.status(400).json({ error: "Invalid week; use YYYY-MM-DD" });
    }

    const userId = req.session.userID;

    try {
        // Who is the class teacher?
        const cls = await db.oneOrNone(
            "SELECT classteacher FROM classes WHERE classid = $1",
            [class_id]
        );
        if (!cls) return res.status(404).json({ error: "Class not found" });

        const isClassTeacher = Number(cls.classteacher) === Number(userId);
        // Is subject teacher for this class?
        const uc = await db.oneOrNone(
            "SELECT 1 FROM userclasses WHERE classid = $1 AND userid = $2",
            [class_id, userId]
        );
        const isSubjectTeacherForClass = !!uc;

        if (!isClassTeacher && !isSubjectTeacherForClass) {
            return res.status(403).json({ error: "You are not assigned to this class" });
        }

        // Enforce visibility
        const effectiveSource = isClassTeacher ? source : "subject";
        const ownOnlyUserId = isClassTeacher ? null : userId;

        // Build dynamic filters
        const params = [class_id, term_id, effectiveSource];
        let pi = params.length;

        const weekFilter = week ? `AND b.week_start_date = $${++pi}` : "";
        if (week) params.push(week);

        const ownOnlyFilter = ownOnlyUserId ? `AND b.recorded_by = $${++pi}` : "";
        if (ownOnlyUserId) params.push(ownOnlyUserId);

        const sql = `
      WITH base AS (
        SELECT b.*, c.childid, c.fname, c.lname, cls.classteacher
        FROM behaviour b
        JOIN childclasses cc ON cc.childid = b.child_id
        JOIN children c      ON c.childid = b.child_id
        JOIN classes  cls    ON cls.classid = cc.classid
        WHERE cc.classid = $1
          AND b.term_id = $2
          ${weekFilter}
          AND (
            $3 = 'all' OR
            ($3 = 'class'   AND b.recorded_by = cls.classteacher) OR
            ($3 = 'subject' AND b.recorded_by <> cls.classteacher)
          )
          ${ownOnlyFilter} -- forces subject teachers to only see their own rows
      ),
      teacher_role AS (
        SELECT uc.userid AS teacher_id,
               uc.classid,
               uc.role,
               CASE WHEN uc.role ILIKE '%Class Teacher%' THEN 0 ELSE 1 END AS pri,
               ROW_NUMBER() OVER (
                 PARTITION BY uc.userid, uc.classid
                 ORDER BY CASE WHEN uc.role ILIKE '%Class Teacher%' THEN 0 ELSE 1 END, uc.role
               ) AS rn
        FROM userclasses uc
        WHERE uc.classid = $1
      ),
      enriched AS (
        SELECT
          b.child_id,
          b.week_start_date,
          b.focus_engagement,
          b.respect_kindness,
          b.self_management,
          b.weekly_note,
          b.recorded_by,
          (u.fname || ' ' || u.lname) AS teacher_name,
          COALESCE(tr.role, 'Subject Teacher') AS subject_name,
          b.fname,
          b.lname
        FROM base b
        JOIN users u ON u.userid = b.recorded_by
        LEFT JOIN teacher_role tr
          ON tr.teacher_id = b.recorded_by
         AND tr.classid   = $1
         AND tr.rn        = 1
      ),
      weekly_avg AS (
        SELECT
          child_id,
          week_start_date,
          AVG(focus_engagement) AS avg_focus_engagement,
          AVG(respect_kindness) AS avg_respect_kindness,
          AVG(self_management)  AS avg_self_management,
          COUNT(*) AS raters
        FROM enriched
        GROUP BY child_id, week_start_date
      )
      SELECT
        c.childid,
        c.fname,
        c.lname,
        w.week_start_date,
        ROUND(w.avg_focus_engagement::numeric, 2) AS avg_focus_engagement,
        ROUND(w.avg_respect_kindness::numeric, 2) AS avg_respect_kindness,
        ROUND(w.avg_self_management::numeric, 2)  AS avg_self_management,
        ROUND(((w.avg_focus_engagement + w.avg_respect_kindness + w.avg_self_management) / 3.0)::numeric, 2) AS overall_avg,
        w.raters,
        json_agg(
          json_build_object(
            'teacher_id',      e.recorded_by,
            'teacher_name',    e.teacher_name,
            'subject_name',    e.subject_name,
            'focus_engagement',e.focus_engagement,
            'respect_kindness',e.respect_kindness,
            'self_management', e.self_management,
            'weekly_note',     e.weekly_note
          )
          ORDER BY e.teacher_name
        ) AS entries
      FROM weekly_avg w
      JOIN children c ON c.childid = w.child_id
      JOIN enriched e ON e.child_id = w.child_id AND e.week_start_date = w.week_start_date
      GROUP BY c.childid, c.fname, c.lname, w.week_start_date,
               w.avg_focus_engagement, w.avg_respect_kindness, w.avg_self_management, w.raters
      ORDER BY c.lname, c.fname, w.week_start_date ASC;
    `;

        const rows = await db.any(sql, params);
        return res.json(rows);
    } catch (err) {
        console.error("overview-grouped error:", err);
        return res.status(500).json({ error: "Failed to load grouped overview" });
    }
});




export default router;

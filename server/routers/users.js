import express from "express"
import db from "../db.js"
import bcrypt from "bcrypt";
import session from "express-session";

const router = express.Router();

// Insert a new user (teacher, admin, parent, etc.)
function requireLogin(req, res, next) {
  if (!req.session.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}
router.post("/users", async (req, res) => {
  const { fname, lname, email, passwordhash, role } = req.body;

  if (!fname || !lname || !email || !passwordhash || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const schoolid = req.session.schoolID || null;

  try {
    // Hash the password with bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(passwordhash, saltRounds);

    const user = await db.one(
      `INSERT INTO users (fname, lname, email, passwordhash, role, schoolid)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [fname, lname, email, hashedPassword, role, schoolid]
    );

    res.status(201).json(user);
  } catch (err) {
    console.error("Error inserting user:", err);
    res.status(500).json({ error: "Failed to insert user" });
  }
});

// Insert a new child
router.post("/children", async (req, res) => {
  const { fname, lname, parentid, dateofbirth } = req.body;

  if (!fname || !lname || !parentid) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const child = await db.one(
      `INSERT INTO children (fname, lname, parentid, dateofbirth)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [fname, lname, parentid, dateofbirth || null]
    );
    res.status(201).json(child);
  } catch (err) {
    console.error("Error inserting child:", err);
    res.status(500).json({ error: "Failed to insert child" });
  }
});

// Create a new class and assign a class teacher (optional)
router.post("/classes", async (req, res) => {
  const { classname, classteacher } = req.body;

  if (!classname) {
    return res.status(400).json({ error: "Missing classname" });
  }

  try {
    const newClass = await db.one(
      `INSERT INTO classes (classname, classteacher)
       VALUES ($1, $2)
       RETURNING *`,
      [classname, classteacher || null]
    );

    // Optionally add classteacher to userclasses
    if (classteacher) {
      await db.none(
        `INSERT INTO userclasses (userid, classid, role)
         VALUES ($1, $2, 'Class Teacher')
         ON CONFLICT DO NOTHING`,
        [classteacher, newClass.classid]
      );
    }

    res.status(201).json(newClass);
  } catch (err) {
    console.error("Error inserting class:", err);
    res.status(500).json({ error: "Failed to insert class" });
  }
});


router.post("/userclasses", async (req, res) => {
  const { userid, classid, role } = req.body;

  if (!userid || !classid || !role) {
    return res.status(400).json({ error: "Missing userid, classid, or role" });
  }

  try {
    await db.none(
      `INSERT INTO userclasses (userid, classid, role)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userid, classid, role]
    );
    res.status(201).json({ message: `User ${userid} added to class ${classid} as ${role}` });
  } catch (err) {
    console.error("Error adding user to class:", err);
    res.status(500).json({ error: "Failed to add user to class" });
  }
});


router.post("/childclasses", async (req, res) => {
  const { childid, classid } = req.body;

  if (!childid || !classid) {
    return res.status(400).json({ error: "Missing childid or classid" });
  }

  try {
    await db.none(
      `INSERT INTO childclasses (childid, classid)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [childid, classid]
    );
    res.status(201).json({ message: `Child ${childid} added to class ${classid}` });
  } catch (err) {
    console.error("Error adding child to class:", err);
    res.status(500).json({ error: "Failed to add child to class" });
  }
});

router.get("/teaching-classes", async (req, res) => {
  const userid = req.session.userID;

  if (!userid) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const classes = await db.any(
      `
      SELECT 
        c.classid, 
        c.classname, 
        uc.role
      FROM userclasses uc
      JOIN classes c ON uc.classid = c.classid
      WHERE uc.userid = $1
        AND LOWER(uc.role) LIKE '%teacher%'
      `,
      [userid]
    );

    res.json(classes);
  } catch (err) {
    console.error("Error fetching teaching classes:", err);
    res.status(500).json({ error: "Failed to fetch teaching classes" });
  }
});



// Get current user's roles (class teacher / subject teacher)

router.get("/me/roles", requireLogin, async (req, res) => {
  const userId = req.session.userID;

  try {
    const homeroom = await db.oneOrNone(
      `SELECT c.classid, c.classname
       FROM classes c
       WHERE c.classteacher = $1
       LIMIT 1`,
      [userId]
    );

    const subjectClasses = await db.any(
      `SELECT DISTINCT c.classname
     FROM userclasses uc
     JOIN classes c ON c.classid = uc.classid
    WHERE uc.userid = $1
      AND LOWER(uc.role) LIKE '%teacher%'
      AND LOWER(uc.role) NOT LIKE 'class%'`,
      [userId]
    );

    const extractGrade = (s) => {
      const m = String(s || "").match(/(\d{1,2})/); // robust: any first number
      return m ? parseInt(m[1], 10) : null;
    };

    const teachesGrades = Array.from(new Set(
      subjectClasses
        .map(r => extractGrade(r.classname))
        .filter(n => Number.isFinite(n))
    )).sort((a, b) => a - b);

    res.json({
      isClassTeacher: !!homeroom,
      isSubjectTeacher: teachesGrades.length > 0,
      classname: homeroom?.classname ?? null,
      classid: homeroom?.classid ?? null,
      teachesGrades
    });
  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({ error: "Failed to load roles" });
  }
});

function ensureParent(req, res, next) {
  if (!req.user || req.user.role !== "Parent") {
    return res.status(403).json({ error: "Only parents allowed" });
  }
  next();
}


// Fetch both Teachers and Coaches
router.get("/",  requireLogin ,async (req, res) => {
  try {
    const parentId = req.session.userID;
    console.log("Parent ID" , parentId)
    // Get all children of this parent
    const childrenResult = await db.query(
      `SELECT childid FROM children WHERE parentid = $1`,
      [parentId]
    );

    const children = childrenResult; // always take rows
    console.log("Parent's children:", children);
    
    if (!children || children.length === 0) return res.json({ users: [] });

    const childIds = children.map(c => c.childid);
    console.log("Parent's children IDs:", childIds);
    // Get all teachers via classes
    const classTeachersResult = await db.query(
      `SELECT DISTINCT u.userid, u.fname, u.lname, u.role, u.email
       FROM users u
       INNER JOIN userclasses uc ON uc.userid = u.userid
       INNER JOIN childclasses cc ON cc.classid = uc.classid
       WHERE cc.childid = ANY($1)
         AND (u.role = 'Teacher' OR u.role = 'Coach')`,
      [childIds]
    );

    const classTeachers = classTeachersResult;
    console.log("Fetched class teachers for parent:", classTeachers);
    // Get all coaches via activities
    const activityCoachesResult = await db.query(
      `SELECT DISTINCT u.userid, u.fname, u.lname, u.role, u.email
       FROM users u
       INNER JOIN activity_assignments aa ON aa.coachid = u.userid
       INNER JOIN activity_enrollments ae ON ae.activityid = aa.activityid
       WHERE ae.childid = ANY($1)
         AND (u.role = 'Coach' OR u.role = 'Teacher')`,
      [childIds]
    );

    const activityCoaches = activityCoachesResult;
    console.log("Fetched activity coaches for parent:", activityCoaches);

    // Merge without duplicates
    const allUsersMap = new Map();
    [...classTeachers, ...activityCoaches].forEach(u => allUsersMap.set(u.userid, u));
    const users = Array.from(allUsersMap.values());
    console.log("Fetched teachers/coaches for parent:", users);
    return res.json({ users });
  } catch (err) {
    console.error("Error fetching teachers/coaches:", err);
    return res.status(500).json({ error: "Internal server error" });
  } 
});



export default router;

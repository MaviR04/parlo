import express from "express"
import session from "express-session";
import pgp from "pg-promise";
import db from "../db.js"


const router = express.Router();

router.get("/childteachers", async (req, res) => {
  const parentid = req.session.userid;

  if (!parentid) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const rows = await db.any(
      `SELECT
         c.childid,
         c.fname AS child_fname,
         c.lname AS child_lname,
         u.userid AS teacher_id,
         u.fname AS teacher_fname,
         u.lname AS teacher_lname,
         u.email AS teacher_email,
         uc.role AS class_role
       FROM children c
       JOIN childclasses cc ON c.childid = cc.childid
       JOIN userclasses uc ON cc.classid = uc.classid
       JOIN users u ON uc.userid = u.userid
       WHERE c.parentid = $1
       ORDER BY c.childid, u.userid`,
      [parentid]
    );

    // Group by child
    const grouped = {};
    for (const row of rows) {
      const childKey = row.childid;
      if (!grouped[childKey]) {
        grouped[childKey] = {
          childid: row.childid,
          name: `${row.child_fname} ${row.child_lname}`,
          teachers: []
        };
      }
      grouped[childKey].teachers.push({
        userid: row.teacher_id,
        name: `${row.teacher_fname} ${row.teacher_lname}`,
        email: row.teacher_email,
        role: row.class_role
      });
    }

    res.json(Object.values(grouped)); // Return as array
  } catch (err) {
    console.error("Error fetching grouped teacher-child data:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router
// /routes/children.js
import express from "express";
import db from "../db.js";

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userID) return res.status(401).json({ error: "Not logged in" });
  next();
}

// routes/children.js
router.get("/:childId", requireLogin, async (req, res) => {
  const { childId } = req.params;

  try {
    const student = await db.oneOrNone(
      `
      SELECT 
        c.childid,
        c.fname,
        c.lname,
        c.dateofbirth,
        p.fname AS parentfname,
        p.lname AS parentlname,
        cl.classname
      FROM children c
      LEFT JOIN users p 
        ON c.parentid = p.userid
      LEFT JOIN childclasses cc 
        ON c.childid = cc.childid
      LEFT JOIN classes cl 
        ON cc.classid = cl.classid
      WHERE c.childid = $1
      LIMIT 1
      `,
      [childId]
    );

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(student);
  } catch (err) {
    console.error("Error fetching student:", err);
    res.status(500).json({ error: "Failed to load student" });
  }
});


export default router;

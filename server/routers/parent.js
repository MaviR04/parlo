import express from "express";
import db from "../db.js";

const router = express.Router();

// 🔐 Middleware: Require login
function requireLogin(req, res, next) {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Not logged in" });
    }
    next();
}

router.get("/my-children", requireLogin, async (req, res) => {
    try {
        if (req.session.userRole?.toLowerCase() !== "parent") {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const q = `
            SELECT c.childid, c.fname, c.lname, cl.classname
            FROM children c
            JOIN childclasses cc ON c.childid = cc.childid
            JOIN classes cl ON cc.classid = cl.classid
            WHERE c.parentid = $1
            ORDER BY c.fname
        `;
        const rows = await db.any(q, [req.session.userID]); // ✅ use .any() for arrays
        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching children:", err);
        res.status(500).json({ error: "Server error" });
    }
});



export default router;

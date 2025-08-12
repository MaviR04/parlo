import { Link } from "react-router-dom";

export default function TeacherMiniNav({ roles = {}, classid }) {
    // DEBUG
    if (process.env.NODE_ENV !== "production") {
        console.log("TeacherMiniNav roles prop:", roles);
    }

    // Early fallback
    if (!roles || Object.keys(roles).length === 0) {
        return (
            <nav className="bg-blue-500 text-white p-2 flex gap-4">
                <Link to="/teacher/my-subjects">My Subjects</Link>
                <Link to="/teacher/grades">Enter Grades</Link>
            </nav>
        );
    }

    const {
        isClassTeacher = false,
        isSubjectTeacher = false,
        classname = "",
        classid: roleClassId = null, // now also pull classid from roles
        teachesGrades = [],
    } = roles;

    // If classid prop not given, use from roles
    const actualClassId = classid ?? roleClassId;

    // Extract grade number
    const extractGrade = (s) => {
        const m = String(s || "").match(/(\d{1,2})/);
        return m ? parseInt(m[1], 10) : null;
    };

    const homeroomGrade = extractGrade(classname);

    // Normalize teachesGrades to numbers
    const taughtGrades = (Array.isArray(teachesGrades) ? teachesGrades : [])
        .map((g) => (typeof g === "number" ? g : extractGrade(g)))
        .filter((n) => Number.isFinite(n));

    const classTeacherLTE4 =
        isClassTeacher && homeroomGrade !== null && homeroomGrade <= 4;

    const subjectTeacherLTE4 =
        isSubjectTeacher && taughtGrades.some((g) => g <= 4);

    if (process.env.NODE_ENV !== "production") {
        console.log({
            homeroomGrade,
            taughtGrades,
            classTeacherLTE4,
            subjectTeacherLTE4,
            willShowBehaviour: classTeacherLTE4 || subjectTeacherLTE4,
        });
    }

    // Rules
    const showBehaviour = classTeacherLTE4 || subjectTeacherLTE4; // only ≤4
    const showClassLinks = isClassTeacher; // any grade
    const showSubjectLinks = isSubjectTeacher || classTeacherLTE4;

    // Build & dedupe
    const links = new Map();
    const add = (title, to) => {
        if (!links.has(to)) links.set(to, title);
    };

    if (showClassLinks) {
        add("My Classes", "/teacher-dashboard");
        if (actualClassId) add("Academic Dashboard", `/teacher/academic-dashboard/${actualClassId}`);
    }

    if (showSubjectLinks) {
        add("My Subjects", "/teacher/my-subjects");
        add("Enter Grades", "/teacher/grades");
    }

    if (showBehaviour) add("Behaviour", "/teacher/behaviour");

    if (isClassTeacher || isSubjectTeacher)
        add("General Comments", "/teacher/general-comments");

    return (
        <nav className="bg-blue-500 text-white p-2 flex gap-4">
            {[...links.entries()].map(([to, title]) => (
                <Link key={to} to={to}>{title}</Link>
            ))}
        </nav>
    );
}

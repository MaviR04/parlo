// TeacherMiniNav.jsx
import { Link } from "react-router-dom";

export default function TeacherMiniNav({ roles }) {
    return (
        <nav className="bg-blue-500 text-white p-2 flex gap-4">
            {roles.isClassTeacher && (
                <>
                    <Link to="/teacher-dashboard" className="hover:underline">My Classes</Link>
                    <Link to="/teacher/attendance" className="hover:underline">Attendance</Link>
                    <Link to="/teacher/behaviour" className="hover:underline">Behaviour</Link>
                    <Link to="/teacher/general-comments" className="hover:underline">General Comments</Link>
                    <Link to="/teacher/academic" className="hover:underline">Academic Dashboard</Link>
                    <Link to="/teacher/sports" className="hover:underline">Sports Data</Link>
                </>
            )}

            {roles.isSubjectTeacher && (
                <>
                    <Link to="/teacher/my-subjects" className="hover:underline">My Subjects</Link>
                    <Link to="/teacher/grades" className="hover:underline">Enter Grades</Link>
                    <Link to="/teacher/class-average" className="hover:underline">Class Average</Link>
                </>
            )}
        </nav>
    );
}

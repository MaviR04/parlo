// TeacherDashboard.jsx
import { useEffect, useState } from "react";
import api from "../axios";
import TeacherMiniNav from "../components/TeacherMiniNav";
import { Link } from "react-router-dom";

export default function TeacherDashboard() {
    const [classes, setClasses] = useState([]);
    const [roles, setRoles] = useState({ isClassTeacher: false, isSubjectTeacher: false });
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [classesRes, rolesRes] = await Promise.all([
                    api.get("/teacher/classes"),
                    api.get("/teacher/roles")
                ]);
                setClasses(classesRes.data);
                setRoles(rolesRes.data);
            } catch {
                setError("Failed to load teacher data");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const fetchStudents = async (classId) => {
        setSelectedClassId(classId);
        setStudents([]);
        try {
            const res = await api.get(`/teacher/classes/${classId}/students`);
            setStudents(res.data);
        } catch {
            setStudents([]);
        }
    };

    if (loading) return <p>Loading teacher dashboard...</p>;
    if (error) return <p className="text-red-600">{error}</p>;

    return (
        <div >
            {/* Mini Nav */}
            <TeacherMiniNav roles={roles} />
            <div className="ml-4" >


                <h1 className="text-2xl font-bold mt-4 mb-2">My Classes</h1>

                {classes.length === 0 ? (
                    <p>You are not assigned to any classes.</p>
                ) : (
                    <ul className="list-disc pl-6">
                        {classes.map(c => (
                            <li
                                key={c.classid}
                                className={`py-1 cursor-pointer ${selectedClassId === c.classid ? "font-bold text-blue-700" : ""}`}
                                onClick={() => fetchStudents(c.classid)}
                            >
                                {c.classname} – <span className="italic">{c.role}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Students List */}
                {selectedClassId && (
                    <div className="mt-4 ">
                        <h2 className="text-xl font-semibold">Students</h2>
                        {students.length === 0 ? (
                            <p>No students found for this class.</p>
                        ) : (
                            <ul className="mt-2">
                                {students.map(s => (
                                    <li key={s.childid}>
                                        <Link
                                            to={`/teacher/student/${s.childid}`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {s.fname} {s.lname}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

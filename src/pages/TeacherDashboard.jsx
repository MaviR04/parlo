import { useEffect, useState } from "react";
import api from "../axios";
import TeacherMiniNav from "../components/TeacherMiniNav";
import { Link } from "react-router-dom";

export default function TeacherDashboard() {
    const [classes, setClasses] = useState([]);
    const [roles, setRoles] = useState({
        isClassTeacher: false,
        isSubjectTeacher: false,
        classname: null,
    });
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [classesRes, rolesRes] = await Promise.all([
                    api.get("/teacher/classes"),
                    api.get("/users/me/roles", { withCredentials: true }),
                ]);
                setClasses(classesRes.data);
                setRoles(rolesRes.data); // <-- includes teachesGrades
            } catch (e) {
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

    if (loading)
        return (
            <p className="text-center text-gray-500 mt-10">
                Loading teacher dashboard...
            </p>
        );
    if (error)
        return (
            <p className="text-center text-red-600 mt-10">
                {error}
            </p>
        );

    return (
        <div>
            {/* Mini Nav */}
            <TeacherMiniNav roles={roles} classid={selectedClassId} />


            <div className="min-h-screen bg-gray-50 px-4 py-6">
                <div className="ml-4">
                    <h1 className="text-3xl font-semibold text-gray-800 mb-6">My Classes</h1>

                    {classes.length === 0 ? (
                        <p className="text-gray-600">You are not assigned to any classes.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {classes.map((c) => (
                                <div
                                    key={c.classid}
                                    onClick={() => fetchStudents(c.classid)}
                                    className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 shadow-sm ${selectedClassId === c.classid
                                        ? "bg-blue-100 border-blue-400"
                                        : "bg-white hover:bg-gray-50 hover:shadow-md hover:border-blue-200"
                                        }`}
                                >
                                    <h2 className="text-lg font-medium text-gray-800">{c.classname}</h2>
                                    <p className="text-sm text-gray-500 italic">{c.role}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedClassId && (
                        <div className="mt-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Students</h2>
                            {students.length === 0 ? (
                                <p className="text-gray-600">No students found for this class.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {students.map((s) => (
                                        <Link
                                            key={s.childid}
                                            to={`/teacher/student/${s.childid}`}
                                            className="block p-3 bg-white rounded-xl border shadow-sm hover:shadow-md hover:bg-gray-50 transition hover:border-blue-300"
                                        >
                                            <p className="text-gray-800 font-medium">
                                                {s.fname} {s.lname}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

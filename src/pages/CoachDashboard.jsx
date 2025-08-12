import { useEffect, useState } from "react";
import api from "../axios";
import CoachMiniNav from "../components/CoachMiniNav";
import { Link } from "react-router-dom";

export default function CoachDashboard({ user }) {
    const [activities, setActivities] = useState([]);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await api.get("/coach/activities");
                console.log("✅ Activities fetched:", res.data);
                setActivities(res.data);
            } catch {
                setError("Failed to load coach data.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const fetchStudents = async (activityid) => {
        setSelectedActivityId(activityid);
        setStudents([]);
        try {
            const res = await api.get(`/coach/activities/${activityid}/students`);
            console.log("📘 Students fetched for activity:", activityid, res.data);
            setStudents(res.data);
        } catch {
            setStudents([]);
        }
    };

    if (loading) return <p className="text-center text-gray-500 mt-10">Loading coach dashboard...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">{error}</p>;

    return (
        <div>
            <CoachMiniNav />

            <div className="min-h-screen bg-gray-50 px-4 py-6">
                <div className="ml-4">
                    <h1 className="text-3xl font-semibold text-gray-800 mb-6">My Activities</h1>

                    {activities.length === 0 ? (
                        <p className="text-gray-600">You are not assigned to any activities.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {activities.map((a) => (
                                <div
                                    key={a.activityid} // ✅ FIXED key
                                    onClick={() => fetchStudents(a.activityid)}
                                    className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 shadow-sm ${selectedActivityId === a.activityid
                                            ? "bg-green-100 border-green-400"
                                            : "bg-white hover:bg-gray-50 hover:shadow-md hover:border-green-200"
                                        }`}
                                >
                                    <h2 className="text-lg font-medium text-gray-800">
                                        {a.name} ({a.agegroup})
                                    </h2>
                                    <p className="text-sm text-gray-500 italic">{a.category}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedActivityId && (
                        <div className="mt-8">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Enrolled Students</h2>
                            {students.length === 0 ? (
                                <p className="text-gray-600">No students found for this activity.</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {students.map((s) => (
                                        <Link
                                            key={s.childid}
                                            to={`/coach/student/${s.childid}`}
                                            className="block p-3 bg-white rounded-xl border shadow-sm hover:shadow-md hover:bg-gray-50 transition hover:border-green-300"
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

import { useEffect, useState } from "react";
import api from "../axios";
import { Link } from "react-router-dom";

export default function ParentDashboard({ user }) {
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchChildren() {
            try {
                const res = await api.get("/parent/my-children", { withCredentials: true });
                setChildren(res.data);
            } catch (err) {
                console.error("❌ Failed to load children", err);
                setError("Failed to load your children list.");
            } finally {
                setLoading(false);
            }
        }
        fetchChildren();
    }, []);

    if (loading) return <p className="text-center mt-10">Loading your children...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">{error}</p>;

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-6">
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">My Children</h1>

            {children.length === 0 ? (
                <p className="text-gray-600">No children found linked to your account.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {children.map((child) => (
                        <Link
                            key={child.childid}
                            to={`/parent/student/${child.childid}`}
                            className="p-4 rounded-xl border shadow-sm bg-white hover:bg-gray-50 hover:shadow-md hover:border-blue-300 transition"
                        >
                            <h2 className="text-lg font-medium text-gray-800">
                                {child.fname} {child.lname}
                            </h2>
                            <p className="text-sm text-gray-500">{child.classname}</p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from "react";
import api from "../axios";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

export default function AttendanceTab({ classId, studentId }) {
    const [attendance, setAttendance] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAttendance() {
            try {
                const res = await api.get(`/teacher/classes/${classId}/students/${studentId}/attendance`);
                setAttendance(res.data);
            } catch (err) {
                console.error("Error fetching attendance", err);
            } finally {
                setLoading(false);
            }
        }
        fetchAttendance();
    }, [classId, studentId]);

    if (loading) return <p>Loading attendance...</p>;
    if (!attendance) return <p>No attendance data available.</p>;

    const percentage = Math.round((attendance.presentDays / attendance.totalDays) * 100);

    return (
        <div className="w-40 mx-auto mt-6">
            <CircularProgressbar
                value={percentage}
                text={`${percentage}%`}
                styles={buildStyles({
                    textColor: "#2563eb",
                    pathColor: percentage >= 75 ? "#16a34a" : "#dc2626",
                    trailColor: "#d1d5db"
                })}
            />
            <p className="text-center mt-2 text-gray-700">
                {attendance.presentDays} / {attendance.totalDays} days present
            </p>
        </div>
    );
}

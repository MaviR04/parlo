import { useEffect, useState } from "react";
import api from "../axios";

export default function AttendancePage() {
    const [classData, setClassData] = useState(null);
    const [students, setStudents] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [attendance, setAttendance] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // New state for breaks/holidays dates
    const [breaks, setBreaks] = useState([]);
    const [isBreakDay, setIsBreakDay] = useState(false);

    useEffect(() => {
        api
            .get("/teacher/classes/class-teacher-only")
            .then((res) => {
                if (res.data.length === 1) {
                    setClassData(res.data[0]);
                } else if (res.data.length > 1) {
                    setClassData(res.data[0]);
                } else {
                    setError("You are not assigned as class teacher to any class");
                }
            })
            .catch(() => setError("Failed to load class data"));
    }, []);

    // Fetch school breaks and holidays 
    useEffect(() => {
        api
            .get("/school-breaks")
            .then((res) => setBreaks(res.data))
            .catch(() => setBreaks([]));
    }, []);

    useEffect(() => {
        if (!classData) return;

        setLoading(true);
        api
            .get(`/teacher/classes/${classData.classid}/students`)
            .then((res) => {
                setStudents(res.data);
                const defaultAttendance = {};
                res.data.forEach((s) => (defaultAttendance[s.childid] = "present"));
                setAttendance(defaultAttendance);
            })
            .catch(() => setError("Failed to load students"))
            .finally(() => setLoading(false));
    }, [classData]);

    // Check if selected date falls within any break/holiday period

    useEffect(() => {
        const breakDay = breaks.some(
            (b) => attendanceDate >= b.start_date && attendanceDate <= b.end_date
        );
        setIsBreakDay(breakDay);
        if (!breakDay) setError(null); // clear error if date is not break day
    }, [attendanceDate, breaks]);


    function handleAttendanceChange(childId, status) {
        setAttendance((prev) => ({ ...prev, [childId]: status }));
    }

    async function saveAttendance() {
        if (!classData) return;

        if (isBreakDay) {
            setError(
                "Cannot save attendance on a school break or holiday. Please select a different date."
            );
            showToast("Attendance cannot be saved on a school break or holiday.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const promises = Object.entries(attendance).map(([childId, status]) =>
                api.post(`/teacher/classes/${classData.classid}/attendance`, {
                    childId: parseInt(childId),
                    date: attendanceDate,
                    status,
                })
            );
            await Promise.all(promises);
            showToast("Attendance saved successfully!");
        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError("Failed to save attendance due to a network or server error.");
            }
        } finally {
            setSaving(false);
        }
    }

    function showToast(message) {
        setToast(message);
        setTimeout(() => {
            setToast(null);
        }, 4000);
    }

    if (error && !classData)
        return (
            <p className="text-red-600 text-sm font-medium p-4 max-w-4xl mx-auto">
                {error}
            </p>
        );
    if (loading) return <p className="p-4 max-w-4xl mx-auto">Loading...</p>;

    return (
        <div className="p-6 max-w-5xl mx-auto bg-white rounded-md shadow-sm mt-16">
            <h1 className="text-3xl font-semibold mb-8 text-gray-900">
                Attendance for {classData?.classname}
            </h1>

            {/* Error message on top if any */}
            {error && (
                <p className="text-red-600 text-sm mb-4 font-medium">{error}</p>
            )}

            <label className="block mb-6 text-gray-800 font-semibold text-lg">
                Date:
                <input
                    type="date"
                    value={attendanceDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="ml-4 border border-gray-300 rounded-md px-4 py-2 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
                    aria-describedby="breakNotice"
                />
            </label>

            {/* Show warning if date is break/holiday */}
            {isBreakDay && (
                <p
                    id="breakNotice"
                    className="text-yellow-700 font-semibold mb-4"
                    role="alert"
                >
                    The selected date falls within a school break or holiday. Attendance
                    cannot be recorded.
                </p>
            )}

            {students.length === 0 ? (
                <p className="text-gray-600">No students found for this class.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-200">
                        <thead>
                            <tr className="bg-gray-50 text-gray-700 font-semibold text-left">
                                <th className="border border-gray-200 px-6 py-3">Student Name</th>
                                <th className="border border-gray-200 px-6 py-3">
                                    Attendance Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s) => (
                                <tr
                                    key={s.childid}
                                    className="odd:bg-white even:bg-gray-50 text-gray-900"
                                >
                                    <td className="border border-gray-200 px-6 py-4">
                                        {s.fname} {s.lname}
                                    </td>
                                    <td className="border border-gray-200 px-6 py-4">
                                        <select
                                            value={attendance[s.childid]}
                                            onChange={(e) =>
                                                handleAttendanceChange(s.childid, e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            aria-label={`Set attendance status for ${s.fname} ${s.lname}`}
                                            disabled={isBreakDay} // disable dropdown if break day
                                        >
                                            <option value="present">Present</option>
                                            <option value="absent">Absent</option>
                                            <option value="late">Late</option>
                                            <option value="half-day">Half Day</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <button
                onClick={saveAttendance}
                disabled={saving || isBreakDay}
                className="mt-8 bg-blue-300 hover:bg-blue-400 text-white font-semibold px-8 py-3 rounded-md disabled:opacity-50 transition-colors duration-200"
                aria-disabled={saving || isBreakDay}
            >
                {saving ? "Saving..." : "Save Attendance"}
            </button>

            {/* Toast */}
            {toast && (
                <div
                    role="alert"
                    aria-live="assertive"
                    className="fixed top-15 left-1/2 transform -translate-x-1/2 bg-blue-300 text-white font-semibold px-6 py-3 rounded-md shadow-lg animate-fadeInOut"
                    style={{ animationDuration: "4s", zIndex: 9999 }}
                >
                    {toast}
                </div>
            )}

            <style>
                {`
    @keyframes fadeInOut {
      0%, 100% {
        opacity: 0;
        transform: translateY(5px);
      }
      10%, 90% {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fadeInOut {
      animation-name: fadeInOut;
      animation-timing-function: ease-in-out;
    }
  `}
            </style>
        </div>
    );
}

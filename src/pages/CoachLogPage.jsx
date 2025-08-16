import { useEffect, useState } from "react";
import api from "../axios";
import dayjs from "dayjs";

const colorMap = {
    blue: "bg-blue-200 border-blue-600",
    green: "bg-green-200 border-green-600",
    gold: "bg-yellow-200 border-yellow-600",
    red: "bg-red-200 border-red-600",
    orange: "bg-orange-200 border-orange-600",
    purple: "bg-purple-200 border-purple-600",
    pink: "bg-pink-200 border-pink-600",
    teal: "bg-teal-200 border-teal-600",
    indigo: "bg-indigo-200 border-indigo-600",
    gray: "bg-gray-200 border-gray-600",
    brown: "bg-neutral-300 border-neutral-600",
};

export default function CoachLogPage() {

    // helper to get Monday
    function getMondayStr(d) {
        const dt = new Date(d);
        const day = dt.getDay();        // 0 Sun .. 6 Sat
        const diff = (day === 0 ? -6 : 1) - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + diff);
        return mon.toISOString().slice(0, 10);
    }
    const [weekStart, setWeekStart] = useState(getMondayStr(new Date()));
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [students, setStudents] = useState([]);
    const [logs, setLogs] = useState({});
    const [availableTags, setAvailableTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [toast, setToast] = useState("");



    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const [saving, setSaving] = useState(false);

    const studentsPerPage = 10;

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    useEffect(() => {
        async function fetchData() {
            try {
                const [activityRes, tagRes] = await Promise.all([
                    api.get("/coach/activities"),
                    api.get("/coach/activity-tags"),
                ]);
                setActivities(activityRes.data);
                setAvailableTags(tagRes.data);
            } catch {
                showToast("Failed to load data");
            }
        }
        fetchData();
    }, []);

    useEffect(() => {
        if (!selectedActivity) return;
        async function fetchStudents() {
            try {
                const res = await api.get(`/coach/activities/${selectedActivity.activityid}/students`);
                setStudents(res.data);
                setLogs({});
            } catch {
                showToast("Failed to fetch students");
            }
        }
        fetchStudents();
    }, [selectedActivity]);

    const handleChange = (childID, field, value) => {
        if (field === "rating" && value && (Number(value) < 1 || Number(value) > 10)) return;
        setLogs((prev) => ({
            ...prev,
            [childID]: {
                ...prev[childID],
                [field]: value,
            },
        }));
    };

    const toggleTag = (childID, tagID) => {
        const tags = logs[childID]?.tags || [];
        const isSelected = tags.includes(tagID);

        if (!isSelected && tags.length >= 3) {
            showToast("Max 3 badges allowed");
            return;
        }

        const updatedTags = isSelected
            ? tags.filter((t) => t !== tagID)
            : [...tags, tagID];

        setLogs((prev) => ({
            ...prev,
            [childID]: {
                ...prev[childID],
                tags: updatedTags,
            },
        }));
    };

    const saveAllLogs = async () => {
        if (!selectedActivity || !weekStart) return showToast("Please select activity and week.");
        setSaving(true);

        try {
            // ✅ Step 1: Get term ID and schoolYear
            const termRes = await api.get("/coach/term-id", {
                params: { week_start: weekStart },
            });
            const { termid, schoolYear } = termRes.data;

            // ✅ Step 2: Save logs for each student
            for (let s of students) {
                const entry = logs[s.childid];
                if (!entry) continue;

                await api.post("/coach/activity-log", {
                    activityID: selectedActivity.activityid,
                    childID: s.childid,
                    week_start: weekStart,
                    termid,
                    schoolYear,
                    rating: entry.rating || null,
                    comment: entry.comment || "",
                    type: entry.type || "Session",
                    tagIDs: entry.tags || [],
                });
            }

            showToast("All logs saved successfully");
        } catch (err) {
            console.error("Save failed:", err);
            if (err.response?.data?.error === "Term not found") {
                showToast("No term found for this week");
            } else {
                showToast("Failed to save some logs");
            }
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = students.filter((s) =>
        `${s.fname} ${s.lname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const currentStudents = showAll
        ? filteredStudents
        : filteredStudents.slice((currentPage - 1) * studentsPerPage, currentPage * studentsPerPage);

    return (
        <div className="p-6 max-w-6xl mx-auto mt-10 bg-white rounded shadow text-gray-800">
            {toast && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded shadow z-50">
                    {toast}
                </div>
            )}

            <h2 className="text-2xl font-bold mb-4">🏷️ Log Weekly Performance</h2>

            <div className="mb-4">
                <label className="block font-semibold mb-1">📅 Week Starting</label>
                <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="border px-3 py-2 rounded"
                />
            </div>

            <label className="block font-semibold mb-2">Select Activity</label>
            <select
                className="w-full border px-4 py-2 mb-4 rounded"
                onChange={(e) => {
                    const id = parseInt(e.target.value);
                    const found = activities.find((a) => a.activityid === id);
                    setSelectedActivity(found || null);
                    setCurrentPage(1);
                }}
            >
                <option value="">-- Choose Activity --</option>
                {activities.map((a) => (
                    <option key={a.activityid} value={a.activityid}>
                        {a.name} ({a.agegroup})
                    </option>
                ))}
            </select>

            {selectedActivity && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                            Students in {selectedActivity.name} - {selectedActivity.agegroup}
                        </h3>
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="border px-3 py-1 rounded"
                        />
                    </div>

                    <div className="overflow-x-auto mb-4">
                        <table className="w-full border text-sm rounded overflow-hidden">
                            <thead className="bg-gray-100 text-left">
                                <tr>
                                    <th className="px-3 py-2 border">Student</th>
                                    <th className="px-3 py-2 border">Rating</th>
                                    <th className="px-3 py-2 border">Comment</th>
                                    <th className="px-3 py-2 border">Type</th>
                                    <th className="px-3 py-2 border">Badges</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentStudents.map((s) => {
                                    const entry = logs[s.childid] || {};
                                    const filled = entry.rating || entry.comment;
                                    return (
                                        <tr key={s.childid} className={filled ? "bg-green-50" : "bg-red-50"}>
                                            <td className="px-3 py-2 border">{s.fname} {s.lname}</td>
                                            <td className="px-3 py-2 border">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    className="w-20 border px-2 py-1 rounded"
                                                    value={entry.rating || ""}
                                                    onChange={(e) => handleChange(s.childid, "rating", e.target.value)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 border">
                                                <input
                                                    type="text"
                                                    className="w-full border px-2 py-1 rounded"
                                                    value={entry.comment || ""}
                                                    onChange={(e) => handleChange(s.childid, "comment", e.target.value)}
                                                />
                                            </td>
                                            <td className="px-3 py-2 border">
                                                <select
                                                    className="w-full border px-2 py-1 rounded"
                                                    value={entry.type || "Session"}
                                                    onChange={(e) => handleChange(s.childid, "type", e.target.value)}
                                                >
                                                    <option>Session</option>
                                                    <option>Match</option>
                                                    <option>Event</option>
                                                    <option>Milestone</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 border">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => handleChange(s.childid, "showModal", true)}
                                                        className="px-2 py-1 text-sm border rounded bg-gray-100 hover:bg-gray-200"
                                                    >
                                                        Add Badge
                                                    </button>

                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {(entry.tags || []).map((tid) => {
                                                            const tag = availableTags.find(t => t.tagid === tid);
                                                            if (!tag) return null;
                                                            const colorClass = colorMap[tag.color] || "bg-gray-200 border-gray-400";
                                                            return (
                                                                <span key={tid} className={`text-xs px-3 py-1 rounded-full border ${colorClass} shadow-sm`}>
                                                                    {tag.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>

                                                    {entry.showModal && (
                                                        <div
                                                            className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center"
                                                            onClick={() => handleChange(s.childid, "showModal", false)}
                                                        >
                                                            <div
                                                                className="bg-white p-5 rounded-xl shadow-lg max-h-[80vh] w-full max-w-md overflow-y-auto"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <div className="flex justify-between items-center mb-4">
                                                                    <h3 className="text-xl font-bold text-gray-800">Select Badges</h3>
                                                                    <button
                                                                        onClick={() => handleChange(s.childid, "showModal", false)}
                                                                        className="text-gray-500 hover:text-gray-800 text-2xl"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>

                                                                <p className="text-sm text-gray-600 mb-2">
                                                                    {entry.tags?.length || 0}/3 selected
                                                                </p>

                                                                <div className="flex flex-wrap gap-2">
                                                                    {availableTags.map((tag) => {
                                                                        const isSelected = entry.tags?.includes(tag.tagid);
                                                                        const colorClass = colorMap[tag.color] || "bg-gray-200 border-gray-400";
                                                                        return (
                                                                            <button
                                                                                key={tag.tagid}
                                                                                onClick={() => toggleTag(s.childid, tag.tagid)}
                                                                                className={`px-3 py-1 rounded-full text-xs border transition-all duration-200 
                                          ${colorClass} 
                                          ${isSelected ? "font-semibold shadow-sm ring-2 ring-offset-1 ring-blue-400" : "opacity-80 hover:opacity-100"}`}
                                                                            >
                                                                                {isSelected ? "✅ " : ""}{tag.name}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {!showAll && totalPages > 1 && (
                        <div className="flex justify-center gap-2 mb-4">
                            {Array.from({ length: totalPages }, (_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`px-3 py-1 rounded ${currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-300"}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mb-4">
                        <label>
                            <input type="checkbox" checked={showAll} onChange={() => setShowAll(!showAll)} /> Show all students
                        </label>
                    </div>

                    <div className="text-center mt-6">
                        <button
                            onClick={saveAllLogs}
                            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded ${saving && "opacity-50"}`}
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save All Logs"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

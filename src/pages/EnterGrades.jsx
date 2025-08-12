import { useEffect, useState, useRef, useMemo } from "react";
import api from "../axios";

function getMonthLabel() {
    const now = new Date();
    return now.toLocaleString("default", { month: "short" });
}

export default function EnterGrades() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState({});
    const [loading, setLoading] = useState(false);

    const [autoSubject, setAutoSubject] = useState("");
    const [globalAssessmentName, setGlobalAssessmentName] = useState("");
    const [globalMaxScore, setGlobalMaxScore] = useState("100");
    const [manualLabelOverride, setManualLabelOverride] = useState("");

    const [toastMsg, setToastMsg] = useState("");
    const [saveStatus, setSaveStatus] = useState("All changes saved");

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const studentsPerPage = 10;

    const [pastAssessments, setPastAssessments] = useState([]);
    const [selectedPast, setSelectedPast] = useState("");

    const autoSaveInterval = useRef(null);

    const generateLabel = () => {
        if (!globalAssessmentName) return "";
        return manualLabelOverride || `${globalAssessmentName} - ${getMonthLabel()}`;
    };

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    useEffect(() => {
        async function init() {
            try {
                const [termRes, classRes] = await Promise.all([
                    api.get("/terms/current"),
                    api.get("/grades/classes-with-roles"),
                ]);
                setSelectedTerm(termRes.data);
                setClasses(classRes.data);
                if (classRes.data.length > 0) {
                    setSelectedClass(classRes.data[0].classid);
                    setAutoSubject(getSubjectFromRole(classRes.data[0].role));
                }
            } catch {
                showToast("Failed to load term or classes");
            }
        }
        init();
    }, []);

    useEffect(() => {
        const found = classes.find((c) => c.classid === selectedClass);
        setAutoSubject(getSubjectFromRole(found?.role));
    }, [selectedClass, classes]);

    useEffect(() => {
        if (!selectedClass || !selectedTerm) return;
        async function fetchData() {
            setLoading(true);
            try {
                const [stuRes, pastRes] = await Promise.all([
                    api.get(`/teacher/classes/${selectedClass}/students`),
                    api.get(`/grades/past-assessments`, {
                        params: { classid: selectedClass, subject: autoSubject },
                    }),
                ]);
                setStudents(stuRes.data);
                setGrades({});
                setPastAssessments(pastRes.data);
            } catch {
                showToast("Failed to load students or past assessments");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [selectedClass, selectedTerm, autoSubject]);

    // Reset chosen past assessment whenever scope changes
    useEffect(() => {
        setSelectedPast("");
    }, [selectedClass, selectedTerm, autoSubject]);

    // Auto-save every 30s if there are pending edits
    useEffect(() => {
        autoSaveInterval.current = setInterval(() => {
            if (saveStatus === "Unsaved changes") saveGrades();
        }, 30000);
        return () => clearInterval(autoSaveInterval.current);
    }, [saveStatus, grades]);

    const getSubjectFromRole = (role) => {
        if (!role) return "";
        if (role.toLowerCase().includes("teacher")) {
            return role.replace(/teacher/i, "").trim();
        }
        return role;
    };

    const handleGradeChange = (childid, field, value) => {
        if (field === "score" || field === "max_score") {
            if (value !== "" && Number(value) < 0) return;
        }
        setSaveStatus("Unsaved changes");
        setGrades((prev) => ({
            ...prev,
            [childid]: {
                ...prev[childid],
                [field]: value,
            },
        }));
    };

    const saveGrades = async () => {
        if (!globalAssessmentName.trim()) {
            return showToast("Assessment name is required.");
        }

        const hasMissingScores = students.some((s) => {
            const g = grades[s.childid];
            return !g || g.score === "" || g.score === undefined;
        });

        if (hasMissingScores) {
            return showToast("Please enter score for all students.");
        }

        const payload = students.map((s) => {
            const g = grades[s.childid];
            return {
                childid: s.childid,
                classid: selectedClass,
                subject: autoSubject,
                termid: selectedTerm.termid,
                assessment_name: g.assessment_name || globalAssessmentName,
                assessment_label: generateLabel(),
                score: Number(g.score),
                max_score: Number(g.max_score || globalMaxScore),
                comment: g.comment || null,
            };
        });

        try {
            await api.post("/grades/batch", { grades: payload });
            setSaveStatus("All changes saved");
            showToast("Grades saved successfully");
        } catch {
            showToast("Failed to save grades");
        }
    };

    // Filter only current term's assessments for the dropdown
    const currentTermPast = useMemo(
        () => pastAssessments.filter((a) => a.termid === selectedTerm?.termid),
        [pastAssessments, selectedTerm]
    );

    // Load existing rows for a selected past assessment (current term only)
    const loadPastAssessment = async (assessmentName) => {
        if (!assessmentName || !selectedClass || !selectedTerm || !autoSubject) return;

        try {
            setLoading(true);
            const { data } = await api.get("/grades/by-assessment", {
                params: {
                    classid: selectedClass,
                    subject: autoSubject,
                    termid: selectedTerm.termid,
                    assessment_name: assessmentName,
                },
            });

            const map = {};
            data.forEach((row) => {
                map[row.childid] = {
                    assessment_name: row.assessment_name,
                    score: row.score ?? "",
                    max_score: row.max_score ?? globalMaxScore,
                    comment: row.comment ?? "",
                };
            });

            // Ensure all students are present (missing ones left blank)
            students.forEach((s) => {
                if (!map[s.childid]) {
                    map[s.childid] = {
                        assessment_name: assessmentName,
                        score: "",
                        max_score: globalMaxScore,
                        comment: "",
                    };
                }
            });

            const first = data[0];
            if (first) {
                setGlobalAssessmentName(first.assessment_name || assessmentName);
                if (first.max_score) setGlobalMaxScore(String(first.max_score));
            } else {
                setGlobalAssessmentName(assessmentName);
            }

            setGrades(map);
            setSelectedPast(assessmentName);
            setSaveStatus("All changes saved");
            showToast(`Loaded "${assessmentName}" from current term`);
        } catch {
            showToast("Failed to load past assessment");
        } finally {
            setLoading(false);
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
        <div className="p-6 max-w-5xl mx-auto mt-10 text-gray-800 bg-white shadow rounded">
            {toastMsg && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded shadow z-50">
                    {toastMsg}
                </div>
            )}

            <h2 className="text-2xl font-bold mb-4">📝 Enter Grades</h2>

            <div className="mb-4 text-gray-800 font-medium">
                Status:{" "}
                <span className={saveStatus === "All changes saved" ? "text-green-700" : "text-red-600"}>
                    {saveStatus}
                </span>
            </div>

            <label className="block mb-2 font-semibold">Class</label>
            <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full mb-4 border px-4 py-2 rounded"
            >
                {classes.map((c) => (
                    <option key={c.classid} value={c.classid}>
                        {c.classname} ({c.role})
                    </option>
                ))}
            </select>

            {selectedTerm && (
                <div className="mb-4 text-gray-800">
                    📚 School Year: {selectedTerm.schoolYear} | Term: {selectedTerm.name}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Assessment name *"
                    value={globalAssessmentName}
                    onChange={(e) => {
                        setGlobalAssessmentName(e.target.value);
                        setSaveStatus("Unsaved changes");
                    }}
                    className="border px-4 py-2 rounded"
                />
                <input
                    type="text"
                    placeholder="Optional custom label"
                    value={manualLabelOverride}
                    onChange={(e) => setManualLabelOverride(e.target.value)}
                    className="border px-4 py-2 rounded"
                />
                <input
                    type="number"
                    placeholder="Max Score"
                    value={globalMaxScore}
                    onChange={(e) => setGlobalMaxScore(e.target.value)}
                    className="border px-4 py-2 rounded"
                />
                <input
                    type="text"
                    placeholder="Search student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border px-4 py-2 rounded"
                />
            </div>

            <div className="mb-2 font-medium text-gray-700">
                Auto-generated label: <span className="text-blue-600">{generateLabel()}</span>
            </div>

            {/* Past assessment (current term only) */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 font-semibold">Load past assessment (current term)</label>
                    <div className="flex gap-2">
                        <select
                            value={selectedPast}
                            onChange={(e) => loadPastAssessment(e.target.value)}
                            className="flex-1 border px-4 py-2 rounded"
                            disabled={!currentTermPast.length}
                        >
                            <option value="">
                                {currentTermPast.length ? "Select..." : "No past assessments in current term"}
                            </option>
                            {currentTermPast.map((a) => (
                                <option key={`${a.assessment_name}-${a.termid}`} value={a.assessment_name}>
                                    {a.assessment_name}
                                </option>
                            ))}
                        </select>
                        {selectedPast && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPast("");
                                    setGrades({});
                                    setGlobalAssessmentName("");
                                    setGlobalMaxScore("100");
                                    setSaveStatus("All changes saved");
                                    showToast("Cleared loaded assessment");
                                }}
                                className="bg-gray-300 hover:bg-gray-400 px-3 py-2 rounded text-sm"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Only shows assessments from the current term.</p>
                </div>
            </div>

            <div className="overflow-x-auto mb-4">
                <table className="w-full border border-gray-300 rounded">
                    <thead className="bg-gray-200 text-left">
                        <tr>
                            <th className="px-3 py-2 border">Student</th>
                            <th className="px-3 py-2 border">Score</th>
                            <th className="px-3 py-2 border">Max</th>
                            <th className="px-3 py-2 border">Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentStudents.map((s) => {
                            const g = grades[s.childid] || {};
                            const filled = g.score !== undefined && g.score !== "";
                            return (
                                <tr key={s.childid} className={filled ? "bg-green-50" : "bg-red-50"}>
                                    <td className="px-3 py-2 border">{s.fname} {s.lname}</td>
                                    <td className="px-3 py-2 border">
                                        <input
                                            type="number"
                                            value={g.score || ""}
                                            onChange={(e) => handleGradeChange(s.childid, "score", e.target.value)}
                                            className="w-full border px-2 py-1 rounded"
                                        />
                                    </td>
                                    <td className="px-3 py-2 border">
                                        <input
                                            type="number"
                                            value={g.max_score || globalMaxScore || ""}
                                            onChange={(e) => handleGradeChange(s.childid, "max_score", e.target.value)}
                                            className="w-full border px-2 py-1 rounded"
                                        />
                                    </td>
                                    <td className="px-3 py-2 border">
                                        <input
                                            type="text"
                                            value={g.comment || ""}
                                            onChange={(e) => handleGradeChange(s.childid, "comment", e.target.value)}
                                            className="w-full border px-2 py-1 rounded"
                                        />
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

            <div className="text-center">
                <button
                    onClick={saveGrades}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded"
                >
                    {loading ? "Loading..." : "Save Grades Now"}
                </button>
            </div>
        </div>
    );
}

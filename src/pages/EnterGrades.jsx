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
    const lowPromptShownRef = useRef(new Set()); // one-time toast per student

    // Modal state
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    // ===== Conversation starters (parent-friendly, concise) =====
    const lowScorePrompts = [
        "Your child scored below expectations in this assessment, but with consistent support, I’m confident they can improve.",
        "This result shows there’s room for growth, and I will focus on helping your child strengthen these skills.",
        "While this score is lower than we aimed for, I’ve seen your child’s potential and will guide them toward better results next time.",
        "We will work together on the key areas to help your child gain confidence and improve performance."
    ];

    // ===== UI helpers =====
    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    const generateLabel = () => {
        if (!globalAssessmentName) return "";
        return manualLabelOverride || `${globalAssessmentName} - ${getMonthLabel()}`;
    };

    const getSubjectFromRole = (role) => {
        if (!role) return "";
        if (role.toLowerCase().includes("teacher")) {
            return role.replace(/teacher/i, "").trim();
        }
        return role;
    };

    // ===== Numeric helpers / low-score logic (≤ 50%) =====
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const getPercent = (g) => {
        const s = toNum(g?.score);
        const m = toNum(g?.max_score ?? globalMaxScore);
        if (s === null || m === null || m <= 0) return null;
        return (s / m) * 100;
    };

    const isLowScore = (g) => {
        const p = getPercent(g);
        return p !== null && p <= 50; // inclusive at 50%
    };

    const rowClassFor = (filled, low) => {
        const base = filled ? "bg-green-50" : "bg-red-50";
        return low ? `${base} ring-1 ring-rose-300 border-l-4 border-l-rose-500` : base;
    };

    // ===== Effects =====
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

    // ESC to close modal
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") setShowPromptModal(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // ===== Handlers =====

    // Store raw text while typing (no clamping here).
    const handleGradeChange = (childid, field, rawValue) => {
        setSaveStatus("Unsaved changes");

        setGrades((prev) => {
            const current = prev[childid] || {};
            const next = {
                ...prev,
                [childid]: {
                    ...current,
                    [field]: rawValue, // store as-is (string) to avoid jumps
                },
            };

            // Show a gentle toast once if they dip ≤ 50 while typing (no modal)
            if (field === "score") {
                const sNum = toNum(rawValue);
                const mNum = toNum(current.max_score ?? globalMaxScore);
                if (sNum !== null && mNum !== null && mNum > 0) {
                    const pct = (sNum / mNum) * 100;
                    if (pct <= 50 && !lowPromptShownRef.current.has(childid)) {
                        lowPromptShownRef.current.add(childid);
                        showToast("Tip: Add a kind, specific note so parents know the plan 💙");
                    }
                }
            }

            return next;
        });
    };

    // Clamp on blur: Score -> [0, max]
    const handleScoreBlur = (childid) => {
        setGrades((prev) => {
            const current = prev[childid] || {};
            const s = toNum(current.score);
            const m = toNum(current.max_score ?? globalMaxScore);
            if (s === null || m === null || m <= 0) return prev;

            const clamped = Math.max(0, Math.min(s, m));
            if (clamped !== s) {
                showToast("Score adjusted to be within 0–Max.");
            }
            return {
                ...prev,
                [childid]: { ...current, score: String(clamped) },
            };
        });
    };

    // Clamp on blur: Max -> ≥1, and cap score if needed
    const handleMaxBlur = (childid) => {
        setGrades((prev) => {
            const current = prev[childid] || {};
            let m = toNum(current.max_score ?? globalMaxScore);
            if (m === null) return prev;
            m = Math.max(1, m);

            const s = toNum(current.score);
            let nextScore = current.score;
            if (s !== null && s > m) {
                nextScore = String(m);
                showToast("Score capped to the updated Max.");
            }

            return {
                ...prev,
                [childid]: { ...current, max_score: String(m), score: nextScore },
            };
        });
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

        // Final clean (clamp and normalize) before sending
        const payload = students.map((s) => {
            const g = grades[s.childid] || {};
            const maxClean = Math.max(1, Number(g.max_score ?? globalMaxScore) || 1);
            const rawScore = Number(g.score);
            const scoreClean = Number.isFinite(rawScore)
                ? Math.max(0, Math.min(rawScore, maxClean))
                : 0;

            return {
                childid: s.childid,
                classid: selectedClass,
                subject: autoSubject,
                termid: selectedTerm.termid,
                assessment_name: g.assessment_name || globalAssessmentName,
                assessment_label: generateLabel(),
                score: scoreClean,
                max_score: maxClean,
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

    // ===== Past assessments (current term only) =====
    const currentTermPast = useMemo(
        () => pastAssessments.filter((a) => a.termid === selectedTerm?.termid),
        [pastAssessments, selectedTerm]
    );

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

            // Ensure all students are present
            students.forEach((st) => {
                if (!map[st.childid]) {
                    map[st.childid] = {
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

    // ===== Pagination =====
    const filteredStudents = students.filter((s) =>
        `${s.fname} ${s.lname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const currentStudents = showAll
        ? filteredStudents
        : filteredStudents.slice((currentPage - 1) * studentsPerPage, (currentPage) * studentsPerPage);

    // ===== Render =====
    return (
        <div className="p-6 max-w-5xl mx-auto mt-10 text-gray-800 bg-white shadow rounded">
            {toastMsg && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded shadow z-50">
                    {toastMsg}
                </div>
            )}

            {/* Modal: Conversation Help */}
            {showPromptModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setShowPromptModal(false)}
                >
                    <div className="absolute inset-0 bg-black/40" />
                    <div
                        className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <h2 className="text-xl font-bold text-gray-900">Conversation Help</h2>
                            <button
                                onClick={() => setShowPromptModal(false)}
                                className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                                aria-label="Close"
                            >
                                Close
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            Choose a kind, constructive way to communicate the low score. You can edit it after inserting.
                        </p>

                        <div className="space-y-3">
                            {lowScorePrompts.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setGrades((prev) => {
                                            const current = prev[selectedStudentId] || {};
                                            // Replace; change to `${existing} ${prompt}` if you prefer append
                                            const nextComment = prompt;
                                            return {
                                                ...prev,
                                                [selectedStudentId]: { ...current, comment: nextComment },
                                            };
                                        });
                                        setShowPromptModal(false);
                                    }}
                                    className="w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-blue-50 transition"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6 text-right">
                            <button
                                onClick={() => setShowPromptModal(false)}
                                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                            >
                                Done
                            </button>
                        </div>
                    </div>
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
                    min={1}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    step="1"
                    onWheel={(e) => e.currentTarget.blur()}
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
                            const low = isLowScore(g);

                            return (
                                <tr key={s.childid} className={rowClassFor(filled, low)}>
                                    <td className="px-3 py-2 border">{s.fname} {s.lname}</td>

                                    <td className="px-3 py-2 border">
                                        <input
                                            type="number"
                                            value={g.score ?? ""}
                                            onChange={(e) => handleGradeChange(s.childid, "score", e.target.value)}
                                            onBlur={() => handleScoreBlur(s.childid)}
                                            min={0}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            step="1"
                                            onWheel={(e) => e.currentTarget.blur()} // prevent wheel changing value
                                            className="w-full border px-2 py-1 rounded"
                                        />
                                    </td>

                                    <td className="px-3 py-2 border">
                                        <input
                                            type="number"
                                            value={globalMaxScore}
                                            disabled
                                            className="w-full border px-2 py-1 rounded bg-gray-100 cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-3 py-2 border align-top">
                                        <div className="flex items-start gap-2">
                                            <textarea
                                                rows={2}
                                                value={g.comment || ""}
                                                onChange={(e) => handleGradeChange(s.childid, "comment", e.target.value)}
                                                className={`w-full border px-2 py-1 rounded resize-y ${low ? "border-rose-300" : ""}`}
                                                placeholder={low ? "Add a kind, specific plan…" : ""}
                                            />
                                            {low && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStudentId(s.childid);
                                                        setShowPromptModal(true);
                                                    }}
                                                    className="shrink-0 text-xs px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
                                                    title="Open Conversation Help"
                                                >
                                                    💬 Conversation Help
                                                </button>
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
                    <input
                        type="checkbox"
                        checked={showAll}
                        onChange={() => setShowAll(!showAll)}
                    />{" "}
                    Show all students
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

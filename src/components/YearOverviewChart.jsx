import { useEffect, useMemo, useRef, useState } from "react";
import api from "../axios";
import { Line } from "react-chartjs-2";
import Select from "react-select";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// 🎨 Subject palette (extendable)
const palette = [
    "rgba(34, 197, 94, 0.9)",   // Green
    "rgba(234, 179, 8, 0.9)",   // Yellow
    "rgba(59, 130, 246, 0.9)",  // Blue
    "rgba(239, 68, 68, 0.9)",   // Red
    "rgba(168, 85, 247, 0.9)",  // Purple
    "rgba(20, 184, 166, 0.9)",  // Teal
    "rgba(245, 158, 11, 0.9)",  // Orange
    "rgba(99, 102, 241, 0.9)",  // Indigo
    "rgba(244, 63, 94, 0.9)",   // Rose
    "rgba(34, 211, 238, 0.9)",  // Cyan
];

// 🔴🟡🟢 Table row color logic
function colorCodeScore(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "rgba(34, 197, 94, 0.12)";
    if (percent >= 50) return "rgba(234, 179, 8, 0.12)";
    return "rgba(239, 68, 68, 0.12)";
}

export default function YearOverviewChart({ classid, schoolYear }) {
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [studentName, setStudentName] = useState("");
    const [gradeData, setGradeData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedTerm, setSelectedTerm] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    // 👇 legend-driven filtering (subjects user toggled ON)
    // start with nothing selected
    const [activeSubjects, setActiveSubjects] = useState(new Set());

    // 🧭 pagination state
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // 🧊 comment modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalComment, setModalComment] = useState("");

    // chart ref so we can imperatively control dataset visibility
    const chartRef = useRef(null);

    // ───────────────────────────────── fetch students ─────────────────────────────────
    useEffect(() => {
        async function fetchStudents() {
            try {
                const res = await api.get(`/teacher/classes/${classid}/students`);
                const options = res.data.map((s) => ({
                    value: s.childid,
                    label: `${s.fname} ${s.lname}`,
                }));
                setStudents(options);
                setError("");
            } catch (err) {
                console.error("Failed to load students", err);
                setError("Failed to load students.");
            }
        }
        fetchStudents();
    }, [classid]);

    // ───────────────────────────────── fetch grades ─────────────────────────────────
    useEffect(() => {
        async function fetchGrades() {
            if (!selectedStudentId || !schoolYear) return;
            setLoading(true);
            try {
                const res = await api.get(
                    `/teacher/dashboard/student-year-overview/${selectedStudentId}`,
                    { params: { schoolYear, classid } }
                );
                setGradeData(res.data);
                setStudentName(res.data.student.name);
                setError("");

                // start with nothing visible; user can pick subjects or use Show All
                setActiveSubjects(new Set());
                setPage(1);
            } catch (err) {
                console.error("Failed to fetch year overview", err);
                setError("Failed to fetch grade progression");
                setGradeData(null);
            } finally {
                setLoading(false);
            }
        }
        fetchGrades();
    }, [selectedStudentId, schoolYear, classid]);

    // ─────────────────────────── stable color per subject ───────────────────────────
    const allAssessments = gradeData?.assessments || [];
    const uniqueSubjects = useMemo(() => {
        if (!gradeData) return [];
        const viaSummary = (gradeData.subjects || []).map((s) => s.subject);
        if (viaSummary.length) return viaSummary;
        return [...new Set(allAssessments.map((a) => a.subject))];
    }, [gradeData, allAssessments]);

    const subjectColorMap = useMemo(() => {
        const map = new Map();
        uniqueSubjects.forEach((subj, i) => {
            map.set(subj, palette[i % palette.length]);
        });
        return map;
    }, [uniqueSubjects]);

    // ─────────── helpers to control chart visibility programmatically ───────────
    function setAllDatasetsVisible(show) {
        const chart = chartRef.current?.chart || chartRef.current;
        if (!chart) return;
        chart.data.datasets.forEach((_, i) => {
            chart.setDatasetVisibility(i, show);
        });
        chart.update();
    }

    // ───────────────────────────── chart datasets/labels ────────────────────────────
    const chartData = useMemo(() => {
        const labels = gradeData?.termNames || [];
        const datasets =
            (gradeData?.subjects || []).map((subject) => {
                const color = subjectColorMap.get(subject.subject) || "rgba(0,0,0,0.6)";
                return {
                    label: subject.subject,
                    data: subject.averages.map((val) => (val ?? null)),
                    borderColor: color,
                    backgroundColor: color,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: false,
                    tension: 0.2,
                    spanGaps: true,
                    hidden: !activeSubjects.has(subject.subject), // start hidden until selected
                };
            }) || [];
        return { labels, datasets };
    }, [gradeData, subjectColorMap, activeSubjects]);

    // ───────────────────────────── chart options (legend) ───────────────────────────
    const chartOptions = useMemo(
        () => ({
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `📈 Progression for ${studentName} (${schoolYear})`,
                    font: { size: 16 },
                },
                legend: {
                    position: "bottom",
                    onClick: (e, legendItem, legend) => {
                        const chart = legend.chart;
                        const datasetIndex = legendItem.datasetIndex;
                        const ds = chart.data.datasets[datasetIndex];
                        const subj = ds.label;

                        const nowVisible = !chart.isDatasetVisible(datasetIndex); // current state before toggle
                        chart.setDatasetVisibility(datasetIndex, nowVisible);
                        chart.update();

                        setActiveSubjects((prev) => {
                            const next = new Set(prev);
                            if (next.has(subj)) next.delete(subj);
                            else next.add(subj);
                            return next;
                        });

                        setPage(1);
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.formattedValue}%`,
                    },
                    titleFont: { size: 16 },
                    bodyFont: { size: 14 },
                    padding: 10,
                    backgroundColor: "rgba(30,30,30,0.9)",
                    displayColors: false,
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: "Average Score (%)" },
                },
            },
        }),
        [studentName, schoolYear]
    );

    // ─────────────────────────────── filters + pagination ───────────────────────────
    const filteredAssessments = useMemo(() => {
        const inLegend = (subj) => (activeSubjects.size === 0 ? false : activeSubjects.has(subj));
        // when nothing selected, show nothing (until user picks or presses Show All)
        return (allAssessments || []).filter((a) => {
            const termOk = selectedTerm ? a.term_name === selectedTerm : true;
            const subjOk = selectedSubject ? a.subject === selectedSubject : true;
            const legendOk = inLegend(a.subject);
            return termOk && subjOk && legendOk;
        });
    }, [allAssessments, selectedTerm, selectedSubject, activeSubjects]);

    const total = filteredAssessments.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageSafe = Math.min(page, totalPages);
    const start = (pageSafe - 1) * perPage;
    const end = start + perPage;
    const paged = filteredAssessments.slice(start, end);

    // whenever filters change, ensure page in range
    useEffect(() => {
        setPage(1);
    }, [selectedTerm, selectedSubject]);

    return (
        <div className="p-4 bg-gray-50 rounded-md shadow-md text-gray-800 max-w-screen-xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📈 Student Progression</h2>

            {/* 🔍 Student Selector */}
            <div className="mb-4 max-w-md">
                <label className="block mb-1 font-semibold text-gray-700">Select Student:</label>
                <Select
                    options={students}
                    onChange={(opt) => setSelectedStudentId(opt?.value || null)}
                    placeholder="Search student..."
                    className="text-gray-900"
                />
            </div>

            {/* 📊 Chart or Message */}
            {loading && <p className="text-gray-700">Loading grades...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && gradeData && gradeData.termNames.length > 0 && gradeData.subjects.length > 0 && (
                <div className="mb-6">
                    {/* Legend control buttons */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <button
                            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                                // select all
                                setActiveSubjects(new Set(uniqueSubjects));
                                setAllDatasetsVisible(true);
                                setPage(1);
                            }}
                        >
                            Show All
                        </button>
                        <button
                            className="px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
                            onClick={() => {
                                // clear all
                                setActiveSubjects(new Set());
                                setAllDatasetsVisible(false);
                                setPage(1);
                            }}
                        >
                            Clear All
                        </button>
                        <span className="text-sm text-gray-600">
                            Tip: Click a legend item to toggle a single subject.
                        </span>
                    </div>

                    <Line ref={chartRef} data={chartData} options={chartOptions} />

                    {activeSubjects.size === 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                            No subjects selected. Use the legend or “Show All” to display data.
                        </p>
                    )}
                </div>
            )}

            {/* 📋 Filters */}
            {gradeData && allAssessments.length > 0 && (
                <>
                    <h3 className="text-lg font-semibold mt-8 mb-2 text-gray-800">📄 Assessment Breakdown</h3>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div>
                            <label className="text-gray-700 mr-2 font-semibold">Filter by Term:</label>
                            <select
                                className="border border-gray-300 px-3 py-1 rounded-md"
                                value={selectedTerm}
                                onChange={(e) => setSelectedTerm(e.target.value)}
                            >
                                <option value="">All</option>
                                {gradeData.termNames.map((term) => (
                                    <option key={term} value={term}>
                                        {term}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-gray-700 mr-2 font-semibold">Filter by Subject:</label>
                            <select
                                className="border border-gray-300 px-3 py-1 rounded-md"
                                value={selectedSubject}
                                onChange={(e) => {
                                    setSelectedSubject(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All</option>
                                {[...new Set(allAssessments.map((a) => a.subject))].map((subject) => (
                                    <option key={subject} value={subject}>
                                        {subject}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 🧮 Table + Pagination */}
                    <div className="overflow-x-auto">
                        <table className="table-auto w-full border text-sm">
                            <thead>
                                <tr className="bg-gray-100 text-gray-900">
                                    <th className="p-2 border">Subject</th>
                                    <th className="p-2 border">Assessment</th>
                                    <th className="p-2 border">Term</th>
                                    <th className="p-2 border">Date</th>
                                    <th className="p-2 border">Score</th>
                                    <th className="p-2 border">Max</th>
                                    <th className="p-2 border">%</th>
                                    <th className="p-2 border">Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((a, i) => {
                                    const percent = ((a.score / a.max_score) * 100).toFixed(1);
                                    const bgColor = colorCodeScore(a.score, a.max_score);
                                    return (
                                        <tr key={`${a.subject}-${a.assessment_label}-${i}`} style={{ backgroundColor: bgColor }}>
                                            <td className="p-2 border">{a.subject}</td>
                                            <td className="p-2 border">{a.assessment_label}</td>
                                            <td className="p-2 border">{a.term_name}</td>
                                            <td className="p-2 border">
                                                {new Date(a.date_entered).toLocaleDateString("en-GB")}
                                            </td>
                                            <td className="p-2 border">{a.score}</td>
                                            <td className="p-2 border">{a.max_score}</td>
                                            <td className="p-2 border">{percent}%</td>
                                            <td className="p-2 border text-center">
                                                {a.comment ? (
                                                    <button
                                                        className="px-2 py-1 text-blue-600 underline"
                                                        onClick={() => {
                                                            setModalComment(a.comment);
                                                            setIsModalOpen(true);
                                                        }}
                                                    >
                                                        View
                                                    </button>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paged.length === 0 && (
                                    <tr>
                                        <td className="p-3 text-center text-gray-500" colSpan={8}>
                                            No assessments match your selection.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 🔢 Pagination controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">Rows per page:</span>
                            <select
                                className="border border-gray-300 px-2 py-1 rounded-md"
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                            >
                                {[5, 10, 15, 20, 25, 50].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-sm text-gray-700">
                            {total === 0 ? "0–0 of 0" : `${start + 1}–${Math.min(end, total)} of ${total}`}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-1 rounded border disabled:opacity-50"
                                disabled={pageSafe <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Prev
                            </button>
                            <span className="text-sm">{pageSafe}/{totalPages}</span>
                            <button
                                className="px-3 py-1 rounded border disabled:opacity-50"
                                disabled={pageSafe >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* 🪟 Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-[90%] p-5">
                        <h4 className="text-lg font-semibold mb-2 text-gray-800">Comment</h4>
                        <p className="text-gray-700 whitespace-pre-wrap">{modalComment}</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                className="px-3 py-1 rounded border"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from "react";
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

// 🎨 Consistent subject color palette
const subjectColors = [
    "rgba(34, 197, 94, 0.8)",   // Green
    "rgba(234, 179, 8, 0.8)",   // Yellow
    "rgba(59, 130, 246, 0.8)",  // Blue
    "rgba(239, 68, 68, 0.8)",   // Red
    "rgba(168, 85, 247, 0.8)",  // Purple
    "rgba(20, 184, 166, 0.8)",  // Teal
    "rgba(245, 158, 11, 0.8)",  // Orange
];

// 🔴🟡🟢 Table row color logic
function colorCodeScore(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "rgba(34, 197, 94, 0.2)";
    if (percent >= 50) return "rgba(234, 179, 8, 0.2)";
    return "rgba(239, 68, 68, 0.2)";
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

    useEffect(() => {
        async function fetchGrades() {
            if (!selectedStudentId || !schoolYear) return;
            setLoading(true);
            try {
                const res = await api.get(`/teacher/dashboard/student-year-overview/${selectedStudentId}`, {
                    params: { schoolYear, classid },
                });
                setGradeData(res.data);
                setStudentName(res.data.student.name);
                setError("");
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

    const chartData = {
        labels: gradeData?.termNames || [],
        datasets:
            gradeData?.subjects.map((subject, idx) => ({
                label: subject.subject,
                data: subject.averages.map((val) => val ?? null),
                fill: false,
                borderColor: subjectColors[idx % subjectColors.length],
                backgroundColor: subjectColors[idx % subjectColors.length],
                tension: 0.2,
                spanGaps: true,
            })) || [],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: `📈 Progression for ${studentName} (${schoolYear})`,
                font: { size: 16 },
            },
            legend: { position: "bottom" },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `${context.dataset.label}: ${context.formattedValue}%`;
                    },
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
    };

    const allAssessments = gradeData?.assessments || [];

    const filteredAssessments = allAssessments.filter((a) => {
        return (
            (selectedTerm ? a.term_name === selectedTerm : true) &&
            (selectedSubject ? a.subject === selectedSubject : true)
        );
    });

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
                    <Line data={chartData} options={chartOptions} />
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
                                onChange={(e) => setSelectedSubject(e.target.value)}
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

                    {/* 🧮 Table */}
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
                                {filteredAssessments.map((a, i) => {
                                    const percent = ((a.score / a.max_score) * 100).toFixed(1);
                                    const bgColor = colorCodeScore(a.score, a.max_score);
                                    return (
                                        <tr key={i} style={{ backgroundColor: bgColor }}>
                                            <td className="p-2 border">{a.subject}</td>
                                            <td className="p-2 border">{a.assessment_label}</td>
                                            <td className="p-2 border">{a.term_name}</td>
                                            <td className="p-2 border">{new Date(a.date_entered).toLocaleDateString("en-GB")}</td>
                                            <td className="p-2 border">{a.score}</td>
                                            <td className="p-2 border">{a.max_score}</td>
                                            <td className="p-2 border">{percent}%</td>
                                            <td className="p-2 border">{a.comment || "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

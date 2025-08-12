import React, { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function colorCodeScore(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "rgba(34, 197, 94, 0.6)";
    if (percent >= 50) return "rgba(234, 179, 8, 0.6)";
    return "rgba(239, 68, 68, 0.6)";
}

function colorClassForTable(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "bg-green-100";
    if (percent >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

const bins = [
    { label: "90-100", min: 90, max: 100 },
    { label: "80-89", min: 80, max: 89 },
    { label: "75-79", min: 75, max: 79 },
    { label: "50-74", min: 50, max: 74 },
    { label: "0-49", min: 0, max: 49 },
];

export default function AssessmentChart({
    assessments = [],
    selectedAssessment,
    setSelectedAssessment,
    grades = [],
    selectedTerm,
    search,
    setSearch,
    sortKey,
    setSortKey,
    sortAsc,
    setSortAsc,
    students = [],
}) {
    const [scoreRangeFilter, setScoreRangeFilter] = useState(null);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const assessGrades = useMemo(() => {
        if (!selectedTerm || !selectedAssessment) return [];
        return grades.filter(
            (g) => g.termid === selectedTerm.termid && g.assessment_name === selectedAssessment
        );
    }, [grades, selectedTerm, selectedAssessment]);

    const studentMap = useMemo(() => {
        const map = {};
        for (const s of students) map[s.childid] = s.name;
        return map;
    }, [students]);

    const stats = useMemo(() => {
        const scores = assessGrades.map((g) => Number(g.score)).sort((a, b) => a - b);
        if (!scores.length) return { min: "-", max: "-", median: "-" };
        const median =
            scores.length % 2 === 0
                ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
                : scores[Math.floor(scores.length / 2)];
        return {
            min: scores[0],
            max: scores[scores.length - 1],
            median: median.toFixed(1),
        };
    }, [assessGrades]);

    const binCounts = bins.map(({ label, min, max }) => {
        const studentsInBin = assessGrades.filter((g) => {
            const percent = (g.score / g.max_score) * 100;
            return percent >= min && percent <= max;
        });
        return {
            label,
            count: studentsInBin.length,
            color: studentsInBin.length ? colorCodeScore((min + max) / 2, 100) : "rgba(200,200,200,0.3)",
            students: studentsInBin.map((g) => studentMap[g.childid] || "Unknown"),
        };
    });

    const chartData = {
        labels: binCounts.map((bin) => bin.label),
        datasets: [
            {
                label: "Number of Students",
                data: binCounts.map((bin) => bin.count),
                backgroundColor: binCounts.map((bin) => bin.color),
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: `Score Distribution: ${selectedAssessment}` },
            tooltip: {
                backgroundColor: "rgba(33, 33, 33, 0.95)",
                titleFont: { size: 16, weight: "bold" },
                bodyFont: { size: 14 },
                padding: 12,
                boxPadding: 6,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        const index = context.dataIndex;
                        const bin = binCounts[index];
                        return `Students (${bin.count}):`;
                    },
                    afterLabel: function (context) {
                        const index = context.dataIndex;
                        const bin = binCounts[index];
                        if (!bin.students.length) return ["No students"];
                        return bin.students.map((name) => `• ${name}`);
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                    precision: 0,
                },
            },
        },
    };

    const filteredTableData = useMemo(() => {
        return assessGrades
            .map((g) => ({
                name: studentMap[g.childid] || "Unknown",
                score: g.score,
                max_score: g.max_score,
            }))
            .filter((r) =>
                r.name.toLowerCase().includes(search.toLowerCase())
            )
            .filter((r) => {
                if (!scoreRangeFilter) return true;
                const percent = (r.score / r.max_score) * 100;
                return percent >= scoreRangeFilter.min && percent <= scoreRangeFilter.max;
            })
            .sort((a, b) => {
                if (sortKey === "name") return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                if (sortKey === "score") return sortAsc ? a.score - b.score : b.score - a.score;
                return 0;
            });
    }, [assessGrades, studentMap, search, sortKey, sortAsc, scoreRangeFilter]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredTableData.length / itemsPerPage);
    const paginatedData = filteredTableData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (!selectedTerm) return <p className="text-red-600 font-semibold">Please select a term first.</p>;

    return (
        <div className="text-gray-800">
            <div className="mb-4 max-w-sm ">
                <label className="block mb-1 font-semibold">Select Assessment</label>
                <select
                    value={selectedAssessment}
                    onChange={(e) => {
                        setSelectedAssessment(e.target.value);
                        setCurrentPage(1); // reset page on selection change
                    }}
                    className="w-full border px-4 py-2 rounded-md"
                >
                    {assessments.map((a, idx) => (
                        <option key={idx} value={typeof a === "string" ? a : a.name}>
                            {typeof a === "string" ? a : a.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-4 max-w-sm">
                <input
                    type="text"
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="w-full border px-4 py-2 rounded-md"
                />
            </div>

            <div className="mb-4 text-gray-900 font-semibold space-x-6">
                <span>📉 Min: {stats.min}</span>
                <span>📈 Max: {stats.max}</span>
                <span>📊 Median: {stats.median}</span>
            </div>

            <div className="max-w-6xl mb-6 overflow-x-auto">
                <Bar data={chartData} options={chartOptions} />
            </div>

            <div className="mb-4 max-w-sm">
                <label className="block font-semibold mb-1">Filter by Score Range</label>
                <select
                    value={scoreRangeFilter ? scoreRangeFilter.label : ""}
                    onChange={(e) => {
                        const selected = bins.find((b) => b.label === e.target.value);
                        setScoreRangeFilter(selected || null);
                        setCurrentPage(1);
                    }}
                    className="w-full border px-4 py-2 rounded-md"
                >
                    <option value="">All</option>
                    {bins.map((b) => (
                        <option key={b.label} value={b.label}>
                            {b.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="table-auto w-full border-collapse border border-gray-300 text-sm">
                    <thead className="bg-gray-100 text-gray-900">
                        <tr>
                            <th
                                className="border px-3 py-2 cursor-pointer"
                                onClick={() => setSortKey("name")}
                            >
                                Student {sortKey === "name" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                            <th
                                className="border px-3 py-2 cursor-pointer"
                                onClick={() => setSortKey("score")}
                            >
                                Score {sortKey === "score" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                            <th className="border px-3 py-2">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, i) => (
                            <tr key={i} className={colorClassForTable(row.score, row.max_score)}>
                                <td className="border px-3 py-2">{row.name}</td>
                                <td className="border px-3 py-2">{row.score}</td>
                                <td className="border px-3 py-2">
                                    {((row.score / row.max_score) * 100).toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-4">
                <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                    Prev
                </button>
                <span>
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

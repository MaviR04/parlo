import { useEffect, useState } from "react";
import api from "../axios";
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

// Color helpers
function colorCodeScore(score) {
    if (score >= 75) return "rgba(34, 197, 94, 0.6)";     // green
    if (score >= 50) return "rgba(234, 179, 8, 0.6)";     // yellow
    return "rgba(239, 68, 68, 0.6)";                      // red
}
function colorClassForTable(score) {
    if (score >= 75) return "bg-green-100";
    if (score >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

export default function ClassOverview({ classid, termid }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchSummary() {
            if (!classid || !termid) return;
            setLoading(true);
            try {
                const res = await api.get("/teacher/dashboard/class-summary", {
                    params: { classid, termid },
                });
                setSummary(res.data);
                setError("");
            } catch (err) {
                console.error("Failed to fetch class summary", err);
                setError("Failed to fetch class summary");
            } finally {
                setLoading(false);
            }
        }
        fetchSummary();
    }, [classid, termid]);

    if (loading) return <p className="text-gray-700">Loading summary...</p>;
    if (error) return <p className="text-red-600">{error}</p>;

    const { subjectAverages, topPerformers, underperformers } = summary;

    const chartData = {
        labels: subjectAverages.map(s => s.subject),
        datasets: [
            {
                label: "Average (%)",
                data: subjectAverages.map(s => parseFloat(s.average)),
                backgroundColor: subjectAverages.map(s => colorCodeScore(parseFloat(s.average))),
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: "📊 Subject-wise Class Averages (%)" },
            tooltip: {
                backgroundColor: "rgba(33, 33, 33, 0.9)",
                titleFont: { size: 16, weight: "bold" },
                bodyFont: { size: 14 },
                padding: 12,
                boxPadding: 6,
                displayColors: false,
                callbacks: {
                    label: (context) => {
                        const subject = context.label;
                        const score = context.raw;
                        return `${subject}: ${score}% average`;
                    },
                },
            },
        },
        scales: {
            y: { beginAtZero: true, max: 100 },
        },
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md text-gray-800">
            {/* Subject Averages */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">📈 Subject Averages</h2>
                {subjectAverages.length === 0 ? (
                    <p className="text-gray-600">No grades available for this term.</p>
                ) : (
                    <>
                        <div className="mb-4 overflow-x-auto max-w-6xl ">
                            <Bar data={chartData} options={chartOptions} />
                        </div>
                        <table className="table-auto border-collapse border border-gray-900 w-full text-sm  overflow-hidden">
                            <thead className="bg-gray-100 text-gray-900">
                                <tr>
                                    <th className="border px-3 py-2 text-left">Subject</th>
                                    <th className="border px-3 py-2 text-left">Average (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectAverages.map((s, idx) => (
                                    <tr
                                        key={idx}
                                        className={`${colorClassForTable(parseFloat(s.average))}`}
                                    >
                                        <td className="border px-3 py-2">{s.subject}</td>
                                        <td className="border px-3 py-2">{s.average}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </div>

            {/* Top Performers */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-green-700">🏅 Top Performers</h2>
                {topPerformers.length === 0 ? (
                    <p className="text-gray-600">No top performers data available.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topPerformers.map((s) => (
                            <div
                                key={s.childid}
                                className="bg-green-100 border border-green-300 rounded-md px-4 py-2 shadow-sm"
                            >
                                <p className="font-semibold text-green-900">{s.name}</p>
                                <p className="text-sm text-green-800">Average: {s.average}%</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Underperformers */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-red-700">⚠️ Underperformers</h2>
                {underperformers.length === 0 ? (
                    <p className="text-gray-600">No underperformers this term. 🎉</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {underperformers.map((s) => (
                            <div
                                key={s.childid}
                                className="bg-red-100 border border-red-300 rounded-md px-4 py-2 shadow-sm"
                            >
                                <p className="font-semibold text-red-900">{s.name}</p>
                                <p className="text-sm text-red-800">
                                    Below 50% in {s.below50Count} subject{s.below50Count > 1 ? "s" : ""}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

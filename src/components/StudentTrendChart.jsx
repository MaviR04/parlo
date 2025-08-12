import { useState, useEffect } from "react";
import api from "../axios";
import { Line } from "react-chartjs-2";
import Select from "react-select";
import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

// Color code function
function colorCodeScore(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "rgba(34, 197, 94, 0.6)";
    if (percent >= 50) return "rgba(234, 179, 8, 0.6)";
    return "rgba(239, 68, 68, 0.6)";
}

// Date formatter (e.g., June 20, 2025)
function formatLongDate(dateString) {
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(new Date(dateString));
}

export default function StudentTrendChart({ classid, selectedSubject, selectedTerm, students }) {
    const [selectedStudent, setSelectedStudent] = useState("");
    const [studentData, setStudentData] = useState(null);

    const studentOptions = students.map((s) => ({
        value: s.childid,
        label: s.name,
    }));

    useEffect(() => {
        if (!selectedStudent || !classid || !selectedSubject || !selectedTerm) return;

        const url = `/teacher/dashboard/student-trend/${selectedStudent}`;
        const params = {
            classid,
            subject: selectedSubject,
            startDate: selectedTerm.start_date,
            endDate: selectedTerm.end_date,
        };

        api
            .get(url, { params })
            .then((res) => {
                setStudentData(res.data);
            })
            .catch((err) => {
                console.error("Failed to load student trend data", err);
                setStudentData(null);
            });
    }, [selectedStudent, selectedTerm, classid, selectedSubject]);

    const sortedData = [...(studentData?.assessments || [])].sort(
        (a, b) => new Date(a.date_entered) - new Date(b.date_entered)
    );

    const chartData = sortedData.map((a) => {
        const color = colorCodeScore(a.score, a.max_score);
        return {
            x: new Date(a.date_entered),
            y: ((a.score / a.max_score) * 100).toFixed(2),
            label: `${a.assessment_label} (${a.subject})`,
            rawScore: a.score,
            maxScore: a.max_score,
            date: formatLongDate(a.date_entered),
            color,
        };
    });

    const chartConfig = {
        labels: chartData.map((d) => d.date),
        datasets: [
            {
                label: "Score (%)",
                data: chartData.map((d) => d.y),
                fill: false,
                borderColor: "rgba(75, 192, 192, 0.3)",
                pointBackgroundColor: chartData.map((d) => d.color),
                pointBorderColor: chartData.map((d) => d.color),
                tension: 0.3,
                pointHoverRadius: 6,
                pointRadius: 5,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            tooltip: {
                backgroundColor: "rgba(33, 33, 33, 0.9)",
                titleFont: { size: 16, weight: "bold" },
                bodyFont: { size: 14 },
                padding: 12,
                boxPadding: 6,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        const d = chartData[context.dataIndex];
                        return [
                            `${d.label}`,
                            `Date: ${formatLongDate(d.x)}`,
                            `Score: ${d.y}%`,
                        ];
                    },
                },
            },
            legend: {
                display: false,
            },
        },
        scales: {
            y: {
                title: {
                    display: true,
                    text: "Score (%)",
                },
                min: 0,
                max: 100,
            },
            x: {
                title: {
                    display: true,
                    text: `From ${formatLongDate(selectedTerm.start_date)} to ${formatLongDate(selectedTerm.end_date)} (${selectedTerm.name})`,
                },
            },
        },
    };

    return (
        <div className="bg-white p-4 rounded-md shadow w-full max-w-[1600px] mx-auto text-gray-900">
            <label className="block font-semibold mb-2 text-gray-900">Select Student</label>
            <Select
                options={studentOptions}
                onChange={(option) => setSelectedStudent(option.value)}
                placeholder="Search or select a student..."
                className="mb-6 text-gray-900"
            />

            {selectedStudent && studentData?.assessments?.length > 0 && (
                <>
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">
                        Performance of {studentData.student.name}
                    </h3>
                    <Line data={chartConfig} options={chartOptions} className="mb-6" />

                    <div className="overflow-x-auto">
                        <table className="table-auto w-full text-sm border border-gray-300 rounded-md">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left">Date</th>
                                    <th className="px-4 py-2 text-left">Assessment</th>
                                    <th className="px-4 py-2 text-left">Score</th>
                                    <th className="px-4 py-2 text-left">Max Score</th>
                                    <th className="px-4 py-2 text-left">%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map((d, i) => (
                                    <tr
                                        key={i}
                                        className="border-t border-gray-200"
                                        style={{ backgroundColor: d.color }}
                                    >
                                        <td className="px-4 py-2">{d.date}</td>
                                        <td className="px-4 py-2">{d.label}</td>
                                        <td className="px-4 py-2">{d.rawScore}</td>
                                        <td className="px-4 py-2">{d.maxScore}</td>
                                        <td className="px-4 py-2">{d.y}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {selectedStudent && studentData?.assessments?.length === 0 && (
                <p className="text-gray-500 italic">No data available for this student.</p>
            )}
        </div>
    );
}

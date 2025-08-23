import React, { useEffect, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import api from "../axios";
import StudentListModal from "./StudentListModal";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    ChartDataLabels
);

// Color-coding by % score
function colorCodeScore(score, max = 100) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "rgba(34, 197, 94, 0.6)"; // green
    if (percent >= 50) return "rgba(234, 179, 8, 0.6)"; // yellow
    return "rgba(239, 68, 68, 0.6)";                      // red
}

export default function TermComparison({ selectedClass, selectedTerm, selectedSubject }) {
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalData, setModalData] = useState(null);

    useEffect(() => {
        if (!selectedClass || !selectedTerm || !selectedSubject) return;
        setLoading(true);
        api
            .get(`/grades/assessment-timeline/${selectedClass}`, {
                params: {
                    subject: selectedSubject,
                    termid: selectedTerm.termid,
                    mine: 1, // only assessments entered by this teacher
                },
            })
            .then((res) => {
                setTimeline(res.data || []);
                setLoading(false);
            })
            .catch((err) => {
                console.error("❌ Error fetching timeline:", err);
                setTimeline([]);
                setLoading(false);
            });
    }, [selectedClass, selectedTerm, selectedSubject]);

    // Server already filtered; keep only valid numeric averages
    const filteredTimeline = (timeline || []).filter(
        (item) => item?.average !== null && !isNaN(item.average)
    );

    const chartData = {
        labels: filteredTimeline.map((item) => new Date(item.date)),
        datasets: [
            {
                label: "Average Score (%)",
                data: filteredTimeline.map((item) => ({
                    x: new Date(item.date),
                    y: parseFloat(item.average),
                })),
                fill: false,
                borderColor: "rgba(75,192,192,0.3)",
                backgroundColor: "rgba(75,192,192,0.1)",
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBackgroundColor: filteredTimeline.map((item) => colorCodeScore(item.average)),
                pointBorderColor: filteredTimeline.map((item) => colorCodeScore(item.average)),
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { left: 50, right: 70, top: 40, bottom: 40 } },
        plugins: {
            legend: { position: "top" },
            title: {
                display: true,
                text: `Assessment Score Timeline — ${selectedSubject} (${selectedTerm?.name || ""})`,
            },
            tooltip: {
                backgroundColor: "rgba(33, 33, 33, 0.9)",
                titleFont: { size: 16, weight: "bold" },
                bodyFont: { size: 14 },
                padding: 12,
                boxPadding: 6,
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        const index = context.dataIndex;
                        const point = filteredTimeline[index];
                        return ` ${point.assessment_label} — ${point.average}%`;
                    },
                },
            },
            datalabels: {
                display: true,
                align: "top",
                anchor: "end",
                clip: false,
                clamp: true,
                font: { weight: "bold" },
                formatter: function (_, context) {
                    const point = filteredTimeline[context.dataIndex];
                    return `${point.assessment_label}\n${point.average}%`;
                },
            },
        },
        onClick: (e, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                setModalData(filteredTimeline[index]);
            }
        },
        scales: {
            x: {
                type: "time",
                time: { unit: "week", tooltipFormat: "PP" },
                title: { display: true, text: "Date" },
            },
            y: {
                title: { display: true, text: "Average Score (%)" },
                min: 0,
                max: 100,
                ticks: { stepSize: 10 },
            },
        },
    };

    if (!selectedClass || !selectedSubject || !selectedTerm) {
        return (
            <p className="text-center text-red-600 mt-6 font-semibold">
                Please select class, subject and term to view data.
            </p>
        );
    }

    if (loading) return <p className="text-center mt-4">Loading assessment timeline…</p>;
    if (!filteredTimeline.length)
        return <p className="text-center mt-4">No data available for this selection.</p>;

    return (
        <div className="w-full px-8 py-6 text-gray-800">
            {/* Page Heading (small, left-aligned) */}
            <h2 className="text-xl font-semibold mb-4 text-left text-gray-800">
                Assessment Averages per Term (Click a point to see student marks)
            </h2>

            <div className="mb-10 w-full" style={{ height: "600px" }}>
                <Line data={chartData} options={chartOptions} />
            </div>

            <h3 className="text-2xl font-semibold mb-4">Assessment Breakdown</h3>
            <div className="overflow-x-auto w-full">
                <table className="min-w-full text-sm border border-gray-300 rounded-md">
                    <thead>
                        <tr className="bg-gray-200 text-left">
                            <th className="p-3 border">Assessment</th>
                            <th className="p-3 border">Term</th>
                            <th className="p-3 border">Date</th>
                            <th className="p-3 border">Average</th>
                            <th className="p-3 border">Students</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTimeline.map((item, index) => (
                            <tr
                                key={index}
                                className="hover:bg-gray-100 cursor-pointer"
                                onClick={() => setModalData(item)}
                                style={{ backgroundColor: colorCodeScore(item.average) }}
                            >
                                <td className="p-3 border">{item.assessment_label}</td>
                                <td className="p-3 border">{item.term_name}</td>
                                <td className="p-3 border">
                                    {new Date(item.date).toLocaleDateString("en-GB")}
                                </td>
                                <td className="p-3 border">{item.average}%</td>
                                <td className="p-3 border">{item.student_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalData && (
                <StudentListModal
                    open={!!modalData}
                    onClose={() => setModalData(null)}
                    assessment={modalData}
                    students={modalData?.student_grades || []}
                />
            )}
        </div>
    );
}

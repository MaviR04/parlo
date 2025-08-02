import { useEffect, useState } from "react";
import api from "../axios";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
);

export default function AttendanceTrend({ childId, selectedTerm }) {
    const [trendData, setTrendData] = useState([]);
    const [stats, setStats] = useState(null);
    const [groupBy, setGroupBy] = useState("week");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedTerm) return;
        const start = new Date(selectedTerm.start_date);
        const end = new Date(selectedTerm.end_date);
        const diffMonths =
            (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) +
            1;
        setGroupBy(diffMonths > 3 ? "month" : "week");
    }, [selectedTerm]);

    useEffect(() => {
        if (!childId || !selectedTerm) return;

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/teacher/attendance/student/${childId}/trends`, {
                    params: {
                        start_date: selectedTerm.start_date,
                        end_date: selectedTerm.end_date,
                        groupBy,
                    },
                });
                setTrendData(res.data.trends);
                setStats(res.data.stats);
            } catch (err) {
                console.error("Error fetching attendance trend:", err);
                setError("Failed to load attendance trends.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [childId, selectedTerm, groupBy]);

    if (loading) return <p>Loading attendance trends...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (!trendData.length) return <p>No attendance trend data available.</p>;

    const isNoDataPeriod = (d) =>
        d.present === 0 && d.absent === 0 && d.late === 0 && d["half-day"] === 0;

    const labels = trendData.map((d) => {
        const date = new Date(d.period);
        if (groupBy === "month") {
            return date.toLocaleString("default", { month: "short", year: "numeric" });
        } else {
            return `Week of ${date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
            })}`;
        }
    });

    const borderDashArray = trendData.map((d) => (isNoDataPeriod(d) ? [5, 5] : []));

    const data = {
        labels,
        datasets: [
            {
                label: "Present",
                data: trendData.map((d) => d.present),
                borderColor: "green",
                backgroundColor: "rgba(0, 128, 0, 0.3)",
                borderDash: borderDashArray,
                tension: 0.3,
            },
            {
                label: "Absent",
                data: trendData.map((d) => d.absent),
                borderColor: "red",
                backgroundColor: "rgba(255, 0, 0, 0.3)",
                borderDash: borderDashArray,
                tension: 0.3,
            },
            {
                label: "Late",
                data: trendData.map((d) => d.late),
                borderColor: "orange",
                backgroundColor: "rgba(255, 165, 0, 0.3)",
                borderDash: borderDashArray,
                tension: 0.3,
            },
            {
                label: "Half Day",
                data: trendData.map((d) => d["half-day"]),
                borderColor: "blue",
                backgroundColor: "rgba(0, 0, 255, 0.3)",
                borderDash: borderDashArray,
                tension: 0.3,
            },
        ],
    };

    const options = {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        stacked: false,
        plugins: {
            legend: { position: "top" },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const d = trendData[context.dataIndex];
                        if (isNoDataPeriod(d)) {
                            return `${context.dataset.label}: 0 (No attendance data recorded)`;
                        }
                        return `${context.dataset.label}: ${context.parsed.y}`;
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: "Days" },
            },
            x: {
                title: { display: true, text: groupBy === "month" ? "Month" : "Week" },
            },
        },
    };

    return (
        <div>
            <h2 className="text-lg font-semibold mb-2">Attendance Trend ({groupBy})</h2>
            <Line data={data} options={options} />
            <p className="mt-2 text-sm italic text-gray-600">
                <strong>Note:</strong> Dashed lines indicate periods with no attendance data recorded yet.
            </p>
            {stats && (
                <div className="bg-white rounded-xl p-4 shadow-md max-w-md mx-auto my-4 mt-6">
                    <h3 className="text-lg font-semibold mb-2">Attendance Summary</h3>
                    <div className="grid grid-cols-2 gap-3 text-gray-700">
                        <div><strong>Total School Days:</strong> {stats.totalDays}</div>
                        <div><strong>Days Present:</strong> {stats.present}</div>
                        <div><strong>Days Absent:</strong> {stats.absent}</div>
                        <div><strong>Days Late:</strong> {stats.late}</div>
                        <div><strong>Half Days:</strong> {stats.halfDay}</div>
                        <div><strong>Attendance %:</strong> {stats.attendancePercent}%</div>
                    </div>
                </div>
            )}
        </div>
    );
}

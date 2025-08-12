import { useEffect, useState } from "react";
import api from "../axios";
import TermSelector from "../components/TermSelector";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

export default function BehaviourOverview() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [overviewData, setOverviewData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);

    const [studentMetric, setStudentMetric] = useState("all");

    // Fetch teacher's classes
    useEffect(() => {
        async function fetchClasses() {
            try {
                const res = await api.get("/teacher/classes/my-classes");
                setClasses(res.data);
                if (res.data.length > 0) {
                    setSelectedClass(res.data[0]);
                }
            } catch (err) {
                console.error("Failed to load classes", err);
            }
        }
        fetchClasses();
    }, []);

    // Fetch overview table
    useEffect(() => {
        async function fetchOverview() {
            if (!selectedClass || !selectedTerm) return;
            setLoading(true);
            try {
                const res = await api.get(
                    `/behaviour/class-overview?class_id=${selectedClass.classid}&term_id=${selectedTerm.termid}`
                );
                setOverviewData(res.data);
                setCurrentPage(1);
            } catch (err) {
                console.error("Failed to load overview data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchOverview();
    }, [selectedClass, selectedTerm]);

    // Fetch chart data
    useEffect(() => {
        async function fetchChart() {
            if (!selectedClass || !selectedTerm) return;
            setChartLoading(true);
            try {
                if (selectedStudent) {
                    const res = await api.get(
                        `/behaviour/student-trend?student_id=${selectedStudent.childid}&term_id=${selectedTerm.termid}`
                    );
                    const processed = res.data.map((w) => ({
                        ...w,
                        struggling: w.overall_avg < 2.0,
                    }));
                    setChartData(processed);
                } else {
                    const res = await api.get(
                        `/behaviour/class-trend?class_id=${selectedClass.classid}&term_id=${selectedTerm.termid}`
                    );
                    setChartData(res.data);
                }
            } catch (err) {
                console.error("Failed to load chart data", err);
            } finally {
                setChartLoading(false);
            }
        }
        fetchChart();
    }, [selectedClass, selectedTerm, selectedStudent]);

    // Filtered + paginated table
    const filteredData = overviewData.filter((student) =>
        `${student.fname} ${student.lname}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    // Legend chips
    const LegendChips = () => (
        <div className="flex flex-wrap gap-2 items-center mb-3">
            <span className="text-sm text-gray-600 mr-2">Show:</span>
            {[
                { key: "all", label: "All", color: "bg-gray-200" },
                { key: "overall", label: "Overall Avg", color: "bg-[#8884d8]" },
                { key: "focus", label: "Focus & Engagement", color: "bg-[#82ca9d]" },
                { key: "respect", label: "Respect & Kindness", color: "bg-[#ffc658]" },
                { key: "self", label: "Self Management", color: "bg-[#ff7300]" },
            ].map((opt) => {
                const active = studentMetric === opt.key;
                return (
                    <button
                        key={opt.key}
                        onClick={() => setStudentMetric(opt.key)}
                        className={`px-3 py-1 rounded-full text-sm border transition ${active
                                ? "ring-2 ring-blue-400 font-semibold"
                                : "opacity-85 hover:opacity-100"
                            }`}
                        style={{
                            borderColor: "#e5e7eb",
                            backgroundColor: "white",
                        }}
                    >
                        <span
                            className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${opt.color}`}
                        />
                        <span className="align-middle">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="p-4 bg-white shadow rounded-lg">
            <h2 className="text-lg font-bold mb-4">Behaviour Overview</h2>

            <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />

            {/* Class selector */}
            <div className="mb-4">
                <label className="block font-medium mb-1 text-black">Select Class</label>
                <select
                    value={selectedClass?.classid || ""}
                    onChange={(e) => {
                        const cls = classes.find(
                            (c) => c.classid === parseInt(e.target.value)
                        );
                        setSelectedClass(cls);
                        setSelectedStudent(null);
                        setStudentMetric("all");
                    }}
                    className="border border-gray-300 rounded px-3 py-2"
                >
                    {classes.map((cls) => (
                        <option key={cls.classid} value={cls.classid}>
                            {cls.classname}
                        </option>
                    ))}
                </select>
            </div>

            {/* Search bar */}
            <div className="mb-2">
                <input
                    type="text"
                    placeholder="Search student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1"
                />
            </div>

            {/* Table */}
            {loading ? (
                <p>Loading overview...</p>
            ) : (
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1 text-left">
                                Student
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Focus & Engagement
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Respect & Kindness
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Self Management
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Overall Avg
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? (
                            paginatedData.map((student) => (
                                <tr
                                    key={student.childid}
                                    className={`cursor-pointer hover:bg-gray-50 ${selectedStudent?.childid === student.childid
                                            ? "bg-blue-50"
                                            : ""
                                        }`}
                                    onClick={() => {
                                        const next =
                                            selectedStudent?.childid === student.childid
                                                ? null
                                                : student;
                                        setSelectedStudent(next);
                                        setStudentMetric("all");
                                    }}
                                >
                                    <td className="border border-gray-300 px-2 py-1">
                                        {student.fname} {student.lname}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                        {student.avg_focus_engagement ?? "-"}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                        {student.avg_respect_kindness ?? "-"}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                        {student.avg_self_management ?? "-"}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                        {student.overall_avg ?? "-"}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    className="border border-gray-300 px-4 py-2 text-center"
                                    colSpan="5"
                                >
                                    No records found for this term.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-2 space-x-2">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <span className="px-3 py-1">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Chart */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-semibold">
                        {selectedStudent
                            ? `Trend for ${selectedStudent.fname} ${selectedStudent.lname}`
                            : "Class Trend"}
                    </h3>
                    {selectedStudent && <LegendChips />}
                </div>

                {chartLoading ? (
                    <p>Loading chart...</p>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="week_start_date"
                                tickFormatter={(date) => {
                                    const d = new Date(date);
                                    return `Week of ${d.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                    })}`;
                                }}
                            />
                            <YAxis domain={[0, 3]} />
                            <Tooltip
                                labelFormatter={(date) => {
                                    const d = new Date(date);
                                    return `Week of ${d.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}`;
                                }}
                                formatter={(value, name, props) => {
                                    if (props.payload.struggling) {
                                        return [`${value} ⚠ Struggling week`, name];
                                    }
                                    return [value, name];
                                }}
                            />
                            <Legend />

                            {/* Class view */}
                            {!selectedStudent && (
                                <Line
                                    type="monotone"
                                    dataKey="overall_avg"
                                    stroke="#8884d8"
                                    name="Overall Avg"
                                    dot={false}
                                    strokeWidth={2}
                                />
                            )}

                            {/* Student view lines */}
                            {selectedStudent &&
                                (studentMetric === "all" || studentMetric === "overall") && (
                                    <Line
                                        type="monotone"
                                        dataKey="overall_avg"
                                        stroke="#8884d8"
                                        name="Overall Avg"
                                        strokeWidth={2}
                                        dot={(props) => {
                                            const { cx, cy, payload } = props;
                                            if (payload.struggling) {
                                                return (
                                                    <circle
                                                        cx={cx}
                                                        cy={cy}
                                                        r={6}
                                                        fill="red"
                                                        stroke="white"
                                                        strokeWidth={2}
                                                    />
                                                );
                                            }
                                            return (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={3}
                                                    fill="#8884d8"
                                                />
                                            );
                                        }}
                                    />
                                )}
                            {selectedStudent &&
                                (studentMetric === "all" || studentMetric === "focus") && (
                                    <Line
                                        type="monotone"
                                        dataKey="focus_engagement"
                                        stroke="#82ca9d"
                                        name="Focus & Engagement"
                                        dot={false}
                                        strokeWidth={2}
                                    />
                                )}
                            {selectedStudent &&
                                (studentMetric === "all" || studentMetric === "respect") && (
                                    <Line
                                        type="monotone"
                                        dataKey="respect_kindness"
                                        stroke="#ffc658"
                                        name="Respect & Kindness"
                                        dot={false}
                                        strokeWidth={2}
                                    />
                                )}
                            {selectedStudent &&
                                (studentMetric === "all" || studentMetric === "self") && (
                                    <Line
                                        type="monotone"
                                        dataKey="self_management"
                                        stroke="#ff7300"
                                        name="Self Management"
                                        dot={false}
                                        strokeWidth={2}
                                    />
                                )}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

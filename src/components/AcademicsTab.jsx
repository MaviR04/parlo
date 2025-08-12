import { useState, useEffect } from "react";
import api from "../axios";
import { Line, Bar } from "react-chartjs-2";
import "chart.js/auto";
import annotationPlugin from "chartjs-plugin-annotation";

import { Chart as ChartJS } from "chart.js";
ChartJS.register(annotationPlugin);

export default function AcademicsTab({ childId, termId }) {
    const subTabs = ["overview", "subject", "class position", "topics"];
    const [activeSubTab, setActiveSubTab] = useState("overview");

    const [overview, setOverview] = useState(null);
    const [drillSubject, setDrillSubject] = useState(null);
    const [subjectList, setSubjectList] = useState([]);
    const [subjectData, setSubjectData] = useState(null);
    const [classPosition, setClassPosition] = useState(null);
    const [topics, setTopics] = useState(null);
    const [showFullView, setShowFullView] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch overview
    useEffect(() => {
        if (activeSubTab === "overview") {
            setLoading(true);
            api
                .get(`/academics/overview/${childId}/${termId}`)
                .then((res) => {
                    setOverview(res.data);
                    setSubjectList(res.data.subjects.map((s) => s.subject));
                    setError(null);
                })
                .catch(() => setError("Failed to load overview"))
                .finally(() => setLoading(false));
        }
    }, [activeSubTab, childId, termId]);

    // Fetch subject drilldown
    useEffect(() => {
        if (activeSubTab === "subject" && drillSubject) {
            setLoading(true);
            api
                .get(`/academics/subject-drilldown/${childId}/${termId}`, {
                    params: { subject: drillSubject },
                })
                .then((res) => {
                    setSubjectData(res.data);
                    setError(null);
                })
                .catch(() => setError("Failed to load subject data"))
                .finally(() => setLoading(false));
        }
    }, [activeSubTab, drillSubject, childId, termId]);

    // Fetch class position
    useEffect(() => {
        if (activeSubTab === "class position") {
            setLoading(true);
            api
                .get(`/academics/class-position/${childId}/${termId}`)
                .then((res) => {
                    setClassPosition(res.data);
                    setError(null);
                })
                .catch(() => setError("Failed to load class position"))
                .finally(() => setLoading(false));
        }
    }, [activeSubTab, childId, termId]);

    // Fetch topics
    useEffect(() => {
        if (activeSubTab === "topics") {
            setLoading(true);
            api
                .get(`/academics/topics/${childId}/${termId}`)
                .then((res) => {
                    setTopics(res.data);
                    setError(null);
                })
                .catch(() => setError("Failed to load topics"))
                .finally(() => setLoading(false));
        }
    }, [activeSubTab, childId, termId]);

    if (loading) return <p>Loading...</p>;
    if (error) return <p className="text-red-600">{error}</p>;

    return (
        <div className="text-gray-800">
            {/* Sub-tabs */}
            <div className="mb-4">
                {subTabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveSubTab(tab)}
                        className={`px-3 py-1 rounded mr-2 capitalize ${activeSubTab === tab
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeSubTab === "overview" && overview && (
                <div className="bg-white rounded-2xl shadow-lg p-4 space-y-6">
                    {/* Insight banners */}
                    <div className="space-y-2">
                        {overview.insights?.map((ins, i) => (
                            <div
                                key={i}
                                className={`p-2 rounded font-semibold text-sm ${ins.type === "alert"
                                    ? "bg-red-100 text-red-700"
                                    : ins.type === "success"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    }`}
                            >
                                {ins.message}
                            </div>
                        ))}
                    </div>

                    <h2 className="text-lg font-bold">Subject Averages</h2>
                    <div className="space-y-2">
                        {overview.subjects.map((s) => (
                            <div
                                key={s.subject}
                                className="bg-gray-100 rounded p-2 cursor-pointer"
                                onClick={() => {
                                    setDrillSubject(s.subject);
                                    setActiveSubTab("subject");
                                }}
                            >
                                <div className="flex justify-between text-sm font-semibold">
                                    <span>{s.subject}</span>
                                    <span>
                                        {s.child_avg}% (Class: {s.class_avg}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-300 rounded h-3 mt-1">
                                    <div
                                        className="bg-blue-500 h-3 rounded"
                                        style={{ width: `${s.child_avg}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-lg font-bold mt-6">Recent Assessments</h2>
                    <table className="w-full border text-sm">
                        <thead>
                            <tr className="bg-gray-200 text-left">
                                <th className="p-2">Date</th>
                                <th className="p-2">Subject</th>
                                <th className="p-2">Name</th>
                                <th className="p-2">Score</th>
                                <th className="p-2">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.recent_assessments.map((a, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-2">
                                        {new Date(a.date).toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </td>
                                    <td className="p-2">{a.subject}</td>
                                    <td className="p-2">{a.name}</td>
                                    <td className="p-2">
                                        {a.score}/{a.max}
                                    </td>
                                    <td className="p-2">{a.pct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* SUBJECT TAB */}
            {activeSubTab === "subject" && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    {/* Subject pills */}
                    <div className="mb-4 space-x-2">
                        {subjectList.map((subj) => (
                            <button
                                key={subj}
                                onClick={() => setDrillSubject(subj)}
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${drillSubject === subj
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700"
                                    }`}
                            >
                                {subj}
                            </button>
                        ))}
                    </div>

                    {subjectData && (
                        <>
                            <h2 className="text-lg font-bold mb-4">
                                {drillSubject} – Term Trend
                            </h2>
                            <Line
                                data={{
                                    labels: subjectData.childSeries.map((d) =>
                                        new Date(d.date).toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })
                                    ),
                                    datasets: [
                                        {
                                            label: "Your Child",
                                            data: subjectData.childSeries.map((d) => d.pct),
                                            borderColor: "#3b82f6",
                                            tension: 0.3,
                                            pointRadius: 4,
                                            pointHoverRadius: 8, // bigger hover point
                                            hitRadius: 12, // increases clickable/hoverable area
                                        },
                                        {
                                            label: "Class Average",
                                            data: subjectData.classSeries.map((d) => d.class_pct),
                                            borderColor: "#f59e0b",
                                            borderDash: [5, 5],
                                            tension: 0.3,
                                            pointRadius: 4,
                                            pointHoverRadius: 8,
                                            hitRadius: 12,
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        tooltip: {
                                            bodyFont: {
                                                size: 16,
                                                weight: "bold",
                                            },
                                            titleFont: {
                                                size: 18,
                                                weight: "bold",
                                            },
                                            padding: 12,
                                        },
                                        legend: {
                                            labels: {
                                                font: {
                                                    size: 14,
                                                },
                                            },
                                        },
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100,
                                        },
                                    },
                                }}
                                height={100}
                            />


                            <table className="w-full border mt-6 text-sm">
                                <thead>
                                    <tr className="bg-gray-200 text-left">
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Assessment</th>
                                        <th className="p-2">Label</th>
                                        <th className="p-2">Score</th>
                                        <th className="p-2">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjectData.childSeries.map((a, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2">
                                                {new Date(a.date).toLocaleDateString("en-GB", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </td>
                                            <td className="p-2">{a.name}</td>
                                            <td className="p-2">{a.assessment_label || "-"}</td>
                                            <td className="p-2">
                                                {a.score}/{a.max}
                                            </td>
                                            <td className="p-2">{a.pct}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            )}
            {/* CLASS POSITION TAB */}
            {activeSubTab === "class position" && classPosition && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h2 className="text-lg font-bold mb-4">Overall Class Position</h2>

                    {/* Toggle for expanded view */}
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setShowFullView((prev) => !prev)}
                            className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                            {showFullView ? "Hide Full Class" : "View Full Class"}
                        </button>
                    </div>

                    {/* Top 5 view */}
                    {!showFullView && (
                        <div style={{ overflowX: "auto" }}>
                            <Bar
                                data={{
                                    labels: (() => {
                                        const labels = [];
                                        const topFive = classPosition.distribution
                                            .slice(0, 5)
                                            .map((_, i) => `#${i + 1}`);
                                        labels.push(...topFive);

                                        if (classPosition.position > 5) {
                                            labels.push("…");
                                            labels.push(`#${classPosition.position}`);
                                        }
                                        return labels;
                                    })(),
                                    datasets: [
                                        {
                                            label: "Average %",
                                            data: (() => {
                                                const data = [];
                                                const topFiveData = classPosition.distribution.slice(0, 5);
                                                data.push(...topFiveData);

                                                if (classPosition.position > 5) {
                                                    data.push(null); // gap
                                                    data.push(classPosition.student_avg);
                                                }
                                                return data;
                                            })(),
                                            backgroundColor: (() => {
                                                const colors = [];
                                                classPosition.distribution.slice(0, 5).forEach((_, idx) => {
                                                    colors.push(
                                                        idx + 1 === classPosition.position
                                                            ? "#3b82f6"
                                                            : "rgba(107, 114, 128, 0.5)"
                                                    );
                                                });
                                                if (classPosition.position > 5) {
                                                    colors.push("rgba(0,0,0,0)");
                                                    colors.push("#3b82f6");
                                                }
                                                return colors;
                                            })(),
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    plugins: { legend: { display: false } },
                                    layout: { padding: { top: 0, bottom: 0 } },
                                    scales: { y: { beginAtZero: true, max: 100 } },
                                }}
                                height={100} // smaller chart height
                            />
                        </div>
                    )}

                    {/* Full view */}
                    {showFullView && (
                        <div style={{ overflowX: "auto" }}>
                            <Line
                                data={{
                                    labels: classPosition.distribution.map((_, i) => `#${i + 1}`),
                                    datasets: [
                                        {
                                            label: "Class Distribution",
                                            data: classPosition.distribution,
                                            borderColor: "rgba(107, 114, 128, 0.5)",
                                            backgroundColor: "rgba(107, 114, 128, 0.5)",
                                            pointRadius: classPosition.distribution.map((_, idx) =>
                                                idx + 1 === classPosition.position ? 6 : 3
                                            ),
                                            pointBackgroundColor: classPosition.distribution.map((_, idx) =>
                                                idx + 1 === classPosition.position
                                                    ? "#3b82f6"
                                                    : "rgba(107, 114, 128, 0.5)"
                                            ),
                                        },
                                    ],
                                }}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        tooltip: {
                                            callbacks: {
                                                label: (context) => {
                                                    const idx = context.dataIndex + 1;
                                                    if (idx === classPosition.position) {
                                                        return `Your Child: ${context.raw}%`;
                                                    }
                                                    return "Anonymous";
                                                },
                                            },
                                        },
                                        legend: { display: false },
                                    },
                                    layout: { padding: { top: 0, bottom: 0 } },
                                    scales: { y: { beginAtZero: true, max: 100 } },
                                }}
                                height={100} // smaller chart height
                            />
                        </div>
                    )}

                    <p className="mt-3 text-sm font-semibold">
                        Position:{" "}
                        <span className="text-blue-600">#{classPosition.position}</span> out of{" "}
                        {classPosition.total_students} students
                    </p>
                    <p className="text-sm text-gray-600">
                        Your child's average: {classPosition.student_avg}% | Class average:{" "}
                        {classPosition.class_avg}%
                    </p>
                </div>
            )}


            {/* TOPICS TAB */}
            {activeSubTab === "topics" && topics && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h2 className="text-lg font-bold mb-4">Topics – Best & Worst</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {topics.map((t) => (
                            <div
                                key={t.subject}
                                className="bg-gray-80 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow"
                            >
                                <h3 className="font-semibold text-lg mb-3">{t.subject}</h3>

                                {/* Best Topic */}
                                <div className="mb-5">
                                    <p className="text-green-700 text-sm font-semibold mb-1">
                                        Best: <span className="font-medium">{t.best.topic}</span> ({t.best.avg_pct}%)
                                    </p>
                                    <div className="w-full bg-green-100 rounded-full h-3 shadow-inner overflow-hidden">
                                        <div
                                            className="h-3 rounded-full transition-all duration-700"
                                            style={{
                                                width: `${t.best.avg_pct}%`,
                                                background: "linear-gradient(90deg, #34d399, #059669)",
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Worst Topic */}
                                <div>
                                    <p className="text-red-700 text-sm font-semibold mb-1">
                                        Needs Support: <span className="font-medium">{t.worst.topic}</span> ({t.worst.avg_pct}%)
                                    </p>
                                    <div className="w-full bg-red-100 rounded-full h-3 shadow-inner overflow-hidden">
                                        <div
                                            className="h-3 rounded-full transition-all duration-700"
                                            style={{
                                                width: `${t.worst.avg_pct}%`,
                                                background: "linear-gradient(90deg, #f87171, #b91c1c)",
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

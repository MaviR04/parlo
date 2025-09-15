import { useState, useEffect } from "react";
import api from "../axios";
import { Pie, Line } from "react-chartjs-2";
import "chart.js/auto";

export default function ActivitiesTab({ childId, termId }) {
    const subTabs = ["overview", "progress", "badges", "logs"];
    const [activeSubTab, setActiveSubTab] = useState("overview");   

    // Overview data  
    const [overviewData, setOverviewData] = useState(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [errorOverview, setErrorOverview] = useState(null);

    // Progress data
    const [progressData, setProgressData] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [weeklyData, setWeeklyData] = useState([]);
    const [loadingProgress, setLoadingProgress] = useState(false);
    const [loadingWeekly, setLoadingWeekly] = useState(false);

    // Badges data
    const [badgesData, setBadgesData] = useState({});
    const [loadingBadges, setLoadingBadges] = useState(false);

    // Logs
    const [logsData, setLogsData] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const [filterActivity, setFilterActivity] = useState("");
    const [filterTag, setFilterTag] = useState("");
    const [activitiesList, setActivitiesList] = useState([]);
    const [tagsList, setTagsList] = useState([]);

    // Dynamic chips
    const [allTags, setAllTags] = useState([]);
    const [tagCategories, setTagCategories] = useState([]);
    const [categoryColor, setCategoryColor] = useState({});
    const [selectedCategory, setSelectedCategory] = useState("");

    // Date preset + search
    const [datePreset, setDatePreset] = useState("This term");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 10;

    // ----- helpers -----
    const startOfWeekMon = (d) => {
        const dt = new Date(d);
        const day = dt.getDay(); // Sun=0
        const diff = (day === 0 ? -6 : 1) - day;
        dt.setDate(dt.getDate() + diff);
        dt.setHours(0, 0, 0, 0);
        return dt;
    };
    const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    const withinPreset = (isoDate, preset) => {
        if (!isoDate) return true;
        const d = new Date(isoDate);
        const now = new Date();
        d.setHours(0, 0, 0, 0);

        if (preset === "This week") return d >= startOfWeekMon(now);
        if (preset === "This month") return d >= startOfMonth(now);
        return true; // "This term" already scoped by API
    };

    const friendlyHeader = (cat) => {
        if (!cat) return "All Activity Logs";
        const map = {
            Achievement: "Highlights (Achievement)",
            Encouragement: "Needs Attention (Encouragement)",
            Attitude: "Behaviour Notes",
            Discipline: "Attendance Notes",
        };
        return map[cat] || `${cat} Notes`;
    };

    const emptyMessage = (cat, preset) => {
        if (!cat) return `No logs ${preset.toLowerCase()}.`;
        const map = {
            Encouragement: `No Concerns ${preset.toLowerCase()} 🎉`,
            Discipline: `No Attendance issues ${preset.toLowerCase()} ✅`,
        };
        return map[cat] || `No ${cat} notes ${preset.toLowerCase()}.`;
    };

    const colorForLogDot = (log, selectedCat) => {
        if (!log?.tags?.length) return "#9CA3AF";
        if (selectedCat) {
            const hit = log.tags.find(t => t.category === selectedCat);
            if (hit?.color) return hit.color;
            return "#9CA3AF";
        }
        return log.tags[0].color || "#9CA3AF";
    };

    // NEW: start→current trend + fluctuation helper
    function computeStartCurrentTrend(weeklyData, epsilon = 0.25) {
        const vals = (weeklyData || [])
            .map(w => Number(w.week_avg ?? 0))
            .filter(v => !Number.isNaN(v));

        if (!vals.length) {
            return {
                first: 0, last: 0, delta: 0, pct: 0,
                trendLabel: "Steady", trendClass: "text-gray-600 font-semibold",
                fluctuated: false
            };
        }

        const first = vals[0];
        const last = vals[vals.length - 1];
        const delta = last - first;
        const pct = first === 0 ? 0 : (delta / first) * 100;

        let trendLabel = "Steady";
        let trendClass = "text-gray-600 font-semibold";
        if (delta > epsilon) {
            trendLabel = "Improving";
            trendClass = "text-green-600 font-semibold";
        } else if (delta < -epsilon) {
            trendLabel = "Declining";
            trendClass = "text-red-600 font-semibold";
        }

        // Friendly fluctuation note if big swings mid-term (tune threshold for your 0–10 scale)
        const range = Math.max(...vals) - Math.min(...vals);
        const fluctuated = range >= 2; // e.g., any swing ≥ 2 points

        return { first, last, delta, pct, trendLabel, trendClass, fluctuated };
    }

    // ----- data fetchers -----
    useEffect(() => {
        if (activeSubTab === "overview") {
            setLoadingOverview(true);
            api
                .get(`/activities/overview/${childId}/${termId}`)
                .then((res) => {
                    setOverviewData(res.data);
                    setErrorOverview(null);
                })
                .catch(() => setErrorOverview("Failed to load activities overview"))
                .finally(() => setLoadingOverview(false));
        }
    }, [activeSubTab, childId, termId]);

    useEffect(() => {
        if (activeSubTab === "progress") {
            setLoadingProgress(true);
            api
                .get(`/activities/progress/${childId}/${termId}`)
                .then((res) => {
                    setProgressData(res.data);
                    if (res.data.length > 0) {
                        setSelectedActivity(res.data[0].activity_name);
                    }
                })
                .finally(() => setLoadingProgress(false));
        }
    }, [activeSubTab, childId, termId]);

    useEffect(() => {
        if (!selectedActivity || activeSubTab !== "progress") return;
        setLoadingWeekly(true);
        api
            .get(
                `/activities/progress/${childId}/${termId}/weekly?activity=${encodeURIComponent(
                    selectedActivity
                )}`
            )
            .then((res) => setWeeklyData(res.data))
            .finally(() => setLoadingWeekly(false));
    }, [selectedActivity, childId, termId, activeSubTab]);

    useEffect(() => {
        if (activeSubTab === "badges") {
            setLoadingBadges(true);
            api
                .get(`/activities/badges/${childId}/${termId}`)
                .then((res) => {
                    setBadgesData(res.data || {});
                })
                .catch(() => setBadgesData({}))
                .finally(() => setLoadingBadges(false));
        }
    }, [activeSubTab, childId, termId]);

    useEffect(() => {
        if (activeSubTab === "logs") {
            setLoadingLogs(true);
            api
                .get(`/activities/logs/${childId}/${termId}`)
                .then((res) => {
                    setLogsData(res.data || []);

                    const activities = [
                        ...new Set(res.data.map((log) => log.activity_name)),
                    ];
                    setActivitiesList(activities);

                    const tags = [
                        ...new Set(res.data.flatMap((log) => log.tags.map((t) => t.name))),
                    ];
                    setTagsList(tags);
                })
                .catch(() => setLogsData([]))
                .finally(() => setLoadingLogs(false));
        }
    }, [activeSubTab, childId, termId]);

    useEffect(() => {
        if (activeSubTab !== "logs") return;
        api.get("/activities/tags")
            .then(res => {
                const tags = res.data || [];
                setAllTags(tags);

                const cats = [...new Set(tags.map(t => t.category).filter(Boolean))];

                const colorMap = {};
                for (const c of cats) {
                    const tag = tags.find(t => t.category === c && t.color);
                    colorMap[c] = tag?.color || "#6B7280";
                }

                setTagCategories(cats);
                setCategoryColor(colorMap);
                setSelectedCategory(prev => (prev && cats.includes(prev) ? prev : ""));
            })
            .catch(() => {
                setAllTags([]);
                setTagCategories([]);
                setCategoryColor({});
                setSelectedCategory("");
            });
    }, [activeSubTab]);

    // Filtered logs (activity/tag search UI kept intact, even if not shown in table below)
    const filteredLogs = logsData.filter((log) => {
        const matchesSearch = log.comment
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesActivity =
            !filterActivity || log.activity_name === filterActivity;
        const matchesTag =
            !filterTag || log.tags.some((t) => t.name === filterTag);
        return matchesSearch && matchesActivity && matchesTag;
    });

    const indexOfLastLog = currentPage * logsPerPage;
    const indexOfFirstLog = indexOfLastLog - logsPerPage;
    const paginatedLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);

    return (
        <div className="text-gray-900">
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
            {activeSubTab === "overview" && (
                <>
                    {loadingOverview && <p>Loading...</p>}
                    {errorOverview && (
                        <p className="text-red-600">{errorOverview}</p>
                    )}
                    {overviewData && (
                        <div className="bg-white rounded-2xl shadow-lg p-4 space-y-6">
                            <h2 className="text-lg font-bold">Key Highlights</h2>
                            <div className="space-y-2">
                                {(overviewData?.insights || []).map((ins, i) => {
                                    const activityName =
                                        ins.activity_name || ins.activity || ins.activityName || "";

                                    const isAlert = ins.type === "alert";
                                    const base =
                                        "p-2 rounded font-semibold text-sm flex flex-wrap items-center gap-2";
                                    const cls = isAlert
                                        ? `${base} bg-red-100 text-red-700`
                                        : `${base} bg-green-100 text-green-700`;

                                    return (
                                        <div key={i} className={cls}>
                                            {activityName ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/80 text-gray-800">
                                                    <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
                                                    {activityName}
                                                </span>
                                            ) : null}

                                            <span className="whitespace-pre-wrap">{ins.message}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {overviewData.category_breakdown.length > 0 && (
                                <>
                                    <h2 className="text-lg font-bold">
                                        Participation by Category
                                    </h2>
                                    <div className="max-w-sm">
                                        <Pie
                                            data={{
                                                labels: overviewData.category_breakdown.map(
                                                    (c) => c.category
                                                ),
                                                datasets: [
                                                    {
                                                        data: overviewData.category_breakdown.map(
                                                            (c) => c.count
                                                        ),
                                                        backgroundColor: [
                                                            "#3b82f6",
                                                            "#f59e0b",
                                                            "#10b981",
                                                            "#ef4444",
                                                        ],
                                                    },
                                                ],
                                            }}
                                            options={{
                                                plugins: {
                                                    legend: { labels: { color: "#111827" } },
                                                },
                                            }}
                                        />
                                    </div>
                                </>
                            )}

                            <h2 className="text-lg font-bold">Recent Activity Logs</h2>
                            <table className="w-full border text-sm">
                                <thead>
                                    <tr className="bg-gray-200 text-left">
                                        <th className="p-2">Date</th>
                                        <th className="p-2">Activity</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Tags</th>
                                        <th className="p-2">Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overviewData.recent_logs.map((log, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2">
                                                {new Date(log.date).toLocaleDateString("en-GB", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                            </td>
                                            <td className="p-2">{log.activity_name}</td>
                                            <td className="p-2">{log.type}</td>
                                            <td className="p-2 space-x-1">
                                                {log.tags.map((t, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 rounded-full text-xs"
                                                        style={{
                                                            backgroundColor: t.color,
                                                            color: "white",
                                                        }}
                                                    >
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </td>
                                            <td className="p-2">{log.comment || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* PROGRESS TAB */}
            {activeSubTab === "progress" && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h2 className="text-lg font-bold mb-4">Activity Progress</h2>

                    {loadingProgress ? (
                        <p>Loading...</p>
                    ) : progressData.length === 0 ? (
                        <p className="text-gray-500 italic">
                            No ratings available for this term.
                        </p>
                    ) : (
                        <>
                            <table className="w-full border text-sm mb-6">
                                <thead>
                                    <tr className="bg-gray-200 text-left">
                                        <th className="p-2">Activity</th>
                                        <th className="p-2">Progress</th>
                                        <th className="p-2 text-center">Marked Sessions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {progressData.map((item, i) => {
                                        const color =
                                            item.avg_rating >= 7
                                                ? "bg-green-500"
                                                : item.avg_rating >= 4
                                                    ? "bg-yellow-500"
                                                    : "bg-red-500";
                                        return (
                                            <tr
                                                key={i}
                                                className={`border-t cursor-pointer ${selectedActivity === item.activity_name
                                                    ? "bg-blue-50"
                                                    : "hover:bg-gray-100"
                                                    }`}
                                                onClick={() =>
                                                    setSelectedActivity(item.activity_name)
                                                }
                                            >
                                                <td className="p-2">{item.activity_name}</td>
                                                <td className="p-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded h-4">
                                                            <div
                                                                className={`${color} h-4 rounded`}
                                                                style={{
                                                                    width: `${(item.avg_rating / 10) * 100}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="font-semibold w-8">
                                                            {item.avg_rating}
                                                        </span>
                                                        {item.trend === "up" && (
                                                            <span className="text-green-600">▲</span>
                                                        )}
                                                        {item.trend === "down" && (
                                                            <span className="text-red-600">▼</span>
                                                        )}
                                                        {item.trend === "same" && (
                                                            <span className="text-gray-500">●</span>
                                                        )}
                                                        {item.trend === "new" && (
                                                            <span className="text-blue-500">★</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    {item.sessions}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Weekly chart */}
                            {selectedActivity && (
                                <div>
                                    <h3 className="text-md font-bold mb-2">
                                        Weekly Progress – {selectedActivity}
                                    </h3>

                                    {loadingWeekly ? (
                                        <p>Loading chart...</p>
                                    ) : weeklyData.length === 0 ? (
                                        <p className="text-gray-500 italic">No weekly data available.</p>
                                    ) : (
                                        <>
                                            {/* Average only */}
                                            <div className="mb-1 text-sm">
                                                <span className="font-semibold">
                                                    Average:{" "}
                                                    {(
                                                        weeklyData.reduce((sum, w) => sum + Number(w.week_avg || 0), 0) /
                                                        weeklyData.length
                                                    ).toFixed(1)}
                                                </span>
                                            </div>

                                            {/* Start → Current + trend + friendly fluctuation note */}
                                            {(() => {
                                                const {
                                                    first, last, delta, pct,
                                                    trendLabel, trendClass, fluctuated
                                                } = computeStartCurrentTrend(weeklyData);

                                                return (
                                                    <div className="mb-3 text-sm text-gray-700">
                                                        Term start:{" "}
                                                        <span className="font-semibold">
                                                            {first.toFixed(1)}
                                                        </span>{" "}
                                                        → Current:{" "}
                                                        <span className="font-semibold">
                                                            {last.toFixed(1)}
                                                        </span>{" "}
                                                        ({delta >= 0 ? "+" : ""}{delta.toFixed(1)})
                                                        {" – "}
                                                        <span className={trendClass}>{trendLabel}</span>
                                                        {fluctuated && (
                                                            <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">
                                                                Fluctuated during the term
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Chart (unchanged) */}
                                            <div className="mx-auto" style={{ height: "300px", maxWidth: "900px" }}>
                                                <Line
                                                    data={{
                                                        labels: weeklyData.map((w) =>
                                                            new Date(w.week_start).toLocaleDateString("en-GB", {
                                                                day: "numeric",
                                                                month: "short",
                                                                year: "numeric"
                                                            })
                                                        ),
                                                        datasets: [
                                                            {
                                                                label: "Average Rating",
                                                                data: weeklyData.map((w) => w.week_avg),
                                                                fill: false,
                                                                borderColor: "#3b82f6",
                                                                backgroundColor: "#3b82f6",
                                                                tension: 0.3,
                                                                pointRadius: 4,
                                                                hitRadius: 12,
                                                                hoverRadius: 6,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        maintainAspectRatio: false,
                                                        plugins: {
                                                            legend: { display: false },
                                                            tooltip: {
                                                                bodyFont: { size: 13 },
                                                                titleFont: { size: 13, weight: "600" },
                                                                callbacks: {
                                                                    label: (ctx) => ` ${ctx.parsed.y}/10`,
                                                                },
                                                            },
                                                        },
                                                        scales: {
                                                            y: { min: 0, max: 10, ticks: { stepSize: 1 } },
                                                            x: { ticks: { maxRotation: 0 } },
                                                        },
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* BADGES TAB */}
            {activeSubTab === "badges" && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <h2 className="text-lg font-bold mb-6">Badges Earned</h2>

                    {loadingBadges ? (
                        <p>Loading badges...</p>
                    ) : !badgesData || Object.keys(badgesData).length === 0 ? (
                        <p className="text-gray-500 italic">No badges earned this term.</p>
                    ) : (
                        Object.entries(badgesData).map(([activityName, badges]) => (
                            <div key={activityName} className="mb-6">
                                <h3 className="text-md font-semibold mb-3 text-gray-800">{activityName}</h3>
                                <div className="flex gap-4 flex-wrap">
                                    {badges.map((badge, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-3 px-5 py-3 rounded-full shadow-md text-white font-semibold text-base transition-transform hover:scale-105"
                                            style={{ backgroundColor: badge.color }}
                                        >
                                            <span>{badge.name}</span>
                                            <span className="bg-white text-gray-800 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-sm">
                                                {badge.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* LOGS TAB */}
            {activeSubTab === "logs" && (
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    {/* Dynamic category chips */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { setSelectedCategory(""); setCurrentPage(1); }}
                                className={`px-3 py-1 rounded-full text-sm border transition
            ${selectedCategory === "" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                            >
                                All
                            </button>

                            {tagCategories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => { setSelectedCategory(cat === selectedCategory ? "" : cat); setCurrentPage(1); }}
                                    className={`px-3 py-1 rounded-full text-sm border transition flex items-center gap-2
              ${selectedCategory === cat ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                                >
                                    <span
                                        className="inline-block w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: categoryColor[cat] || "#6B7280" }}
                                    />
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Date presets */}
                        <div className="ml-auto flex gap-2">
                            {["This week", "This month", "This term"].map(p => (
                                <button
                                    key={p}
                                    onClick={() => { setDatePreset(p); setCurrentPage(1); }}
                                    className={`px-3 py-1 rounded border text-sm transition
              ${datePreset === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Find in comments…"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="border rounded px-3 py-2 text-sm w-full sm:w-80"
                        />
                    </div>

                    <h2 className="text-lg font-bold mb-3">{friendlyHeader(selectedCategory)}</h2>

                    {loadingLogs ? (
                        <p>Loading logs...</p>
                    ) : (() => {
                        const filtered = (logsData || []).filter(log => {
                            const byDate = withinPreset(log.date, datePreset);
                            const byCategory = !selectedCategory
                                ? true
                                : (log.tags || []).some(t => t.category === selectedCategory);
                            const byText = searchTerm
                                ? (log.comment || "").toLowerCase().includes(searchTerm.toLowerCase())
                                : true;
                            return byDate && byCategory && byText;
                        });

                        if (filtered.length === 0) {
                            return <p className="text-gray-600 italic">{emptyMessage(selectedCategory, datePreset)}</p>;
                        }

                        const indexOfLast = currentPage * logsPerPage;
                        const indexOfFirst = indexOfLast - logsPerPage;
                        const page = filtered.slice(indexOfFirst, indexOfLast);
                        const totalPages = Math.ceil(filtered.length / logsPerPage);

                        return (
                            <>
                                <table className="w-full border text-sm">
                                    <thead>
                                        <tr className="bg-gray-200 text-left">
                                            <th className="p-2 w-6"></th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Activity</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Tags</th>
                                            <th className="p-2">Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {page.map((log, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2 align-top">
                                                    <span
                                                        className="inline-block w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: colorForLogDot(log, selectedCategory) }}
                                                        title="Tag color"
                                                    />
                                                </td>
                                                <td className="p-2 align-top">
                                                    {new Date(log.date).toLocaleDateString("en-GB", {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                                <td className="p-2 align-top">{log.activity_name}</td>
                                                <td className="p-2 align-top">{log.type}</td>
                                                <td className="p-2 align-top space-x-1">
                                                    {(log.tags || []).map((t, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 rounded-full text-xs text-white"
                                                            style={{ backgroundColor: t.color || "#6B7280" }}
                                                            title={t.category ? `${t.name} • ${t.category}` : t.name}
                                                        >
                                                            {t.name}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className="p-2">{log.comment || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Pagination */}
                                <div className="flex items-center justify-between mt-4 text-sm">
                                    <div className="text-gray-600">
                                        Showing {indexOfFirst + 1}-{Math.min(indexOfLast, filtered.length)} of {filtered.length}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        >
                                            Prev
                                        </button>
                                        <span className="px-2 py-1">{currentPage} / {totalPages}</span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

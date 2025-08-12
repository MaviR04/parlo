import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import dayjs from "dayjs";
import BadgeDistributionPie from "../components/BadgeDistributionPie";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const colorHexMap = {
    blue: { fill: "#bfdbfe", border: "#2563eb" },
    green: { fill: "#bbf7d0", border: "#16a34a" },
    gold: { fill: "#fef08a", border: "#ca8a04" },
    red: { fill: "#fecaca", border: "#dc2626" },
    orange: { fill: "#fed7aa", border: "#ea580c" },
    purple: { fill: "#e9d5ff", border: "#9333ea" },
    pink: { fill: "#fbcfe8", border: "#db2777" },
    teal: { fill: "#99f6e4", border: "#0d9488" },
    indigo: { fill: "#c7d2fe", border: "#4f46e5" },
    gray: { fill: "#e5e7eb", border: "#4b5563" },
    brown: { fill: "#d4d4d4", border: "#525252" },
};
const getColors = (name) => colorHexMap[name] || { fill: "#e5e7eb", border: "#4b5563" };
const fmtWeekLabel = (dateStr) => `Week of ${dayjs(dateStr).format("MMM D")}`;

function BadgeTrendsBar({ tags, logs, weeks, selectedTagIds }) {
    const labels = weeks.map((wk) => fmtWeekLabel(wk));
    const counts = useMemo(() => {
        const map = new Map();
        const allowed = new Set(weeks);
        for (const l of logs || []) {
            const wk = l.week_start && dayjs(l.week_start).format("YYYY-MM-DD");
            if (!wk || !allowed.has(wk)) continue;
            for (const tid of Array.isArray(l.tagids) ? l.tagids : []) {
                const k = `${wk}|${tid}`;
                map.set(k, (map.get(k) || 0) + 1);
            }
        }
        return map;
    }, [logs, weeks]);

    const activeTagIds = useMemo(() => {
        if (selectedTagIds?.size > 0) return Array.from(selectedTagIds);
        const set = new Set();
        for (const [key] of counts) set.add(Number(key.split("|")[1]));
        return Array.from(set);
    }, [counts, selectedTagIds]);

    const datasets = activeTagIds
        .map((tid) => {
            const tag = tags.find((t) => t.tagid === tid);
            const { fill, border } = getColors(tag?.color);
            const data = weeks.map((wk) => counts.get(`${wk}|${tid}`) || 0);
            return {
                label: tag?.name || `Tag ${tid}`,
                data,
                backgroundColor: fill,
                borderColor: border,
                borderWidth: 2,
                stack: "stack1",
            };
        })
        .sort((a, b) => b.data.reduce((x, y) => x + y, 0) - a.data.reduce((x, y) => x + y, 0));

    const data = { labels, datasets };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" },
            tooltip: {
                displayColors: true,
                callbacks: {
                    title: (items) => (items[0] ? labels[items[0].dataIndex] : ""),
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                },
            },
        },
        scales: {
            x: { stacked: true, ticks: { maxRotation: 0, minRotation: 0 } },
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: { stepSize: 1, precision: 0, callback: (v) => `${v}` },
            },
        },
    };

    return (
        <div className="w-full" style={{ height: 320 }}>
            {datasets.length ? (
                <Bar data={data} options={options} />
            ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm border rounded">
                    No badge activity for the selected range/tags.
                </div>
            )}
        </div>
    );
}

export default function CoachBadgeDistributionPage() {
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [tags, setTags] = useState([]);
    const [logs, setLogs] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [showAllWeeks, setShowAllWeeks] = useState(false);
    const [selectedTagIds, setSelectedTagIds] = useState(new Set());
    const [sortBy, setSortBy] = useState("total");

    const [weekScope, setWeekScope] = useState("multiple");
    const [selectedWeek, setSelectedWeek] = useState("");

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        (async () => {
            try {
                const [aRes, tRes] = await Promise.all([
                    api.get("/coach/activities"),
                    api.get("/coach/activity-tags"),
                ]);
                setActivities(aRes.data || []);
                setTags(tRes.data || []);
            } catch {
                alert("Failed to load data");
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedActivity) return;
        (async () => {
            try {
                const res = await api.get(`/coach/activity/${selectedActivity.activityid}/logs`);
                const normalized = (res.data || []).map((l) => ({
                    ...l,
                    week_start: l.week_start ? dayjs(l.week_start).format("YYYY-MM-DD") : null,
                    tagids: Array.isArray(l.tagids) ? l.tagids : [],
                }));
                setLogs(normalized);
                setSelectedTagIds(new Set());
                setWeekScope("multiple");
                setSelectedWeek("");
                setPage(1);
            } catch {
                alert("Failed to fetch logs");
            }
        })();
    }, [selectedActivity]);

    const allWeeksDesc = useMemo(() => {
        const s = new Set(logs.filter((l) => l.week_start).map((l) => l.week_start));
        return Array.from(s).sort((a, b) => dayjs(b) - dayjs(a));
    }, [logs]);

    const latestWeek = allWeeksDesc[0] || "";
    const weeksToShow = useMemo(() => {
        if (weekScope === "latest" && latestWeek) return [latestWeek];
        if (weekScope === "single" && selectedWeek) return [selectedWeek];
        const arr = showAllWeeks ? allWeeksDesc : allWeeksDesc.slice(0, 12);
        return [...arr].reverse();
    }, [allWeeksDesc, showAllWeeks, weekScope, selectedWeek, latestWeek]);

    const recipients = useMemo(() => {
        const acc = new Map();
        const allowedWeeks = new Set(weeksToShow);

        for (const l of logs) {
            if (!allowedWeeks.has(l.week_start)) continue;
            const tagids = Array.isArray(l.tagids) ? l.tagids : [];
            const active = selectedTagIds.size ? tagids.filter((t) => selectedTagIds.has(t)) : tagids;
            if (!active.length && selectedTagIds.size) continue;

            if (!acc.has(l.childid)) {
                acc.set(l.childid, {
                    childid: l.childid,
                    fname: l.fname || "",
                    lname: l.lname || "",
                    total: 0,
                    perTag: new Map(),
                });
            }
            const row = acc.get(l.childid);
            for (const tid of active) {
                row.total += 1;
                row.perTag.set(tid, (row.perTag.get(tid) || 0) + 1);
            }
        }

        let rows = Array.from(acc.values());
        const q = (searchTerm || "").toLowerCase();
        if (q) rows = rows.filter((r) => `${r.fname} ${r.lname}`.toLowerCase().includes(q));

        if (sortBy === "total") {
            rows.sort(
                (a, b) =>
                    b.total - a.total ||
                    `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`)
            );
        } else {
            rows.sort((a, b) =>
                `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`)
            );
        }

        return rows;
    }, [logs, weeksToShow, selectedTagIds, searchTerm, sortBy]);

    useEffect(() => {
        setPage(1);
    }, [weeksToShow, selectedTagIds, searchTerm, sortBy, pageSize]);

    const total = recipients.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageClamped = Math.min(Math.max(page, 1), totalPages);
    const startIdx = (pageClamped - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const paginated = recipients.slice(startIdx, endIdx);

    const toggleTag = (tagid) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev);
            next.has(tagid) ? next.delete(tagid) : next.add(tagid);
            return next;
        });
    };
    const clearTags = () => setSelectedTagIds(new Set());

    return (
        <div className="max-w-[1300px] mx-auto px-4 py-6 space-y-6 text-gray-900">
            {/* Title */}
         
            {/* Activity Selector */}
            <div className="bg-white rounded-xl shadow p-4 space-y-4">
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    🏅 Badge Distribution
                </h1>
                {selectedActivity && (
                    <span className="text-gray-500 text-sm">
                        {selectedActivity.name}
                        {selectedActivity.agegroup && ` (${selectedActivity.agegroup})`}
                    </span>
                )}
                <label className="block font-semibold">Select Activity</label>
                <select
                    className="w-full border px-3 py-2 rounded-lg shadow-sm"
                    onChange={(e) => {
                        const found = activities.find(
                            (a) => String(a.activityid) === e.target.value
                        );
                        setSelectedActivity(found || null);
                    }}
                    value={selectedActivity?.activityid || ""}
                >
                    <option value="">-- Choose Activity --</option>
                    {activities.map((a) => (
                        <option key={a.activityid} value={a.activityid}>
                            {a.name} ({a.agegroup})
                        </option>
                    ))}
                </select>
            </div>

            {selectedActivity && (
                <>
                    {/* Filters */}
                    <div className="bg-white rounded-xl shadow p-4 space-y-4">
                        <div className="flex flex-col md:flex-row gap-3 justify-between">
                            <div className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="text"
                                    placeholder="🔍 Search students..."
                                    className="border px-3 py-2 rounded-lg w-full md:w-80 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <select
                                    className="border px-3 py-2 rounded-lg shadow-sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="total">Sort: Total badges</option>
                                    <option value="name">Sort: Name (A–Z)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-sm font-medium">Scope:</label>
                                <select
                                    className="border px-2 py-1.5 rounded shadow-sm"
                                    value={weekScope}
                                    onChange={(e) => setWeekScope(e.target.value)}
                                >
                                    <option value="latest">Latest week</option>
                                    <option value="single">Specific week…</option>
                                    <option value="multiple">Multiple weeks</option>
                                </select>

                                {weekScope === "single" && (
                                    <select
                                        className="border px-2 py-1.5 rounded shadow-sm"
                                        value={selectedWeek}
                                        onChange={(e) => setSelectedWeek(e.target.value)}
                                    >
                                        <option value="">-- choose week --</option>
                                        {allWeeksDesc.map((wk) => (
                                            <option key={wk} value={wk}>{wk}</option>
                                        ))}
                                    </select>
                                )}
                                {weekScope === "multiple" && (
                                    <label className="inline-flex items-center gap-2 ml-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={showAllWeeks}
                                            onChange={(e) => setShowAllWeeks(e.target.checked)}
                                        />
                                        Show all weeks
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Charts & Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-semibold">Distribution</h2>
                                {selectedTagIds.size > 0 && (
                                    <button
                                        onClick={clearTags}
                                        className="text-xs px-2 py-1 rounded border hover:bg-gray-100"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                            <BadgeDistributionPie
                                tags={tags}
                                logs={logs}
                                weeks={weeksToShow}
                                selectedTagIds={selectedTagIds}
                                onToggleTag={toggleTag}
                                onSliceClick={toggleTag}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Click a slice or chip to filter recipients by that badge.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl shadow flex flex-col p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-semibold">Recipients</h2>
                                <div className="flex items-center gap-2 text-sm">
                                    <span>Rows per page:</span>
                                    <select
                                        className="border rounded px-2 py-1 shadow-sm"
                                        value={pageSize}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                    >
                                        {[10, 20, 50, 100].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="overflow-auto grow">
                                <table className="w-full text-sm border rounded">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 border">Student</th>
                                            <th className="px-3 py-2 border">Total</th>
                                            <th className="px-3 py-2 border">By badge</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((r) => (
                                            <tr key={r.childid} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 border">
                                                    {r.fname} {r.lname}
                                                </td>
                                                <td className="px-3 py-2 border">{r.total || 0}</td>
                                                <td className="px-3 py-2 border">
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.from(r.perTag.entries())
                                                            .sort((a, b) => b[1] - a[1])
                                                            .map(([tid, count]) => {
                                                                const t = tags.find((x) => x.tagid === tid);
                                                                const { fill, border } = getColors(t?.color);
                                                                return (
                                                                    <button
                                                                        key={tid}
                                                                        onClick={() => toggleTag(tid)}
                                                                        className="px-2 py-1 text-xs rounded border"
                                                                        style={{
                                                                            backgroundColor: fill,
                                                                            borderColor: border,
                                                                            color: "#111827",
                                                                        }}
                                                                        title={`${t?.name || tid}: ${count}`}
                                                                    >
                                                                        {t?.name || tid} × {count}
                                                                    </button>
                                                                );
                                                            })}
                                                        {r.perTag.size === 0 && (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {paginated.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-3 py-6 text-center text-gray-500"
                                                >
                                                    No recipients match your filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between mt-3 text-sm">
                                <div className="text-gray-600">
                                    {total === 0
                                        ? "Showing 0 of 0"
                                        : `Showing ${startIdx + 1}–${endIdx} of ${total}`}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="px-3 py-1 border rounded disabled:opacity-50"
                                        onClick={() => setPage((p) => p - 1)}
                                        disabled={pageClamped <= 1}
                                    >
                                        Prev
                                    </button>
                                    <span>
                                        Page {pageClamped} / {totalPages}
                                    </span>
                                    <button
                                        className="px-3 py-1 border rounded disabled:opacity-50"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={pageClamped >= totalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trends */}
                    <div className="bg-white rounded-xl shadow p-4">
                        <h2 className="font-semibold mb-2">Trends by week</h2>
                        <BadgeTrendsBar
                            tags={tags}
                            logs={logs}
                            weeks={weeksToShow}
                            selectedTagIds={selectedTagIds}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import dayjs from "dayjs";
import StudentHistoryChart from "../components/StudentHistoryChart";

// ---------- helpers ----------
const toLocalNoon = (input) => {
    if (!input) return null;
    const d = new Date(input); // ISO '...Z' or 'YYYY-MM-DD'
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
};

const fmtDay = (d) =>
    new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);

const fmtShortRange = (start, end) =>
    `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start)}–${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(end)}`;

const colorForRating = (r) => {
    if (r == null || Number.isNaN(r)) return "#f3f4f6"; // gray-100
    const n = Number(r);
    if (n >= 8) return "#10b981"; // emerald-500
    if (n >= 6) return "#34d399"; // emerald-400
    if (n === 5) return "#f59e0b"; // amber-500
    if (n >= 3) return "#f97316"; // orange-500
    return "#ef4444";             // red-500
};

const RATING_BUCKETS = [
    { key: "8-9", label: "8–10", test: (r) => Number.isFinite(r) && r >= 8 },
    { key: "6-7", label: "6–7", test: (r) => Number.isFinite(r) && r >= 6 && r <= 7 },
    { key: "5", label: "5", test: (r) => Number.isFinite(r) && r === 5 },
    { key: "3-4", label: "3–4", test: (r) => Number.isFinite(r) && r >= 3 && r <= 4 },
    { key: "1-2", label: "1–2", test: (r) => Number.isFinite(r) && r >= 1 && r <= 2 },
    { key: "none", label: "no entry", test: (r) => !(Number.isFinite(r)) },
];

export default function CoachHistoryPage() {
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);

    const [logs, setLogs] = useState([]);
    const [tags, setTags] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [showAllWeeks, setShowAllWeeks] = useState(false);

    const [activeBucket, setActiveBucket] = useState(null); // legend filter
    const [issuesOnly, setIssuesOnly] = useState(false);     // ≤ 4 filter

    const [sortBy, setSortBy] = useState("name"); // "name" | "latest" | "average"

    // Drawer (smaller + scrollable)
    const [openDrawer, setOpenDrawer] = useState(false);
    const [drawerStudent, setDrawerStudent] = useState(null); // { childid, fname, lname }
    const [drawerWeek, setDrawerWeek] = useState(null);       // "YYYY-MM-DD" or null

    // ---------- initial loads ----------
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

    // ---------- load logs per activity ----------
    useEffect(() => {
        if (!selectedActivity) return;
        (async () => {
            try {
                const res = await api.get(`/coach/activity/${selectedActivity.activityid}/logs`);
                const normalized = (res.data || []).map((l) => ({
                    ...l,
                    date: l.date ? toLocalNoon(l.date) : null,
                    week_start: l.week_start ? toLocalNoon(l.week_start) : null,
                    week_end: l.week_end
                        ? toLocalNoon(l.week_end)
                        : l.week_start
                            ? new Date(toLocalNoon(l.week_start).getTime() + 6 * 86400000)
                            : null,
                }));
                setLogs(normalized);
                setOpenDrawer(false);
                setDrawerStudent(null);
                setDrawerWeek(null);
                setActiveBucket(null);
            } catch {
                alert("Failed to fetch logs");
            }
        })();
    }, [selectedActivity]);

    // ---------- build students & weeks ----------
    const allStudentsRaw = useMemo(() => {
        const map = new Map();
        for (const l of logs) {
            if (!l.childid) continue;
            if (!map.has(l.childid)) {
                map.set(l.childid, { childid: l.childid, fname: l.fname || "", lname: l.lname || "" });
            }
        }
        return Array.from(map.values());
    }, [logs]);

    const allWeeksDesc = useMemo(() => {
        const set = new Set(
            logs
                .filter((l) => l.week_start)
                .map((l) => dayjs(l.week_start).format("YYYY-MM-DD"))
        );
        return Array.from(set).sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf());
    }, [logs]);

    const weeksToShow = useMemo(() => {
        const arr = showAllWeeks ? allWeeksDesc : allWeeksDesc.slice(0, 12);
        return [...arr].reverse(); // oldest → newest
    }, [allWeeksDesc, showAllWeeks]);

    // rating lookup per (student, week)
    const ratingByStudentWeek = useMemo(() => {
        const map = new Map(); // `${childid}|${week}` -> { rating, date, sample }
        for (const l of logs) {
            if (!l.childid || !l.week_start) continue;
            const wk = dayjs(l.week_start).format("YYYY-MM-DD");
            const key = `${l.childid}|${wk}`;
            const prev = map.get(key);
            // latest log wins; switch to avg if desired
            if (!prev || (l.date && prev.date && l.date > prev.date)) {
                map.set(key, {
                    rating: Number.isFinite(+l.rating) ? +l.rating : null,
                    date: l.date || l.week_start,
                    sample: l,
                });
            }
        }
        return map;
    }, [logs]);

    // student aggregates for sorting/filters
    const studentAgg = useMemo(() => {
        const m = new Map(); // childid -> { avg, latestRating }
        for (const s of allStudentsRaw) {
            const vals = logs.filter((l) => l.childid === s.childid && Number.isFinite(+l.rating));
            const avg = vals.length ? vals.reduce((a, b) => a + +b.rating, 0) / vals.length : null;

            // latest rating by (date || week_start)
            const latestLog = vals.sort((a, b) => (b.date || b.week_start) - (a.date || a.week_start))[0];
            const latestRating = latestLog ? +latestLog.rating : null;

            m.set(s.childid, { avg, latestRating });
        }
        return m;
    }, [logs, allStudentsRaw]);

    // search + issues only + sort
    const visibleStudents = useMemo(() => {
        const q = (searchTerm || "").toLowerCase();

        let arr = allStudentsRaw.filter((s) =>
            `${s.fname} ${s.lname}`.toLowerCase().includes(q)
        );

        if (issuesOnly) {
            // keep students who have at least one week with rating ≤ 4 in visible weeks
            arr = arr.filter((s) =>
                weeksToShow.some((wk) => {
                    const r = ratingByStudentWeek.get(`${s.childid}|${wk}`)?.rating;
                    return Number.isFinite(r) && r <= 4;
                })
            );
        }

        if (sortBy === "name") {
            arr.sort((a, b) => `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`));
        } else if (sortBy === "latest") {
            arr.sort((a, b) => {
                const A = studentAgg.get(a.childid)?.latestRating ?? -Infinity;
                const B = studentAgg.get(b.childid)?.latestRating ?? -Infinity;
                return (B - A) || `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`);
            });
        } else if (sortBy === "average") {
            arr.sort((a, b) => {
                const A = studentAgg.get(a.childid)?.avg ?? -Infinity;
                const B = studentAgg.get(b.childid)?.avg ?? -Infinity;
                return (B - A) || `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`);
            });
        }
        return arr;
    }, [allStudentsRaw, searchTerm, issuesOnly, sortBy, weeksToShow, ratingByStudentWeek, studentAgg]);

    // drawer open helper
    const openStudent = (student, wk /* may be null */) => {
        setDrawerStudent(student);
        setDrawerWeek(wk);
        setOpenDrawer(true);
    };

    // filter helpers
    const rowMatchesBucket = (childid) => {
        if (!activeBucket) return true;
        const tester = RATING_BUCKETS.find((b) => b.key === activeBucket)?.test;
        if (!tester) return true;
        return weeksToShow.some((wk) => {
            const cell = ratingByStudentWeek.get(`${childid}|${wk}`);
            const r = Number.isFinite(cell?.rating) ? cell.rating : NaN;
            return tester(r);
        });
    };

    return (
        <div className="max-w-[1300px] mx-auto px-4 py-6 space-y-6 text-gray-900">
            {/* Header */}
           

            {/* Activity Selector */}
            <div className="bg-white rounded-xl shadow p-4">
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    📚 Coach History
                </h1>
                {selectedActivity && (
                    <span className="text-gray-500 text-sm">
                        {selectedActivity.name}
                        {selectedActivity.agegroup && ` (${selectedActivity.agegroup})`}
                    </span>
                )}
                <label className="block font-semibold mb-1">Select Activity</label>
                <select
                    className="w-full border px-3 py-2 rounded-lg shadow-sm"
                    onChange={(e) => {
                        const found = activities.find(
                            (a) => String(a.activityid) === e.target.value
                        );
                        setSelectedActivity(found || null);
                        setLogs([]);
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
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            {/* Search & Sort */}
                            <div className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    className="border px-3 py-2 rounded-lg w-full md:w-80 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <select
                                    className="border px-3 py-2 rounded-lg shadow-sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    title="Sort students"
                                >
                                    <option value="name">Sort: Name (A–Z)</option>
                                    <option value="latest">Sort: Latest week</option>
                                    <option value="average">Sort: Average</option>
                                </select>
                            </div>

                            {/* Legend + Filters */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                    <span className="font-semibold mr-1">Range:</span>
                                    {RATING_BUCKETS.map((b) => {
                                        const pressed = activeBucket === b.key;
                                        const sample =
                                            b.key === "8-9" ? "#10b981" :
                                                b.key === "6-7" ? "#34d399" :
                                                    b.key === "5" ? "#f59e0b" :
                                                        b.key === "3-4" ? "#f97316" :
                                                            b.key === "1-2" ? "#ef4444" : "#f3f4f6";
                                        return (
                                            <button
                                                key={b.key}
                                                onClick={() =>
                                                    setActiveBucket(pressed ? null : b.key)
                                                }
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition ${pressed
                                                    ? "ring-2 ring-offset-1 ring-blue-500 font-semibold"
                                                    : "hover:bg-gray-100"
                                                    }`}
                                                title={`Filter: ${b.label}`}
                                            >
                                                <span
                                                    className="w-4 h-4 inline-block rounded border"
                                                    style={{ background: sample }}
                                                />
                                                {b.label}
                                            </button>
                                        );
                                    })}
                                    {activeBucket && (
                                        <button
                                            className="ml-1 text-xs px-2 py-1 rounded border hover:bg-gray-100"
                                            onClick={() => setActiveBucket(null)}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={issuesOnly}
                                        onChange={(e) => setIssuesOnly(e.target.checked)}
                                    />
                                    Issues only (≤ 4)
                                </label>

                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={showAllWeeks}
                                        onChange={(e) => setShowAllWeeks(e.target.checked)}
                                    />
                                    Show all weeks
                                </label>

                                <div className="text-xs text-gray-500">
                                    Showing {weeksToShow.length} week
                                    {weeksToShow.length !== 1 ? "s" : ""}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Heatmap */}
                    <div className="bg-white rounded-xl shadow overflow-auto" style={{ maxHeight: 560 }}>
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: `240px repeat(${weeksToShow.length}, 1fr)`,
                            }}
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold">
                                Student
                            </div>
                            {weeksToShow.map((wk) => {
                                const start = new Date(wk);
                                const end = new Date(start.getTime() + 6 * 86400000);
                                return (
                                    <div
                                        key={`h-${wk}`}
                                        className="sticky top-0 z-10 bg-white border-b border-l px-2 py-2 text-xs text-gray-600 text-center"
                                        title={`Week: ${fmtShortRange(start, end)}`}
                                    >
                                        {fmtShortRange(start, end)}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rows */}
                        <div>
                            {visibleStudents.map((s) => {
                                const rowVisible = rowMatchesBucket(s.childid);
                                return (
                                    <div
                                        key={s.childid}
                                        className="grid hover:bg-gray-50 transition"
                                        style={{
                                            gridTemplateColumns: `240px repeat(${weeksToShow.length}, 1fr)`,
                                        }}
                                    >
                                        {/* Student Name */}
                                        <button
                                            className="text-left px-3 py-2 border-t font-medium truncate"
                                            onClick={() => openStudent(s, null)}
                                            title={`${s.fname} ${s.lname}`}
                                            style={{ opacity: rowVisible ? 1 : 0.4 }}
                                        >
                                            {s.fname} {s.lname}
                                        </button>

                                        {/* Week Ratings */}
                                        {weeksToShow.map((wk) => {
                                            const key = `${s.childid}|${wk}`;
                                            const cell = ratingByStudentWeek.get(key);
                                            const rating = Number.isFinite(cell?.rating)
                                                ? cell.rating
                                                : null;
                                            const bg = colorForRating(rating);
                                            const matches =
                                                !activeBucket ||
                                                RATING_BUCKETS.find((b) => b.key === activeBucket)?.test(
                                                    rating != null ? rating : NaN
                                                );
                                            const title =
                                                rating != null
                                                    ? `${s.fname} ${s.lname}\nWeek: ${wk}\nRating: ${rating}`
                                                    : `${s.fname} ${s.lname}\nWeek: ${wk}\nNo entry`;

                                            return (
                                                <button
                                                    key={key}
                                                    className="border-t border-l h-9 flex items-center justify-center text-sm transition-opacity"
                                                    style={{
                                                        background: bg,
                                                        color:
                                                            rating != null ? "#0b1a13" : "#6b7280",
                                                        fontWeight: rating >= 8 ? 700 : 500,
                                                        opacity: matches ? 1 : 0.25,
                                                    }}
                                                    title={title}
                                                    onClick={() => openStudent(s, wk)}
                                                >
                                                    {rating != null ? rating : "—"}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {visibleStudents.length === 0 && (
                                <div className="p-6 text-center text-gray-500">
                                    No students match your search/filters.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Drawer */}
                    {openDrawer && drawerStudent && (
                        <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl border-l z-50 flex flex-col">
                            <div className="p-3 border-b flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="font-semibold truncate">
                                        {drawerStudent.fname} {drawerStudent.lname}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                        {selectedActivity?.name}{" "}
                                        {selectedActivity?.agegroup
                                            ? `(${selectedActivity.agegroup})`
                                            : ""}
                                    </div>
                                </div>
                                <button
                                    className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300"
                                    onClick={() => setOpenDrawer(false)}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="p-3 overflow-auto" style={{ flex: 1 }}>
                                <StudentHistoryChart
                                    logs={logs.filter(
                                        (l) => l.childid === drawerStudent.childid
                                    )}
                                    selectedWeek={drawerWeek}
                                    colorizeByRating
                                    strictHover
                                />

                                {/* Stats */}
                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                    {(() => {
                                        const ls = logs.filter(
                                            (l) =>
                                                l.childid === drawerStudent.childid &&
                                                Number.isFinite(+l.rating)
                                        );
                                        const avg = ls.length
                                            ? (
                                                ls.reduce((a, b) => a + Number(b.rating), 0) /
                                                ls.length
                                            ).toFixed(1)
                                            : "—";
                                        const last = ls.length
                                            ? Number(
                                                ls.sort(
                                                    (a, b) =>
                                                        (b.date || b.week_start) -
                                                        (a.date || a.week_start)
                                                )[0].rating
                                            )
                                            : "—";
                                        const best = ls.length
                                            ? Math.max(...ls.map((x) => Number(x.rating)))
                                            : "—";
                                        return (
                                            <>
                                                <div className="p-3 border rounded-lg">
                                                    <div className="text-gray-500">Average</div>
                                                    <div className="text-lg font-semibold">{avg}</div>
                                                </div>
                                                <div className="p-3 border rounded-lg">
                                                    <div className="text-gray-500">Last rating</div>
                                                    <div className="text-lg font-semibold">{last}</div>
                                                </div>
                                                <div className="p-3 border rounded-lg">
                                                    <div className="text-gray-500">Best</div>
                                                    <div className="text-lg font-semibold">{best}</div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Notes */}
                                <div className="mt-4">
                                    <div className="font-semibold mb-2">Recent notes</div>
                                    <div className="space-y-2">
                                        {logs
                                            .filter(
                                                (l) => l.childid === drawerStudent.childid
                                            )
                                            .sort(
                                                (a, b) =>
                                                    (b.date || b.week_start) -
                                                    (a.date || a.week_start)
                                            )
                                            .slice(0, 6)
                                            .map((l) => (
                                                <div
                                                    key={l.id}
                                                    className="p-2 border rounded-lg text-sm"
                                                >
                                                    <div className="text-gray-500 mb-1">
                                                        {l.week_start
                                                            ? `Week of ${fmtDay(l.week_start)} – ${fmtDay(
                                                                l.week_end
                                                            )}`
                                                            : fmtDay(l.date || l.week_start)}{" "}
                                                        • {l.type}
                                                    </div>
                                                    <div>{l.comment || "—"}</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

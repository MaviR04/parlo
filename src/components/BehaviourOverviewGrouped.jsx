// src/pages/BehaviourOverview.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import TermSelector from "../components/TermSelector";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export default function BehaviourOverview() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);

    const [classTeacherClassIds, setClassTeacherClassIds] = useState(new Set());
    const isClassTeacherForSelected =
        selectedClass && classTeacherClassIds.has(selectedClass.classid);

    const [selectedTerm, setSelectedTerm] = useState(null);

    // Week dropdown
    const [availableWeeks, setAvailableWeeks] = useState([]); // ["YYYY-MM-DD", ...]
    const [selectedWeek, setSelectedWeek] = useState("");

    // Server scope for the table: all | class | subject (enforced backend-side by role)
    const [source, setSource] = useState("subject"); // safe default

    // Client filters (table + chart)
    const [searchTerm, setSearchTerm] = useState("");
    const [teacherFilter, setTeacherFilter] = useState("all");
    const [lockTeacherFilter, setLockTeacherFilter] = useState(false);
    const [subjectFilter, setSubjectFilter] = useState("all");
    const [ratingFilter, setRatingFilter] = useState("all");

    const [rowsRaw, setRowsRaw] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const [expanded, setExpanded] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Chart state
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);
    const [studentMetric, setStudentMetric] = useState("all"); // all | overall | focus | respect | self

    /* ---------------- date helpers ---------------- */
    const parseYMD = (ymd) => {
        const val = String(ymd).slice(0, 10);
        const [yy, mm, dd] = val.split("-");
        return new Date(Number(yy), Number(mm) - 1, Number(dd)); // local date, no TZ shift
    };
    const toYMD = (v) => {
        if (!v) return null;
        const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    };
    const ensureWeekKey = (row) => ({
        ...row,
        week_ymd: toYMD(row.week_ymd || row.week_start_date || row.week),
    });
    const fmtTick = (ymd, withYear = false) => {
        const s = toYMD(ymd);
        if (!s) return "";
        const [yy, mm, dd] = s.split("-");
        const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
        return `Week of ${d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            ...(withYear ? { year: "numeric" } : {}),
        })}`;
    };

    /* ---------------- boot: classes + class-teacher classes ---------------- */
    useEffect(() => {
        (async () => {
            try {
                const [myClassesRes, ctOnlyRes] = await Promise.all([
                    api.get("/teacher/classes/my-classes"),
                    api.get("/teacher/classes/class-teacher-only").catch(() => ({ data: [] })),
                ]);
                const list = myClassesRes.data || [];
                setClasses(list);
                if (list.length) setSelectedClass(list[0]);

                const ctSet = new Set((ctOnlyRes.data || []).map((c) => c.classid));
                setClassTeacherClassIds(ctSet);
            } catch {
                setErr("Failed to load classes");
            }
        })();
    }, []);

    /* ---------------- fetch available weeks for class+term ---------------- */
    useEffect(() => {
        if (!selectedClass || !selectedTerm) {
            setAvailableWeeks([]);
            setSelectedWeek("");
            return;
        }
        (async () => {
            try {
                const res = await api.get(
                    `/behaviour/available-weeks?class_id=${selectedClass.classid}&term_id=${selectedTerm.termid}`
                );
                const cleanWeeks = (res.data || []).map((w) => String(w).slice(0, 10));
                setAvailableWeeks(cleanWeeks);
                setSelectedWeek(cleanWeeks[0] || "");
            } catch {
                setAvailableWeeks([]);
                setSelectedWeek("");
            }
        })();
    }, [selectedClass, selectedTerm]);

    /* ---------------- adjust server source + filter locks by role ---------------- */
    useEffect(() => {
        if (!selectedClass) return;
        if (classTeacherClassIds.has(selectedClass.classid)) {
            setSource((prev) => (["all", "class", "subject"].includes(prev) ? prev : "all"));
            setLockTeacherFilter(false);
        } else {
            setSource("subject"); // subject teacher
            setLockTeacherFilter(true); // lock to themselves
        }
        setCurrentPage(1);
        setExpanded({});
        setSelectedStudent(null);
        setStudentMetric("all");
    }, [selectedClass, classTeacherClassIds]);

    /* ---------------- load overview rows for selected week ---------------- */
    useEffect(() => {
        if (!selectedClass || !selectedTerm || !selectedWeek) {
            setRowsRaw([]);
            return;
        }
        (async () => {
            setLoading(true);
            setErr("");
            try {
                const res = await api.get(
                    `/behaviour/overview-grouped?class_id=${selectedClass.classid}&term_id=${selectedTerm.termid}&source=${source}&week=${selectedWeek}`
                );
                const rows = res.data || [];
                setRowsRaw(rows);
                setCurrentPage(1);
                setExpanded({});

                // Subject teacher → lock teacher filter to themselves (only one name expected)
                if (!isClassTeacherForSelected) {
                    const teachers = new Set();
                    rows.forEach((r) => (r.entries || []).forEach((e) => teachers.add(e.teacher_name)));
                    const onlyTeacher = [...teachers][0];
                    if (onlyTeacher) setTeacherFilter(onlyTeacher);
                }
            } catch {
                setErr("Failed to load overview");
                setRowsRaw([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [selectedClass, selectedTerm, selectedWeek, source, isClassTeacherForSelected]);

    /* ---------------- teacher id from teacherFilter ---------------- */
    const selectedTeacherId = useMemo(() => {
        if (teacherFilter === "all") return null;
        for (const r of rowsRaw) {
            for (const e of r.entries || []) {
                if (e.teacher_name === teacherFilter) return e.teacher_id || null;
            }
        }
        return null;
    }, [teacherFilter, rowsRaw]);

    /* ---------------- derive class vs subject teachers (from rows) ---------------- */
    const teacherGroups = useMemo(() => {
        const classTeachers = new Set();
        const subjectTeachers = new Set();
        rowsRaw.forEach((r) =>
            (r.entries || []).forEach((e, idx) => {
                // Class Teacher if the subject/role contains "class teacher"
                const role = (e.subject_name || "").toLowerCase();
                if (role.includes("class teacher")) classTeachers.add(e.teacher_name);
                else subjectTeachers.add(e.teacher_name);
            })
        );
        return {
            classTeachers: Array.from(classTeachers),
            subjectTeachers: Array.from(subjectTeachers),
        };
    }, [rowsRaw]);

    /* ---------------- AUTO-SELECT filters when switching the top toggle ---------------- */
    useEffect(() => {
        if (!isClassTeacherForSelected) return; // subject teachers stay locked to themselves

        if (source === "all") {
            if (teacherFilter !== "all") setTeacherFilter("all");
            if (subjectFilter !== "all") setSubjectFilter("all");
            return;
        }

        if (source === "class") {
            const ct = teacherGroups.classTeachers[0] || teacherGroups.subjectTeachers[0] || "all";
            if (teacherFilter !== ct) setTeacherFilter(ct);
            if (subjectFilter !== "all") setSubjectFilter("all");
            return;
        }

        if (source === "subject") {
            const st = teacherGroups.subjectTeachers[0] || teacherGroups.classTeachers[0] || "all";
            if (teacherFilter !== st) setTeacherFilter(st);
            if (subjectFilter !== "all") setSubjectFilter("all");
        }
    }, [source, teacherGroups, isClassTeacherForSelected]); // runs again after rows load

    /* ---------------- chart data (respects teacher/subject) ---------------- */
    useEffect(() => {
        async function fetchChart() {
            if (!selectedClass || !selectedTerm) return;
            setChartLoading(true);
            try {
                if (selectedStudent) {
                    const params = new URLSearchParams({
                        student_id: String(selectedStudent.childid),
                        term_id: String(selectedTerm.termid),
                        class_id: String(selectedClass.classid),
                    });
                    if (isClassTeacherForSelected) {
                        if (selectedTeacherId) params.append("teacher_id", String(selectedTeacherId));
                        if (subjectFilter !== "all") params.append("subject", subjectFilter);
                    }
                    const res = await api.get(`/behaviour/student-trend?${params.toString()}`);
                    const processed = (res.data || [])
                        .map(ensureWeekKey)
                        .map((r) => ({ ...r, struggling: Number(r.overall_avg) < 2.0 }));
                    setChartData(processed);
                } else {
                    const params = new URLSearchParams({
                        class_id: String(selectedClass.classid),
                        term_id: String(selectedTerm.termid),
                    });
                    if (isClassTeacherForSelected) {
                        if (selectedTeacherId) params.append("teacher_id", String(selectedTeacherId));
                        if (subjectFilter !== "all") params.append("subject", subjectFilter);
                    }
                    const res = await api.get(`/behaviour/class-trend?${params.toString()}`);
                    setChartData((res.data || []).map(ensureWeekKey));
                }
            } finally {
                setChartLoading(false);
            }
        }
        fetchChart();
    }, [
        selectedClass,
        selectedTerm,
        selectedStudent,
        selectedTeacherId,
        subjectFilter,
        isClassTeacherForSelected,
    ]);

    /* ---------------- facets ---------------- */
    const allTeachers = useMemo(() => {
        const set = new Set();
        rowsRaw.forEach((r) => (r.entries || []).forEach((e) => set.add(e.teacher_name)));
        return Array.from(set).sort();
    }, [rowsRaw]);

    const allSubjects = useMemo(() => {
        const set = new Set();
        rowsRaw.forEach((r) =>
            (r.entries || []).forEach((e) => e.subject_name && set.add(e.subject_name))
        );
        return Array.from(set).sort();
    }, [rowsRaw]);

    /* ---------------- filter table rows (and recompute avgs over filtered) ---------------- */
    const filteredRows = useMemo(() => {
        let tmp = rowsRaw.filter((r) =>
            `${r.fname} ${r.lname}`.toLowerCase().includes(searchTerm.toLowerCase())
        );

        tmp = tmp
            .map((r) => {
                const entries = (r.entries || []).filter((e) => {
                    if (teacherFilter !== "all" && e.teacher_name !== teacherFilter) return false;
                    if (subjectFilter !== "all" && e.subject_name !== subjectFilter) return false;
                    return true;
                });
                if (entries.length === 0) return null;

                const sum = entries.reduce(
                    (acc, e) => {
                        acc.f += Number(e.focus_engagement || 0);
                        acc.r += Number(e.respect_kindness || 0);
                        acc.s += Number(e.self_management || 0);
                        return acc;
                    },
                    { f: 0, r: 0, s: 0 }
                );
                const raters = entries.length;
                const avg_focus_engagement = +(sum.f / raters).toFixed(2);
                const avg_respect_kindness = +(sum.r / raters).toFixed(2);
                const avg_self_management = +(sum.s / raters).toFixed(2);
                const overall_avg = +(
                    (avg_focus_engagement + avg_respect_kindness + avg_self_management) /
                    3
                ).toFixed(2);

                return {
                    ...r,
                    entries,
                    raters,
                    avg_focus_engagement,
                    avg_respect_kindness,
                    avg_self_management,
                    overall_avg,
                };
            })
            .filter(Boolean);

        if (ratingFilter === "overall_lt_2") {
            tmp = tmp.filter((r) => r.overall_avg < 2);
        } else if (ratingFilter === "any_le_2") {
            tmp = tmp.filter(
                (r) =>
                    r.avg_focus_engagement <= 2 ||
                    r.avg_respect_kindness <= 2 ||
                    r.avg_self_management <= 2
            );
        }

        tmp.sort((a, b) => {
            const nameCmp = `${a.lname} ${a.fname}`.localeCompare(`${b.lname} ${b.fname}`);
            if (nameCmp !== 0) return nameCmp;
            return a.overall_avg - b.overall_avg;
        });

        return tmp;
    }, [rowsRaw, searchTerm, teacherFilter, subjectFilter, ratingFilter]);

    /* ---------------- pagination ---------------- */
    const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
    const pageRows = filteredRows.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    /* ---------------- helpers ---------------- */
    const tone = (v) =>
        v == null
            ? "text-gray-400"
            : v < 2
                ? "text-red-600 font-semibold"
                : v < 2.5
                    ? "text-amber-600 font-medium"
                    : "text-emerald-700 font-semibold";

    const weekLabel = useMemo(() => {
        if (!selectedWeek) return "";
        const d = parseYMD(selectedWeek);
        return `Week of ${d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })}`;
    }, [selectedWeek]);

    const LegendChips = () => (
        <div className="flex flex-wrap gap-2 items-center mb-3">
            <span className="text-sm text-gray-600 mr-2">Show lines:</span>
            {[
                { key: "all", label: "All", dot: "bg-gray-200" },
                { key: "overall", label: "Overall Avg", dot: "bg-[#8884d8]" },
                { key: "focus", label: "Focus & Engagement", dot: "bg-[#82ca9d]" },
                { key: "respect", label: "Respect & Kindness", dot: "bg-[#ffc658]" },
                { key: "self", label: "Self-Management", dot: "bg-[#ff7300]" },
            ].map((opt) => {
                const active = studentMetric === opt.key;
                return (
                    <button
                        key={opt.key}
                        onClick={() => setStudentMetric(opt.key)}
                        className={`px-3 py-1 rounded-full text-sm border transition ${active ? "ring-2 ring-blue-400 font-semibold" : "opacity-85 hover:opacity-100"
                            }`}
                        style={{ borderColor: "#e5e7eb", backgroundColor: "white" }}
                    >
                        <span className={`inline-block w-3 h-3 rounded-full mr-2 align-middle ${opt.dot}`} />
                        <span className="align-middle">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="p-4 bg-white shadow rounded-lg">
            <h2 className="text-lg font-bold mb-2">Behaviour Overview</h2>
            <p className="text-sm text-gray-600 mb-4">
                <strong>Tip:</strong> Click a student’s <u>name</u> to switch the chart to their weekly trend.
                The chart follows the teacher/subject filters below (for class teachers).
            </p>

            {/* Top row: Term / Class / Week */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                    <label className="block font-medium mb-1 text-black">Term</label>
                    <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />
                </div>

                <div>
                    <label className="block font-medium mb-1 text-black">Class</label>
                    <select
                        value={selectedClass?.classid || ""}
                        onChange={(e) => {
                            const cls = classes.find((c) => c.classid === parseInt(e.target.value));
                            setSelectedClass(cls || null);
                            setCurrentPage(1);
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                    >
                        {classes.map((cls) => (
                            <option key={cls.classid} value={cls.classid}>
                                {cls.classname}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block font-medium mb-1 text-black">Week</label>
                    <select
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value.slice(0, 10))}
                        disabled={availableWeeks.length === 0}
                    >
                        {availableWeeks.length === 0 ? (
                            <option value="">No weeks yet</option>
                        ) : (
                            availableWeeks.map((w) => {
                                const val = String(w).slice(0, 10);
                                const d = parseYMD(val);
                                const label = `Week of ${d.toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                })}`;
                                return (
                                    <option key={val} value={val}>
                                        {label}
                                    </option>
                                );
                            })
                        )}
                    </select>
                    {weekLabel && <div className="text-xs text-gray-500 mt-1">{weekLabel}</div>}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center mb-3">
                {isClassTeacherForSelected ? (
                    <div className="inline-flex rounded overflow-hidden border">
                        {["all", "class", "subject"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setSource(s)}
                                className={`px-3 py-2 text-sm ${source === s ? "bg-blue-600 text-white" : "bg-white"
                                    }`}
                            >
                                {s === "all" ? "All ratings" : s === "class" ? "Class teacher" : "Subject teachers"}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 border text-gray-700">
                        Viewing: Subject-only
                    </span>
                )}

                <input
                    type="search"
                    placeholder="Search student…"
                    className="border rounded px-3 py-2"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                />

                {/* Teacher filter */}
                <select
                    value={teacherFilter}
                    onChange={(e) => {
                        setTeacherFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                    className={`border rounded px-2 py-2 text-sm ${lockTeacherFilter ? "opacity-70" : ""}`}
                    disabled={lockTeacherFilter}
                    title={lockTeacherFilter ? "Locked to your entries" : "Filter by teacher"}
                >
                    {lockTeacherFilter ? (
                        <option value={teacherFilter}>{teacherFilter || "You"}</option>
                    ) : (
                        <>
                            <option value="all">All teachers</option>
                            {allTeachers.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </>
                    )}
                </select>

                {/* Subject filter */}
                <select
                    value={subjectFilter}
                    onChange={(e) => {
                        setSubjectFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm"
                >
                    <option value="all">All subjects</option>
                    {allSubjects.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>

                {/* Rating filter */}
                <select
                    value={ratingFilter}
                    onChange={(e) => {
                        setRatingFilter(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm"
                >
                    <option value="all">All ratings</option>
                    <option value="overall_lt_2">Overall &lt; 2.0</option>
                    <option value="any_le_2">Any metric ≤ 2</option>
                </select>
            </div>

            {!selectedWeek && (
                <div className="p-3 mb-3 rounded bg-amber-50 border text-amber-800 text-sm">
                    Select a week from the dropdown to load entries.
                </div>
            )}

            {err && <div className="p-3 mb-3 rounded bg-red-50 border text-red-700">{err}</div>}
            {loading && <div className="p-3 mb-3 rounded border">Loading overview…</div>}

            {/* Table */}
            {!loading && selectedWeek && (
                <>
                    <table className="min-w-full border border-gray-200 text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-3 py-2 border text-left">Student</th>
                                <th className="px-3 py-2 border text-center">Focus &amp; Engagement</th>
                                <th className="px-3 py-2 border text-center">Respect &amp; Kindness</th>
                                <th className="px-3 py-2 border text-center">Self-Management</th>
                                <th className="px-3 py-2 border text-center">Overall Average</th>
                                <th className="px-3 py-2 border text-center">Raters</th>
                                <th className="px-3 py-2 border text-center">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.length === 0 ? (
                                <tr>
                                    <td className="px-3 py-6 border text-center text-gray-500" colSpan={7}>
                                        No entries for this filter.
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r) => (
                                    <tr key={`${r.childid}-${r.week_start_date}`}>
                                        {/* Student name toggles the chart */}
                                        <td className="px-3 py-2 border whitespace-nowrap">
                                            <button
                                                className={`underline decoration-dotted hover:decoration-solid ${selectedStudent?.childid === r.childid
                                                        ? "text-blue-700 font-semibold"
                                                        : "text-blue-600"
                                                    }`}
                                                onClick={() => {
                                                    setSelectedStudent(
                                                        selectedStudent?.childid === r.childid
                                                            ? null
                                                            : { childid: r.childid, fname: r.fname, lname: r.lname }
                                                    );
                                                    setStudentMetric("all");
                                                }}
                                                title="Click to view this student's weekly trend"
                                            >
                                                {r.fname} {r.lname}
                                            </button>
                                        </td>

                                        <td className={`px-3 py-2 border text-center ${tone(r.avg_focus_engagement)}`}>
                                            {r.avg_focus_engagement?.toFixed(2)}
                                        </td>
                                        <td className={`px-3 py-2 border text-center ${tone(r.avg_respect_kindness)}`}>
                                            {r.avg_respect_kindness?.toFixed(2)}
                                        </td>
                                        <td className={`px-3 py-2 border text-center ${tone(r.avg_self_management)}`}>
                                            {r.avg_self_management?.toFixed(2)}
                                        </td>
                                        <td className={`px-3 py-2 border text-center ${tone(r.overall_avg)}`}>
                                            {r.overall_avg?.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 border text-center">{r.raters}</td>
                                        <td className="px-3 py-2 border text-center">
                                            <button
                                                onClick={() =>
                                                    setExpanded((p) => ({ ...p, [r.childid]: !p[r.childid] }))
                                                }
                                                className="px-3 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700 text-xs"
                                            >
                                                {expanded[r.childid] ? "Hide" : `Show (${r.entries.length})`}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-3">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1 rounded border disabled:opacity-50"
                                disabled={currentPage === 1}
                            >
                                Prev
                            </button>
                            <span className="px-2 py-1">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1 rounded border disabled:opacity-50"
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    {/* Expanded rows: entries for the selected week only */}
                    <div className="mt-4 space-y-4">
                        {pageRows
                            .filter((r) => expanded[r.childid])
                            .map((r) => (
                                <div key={`exp-${r.childid}`} className="border rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">
                                        {r.fname} {r.lname} — {weekLabel}
                                    </div>
                                    <div className="p-3">
                                        <ul className="space-y-2">
                                            {r.entries.map((e, idx) => (
                                                <li key={`${r.childid}-${idx}`} className="border rounded p-2">
                                                    <div className="text-sm">
                                                        <span className="font-medium">Focus &amp; Engagement:</span> {e.focus_engagement}{" "}
                                                        <span className="font-medium"> • Respect &amp; Kindness:</span> {e.respect_kindness}{" "}
                                                        <span className="font-medium"> • Self-Management:</span> {e.self_management}{" "}
                                                        <span className="text-gray-500">
                                                            — {e.teacher_name} ({e.subject_name || "Subject"})
                                                        </span>
                                                    </div>
                                                    {e.weekly_note && (
                                                        <div className="mt-1 text-sm text-gray-700">
                                                            <span className="font-medium">Weekly Note:</span> {e.weekly_note}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                    </div>
                </>
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
                    <div className="p-3 mb-3 rounded border">Loading chart…</div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="week_ymd"
                                type="category"
                                allowDuplicatedCategory={false}
                                interval="preserveStartEnd"
                                minTickGap={0}
                                tickFormatter={(ymd) => fmtTick(ymd)}
                            />
                            <YAxis domain={[0, 3]} />
                            <Tooltip labelFormatter={(ymd) => fmtTick(ymd, true)} />
                            <Legend />

                            {/* Class view (single line) */}
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
                            {selectedStudent && (studentMetric === "all" || studentMetric === "overall") && (
                                <Line
                                    type="monotone"
                                    dataKey="overall_avg"
                                    stroke="#8884d8"
                                    name="Overall Avg"
                                    strokeWidth={2}
                                    dot={({ cx, cy, payload, index }) => {
                                        const key = `dot-${index}-${payload?.week_ymd || ""}`;
                                        if (payload?.struggling) {
                                            return (
                                                <circle
                                                    key={key}
                                                    cx={cx}
                                                    cy={cy}
                                                    r={6}
                                                    fill="red"
                                                    stroke="white"
                                                    strokeWidth={2}
                                                />
                                            );
                                        }
                                        return <circle key={key} cx={cx} cy={cy} r={3} fill="#8884d8" />;
                                    }}
                                />
                            )}
                            {selectedStudent && (studentMetric === "all" || studentMetric === "focus") && (
                                <Line
                                    type="monotone"
                                    dataKey="focus_engagement"
                                    stroke="#82ca9d"
                                    name="Focus & Engagement"
                                    dot={false}
                                    strokeWidth={2}
                                />
                            )}
                            {selectedStudent && (studentMetric === "all" || studentMetric === "respect") && (
                                <Line
                                    type="monotone"
                                    dataKey="respect_kindness"
                                    stroke="#ffc658"
                                    name="Respect & Kindness"
                                    dot={false}
                                    strokeWidth={2}
                                />
                            )}
                            {selectedStudent && (studentMetric === "all" || studentMetric === "self") && (
                                <Line
                                    type="monotone"
                                    dataKey="self_management"
                                    stroke="#ff7300"
                                    name="Self-Management"
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

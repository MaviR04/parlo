// src/components/BehaviourResults.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

/* ---------------- small utils ---------------- */
const asNum = (v) => (v == null ? null : typeof v === "number" ? v : Number(v));
const fmt = (v, digits = 2) => {
  const n = asNum(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};
const avg = (arr) => {
  const xs = arr.filter((n) => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

// robust local date from YYYY-MM-DD / ISO
const parseYMD = (ymd) => {
  const s = String(ymd || "").slice(0, 10);
  const [yy, mm, dd] = s.split("-");
  const y = Number(yy),
    m = Number(mm),
    d = Number(dd);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
};

/* ---------------- modal ---------------- */
function NotesModal({ open, onClose, week }) {
  if (!open || !week) return null;
  const title = week.date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[min(680px,92vw)] max-h-[80vh] overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h4 className="font-semibold">Notes — Week of {title}</h4>
          <button onClick={onClose} className="px-3 py-1 rounded border">
            Close
          </button>
        </div>
        <div className="p-4 overflow-auto">
          {week.entries?.length ? (
            <ul className="space-y-3">
              {week.entries.map((e, i) => (
                <li
                  key={`${week.ymd}-${e.teacher_id || i}-${e.subject_name || "x"}`}
                  className="border rounded-lg p-3"
                >
                  <div className="text-sm">
                    <span className="font-medium">{e.teacher_name}</span>{" "}
                    <span className="text-gray-600">
                      ({e.subject_name || "Subject"})
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 mt-0.5">
                    Focus: {fmt(e.focus, 0)} • Respect: {fmt(e.respect, 0)} •
                    Self: {fmt(e.self, 0)}
                  </div>
                  {e.weekly_note && (
                    <div className="text-sm mt-2">
                      <span className="font-medium">Weekly note:</span>{" "}
                      {e.weekly_note}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">No notes for this week.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */
export default function BehaviourResults({ childId, termId }) {
  const [series, setSeries] = useState([]); // backend weekly_scores (already averaged per week)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // scope filters (parents can see all/class/subject and pick a subject)
  const [source, setSource] = useState("all"); // all | class | subject
  const [subject, setSubject] = useState("all"); // subject/role string

  // metric + time window
  const [metric, setMetric] = useState("overall"); // overall | focus | respect | self
  const [filterType, setFilterType] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // table pagination + modal
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [page, setPage] = useState(1);
  const [notesWeek, setNotesWeek] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);

  /* -------- fetch series (honour scope filters) -------- */
  useEffect(() => {
    if (!childId || !termId) return;
    setLoading(true);
    setErr("");
    const params = new URLSearchParams({ source });
    if (subject !== "all") params.append("subject", subject);

    api
      .get(`/p-behaviour/${childId}/${termId}/series?${params.toString()}`)
      .then((res) => setSeries(res.data?.weekly_scores || []))
      .catch(() => setErr("Failed to load behaviour data"))
      .finally(() => setLoading(false));
  }, [childId, termId, source, subject]);

  /* -------- shape weeks for UI -------- */
  const weeks = useMemo(() => {
    return (series || []).map((w) => {
      const ymd = (w.week_ymd || w.week || "").slice(0, 10);
      const date = parseYMD(ymd);
      return {
        ymd,
        date,
        focus: asNum(w.focus),
        respect: asNum(w.respect),
        self: asNum(w.self),
        // prefer server weekly overall if present; otherwise compute
        overall: Number.isFinite(asNum(w.overall))
          ? asNum(w.overall)
          : avg([asNum(w.focus), asNum(w.respect), asNum(w.self)]),
        raters: w.raters ?? null,
        // [{teacher_id, teacher_name, subject_name, focus,respect,self, weekly_note}]
        entries: Array.isArray(w.entries) ? w.entries : [],
      };
    });
  }, [series]);

  /* -------- collect subjects for the dropdown -------- */
  const allSubjects = useMemo(() => {
    const set = new Set();
    (weeks || []).forEach((w) =>
      (w.entries || []).forEach((e) => e.subject_name && set.add(e.subject_name))
    );
    return Array.from(set).sort();
  }, [weeks]);

  /* -------- apply time-window filter -------- */
  const filteredWeeks = useMemo(() => {
    let list = weeks;
    if (filterType === "last6") {
      list = weeks.slice(-6);
    } else if (filterType === "3months") {
      const t0 = new Date();
      t0.setMonth(t0.getMonth() - 3);
      list = weeks.filter((w) => w.date >= t0);
    } else if (filterType === "custom" && customStart && customEnd) {
      const s = parseYMD(customStart);
      const e = parseYMD(customEnd);
      list = weeks.filter((w) => w.date >= s && w.date <= e);
    }
    return list;
  }, [weeks, filterType, customStart, customEnd]);

  /* -------- cards: compute from filteredWeeks so they match table -------- */
  const cardAverages = useMemo(() => {
    const f = avg(filteredWeeks.map((w) => w.focus));
    const r = avg(filteredWeeks.map((w) => w.respect));
    const s = avg(filteredWeeks.map((w) => w.self));
    const o = avg(
      filteredWeeks.map((w) =>
        Number.isFinite(w.overall) ? w.overall : avg([w.focus, w.respect, w.self])
      )
    );
    return { overall: o, focus: f, respect: r, self: s };
  }, [filteredWeeks]);

  /* -------- chart -------- */
  const chartData = useMemo(() => {
    const labels = filteredWeeks.map((w) =>
      w.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    );
    const metricVals =
      metric === "focus"
        ? filteredWeeks.map((w) => w.focus)
        : metric === "respect"
        ? filteredWeeks.map((w) => w.respect)
        : metric === "self"
        ? filteredWeeks.map((w) => w.self)
        : filteredWeeks.map((w) => w.overall);

    const labelSuffix =
      source === "all"
        ? " (All ratings)"
        : source === "class"
        ? " (Class teacher)"
        : " (Subject teachers)";

    const labelPrefix =
      metric === "focus"
        ? "Focus & Engagement"
        : metric === "respect"
        ? "Respect & Kindness"
        : metric === "self"
        ? "Self-Management"
        : "Overall";

    const color =
      metric === "focus"
        ? "green"
        : metric === "respect"
        ? "orange"
        : metric === "self"
        ? "purple"
        : "blue";

    return {
      labels,
      datasets: [
        {
          label: labelPrefix + labelSuffix,
          data: metricVals,
          fill: false,
          borderColor: color,
          backgroundColor: color,
          tension: 0.2,
        },
      ],
    };
  }, [filteredWeeks, metric, source]);

  /* -------- pagination over filteredWeeks -------- */
  const totalPages = Math.max(1, Math.ceil(filteredWeeks.length / rowsPerPage));
  const pageWeeks = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredWeeks.slice(start, start + rowsPerPage);
  }, [filteredWeeks, page, rowsPerPage]);

  useEffect(() => {
    // reset to first page when filters change
    setPage(1);
  }, [rowsPerPage, filterType, customStart, customEnd, source, subject]);

  /* -------- render -------- */
  if (loading) return <p>Loading behaviour insights…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!weeks.length) return <p>No behaviour records found for this term.</p>;

  return (
    <div className="bg-white rounded-2xl shadow p-4 text-gray-900">
      {/* Scope filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="inline-flex rounded overflow-hidden border">
          {["all", "class", "subject"].map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1 text-sm ${
                source === s ? "bg-blue-600 text-white" : "bg-gray-50"
              }`}
              title={
                s === "all"
                  ? "Show class teacher + all subject teachers"
                  : s === "class"
                  ? "Only the class teacher’s ratings"
                  : "Only subject teachers’ ratings"
              }
            >
              {s === "all" ? "All ratings" : s === "class" ? "Class teacher" : "Subject teachers"}
            </button>
          ))}
        </div>

        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
          title="Filter to a specific subject/role"
        >
          <option value="all">All subjects</option>
          {allSubjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="all">All weeks</option>
            <option value="last6">Last 6 weeks</option>
            <option value="3months">Last 3 months</option>
            <option value="custom">Custom range</option>
          </select>
          {filterType === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border rounded px-2 py-1"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </>
          )}
        </div>
      </div>

      {/* Cards (computed from the same rows you’re viewing) */}
      <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-4 mb-4">
        <StatCard label="Overall Avg (1-3)" value={fmt(cardAverages.overall)} color="text-blue-600" />
        <StatCard label="Focus & Engagement" value={fmt(cardAverages.focus)} color="text-green-600" />
        <StatCard label="Respect & Kindness" value={fmt(cardAverages.respect)} color="text-orange-600" />
        <StatCard label="Self-Management" value={fmt(cardAverages.self)} color="text-purple-600" />
      </div>

      {/* Metric toggle */}
      <div className="flex gap-2 mb-4">
        {["overall", "focus", "respect", "self"].map((key) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={`px-3 py-1 rounded border ${
              metric === key ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {key === "overall"
              ? "Overall"
              : key === "focus"
              ? "Focus & Engagement"
              : key === "respect"
              ? "Respect & Kindness"
              : "Self-Management"}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="my-6" style={{ height: 280 }}>
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { y: { min: 1, max: 3, ticks: { stepSize: 0.5 } } },
          }}
        />
      </div>

      {/* Table + pagination + notes modal */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-bold">Weekly Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[8, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Week Starting</th>
              <th className={`p-2 text-center ${metric === "focus" ? "bg-blue-100" : ""}`}>Focus</th>
              <th className={`p-2 text-center ${metric === "respect" ? "bg-blue-100" : ""}`}>Respect</th>
              <th className={`p-2 text-center ${metric === "self" ? "bg-blue-100" : ""}`}>Self</th>
              <th className={`p-2 text-center ${metric === "overall" ? "bg-blue-100" : ""}`}>Overall</th>
              <th className="p-2 text-center">Raters</th>
              <th className="p-2 text-center">Notes</th>
            </tr>
          </thead>
          <tbody>
            {pageWeeks.map((w, i) => (
              <tr key={w.ymd || i} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">
                  {w.date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className={`p-2 text-center ${metric === "focus" ? "bg-blue-50 font-semibold" : ""}`}>
                  {fmt(w.focus, 2)}
                </td>
                <td className={`p-2 text-center ${metric === "respect" ? "bg-blue-50 font-semibold" : ""}`}>
                  {fmt(w.respect, 2)}
                </td>
                <td className={`p-2 text-center ${metric === "self" ? "bg-blue-50 font-semibold" : ""}`}>
                  {fmt(w.self, 2)}
                </td>
                <td className={`p-2 text-center font-semibold ${metric === "overall" ? "bg-blue-50" : ""}`}>
                  {fmt(w.overall, 2)}
                </td>
                <td className="p-2 text-center">{w.raters ?? "—"}</td>
                <td className="p-2 text-center">
                  <button
                    onClick={() => {
                      setNotesWeek(w);
                      setNotesOpen(true);
                    }}
                    className="px-3 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700 text-xs"
                    title="View weekly notes by teacher"
                  >
                    View {w.entries?.length ? `(${w.entries.length})` : ""}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border disabled:opacity-50"
              disabled={page === 1}
            >
              Prev
            </button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border disabled:opacity-50"
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <NotesModal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        week={notesWeek}
      />
    </div>
  );
}

/* ---------------- small presentational card ---------------- */
function StatCard({ label, value, color }) {
  return (
    <div className="p-4 rounded-lg border shadow-sm bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}

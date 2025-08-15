import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const asNum = (v) => (v == null ? null : typeof v === "number" ? v : Number(v));
const fmt = (v, digits = 2) => {
  const n = asNum(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

// safer local date from YYYY-MM-DD
const parseYMD = (ymd) => {
  const s = String(ymd).slice(0, 10);
  const [yy, mm, dd] = s.split("-");
  return new Date(Number(yy), Number(mm) - 1, Number(dd));
};

function StatCard({ label, value, color }) {
  return (
    <div className="p-4 rounded-lg border shadow-sm bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}

export default function BehaviourResults({ childId, termId }) {
  const [series, setSeries] = useState([]);   // backend weekly_scores (already averaged per week)
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // metric + week window
  const [metric, setMetric] = useState("overall"); // overall | focus | respect | self
  const [filterType, setFilterType] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // NEW: scope filters for parents (mirror teacher view)
  const [source, setSource] = useState("all"); // all | class | subject
  const [subject, setSubject] = useState("all"); // subject name string (role), "all" = no filter

  // Load series + summary, honoring filters
  useEffect(() => {
    if (!childId || !termId) return;
    setLoading(true);
    setErr("");
    const params = new URLSearchParams({
      source, // all | class | subject
    });
    if (subject !== "all") params.append("subject", subject);

    Promise.all([
      api.get(`/p-behaviour/${childId}/${termId}/series?` + params.toString()),
      api.get(`/p-behaviour/${childId}/${termId}/summary?` + params.toString()),
    ])
      .then(([s, sum]) => {
        setSeries(s.data?.weekly_scores || []);
        setSummary(sum.data || {});
      })
      .catch(() => setErr("Failed to load behaviour data"))
      .finally(() => setLoading(false));
  }, [childId, termId, source, subject]);

  // Build weeks array for chart/table
  const weeks = useMemo(() => {
    return (series || []).map((w) => {
      const d = parseYMD(w.week_ymd || w.week); // support both
      return {
        ymd: (w.week_ymd || w.week)?.slice(0, 10),
        date: d,
        focus: asNum(w.focus),
        respect: asNum(w.respect),
        self: asNum(w.self),
        overall: asNum(w.overall),
        raters: w.raters ?? null,
        // entries: [{teacher_id, teacher_name, subject_name, focus,respect,self, weekly_note}]
        entries: Array.isArray(w.entries) ? w.entries : [],
      };
    });
  }, [series]);

  // Collect subjects for the dropdown from entries
  const allSubjects = useMemo(() => {
    const set = new Set();
    (weeks || []).forEach((w) =>
      (w.entries || []).forEach((e) => e.subject_name && set.add(e.subject_name))
    );
    return Array.from(set).sort();
  }, [weeks]);

  // Metric selections
  const metricMap = {
    overall: { label: "Overall", color: "blue", values: weeks.map((w) => w.overall) },
    focus: { label: "Focus & Engagement", color: "green", values: weeks.map((w) => w.focus) },
    respect: { label: "Respect & Kindness", color: "orange", values: weeks.map((w) => w.respect) },
    self: { label: "Self-Management", color: "purple", values: weeks.map((w) => w.self) },
  };
  const active = metricMap[metric];

  // Time window filter
  const filteredWeeks = useMemo(() => {
    let list = weeks;
    if (filterType === "last6") list = weeks.slice(-6);
    else if (filterType === "3months") {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      list = weeks.filter((w) => w.date >= threeMonthsAgo);
    } else if (filterType === "custom" && customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      list = weeks.filter((w) => w.date >= start && w.date <= end);
    }
    return list;
  }, [weeks, filterType, customStart, customEnd]);

  const chartData = useMemo(() => {
    return {
      labels: filteredWeeks.map((w) =>
        w.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      ),
      datasets: [
        {
          label: active.label + (source === "all" ? " (All ratings)" : source === "class" ? " (Class teacher)" : " (Subject teachers)"),
          data: filteredWeeks.map((w) => active.values[weeks.indexOf(w)]),
          fill: false,
          borderColor: active.color,
          backgroundColor: active.color,
          tension: 0.2,
        },
      ],
    };
  }, [filteredWeeks, active, weeks, source]);

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

      {/* Stat Cards Row */}
      {summary && (
        <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-4 mb-4">
          <StatCard label="Overall Avg (1-3)" value={fmt(summary.overall_avg)} color="text-blue-600" />
          <StatCard label="Focus & Engagement" value={fmt(summary.focus_avg)} color="text-green-600" />
          <StatCard label="Respect & Kindness" value={fmt(summary.respect_avg)} color="text-orange-600" />
          <StatCard label="Self-Management" value={fmt(summary.self_avg)} color="text-purple-600" />
        </div>
      )}

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
            scales: {
              y: { min: 1, max: 3, ticks: { stepSize: 0.5 } },
            },
          }}
        />
      </div>

      {/* Table */}
      <h3 className="text-md font-bold mb-2">Weekly Breakdown</h3>
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
              <th className="p-2">Notes (by teacher & subject)</th>
            </tr>
          </thead>
          <tbody>
            {filteredWeeks.map((w, i) => (
              <tr key={w.ymd || i} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">
                  {w.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className={`p-2 text-center ${metric === "focus" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.focus, 2)}</td>
                <td className={`p-2 text-center ${metric === "respect" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.respect, 2)}</td>
                <td className={`p-2 text-center ${metric === "self" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.self, 2)}</td>
                <td className={`p-2 text-center font-semibold ${metric === "overall" ? "bg-blue-50" : ""}`}>{fmt(w.overall, 2)}</td>
                <td className="p-2 text-center">{w.raters ?? "—"}</td>
                <td className="p-2">
                  {w.entries.length === 0 ? (
                    <span className="text-gray-500">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {w.entries.map((e, idx) => (
                        <li key={`${w.ymd}-${e.teacher_id || idx}-${e.subject_name || "x"}`} className="border rounded p-2">
                          <div className="text-sm">
                            <span className="font-medium">{e.teacher_name}</span>{" "}
                            <span className="text-gray-600">({e.subject_name || "Subject"})</span>
                          </div>
                          <div className="text-xs text-gray-700">
                            Focus: {fmt(e.focus, 0)} • Respect: {fmt(e.respect, 0)} • Self: {fmt(e.self, 0)}
                          </div>
                          {e.weekly_note && (
                            <div className="text-sm mt-1">
                              <span className="font-medium">Note:</span> {e.weekly_note}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// src/components/BehaviourResults.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const asNum = (v) => (v == null ? null : typeof v === "number" ? v : Number(v));
const fmt = (v, digits = 2) => {
  const n = asNum(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
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
  const [series, setSeries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [metric, setMetric] = useState("overall");
  const [filterType, setFilterType] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (!childId || !termId) return;
    setLoading(true);
    setErr("");
    Promise.all([
      api.get(`/p-behaviour/${childId}/${termId}/series`),
      api.get(`/p-behaviour/${childId}/${termId}/summary`),
    ])
      .then(([s, sum]) => {
        setSeries(s.data?.weekly_scores || []);
        setSummary(sum.data || {});
      })
      .catch(() => setErr("Failed to load behaviour data"))
      .finally(() => setLoading(false));
  }, [childId, termId]);

  const weeks = useMemo(() => {
    return series.map((w) => ({
      date: new Date(w.week),
      focus: asNum(w.focus),
      respect: asNum(w.respect),
      self: asNum(w.self),
      overall: Number.isFinite(asNum(w.focus) + asNum(w.respect) + asNum(w.self))
        ? (asNum(w.focus) + asNum(w.respect) + asNum(w.self)) / 3
        : null,
      note: w.note || "",
    }));
  }, [series]);

  const metricMap = {
    overall: { label: "Overall", color: "blue", values: weeks.map((w) => w.overall) },
    focus: { label: "Focus & Engagement", color: "green", values: weeks.map((w) => w.focus) },
    respect: { label: "Respect & Kindness", color: "orange", values: weeks.map((w) => w.respect) },
    self: { label: "Self-Management", color: "purple", values: weeks.map((w) => w.self) },
  };
  const active = metricMap[metric];

  const filteredWeeks = useMemo(() => {
    if (filterType === "last6") return weeks.slice(-6);
    if (filterType === "3months") {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return weeks.filter((w) => w.date >= threeMonthsAgo);
    }
    if (filterType === "custom" && customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      return weeks.filter((w) => w.date >= start && w.date <= end);
    }
    return weeks;
  }, [weeks, filterType, customStart, customEnd]);

  const chartData = useMemo(() => {
    return {
      labels: weeks.map((w) => w.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })),
      datasets: [
        {
          label: active.label,
          data: active.values,
          fill: false,
          borderColor: active.color,
          backgroundColor: active.color,
          tension: 0.2,
        },
      ],
    };
  }, [weeks, active]);

  if (loading) return <p>Loading behaviour insights…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!weeks.length) return <p>No behaviour records found for this term.</p>;

  return (
    <div className="bg-white rounded-2xl shadow p-4 text-gray-900">
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
        {Object.keys(metricMap).map((key) => (
          <button
            key={key}
            onClick={() => setMetric(key)}
            className={`px-3 py-1 rounded border ${metric === key ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
          >
            {metricMap[key].label}
          </button>
        ))}
      </div>

      {/* Week filter */}
      <div className="flex gap-3 mb-4 flex-wrap">
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
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border rounded px-2 py-1" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border rounded px-2 py-1" />
          </>
        )}
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
              <th className="p-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {filteredWeeks.map((w, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 whitespace-nowrap">
                  {w.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className={`p-2 text-center ${metric === "focus" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.focus, 0)}</td>
                <td className={`p-2 text-center ${metric === "respect" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.respect, 0)}</td>
                <td className={`p-2 text-center ${metric === "self" ? "bg-blue-50 font-semibold" : ""}`}>{fmt(w.self, 0)}</td>
                <td className={`p-2 text-center font-semibold ${metric === "overall" ? "bg-blue-50" : ""}`}>{fmt(w.overall)}</td>
                <td className="p-2">{w.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

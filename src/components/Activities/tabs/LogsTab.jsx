import { useMemo, useState } from "react";
import useLogs from "../hooks/useLogs";
import TagChips from "../ui/tagChips";
import DatePresets from "../ui/DatePresets";
import Pagination from "../ui/Pagination";
import LogCard from "../ui/LogCard";

const logsPerPage = 10;

const headerFor = (cat) => {
  if (!cat) return "All Activity Logs";
  const map = {
    Achievement: "Highlights (Achievement)",
    Encouragement: "Needs Attention (Encouragement)",
    Attitude: "Behaviour Notes",
    Discipline: "Attendance Notes",
  };
  return map[cat] ||` ${cat} Notes`;
};

const emptyMsg = (cat, preset) => {
  if (!cat) return `No logs ${preset.toLowerCase()}.`;
  const map = {
    Encouragement: `No Concerns ${preset.toLowerCase()} 🎉`,
    Discipline: `No Attendance issues ${preset.toLowerCase()} ✅`,
  };
  return map[cat] || `No ${cat} notes ${preset.toLowerCase()}.`;
};

const colorFor = (log, selectedCat) => {
  if (!log?.tags?.length) return "#9CA3AF";
  if (selectedCat) {
    const hit = log.tags.find(t => t.category === selectedCat);
    return hit?.color || "#9CA3AF";
  }
  return log.tags[0].color || "#9CA3AF";
};

export default function LogsTab({ childId, termId }) {
  const [preset, setPreset] = useState("This term");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const { loading, tagCategories, categoryColor, pageItems, total, totalPages } =
    useLogs(childId, termId, { preset, search, category, page, perPage: logsPerPage });

  // “from–to” display
  const from = useMemo(() => (total === 0 ? 0 : (page - 1) * logsPerPage + 1), [page, total]);
  const to   = useMemo(() => Math.min(page * logsPerPage, total), [page, total]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TagChips
          categories={tagCategories}
          colorMap={categoryColor}
          selected={category}
          onSelect={(c) => { setCategory(c); setPage(1); }}
        />
        <DatePresets value={preset} onChange={(p) => { setPreset(p); setPage(1); }} />
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Find in comments…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-80"
        />
      </div>

      <h2 className="text-lg font-bold mb-3">{headerFor(category)}</h2>

      {loading ? (
        <p>Loading logs…</p>
      ) : total === 0 ? (
        <p className="text-gray-600 italic">{emptyMsg(category, preset)}</p>
      ) : (
        <>
          {/* CARD GRID */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((log, i) => (
              <LogCard key={i} log={log} accent={colorFor(log, category)} />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            from={from}
            to={to}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}
import { useMemo } from "react";
import useInsights from "./hooks/useInsight";
import TopicProgress from "./ui/TopicProgress";
import Attempts from "./ui/Attempt";

/**
 * Props:
 *  - childId: string|number
 *  - termId:  string|number
 *
 * API contract expected from GET /academics/topics/:childId/:termId:
 * {
 *   overall: { strong: number, on_track: number, needs_support: number },
 *   subjects: [
 *     {
 *       subject: "Mathematics",
 *       counts: { strong: n, on_track: n, needs_support: n },
 *       strong: [{ topic, avg_pct, attempts, last_date }],
 *       on_track: [...],
 *       needs_support: [...]
 *     },
 *     ...
 *   ]
 * }
 */
export default function InsightsTab({ childId, termId, enabled = true }) {
  const {
    topics,
    activeSubject,
    setActiveSubject,
    activeSubjectData,
    loading,
    error,
  } = useInsights(childId, termId, enabled);

  const headerStats = useMemo(() => {
    const o = topics?.overall;
    if (!o) return null;
    return [
      { key: "Strong", value: o.strong },
      { key: "On Track", value: o.on_track },
      { key: "Needs Support", value: o.needs_support },
    ];
  }, [topics]);

  const toneStyles = {
    green: {
      dot: "bg-green-500",
      head: "text-green-700",
      border: "border-green-100",
      cardBg: "bg-green-50",
      cardBorder: "border-green-100",
    },
    amber: {
      dot: "bg-amber-500",
      head: "text-amber-700",
      border: "border-amber-100",
      cardBg: "bg-amber-50",
      cardBorder: "border-amber-100",
    },
    red: {
      dot: "bg-red-500",
      head: "text-red-700",
      border: "border-red-100",
      cardBg: "bg-red-50",
      cardBorder: "border-red-100",
    },
  };

  function Bucket({ title, tone, items = [], emptyText }) {
    const s = toneStyles[tone];
    return (
      <div className={`rounded-xl border ${s.border}`}>
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
          <div className={`text-sm font-semibold ${s.head}`}>{title}</div>
        </div>
        <div className="p-3 space-y-2">
          {items.length ? (
            items.map((t, i) => (
              <div
                key={`${title}-${i}`}
                className={`p-3 rounded-lg ${s.cardBg} border ${s.cardBorder}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">
                    {t.topic}
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {t.avg_pct}%
                  </div>
                </div>
                <div className="mt-2">
                  <TopicProgress pct={t.avg_pct} />
                </div>
                <div className="mt-1">
                  <Attempts last_date={t.last_date} attempts={t.attempts} />
                </div>
                {tone === "amber" && (
                  <div className="text-[11px] text-amber-700 mt-2">
                    Keep going—steady practice here should lift results.
                  </div>
                )}
                {tone === "red" && (
                  <div className="text-[11px] text-red-700 mt-2">
                    Parent tip: 10–15 mins focused practice + teacher support helps most.
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-400 px-1">{emptyText}</div>
          )}
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-4">Loading insights…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-black">Insights — Assessment Performance by Subject</h2>
        {!!headerStats && (
          <div className="text-xs text-gray-600">
            {headerStats.map((s, i) => (
              <span key={s.key} className={i < headerStats.length - 1 ? "mr-3" : ""}>
                {s.key}: {s.value}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4 font-bold">
        Strong ≥ 75% · On Track 60–74% · Needs Support &lt; 60%.
      </p>

      {/* Subject chips */}
      <div className="-mx-1 overflow-x-auto mb-4">
        <div className="flex gap-2 px-1 pb-1">
          {(topics?.subjects || []).map((s) => {
            const isActive = s.subject === activeSubject;
            return (
              <button
                key={s.subject}
                onClick={() => setActiveSubject(s.subject)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-sm border transition
                  ${isActive ? "bg-blue-600 text-white border-blue-600"
                             : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200"}`}
                title={`${s.subject} • Strong ${s.counts.strong} · On Track ${s.counts.on_track} · Needs ${s.counts.needs_support}`}
              >
                {s.subject}
                <span className="ml-2 text-[11px] opacity-80">
                  ({s.counts.strong}/{s.counts.on_track}/{s.counts.needs_support})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected subject content */}
      {!activeSubjectData ? (
        <div className="text-sm text-gray-500">Select a subject to view topics.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{activeSubjectData.subject}</h3>
            <div className="text-[11px] text-gray-600">
              <span className="mr-3">Strong: {activeSubjectData.counts.strong}</span>
              <span className="mr-3">On Track: {activeSubjectData.counts.on_track}</span>
              <span>Needs Support: {activeSubjectData.counts.needs_support}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Bucket
              title="Strong (≥ 75%)"
              tone="green"
              items={activeSubjectData.strong}
              emptyText="No topics here yet."
            />
            <Bucket
              title="On Track (60–74%)"
              tone="amber"
              items={activeSubjectData.on_track}
              emptyText="No topics here yet."
            />
            <Bucket
              title="Needs Support (< 60%)"
              tone="red"
              items={activeSubjectData.needs_support}
              emptyText="No topics here yet."
            />
          </div>
        </div>
      )}
    </div>
  );
}
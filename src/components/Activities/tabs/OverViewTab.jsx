import { Pie } from "react-chartjs-2";
import "chart.js/auto";
import useOverview from "../hooks/useOverview";

export default function OverviewTab({ childId, termId }) {
  const { data, loading, err } = useOverview(childId, termId, true);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-6">
      <h2 className="text-lg font-bold">Key Highlights</h2>

      {loading && <p>Loading...</p>}
      {err && <p className="text-red-600">{err}</p>}

      {!!data?.insights?.length && (
        <div className="space-y-2">
          {data.insights.map((ins, i) => {
            const a = ins.activity_name || ins.activity || ins.activityName || "";
            const isAlert = ins.type === "alert";
            const base = "p-2 rounded font-semibold text-sm flex flex-wrap items-center gap-2";
            const cls = isAlert ? `${base} bg-red-100 text-red-700` : `${base} bg-green-100 text-green-700`;
            return (
              <div key={i} className={cls}>
                {a && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/80 text-gray-800">
                    <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
                    {a}
                  </span>
                )}
                <span className="whitespace-pre-wrap">{ins.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {!!data?.category_breakdown?.length && (
        <>
          <h2 className="text-lg font-bold">Participation by Category</h2>
          <div className="max-w-sm">
            <Pie
              data={{
                labels: data.category_breakdown.map(c => c.category),
                datasets: [{ data: data.category_breakdown.map(c => c.count), backgroundColor: ["#3b82f6","#f59e0b","#10b981","#ef4444"] }],
              }}
              options={{ plugins: { legend: { labels: { color: "#111827" } } } }}
            />
          </div>
        </>
      )}
    </div>
  );
}
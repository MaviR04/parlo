import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import useProgress from "../hooks/useProgress";
import { computeStartCurrentTrend } from "../utils/trends";

export default function ProgressTab({ childId, termId }) {
  const [selected, setSelected] = useState(null);
  const { list, weekly, loadingList, loadingWeekly } = useProgress(childId, termId, selected, true);

  // pick first activity when list loads
  useEffect(() => { if (!selected && list?.length) setSelected(list[0].activity_name); }, [list, selected]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <h2 className="text-lg font-bold mb-4">Activity Progress</h2>

      {loadingList ? <p>Loading…</p> :
        !list?.length ? <p className="text-gray-500 italic">No ratings available for this term.</p> :
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
              {list.map((item, i) => {
                const color = item.avg_rating >= 7 ? "bg-green-500" : item.avg_rating >= 4 ? "bg-yellow-500" : "bg-red-500";
                return (
                  <tr key={i}
                    className={`border-t cursor-pointer ${selected === item.activity_name ? "bg-blue-50" : "hover:bg-gray-100"}`}
                    onClick={() => setSelected(item.activity_name)}>
                    <td className="p-2">{item.activity_name}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded h-4">
                          <div className={`${color} h-4 rounded`} style={{ width: `${(item.avg_rating / 10) * 100}%` }} />
                        </div>
                        <span className="font-semibold w-8">{item.avg_rating}</span>
                        {item.trend === "up" && <span className="text-green-600">▲</span>}
                        {item.trend === "down" && <span className="text-red-600">▼</span>}
                        {item.trend === "same" && <span className="text-gray-500">●</span>}
                        {item.trend === "new" && <span className="text-blue-500">★</span>}
                      </div>
                    </td>
                    <td className="p-2 text-center">{item.sessions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selected && (
            <div>
              <h3 className="text-md font-bold mb-2">Weekly Progress – {selected}</h3>
              {loadingWeekly ? <p>Loading chart…</p> :
                !weekly?.length ? <p className="text-gray-500 italic">No weekly data available.</p> :
                <>
                  <div className="mb-1 text-sm">
                    <span className="font-semibold">
                      Average: {(weekly.reduce((s, w) => s + Number(w.week_avg || 0), 0) / weekly.length).toFixed(1)}
                    </span>
                  </div>
                  {(() => {
                    const { first, last, delta, trendLabel, trendClass, fluctuated } = computeStartCurrentTrend(weekly);
                    return (
                      <div className="mb-3 text-sm text-gray-700">
                        Term start: <span className="font-semibold">{first.toFixed(1)}</span> → Current:
                        <span className="font-semibold"> {last.toFixed(1)}</span> ({delta >= 0 ? "+" : ""}{delta.toFixed(1)})
                        {" – "}<span className={trendClass}>{trendLabel}</span>
                        {fluctuated && <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">Fluctuated during the term</span>}
                      </div>
                    );
                  })()}
                  <div className="mx-auto" style={{ height: 300, maxWidth: 900 }}>
                    <Line
                      data={{
                        labels: weekly.map(w => new Date(w.week_start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })),
                        datasets: [{ label: "Average Rating", data: weekly.map(w => w.week_avg), fill: false, borderColor: "#3b82f6", backgroundColor: "#3b82f6", tension: 0.3, pointRadius: 4, hitRadius: 12, hoverRadius: 6 }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { min: 0, max: 10, ticks: { stepSize: 1 } },
                            x: { ticks: { maxRotation: 0 } }
                        }
                        }}

                    />
                  </div>
                </>
              }
            </div>
          )}
        </>
      }
    </div>
  );
}
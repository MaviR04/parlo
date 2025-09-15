import { useState, useEffect } from "react";
import api from "../axios";
import { Line, Bar } from "react-chartjs-2";
import "chart.js/auto";
import annotationPlugin from "chartjs-plugin-annotation";

import { Chart as ChartJS } from "chart.js";
ChartJS.register(annotationPlugin);


const TopicProgress = ({ pct }) => (
  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
    <div
      className="h-2 rounded-full"
      style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        background: "linear-gradient(90deg, #93c5fd, #3b82f6)",
      }}
    />
  </div>
);

const Attempts = ({ last_date, attempts }) => (
  <div className="text-xs text-gray-500">
    Last: {new Date(last_date).toLocaleDateString("en-GB")}
    {" • "}
    {attempts} {attempts === 1 ? "assessment" : "assessments"}
  </div>
);


export default function AcademicsTab({ childId, termId }) {
  const subTabs = ["overview", "subject", "class position", "insights"];
  const [activeSubTab, setActiveSubTab] = useState("overview");

  const [overview, setOverview] = useState(null);
  const [drillSubject, setDrillSubject] = useState(null);
  const [subjectList, setSubjectList] = useState([]);
  const [subjectData, setSubjectData] = useState(null);
  const [classPosition, setClassPosition] = useState(null);
  const [topics, setTopics] = useState(null);
  const [showFullView, setShowFullView] = useState(false);
  
const [activeTopicSubject, setActiveTopicSubject] = useState(null);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Comment modal state
  const [commentModal, setCommentModal] = useState({
    open: false,
    text: "",
    meta: null, // { date, subject, name, label, pct, score, max }
  });

  const openComment = (row, fallbackSubject) => {
    setCommentModal({
      open: true,
      text: row?.comment || "No comment for this assessment.",
      meta: {
        date: row?.date
          ? new Date(row.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : undefined,
        subject: row?.subject || fallbackSubject || undefined,
        name: row?.name,
        label: row?.assessment_label,
        pct: row?.pct,
        score:
          row?.score !== undefined && row?.max !== undefined
            ? `${row.score}/${row.max}`
            : row?.score !== undefined && row?.max_score !== undefined
            ? `${row.score}/${row.max_score}`
            : undefined,
      },
    });
  };

  const closeComment = () =>
    setCommentModal({ open: false, text: "", meta: null });

  // Fetch overview
  useEffect(() => {
    if (activeSubTab === "overview") {
      setLoading(true);
      api
        .get(`/academics/overview/${childId}/${termId}`)
        .then((res) => {
          setOverview(res.data);
          setSubjectList(res.data.subjects.map((s) => s.subject));
          setError(null);
        })
        .catch(() => setError("Failed to load overview"))
        .finally(() => setLoading(false));
    }
  }, [activeSubTab, childId, termId]);

  // Fetch subject drilldown
  useEffect(() => {
    if (activeSubTab === "subject" && drillSubject) {
      setLoading(true);
      api
        .get(`/academics/subject-drilldown/${childId}/${termId}`, {
          params: { subject: drillSubject },
        })
        .then((res) => {
          setSubjectData(res.data);
          setError(null);
        })
        .catch(() => setError("Failed to load subject data"))
        .finally(() => setLoading(false));
    }
  }, [activeSubTab, drillSubject, childId, termId]);

  // Fetch class position
  useEffect(() => {
    if (activeSubTab === "class position") {
      setLoading(true);
      api
        .get(`/academics/class-position/${childId}/${termId}`)
        .then((res) => {
          setClassPosition(res.data);
          setError(null);
        })
        .catch(() => setError("Failed to load class position"))
        .finally(() => setLoading(false));
    }
  }, [activeSubTab, childId, termId]);

  // Fetch topics
  useEffect(() => {
    if (activeSubTab === "insights") {
      setLoading(true);
      api
        .get(`/academics/topics/${childId}/${termId}`)
        .then((res) => {
          setTopics(res.data);
          setError(null);
        })
        .catch(() => setError("Failed to load topics"))
        .finally(() => setLoading(false));
    }
  }, [activeSubTab, childId, termId]);
useEffect(() => {
  if (activeSubTab === "insights" && topics?.subjects?.length) {
    const hasActive =
      activeTopicSubject &&
      topics.subjects.some((s) => s.subject === activeTopicSubject);
    if (!hasActive) {
      setActiveTopicSubject(topics.subjects[0].subject);
    }
  }
}, [activeSubTab, topics, activeTopicSubject]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  
  return (
    <div className="text-gray-800">
      {/* Sub-tabs */}
      <div className="mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1 rounded mr-2 capitalize ${
              activeSubTab === tab
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeSubTab === "overview" && overview && (
        <div className="bg-white rounded-2xl shadow-lg p-4 space-y-6">
          {/* Insight banners */}
          <div className="space-y-2">
            {overview.insights?.map((ins, i) => (
              <div
                key={i}
                className={`p-2 rounded font-semibold text-sm ${
                  ins.type === "alert"
                    ? "bg-red-100 text-red-700"
                    : ins.type === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {ins.message}
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold">Subject Averages</h2>
          <div className="space-y-2">
            {overview.subjects.map((s) => (
              <div
                key={s.subject}
                className="bg-gray-100 rounded p-2 cursor-pointer"
                onClick={() => {
                  setDrillSubject(s.subject);
                  setActiveSubTab("subject");
                }}
              >
                <div className="flex justify-between text-sm font-semibold">
                  <span>{s.subject}</span>
                  <span>
                    {s.child_avg}% (Class: {s.class_avg}%)
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded h-3 mt-1">
                  <div
                    className="bg-blue-500 h-3 rounded"
                    style={{ width: `${s.child_avg}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold mt-6">Recent Assessments</h2>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Date</th>
                <th className="p-2">Subject</th>
                <th className="p-2">Name</th>
                <th className="p-2">Label</th>
                <th className="p-2">Score</th>
                <th className="p-2">%</th>
                <th className="p-2">Comment</th>
              </tr>
            </thead>
            <tbody>
              {overview.recent_assessments.map((a, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    {new Date(a.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-2">{a.subject}</td>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2">{a.assessment_label || "-"}</td>
                  <td className="p-2">
                    {a.score}/{a.max}
                  </td>
                  <td className="p-2">{a.pct}%</td>
                  <td className="p-2">
                    {a.comment ? (
                      <button
                        onClick={() => openComment(a)}
                        className="px-2 py-1 text-xs rounded border bg-white text-blue-600 hover:bg-blue-50"
                      >
                        View comment
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBJECT TAB */}
      {activeSubTab === "subject" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          {/* Subject pills */}
          <div className="mb-4 space-x-2">
            {subjectList.map((subj) => (
              <button
                key={subj}
                onClick={() => setDrillSubject(subj)}
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  drillSubject === subj
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {subj}
              </button>
            ))}
          </div>

          {subjectData && (
            <>
              <h2 className="text-lg font-bold mb-4">
                {drillSubject} – Term Trend
              </h2>
              <Line
                data={{
                  labels: subjectData.childSeries.map((d) =>
                    new Date(d.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  ),
                  datasets: [
                    {
                      label: "Your Child",
                      data: subjectData.childSeries.map((d) => d.pct),
                      borderColor: "#3b82f6",
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 8,
                      hitRadius: 12,
                    },
                    {
                      label: "Class Average",
                      data: subjectData.classSeries.map((d) => d.class_pct),
                      borderColor: "#f59e0b",
                      borderDash: [5, 5],
                      tension: 0.3,
                      pointRadius: 4,
                      pointHoverRadius: 8,
                      hitRadius: 12,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    tooltip: {
                      bodyFont: { size: 16, weight: "bold" },
                      titleFont: { size: 18, weight: "bold" },
                      padding: 12,
                    },
                    legend: {
                      labels: { font: { size: 14 } },
                    },
                  },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
                height={100}
              />

              <table className="w-full border mt-6 text-sm">
                <thead>
                  <tr className="bg-gray-200 text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Assessment</th>
                    <th className="p-2">Label</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">%</th>
                    <th className="p-2">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectData.childSeries.map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        {new Date(a.date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2">{a.name}</td>
                      <td className="p-2">{a.assessment_label || "-"}</td>
                      <td className="p-2">
                        {a.score}/{a.max}
                      </td>
                      <td className="p-2">{a.pct}%</td>
                      <td className="p-2">
                        {a.comment ? (
                          <button
                            onClick={() => openComment(a, drillSubject)}
                            className="px-2 py-1 text-xs rounded border bg-white text-blue-600 hover:bg-blue-50"
                          >
                            View comment
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* CLASS POSITION TAB */}
      {activeSubTab === "class position" && classPosition && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="text-lg font-bold mb-4">Overall Class Position</h2>

          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowFullView((prev) => !prev)}
              className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              {showFullView ? "Hide Full Class" : "View Full Class"}
            </button>
          </div>

          {!showFullView && (
            <div style={{ overflowX: "auto" }}>
              <Bar
                data={{
                  labels: (() => {
                    const labels = [];
                    const topFive = classPosition.distribution
                      .slice(0, 5)
                      .map((_, i) => `#${i + 1}`);
                    labels.push(...topFive);

                    if (classPosition.position > 5) {
                      labels.push("…");
                      labels.push(`#${classPosition.position}`);
                    }
                    return labels;
                  })(),
                  datasets: [
                    {
                      label: "Average %",
                      data: (() => {
                        const data = [];
                        const topFiveData =
                          classPosition.distribution.slice(0, 5);
                        data.push(...topFiveData);

                        if (classPosition.position > 5) {
                          data.push(null);
                          data.push(classPosition.student_avg);
                        }
                        return data;
                      })(),
                      backgroundColor: (() => {
                        const colors = [];
                        classPosition.distribution
                          .slice(0, 5)
                          .forEach((_, idx) => {
                            colors.push(
                              idx + 1 === classPosition.position
                                ? "#3b82f6"
                                : "rgba(107, 114, 128, 0.5)"
                            );
                          });
                        if (classPosition.position > 5) {
                          colors.push("rgba(0,0,0,0)");
                          colors.push("#3b82f6");
                        }
                        return colors;
                      })(),
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  layout: { padding: { top: 0, bottom: 0 } },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
                height={100}
              />
            </div>
          )}
  
          {showFullView && (
            <div style={{ overflowX: "auto" }}>
              <Line
                data={{
                  labels: classPosition.distribution.map((_, i) => `#${i + 1}`),
                  datasets: [
                    {
                      label: "Class Distribution",
                      data: classPosition.distribution,
                      borderColor: "rgba(107, 114, 128, 0.5)",
                      backgroundColor: "rgba(107, 114, 128, 0.5)",
                      pointRadius: classPosition.distribution.map((_, idx) =>
                        idx + 1 === classPosition.position ? 6 : 3
                      ),
                      pointBackgroundColor: classPosition.distribution.map(
                        (_, idx) =>
                          idx + 1 === classPosition.position
                            ? "#3b82f6"
                            : "rgba(107, 114, 128, 0.5)"
                      ),
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const idx = context.dataIndex + 1;
                          if (idx === classPosition.position) {
                            return `Your Child: ${context.raw}%`;
                          }
                          return "Anonymous";
                        },
                      },
                    },
                    legend: { display: false },
                  },
                  layout: { padding: { top: 0, bottom: 0 } },
                  scales: { y: { beginAtZero: true, max: 100 } },
                }}
                height={100}
              />
            </div>
          )}

          <p className="mt-3 text-sm font-semibold">
            Position:{" "}
            <span className="text-blue-600">#{classPosition.position}</span>{" "}
            out of {classPosition.total_students} students
          </p>
          <p className="text-sm text-gray-600">
            Your child's average: {classPosition.student_avg}% | Class average:{" "}
            {classPosition.class_avg}%
          </p>
        </div>
      )}

      {/* TOPICS TAB — grouped by subject */}
{activeSubTab === "insights" && topics && (
  <div className="bg-white rounded-2xl shadow-lg p-4">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold">Insights  — Assessment Performance by Subject</h2>
      {topics.overall && (
        <div className="text-xs text-gray-600">
          <span className="mr-3">Strong: {topics.overall.strong}</span>
          <span className="mr-3">On Track: {topics.overall.on_track}</span>
          <span>Needs Support: {topics.overall.needs_support}</span>
        </div>
      )}
    </div>

    <p className="text-xs text-gray-500 mb-4 font-bold">
      Strong ≥ 75% · On Track 60–74% · Needs Support &lt; 60%.
    </p>

    {/* Subject tabs (scrollable) */}
    <div className="-mx-1 overflow-x-auto mb-4">
      <div className="flex gap-2 px-1 pb-1">
        {(topics.subjects || []).map((s) => {
          const active = s.subject === activeTopicSubject;
          return (
            <button
              key={s.subject}
              onClick={() => setActiveTopicSubject(s.subject)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-sm border transition
                ${active ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200"}`}
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
    {(() => {
      const s = (topics.subjects || []).find((x) => x.subject === activeTopicSubject);
      if (!s) {
        return <div className="text-sm text-gray-500">Select a subject to view topics.</div>;
      }

      const Bucket = ({ title, tone, items, emptyText }) => {
        const toneMap = {
          green: {
            dot: "bg-green-500",
            headText: "text-green-700",
            border: "border-green-100",
            cardBg: "bg-green-50",
            cardBorder: "border-green-100",
          },
          amber: {
            dot: "bg-amber-500",
            headText: "text-amber-700",
            border: "border-amber-100",
            cardBg: "bg-amber-50",
            cardBorder: "border-amber-100",
          },
          red: {
            dot: "bg-red-500",
            headText: "text-red-700",
            border: "border-red-100",
            cardBg: "bg-red-50",
            cardBorder: "border-red-100",
          },
        }[tone];

        return (
          <div className={`rounded-xl border ${toneMap.border}`}>
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <span className={`inline-block w-2 h-2 rounded-full ${toneMap.dot}`} />
              <div className={`text-sm font-semibold ${toneMap.headText}`}>{title}</div>
            </div>
            <div className="p-3 space-y-2">
              {items.length ? (
                items.map((t, i) => (
                  <div
                    key={`${title}-${i}`}
                    className={`p-3 rounded-lg ${toneMap.cardBg} border ${toneMap.cardBorder}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-800">{t.topic}</div>
                      <div className="text-sm font-bold text-gray-900">{t.avg_pct}%</div>
                    </div>
                    <div className="mt-2">
                      <TopicProgress pct={t.avg_pct} />
                    </div>
                    <div className="mt-1">
                      <Attempts last_date={t.last_date} attempts={t.attempts} />
                    </div>
                    {/* gentle guidance line (tone-specific) */}
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
      };

      return (
        <div className="space-y-3">
          {/* Subject header summary */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{s.subject}</h3>
            <div className="text-[11px] text-gray-600">
              <span className="mr-3">Strong: {s.counts.strong}</span>
              <span className="mr-3">On Track: {s.counts.on_track}</span>
              <span>Needs Support: {s.counts.needs_support}</span>
            </div>
          </div>

          {/* Buckets as clean cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Bucket
              title="Strong (≥ 75%)"
              tone="green"
              items={s.strong}
              emptyText="No topics here yet."
            />
            <Bucket
              title="On Track (60–74%)"
              tone="amber"
              items={s.on_track}
              emptyText="No topics here yet."
            />
            <Bucket
              title="Needs Support (< 60%)"
              tone="red"
              items={s.needs_support}
              emptyText="No topics here yet."
            />
          </div>
        </div>
      );
    })()}
  </div>
)}


      {/* COMMENT MODAL */}
      {commentModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={closeComment}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">Comment</h3>
              <button
                onClick={closeComment}
                className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* Meta */}
            {commentModal.meta && (
              <div className="text-xs text-gray-600 space-y-1 mb-3">
                {commentModal.meta.date && <div>Date: {commentModal.meta.date}</div>}
                {commentModal.meta.subject && (
                  <div>Subject: {commentModal.meta.subject}</div>
                )}
                {commentModal.meta.name && <div>Assessment: {commentModal.meta.name}</div>}
                {commentModal.meta.label && (
                  <div>Label: {commentModal.meta.label}</div>
                )}
                {(commentModal.meta.pct !== undefined ||
                  commentModal.meta.score) && (
                  <div>
                    {commentModal.meta.score
                      ? `Score: ${commentModal.meta.score}`
                      : null}
                    {commentModal.meta.pct !== undefined
                      ? `  ·  ${commentModal.meta.pct}%`
                      : null}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 border rounded bg-gray-50 whitespace-pre-wrap text-sm">
              {commentModal.text}
            </div>

            <div className="mt-4 text-right">
              <button
                onClick={closeComment}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

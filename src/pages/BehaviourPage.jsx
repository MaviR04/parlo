import React, { useEffect, useState } from "react";
import api from "../axios";
//import BehaviourOverview from "../components/BehaviourOverview";
import BehaviourOverviewGrouped from "../components/BehaviourOverviewGrouped";
/* ───────── Legend (1–3) ───────── */
function Legend13() {
  return (
    <div className="mb-3">
      <div className="inline-flex flex-wrap items-center gap-3 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border">
        <span className="inline-flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 border">1</span>
          <span>Needs Support</span>
        </span>
        <span className="text-gray-400">•</span>
        <span className="inline-flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 border">2</span>
          <span>Meets Expectations</span>
        </span>
        <span className="text-gray-400">•</span>
        <span className="inline-flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 border">3</span>
          <span>Exceeds Expectations</span>
        </span>
      </div>
    </div>
  );
}

/* ───────── Small helpers ───────── */
function getWeekStartDate(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // Sun=0..Sat=6
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}
function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
const extractGrade = (s) => {
  const m = String(s || "").match(/(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
};

/* ───────── Tooltip (tailwind-only) ───────── */
const Tooltip = ({ tip }) => (
  <span className="relative group inline-flex items-center">
    <span className="ml-1 cursor-pointer text-gray-400 hover:text-gray-600">ℹ️</span>
    <span className="invisible group-hover:visible absolute z-10 top-full mt-1 left-1/2 -translate-x-1/2 whitespace-pre rounded border bg-white text-gray-700 text-xs px-2 py-1 shadow">
      {tip}
    </span>
  </span>
);

export default function BehaviourPage() {
  const [activeTab, setActiveTab] = useState("mark"); // "mark" | "overview"

  const [roles, setRoles] = useState(null);
  const [term, setTerm] = useState(null);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [children, setChildren] = useState([]);

  const [behaviourData, setBehaviourData] = useState({});
  const [originalData, setOriginalData] = useState({}); // snapshot from server (or null)
  const [savedMap, setSavedMap] = useState({});         // childid -> saved?
  const [editedMap, setEditedMap] = useState({});       // childid -> touched this week?

  const [weekStartDate, setWeekStartDate] = useState(getWeekStartDate(getLocalDateString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const itemsPerPage = 10; // ← keep only this declaration (avoid duplicates)

  // ====== Conversation Help (modal) state & content ======
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChildId, setModalChildId] = useState(null);
  const conversationStarters = [
    "I noticed some challenges this week, but I’m confident we can work together to improve.",
    "There were a few moments needing reminders, but progress is within reach.",
    "Let’s focus on small, achievable steps to build positive habits."
  ];
  const openConversationHelp = (childid) => {
    setModalChildId(childid);
    setModalOpen(true);
  };
  const insertConversationStarter = (starter) => {
    if (modalChildId) {
      setBehaviourData((prev) => ({
        ...prev,
        [modalChildId]: {
          ...prev[modalChildId],
          weekly_note:
            (prev[modalChildId]?.weekly_note || "") +
            ((prev[modalChildId]?.weekly_note ? " " : "") + starter),
        },
      }));
    }
    setModalOpen(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  /* ───────── Boot: term + roles ───────── */
  useEffect(() => {
    (async () => {
      try {
        const [termRes, rolesRes] = await Promise.all([
          api.get("/behaviour/current-term"),
          api.get("/users/me/roles", { withCredentials: true }),
        ]);
        setTerm(termRes.data);
        setRoles(rolesRes.data);
      } catch {
        setError("Failed to load term or roles");
      }
    })();
  }, []);

  /* ───────── Load classes depending on role ───────── */
  useEffect(() => {
    if (!term || !roles) return;

    const loadForClassTeacher = async () => {
      const clsRes = await api.get("/teacher/classes/class-teacher-only");
      const list = clsRes.data || [];
      if (!list.length) throw new Error("No homeroom");
      const homeroom = list[0];
      setAvailableClasses(list);
      setSelectedClass({ classid: homeroom.classid, classname: homeroom.classname });
    };

    const loadForSubjectTeacher = async () => {
      const tc = await api.get("/users/teaching-classes", { withCredentials: true });
      const classes = (tc.data || []).filter((c) => {
        const g = extractGrade(c.classname);
        return Number.isFinite(g) && g <= 4;
      });
      setAvailableClasses(classes);
      if (classes.length) {
        setSelectedClass({ classid: classes[0].classid, classname: classes[0].classname });
      } else {
        setError("Behaviour is only available for Grades 4 and below, and none of your classes match.");
      }
    };

    (async () => {
      try {
        if (roles.isClassTeacher) await loadForClassTeacher();
        else if (roles.isSubjectTeacher) await loadForSubjectTeacher();
        else setError("You are not assigned as a class or subject teacher.");
      } catch {
        setError("Failed to load your classes");
      }
    })();
  }, [term, roles]);

  /* ───────── Load students when class changes ───────── */
  useEffect(() => {
    if (!selectedClass) return;
    (async () => {
      try {
        const res = await api.get(`/teacher/classes/${selectedClass.classid}/students`);
        const kids = res.data || [];
        setChildren(kids);

        // defaults + flags
        const defaults = {};
        const initSaved = {};
        const initOriginals = {};
        const initEdited = {};
        kids.forEach((child) => {
          defaults[child.childid] = {
            focus_engagement: 2,
            respect_kindness: 2,
            self_management: 2,
            weekly_note: "",
          };
          initSaved[child.childid] = false;      // nothing saved yet
          initOriginals[child.childid] = null;   // no server snapshot yet
          initEdited[child.childid] = false;     // not touched
        });
        setBehaviourData(defaults);
        setSavedMap(initSaved);
        setOriginalData(initOriginals);
        setEditedMap(initEdited);
      } catch {
        setChildren([]);
      }
    })();
  }, [selectedClass]);

  /* ───────── Load existing weekly behaviour per child ───────── */
  useEffect(() => {
    if (!term || !children.length || !weekStartDate) return;

    children.forEach((child) => {
      api
        .get(`/behaviour/${child.childid}/${term.termid}?week=${weekStartDate}`)
        .then((res) => {
          if (res.data) {
            setBehaviourData((prev) => ({ ...prev, [child.childid]: res.data }));
            setOriginalData((prev) => ({ ...prev, [child.childid]: res.data }));
            setSavedMap((prev) => ({ ...prev, [child.childid]: true }));   // ✅ on server
            setEditedMap((prev) => ({ ...prev, [child.childid]: false })); // not touched yet
          } else {
            setSavedMap((prev) => ({ ...prev, [child.childid]: false }));
            setOriginalData((prev) => ({ ...prev, [child.childid]: null }));
            setEditedMap((prev) => ({ ...prev, [child.childid]: false }));
          }
        })
        .catch(() => { });
    });
  }, [term, children, weekStartDate]);

  /* ───────── Editing helpers ───────── */
  const updateBehaviour = (childid, key, value) => {
    setBehaviourData((prev) => ({ ...prev, [childid]: { ...prev[childid], [key]: value } }));
    setSavedMap((prev) => ({ ...prev, [childid]: false })); // editing -> not saved
    setEditedMap((prev) => ({ ...prev, [childid]: true })); // mark as touched
  };

  function rowColor(childid) {
    if (savedMap[childid]) return "bg-green-50"; // saved
    if (editedMap[childid]) return "bg-yellow-50"; // touched but not saved
    return "bg-white"; // untouched baseline
  }

  /* ───────── Save (bulk) ───────── */
  const saveAllBehaviour = async () => {
    if (!term || !weekStartDate) return showToast("Term or week not loaded");
    try {
      setSaving(true);

      const items = children
        .map((child) => {
          const d = behaviourData[child.childid];
          if (!d) return null;
          return {
            child_id: child.childid,
            term_id: term.termid,
            week_start_date: weekStartDate,
            focus_engagement: Number(d.focus_engagement ?? 2),
            respect_kindness: Number(d.respect_kindness ?? 2),
            self_management: Number(d.self_management ?? 2),
            weekly_note: d.weekly_note ?? "",
          };
        })
        .filter(Boolean);

      await api.post("/behaviour/bulk", { items });

      // snapshot -> originals; mark saved; clear edited flags
      setOriginalData((prev) => {
        const updated = { ...prev };
        children.forEach((child) => {
          const d = behaviourData[child.childid];
          if (d) updated[child.childid] = { ...d };
        });
        return updated;
      });
      setSavedMap((prev) => {
        const allSaved = { ...prev };
        children.forEach((child) => {
          allSaved[child.childid] = true;
        });
        return allSaved;
      });
      setEditedMap((prev) => {
        const cleared = { ...prev };
        children.forEach((child) => {
          cleared[child.childid] = false;
        });
        return cleared;
      });

      showToast("Behaviour saved successfully for all students!");
    } catch {
      setError("Failed to save behaviour data");
      showToast("Failed to save behaviour data");
    } finally {
      setSaving(false);
    }
  };

  /* ───────── Search + pagination ───────── */
  const filteredChildren = children.filter(
    (c) =>
      `${c.fname} ${c.lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${c.lname} ${c.fname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredChildren.length / itemsPerPage);
  const currentList = showAll
    ? filteredChildren
    : filteredChildren.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  /* ───────── Render ───────── */
  if (error && !selectedClass)
    return (
      <p className="p-6 max-w-6xl mx-auto mt-10 bg-white rounded shadow text-red-600">
        {error}
      </p>
    );
  if (!roles || !term)
    return (
      <p className="p-6 max-w-6xl mx-auto mt-10 bg-white rounded shadow text-gray-800">
        Loading…
      </p>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto mt-10 bg-white rounded shadow text-gray-800">
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded shadow z-50">
          {toast}
        </div>
      )}

      {/* Conversation Help Modal (same vibe as grades) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">Conversation Help</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Choose a kind, constructive way to communicate the concern. You can edit it after inserting.
            </p>

            <div className="space-y-3">
              {conversationStarters.map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => insertConversationStarter(starter)}
                  className="w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-blue-50 transition"
                >
                  {starter}
                </button>
              ))}
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === "mark" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          onClick={() => setActiveTab("mark")}
        >
          Mark Weekly
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === "overview" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
      </div>

      {activeTab === "overview" ? (
        // <BehaviourOverview />
        <BehaviourOverviewGrouped />
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-1">📋 Behaviour Marking</h1>
          <Legend13 />

          {/* Controls row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="font-semibold mb-1 text-gray-700">Current Term</div>
              <div className="border px-3 py-2 rounded bg-gray-50">{term?.name || "Loading..."}</div>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700">Class</label>
              <select
                className="w-full border px-3 py-2 rounded"
                value={selectedClass?.classid || ""}
                onChange={(e) => {
                  const cls = availableClasses.find((c) => String(c.classid) === e.target.value);
                  setSelectedClass(cls || null);
                  setCurrentPage(1);
                }}
              >
                {availableClasses.map((c) => (
                  <option key={c.classid} value={c.classid}>
                    {c.classname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700">📅 Week Starting</label>
              <input
                type="date"
                className="w-full border px-3 py-2 rounded"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(getWeekStartDate(e.target.value))}
              />
            </div>
          </div>

          {/* Search + Show All */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <input
              type="search"
              placeholder="Search students…"
              className="w-full md:max-w-sm border px-3 py-2 rounded"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showAll}
                onChange={() => setShowAll((v) => !v)}
              />
              <span>Show all students</span>
            </label>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full border text-sm rounded overflow-hidden">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-3 py-2 border">Student</th>

                  <th className="px-3 py-2 border text-center">
                    <div className="flex items-center justify-center gap-1">
                      Focus & Engagement (1-3)
                      <Tooltip tip={"1 = Rarely on task\n2 = Usually attentive\n3 = Consistently engaged"} />
                    </div>
                  </th>

                  <th className="px-3 py-2 border text-center">
                    <div className="flex items-center justify-center gap-1">
                      Respect & Kindness (1-3)
                      <Tooltip tip={"1 = Frequent unkindness\n2 = Usually respectful\n3 = Consistently respectful & kind"} />
                    </div>
                  </th>

                  <th className="px-3 py-2 border text-center">
                    <div className="flex items-center justify-center gap-1">
                      Self‑Management (1-3)
                      <Tooltip tip={"1 = Needs frequent reminders\n2 = Usually self‑regulated\n3 = Consistently manages behaviour & emotions"} />
                    </div>
                  </th>

                  <th className="px-3 py-2 border">Weekly Note</th>
                </tr>
              </thead>

              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-500">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  currentList.map((child) => {
                    const data =
                      behaviourData[child.childid] || {
                        focus_engagement: 2,
                        respect_kindness: 2,
                        self_management: 2,
                        weekly_note: "",
                      };

                    // Count ratings that are 2 or below
                    const lowOrMidCount = ["focus_engagement", "respect_kindness", "self_management"].filter(
                      (key) => Number(data[key]) <= 2
                    ).length;

                    return (
                      <tr key={child.childid} className={rowColor(child.childid)}>
                        {/* Name now shows First Last */}
                        <td className="px-3 py-2 border whitespace-nowrap">
                          {child.fname} {child.lname}
                        </td>

                        {["focus_engagement", "respect_kindness", "self_management"].map((key) => (
                          <td key={key} className="px-3 py-2 border text-center">
                            <div className="flex flex-col items-center">
                              <input
                                type="range"
                                min="1"
                                max="3"
                                step="1"
                                value={data[key]}
                                onChange={(e) => updateBehaviour(child.childid, key, Number(e.target.value))}
                                className="max-w-[140px] w-full accent-blue-600"
                                aria-label={`${key} (1 to 3)`}
                              />
                              <div className="grid grid-cols-3 w-full max-w-[140px] text-[11px] text-gray-500 mt-1">
                                <span className="text-left">1</span>
                                <span className="text-center">2</span>
                                <span className="text-right">3</span>
                              </div>
                              <div className="text-sm text-blue-700 font-semibold mt-1">{data[key]}</div>
                            </div>
                          </td>
                        ))}

                        <td className="px-3 py-2 border">
                          <div className="flex flex-col gap-2">
                            <textarea
                              rows={2}
                              value={data.weekly_note || ""}
                              onChange={(e) => updateBehaviour(child.childid, "weekly_note", e.target.value)}
                              className="w-full border px-2 py-1 rounded resize-none"
                              placeholder="Add note…"
                            />
                            {lowOrMidCount >= 2 && (
                              <button
                                type="button"
                                onClick={() => openConversationHelp(child.childid)}
                                className="shrink-0 text-xs px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
                                title="Open Conversation Help"
                              >
                                Conversation Help
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

            </table>
          </div>

          {/* Pagination */}
          {!showAll && totalPages > 1 && (
            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-1 rounded ${currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-300"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <div className="text-right">
            <button
              onClick={saveAllBehaviour}
              disabled={saving}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>

          {error && <p className="text-red-600 font-semibold mt-4">{error}</p>}
        </>
      )}
    </div>
  );
}

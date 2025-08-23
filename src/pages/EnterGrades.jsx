import { useEffect, useState, useRef, useMemo } from "react";
import api from "../axios";

function monthAbbrev() {
  return new Date().toLocaleString("en-US", { month: "short" });
}

// --- fuzzy helpers: normalize + Levenshtein (for typos like "Monthy" vs "Monthly")
function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
function similar(aRaw, bRaw) {
  const a = normalizeName(aRaw);
  const b = normalizeName(bRaw);
  if (!a || !b) return false;
  if (a === b) return true; // exact after normalization
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const ratio = 1 - dist / Math.max(1, maxLen);
  return ratio >= 0.85 || dist <= 1; // treat as conflict if very close
}

export default function EnterGrades() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [loading, setLoading] = useState(false);

  const [autoSubject, setAutoSubject] = useState("");
  const [globalAssessmentName, setGlobalAssessmentName] = useState("");
  const [globalMaxScore, setGlobalMaxScore] = useState("100");
  const [manualLabelOverride, setManualLabelOverride] = useState("");

  const [toastMsg, setToastMsg] = useState("");
  const [saveStatus, setSaveStatus] = useState("All changes saved");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const studentsPerPage = 10;

  const [pastAssessments, setPastAssessments] = useState([]);
  const [selectedPast, setSelectedPast] = useState("");

  // Only WARN (no “not used” text)
  const [labelUsed, setLabelUsed] = useState(false);

  // name conflict (term-scoped, fuzzy)
  const [nameConflict, setNameConflict] = useState(false);

  const autoSaveInterval = useRef(null);
  const lowPromptShownRef = useRef(new Set());
  const labelCheckTimerRef = useRef(null);

  // Modal state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const lowScorePrompts = [
    "Your child scored below expectations in this assessment, but with consistent support, I’m confident they can improve.",
    "This result shows there’s room for growth, and I will focus on helping your child strengthen these skills.",
    "While this score is lower than we aimed for, I’ve seen your child’s potential and will guide them toward better results next time.",
    "We will work together on the key areas to help your child gain confidence and improve performance."
  ];

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };
  const getSubjectFromRole = (role) => {
    if (!role) return "";
    if (role.toLowerCase().includes("teacher")) {
      return role.replace(/teacher/i, "").trim();
    }
    return role;
  };

  // Build label to SAVE: "{Name} - {Mon}" + optional " - {Custom}"
  const buildSuggestedLabel = (name, custom) => {
    if (!name?.trim()) return "";
    const base = `${name.trim()} - ${monthAbbrev()}`;
    const extra = custom?.trim() ? ` - ${custom.trim()}` : "";
    return `${base}${extra}`;
  };
  const generateLabel = () => buildSuggestedLabel(globalAssessmentName, manualLabelOverride);

  // numeric helpers
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const getPercent = (g) => {
    const s = toNum(g?.score);
    const m = toNum(g?.max_score ?? globalMaxScore);
    if (s === null || m === null || m <= 0) return null;
    return (s / m) * 100;
  };
  const isLowScore = (g) => {
    const p = getPercent(g);
    return p !== null && p <= 50;
  };
  const rowClassFor = (filled, low) => {
    const base = filled ? "bg-green-50" : "bg-red-50";
    return low ? `${base} ring-1 ring-rose-300 border-l-4 border-l-rose-500` : base;
  };

  // init
  useEffect(() => {
    (async () => {
      try {
        const [termRes, classRes] = await Promise.all([
          api.get("/terms/current"),
          api.get("/grades/classes-with-roles"),
        ]);
        setSelectedTerm(termRes.data);
        setClasses(classRes.data);
        if (classRes.data.length > 0) {
          setSelectedClass(classRes.data[0].classid);
          setAutoSubject(getSubjectFromRole(classRes.data[0].role));
        }
      } catch {
        showToast("Failed to load term or classes");
      }
    })();
  }, []);

  useEffect(() => {
    const found = classes.find((c) => c.classid === selectedClass);
    setAutoSubject(getSubjectFromRole(found?.role));
  }, [selectedClass, classes]);

  useEffect(() => {
    if (!selectedClass || !selectedTerm) return;
    (async () => {
      setLoading(true);
      try {
        const [stuRes, pastRes] = await Promise.all([
          api.get(`/teacher/classes/${selectedClass}/students`),
          api.get(`/grades/past-assessments`, {
            params: { classid: selectedClass, subject: autoSubject },
          }),
        ]);
        setStudents(stuRes.data);
        setGrades({});
        setPastAssessments(pastRes.data);
      } catch {
        showToast("Failed to load students or past assessments");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClass, selectedTerm, autoSubject]);

  useEffect(() => setSelectedPast(""), [selectedClass, selectedTerm, autoSubject]);

  // Autosave
  useEffect(() => {
    autoSaveInterval.current = setInterval(() => {
      if (saveStatus === "Unsaved changes") saveGrades();
    }, 30000);
    return () => clearInterval(autoSaveInterval.current);
  }, [saveStatus, grades]);

  // ESC closes modal
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowPromptModal(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // --- TERM-SCOPED NAME CONFLICT (fuzzy) using current term's past assessments
  const currentTermPast = useMemo(
    () => pastAssessments.filter((a) => a.termid === selectedTerm?.termid),
    [pastAssessments, selectedTerm]
  );

  useEffect(() => {
    const name = globalAssessmentName.trim();
    if (!name) {
      setNameConflict(false);
      return;
    }
    const conflict = currentTermPast.some((a) => similar(a.assessment_name, name));
    setNameConflict(conflict);
  }, [globalAssessmentName, currentTermPast]);

  // --- Are we editing a previously loaded assessment (same/similar name)?
  const editingExisting = useMemo(
    () => !!selectedPast && similar(selectedPast, globalAssessmentName),
    [selectedPast, globalAssessmentName]
  );

  // --- LABEL USED (exact match; warn only if yes). If name conflicts (and not editing), skip label check.
  useEffect(() => {
    clearTimeout(labelCheckTimerRef.current);
    if (!selectedClass || !selectedTerm?.termid || !autoSubject) {
      setLabelUsed(false);
      return;
    }
    const name = globalAssessmentName.trim();
    if (!name || (nameConflict && !editingExisting)) {
      setLabelUsed(false);
      return;
    }
    const candidateLabel = generateLabel();
    if (!candidateLabel) {
      setLabelUsed(false);
      return;
    }
    labelCheckTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/grades/by-assessment", {
          params: {
            classid: selectedClass,
            subject: autoSubject,
            termid: selectedTerm.termid,
            assessment_name: name,
          },
        });
        const rows = Array.isArray(data) ? data : [];
        const exists = rows.some(
          (r) => (r.assessment_label || "").trim() === candidateLabel
        );
        setLabelUsed(exists);
      } catch {
        setLabelUsed(false);
      }
    }, 350);
    return () => clearTimeout(labelCheckTimerRef.current);
  }, [
    selectedClass,
    selectedTerm,
    autoSubject,
    globalAssessmentName,
    manualLabelOverride,
    nameConflict,
    editingExisting,
  ]);

  // derived validation
  const hasName = !!globalAssessmentName.trim();
  const hasAnyScore = useMemo(
    () =>
      Object.values(grades).some(
        (g) => g && g.score !== "" && g.score !== undefined && Number.isFinite(Number(g.score))
      ),
    [grades]
  );

  // ✅ allow editing if loaded; block only for new conflicting names
  const canEditRows = hasName && (!nameConflict || editingExisting);
  const canSave = hasName && (!nameConflict || editingExisting) && hasAnyScore && !loading;

  // handlers
  const handleGradeChange = (childid, field, rawValue) => {
    setSaveStatus("Unsaved changes");
    setGrades((prev) => {
      const current = prev[childid] || {};
      const next = { ...prev, [childid]: { ...current, [field]: rawValue } };
      if (field === "score") {
        const sNum = toNum(rawValue);
        const mNum = toNum(current.max_score ?? globalMaxScore);
        if (sNum !== null && mNum !== null && mNum > 0) {
          const pct = (sNum / mNum) * 100;
          if (pct <= 50 && !lowPromptShownRef.current.has(childid)) {
            lowPromptShownRef.current.add(childid);
            showToast("Tip: Add a kind, specific note so parents know the plan 💙");
          }
        }
      }
      return next;
    });
  };

  const handleScoreBlur = (childid) => {
    setGrades((prev) => {
      const current = prev[childid] || {};
      const s = toNum(current.score);
      const m = toNum(current.max_score ?? globalMaxScore);
      if (s === null || m === null || m <= 0) return prev;
      const clamped = Math.max(0, Math.min(s, m));
      if (clamped !== s) showToast("Score adjusted to be within 0–Max.");
      return { ...prev, [childid]: { ...current, score: String(clamped) } };
    });
  };

  const handleMaxBlur = (childid) => {
    setGrades((prev) => {
      const current = prev[childid] || {};
      let m = toNum(current.max_score ?? globalMaxScore);
      if (m === null) return prev;
      m = Math.max(1, m);
      const s = toNum(current.score);
      let nextScore = current.score;
      if (s !== null && s > m) {
        nextScore = String(m);
        showToast("Score capped to the updated Max.");
      }
      return { ...prev, [childid]: { ...current, max_score: String(m), score: nextScore } };
    });
  };

  const saveGrades = async () => {
    if (!hasName) return showToast("Assessment name is required.");
    if (nameConflict && !editingExisting) {
      return showToast("That assessment name is already used this term.");
    }
    if (!hasAnyScore) return showToast("Please enter at least one student's score.");

    const labelToSave = generateLabel();

    // Only send rows with a score
    const filledRows = students
      .map((s) => {
        const g = grades[s.childid] || {};
        const hasScore =
          g.score !== "" && g.score !== undefined && Number.isFinite(Number(g.score));
        if (!hasScore) return null;
        const maxClean = Math.max(1, Number(g.max_score ?? globalMaxScore) || 1);
        const rawScore = Number(g.score);
        const scoreClean = Math.max(0, Math.min(rawScore, maxClean));
        return {
          childid: s.childid,
          classid: selectedClass,
          subject: autoSubject,
          termid: selectedTerm.termid,
          assessment_name: g.assessment_name || globalAssessmentName,
          assessment_label: labelToSave, // save composed label
          score: scoreClean,
          max_score: maxClean,
          comment: g.comment || null,
        };
      })
      .filter(Boolean);

    try {
      await api.post("/grades/batch", { grades: filledRows });
      setSaveStatus("All changes saved");
      showToast("Grades saved successfully");
    } catch {
      showToast("Failed to save grades");
    }
  };

  const loadPastAssessment = async (assessmentName) => {
    if (!assessmentName || !selectedClass || !selectedTerm || !autoSubject) return;
    try {
      setLoading(true);
      const { data } = await api.get("/grades/by-assessment", {
        params: {
          classid: selectedClass,
          subject: autoSubject,
          termid: selectedTerm.termid,
          assessment_name: assessmentName,
        },
      });

      const map = {};
      data.forEach((row) => {
        map[row.childid] = {
          assessment_name: row.assessment_name,
          score: row.score ?? "",
          max_score: row.max_score ?? globalMaxScore,
          comment: row.comment ?? "",
        };
      });

      // ensure all students present
      students.forEach((st) => {
        if (!map[st.childid]) {
          map[st.childid] = {
            assessment_name: assessmentName,
            score: "",
            max_score: globalMaxScore,
            comment: "",
          };
        }
      });

      const first = data[0];
      if (first) {
        setGlobalAssessmentName(first.assessment_name || assessmentName);
        if (first.max_score) setGlobalMaxScore(String(first.max_score));
      } else {
        setGlobalAssessmentName(assessmentName);
      }

      setGrades(map);
      setSelectedPast(assessmentName); // <- key for editingExisting
      setSaveStatus("All changes saved");
      showToast(`Loaded "${assessmentName}" from current term`);
    } catch {
      showToast("Failed to load past assessment");
    } finally {
      setLoading(false);
    }
  };

  // pagination
  const filteredStudents = students.filter((s) =>
    `${s.fname} ${s.lname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const currentStudents = showAll
    ? filteredStudents
    : filteredStudents.slice((currentPage - 1) * studentsPerPage, currentPage * studentsPerPage);

  return (
    <div className="p-6 max-w-5xl mx-auto mt-10 text-gray-800 bg-white shadow rounded">
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded shadow z-50">
          {toastMsg}
        </div>
      )}

      {/* Modal: Conversation Help */}
      {showPromptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPromptModal(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">Conversation Help</h2>
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Choose a kind, constructive way to communicate the low score. You can edit it after inserting.
            </p>

            <div className="space-y-3">
              {lowScorePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setGrades((prev) => {
                      const current = prev[selectedStudentId] || {};
                      return { ...prev, [selectedStudentId]: { ...current, comment: prompt } };
                    });
                    setShowPromptModal(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-blue-50 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">📝 Enter Grades</h2>

      <div className="mb-4 text-gray-800 font-medium">
        Status:{" "}
        <span className={saveStatus === "All changes saved" ? "text-green-700" : "text-red-600"}>
          {saveStatus}
        </span>
      </div>

      <label className="block mb-2 font-semibold">Class</label>
      <select
        value={selectedClass}
        onChange={(e) => setSelectedClass(e.target.value)}
        className="w-full mb-4 border px-4 py-2 rounded"
      >
        {classes.map((c) => (
          <option key={c.classid} value={c.classid}>
            {c.classname} ({c.role})
          </option>
        ))}
      </select>

      {selectedTerm && (
        <div className="mb-4 text-gray-800">
          📚 School Year: {selectedTerm.schoolYear} | Term: {selectedTerm.name}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <div>
          <input
            type="text"
            placeholder="Assessment name *"
            value={globalAssessmentName}
            onChange={(e) => {
              setGlobalAssessmentName(e.target.value);
              setSaveStatus("Unsaved changes");
            }}
            className={`border px-4 py-2 rounded w-full ${
              nameConflict && !editingExisting ? "border-rose-400" : ""
            }`}
            aria-invalid={nameConflict && !editingExisting ? true : false}
          />
          {!hasName && (
            <div className="text-xs text-rose-600 mt-1">
              Enter an assessment name to enable grading.
            </div>
          )}
          {nameConflict && hasName && !editingExisting && (
            <div className="text-xs text-rose-600 mt-1">
              That name is too similar to an assessment already used in <strong>{selectedTerm?.name}</strong>. Please choose a different name.
            </div>
          )}
          {editingExisting && (
            <div className="text-xs text-blue-700 mt-1">
              Editing existing assessment: <strong>{selectedPast}</strong>
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="Optional custom label (appends to suggested label)"
          value={manualLabelOverride}
          onChange={(e) => setManualLabelOverride(e.target.value)}
          className="border px-4 py-2 rounded w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <input
          type="number"
          placeholder="Max Score"
          value={globalMaxScore}
          onChange={(e) => setGlobalMaxScore(e.target.value)}
          min={1}
          inputMode="numeric"
          pattern="[0-9]*"
          step="1"
          onWheel={(e) => e.currentTarget.blur()}
          className="border px-4 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Search student..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-4 py-2 rounded"
        />
      </div>

      {/* Suggestion + WARNINGS ONLY */}
      <div className="mb-3 font-medium text-gray-700">
        Suggested label: <span className="text-blue-600">{generateLabel()}</span>
        {labelUsed && (!nameConflict || editingExisting) && (
          <span className="text-xs text-amber-600 ml-2">
            (Heads-up: this exact label was already used this term.)
          </span>
        )}
      </div>

      {/* Past assessment (current term only) */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 font-semibold">Load past assessment (current term)</label>
          <div className="flex gap-2">
            <select
              value={selectedPast}
              onChange={(e) => loadPastAssessment(e.target.value)}
              className="flex-1 border px-4 py-2 rounded"
              disabled={!currentTermPast.length}
            >
              <option value="">
                {currentTermPast.length ? "Select..." : "No past assessments in current term"}
              </option>
              {currentTermPast.map((a) => (
                <option key={`${a.assessment_name}-${a.termid}`} value={a.assessment_name}>
                  {a.assessment_name}
                </option>
              ))}
            </select>
            {selectedPast && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPast("");
                  setGrades({});
                  setGlobalAssessmentName("");
                  setGlobalMaxScore("100");
                  setSaveStatus("All changes saved");
                  showToast("Cleared loaded assessment");
                }}
                className="bg-gray-300 hover:bg-gray-400 px-3 py-2 rounded text-sm"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Only shows assessments from the current term.</p>
        </div>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full border border-gray-300 rounded">
          <thead className="bg-gray-200 text-left">
            <tr>
              <th className="px-3 py-2 border">Student</th>
              <th className="px-3 py-2 border">Score</th>
              <th className="px-3 py-2 border">Max</th>
              <th className="px-3 py-2 border">Comment</th>
            </tr>
          </thead>
          <tbody>
            {currentStudents.map((s) => {
              const g = grades[s.childid] || {};
              const filled = g.score !== undefined && g.score !== "";
              const low = isLowScore(g);

              return (
                <tr key={s.childid} className={rowClassFor(filled, low)}>
                  <td className="px-3 py-2 border">
                    {s.fname} {s.lname}
                  </td>

                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      value={g.score ?? ""}
                      onChange={(e) => canEditRows && handleGradeChange(s.childid, "score", e.target.value)}
                      onBlur={() => canEditRows && handleScoreBlur(s.childid)}
                      min={0}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      step="1"
                      onWheel={(e) => e.currentTarget.blur()}
                      disabled={!canEditRows}
                      className={`w-full border px-2 py-1 rounded ${
                        canEditRows ? "" : "bg-gray-100 cursor-not-allowed opacity-70"
                      }`}
                      placeholder={
                        !hasName
                          ? "Add assessment name first"
                          : nameConflict && !editingExisting
                          ? "Name conflicts this term"
                          : ""
                      }
                    />
                  </td>

                  <td className="px-3 py-2 border">
                    <input
                      type="number"
                      value={globalMaxScore}
                      disabled
                      className="w-full border px-2 py-1 rounded bg-gray-100 cursor-not-allowed"
                    />
                  </td>

                  <td className="px-3 py-2 border align-top">
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        value={g.comment || ""}
                        onChange={(e) => canEditRows && handleGradeChange(s.childid, "comment", e.target.value)}
                        disabled={!canEditRows}
                        className={`w-full border px-2 py-1 rounded resize-y ${
                          low ? "border-rose-300" : ""
                        } ${canEditRows ? "" : "bg-gray-100 cursor-not-allowed opacity-70"}`}
                        placeholder={
                          !hasName
                            ? "Add assessment name first"
                            : nameConflict && !editingExisting
                            ? "Name conflicts this term"
                            : ""
                        }
                      />
                      {low && canEditRows && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(s.childid);
                            setShowPromptModal(true);
                          }}
                          className="shrink-0 text-xs px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
                          title="Open Conversation Help"
                        >
                          💬 Conversation Help
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!showAll && totalPages > 1 && (
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded ${
                currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-300"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4">
        <label>
          <input
            type="checkbox"
            checked={showAll}
            onChange={() => setShowAll(!showAll)}
          />{" "}
          Show all students
        </label>
      </div>

      <div className="text-center">
        <button
          onClick={saveGrades}
          disabled={!canSave}
          className={`px-6 py-2 rounded text-white ${
            canSave ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300 cursor-not-allowed"
          }`}
          title={
            !hasName
              ? "Enter assessment name"
              : nameConflict && !editingExisting
              ? "Name conflicts with one already used this term"
              : !hasAnyScore
              ? "Enter at least one score"
              : ""
          }
        >
          Save Grades Now
        </button>
      </div>
    </div>
  );
}

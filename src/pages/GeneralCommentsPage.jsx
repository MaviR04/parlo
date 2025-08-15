// src/pages/GeneralCommentsPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../axios";
import TermSelector from "../components/TermSelector";

/* ───────────────── helpers ───────────────── */
const roleBadge = (r) =>
  r === "ClassTeacher" ? "bg-blue-100 text-blue-700"
    : r === "SubjectTeacher" ? "bg-purple-100 text-purple-700"
      : r === "Coach" ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-700";

function isCurrentTerm(term) {
  if (!term) return false;
  const now = new Date();
  const sd = new Date(term.start_date);
  const ed = new Date(term.end_date);
  return now >= sd && now <= ed;
}

/* ───────────────── prompt sets ───────────────── */
/** Label-specific (exact names from comment_labels.name) */
const LABEL_PROMPTS = {
  Praise: [
    "Great engagement this week — sets a good example.",
    "Consistently respectful and focused.",
    "Shared ideas that helped the group."
  ],
  Concern: [
    "Had some trouble with focus — we will try a clear 3‑step plan at school.",
    "Needed reminders about kindness — we reviewed our class/activity rules.",
    "Lost focus during group work — we’ll practice staying on task."
  ],
  Academic: [
    "Understands main ideas — next step is applying them independently.",
    "Needs extra practice on this topic — short home review will help.",
    "Improving, but still working on accuracy."
  ],
  Behaviour: [
    "We’re focusing on smoother routines — {student} will try one cue this week.",
    "Let’s keep choices respectful and kind — small steps add up.",
    "We’ll practice quick reminders to stay on task."
  ],
  Attendance: [
    "Attendance has been irregular — consistency will help routines.",
    "Late arrivals affect settling time — aiming for on‑time starts.",
    "Improved attendance this week — let’s keep the routine going."
  ],
  Effort: [
    "Putting in steady effort — we will keep building on this.",
    "Listens to feedback and keeps trying.",
    "Showing persistence — good progress ahead."
  ],
  Participation: [
    "Participated actively in group tasks.",
    "Quieter this week — we’ll encourage more sharing.",
    "Volunteered to help — confidence growing."
  ]
};

/** Always available “safe” prompts */
const POSITIVE_PROMPTS = [
  "Great momentum — keep reinforcing these good habits.",
  "Positive attitude stood out this week.",
  "Kind and supportive towards peers."
];
const GENERAL_PROMPTS = [
  "Thanks for supporting at home — let’s keep it up.",
  "One small goal for this week: {goal}.",
  "We’ll check in on progress next week."
];

/** Role/context extras */
const ROLE_PROMPTS = {
  activities: [
    "Showed great teamwork during {sport/activity}.",
    "Needs to stay more consistent during practice.",
    "Focused well on new techniques this week."
  ],
  classTeacher: [
    "We’ll use simple start‑of‑lesson routines to stay organised.",
    "Helped peers during transitions — great example.",
    "We’ll try one cue to support smoother routines."
  ],
  subjectTeacher: [
    "In {subject}, we’ll strengthen {skill} with short practice tasks.",
    "{student} asked thoughtful questions — next step is applying ideas independently.",
    "A quick review before tasks will build confidence."
  ]
};

export default function GeneralCommentsPage({ currentUser }) {
  const location = useLocation();

  /* ───────── term ───────── */
  const [selectedTerm, setSelectedTerm] = useState(null);
  const canCompose = isCurrentTerm(selectedTerm);

  /* ───────── boot (scope + labels + rosters) ───────── */
  const [boot, setBoot] = useState(null);
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [bootError, setBootError] = useState("");

  /* ───────── labels ───────── */
  const [labels, setLabels] = useState([]);
  const labelById = useMemo(() => {
    const m = new Map();
    (labels || []).forEach((l) => m.set(String(l.label_id), l));
    return m;
  }, [labels]);

  /* ───────── filters/list ───────── */
  const [query, setQuery] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [mineOnly, setMineOnly] = useState(true);

  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  /* ───────── composer ───────── */
  const [labelId, setLabelId] = useState(""); // STRING id
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibleToParent, setVisibleToParent] = useState(true);

  const [contextMode, setContextMode] = useState("class"); // 'class' | 'subject' | 'activity'
  const [classId, setClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [activityId, setActivityId] = useState("");

  // Student picker
  const [childId, setChildId] = useState("");
  const [childFilter, setChildFilter] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const teacherName = currentUser?.name || "";
  const isAdmin = currentUser?.userRole === "admin";
  const myUserId = currentUser?.userID || currentUser?.userid || currentUser?.id;

  /* ───────── route hint ───────── */
  useEffect(() => {
    const path = location.pathname || "";
    if (path.startsWith("/coach/")) setContextMode("activity");
    else if (path.startsWith("/teacher/")) setContextMode("class");
  }, [location.pathname]);

  /* ───────── load boot (scope + labels) ───────── */
  useEffect(() => {
    (async () => {
      setLoadingBoot(true);
      setBootError("");
      try {
        const { data } = await api.get("/general-comments/bootstrap", { withCredentials: true });
        setBoot(data?.scope || null);
        setLabels(data?.labels || []); // includes comment_labels with {label_id, name, color}
      } catch (e) {
        console.error(e);
        setBootError(e?.response?.data?.error || "Failed to load your scope.");
      } finally {
        setLoadingBoot(false);
      }
    })();
  }, []);

  /* ───────── clear fields on context switch ───────── */
  useEffect(() => {
    if (contextMode === "activity") { setClassId(""); setSubjectName(""); }
    if (contextMode === "subject") { setActivityId(""); }
    if (contextMode === "class") { setActivityId(""); setSubjectName(""); }
    setChildId(""); setChildFilter(""); setShowSuggestions(false);
  }, [contextMode]);

  /* ───────── allowed modes ───────── */
  const allowed = useMemo(() => ({
    class: !!(boot?.classTeacher?.length),
    subject: !!(boot?.subjectTeacher?.length),
    activity: !!(boot?.coach?.length),
  }), [boot]);

  /* ───────── default mode ───────── */
  useEffect(() => {
    if (!boot) return;
    const preferRoute =
      location.pathname.startsWith("/coach/") ? "activity" :
        location.pathname.startsWith("/teacher/") ? "class" : null;

    const firstAllowed =
      (preferRoute && allowed[preferRoute]) ? preferRoute :
        allowed.activity ? "activity" :
          allowed.subject ? "subject" : "class";

    setContextMode(firstAllowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot]);

  /* ───────── fetch list ───────── */
  async function fetchComments() {
    if (!selectedTerm?.termid) return;
    setLoadingList(true);
    try {
      const params = {
        termid: selectedTerm.termid,
        q: query || undefined,
        label_id: filterLabel || undefined,
        source: filterSource || undefined,
        mine: mineOnly ? "true" : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      const { data } = await api.get("/general-comments", { params, withCredentials: true });
      setList(data || []);
      setHasMore((data || []).length === pageSize);
    } catch (e) {
      console.error(e);
      setList([]); setHasMore(false);
    } finally {
      setLoadingList(false);
    }
  }
  useEffect(() => { setPage(1); }, [selectedTerm, query, filterLabel, filterSource, mineOnly, pageSize]);
  useEffect(() => { fetchComments(); /* eslint-disable-next-line */ }, [selectedTerm, page, pageSize, query, filterLabel, filterSource, mineOnly]);

  /* ───────── post comment ───────── */
  async function postComment() {
    if (contextMode === "activity" && !allowed.activity) return alert("You are not a coach.");
    if (contextMode === "subject" && !allowed.subject) return alert("You are not a subject teacher.");
    if (contextMode === "class" && !allowed.class) return alert("You are not a class teacher.");

    if (!selectedTerm?.termid) return alert("Please select a term.");
    if (!canCompose) return alert("This term is read-only. Select the current term to add comments.");
    if (!childId) return alert("Please select a student.");
    if (!body || body.trim().length < 5) return alert("Please write at least 5 characters.");

    const payload = {
      childid: Number(childId),
      termid: selectedTerm.termid,
      label_id: labelId || null,
      title: title || null,
      body,
      visible_to_parent: !!visibleToParent,
    };

    if (contextMode === "activity") {
      if (!activityId) return alert("Please select an activity.");
      payload.activityid = Number(activityId);
    } else if (contextMode === "subject") {
      if (!classId || !subjectName) return alert("Please select class and subject.");
      payload.classid = Number(classId);
      payload.subject_name = subjectName.trim();
    } else {
      if (!classId) return alert("Please select a class.");
      payload.classid = Number(classId);
    }

    if (teacherName && !title) setTitle(`${teacherName} - Comment`);

    try {
      await api.post("/general-comments", payload, { withCredentials: true });
      setLabelId(""); setTitle(""); setBody("");
      fetchComments();
      alert("Comment posted.");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Failed to post comment");
    }
  }

  /* ───────── list card ───────── */
  const Card = ({ c }) => {
    const [editing, setEditing] = useState(false);
    const [eLabel, setELabel] = useState(c.label_id || "");
    const [eTitle, setETitle] = useState(c.title || "");
    const [eBody, setEBody] = useState(c.body || "");
    const [eVisible, setEVisible] = useState(!!c.visible_to_parent);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const canEdit = isAdmin || (myUserId && Number(myUserId) === Number(c.author_userid));
    const label = c.label_id ? labelById.get(String(c.label_id)) : null;
    const who = `${c.author_fname || ""} ${c.author_lname || ""}`.trim();
    const whereBits = [];
    if (c.classname) whereBits.push(`Class: ${c.classname}`);
    if (c.subject_name) whereBits.push(`Subject: ${c.subject_name}`);
    if (c.activity_name) whereBits.push(`Activity: ${c.activity_name}`);
    const where = whereBits.join(" • ");

    async function saveEdit() {
      try {
        setSaving(true);
        await api.patch(`/general-comments/${c.id}`, {
          label_id: eLabel || null,
          title: eTitle || null,
          body: eBody,
          visible_to_parent: !!eVisible,
        }, { withCredentials: true });
        setEditing(false);
        fetchComments();
      } catch (e) {
        console.error(e);
        alert(e?.response?.data?.error || "Failed to update comment");
      } finally {
        setSaving(false);
      }
    }

    async function deleteComment() {
      if (!confirm("Delete this comment?")) return;
      try {
        setDeleting(true);
        await api.delete(`/general-comments/${c.id}`, { withCredentials: true });
        fetchComments();
      } catch (e) {
        console.error(e);
        alert(e?.response?.data?.error || "Failed to delete comment");
      } finally {
        setDeleting(false);
      }
    }

    return (
      <div className="border rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow bg-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded ${roleBadge(c.author_role)}`}>
              {c.author_role}
            </span>
            {c.visible_to_parent ? (
              <span className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-medium">
                Parent-visible
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200 font-medium">
                Staff only
              </span>
            )}
            {label && (
              <span
                className="inline-block px-2 py-0.5 text-xs rounded border mr-1"
                style={{ backgroundColor: `${(label.color || "gray")}15`, borderColor: "#d1d5db" }}
              >
                {label.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
            {canEdit && !editing && (
              <>
                <button
                  className="text-xs px-2 py-1 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                <button
                  className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50 border-red-200 disabled:opacity-50 transition-colors"
                  onClick={deleteComment}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-1 text-xs text-gray-500">
          {who && <span>By {who}</span>}
          {where && <span> • {where}</span>}
        </div>

        {!editing ? (
          <div className="mt-3 text-sm text-gray-800">
            <div className="font-semibold text-gray-900">
              {c.title ? c.title : `${c.child_fname || ""} ${c.child_lname || ""}`.trim()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Student: {(c.child_fname || "") + " " + (c.child_lname || "")}
            </div>
            <div className="mt-2 whitespace-pre-wrap leading-relaxed">{c.body}</div>
          </div>
        ) : (
          <div className="mt-3 border-t pt-3 space-y-2">
            <label className="block text-sm font-medium">Label</label>
            <select
              className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-200"
              value={eLabel}
              onChange={(e) => setELabel(e.target.value)}
            >
              <option value="">(none)</option>
              {labels.map((l) => (
                <option key={l.label_id} value={String(l.label_id)}>{l.name}</option>
              ))}
            </select>

            <label className="block text-sm font-medium">Title</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-200"
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
            />

            <label className="block text-sm font-medium">Comment</label>
            <textarea
              className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-200"
              rows={4}
              value={eBody}
              onChange={(e) => setEBody(e.target.value)}
            />

            <label className="inline-flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={eVisible}
                onChange={(e) => setEVisible(e.target.checked)}
              />
              <span className="text-sm">Visible to parent</span>
            </label>

            <div className="flex gap-2 mt-3">
              <button
                className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="border px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ───────── roster & suggestions ───────── */
  const roster = useMemo(() => {
    if (!boot) return [];
    if (contextMode === "activity" && activityId) return boot.childrenByActivity?.[activityId] || [];
    if ((contextMode === "class" || contextMode === "subject") && classId) return boot.childrenByClass?.[classId] || [];
    return [];
  }, [boot, contextMode, classId, activityId]);

  const filteredRoster = useMemo(() => {
    const term = (childFilter || "").toLowerCase();
    if (!term) return roster;
    return roster.filter((ch) => (`${ch.fname} ${ch.lname}`).toLowerCase().includes(term));
  }, [roster, childFilter]);

  const suggestions = useMemo(() => filteredRoster.slice(0, 8), [filteredRoster]);

  function onPickStudent(ch) {
    setChildId(String(ch.childid));
    setChildFilter(`${ch.fname} ${ch.lname}`);
    setShowSuggestions(false);
  }

  /* ───────── prompt help (label + role aware) ───────── */
  const [promptOpen, setPromptOpen] = useState(false);

  const selectedLabelName = (labelId && labelById.get(String(labelId))?.name) || "";

  function getRoleExtras() {
    if (contextMode === "activity") return ROLE_PROMPTS.activities;
    if (contextMode === "class") return ROLE_PROMPTS.classTeacher;
    if (contextMode === "subject") return ROLE_PROMPTS.subjectTeacher;
    return [];
  }

  function getPromptsForUI() {
    // If a label is selected and we have a set for it → show those first.
    const main = selectedLabelName && LABEL_PROMPTS[selectedLabelName]
      ? LABEL_PROMPTS[selectedLabelName]
      : [];

    // Always available supportive ones (kept short)
    const base = [...POSITIVE_PROMPTS, ...GENERAL_PROMPTS];

    // Role/context extras
    const role = getRoleExtras();

    // If a label is selected, we show: Label set + Role extras (if any).
    // If NO label is selected, we show: Positive/General + Role extras.
    if (main.length) return {
      groups: [
        { title: selectedLabelName, items: main },
        role.length ? { title: "Context", items: role } : null,
      ].filter(Boolean)
    };

    return {
      groups: [
        { title: "Suggestions", items: base },
        role.length ? { title: "Context", items: role } : null,
      ].filter(Boolean)
    };
  }

  /* ───────── render ───────── */
  return (
    <div className="max-w-[1100px] mx-auto p-4 md:p-6 bg-white mt-6 rounded-2xl shadow text-gray-900">
      {/* Prompt Help Modal */}
      {promptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setPromptOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Prompt Help</h2>
              <button
                onClick={() => setPromptOpen(false)}
                className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100 text-sm"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-gray-600 mb-3">
              Label: <b>{selectedLabelName || "None"}</b>
              {contextMode === "activity" && <> • <b>Activity</b></>}
              {contextMode === "class" && <> • <b>Class Teacher</b></>}
              {contextMode === "subject" && <> • <b>Subject Teacher</b></>}
            </div>

            {getPromptsForUI().groups.map((grp, idx) => (
              <div key={idx} className={idx > 0 ? "mt-3" : ""}>
                <div className="text-sm font-semibold text-gray-700 mb-1">{grp.title}</div>
                <div className="space-y-2 max-h-80 overflow-auto pr-1">
                  {grp.items.map((s, i) => (
                    <button
                      key={`${idx}-${i}`}
                      onClick={() => {
                        setBody((prev) => (prev ? `${prev.trim()} ${s}` : s));
                        setPromptOpen(false);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-gray-300 hover:bg-blue-50 transition text-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">📝 General Comments</h2>
      </div>

      {/* Term selector */}
      <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />

      {/* Current term banner / read-only notice */}
      {selectedTerm && !canCompose && (
        <div className="mt-3 p-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm">
          This term (<strong>{selectedTerm.name}</strong>) is read-only. You can browse and filter comments, but can’t add new ones. Select the current term to write comments.
        </div>
      )}

      {/* Scope load status */}
      {loadingBoot && <div className="text-sm text-gray-500 mt-2">Loading your classes/activities…</div>}
      {bootError && <div className="text-sm text-red-600 mt-2">{bootError}</div>}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3 mt-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search title/body…"
            className="border rounded px-3 py-2 w-64"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
          >
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l.label_id} value={l.label_id}>{l.name}</option>
            ))}
          </select>
          <select
            className="border rounded px-3 py-2"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">All sources</option>
            <option value="ClassTeacher">Class Teacher</option>
            <option value="SubjectTeacher">Subject Teacher</option>
            <option value="Coach">Coach</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            My comments only
          </label>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Rows per page:</span>
          <select
            className="border rounded px-2 py-1"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Layout: composer + list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Composer */}
        <div className={`border rounded-xl p-3 ${!canCompose ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="font-semibold mb-2">Add a comment</div>

          <div className="grid grid-cols-1 gap-3">
            {/* Context toggle */}
            <div>
              <label className="block text-sm font-medium mb-1">Context</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  disabled={!allowed.class}
                  onClick={() => allowed.class && setContextMode("class")}
                  className={`px-2 py-1 rounded border ${contextMode === "class" ? "bg-blue-600 text-white" : "bg-gray-100"} ${!allowed.class ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Class Teacher
                </button>
                <button
                  type="button"
                  disabled={!allowed.subject}
                  onClick={() => allowed.subject && setContextMode("subject")}
                  className={`px-2 py-1 rounded border ${contextMode === "subject" ? "bg-blue-600 text-white" : "bg-gray-100"} ${!allowed.subject ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Subject Teacher
                </button>
                <button
                  type="button"
                  disabled={!allowed.activity}
                  onClick={() => allowed.activity && setContextMode("activity")}
                  className={`px-2 py-1 rounded border ${contextMode === "activity" ? "bg-blue-600 text-white" : "bg-gray-100"} ${!allowed.activity ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Coach
                </button>
              </div>

              {/* Context pickers */}
              {contextMode === "activity" ? (
                <>
                  <label className="block text-sm font-medium mb-1">Activity</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={activityId}
                    onChange={(e) => { setActivityId(e.target.value); setChildId(""); setChildFilter(""); }}
                    disabled={!boot}
                  >
                    <option value="">Select an activity…</option>
                    {(boot?.coach || []).map((a) => (
                      <option key={a.activityid} value={a.activityid}>
                        {a.name} — {a.category}{a.agegroup ? ` (${a.agegroup})` : ""} (#{a.activityid})
                      </option>
                    ))}
                  </select>
                </>
              ) : contextMode === "subject" ? (
                <>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={classId}
                    onChange={(e) => { setClassId(e.target.value); setSubjectName(""); setChildId(""); setChildFilter(""); }}
                    disabled={!boot}
                  >
                    <option value="">Select a class…</option>
                    {(boot?.subjectTeacher || []).map((c) => (
                      <option key={c.classid} value={c.classid}>{c.classname} (#{c.classid})</option>
                    ))}
                  </select>

                  <label className="block text-sm font-medium mb-1 mt-2">Subject</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    disabled={!classId}
                  >
                    <option value="">Select a subject…</option>
                    {(boot?.subjectTeacher?.find((c) => String(c.classid) === String(classId))?.subjects || [])
                      .map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={classId}
                    onChange={(e) => { setClassId(e.target.value); setChildId(""); setChildFilter(""); }}
                    disabled={!boot}
                  >
                    <option value="">Select a class…</option>
                    {(boot?.classTeacher || []).map((c) => (
                      <option key={c.classid} value={c.classid}>{c.classname} (#{c.classid})</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Student search + suggestions + select */}
            <div>
              <label className="block text-sm font-medium mb-1">Student</label>
              <div className="relative">
                <input
                  type="text"
                  className="border rounded px-3 py-2 w-full mb-2"
                  placeholder="Search student by name…"
                  value={childFilter}
                  onChange={(e) => { setChildFilter(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  disabled={
                    (contextMode === "activity" && !activityId) ||
                    ((contextMode === "class" || contextMode === "subject") && !classId)
                  }
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded shadow-sm max-h-60 overflow-auto">
                    {suggestions.map((ch) => (
                      <button
                        key={ch.childid}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPickStudent(ch)}
                      >
                        {ch.fname} {ch.lname} <span className="text-gray-500">#{ch.childid}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <select
                className="border rounded px-3 py-2 w-full"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                disabled={
                  (contextMode === "activity" && !activityId) ||
                  ((contextMode === "class" || contextMode === "subject") && !classId)
                }
              >
                <option value="">Select a student…</option>
                {filteredRoster.map((ch) => (
                  <option key={ch.childid} value={ch.childid}>
                    {ch.fname} {ch.lname} (#{ch.childid})
                  </option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={labelId}
                onChange={(e) => setLabelId(e.target.value || "")}
              >
                <option value="">(optional)</option>
                {labels.map((l) => (
                  <option key={l.label_id} value={String(l.label_id)}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title (optional)</label>
              <input
                type="text"
                className="border rounded px-3 py-2 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
              />
            </div>

            {/* Body + Prompt Help */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium mb-1">Comment</label>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setPromptOpen(true)}
                  disabled={
                    (contextMode === "activity" && !activityId) ||
                    ((contextMode === "class" || contextMode === "subject") && !classId)
                  }
                  title="Open prompt suggestions"
                >
                  Prompt Help
                </button>
              </div>
              <textarea
                className="border rounded px-3 py-2 w-full"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a concise, parent-facing note…"
              />
            </div>

            {/* Visibility */}
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibleToParent}
                onChange={(e) => setVisibleToParent(e.target.checked)}
              />
              <span className="text-sm">Visible to parent</span>
            </label>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={postComment}
                disabled={!selectedTerm || !canCompose || loadingBoot}
              >
                Post comment
              </button>
              <button
                type="button"
                className="border px-4 py-2 rounded"
                onClick={() => { setLabelId(""); setTitle(""); setBody(""); }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="border rounded-xl p-3">
          <div className="font-semibold mb-2">Comments</div>

          {loadingList ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-sm text-gray-500">No comments found for this term/filters.</div>
          ) : (
            <div className="max-h-[560px] overflow-auto pr-1">
              {list.map((c) => <Card key={c.id} c={c} />)}
            </div>
          )}

          {/* pagination */}
          <div className="flex items-center justify-between mt-3 text-sm">
            <div className="text-gray-600">
              Showing {list.length ? (page - 1) * pageSize + 1 : 0}
              –
              {(page - 1) * pageSize + list.length}
            </div>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(1)} disabled={page <= 1} title="First">«</button>
              <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} title="Prev">‹</button>
              <span className="px-2">Page {page}</span>
              <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => p + 1)} disabled={!hasMore} title="Next">›</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

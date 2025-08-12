// src/components/GenCommentsTab.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";

export default function GenCommentsTab({ childId, termId }) {
    const [labels, setLabels] = useState([]); // [{label_id, name, color}]
    const [selectedLabelId, setSelectedLabelId] = useState(null);

    const [selectedRole, setSelectedRole] = useState(""); // "ClassTeacher" | "SubjectTeacher" | "Coach"
    const [datePreset, setDatePreset] = useState("This term"); // "This week" | "This month" | "This term"
    const [searchTerm, setSearchTerm] = useState("");

    const [viewerRole, setViewerRole] = useState(""); // "parent" | "teacher"
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const pageSize = 10;

    // who is viewing (uses userRole from your session)
    useEffect(() => {
        api.get("/p-comments/viewer-role")
            .then(res => setViewerRole((res.data?.role || "").toLowerCase()))
            .catch(() => setViewerRole(""));
    }, []);

    // load label chips
    useEffect(() => {
        api.get("/p-comments/labels")
            .then(res => setLabels(res.data || []))
            .catch(() => setLabels([]));
    }, []);

    // fetch comments when filters change
    useEffect(() => {
        if (!childId || !termId) return;

        setLoading(true);
        const params = {
            q: searchTerm || undefined,
            role: selectedRole || undefined,
            labelId: selectedLabelId || undefined,
            preset:
                datePreset === "This week" ? "week" :
                    datePreset === "This month" ? "month" : undefined, // "This term" -> undefined
        };

        api.get(`/p-comments/${childId}/${termId}`, { params })
            .then(res => {
                setComments(res.data || []);
                setPage(1);
            })
            .catch(() => setComments([]))
            .finally(() => setLoading(false));
    }, [childId, termId, searchTerm, selectedRole, selectedLabelId, datePreset]);

    const headerText = useMemo(() => {
        if (selectedRole) return `${selectedRole} Notes`;
        if (selectedLabelId) {
            const lbl = labels.find(l => l.label_id === selectedLabelId);
            return lbl ? `${lbl.name} Notes` : "Comments";
        }
        return "All Comments";
    }, [selectedRole, selectedLabelId, labels]);

    const emptyText = useMemo(() => {
        if (selectedLabelId) {
            const lbl = labels.find(l => l.label_id === selectedLabelId);
            if (lbl?.name === "Concern") return `No Concerns ${datePreset.toLowerCase()} 🎉`;
            if (lbl?.name === "Attendance") return `No Attendance issues ${datePreset.toLowerCase()} ✅`;
            return `No ${lbl ? lbl.name : ""} notes ${datePreset.toLowerCase()}.`;
        }
        if (selectedRole) return `No ${selectedRole} notes ${datePreset.toLowerCase()}.`;
        return `No comments ${datePreset.toLowerCase()}.`;
    }, [selectedLabelId, selectedRole, datePreset, labels]);

    const totalPages = Math.max(1, Math.ceil(comments.length / pageSize));
    const view = comments.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="bg-white rounded-2xl shadow-lg text-gray-900 p-4">
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* label chips */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => { setSelectedLabelId(null); setPage(1); }}
                        className={`px-3 py-1 rounded-full text-sm border
              ${selectedLabelId === null ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    >
                        All
                    </button>
                    {labels.map(l => (
                        <button
                            key={l.label_id}
                            onClick={() => { setSelectedLabelId(selectedLabelId === l.label_id ? null : l.label_id); setPage(1); }}
                            className={`px-3 py-1 rounded-full text-sm border flex items-center gap-2
                ${selectedLabelId === l.label_id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color || "#6B7280" }} />
                            {l.name}
                        </button>
                    ))}
                </div>

                {/* date presets */}
                <div className="ml-auto flex gap-2">
                    {["This week", "This month", "This term"].map(p => (
                        <button
                            key={p}
                            onClick={() => { setDatePreset(p); setPage(1); }}
                            className={`px-3 py-1 rounded border text-sm
                ${datePreset === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* role chips */}
                <div className="flex gap-2">
                    {["ClassTeacher", "SubjectTeacher", "Coach"].map(r => (
                        <button
                            key={r}
                            onClick={() => { setSelectedRole(selectedRole === r ? "" : r); setPage(1); }}
                            className={`px-3 py-1 rounded-full text-sm border
                ${selectedRole === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* search */}
                <input
                    type="text"
                    placeholder="Find in comments…"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="ml-auto border rounded px-3 py-2 text-sm w-full sm:w-80"
                />
            </div>

            <h2 className="text-lg font-bold mb-3">{headerText}</h2>

            {loading ? (
                <p>Loading comments...</p>
            ) : comments.length === 0 ? (
                <p className="text-gray-600 italic">{emptyText}</p>
            ) : (
                <>
                    <table className="w-full border text-sm">
                        <thead>
                            <tr className="bg-gray-200 text-left">
                                <th className="p-2 w-6"></th>
                                <th className="p-2">Date</th>
                                <th className="p-2">From</th>
                                <th className="p-2">Context</th>
                                <th className="p-2">Label</th>
                                <th className="p-2">Title</th>
                                <th className="p-2">Comment</th>
                                {viewerRole === "teacher" && <th className="p-2">Parent-Visible</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {view.map((c) => {
                                const color = c.label_color || "#9CA3AF";
                                const context =
                                    c.author_role === "Coach"
                                        ? (c.activity_name || "—")
                                        : c.author_role === "SubjectTeacher"
                                            ? (c.subject_name || "—")
                                            : (c.classname || "—"); // ClassTeacher

                                const from = (c.author_fname || c.author_lname)
                                    ? `${c.author_role} • ${[c.author_fname, c.author_lname].filter(Boolean).join(" ")}`
                                    : c.author_role;

                                return (
                                    <tr key={c.id} className="border-t align-top">
                                        <td className="p-2">
                                            <span
                                                className="inline-block w-3 h-3 rounded-full"
                                                style={{ backgroundColor: color }}
                                            />
                                        </td>

                                        <td className="p-2">
                                            {new Date(c.created_at).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>

                                        <td className="p-2">{from}</td>
                                        <td className="p-2">{context}</td>

                                        <td className="p-2">
                                            {c.label_name ? (
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-xs text-white"
                                                    style={{ backgroundColor: color }}
                                                >
                                                    {c.label_name}
                                                </span>
                                            ) : "—"}
                                        </td>

                                        <td className="p-2">{c.title || "—"}</td>
                                        <td className="p-2">{c.body}</td>

                                        {viewerRole === "teacher" && (
                                            <td className="p-2">
                                                {c.visible_to_parent ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 border border-green-300">
                                                        Visible
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 border border-yellow-300">
                                                        Private
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 text-sm">
                        <div className="text-gray-600">
                            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, comments.length)} of {comments.length}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span className="px-2 py-1">{page} / {Math.max(1, Math.ceil(comments.length / pageSize))}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(comments.length / pageSize)), p + 1))}
                                disabled={page >= Math.ceil(comments.length / pageSize)}
                                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </>

            )}
        </div>
    );
}

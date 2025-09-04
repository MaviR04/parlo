// src/pages/MeetingScheduling.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { useNavigate } from "react-router-dom";

export default function MeetingScheduling({ user }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [errorParents, setErrorParents] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    parentId: "",
  });

  const [timeslots, setTimeslots] = useState([]);
  const [draftSlot, setDraftSlot] = useState({ start: "", end: "" });
  const [submitErr, setSubmitErr] = useState("");

  // (Optional) Gate non-teachers for now
  useEffect(() => {
    if (user?.userRole && user.userRole !== "Teacher") {
      // navigate("/"); // uncomment if you want to redirect
    }
  }, [user, navigate]);

  // 🔗 Real DB fetch via backend
  useEffect(() => {
    const fetchParents = async () => {
      try {
        setLoadingParents(tzrue);
        setErrorParents("");
        // This hits your backend which reads from your DB.
        // Adjust the path if your API is namespaced (e.g., /api/parents).
        const res = await api.get("/parents", { withCredentials: true });
        setParents(res.data || []);
      } catch (err) {
        console.error("Failed to load parents", err);
        setErrorParents("Could not load parents.");
      } finally {
        setLoadingParents(false);
      }
    };
    fetchParents();
  }, []);

  const canAddDraft = useMemo(() => {
    if (!draftSlot.start || !draftSlot.end) return false;
    return new Date(draftSlot.start) < new Date(draftSlot.end);
  }, [draftSlot]);

  const addDraftSlot = () => {
    if (!canAddDraft) return;
    const overlaps = timeslots.some((s) => {
      const a1 = new Date(s.start).getTime();
      const a2 = new Date(s.end).getTime();
      const b1 = new Date(draftSlot.start).getTime();
      const b2 = new Date(draftSlot.end).getTime();
      return Math.max(a1, b1) < Math.min(a2, b2);
    });
    if (overlaps) {
      alert("This slot overlaps with an existing slot.");
      return;
    }
    setTimeslots((t) => [...t, draftSlot]);
    setDraftSlot({ start: "", end: "" });
  };

  const removeSlot = (idx) => {
    setTimeslots((t) => t.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitErr("");

    if (!form.title.trim()) return setSubmitErr("Please enter a meeting name.");
    if (!form.parentId) return setSubmitErr("Please select a parent.");
    if (timeslots.length === 0)
      return setSubmitErr("Please add at least one timeslot.");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      parentId: form.parentId,
      timeslots: timeslots.map((s) => ({
        start: new Date(s.start).toISOString(),
        end: new Date(s.end).toISOString(),
      })),
    };

    console.log("CREATE_MEETING_PAYLOAD", payload);
    // When ready, persist to DB via backend:
    // await api.post("/meetings", payload, { withCredentials: true });

    setShowModal(false);
    setForm({ title: "", description: "", parentId: "" });
    setTimeslots([]);
    setDraftSlot({ start: "", end: "" });
    alert("Meeting form submitted to console (DB save not wired yet).");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Meeting Scheduling</h1>

      <div className="mt-6">
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 active:scale-[0.99] transition"
        >
          Create Meeting
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          {/* dialog — dark gray background */}
          <div className="relative z-10 w-full max-w-2xl rounded-xl shadow-lg p-6 bg-gray-900 text-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Meeting</h2>
              <button
                className="text-gray-300 hover:text-white"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Meeting Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Meeting Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g., Term 2 Check-in"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Optional details for the parent..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              {/* Parent select (from DB via backend) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Select Parent
                </label>
                <div className="flex items-center gap-3">
                  <select
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form.parentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, parentId: e.target.value }))
                    }
                    disabled={loadingParents || !!errorParents}
                  >
                    <option value="">
                      {loadingParents
                        ? "Loading parents..."
                        : errorParents
                        ? "Error loading parents"
                        : "Choose a parent"}
                    </option>
                    {parents.map((p) => (
                      <option
                        key={p.id || p._id}
                        value={p.id || p._id}
                        className="bg-gray-900"
                      >
                        {p.name ||
                          [p.firstName, p.lastName].filter(Boolean).join(" ") ||
                          p.email ||
                          "Unnamed Parent"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoadingParents(true);
                        setErrorParents("");
                        const res = await api.get("/parents", {
                          withCredentials: true,
                        });
                        setParents(res.data || []);
                      } catch (err) {
                        console.error(err);
                        setErrorParents("Could not load parents.");
                      } finally {
                        setLoadingParents(false);
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                  >
                    Refresh
                  </button>
                </div>
                {errorParents && (
                  <p className="text-sm text-red-400 mt-1">{errorParents}</p>
                )}
              </div>

              {/* Timeslot adder */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Add Time Slots
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">
                      Start
                    </span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={draftSlot.start}
                      onChange={(e) =>
                        setDraftSlot((d) => ({ ...d, start: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 mb-1">End</span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={draftSlot.end}
                      onChange={(e) =>
                        setDraftSlot((d) => ({ ...d, end: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    disabled={!canAddDraft}
                    onClick={addDraftSlot}
                    className={`px-4 py-2 rounded-lg shadow ${
                      canAddDraft
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Add Slot
                  </button>
                </div>

                {timeslots.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">
                      Proposed Time Slots ({timeslots.length})
                    </h4>
                    <ul className="space-y-2">
                      {timeslots.map((s, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                        >
                          <span className="text-sm">
                            {formatLocal(s.start)} — {formatLocal(s.end)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSlot(idx)}
                            className="text-red-400 hover:underline text-sm"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {submitErr && (
                <p className="text-red-400 text-sm -mt-2">{submitErr}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow"
                >
                  Save Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatLocal(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

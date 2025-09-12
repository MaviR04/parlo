// src/pages/Availability.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import MeetingModal from "../components/MeetingModal"; // reuse the modal if needed

const DAYS = [
  { label: "Mon", full: "Monday", value: 1 },
  { label: "Tue", full: "Tuesday", value: 2 },
  { label: "Wed", full: "Wednesday", value: 3 },
  { label: "Thu", full: "Thursday", value: 4 },
  { label: "Fri", full: "Friday", value: 5 },
  { label: "Sat", full: "Saturday", value: 6 },
  { label: "Sun", full: "Sunday", value: 0 },
];

export default function Availability({ user }) {
  const [activeDay, setActiveDay] = useState(1); // Monday by default
  const [slotsByDay, setSlotsByDay] = useState({});
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // meetings state
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // fetch availability slots
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await api.get("/availability/me", { withCredentials: true });
        const slots = res.data?.slots || [];
        const grouped = slots.reduce((acc, s) => {
          const w = Number(s.weekday);
          (acc[w] ||= []).push({ start: s.start_time, end: s.end_time });
          return acc;
        }, {});
        for (const k of Object.keys(grouped)) {
          grouped[k].sort((a, b) =>
            a.start < b.start ? -1 : a.start > b.start ? 1 : 0
          );
        }
        setSlotsByDay(grouped);
      } catch (e) {
        console.error("availability load error", e);
        setErr("Could not load your availability.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // fetch accepted meetings
  useEffect(() => {
    const loadMeetings = async () => {
      try {
        setLoadingMeetings(true);
        const res = await api.get("/availability/my-meetings", {
          withCredentials: true,
        });
        setMeetings(res.data?.meetings || []);
      } catch (e) {
        console.error("load meetings error", e.message);
      } finally {
        setLoadingMeetings(false);
      }
    };
    loadMeetings();
  }, []);

  const daySlots = slotsByDay[activeDay] || [];

  const canAdd = useMemo(() => {
    if (!draft.start || !draft.end) return false;
    return draft.start < draft.end;
  }, [draft]);

  const hmToMin = (hm) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const overlaps = (a, b) =>
    Math.max(hmToMin(a.start), hmToMin(b.start)) <
    Math.min(hmToMin(a.end), hmToMin(b.end));

  const addSlot = () => {
    if (!canAdd) return;
    if (daySlots.some((s) => overlaps(s, draft))) {
      alert("This slot overlaps an existing one.");
      return;
    }
    const next = [...daySlots, draft].sort((a, b) =>
      a.start < b.start ? -1 : 1
    );
    setSlotsByDay((o) => ({ ...o, [activeDay]: next }));
    setDraft({ start: "", end: "" });
  };

  const removeSlot = (idx) => {
    const next = daySlots.filter((_, i) => i !== idx);
    setSlotsByDay((o) => ({ ...o, [activeDay]: next }));
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      setErr("");
      const payload = [];
      for (const [weekdayStr, slots] of Object.entries(slotsByDay)) {
        const weekday = Number(weekdayStr);
        for (const s of slots) {
          payload.push({ weekday, start: s.start, end: s.end });
        }
      }
      await api.post(
        "/availability/replace",
        { slots: payload },
        { withCredentials: true }
      );
      alert("Availability saved!");
    } catch (e) {
      console.error("save availability error", e);
      setErr(e?.response?.data?.error || "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  const deleteMeeting = async (meetingId) => {
    try {
      await api.delete(`/api/meetings/teacher/${meetingId}`, { withCredentials: true });
      setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
    } catch (e) {
      console.error("delete meeting error", e);
      alert("Could not delete meeting.");
    }
  };

  if (!["Teacher", "Coach"].includes(user?.userRole)) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Availability</h1>
        <p className="text-sm text-gray-600 mt-2">
          Only teachers and coaches can edit availability.
        </p>
      </div>
    );
  }

  const activeDayObj = DAYS.find((d) => d.value === activeDay);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">My Weekly Availability</h1>
      <p className="text-gray-700 mb-6">
        Select the times you’re free for meetings.
      </p>

      {err && <div className="mb-4 text-red-600 text-sm">{err}</div>}

      {/* Days row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DAYS.map((d) => (
          <button
            key={d.value}
            onClick={() => setActiveDay(d.value)}
            className={`px-4 py-2 rounded-full font-medium transition ${
              activeDay === d.value
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Slot editor */}
      <div className="rounded-xl border p-4 bg-white">
        <h2 className="font-semibold mb-3 text-gray-900">
          {activeDayObj?.full || activeDayObj?.label} — Time Slots
        </h2>

        {daySlots.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2">
            {daySlots.map((s, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-900 font-semibold shadow-sm"
              >
                <span className="text-sm">
                  {s.start} – {s.end}
                </span>
                <button
                  className="text-blue-800 hover:underline text-xs"
                  onClick={() => removeSlot(idx)}
                  title="Remove"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            No slots yet for this day.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Start</label>
            <input
              type="time"
              value={draft.start}
              onChange={(e) =>
                setDraft((d) => ({ ...d, start: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">End</label>
            <input
              type="time"
              value={draft.end}
              onChange={(e) =>
                setDraft((d) => ({ ...d, end: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <button
            type="button"
            onClick={addSlot}
            disabled={!canAdd}
            className={`px-4 h-[42px] rounded-lg shadow font-medium ${
              canAdd
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow font-semibold"
        >
          {saving ? "Saving..." : "Confirm & Save"}
        </button>
        {loading && <span className="text-sm text-gray-600">Loading…</span>}
      </div>

      {/* Meetings list */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">My Accepted Meetings</h2>
        {loadingMeetings ? (
          <p className="text-gray-600">Loading meetings…</p>
        ) : meetings.length > 0 ? (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div
                key={m.meeting_id}
                className="p-4 border rounded-lg shadow-sm bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">
                    With: {m.parent_name || "Parent"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {DAYS[m.weekday]?.full || "Unknown"} — {m.start_time} to {m.end_time}
                  </p>
                  <p className="text-xs text-gray-500">Status: {m.status}</p>
                </div>

                <button
                  onClick={() => deleteMeeting(m.meeting_id)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No accepted meetings yet.</p>
        )}
      </div>
    </div>
  );
}

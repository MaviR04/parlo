// src/pages/Availability.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";

const DAYS = [
  { label: "Mon", full: "Monday", value: 1 },
  { label: "Tue", full: "Tuesday", value: 2 },
  { label: "Wed", full: "Wednesday", value: 3 },
  { label: "Thu", full: "Thursday", value: 4 },
  { label: "Fri", full: "Friday", value: 5 },
  { label: "Sat", full: "Saturday", value: 6 },
  { label: "Sun", full: "Sunday", value: 0 },
];

// ------------------ Helper UI Components ------------------

function DaySelector({ activeDay, setActiveDay }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {DAYS.map((d) => (
        <button
          key={d.value}
          onClick={() => setActiveDay(d.value)}
          className={`px-4 py-2 rounded-full font-medium transition ${
            activeDay === d.value
              ? "bg-blue-600 text-white shadow-md"
              : "bg-gray-100 text-gray-900 hover:bg-gray-200"
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function SlotList({ slots, removeSlot }) {
  if (slots.length === 0) {
    return <p className="text-sm text-gray-700 mb-4">No slots yet for this day.</p>;
  }
  return (
    <ul className="mb-4 flex flex-wrap gap-2">
      {slots.map((s, idx) => (
        <li
          key={idx}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-900 font-semibold shadow-sm"
        >
          <span className="text-sm">{s.start} – {s.end}</span>
          <button
            className="text-blue-800 hover:underline text-xs"
            onClick={() => removeSlot(idx)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function MeetingList({ meetings, deleteMeeting }) {
  if (meetings.length === 0) {
    return <p className="text-gray-700">No accepted meetings yet.</p>;
  }
  return (
    <div className="space-y-3">
      {meetings.map((m) => (
        <div
          key={m.meeting_id}
          className="p-4 border rounded-lg shadow-sm bg-white flex justify-between items-center"
        >
          <div className="text-gray-900">
            <p className="font-semibold text-xl">{m.title}</p>
            <p className="font-medium">With: {m.parent_name || "Parent"}</p>
            <p className="font-medium">{m.description}</p>
            <p className="text-sm">
              {DAYS[m.weekday]?.full || "Unknown"} — {m.start_time} to {m.end_time}
            </p>
            <p className="text-xs text-gray-600">Status: {m.status}</p>
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
  );
}

// ------------------ Main Component ------------------

export default function Availability({ user }) {
  const [activeDay, setActiveDay] = useState(1);
  const [slotsByDay, setSlotsByDay] = useState({});
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // -------- Fetch availability slots --------
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/availability/me", { withCredentials: true });
        const slots = res.data?.slots || [];

        const grouped = slots.reduce((acc, s) => {
          const w = Number(s.weekday);
          (acc[w] ||= []).push({ start: s.start_time, end: s.end_time });
          return acc;
        }, {});

        for (const k of Object.keys(grouped)) {
          grouped[k].sort((a, b) => (a.start < b.start ? -1 : 1));
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

  // -------- Fetch meetings --------
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
  const canAdd = useMemo(() => draft.start && draft.end && draft.start < draft.end, [draft]);

  const hmToMin = (hm) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  const overlaps = (a, b) =>
    Math.max(hmToMin(a.start), hmToMin(b.start)) < Math.min(hmToMin(a.end), hmToMin(b.end));

  // -------- Actions --------
  const addSlot = () => {
    if (!canAdd) return;
    if (daySlots.some((s) => overlaps(s, draft))) {
      alert("This slot overlaps an existing one.");
      return;
    }
    const next = [...daySlots, draft].sort((a, b) => (a.start < b.start ? -1 : 1));
    setSlotsByDay((o) => ({ ...o, [activeDay]: next }));
    setDraft({ start: "", end: "" });
  };

  const removeSlot = (idx) =>
    setSlotsByDay((o) => ({ ...o, [activeDay]: daySlots.filter((_, i) => i !== idx) }));

  const saveAll = async () => {
    try {
      setSaving(true);
      const payload = Object.entries(slotsByDay).flatMap(([weekdayStr, slots]) =>
        slots.map((s) => ({ weekday: Number(weekdayStr), start: s.start, end: s.end }))
      );
      await api.post("/availability/replace", { slots: payload }, { withCredentials: true });
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

  // -------- Restrict non-teachers/coaches --------
  if (!["Teacher", "Coach"].includes(user?.userRole)) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-white">Availability</h1>
        <p className="text-sm text-white mt-2">
          Only teachers and coaches can edit availability.
        </p>
      </div>
    );
  }

  const activeDayObj = DAYS.find((d) => d.value === activeDay);

  // ------------------ Render ------------------
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2 text-white">My Weekly Availability</h1>
      <p className="mb-6 text-white">Select the times you’re free for meetings.</p>

      {err && <div className="mb-4 text-red-400 text-sm">{err}</div>}

      <DaySelector activeDay={activeDay} setActiveDay={setActiveDay} />

      {/* Slot editor */}
      <div className="rounded-xl border p-4 bg-white">
        <h2 className="font-semibold mb-3 text-gray-900">
          {activeDayObj?.full || activeDayObj?.label} — Time Slots
        </h2>
        <SlotList slots={daySlots} removeSlot={removeSlot} />

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Start</label>
            <input
              type="time"
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">End</label>
            <input
              type="time"
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
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

      {/* Save button */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow font-semibold"
        >
          {saving ? "Saving..." : "Confirm & Save"}
        </button>
        {loading && <span className="text-sm text-gray-200">Loading…</span>}
      </div>

      {/* Meetings list */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4 text-white">My Accepted Meetings</h2>
        {loadingMeetings ? (
          <p className="text-white">Loading meetings…</p>
        ) : (
          <MeetingList meetings={meetings} deleteMeeting={deleteMeeting} />
        )}
      </div>
    </div>
  );
}

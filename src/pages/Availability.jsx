import { useEffect, useMemo, useState } from "react";
import api from "../axios";

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function Availability({ user }) {
  const [activeDay, setActiveDay] = useState(1); // Monday by default
  // state shape: { [weekday]: [{start:"HH:MM", end:"HH:MM"}] }
  const [slotsByDay, setSlotsByDay] = useState({});
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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
        // sort each day's slots by start
        for (const k of Object.keys(grouped)) {
          grouped[k].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
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

  const daySlots = slotsByDay[activeDay] || [];

  const canAdd = useMemo(() => {
    if (!draft.start || !draft.end) return false;
    return draft.start < draft.end;
  }, [draft]);

  const overlaps = (a, b) => Math.max(hmToMin(a.start), hmToMin(b.start)) < Math.min(hmToMin(a.end), hmToMin(b.end));
  const hmToMin = (hm) => {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };

  const addSlot = () => {
    if (!canAdd) return;
    // prevent overlap in the same day
    if (daySlots.some((s) => overlaps(s, draft))) {
      alert("This slot overlaps an existing one.");
      return;
    }
    const next = [...daySlots, draft].sort((a, b) => (a.start < b.start ? -1 : 1));
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
      // flatten to array that backend expects
      const payload = [];
      for (const [weekdayStr, slots] of Object.entries(slotsByDay)) {
        const weekday = Number(weekdayStr);
        for (const s of slots) {
          payload.push({ weekday, start: s.start, end: s.end });
        }
      }
      await api.post("/availability/replace", { slots: payload }, { withCredentials: true });
      alert("Availability saved!");
    } catch (e) {
      console.error("save availability error", e);
      setErr("Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  if (user?.userRole !== "Teacher") {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Availability</h1>
        <p className="text-sm text-gray-600 mt-2">Only teachers can edit availability.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">My Weekly Availability</h1>
      <p className="text-gray-600 mb-6">Select the times you’re free for meetings.</p>

      {err && <div className="mb-4 text-red-600 text-sm">{err}</div>}

      {/* Days row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {DAYS.map((d) => (
          <button
            key={d.value}
            onClick={() => setActiveDay(d.value)}
            className={`px-3 py-2 rounded-lg border ${
              activeDay === d.value ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Slot editor for active day */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium mb-3">
          {DAYS.find((d) => d.value === activeDay)?.label} — Time Slots
        </h2>

        {/* Existing slots (tags) */}
        {daySlots.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2">
            {daySlots.map((s, idx) => (
              <li key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                <span className="text-sm font-medium">{s.start}–{s.end}</span>
                <button
                  className="text-blue-700 hover:underline text-xs"
                  onClick={() => removeSlot(idx)}
                  title="Remove"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No slots yet for this day.</p>
        )}

        {/* Add slot */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start</label>
            <input
              type="time"
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End</label>
            <input
              type="time"
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={addSlot}
            disabled={!canAdd}
            className={`px-4 h-[42px] rounded-lg shadow ${
              canAdd ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-500 cursor-not-allowed"
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
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow"
        >
          {saving ? "Saving..." : "Confirm & Save"}
        </button>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
      </div>
    </div>
  );
}

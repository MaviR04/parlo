// src/pages/MeetingScheduling.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { useNavigate } from "react-router-dom";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function dayLabel(w) {
  return DAYS.find(d => d.value === Number(w))?.label ?? `Day ${w}`;
}

export default function MeetingScheduling({ user }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  // parent-only guard
  useEffect(() => {
    if (user?.userRole && user.userRole !== "Parent") {
      // not a parent — bounce out (or you could hide the nav link already)
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    teacherId: "",
  });

  // teachers
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [errTeachers, setErrTeachers] = useState("");

  // availability for selected teacher
  const [avail, setAvail] = useState([]); // [{weekday, start_time, end_time}]
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [errAvail, setErrAvail] = useState("");

  // selected slot (one)
  const [selectedSlotKey, setSelectedSlotKey] = useState(""); // `${weekday}|${start}|${end}`

  // fetch teachers (DB via backend)
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      setErrTeachers("");
      try {
        // Adjust path to your real endpoint (examples below).
        // Common options:
        //  - "/teachers"
        //  - "/api/teachers"
        //  - "/users?role=Teacher"
        const res = await api.get("/teachers", { withCredentials: true });
        // expected shape: array of { id/ userid, name/ fname+lname, email }
        const list = Array.isArray(res.data) ? res.data : (res.data?.teachers ?? []);
        setTeachers(list);
      } catch (e) {
        console.error("load teachers error", e);
        setErrTeachers("Could not load teachers.");
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();
  }, []);

  // when teacher changes, fetch availability
  useEffect(() => {
    const tId = form.teacherId;
    if (!tId) {
      setAvail([]);
      setSelectedSlotKey("");
      return;
    }
    const loadAvail = async () => {
      setLoadingAvail(true);
      setErrAvail("");
      setAvail([]);
      setSelectedSlotKey("");
      try {
        // We’ll expose a backend route to read a teacher’s availability by id
        // GET /availability/for/:teacherId -> [{weekday,start_time,end_time}]
        const res = await api.get(`/availability/for/${tId}`, { withCredentials: true });
        const rows = res.data?.slots ?? res.data ?? [];
        // sort by day + start_time
        rows.sort((a, b) => {
          const d = Number(a.weekday) - Number(b.weekday);
          if (d !== 0) return d;
          return (a.start_time < b.start_time) ? -1 : (a.start_time > b.start_time) ? 1 : 0;
        });
        setAvail(rows);
      } catch (e) {
        console.error("load availability error", e);
        setErrAvail("Could not load availability for this teacher.");
      } finally {
        setLoadingAvail(false);
      }
    };
    loadAvail();
  }, [form.teacherId]);

  const canSubmit = useMemo(() => {
    return (
      user?.userRole === "Parent" &&
      form.title.trim().length > 0 &&
      form.teacherId &&
      selectedSlotKey
    );
  }, [user, form.title, form.teacherId, selectedSlotKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const [weekdayStr, start, end] = selectedSlotKey.split("|");
    const weekday = Number(weekdayStr);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      teacherId: form.teacherId,
      // In the future you’ll likely also add the parentId (from session) server-side
      requestedSlot: { weekday, start, end }, // "HH:MM"
    };

    console.log("PARENT_CREATE_MEETING_PAYLOAD", payload);

    // Wire this when your backend is ready:
    // await api.post("/meetings", payload, { withCredentials: true });

    setShowModal(false);
    setForm({ title: "", description: "", teacherId: "" });
    setAvail([]);
    setSelectedSlotKey("");
    alert("Meeting request captured in console (backend save not wired yet).");
  };

  const teacherDisplay = (t) =>
    t.name ||
    [t.fname, t.lname].filter(Boolean).join(" ") ||
    t.email ||
    `Teacher ${t.id || t.userid}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Meeting Scheduling</h1>
      <p className="text-gray-700 mb-6">
        Create a meeting request by selecting a teacher and one of their available time slots.
      </p>

      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
      >
        Create Meeting
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          {/* dialog — dark gray */}
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
                <label className="block text-sm font-medium mb-1">Meeting Name</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g., Parent–Teacher Check-in"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Anything specific you'd like to discuss..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              {/* Select Teacher */}
              <div>
                <label className="block text-sm font-medium mb-1">Select Teacher</label>
                <div className="flex items-center gap-3">
                  <select
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form.teacherId}
                    onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                    disabled={loadingTeachers || !!errTeachers}
                  >
                    <option value="">
                      {loadingTeachers
                        ? "Loading teachers..."
                        : errTeachers
                        ? "Error loading teachers"
                        : "Choose a teacher"}
                    </option>
                    {teachers.map((t) => (
                      <option
                        key={t.userid || t.id || t._id}
                        value={t.userid || t.id || t._id}
                        className="bg-gray-900"
                      >
                        {teacherDisplay(t)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setLoadingTeachers(true);
                        setErrTeachers("");
                        const res = await api.get("/teachers", { withCredentials: true });
                        const list = Array.isArray(res.data) ? res.data : (res.data?.teachers ?? []);
                        setTeachers(list);
                      } catch (e) {
                        console.error(e);
                        setErrTeachers("Could not load teachers.");
                      } finally {
                        setLoadingTeachers(false);
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 hover:bg-gray-700"
                  >
                    Refresh
                  </button>
                </div>
                {errTeachers && (
                  <p className="text-sm text-red-400 mt-1">{errTeachers}</p>
                )}
              </div>

              {/* Available time slots */}
              <div>
                <label className="block text-sm font-medium mb-2">Available time slots</label>

                {!form.teacherId ? (
                  <p className="text-sm text-gray-400">Select a teacher to see their availability.</p>
                ) : loadingAvail ? (
                  <p className="text-sm text-gray-400">Loading availability…</p>
                ) : errAvail ? (
                  <p className="text-sm text-red-400">{errAvail}</p>
                ) : avail.length === 0 ? (
                  <p className="text-sm text-gray-400">No available slots for this teacher.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-auto pr-1">
                    {groupByDay(avail).map(({ weekday, slots }) => (
                      <div key={weekday} className="border border-gray-800 rounded-lg">
                        <div className="px-3 py-2 bg-gray-800 text-gray-100 font-semibold rounded-t-lg">
                          {dayLabel(weekday)}
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          {slots.map(({ start_time, end_time }, i) => {
                            const key = `${weekday}|${start_time}|${end_time}`;
                            const selected = selectedSlotKey === key;
                            return (
                              <button
                                type="button"
                                key={key}
                                onClick={() => setSelectedSlotKey(key)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition
                                  ${selected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900 hover:bg-gray-300"}`}
                                title={`${start_time} – ${end_time}`}
                              >
                                {start_time} – {end_time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
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
                  disabled={!canSubmit}
                  className={`px-4 py-2 rounded-lg shadow ${
                    canSubmit
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
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

// group availability rows by weekday
function groupByDay(rows) {
  const m = new Map();
  for (const r of rows) {
    const day = Number(r.weekday);
    if (!m.has(day)) m.set(day, []);
    m.get(day).push({ start_time: r.start_time, end_time: r.end_time });
  }
  // sort slots within day by start_time just in case
  return Array.from(m.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, slots]) => ({
      weekday,
      slots: slots.sort((x, y) => (x.start_time < y.start_time ? -1 : 1)),
    }));
}

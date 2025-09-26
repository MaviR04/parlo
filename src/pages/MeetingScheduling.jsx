// src/pages/MeetingScheduling.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../axios";
import { useNavigate } from "react-router-dom";
import MeetingModal from "../components/MeetingModal";


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
  return DAYS.find((d) => d.value === Number(w))?.label ?? `Day ${w}`;
}

export default function MeetingScheduling({ user }) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  // parent-only guard
  useEffect(() => {
    if (user?.userRole && user.userRole !== "Parent") {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    teacherId: "",
  });

  // teachers list
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [errTeachers, setErrTeachers] = useState("");

  // availability
  const [avail, setAvail] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [errAvail, setErrAvail] = useState("");

  // selected slot
  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  // meetings list
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // load teachers
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      setErrTeachers("");
      try {
        const res = await api.get("/users", { withCredentials: true });
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.users ?? [];
        setTeachers(list);
      } catch (e) {
        console.error("load users error", e);
        setErrTeachers("Could not load teachers and coaches.");
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();
  }, []);

  // load meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const res = await api.get("/api/meetings/mine", { withCredentials: true });
        setMeetings(res.data?.meetings ?? []);
        console.log("Loaded meetings:", res.data?.meetings ?? []);
      } catch (e) {
        console.error("load meetings error", e);
      }
    };
    fetchMeetings();
  }, []);

  // teacher availability
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
        const res = await api.get(`/availability/for/${tId}`, {
          withCredentials: true,
        });
        const rows = res.data?.slots ?? res.data ?? [];
        rows.sort((a, b) => {
          const d = Number(a.weekday) - Number(b.weekday);
          if (d !== 0) return d;
          return a.start_time < b.start_time ? -1 : 1;
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

  // create meeting
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const [weekdayStr, start, end] = selectedSlotKey.split("|");
    const weekday = Number(weekdayStr);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      teacherId: form.teacherId,
      parentId: user.userid,
      weekday,
      start_time: start,
      end_time: end,
    };

    try {
      const res = await api.post("/api/meetings", payload, {
        withCredentials: true,
      });

      if (res.data?.meeting) {
        setAvail((prev) =>
          prev.filter(
            (slot) =>
              !(
                slot.weekday === weekday &&
                slot.start_time === start &&
                slot.end_time === end
              )
          )
        );
        setForm({ title: "", description: "", teacherId: form.teacherId });
        setSelectedSlotKey("");
        setShowModal(false);
        setMeetings((prev) => [...prev, res.data.meeting]);

      }
    } catch (err) {
      console.error("Booking error:", err);
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    try {
      await api.delete(`/api/meetings/${meetingId}`, {
        withCredentials: true,
      });
      setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      setSelectedMeeting(null);
    } catch (e) {
      console.error("Delete meeting error", e);
    }
  };


  const teacherDisplay = (t) =>
    t.name ||
    [t.fname, t.lname].filter(Boolean).join(" ") ||
    t.email ||
    `${t.role === "Teacher" ? "Teacher" : "Coach"} ${t.id || t.userid}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Meeting Scheduling</h1>
      <p className="text-gray-700 mb-6">
        Create a meeting request by selecting a teacher and one of their
        available time slots. 
      </p>

      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors"
      >
        Create Meeting
      </button>

      {/* Meeting list */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-3">Your Meetings</h2>
        {meetings.length === 0 ? (
          <p className="text-gray-500">No meetings booked yet.</p>
        ) : (
          <div>
            <p className="text-gray-500 mb-2">Please note that cancellations may only happen 6 hours in advance</p>
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li
                  key={m.meeting_id}
                  className="p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-white hover:text-black transition-colors"
                  onClick={() => setSelectedMeeting(m)}
                >
                  <div className="font-medium">{m.title || "Untitled"}</div>
                  <div className="text-sm text-gray-600">
                    {dayLabel(m.weekday)} {m.start_time} – {m.end_time}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Create Meeting Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-xl shadow-lg p-6 bg-gray-900 text-gray-100 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Meeting</h2>
              <button
                className="text-gray-300 hover:text-white"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:space-x-4">
                {/* Meeting Name */}
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Meeting Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2"
                    placeholder="e.g., Parent–Teacher Check-in"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                </div>
                {/* Teacher select */}
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Select Teacher or Coach
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2"
                    value={form.teacherId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, teacherId: e.target.value }))
                    }
                    disabled={loadingTeachers || !!errTeachers}
                  >
                    <option value="">
                      {loadingTeachers
                        ? "Loading..."
                        : errTeachers || "Choose a teacher or coach"}
                    </option>
                    {teachers.map((t) => (
                      <option
                        key={t.userid || t.id}
                        value={t.userid || t.id}
                        className="bg-gray-900"
                      >
                        {teacherDisplay(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2"
                  placeholder="Anything specific you'd like to discuss..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              {/* Available slots */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Available time slots
                </label>
                {avail.length === 0 ? (
                  <p className="text-sm text-gray-400">No slots available.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-auto pr-1">
                    {groupByDay(avail).map(({ weekday, slots }) => (
                      <div
                        key={weekday}
                        className="border border-gray-800 rounded-lg"
                      >
                        <div className="px-3 py-2 bg-gray-800 font-semibold rounded-t-lg">
                          {dayLabel(weekday)}
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          {slots.map(({ start_time, end_time }) => {
                            const key = `${weekday}|${start_time}|${end_time}`;
                            const selected = selectedSlotKey === key;
                            return (
                              <button
                                type="button"
                                key={key}
                                onClick={() => setSelectedSlotKey(key)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                                  selected
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-200 text-gray-900"
                                }`}
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

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white hover:bg-white hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`px-4 py-2 rounded-lg shadow transition-colors border border-blue-600 ${
                    canSubmit
                      ? "bg-blue-600 text-white hover:bg-white hover:text-blue-600"
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

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <MeetingModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          // IMPORTANT: onDeleted should only update UI (modal will perform the API call with reason)
          onDeleted={(id) => {
            setMeetings((prev) => prev.filter((m) => m.meeting_id !== id));
            setSelectedMeeting(null);
          }}
        />
      )}
    </div>
  );
}

function groupByDay(rows) {
  const m = new Map();
  for (const r of rows) {
    const day = Number(r.weekday);
    if (!m.has(day)) m.set(day, []);
    m.get(day).push({ start_time: r.start_time, end_time: r.end_time });
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, slots]) => ({
      weekday,
      slots: slots.sort((x, y) => (x.start_time < y.start_time ? -1 : 1)),
    }));
}

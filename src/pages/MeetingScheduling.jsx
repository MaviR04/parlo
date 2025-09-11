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
  // NEW: State for storing the list of meetings and their loading status
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [errMeetings, setErrMeetings] = useState("");
  // NEW: State for the meeting details modal
  const [showMeetingDetailsModal, setShowMeetingDetailsModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

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

  // users (both teachers and coaches)
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [errTeachers, setErrTeachers] = useState("");

  // availability for selected teacher
  const [avail, setAvail] = useState([]); // [{weekday, start_time, end_time}]
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [errAvail, setErrAvail] = useState("");

  // selected slot (one)
  const [selectedSlotKey, setSelectedSlotKey] = useState(""); // `${weekday}|${start}|${end}`

  // fetch users (both teachers and coaches) from DB via backend
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      setErrTeachers("");
      try {
        const res = await api.get("/users", { withCredentials: true });
        const list = Array.isArray(res.data) ? res.data : res.data?.users ?? [];
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

  // NEW: useEffect to fetch meetings for the logged-in parent
  const fetchMeetings = async () => {
    if (!user?.userid) return;
    setLoadingMeetings(true);
    setErrMeetings("");
    try {
      // The backend route will be `/api/meetings/parent/:parentId`
      const res = await api.get(`/api/meetings/parent/${user.userid}`, { withCredentials: true });
      const meetingsList = Array.isArray(res.data) ? res.data : res.data?.meetings ?? [];
      setMeetings(meetingsList);
    } catch (e) {
      console.error("load meetings error", e);
      setErrMeetings("Could not load your meetings.");
    } finally {
      setLoadingMeetings(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [user]);

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
        const res = await api.get(`/availability/for/${tId}`, { withCredentials: true });
        const rows = res.data?.slots ?? res.data ?? [];
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
      parentId: user.userid, // assuming the logged-in parent ID is in user.userid
      weekday,
      start_time: start,
      end_time: end,
    };

    try {
      const res = await api.post("/api/meetings", payload, { withCredentials: true });
      
      if (res.data?.meeting) {
        // remove booked slot from available slots immediately
        setAvail((prev) =>
          prev.filter(
            (slot) =>
              !(slot.weekday === weekday && slot.start_time === start && slot.end_time === end)
          )
        );

        setSelectedSlotKey(""); // clear selection
        setForm({ title: "", description: "", teacherId: form.teacherId }); // reset form except teacher
        // NEW: Refresh the meetings list after a successful booking
        fetchMeetings();
        alert("Meeting successfully booked!");
      } else {
        alert("Failed to book meeting");
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Error booking meeting");
    }
  };

  // NEW: Function to open the details modal
  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
    setShowMeetingDetailsModal(true);
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
        Create a meeting request by selecting a teacher and one of their available time slots.
      </p>

      <button
        onClick={() => setShowModal(true)}
        className="px-5 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
      >
        Create Meeting
      </button>

      {/* NEW: Section for displaying the list of meetings */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Created Meetings</h2>
        {loadingMeetings ? (
          <p className="text-gray-500">Loading your meetings...</p>
        ) : errMeetings ? (
          <p className="text-red-500">{errMeetings}</p>
        ) : meetings.length === 0 ? (
          <p className="text-gray-500">You have not created any meetings yet.</p>
        ) : (
          <ul className="space-y-4">
            {meetings.map((meeting) => (
              <li
                key={meeting.id}
                onClick={() => handleMeetingClick(meeting)}
                className="p-4 border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-100 transition"
              >
                <div className="font-medium text-lg">{meeting.title}</div>
                <div className="text-sm text-gray-600">
                  With {meeting.teacher_name}
                </div>
                <div className="text-sm text-gray-600">
                  {dayLabel(meeting.weekday)} from {meeting.start_time} to {meeting.end_time}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal for creating a meeting (existing) */}
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

              {/* Select Teacher or Coach */}
              <div>
                <label className="block text-sm font-medium mb-1">Select Teacher or Coach</label>
                <div className="flex items-center gap-3">
                  <select
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={form.teacherId}
                    onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                    disabled={loadingTeachers || !!errTeachers}
                  >
                    <option value="">
                      {loadingTeachers
                        ? "Loading teachers and coaches..."
                        : errTeachers
                        ? "Error loading teachers and coaches"
                        : "Choose a teacher or coach"}
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
                        const res = await api.get("/users", { withCredentials: true });
                        const list = Array.isArray(res.data) ? res.data : (res.data?.users ?? []);
                        setTeachers(list);
                      } catch (e) {
                        console.error(e);
                        setErrTeachers("Could not load teachers and coaches.");
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
                  <p className="text-sm text-gray-400">Select a teacher or coach to see their availability.</p>
                ) : loadingAvail ? (
                  <p className="text-sm text-gray-400">Loading availability…</p>
                ) : errAvail ? (
                  <p className="text-sm text-red-400">{errAvail}</p>
                ) : avail.length === 0 ? (
                  <p className="text-sm text-gray-400">No available slots for this teacher/coach.</p>
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

      {/* NEW: Modal for displaying meeting details */}
      {showMeetingDetailsModal && selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowMeetingDetailsModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl shadow-lg p-6 bg-gray-900 text-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Meeting Details</h2>
              <button
                className="text-gray-300 hover:text-white"
                onClick={() => setShowMeetingDetailsModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-400">Title</p>
                <p className="text-lg">{selectedMeeting.title}</p>
              </div>
              {selectedMeeting.description && (
                <div>
                  <p className="text-sm font-medium text-gray-400">Description</p>
                  <p>{selectedMeeting.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-400">Teacher</p>
                <p>{selectedMeeting.teacher_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">Scheduled Time</p>
                <p>{dayLabel(selectedMeeting.weekday)}, from {selectedMeeting.start_time} to {selectedMeeting.end_time}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// group availability rows by weekday (existing)
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
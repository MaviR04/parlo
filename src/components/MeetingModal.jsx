// src/components/MeetingModal.jsx
import { useState } from "react";
import api from "../axios";

export default function MeetingModal({ meeting, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!meeting) return null;

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to cancel this meeting?")) return;

    try {
      setLoading(true);
      setError("");
      const res = await api.delete(`/api/meetings/${meeting.id}`, { withCredentials: true });
      if (res.data?.success) {
        onDeleted(meeting.id);
        onClose();
      } else {
        setError("Failed to cancel meeting");
      }
    } catch (err) {
      console.error("Delete meeting error:", err);
      setError("Error canceling meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* modal box */}
      <div className="relative z-10 w-full max-w-lg rounded-xl shadow-lg p-6 bg-white">
        <h2 className="text-xl font-semibold mb-4">{meeting.title || "Untitled Meeting"}</h2>
        <p className="mb-2 text-gray-700">{meeting.description || "No description provided."}</p>

        <div className="mb-3 text-sm text-gray-600">
          <p><strong>Teacher:</strong> {meeting.teacher_fname} {meeting.teacher_lname}</p>
          <p><strong>Email:</strong> {meeting.teacher_email}</p>
          <p><strong>Day:</strong> {meeting.weekday}</p>
          <p><strong>Time:</strong> {meeting.start_time} – {meeting.end_time}</p>
          <p><strong>Status:</strong> {meeting.status}</p>
        </div>

        {error && <p className="text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-400 bg-gray-100 hover:bg-gray-200"
          >
            Close
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete Meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

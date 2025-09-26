// src/components/MeetingModal.jsx
import { useState } from "react";
import api from "../axios";

export default function MeetingModal({ meeting, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");

  if (!meeting) return null;

  const handleStartCancel = () => {
    setError("");
    setReason("");
    setShowCancelForm(true);
  };

  const handleCancelDismiss = () => {
    setShowCancelForm(false);
    setReason("");
    setError("");
  };

  const handleConfirmCancel = async () => {
    if (!reason.trim()) {
      setError("Please enter a cancellation reason.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.delete(`/api/meetings/${meeting.meeting_id}`, {
        data: { reason },
        withCredentials: true,
      });

      if (res.data?.success) {
        // Notify parent to remove the meeting from UI
        if (typeof onDeleted === "function") onDeleted(meeting.meeting_id);
        onClose();
      } else {
        setError(res.data?.message || "Failed to cancel meeting");
      }
    } catch (err) {
      console.error("Delete meeting error:", err);
      const status = err?.response?.status;
      if (status === 403) {
        setError(err?.response?.data?.message || "The meeting cannot be cancelled within 6 hours.");
      } else if (status === 400) {
        setError(err?.response?.data?.message || "Cancellation reason is required.");
      } else {
        setError("Error canceling meeting");
      }
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
        <h2 className="text-2xl font-bold mb-4 text-black">{meeting.title || "Untitled Meeting"}</h2>
        <p className="mb-2 text-black">{meeting.description || "No description provided."}</p>

        <div className="mb-3 text-sm text-black space-y-1">
          <p><strong>Teacher:</strong> {meeting.teacher_fname} {meeting.teacher_lname}</p>
          <p><strong>Email:</strong> {meeting.teacher_email}</p>
          <p><strong>Day:</strong> {meeting.weekday}</p>
          <p><strong>Time:</strong> {meeting.start_time} – {meeting.end_time}</p>
          <p><strong>Status:</strong> {meeting.status || "Active"}</p>
        </div>

        {error && <p className="text-red-600 mb-3">{error}</p>}

        {/* Cancel UI */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 transition-colors border border-gray-500"
          >
            Close
          </button>

          {/* If meeting already cancelled, hide delete controls */}
          {meeting.status !== "Cancelled" && !showCancelForm && (
            <button
              onClick={handleStartCancel}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors border border-red-600"
            >
              Delete Meeting
            </button>
          )}

          {showCancelForm && (
  <div className="w-full mt-4 bg-gray-900 text-white p-4 rounded-lg">
    <textarea
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      placeholder="Enter cancellation reason"
      className="w-full rounded border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm mb-3 placeholder-gray-400"
      rows={3}
    />
    <div className="flex justify-end gap-2">
      <button
        onClick={handleCancelDismiss}
        disabled={loading}
        className="px-3 py-1 rounded border border-gray-600 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
      >
        Dismiss
      </button>
      <button
        onClick={handleConfirmCancel}
        disabled={loading}
        className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded disabled:opacity-50"
      >
        {loading ? "Cancelling..." : "Confirm Cancel"}
      </button>
    </div>
  </div>
)}

        </div>
      </div>
    </div>
  );
}

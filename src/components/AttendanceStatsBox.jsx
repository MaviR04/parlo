export default function AttendanceStatsBox({ stats }) {
  if (!stats) return null;

  const { totalDays, present, absent, late, halfDay, attendancePercent } = stats;

  return (
    <div className="bg-white rounded-xl p-4 shadow-md max-w-md mx-auto my-4">
      <h3 className="text-lg font-semibold mb-2">Attendance Summary</h3>
      <div className="grid grid-cols-2 gap-3 text-gray-700">
        <div><strong>Total School Days:</strong> {totalDays}</div>
        <div><strong>Days Present:</strong> {present}</div>
        <div><strong>Days Absent:</strong> {absent}</div>
        <div><strong>Days Late:</strong> {late}</div>
        <div><strong>Half Days:</strong> {halfDay}</div>
        <div><strong>Attendance %:</strong> {attendancePercent}%</div>
      </div>
    </div>
  );
}

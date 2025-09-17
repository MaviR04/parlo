export default function Attempts({ last_date, attempts }) {
  const dateStr = last_date
    ? new Date(last_date).toLocaleDateString("en-GB")
    : "—";
  const n = Number(attempts) || 0;
  return (
    <div className="text-xs text-gray-500">
      Last: {dateStr}{" • "}{n} {n === 1 ? "assessment" : "assessments"}
    </div>
  );
}
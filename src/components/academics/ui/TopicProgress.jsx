export default function TopicProgress({ pct = 0 }) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
      <div
        className="h-2 rounded-full"
        style={{
          width: `${clamped}%`,
          background: "linear-gradient(90deg, #93c5fd, #3b82f6)",
        }}
      />
    </div>
  );
}
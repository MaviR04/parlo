export default function LogCard({ log, accent }) {
  const date = new Date(log.date).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });

  return (
    <div className="rounded-2xl border shadow-sm p-4 bg-white">
      <div className="flex items-start gap-3">
        <span className="inline-block w-3.5 h-3.5 rounded-full mt-1.5" style={{ backgroundColor: accent }} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{date}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{log.activity_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900 text-white">{log.type}</span>
          </div>

          <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{log.comment || "—"}</p>

          {Array.isArray(log.tags) && log.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {log.tags.map((t, i) => (
                <span key={i}
                  className="px-2 py-0.5 rounded-full text-[11px] text-white"
                  style={{ backgroundColor: t.color || "#6B7280" }}
                  title={t.category ? `${t.name} • ${t.category}` : t.name}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
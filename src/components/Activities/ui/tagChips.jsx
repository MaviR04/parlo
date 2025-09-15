export default function TagChips({ categories, colorMap, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(selected === "" ? "" : "")}
        className={`px-3 py-1 rounded-full text-sm border ${selected==="" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
        All
      </button>
      {categories.map(cat => (
        <button key={cat}
          onClick={() => onSelect(selected === cat ? "" : cat)}
          className={`px-3 py-1 rounded-full text-sm border flex items-center gap-2 ${selected===cat ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorMap[cat] || "#6B7280" }} />
          {cat}
        </button>
      ))}
    </div>
  );
}
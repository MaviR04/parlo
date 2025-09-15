export default function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4">
      {tabs.map(t => (
        <button key={t}
          onClick={() => onChange(t)}
          className={`px-3 py-1 rounded mr-2 capitalize ${active===t ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
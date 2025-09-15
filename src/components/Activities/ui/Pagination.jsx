export default function Pagination({ page, totalPages, total, from, to, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <div className="text-gray-600">
        Showing {from}-{to} of {total}
      </div>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page===1} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Prev</button>
        <span className="px-2 py-1">{page} / {totalPages}</span>
        <button onClick={onNext} disabled={page===totalPages} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
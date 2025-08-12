import React, { useMemo, useState } from "react";

function colorClassForTable(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "bg-green-100";
    if (percent >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

export default function StudentListModal({ open, onClose, assessment, students = [] }) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("name");
    const [sortAsc, setSortAsc] = useState(true);
    const [page, setPage] = useState(1);
    const perPage = 10;

    const filtered = useMemo(() => {
        return students
            .filter((s) =>
                s.name?.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => {
                if (sortKey === "name") {
                    return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
                if (sortKey === "score") {
                    return sortAsc ? a.score - b.score : b.score - a.score;
                }
                return 0;
            });
    }, [students, search, sortKey, sortAsc]);

    const paginated = useMemo(() => {
        const start = (page - 1) * perPage;
        return filtered.slice(start, start + perPage);
    }, [filtered, page]);

    const totalPages = Math.ceil(filtered.length / perPage);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white max-w-3xl w-full rounded-md shadow-lg p-6 overflow-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">
                        Students who took: {assessment.assessment_label} - {assessment.term_name} (Avg: {assessment.average}%)
                    </h2>
                    <button onClick={onClose} className="text-red-500 font-bold text-xl">&times;</button>
                </div>

                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    placeholder="Search student..."
                    className="w-full border mb-4 px-3 py-2 rounded"
                />

                <table className="w-full border text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th
                                className="p-2 border cursor-pointer"
                                onClick={() => {
                                    setSortKey("name");
                                    setSortAsc(sortKey === "name" ? !sortAsc : true);
                                }}
                            >
                                Student {sortKey === "name" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                            <th
                                className="p-2 border cursor-pointer"
                                onClick={() => {
                                    setSortKey("score");
                                    setSortAsc(sortKey === "score" ? !sortAsc : true);
                                }}
                            >
                                Score {sortKey === "score" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                            <th className="p-2 border">Max</th>
                            <th className="p-2 border">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center p-4 text-gray-500">No students found</td>
                            </tr>
                        ) : (
                            paginated.map((s, idx) => (
                                <tr key={idx} className={colorClassForTable(s.score, s.max_score)}>
                                    <td className="p-2 border">{s.name}</td>
                                    <td className="p-2 border">{s.score}</td>
                                    <td className="p-2 border">{s.max_score}</td>
                                    <td className="p-2 border">{((s.score / s.max_score) * 100).toFixed(1)}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}

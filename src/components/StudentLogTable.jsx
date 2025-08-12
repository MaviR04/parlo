import React from "react";

export default function StudentLogTable({ logs, availableTags, currentPage, totalPages, onPageChange, searchTerm, setSearchTerm }) {
    const studentsPerPage = 10;

    const filteredLogs = logs.filter((s) =>
        `${s.fname} ${s.lname}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paginatedLogs = filteredLogs.slice((currentPage - 1) * studentsPerPage, currentPage * studentsPerPage);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <input
                    type="text"
                    placeholder="Search student..."
                    className="border px-3 py-2 rounded"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {totalPages > 1 && (
                    <div className="flex gap-2">
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => onPageChange(i + 1)}
                                className={`px-3 py-1 rounded ${currentPage === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border rounded text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-3 py-2 border">Student</th>
                            <th className="px-3 py-2 border">Rating</th>
                            <th className="px-3 py-2 border">Type</th>
                            <th className="px-3 py-2 border">Badges</th>
                            <th className="px-3 py-2 border">Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedLogs.map((log) => (
                            <tr key={log.childid} className="bg-white">
                                <td className="px-3 py-2 border">{log.fname} {log.lname}</td>
                                <td className="px-3 py-2 border text-center font-semibold">{log.rating || "-"}</td>
                                <td className="px-3 py-2 border text-center">{log.type}</td>
                                <td className="px-3 py-2 border">
                                    <div className="flex flex-wrap gap-1">
                                        {(log.tags || []).map((tagID) => {
                                            const tag = availableTags.find((t) => t.tagid === tagID);
                                            return tag ? (
                                                <span
                                                    key={tag.tagid}
                                                    className="px-2 py-1 rounded text-xs"
                                                    style={{
                                                        backgroundColor: tag.color || "#ccc",
                                                        color: "#fff",
                                                    }}
                                                >
                                                    {tag.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </td>
                                <td className="px-3 py-2 border">
                                    {log.comment?.length > 25 ? (
                                        <span title={log.comment}>{log.comment.slice(0, 25)}...</span>
                                    ) : (
                                        log.comment || "-"
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

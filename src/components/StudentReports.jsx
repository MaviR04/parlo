import { useEffect, useMemo, useState } from "react";
import api from "../axios";

// screen-only row color
function colorClass(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "bg-green-100";
    if (percent >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

export default function StudentReports({ classid, termid, termname }) {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedStudentId, setExpandedStudentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 5;

    useEffect(() => {
        async function fetchReports() {
            if (!classid || !termid) return;
            setLoading(true);
            try {
                const res = await api.get("/teacher/dashboard/student-reports", {
                    params: { classid, termid },
                });
                setStudents(res.data);
                setFilteredStudents(res.data);
                setError("");
            } catch (err) {
                console.error("Failed to fetch student reports", err);
                setError("Failed to load student reports.");
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, [classid, termid]);

    useEffect(() => {
        const filtered = students.filter((s) =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredStudents(filtered);
        setCurrentPage(1);
    }, [searchTerm, students]);

    const indexOfLast = currentPage * studentsPerPage;
    const indexOfFirst = indexOfLast - studentsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirst, indexOfLast);
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

    const student = useMemo(
        () => students.find((s) => s.childid === expandedStudentId) || null,
        [expandedStudentId, students]
    );

    const subjectMap = useMemo(() => {
        if (!student?.grades) return {};
        const m = {};
        for (const g of student.grades) (m[g.subject] ??= []).push(g);
        return m;
    }, [student]);

    const handlePrint = () => {
        if (!student) return; // no student selected
        // Give layout a tick, then print only the .print-area (via CSS)
        setTimeout(() => window.print(), 100);
    };

    const handleDownload = async () => {
        if (!student) return;
        const termLabel = termname || `Term_${termid}`;
        const safe = (s) => String(s || "").replace(/\s+/g, "_").replace(/[^\w\-\.]+/g, "");
        const filename = `${safe(student.name)}_${safe(termLabel)}.pdf`;

        try {
            const res = await api.get(`/teacher/dashboard/student-report-pdf/${student.childid}`, {
                params: { termid },
                responseType: "blob",
            });

            if (!res.headers["content-type"]?.includes("application/pdf")) {
                const text = await res.data.text?.().catch(() => "");
                console.error("Expected PDF, got:", text);
                alert("PDF generation failed.");
                return;
            }

            const blob = res.data;
            const href = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(href);
        } catch (e) {
            console.error("Download error:", e);
            alert("Could not download PDF");
        }
    };


    if (loading) return <p className="text-gray-700">Loading student reports...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (students.length === 0) return <p className="text-gray-600">No students found.</p>;

    return (
        <div className="text-gray-800 bg-white p-6 rounded-lg shadow border border-gray-200">
            {/* PRINT CSS lives here so only the report area prints */}
            <style>{`
        @page { size: A4; margin: 12mm 10mm 14mm 10mm; }
        @media print {
          html, body { height: auto; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font: 12px/1.35 system-ui, Arial, sans-serif; color:#111; }
          /* Hide everything except the print area */
          .screen-only { display: none !important; }
          .print-area { display: block !important; }
          /* Clean table & page breaks */
          .wrap { display:block; width:100%; }
          .section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
          table { width:100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cfd4da; padding: 6px 8px; vertical-align: top; word-break: break-word; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .score-green { background: #e8f5e9; }
          .score-yellow { background: #fff8e1; }
          .score-red { background: #ffebee; }
        }
        /* Screen: don't show print area */
        .print-area { display:none; }
      `}</style>

            {/* Header + global Download button (screen only) */}
            <div className="screen-only flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">👨‍🎓 Student Reports</h2>
                <button
                    onClick={handleDownload}
                    disabled={!student}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                    Download PDF
                </button>
            </div>

            {/* Search + list (screen only) */}
            <div className="screen-only">
                <input
                    type="text"
                    placeholder="Search student name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-6 px-4 py-2 border border-gray-300 rounded-md w-full max-w-md"
                />

                <div className="overflow-x-auto">
                    <table className="table-auto border-collapse border border-gray-300 w-full text-sm rounded-md overflow-hidden">
                        <thead className="bg-gray-100 text-gray-900">
                            <tr>
                                <th className="border border-gray-300 px-3 py-2 text-left">Student</th>
                                <th className="border border-gray-300 px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentStudents.map((s) => (
                                <tr key={s.childid} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-3 py-2">{s.name}</td>
                                    <td className="border border-gray-300 px-3 py-2">
                                        <button
                                            className="text-blue-600 hover:underline"
                                            onClick={() =>
                                                setExpandedStudentId(expandedStudentId === s.childid ? null : s.childid)
                                            }
                                        >
                                            {expandedStudentId === s.childid ? "Hide Report" : "View Report"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center mt-6">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className={`px-3 py-1 border rounded ${currentPage === 1
                            ? "bg-gray-200 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                            }`}
                    >
                        Prev
                    </button>
                    <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className={`px-3 py-1 border rounded ${currentPage === totalPages
                            ? "bg-gray-200 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                            }`}
                    >
                        Next
                    </button>
                </div>

                {/* Expanded (screen view) */}
                {student && (
                    <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold mb-4">{student.name}'s Report</h3>
                        {Object.keys(subjectMap).map((subject) => (
                            <div key={subject} className="mb-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-2">{subject}</h4>
                                <div className="overflow-x-auto">
                                    <table className="table-auto border-collapse border border-gray-300 w-full text-sm rounded">
                                        <thead className="bg-gray-100 text-gray-900">
                                            <tr>
                                                <th className="border border-gray-300 px-3 py-2 text-center">Assessment</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center">Score</th>
                                                <th className="border border-gray-300 px-3 py-2 text-center">Comment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subjectMap[subject].map((g, idx) => {
                                                const percent = (g.score / g.max_score) * 100;
                                                return (
                                                    <tr key={idx} className={`${colorClass(g.score, g.max_score)} hover:bg-gray-50`}>
                                                        <td className="border border-gray-300 px-3 py-2 text-center">{g.assessment_name}</td>
                                                        <td className="border border-gray-300 px-3 py-2 text-center">
                                                            {g.score} / {g.max_score} ({percent.toFixed(1)}%)
                                                        </td>
                                                        <td className="border border-gray-300 px-3 py-2 text-center">{g.comment || "–"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PRINT-ONLY AREA — only this gets printed */}
            {student && (
                <div id="print-target">
                    <div>
                        {/* Main Header */}
                        <div className="print-header">
                            {student.name} — {student.classname || ""} (Term {termname || termid})
                        </div>

                        {Object.keys(subjectMap).map((subject) => (
                            <div key={subject} style={{ marginTop: 12 }}>
                                {/* Subject heading */}
                                <div className="print-subject">{subject}</div>

                                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: "28%", border: "1px solid #cfd4da", padding: "6px 8px" }}>Assessment</th>
                                            <th style={{ width: "22%", border: "1px solid #cfd4da", padding: "6px 8px" }}>Score</th>
                                            <th style={{ border: "1px solid #cfd4da", padding: "6px 8px" }}>Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjectMap[subject].map((g, idx) => {
                                            const pct = (g.score / g.max_score) * 100;
                                            const rowClass = pct >= 75 ? "score-green" : pct >= 50 ? "score-yellow" : "score-red";
                                            return (
                                                <tr key={idx} className={rowClass}>
                                                    <td style={{ border: "1px solid #cfd4da", padding: "6px 8px" }}>{g.assessment_name}</td>
                                                    <td style={{ border: "1px solid #cfd4da", padding: "6px 8px" }}>
                                                        {g.score} / {g.max_score} ({pct.toFixed(1)}%)
                                                    </td>
                                                    <td style={{ border: "1px solid #cfd4da", padding: "6px 8px" }}>{g.comment || "–"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

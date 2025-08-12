import { useEffect, useState } from "react";
import api from "../axios";

// 🟢🟡🔴 Score color logic
function colorClass(score, max) {
    const percent = (score / max) * 100;
    if (percent >= 75) return "bg-green-100";
    if (percent >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

export default function StudentReports({ classid, termid }) {
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
                    params: { classid, termid }
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
        const filtered = students.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredStudents(filtered);
        setCurrentPage(1);
    }, [searchTerm, students]);

    const indexOfLast = currentPage * studentsPerPage;
    const indexOfFirst = indexOfLast - studentsPerPage;
    const currentStudents = filteredStudents.slice(indexOfFirst, indexOfLast);
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

    if (loading) return <p className="text-gray-700">Loading student reports...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (students.length === 0) return <p className="text-gray-600">No students found.</p>;

    return (
        <div className="text-gray-800 bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-2xl font-bold mb-4">👨‍🎓 Student Reports</h2>

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
                                            setExpandedStudentId(
                                                expandedStudentId === s.childid ? null : s.childid
                                            )
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
                    className={`px-3 py-1 border rounded ${currentPage === 1 ? "bg-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
                >
                    Prev
                </button>
                <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className={`px-3 py-1 border rounded ${currentPage === totalPages ? "bg-gray-200 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}
                >
                    Next
                </button>
            </div>

            {/* 📄 Expanded Report */}
            {expandedStudentId && (() => {
                const student = students.find(s => s.childid === expandedStudentId);
                if (!student) return null;

                const subjectMap = {};
                student.grades.forEach(g => {
                    if (!subjectMap[g.subject]) subjectMap[g.subject] = [];
                    subjectMap[g.subject].push(g);
                });

                return (
                    <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">{student.name}'s Report</h3>
                            <a
                                href={`http://localhost:3001/teacher/dashboard/student-report-pdf/${student.childid}?termid=${termid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Download PDF
                            </a>
                        </div>

                        {Object.keys(subjectMap).map(subject => (
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
                                                        <td className="border border-gray-300 px-3 py-2 text-center">
                                                            {g.assessment_name}
                                                        </td>
                                                        <td className="border border-gray-300 px-3 py-2 text-center">
                                                            {g.score} / {g.max_score} ({percent.toFixed(1)}%)
                                                        </td>
                                                        <td className="border border-gray-300 px-3 py-2 text-center">
                                                            {g.comment || "–"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}

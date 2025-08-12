import { useEffect, useState } from "react";
import api from "../axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PDFExportTab({ classid, termid }) {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchPDFData() {
            if (!classid || !termid) return;
            setLoading(true);
            try {
                const res = await api.get("/teacher/dashboard/class-report-pdf", {
                    params: { classid, termid }
                });
                setReportData(res.data);
                setError("");
            } catch (err) {
                console.error("Failed to fetch PDF data", err);
                setError("Failed to load class report.");
            } finally {
                setLoading(false);
            }
        }
        fetchPDFData();
    }, [classid, termid]);

    const generatePDF = () => {
        if (!reportData) return;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Class Report – ${reportData.className}`, 10, 10);
        doc.text(`Term: ${reportData.termName}`, 10, 18);

        reportData.students.forEach((student, idx) => {
            const startY = 28 + idx * 60;
            doc.setFontSize(12);
            doc.text(`${student.name} – Avg: ${student.overallAverage}%`, 10, startY);

            const rows = [];
            for (const subject in student.subjects) {
                const subj = student.subjects[subject];
                subj.assessments.forEach(a => {
                    rows.push([
                        subject,
                        a.assessment_name,
                        `${a.score} / ${a.max_score}`,
                        a.comment || "-"
                    ]);
                });
            }

            autoTable(doc, {
                head: [["Subject", "Assessment", "Score", "Comment"]],
                body: rows,
                startY: startY + 4,
                styles: { fontSize: 10 },
                theme: "grid"
            });

            if (idx < reportData.students.length - 1) {
                doc.addPage();
            }
        });

        doc.save(`Class_Report_${reportData.className}_Term${termid}.pdf`);
    };

    if (loading) return <p className="text-gray-700">Loading PDF data...</p>;
    if (error) return <p className="text-red-600">{error}</p>;

    return (
        <div className="p-4">
            <p className="text-gray-800 mb-4">
                Export full grade reports for all students in PDF format.
            </p>
            <button
                onClick={generatePDF}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md"
            >
                Download Full PDF Report
            </button>
        </div>
    );
}

import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";

function colorCodeScore(score, max) {
    const numScore = Number(score);
    const numMax = Number(max);
    if (numMax === 0 || isNaN(numScore) || isNaN(numMax)) return "";
    const percent = (numScore / numMax) * 100;
    if (percent >= 75) return "bg-green-100";
    if (percent >= 50) return "bg-yellow-100";
    return "bg-red-100";
}

export default function OverviewChart({
    grades = [],
    students = [],
    selectedTerm,
    search,
    setSearch,
    sortKey,
    setSortKey,
    sortAsc,
    setSortAsc,
}) {
    const overviewGrades = useMemo(() => {
        if (!grades || grades.length === 0) return [];
        if (!selectedTerm) return grades;
        return grades.filter((g) => g.termid === selectedTerm.termid);
    }, [grades, selectedTerm]);

    const classAverage = useMemo(() => {
        if (!overviewGrades || overviewGrades.length === 0 || !students) return 0;

        const studentAverages = students.map((s) => {
            const studentGrades = overviewGrades.filter((g) => g.childid === s.childid);
            if (studentGrades.length === 0) return null;

            const totalScore = studentGrades.reduce((acc, g) => acc + Number(g.score || 0), 0);
            const totalMax = studentGrades.reduce((acc, g) => acc + Number(g.max_score || 100), 0);

            return totalMax > 0 ? (totalScore / totalMax) * 100 : null;
        }).filter(avg => avg !== null);

        const total = studentAverages.reduce((sum, avg) => sum + avg, 0);
        return studentAverages.length > 0 ? (total / studentAverages.length).toFixed(1) : 0;
    }, [overviewGrades, students]);

    const overviewTableData = useMemo(() => {
        if (!students || students.length === 0) return [];
        return students
            .map((s) => {
                const studentGrades = overviewGrades.filter((g) => g.childid === s.childid);
                if (studentGrades.length === 0) return null;
                const totalScore = studentGrades.reduce((acc, g) => acc + Number(g.score || 0), 0);
                const totalMax = studentGrades.reduce((acc, g) => acc + Number(g.max_score || 100), 0);
                const percent = totalMax ? (totalScore / totalMax) * 100 : 0;
                return {
                    childid: s.childid,
                    name: s.name,
                    average: percent,
                };
            })
            .filter(Boolean)
            .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                if (sortKey === "name") {
                    return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
                if (sortKey === "average") {
                    return sortAsc ? a.average - b.average : b.average - a.average;
                }
                return 0;
            });
    }, [students, overviewGrades, search, sortKey, sortAsc]);

    return (
        <div className="bg-white p-6 rounded-md shadow-md">
            <div className="mb-4 max-w-sm">
                <input
                    type="text"
                    placeholder="Search student by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border text-gray-900 border-gray-400 rounded-md px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
            </div>

            <div className="max-w-md mb-6">
                <Bar
                    data={{
                        labels: [selectedTerm ? selectedTerm.name : "All Terms"],
                        datasets: [{
                            label: "Class Average (%)",
                            data: [parseFloat(classAverage)],
                            backgroundColor: "rgba(54, 162, 235, 0.7)",
                        }],
                    }}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: "Class Average (%)" },
                        },
                        scales: {
                            y: { beginAtZero: true, max: 100 },
                        },
                    }}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border border-gray-300 rounded-md text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th
                                className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold cursor-pointer"
                                onClick={() => setSortKey("name")}
                            >
                                Student {sortKey === "name" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                            <th
                                className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold cursor-pointer"
                                onClick={() => setSortKey("average")}
                            >
                                Average % {sortKey === "average" ? (sortAsc ? "▲" : "▼") : ""}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {overviewTableData.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="text-center py-4 text-gray-500">
                                    No data found
                                </td>
                            </tr>
                        ) : (
                            overviewTableData.map((row) => (
                                <tr key={row.childid} className={colorCodeScore(row.average, 100)}>
                                    <td className="border border-gray-300 px-4 py-2 text-gray-900">{row.name}</td>
                                    <td className="border border-gray-300 px-4 py-2 text-gray-900">{row.average.toFixed(1)}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../axios";
import TermSelector from "../components/TermSelector";
import YearOverviewChart from "../components/YearOverviewChart";
import ClassOverview from "../components/ClassOverview";
import StudentReports from "../components/StudentReports";

export default function AcademicDashboard() {
    const { classid } = useParams();
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [tab, setTab] = useState("year"); // default to Year Overview
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [classInfo, setClassInfo] = useState(null);
    const [allYears, setAllYears] = useState([]);

    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [classRes, termRes] = await Promise.all([
                    api.get("/teacher/classes/class-teacher-only"),
                    api.get("/terms")
                ]);

                const classMatch = classRes.data.find(c => c.classid.toString() === classid);
                if (!classMatch) {
                    setError("You are not authorized for this class.");
                } else {
                    setClassInfo(classMatch);
                }

                // Extract available school years
                const years = termRes.data.map(group => group.schoolYear);
                setAllYears(years);

                // Select most recent year by default
                const currentYear = years[years.length - 1];
                setSelectedYear(currentYear);

                // Select current term
                const today = new Date();
                const flatTerms = termRes.data.flatMap(g => g.terms);
                const currentTerm = flatTerms.find(t => {
                    const start = new Date(t.start_date);
                    const end = new Date(t.end_date);
                    return today >= start && today <= end;
                }) || flatTerms[0];
                setSelectedTerm(currentTerm);

            } catch (err) {
                console.error("Failed to load class or terms", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        }
        fetchInitialData();
    }, [classid]);

    if (loading) return <div className="p-6">Loading dashboard...</div>;
    if (error) return <div className="p-6 text-red-600">{error}</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto bg-white rounded-md shadow-md mt-16">
            <h1 className="text-3xl font-bold mb-6 text-gray-900">
                Academic Dashboard – {classInfo.classname}
            </h1>

            {/* Tabs */}
            <div className="mb-4 border-b border-gray-300">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {["year", "term", "reports"].map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`py-2 px-4 border-b-2 font-medium text-sm ${tab === t
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            {t === "year" && "📈 Year Overview"}
                            {t === "term" && "📊 Term Subject Overview"}
                            {t === "reports" && "👨‍🎓 Student Reports"}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Year Overview Tab */}
            {tab === "year" && selectedYear && (
                <div>
                    <label className="font-semibold text-gray-800 mr-2">Select School Year:</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="border border-gray-400 rounded-md px-4 py-2 text-gray-900 mb-4"
                    >
                        {allYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {console.log("Dashboard requesting year overview for:", { classid, selectedYear })}


                    <YearOverviewChart classid={classid} schoolYear={selectedYear} />


                </div>
            )}

            {/* Term Overview Tab */}
            {tab === "term" && (
                <>
                    <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />
                    {selectedTerm ? (
                        <ClassOverview classid={classid} termid={selectedTerm.termid} />
                    ) : (
                        <p className="text-gray-600">Please select a term.</p>
                    )}
                </>
            )}

            {/* Student Reports Tab */}
            {tab === "reports" && selectedTerm ? (
                <StudentReports
                    classid={classid}
                    termid={selectedTerm.termid}
                    termname={selectedTerm.name}   // ← pass display name
                />
            ) : tab === "reports" ? (
                <p className="text-gray-600">Please select a term.</p>
            ) : null}
        </div>
    );
}

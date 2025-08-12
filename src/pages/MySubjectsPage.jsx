import { useEffect, useState, useMemo } from "react";
import api from "../axios";
import TermSelector from "../components/TermSelector";
import OverviewChart from "../components/OverviewChart";
import AssessmentChart from "../components/AssessmentChart";
import TermComparison from "../components/TermComparison";
import StudentTrendChart from "../components/StudentTrendChart";

export default function MySubjectsPage() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [terms, setTerms] = useState([]);
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [tab, setTab] = useState("overview");
    const [assessments, setAssessments] = useState([]);
    const [selectedAssessment, setSelectedAssessment] = useState("");

    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState("name");
    const [sortAsc, setSortAsc] = useState(true);

    const [termCompSearch, setTermCompSearch] = useState("");
    const [termCompSortKey, setTermCompSortKey] = useState("name");
    const [termCompSortAsc, setTermCompSortAsc] = useState(true);
    const selectedYear = new Date().getFullYear();

    useEffect(() => {
        async function loadInitial() {
            try {
                const [clsRes, termRes] = await Promise.all([
                    api.get("/grades/classes-with-roles"),
                    api.get("/terms"),
                ]);
                setClasses(clsRes.data);
                const flatTerms = termRes.data.flatMap(group => group.terms);
                setTerms(flatTerms);
            } catch (err) {
                console.error("Initial load error:", err);
                showToast("Failed to load initial data");
            }
        }
        loadInitial();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSubjects([]);
            setSelectedSubject("");
            setGrades([]);
            setAssessments([]);
            setSelectedAssessment("");
            setSelectedTerm(null);
            return;
        }
        async function loadSubjects() {
            try {
                const res = await api.get("/grades/subjects-for-class", {
                    params: { classid: selectedClass },
                });
                setSubjects(res.data);
                setSelectedSubject(res.data[0] || "");
                setSelectedAssessment("");
                setSelectedTerm(null);
                setGrades([]);
                setAssessments([]);
            } catch (err) {
                console.error("Load subjects error:", err);
                showToast("Failed to load subjects");
            }
        }
        loadSubjects();
    }, [selectedClass]);

    useEffect(() => {
        if (!selectedClass || !selectedSubject) {
            setGrades([]);
            setAssessments([]);
            setSelectedAssessment("");
            return;
        }
        async function loadAssessmentsAndGrades() {
            setLoading(true);
            try {
                const [assRes, gradesRes] = await Promise.all([
                    api.get("/grades/assessments-for-class", {
                        params: { classid: selectedClass, subject: selectedSubject },
                    }),
                    api.get("/grades", {
                        params: { classid: selectedClass, subject: selectedSubject },
                    }),
                ]);
                setAssessments(assRes.data);
                setGrades(gradesRes.data);
                const first = assRes.data[0];
                setSelectedAssessment(first ? (typeof first === "string" ? first : first.name) : "");
            } catch (err) {
                console.error("Load grades error:", err);
                showToast("Failed to load grades or assessments");
            } finally {
                setLoading(false);
            }
        }
        loadAssessmentsAndGrades();
    }, [selectedClass, selectedSubject]);

    useEffect(() => {
        if (tab === "term" && !selectedAssessment && assessments.length > 0) {
            setSelectedAssessment(assessments[0]);
        }
    }, [tab, selectedAssessment, assessments]);

    function showToast(msg) {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    }

    const students = useMemo(() => {
        const map = new Map();
        grades.forEach((g) => {
            if (!map.has(g.childid)) {
                map.set(g.childid, { childid: g.childid, name: `${g.fname} ${g.lname}` });
            }
        });
        return Array.from(map.values());
    }, [grades]);

    return (
        <div className="p-6 max-w-6xl mx-auto bg-white rounded-md shadow-md mt-16">
            {toastMsg && (
                <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-md shadow-lg z-50">
                    {toastMsg}
                </div>
            )}

            <h1 className="text-3xl font-bold mb-8 text-gray-900">My Subjects & Grades</h1>

            <div className="mb-6">
                <label className="block font-semibold mb-2 text-gray-900">Select Class</label>
                <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="border border-gray-400 text-gray-900 rounded-md px-4 py-2 w-full"
                >
                    <option value="">-- Select Class --</option>
                    {classes.map((c) => (
                        <option key={c.classid} value={c.classid}>
                            {c.classname} ({c.role})
                        </option>
                    ))}
                </select>
            </div>

            {subjects.length > 0 && (
                <div className="mb-6">
                    <label className="block font-semibold mb-2 text-gray-900">Select Subject</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="border border-gray-400 text-gray-900 rounded-md px-4 py-2 w-full"
                    >
                        {subjects.map((subj) => (
                            <option key={subj} value={subj}>
                                {subj}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {selectedClass && selectedSubject && (
                <div className="mb-6">
                    <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />
                </div>
            )}

            <div className="mb-6 border-b border-gray-300">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {["overview", "assessment", "term", "student"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`py-2 px-4 border-b-2 font-medium text-sm ${tab === t
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            {t === "student" ? "Student Trends" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </nav>
            </div>

            {loading && <p className="text-gray-700">Loading grades...</p>}

            {!loading && tab === "overview" && (
                <OverviewChart
                    grades={grades}
                    students={students}
                    selectedTerm={selectedTerm}
                    search={search}
                    setSearch={setSearch}
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                />
            )}

            {!loading && tab === "assessment" && (
                <AssessmentChart

                    assessments={assessments}
                    selectedAssessment={selectedAssessment}
                    setSelectedAssessment={setSelectedAssessment}
                    grades={grades}
                    selectedTerm={selectedTerm}
                    search={search}
                    setSearch={setSearch}
                    sortKey={sortKey}
                    setSortKey={setSortKey}
                    sortAsc={sortAsc}
                    setSortAsc={setSortAsc}
                    students={students}
                />
            )}

            {!loading &&
                tab === "student" &&
                selectedClass &&
                selectedSubject &&
                selectedTerm &&
                students.length > 0 && (
                    <StudentTrendChart
                        classid={selectedClass}
                        selectedSubject={selectedSubject}
                        selectedTerm={selectedTerm}
                        students={students}
                    />
                )}
            {!loading && tab === "term" && (
                <TermComparison
                    selectedClass={selectedClass}
                    selectedTerm={selectedTerm} // ✅ ADD THIS LINE
                    selectedAssessment={selectedAssessment}
                    setSelectedAssessment={setSelectedAssessment}
                    grades={grades}
                    students={students}
                    terms={terms}
                    termCompSearch={termCompSearch}
                    setTermCompSearch={setTermCompSearch}
                    termCompSortKey={termCompSortKey}
                    setTermCompSortKey={setTermCompSortKey}
                    termCompSortAsc={termCompSortAsc}
                    setTermCompSortAsc={setTermCompSortAsc}
                />
            )}
        </div>
    );
}

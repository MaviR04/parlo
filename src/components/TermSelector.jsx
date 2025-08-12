import { useEffect, useState, useRef } from "react";
import api from "../axios";

const termColors = {
    "Term 1": "text-red-600",
    "Term 2": "text-yellow-600",
    "Term 3": "text-green-600",
};

function findClosestSchoolYear(yearGroups) {
    const today = new Date();
    let closest = null;
    let closestDiff = Infinity;

    for (const group of yearGroups) {
        for (const term of group.terms) {
            const start = new Date(term.start_date);
            const diff = Math.abs(start - today);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = group.schoolYear;
            }
        }
    }
    return closest;
}

export default function TermSelector({ selectedTerm, onChange }) {
    const [termsBySchoolYear, setTermsBySchoolYear] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openYear, setOpenYear] = useState(false);
    const [openTerm, setOpenTerm] = useState(false);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState(null);

    const yearDropdownRef = useRef();
    const termDropdownRef = useRef();

    useEffect(() => {
        async function fetchTerms() {
            setLoading(true);
            try {
                const res = await api.get("/terms");
                setTermsBySchoolYear(res.data);
                setError(null);

                if (res.data.length > 0) {
                    const today = new Date();

                    // Step 1: Find school year containing today's date
                    let currentYearGroup = res.data.find(group =>
                        group.terms.some(term => {
                            const start = new Date(term.start_date);
                            const end = new Date(term.end_date);
                            return today >= start && today <= end;
                        })
                    );

                    // Step 2: If no exact match, pick closest year
                    if (!currentYearGroup) {
                        const closestYear = findClosestSchoolYear(res.data);
                        currentYearGroup =
                            res.data.find(y => y.schoolYear === closestYear) || res.data[0];
                    }

                    if (currentYearGroup) {
                        setSelectedSchoolYear(currentYearGroup.schoolYear);

                        // Step 3: Try to find the exact current term in that year
                        let currentTerm = currentYearGroup.terms.find(term => {
                            const start = new Date(term.start_date);
                            const end = new Date(term.end_date);
                            return today >= start && today <= end;
                        });

                        // Step 4: Fallback to first term if none match
                        if (!currentTerm) {
                            currentTerm = currentYearGroup.terms[0];
                        }

                        if (currentTerm) {
                            onChange(currentTerm);
                        }
                    }
                }
            } catch {
                setError("Failed to load terms");
            } finally {
                setLoading(false);
            }
        }
        fetchTerms();
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setOpenYear(false);
            }
            if (termDropdownRef.current && !termDropdownRef.current.contains(event.target)) {
                setOpenTerm(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (loading) return <p className="text-sm text-gray-500">Loading terms...</p>;
    if (error) return <p className="text-sm text-red-600">{error}</p>;

    const yearData = termsBySchoolYear.find(y => y.schoolYear === selectedSchoolYear);
    const terms = yearData ? yearData.terms : [];

    return (
        <div className="mb-4 max-w-xs bg-white rounded-lg shadow px-4 py-3 relative">
            {/* School Year selector */}
            <label className="block text-base font-semibold mb-2 text-black">
                Select School Year
            </label>
            <button
                type="button"
                onClick={() => setOpenYear(o => !o)}
                className={`w-48 flex justify-between items-center rounded-md border border-gray-300 px-3 py-2 cursor-pointer font-bold text-base text-black`}
            >
                {selectedSchoolYear || "Select School Year"}
                <svg
                    className={`ml-2 h-5 w-5 transition-transform duration-200 ${openYear ? "rotate-180" : "rotate-0"
                        }`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {openYear && (
                <ul
                    className="mt-1 max-h-48 w-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg z-20 absolute"
                    role="listbox"
                    tabIndex={-1}
                    ref={yearDropdownRef}
                >
                    {termsBySchoolYear.map(({ schoolYear }) => (
                        <li
                            key={schoolYear}
                            role="option"
                            onClick={() => {
                                setSelectedSchoolYear(schoolYear);
                                onChange(null); // reset selected term
                                setOpenYear(false);
                                setOpenTerm(false);
                            }}
                            className="cursor-pointer px-3 py-2 hover:bg-gray-100 font-bold text-black"
                        >
                            {schoolYear}
                        </li>
                    ))}
                </ul>
            )}

            {/* Term selector */}
            <label className="block text-base font-semibold mt-4 mb-2 text-black">
                Select Term
            </label>
            <button
                type="button"
                onClick={() => setOpenTerm(o => !o)}
                disabled={!selectedSchoolYear}
                className={`w-48 flex justify-between items-center rounded-md border border-gray-300 px-3 py-2 cursor-pointer font-bold text-base
        ${!selectedSchoolYear ? "opacity-50 cursor-not-allowed" : ""} 
        ${termColors[selectedTerm?.name] || "text-black"}`}
            >
                {selectedTerm ? selectedTerm.name : "Select Term"}
                <svg
                    className={`ml-2 h-5 w-5 transition-transform duration-200 ${openTerm ? "rotate-180" : "rotate-0"
                        }`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {openTerm && (
                <ul
                    className="mt-1 max-h-48 w-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg z-10 absolute"
                    role="listbox"
                    tabIndex={-1}
                    ref={termDropdownRef}
                >
                    {terms.map((term) => (
                        <li
                            key={term.termid}
                            role="option"
                            onClick={() => {
                                onChange(term);
                                setOpenTerm(false);
                            }}
                            className={`cursor-pointer px-3 py-2 hover:bg-gray-100 ${termColors[term.name] || "text-black"} font-bold`}
                        >
                            {term.name}
                        </li>
                    ))}
                </ul>
            )}

            {/* Current term info */}
            {selectedTerm && (
                <p className="mt-2 text-black font-bold text-base">
                    Currently in:{" "}
                    <span className={`${termColors[selectedTerm.name] || "text-black"} font-bold`}>
                        {selectedTerm.name}
                    </span>
                    <br />
                    Date:{" "}
                    <span className="font-mono text-gray-700 font-bold text-base">
                        {new Date(selectedTerm.start_date).toLocaleDateString("en-GB")} –{" "}
                        {new Date(selectedTerm.end_date).toLocaleDateString("en-GB")}
                    </span>
                </p>
            )}
        </div>
    );
}

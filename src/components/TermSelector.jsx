import { useEffect, useState, useRef } from "react";
import api from "../axios";

const termColors = {
  "Term 1": "text-red-600",
  "Term 2": "text-yellow-600",
  "Term 3": "text-green-600",
  "Whole Year": "text-blue-600",
};

export default function TermSelector({ selectedTerm, onChange }) {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    async function fetchTerms() {
      setLoading(true);
      try {
        const res = await api.get("/terms");
        setTerms(res.data);
        setError(null);
      } catch {
        setError("Failed to load terms");
      } finally {
        setLoading(false);
      }
    }
    fetchTerms();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading terms...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="mb-4 max-w-xs bg-white rounded-lg shadow px-4 py-3" ref={dropdownRef}>
      <label
        htmlFor="term-select"
        className="block text-base font-semibold mb-2 text-black"
      >
        Select Term
      </label>

      {/* Selected item, toggles dropdown */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-48 flex justify-between items-center rounded-md border border-gray-300 px-3 py-2 cursor-pointer
          ${termColors[selectedTerm?.name] || "text-black"} font-bold text-base`}
      >
        {selectedTerm ? selectedTerm.name : "Select Term"}
        <svg
          className={`ml-2 h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          className="mt-1 max-h-48 w-48 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg z-10 absolute"
          role="listbox"
          tabIndex={-1}
        >
          {terms.map((term) => (
            <li
              key={term.termid}
              role="option"
              onClick={() => {
                onChange(term);
                setOpen(false);
              }}
              className={`cursor-pointer px-3 py-2 hover:bg-gray-100 ${termColors[term.name] || "text-black"} font-bold`}
            >
              {term.name}
            </li>
          ))}
        </ul>
      )}

      {/* Current term info below */}
      {selectedTerm && (
        <p className="mt-2 text-black font-bold text-base">
          Currently in:{" "}
          <span className={`${termColors[selectedTerm.name] || "text-black"} font-bold`}>
            {selectedTerm.name}
          </span>{" "}
          {selectedTerm.name !== "Whole Year" && (
            <>
              <br />
              Date:{" "}
              <span className="font-mono text-gray-700 font-bold text-base">
                {new Date(selectedTerm.start_date).toLocaleDateString("en-GB")} –{" "}
                {new Date(selectedTerm.end_date).toLocaleDateString("en-GB")}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

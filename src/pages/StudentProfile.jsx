import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../axios";
import TermSelector from "../components/TermSelector";

import BehaviourResults from "../components/BehaviourResults";
import AcademicsTab from "../components/AcademicsTab";
import ActivitiesTab from "../components/ActivitiesTab";
import GenCommentsTab from "../components/GenCommentsTab";

/* --- Simple error boundary so the page never goes fully blank --- */
function trackEvent( eventName, classification, eventData = {}) {
  console.log("event tracked")
  return api.post("/tracking", {
    event_name: eventName,
    classification,
    event_data: eventData,
  });
  
}

function ErrorBoundary({ children }) {
  const [err, setErr] = useState(null);
  if (err) {
    console.error(err);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-700 font-semibold">
          Something went wrong loading this section.
        </p>
        <p className="text-sm text-red-600">Please change the term again or refresh.</p>
      </div>
    );
  }
  return (
    <div
      // React will call this if a descendant throws synchronously during render
      // (works in modern React for simple cases)
      onErrorCapture={(e) => setErr(e)}
    >
      {children}
    </div>
  );
}

export default function StudentProfile() {
  const { childId } = useParams();

  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [errorStudent, setErrorStudent] = useState(null);

  const [activeTab, setActiveTab] = useState("attendance");

  const [attendanceData, setAttendanceData] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [errorAttendance, setErrorAttendance] = useState(null);

  const [selectedTerm, setSelectedTerm] = useState(null);

  const termId = selectedTerm?.termid ?? null; // single source of truth

  const labels = ["Present", "Absent", "Late", "Half Day"];
  const rawData = attendanceData
    ? {
      Present: attendanceData.present || 0,
      Absent: attendanceData.absent || 0,
      Late: attendanceData.late || 0,
      "Half Day": attendanceData["half-day"] || 0,
    }
    : { Present: 0, Absent: 0, Late: 0, "Half Day": 0 };

  const [legendToggles, setLegendToggles] = useState(() => {
    const total = Object.values(rawData).reduce((a, b) => a + b, 0);
    const init = {};
    labels.forEach((label) => {
      init[label] = total === 0 ? true : rawData[label] > 0;
    });
    return init;
  });

  // Recompute legend toggles when attendance data changes
  useEffect(() => {
    const total = Object.values(rawData).reduce((a, b) => a + b, 0);
    const newToggles = {};
    labels.forEach((label) => {
      newToggles[label] = total === 0 ? true : rawData[label] > 0;
    });
    setLegendToggles(newToggles);
  }, [attendanceData]); // eslint-disable-line

  // Reset per-tab state when the term changes (prevents stale render errors)
  useEffect(() => {
    if (!termId) return;
    if (activeTab === "attendance") {
      setAttendanceData(null);
      setErrorAttendance(null);
      setLoadingAttendance(false);
    }
    // If other tabs keep local state internally, the key={termId} below will remount them.
  }, [termId, activeTab]); // eslint-disable-line

  const getGradeNumber = (classname) => {
    if (!classname) return null;
    const match = classname.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Fetch student profile
  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await api.get(`/children/${childId}`);
        setStudent(res.data);
        setErrorStudent(null);
      } catch {
        setErrorStudent("Failed to load student profile");
      } finally {
        setLoadingStudent(false);
      }
    }
    fetchStudent();
  }, [childId]);

  // Fetch terms (pick "Whole Year" if present)
  useEffect(() => {
    async function fetchTerms() {
      try {
        const res = await api.get("/terms");
        const wholeYearTerm =
          res.data.find((t) => t.name === "Whole Year") || res.data[0] || null;
        setSelectedTerm(wholeYearTerm || null);
      } catch {
        setSelectedTerm(null);
      }
    }
    fetchTerms();
  }, []);

  // Fetch attendance data (only on the Attendance tab)
  

  if (loadingStudent) return <p>Loading student profile...</p>;
  if (errorStudent) return <p className="text-red-600">{errorStudent}</p>;
  if (!student) return <p>No student found.</p>;

  const studentGrade = getGradeNumber(student?.classname);
  const showBehaviour = studentGrade !== null && studentGrade <= 4;

  return (
    <div className="p-4">
      {/* Basic info */}
      <h1 className="text-xl font-bold mb-2">
        {student.fname} {student.lname}
      </h1>
      <p>
        <strong>DOB:</strong>{" "}
        {student.dateofbirth
          ? new Date(student.dateofbirth).toLocaleDateString("en-GB")
          : "N/A"}
      </p>
      <p>
        <strong>Parent:</strong>{" "}
        {student.parentfname && student.parentlname
          ? `${student.parentfname} ${student.parentlname}`
          : "N/A"}
      </p>
      <p>
        <strong>Class:</strong> {student.classname || "N/A"}
      </p>

      {/* Tabs */}
      <div className="mt-4 mb-3">
        {[

          ...(showBehaviour ? ["behaviour"] : []),
          "academic",
          "activities",
          "comments",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded mr-2 ${activeTab === tab
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ONE global TermSelector visible on ALL tabs */}
      <div className="mb-6">
        <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />
        {!termId && (
          <p className="text-sm text-gray-600 mt-2">
            Select a term to load {activeTab} data.
          </p>
        )}
      </div>

      <ErrorBoundary>


        {/* Behaviour Tab */}
        {activeTab === "behaviour" && termId && (
          <div key={`behaviour-${termId}` }>
            <BehaviourResults childId={childId} termId={termId} />
          </div>
        )}

        {/* Academics Tab */}
        {activeTab === "academic" && termId && (
          <div key={`academic-${termId}`}  onClick={()=>{trackEvent('click_event','goal_oriented',{ action: "clicked_on_academic_tab" })}}>
            <AcademicsTab childId={childId} termId={termId} />
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === "activities" && termId && (
          <div key={`activities-${termId}`} onClick={()=>{trackEvent('click_event','holistic',{ action: "clicked_on_activities_tab" })}}>
            <ActivitiesTab childId={childId} termId={termId}  />
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === "comments" && termId && (
          <div key={`comments-${termId}`} onClick={()=>{trackEvent('click_event','holistic',{action:'clicked_on_comments_tab'})}}>
            <GenCommentsTab childId={childId} termId={termId}  />
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}

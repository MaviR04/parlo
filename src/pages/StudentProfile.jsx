import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../axios";
import TermSelector from "../components/TermSelector";
import AttendancePieChart from "../components/AttendancePieChart";
import AttendanceTrend from "../components/AttendanceTrend";

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

  // Labels for attendance statuses
  const labels = ["Present", "Absent", "Late", "Half Day"];
  const rawData = attendanceData
    ? {
        Present: attendanceData.present || 0,
        Absent: attendanceData.absent || 0,
        Late: attendanceData.late || 0,
        "Half Day": attendanceData["half-day"] || 0,
      }
    : { Present: 0, Absent: 0, Late: 0, "Half Day": 0 };

  // Legend toggles state (which slices are shown)
  const [legendToggles, setLegendToggles] = useState(() => {
    const total = Object.values(rawData).reduce((a, b) => a + b, 0);
    const init = {};
    labels.forEach((label) => {
      init[label] = total === 0 ? true : rawData[label] > 0;
    });
    return init;
  });

  useEffect(() => {
    const total = Object.values(rawData).reduce((a, b) => a + b, 0);
    const newToggles = {};
    labels.forEach((label) => {
      newToggles[label] = total === 0 ? true : rawData[label] > 0;
    });
    setLegendToggles(newToggles);
  }, [attendanceData]);

  // Fetch student profile
  useEffect(() => {
    async function fetchStudent() {
      try {
        const res = await api.get(`/teacher/student/${childId}`);
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

  // Fetch terms
  useEffect(() => {
    async function fetchTerms() {
      try {
        const res = await api.get("/terms");
        const wholeYearTerm = res.data.find((t) => t.name === "Whole Year") || res.data[0];
        setSelectedTerm(wholeYearTerm);
      } catch {
        // ignore errors here
      }
    }
    fetchTerms();
  }, []);

  // Fetch attendance data for selected term and student
  useEffect(() => {
    if (activeTab !== "attendance" || !selectedTerm) return;

    async function fetchAttendance() {
      setLoadingAttendance(true);
      try {
        const res = await api.get(`/teacher/attendance/student/${childId}`, {
          params: {
            start_date: selectedTerm.start_date,
            end_date: selectedTerm.end_date,
          },
        });
        setAttendanceData(res.data);
        setErrorAttendance(null);
      } catch {
        setErrorAttendance("Failed to load attendance data");
      } finally {
        setLoadingAttendance(false);
      }
    }
    fetchAttendance();
  }, [childId, activeTab, selectedTerm]);

  if (loadingStudent) return <p>Loading student profile...</p>;
  if (errorStudent) return <p className="text-red-600">{errorStudent}</p>;
  if (!student) return <p>No student found.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">
        {student.fname} {student.lname}
      </h1>
      <p>
        <strong>DOB:</strong>{" "}
        {new Date(student.dateofbirth).toLocaleDateString("en-GB")}
      </p>
      <p>
        <strong>Parent:</strong> {student.parentfname} {student.parentlname}
      </p>

      {/* Tabs */}
      <div className="mt-4 mb-6">
        {["attendance", "behaviour", "academic", "sports", "comments"].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded mr-2 ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div>
          <TermSelector selectedTerm={selectedTerm} onChange={setSelectedTerm} />
          {loadingAttendance && <p>Loading attendance data...</p>}
          {errorAttendance && <p className="text-red-600">{errorAttendance}</p>}
          {!loadingAttendance && (
            <div className="max-w-xxl mx-auto p-4 bg-white rounded-2xl shadow-lg">
              <AttendancePieChart
                rawData={rawData}
                legendToggles={legendToggles}
                setLegendToggles={setLegendToggles}
              />
              <AttendanceTrend childId={childId} selectedTerm={selectedTerm} />
            </div>
          )}
        </div>
      )}

      {/* Other tabs */}
      {activeTab !== "attendance" && (
        <p className="italic text-gray-500">
          Content for <strong>{activeTab}</strong> tab coming soon.
        </p>
      )}
    </div>
  );
}

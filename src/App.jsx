import { useState, useEffect } from "react";
import api from "./axios";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

import Login from './pages/Login.jsx';
import Register from './pages/register.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import CalendarApp from './pages/TeacherCalendar.jsx';
import ParentCalendarApp from './pages/ParentCalender.jsx';
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import StudentProfile from "./pages/StudentProfile.jsx";
import ParentList from "./pages/TeachersParentView.jsx";

import BehaviourPage from "./pages/BehaviourPage.jsx";
import EnterGrades from "./pages/EnterGrades.jsx";
import MySubjectsPage from "./pages/MySubjectsPage.jsx";
import Navbar from './components/Navbar.jsx';

import AcademicDashboard from './pages/AcademicDashboard.jsx';
import CoachDashboard from "./pages/CoachDashboard.jsx";
import CoachLogPage from "./pages/CoachLogPage.jsx";
import CoachHistoryPage from "./pages/CoachHistoryPage.jsx";
import BadgeDistribution from "./pages/CoachBadgeDistributionPage.jsx";

import GeneralComments from "./pages/GeneralCommentsPage.jsx";
import ParentDashboard from "./pages/ParentDashboard.jsx";

import MeetingScheduling from "./pages/MeetingScheduling.jsx";
import Availability from "./pages/Availability.jsx";

function App() {
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      try {
        // Get current session user
        const meRes = await api.get("/auth/me", { withCredentials: true });
        const baseUser = meRes.data || {};

        // If teacher, get detailed roles for nav visibility
        if (baseUser.userRole === "Teacher") {
          try {
            const rolesRes = await api.get("/users/me/roles", { withCredentials: true });
            setUser({ ...baseUser, roles: rolesRes.data });
          } catch (e) {
            console.error("Failed to load teacher roles on boot:", e);
            setUser({ ...baseUser, roles: null }); // keep app usable
          }
        } else {
          setUser(baseUser);
        }
      } catch (err) {
        // Not logged in or error fetching session
        setUser({});
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // ✅ Route guard: only Parents can access Meeting Scheduling
  function RequireParent({ user, children }) {
    if (!user?.userRole) return <Navigate to="/login" replace />;
    if (user.userRole !== "Parent") return <Navigate to="/" replace />;
    return children;
  }

  return (
    <BrowserRouter>
      <Navbar user={user} setUser={setUser} />

      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/admin" element={<AdminPanel user={user} />} />
        <Route path="/teacher" element={<CalendarApp user={user} />} />
        <Route path="/teacher/parent" element={<ParentList user={user} />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard user={user} />} />
        <Route path="/calendar" element={<ParentCalendarApp user={user} />} />
        <Route path="/teacher/student/:childId" element={<StudentProfile />} />
       
        <Route path="/teacher/behaviour" element={<BehaviourPage user={user} />} />
        <Route path="/teacher/grades" element={<EnterGrades />} />
        <Route path="/teacher/my-subjects" element={<MySubjectsPage />} />
        <Route path="/teacher/academic-dashboard/:classid" element={<AcademicDashboard />} />
        <Route path="/coach-dashboard" element={<CoachDashboard user={user} />} />
        <Route path="/coach/student/:childId" element={<StudentProfile />} />
        <Route path="/coach-log" element={<CoachLogPage />} />
        <Route path="/coach-history" element={<CoachHistoryPage />} />
        <Route path="/coach-badge" element={<BadgeDistribution />} />
        <Route path="/coach/general-comments" element={<GeneralComments currentUser={user} />} />
        <Route path="/teacher/general-comments" element={<GeneralComments currentUser={user} />} />
        <Route path="/parent-dashboard" element={<ParentDashboard user={user} />} />
        <Route path="/parent/student/:childId" element={<StudentProfile />} />
        <Route path="/availability" element={<Availability user={user} />} />

        {/* 🔒 Only Parents can open Meeting Scheduling */}
        <Route
          path="/meeting-scheduling"
          element={
            <RequireParent user={user}>
              <MeetingScheduling user={user} />
            </RequireParent>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

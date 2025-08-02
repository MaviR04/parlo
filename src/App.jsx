// At the very top of App.jsx
import { useState, useEffect } from "react";  // import both useState and useEffect here
import api from "./axios";

import Login from './pages/Login.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Register from './pages/register.jsx'
import { BrowserRouter, Routes, Route } from "react-router"
import CalendarApp from './pages/TeacherCalendar.jsx'
import ParentCalendarApp from './pages/ParentCalender.jsx'
import Navbar from './components/Navbar.jsx'
//import TeacherDashboard from '"./pages/TeacherDashboard.jsx"'\
import TeacherDashboard from "./pages/TeacherDashBoard.jsx"
import StudentProfile from "./pages/StudentProfile"
import TeacherAttendancePage from "./pages/AttendancePage.jsx"


function App() {
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch (err) {
        setUser({});
      } finally {
        setLoading(false);
      }
    }
    fetchCurrentUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/admin" element={<AdminPanel user={user} />} />
        <Route path="/teacher" element={<CalendarApp user={user} />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard user={user} />} />
        <Route path="/calendar" element={<ParentCalendarApp user={user} />} />
        <Route path="/teacher/student/:childId" element={<StudentProfile />} />
        <Route path="/teacher/attendance" element={<TeacherAttendancePage />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App;

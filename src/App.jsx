import Login from './pages/Login.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import ChatApp from './pages/chatapp.jsx'
import Register from './pages/register.jsx'
import { BrowserRouter, Routes, Route } from "react-router"
import { useState } from 'react';
import CalendarApp from './pages/TeacherCalendar.jsx'
import ParentCalendarApp from './pages/ParentCalender.jsx'
import Navbar from './components/Navbar.jsx'

function App() {
  const [user, setUser] = useState({});
  
  return (
    <BrowserRouter>
    <Navbar />
    <Routes>
      
      <Route path="/chat" element={<ChatApp user={user} />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login setUser={setUser} />} />
      <Route path="/admin" element={<AdminPanel user={user} />} />
      <Route path="/teacher" element={<CalendarApp user={user} />} />
      <Route path="/calendar" element={<ParentCalendarApp user={user} />} />
    </Routes>
  </BrowserRouter>
  )
}
  
export default App


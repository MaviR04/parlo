import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ChatApp from './pages/chatapp.jsx'
import Register from './pages/register.jsx'
import Login from './pages/Login.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import { BrowserRouter, Routes, Route } from "react-router"


createRoot(document.getElementById('root')).render(
   <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/chat" element={<ChatApp />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  </BrowserRouter>
)

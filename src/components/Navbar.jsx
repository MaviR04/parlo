import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-blue-400 text-white px-6 py-3 flex justify-between items-center shadow">
      <div className="text-xl font-semibold">Parlo</div>
      <div className="flex gap-4">
        <Link to="/login" className="hover:text-blue-300">Login</Link>
        <Link to="/admin" className="hover:text-blue-300">Admin</Link>
        <Link to="/teacher" className="hover:text-blue-300">Teacher</Link>
        <Link to="/calendar" className="hover:text-blue-300">Parent Calendar</Link>
      </div>
    </nav>
  )
}

export default Navbar

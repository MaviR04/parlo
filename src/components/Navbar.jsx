import { Link, useNavigate } from "react-router-dom";
import api from "../axios";

function Navbar({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
      setUser({});
      navigate("/login");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <nav className="bg-blue-400 text-white px-6 py-3 flex justify-between items-center shadow">
      <div className="text-xl font-semibold">Parlo</div>
      <div className="flex gap-4">
        {!user.userRole ? (
          <>
            <Link to="/login" className="hover:text-blue-300">
              Login
            </Link>
          </>
        ) : (
          <>
            <span className="font-semibold mr-4">Hello, {user.name}</span>

            {user.userRole === "Admin" && (
              <Link to="/admin" className="hover:text-blue-300">
                Admin Dashboard
              </Link>
            )}

            {user.userRole === "Teacher" && (
              <>
                <Link to="/teacher-dashboard" className="hover:text-blue-300">
                  Teacher Dashboard
                </Link>
                <Link to="/teacher" className="hover:text-blue-300">
                  Teacher Calendar
                </Link>
                <Link to="/availability" className="hover:text-blue-300">
                  Availability
                </Link>
              </>
            )}

            {user.userRole === "Parent" && (
              <>
                <Link to="/parent-dashboard" className="hover:text-blue-300">
                  Parent Dashboard
                </Link>
                <Link to="/calendar" className="hover:text-blue-300">
                  Parent Calendar
                </Link>
                <Link to="/meeting-scheduling" className="hover:text-blue-300">
                  Meeting Scheduling
                </Link>
              </>
            )}

            {user.userRole === "Coach" && (
              <>
                <Link to="/coach-dashboard" className="hover:text-blue-300">
                  Coach Dashboard
                </Link>
                <Link to="/availability" className="hover:text-blue-300">
                  Availability
                </Link>
              </>
            )}

            <button
              onClick={handleLogout}
              className="hover:text-blue-300 px-2 rounded"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;

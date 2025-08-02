import { Link, useNavigate } from "react-router-dom";

function Navbar({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:3001/auth/logout", {
        method: "POST",
        credentials: "include",
      });
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
              </>
            )}
            {user.userRole === "Parent" && (
              <Link to="/calendar" className="hover:text-blue-300">
                Parent Calendar
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="hover:text-blue-300   px-2  rounded"
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

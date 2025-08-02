import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../axios";

export default function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth", { email, password });

      if (res.data.success) {
        setUser({
          userRole: res.data.userRole,
          name: res.data.name,
          userID: res.data.userID,
          email,
        });

        if (res.data.userRole === "Admin") navigate("/admin");
        else if (res.data.userRole === "Teacher") navigate("/teacher");
        else if (res.data.userRole === "Parent") navigate("/calendar");
        else navigate("/");
      } else {
        setError("Invalid email or password.");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error(err);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-blue-400 text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-blue-500 p-6 rounded shadow-md w-80"
      >
        <h2 className="text-xl font-bold mb-4 text-center">Login</h2>
        {error && (
          <div className="mb-4 text-red-300 font-semibold text-center">
            {error}
          </div>
        )}
        <label className="block mb-2 font-semibold">Email</label>
        <input
          type="email"
          className="border border-white bg-white p-2 w-full mb-4 rounded text-blue-500 placeholder-blue-500"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <label className="block mb-2 font-semibold">Password</label>
        <input
          type="password"
          className="border border-white bg-white p-2 w-full mb-4 rounded text-blue-500 placeholder-blue-500"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-white text-blue-600 py-2 rounded hover:bg-gray-100 w-full font-semibold"
        >
          Login
        </button>
      </form>
    </div>
  );
}

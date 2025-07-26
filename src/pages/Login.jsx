import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router";

function Login({setUser}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null); // status message
  let navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(
        'http://localhost:3001/auth/',
        { email, password },
        { withCredentials: true } 
      );

      if (res.data.success) {
        setUser({ 
          userID: res.data.userID, 
          userRole: res.data.userRole, 
          name: res.data.name 
        });
        setStatus('✅ Login successful!') 
        if(res.data.userRole == "Admin"){
            navigate("/admin")
        }
        else if(res.data.userRole == "Teacher"){
             navigate("/teacher")
        }
        else if(res.data.userRole == "Parent"){
             navigate("/calendar")
        }

      } else {
        setStatus('❌ Login failed. Check your credentials.');
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.response?.data?.error || 'Login failed'}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white px-4">
      <form
        onSubmit={handleLogin}
        className="bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-md space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Login</h2>

        <input
          type="email"
          className="w-full p-2 rounded bg-gray-700 text-white"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="w-full p-2 rounded bg-gray-700 text-white"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-400 hover:bg-blue-600 p-2 rounded font-semibold"
        >
          Login
        </button>

        {status && (
          <p className="text-sm text-center mt-2">{status}</p>
        )}
      </form>
    </div>
  );
}

export default Login;
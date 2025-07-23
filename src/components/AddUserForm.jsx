import { useState } from "react";
import api from "../axios";


export default function AddUserForm() {
  const [form, setForm] = useState({
    fname: "",
    lname: "",
    email: "",
    passwordhash: "",
    role: "",
  });

  const labels = {
    fname: "First Name",
    lname: "Last Name",
    email: "Email",
    passwordhash: "Password",
    role: "Role",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/admin/users", {
        ...form
      });
      alert("User created: " + res.data.userid);
    } catch (err) {
      console.error(err);
      alert("Error creating user");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-blue-300">
      <h2 className="text-xl font-semibold">Add User</h2>
      {Object.keys(form).map((key) => (
        <div key={key}>
          <label htmlFor={key} className="block mb-1 font-medium">
            {labels[key]}
          </label>
          <input
            id={key}
            type={key === "passwordhash" ? "password" : "text"}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="block w-full mb-2 p-2 rounded bg-white text-black"
          />
        </div>
      ))}
      <button className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
    </form>
  );
}
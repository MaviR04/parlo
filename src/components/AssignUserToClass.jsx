import { useState } from "react";
import api from "../axios";

export default function AssignUserToClass() {
  const [form, setForm] = useState({
    userid: "",
    classid: "",
    role: "", // Teacher or Student
  });

  const labels = {
    userid: "User ID",
    classid: "Class ID",
    role: "Role (Teacher/Student)",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/userclasses", {
        userid: parseInt(form.userid),
        classid: parseInt(form.classid),
        role: form.role,
      });
      alert(`User ${form.userid} assigned as ${form.role} to class ${form.classid}`);
    } catch (err) {
      console.error(err);
      alert("Error assigning user to class");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-blue-300 space-y-4">
      <h2 className="text-xl font-semibold">Assign User to Class</h2>
      {Object.keys(form).map((key) => (
        <div key={key}>
          <label htmlFor={key} className="block mb-1 font-medium">
            {labels[key]}
          </label>
          <input
            id={key}
            type="text"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full p-2 rounded bg-white text-black"
          />
        </div>
      ))}
      <button className="bg-blue-500 text-white px-4 py-2 rounded">Assign</button>
    </form>
  );
}

import { useState } from "react";
import api from "../axios";

export default function AddClassForm() {
  const [form, setForm] = useState({
    classname: "",
    classteacher: "",
  });

  const labels = {
    classname: "Class Name",
    classteacher: "Class Teacher ID",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/admin/classes", {
        classname: form.classname,
        classteacher: form.classteacher || null,
      });
      alert("Class created: " + res.data.classid);
    } catch (err) {
      console.error(err);
      alert("Error creating class");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-blue-300 space-y-4">
      <h2 className="text-xl font-semibold">Add Class</h2>
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
      <button className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
    </form>
  );
}

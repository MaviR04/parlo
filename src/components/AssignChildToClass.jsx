import { useState } from "react";
import api from "../axios";

export default function AssignChildToClass() {
  const [form, setForm] = useState({
    childid: "",
    classid: "",
  });

  const labels = {
    childid: "Child ID",
    classid: "Class ID",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/childclasses", {
        childid: parseInt(form.childid),
        classid: parseInt(form.classid),
      });
      alert(`Child ${form.childid} assigned to class ${form.classid}`);
    } catch (err) {
      console.error(err);
      alert("Error assigning child to class");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-blue-300 space-y-4">
      <h2 className="text-xl font-semibold">Assign Child to Class</h2>
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

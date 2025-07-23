import { useState } from "react";
import api from "../axios";

export default function AddChildForm() {
  const [form, setForm] = useState({
    fname: "",
    lname: "",
    parentid: "",
    dateofbirth: "",
  });

  const labels = {
    fname: "First Name",
    lname: "Last Name",
    parentid: "Parent ID",
    dateofbirth: "Date of Birth"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/admin/children", {
        ...form,
        parentid: parseInt(form.parentid),
        dateofbirth: form.dateofbirth || null,
      });
      alert("Child added: " + res.data.childid);
    } catch (err) {
      console.error(err);
      alert("Error adding child");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-blue-300 space-y-4">
      <h2 className="text-xl font-semibold">Add Child</h2>
      {Object.keys(form).map((key) => (
        <div key={key}>
          <label htmlFor={key} className="block mb-1 font-medium">
            {labels[key]}
          </label>
          <input
            id={key}
            type={key === "dateofbirth" ? "date" : "text"}
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

import React from "react";

export default function ClassSubjectSelector({
    classes,
    selectedClass,
    setSelectedClass,
    subjects,
    selectedSubject,
    setSelectedSubject,
}) {
    return (
        <div className="mb-4 max-w-sm">
            {/* Class Selector */}
            <label className="block mb-1 font-semibold">Select Class</label>
            <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full border rounded-md px-4 py-2 mb-4"
            >
                <option value="">-- Select Class --</option>
                {classes.map((c) => (
                    <option key={c.classid} value={c.classid}>
                        {c.classname} ({c.role})
                    </option>
                ))}
            </select>

            {/* Subject Selector */}
            {subjects.length > 0 && (
                <>
                    <label className="block mb-1 font-semibold">Select Subject</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="w-full border rounded-md px-4 py-2"
                    >
                        {subjects.map((subj) => (
                            <option key={subj} value={subj}>
                                {subj}
                            </option>
                        ))}
                    </select>
                </>
            )}
        </div>
    );
}

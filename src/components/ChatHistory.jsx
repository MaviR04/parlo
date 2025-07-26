import axios from 'axios';
import { ChatTabs } from './ChatTabs';
import React from "react";

export function ChatHistory({ contacts, selectedTeacher, onSelectTeacher }) {
  return (
    <div className="w-full col-span-1 h-full bg-white drop-shadow-md">
      <div className='w-full h-20 text-blue-400  items-center font-bold text-center rounded-b-2xl text-2xl'>
        Your Contacts
      </div>
      {contacts.map((child) => (
        <div key={child.childid} className='collapse collapse-arrow bg-white text-blue-400 drop-shadow-md'>
          <input type="radio" name="child"  />
          <div className="collapse-title font-semibold">
            {child.name}
          </div>
          <div className='collapse-content list'>
            {child.teachers.map((teacher) => (
              <div
                key={teacher.userid}
                onClick={() => onSelectTeacher(teacher, child)}
                style={{ cursor: "pointer" }}
              >
                <ChatTabs
                  name={teacher.name}
                  relation={teacher.role.split(" ")[0]}
                  child={child.name}
                  isSelected={selectedTeacher && selectedTeacher.userid === teacher.userid}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

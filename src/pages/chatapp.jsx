import { useEffect, useState} from "react";
import { ChatHistory } from "../components/ChatHistory";
import { ChatHeader } from "../components/ChatHeader";
import MsgDisplay from "../components/MsgDisplay";
import axios from "axios";

export default function Chatapp({}) {
    const [contacts, setContacts] = useState([
      {
        "childid": 1,
        "name": "John Doe",
        "teachers": [
          {
            "userid": 5,
            "name": "Alice Smith",
            "email": "alice@school.com",
            "role": "Math Teacher"
          },
          {
            "userid": 7,
            "name": "Bob Johnson",
            "email": "bob@school.com",
            "role": "Science Teacher"
          }
        ]
      },
      {
        "childid": 2,
        "name": "Emily Doe",
        "teachers": [
          {
            "userid": 8,
            "name": "Claire Adams",
            "email": "claire@school.com",
            "role": "English Teacher"
          }
        ]
      }
    ]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);

    // Handler for selecting a teacher
    const handleSelectTeacher = (teacher, child) => {
        setSelectedTeacher({ ...teacher, childName: child.name });
        console.log(selectedTeacher);
    };

    return (
      <div className="h-screen w-full grid grid-cols-3 grid-rows-1">
        <ChatHistory
          contacts={contacts}
          selectedTeacher={selectedTeacher}
          onSelectTeacher={handleSelectTeacher}
        />
        <div className="w-full h-full col-span-2 bg-white">
          <ChatHeader teacher={selectedTeacher} />
          <MsgDisplay teacher={selectedTeacher} />
        </div>
      </div>
    );
}

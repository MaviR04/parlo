import axios from 'axios';
import { ChatTabs } from './ChatTabs';
import React, { useEffect, useState } from "react";
export function ChatHistory({}) {

  const [selectChat, SetSelected] = useState(null)
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
])

//   useEffect(()=>{
//     axios.get("http://localhost:3001/msg/",{
//   withCredentials: true 
// })
//     .then(
//       (res)=>{
//         setRecents(res.data)
//         console.log(res.data)
//       }
//     )
//     .catch((err)=>{
//       console.log(err)
//     })
//   },[]) 

  return <div className="w-full col-span-1 h-full bg-white drop-shadow-md">
        <div className='w-full h-20 text-blue-400  items-center font-bold text-center rounded-b-2xl text-2xl'>
          Your Contacts
        </div>
        {contacts.map((child)=>(
          <div key={child.childid} className='collapse collapse-arrow bg-white text-blue-400 drop-shadow-md'>
            <input type="radio" name="child" checked="checked" />
             <div className="collapse-title font-semibold">
              {child.name}
             </div>
              <div className='collapse-content list'>
                {child.teachers.map((teacher)=>(
                  <ChatTabs key={teacher.userid} name={`${teacher.name}`} relation={teacher.role.split(" ")[0]} child={child.name} isSelected={false} />
                ))}
              </div>          
            </div>
          //<ChatTabs key={chat.conversationid} name={`${chat.otherfname} ${chat.otherlname}`} isNewMessage={false} isSelected={false} />
        ))}


      </div>;
}
  
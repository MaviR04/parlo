import axios from 'axios';
import { ChatTabs } from './ChatTabs';
import React, { useEffect, useState } from "react";
export function ChatHistory({}) {

  const [selectChat, SetSelected] = useState(null)
  const [recentChats, setRecents] = useState([])

  useEffect(()=>{
    axios.get("http://localhost:3001/msg/conversations",{
  withCredentials: true 
})
    .then(
      (res)=>{
        setRecents(res.data)
        console.log(res.data)
      }
    )
    .catch((err)=>{
      console.log(err)
    })
  },[]) 

  return <div className="w-full col-span-1 h-full bg-white drop-shadow-md">
        <div className='w-full h-20 text-blue-400  items-center font-bold text-center rounded-b-2xl text-2xl'>
          Recent Chats  
        </div>
        {recentChats.map((chat)=>(
          <ChatTabs key={chat.conversationid} name={`${chat.otherfname} ${chat.otherlname}`} isNewMessage={false} isSelected={false} />
        ))}


      </div>;
}
  
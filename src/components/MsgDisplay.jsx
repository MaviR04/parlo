import { useState } from 'react';
import { MsgBox } from './MsgBox'
import  Messages  from "./Messages.jsx";

    function MsgDisplay({ teacher }) {
      const [messages, setMessages] = useState([]);
      const [thread, setThread] = useState(null);

      const handleSend = (newMessage) => {
       if (newMessage.trim() !== "") {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
     };

     if(teacher === null) {
      return(
        <div className="w-full h-full flex items-center justify-center">
          <h2 className="text-blue-500 font-semibold text-2xl">Select a contact to start a thread!</h2>
        </div>
      )
     }
z
      return (
      <div>
        <div className="h-173 overflow-y-scroll">
          <Messages messages={messages}/>
        </div>
        <MsgBox onSend={handleSend} />
      </div>
      );
    }
  
export default MsgDisplay;
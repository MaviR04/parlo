import { useState } from 'react';
import { MsgBox } from './MsgBox'
import  Messages  from "./Messages.jsx";

    function MsgDisplay(props) {
      const [messages, setMessages] = useState([]);

      const handleSend = (newMessage) => {
       if (newMessage.trim() !== "") {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
     };

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
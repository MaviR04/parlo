import { useEffect} from "react";
import { ChatHistory } from "../components/ChatHistory";
import { ChatHeader } from "../components/ChatHeader";
import MsgDisplay from "../components/MsgDisplay";
import axios from "axios";

export default function Chatapp({}) {

    return (<div className="h-screen w-full grid grid-cols-3 grid-rows-1">
        <ChatHistory />  
        <div className="w-full h-full col-span-2 bg-white">
        {
        /* Header  */
        }
        <ChatHeader />
        <MsgDisplay />
        </div>
    </div>);
}

import { useRef} from "react";

export function MsgBox({onSend}) {
  
  const inputRef = useRef(null);

  return <div className="w-full bg-blue-400 p-5  flex flex-row justify-end rounded-2xl">
       <input type="text" placeholder="Type here" class="input w-full rounded-2xl" ref={inputRef}
        onKeyUp={(e)=>{
            if(e.key == "Enter"){
              HandleSend();
            }
          }}
       />
       <div className="flex items-center pl-6">
        <button
          onClick={()=>{
            HandleSend();
          }}
          
          >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
       </div>
      </div>;

  function HandleSend() {
    onSend(inputRef.current.value);
    inputRef.current.value = "";
    inputRef.current.focus();
  }
}
  
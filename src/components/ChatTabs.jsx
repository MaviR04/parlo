import React from "react";
export function ChatTabs({name,isNewMessage, isSelected}) {
  return <div className='flex flex-col gap-5 p-1'>
          <div className= {isSelected ? 'bg-white w-full h-20 rounded-2xl shadow-md flex' : 'bg-white w-full h-20 rounded-2xl  flex' } >
             <div className="avatar avatar-placeholder p-4">
                <div className="bg-neutral text-neutral-content w-12 h-12 rounded-full">
                  <span className="text-2xl">{name ? name.replace(/\b(Mr|Mrs|Miss)\.?\s*/gi, "").trim()[0] : " "}</span> 
                </div>
              </div>

              <div className='pt-2'>
                <div className='text-lg text-black'>
                  {name}
                </div>

                
                <div className={ isNewMessage ? 'text-md font-bold text-blue-400 opacity-70' : 'text-md font-bold text-black opacity-0'}>
                   New Messages 
                </div>
              </div>

          </div>
        </div>;
}
  
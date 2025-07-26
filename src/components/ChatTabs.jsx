import React from "react";
export function ChatTabs({name, relation, child ,isSelected}) {
  return <div className='flex flex-col gap-5 p-1'>
          <div className= {isSelected ? 'bg-white w-full h-20 rounded-2xl border-blue-400 border shadow-md flex' : 'bg-white w-full h-20 rounded-2xl flex hover:shadow-md transition' } >
             <div className="avatar avatar-placeholder p-4">
                <div className="bg-neutral text-neutral-content w-12 h-12 rounded-full">
                  <span className="text-2xl">{name ? name.replace(/\b(Mr|Mrs|Miss)\.?\s*/gi, "").trim()[0] : " "}</span> 
                </div>
              </div>

              <div className='pt-2'>
                <div className='text-lg text-black'>
                  {name}
                </div>

                
                <div className="text-md font-semibold text-black opacity-70">
                   Teaches {child} <span className="opacity-100 text-blue-600 font-bold"> {relation} </span>
                </div>
              </div>

          </div>
        </div>;
}
  
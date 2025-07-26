import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar'
import { createEventModalPlugin } from '@schedule-x/event-modal'
import { useEffect, useRef, useState } from 'react'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import '@schedule-x/theme-default/dist/index.css'
import axios from 'axios'
import api from '../axios'
import { useNavigate } from "react-router";

const colorClasses = [
  'blue',
  'red',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'teal',
  'gray',
  'dark-blue',
  'maroon'
];

const classColorMap = {}



const eventModal = createEventModalPlugin()


function CalendarApp({user}) {
  const eventsService = useState(() => createEventsServicePlugin())[0]
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedClassName, setSelectedClassName] = useState(null)
  const [event,setEvent] = useState({});
  const [events, setEvents] = useState([])
  let navigate = useNavigate();

   if(!user.userRole || user.userRole !== "Teacher"){
      if(user.userRole === "Admin"){
        navigate("/admin")
      }
      else if(user.userRole === "Parent"){
        navigate("/calendar")
      }
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <h1 className="text-2xl font-bold">Access Denied</h1>
            </div>
        );
    }



  const customComponents = {
  eventModal: ({ calendarEvent }) => {
    return (
    <div>
      <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="p-2">
          <h3 className="font-bold text-md">{calendarEvent.title}</h3>

          <div className='flex gap-2 items-center   pt-3'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
             <h2 className='font-md '>{(calendarEvent.start).split(" ")[0]}</h2>
          </div>
          <div className='flex gap-2 items-center pt-1'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h2 className='font-md'>{(calendarEvent.start).split(" ")[1]} - {(calendarEvent.end).split(" ")[1]}</h2>
          </div>
          <div className='flex gap-2 items-center pt-1'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
            <h2 className='font-md'>{calendarEvent.classname}</h2>
          </div>
          <div className='flex gap-2 items-center pt-4'>
            <p className="font-medium">{calendarEvent.description}</p>
          </div>

          <button 
          className='btn btn-error text-red-400'
          onClick={(e)=>{
            e.preventDefault()
            api.delete(`http://localhost:3001/announcement/${calendarEvent.id}`)
              .then(res => {
                console.log("Announcement deleted:", res.data)
                eventsService.remove(calendarEvent.id)
                
              })
              .catch(err => {
                console.error("Failed to delete announcement", err)
                alert("Failed to delete announcement")
                
              })
          }}
          >Delete</button>
  
        </div>
    </div>
    </div>
    );
  },
}


  

  useEffect(()=>{
    api.get("http://localhost:3001/announcement/my")
      .then((res) => {
        console.log(res.data)
        mapColors(res)
        const formattedEvents = res.data.map(event => {
        const classid = parseInt(event.classid)
        return {
          ...event,
          classid,
          _options: {
            additionalClasses: [classColorMap[classid] || 'blue']
          }
        }
      })
      console.log("Events fetched:", formattedEvents)
      eventsService.set(formattedEvents)
      setEvents(formattedEvents)
      })
      .catch((err) => {
        console.error('Error fetching announcements', err)
      })
  },[])

  const modalRef = useRef(null)
  const titleRef = useRef(null)
  const descRef = useRef(null)
  const startTimeref = useRef(null)
  const endTimeRef = useRef(null)

  const monthView = createViewMonthGrid()

  const callbacks = {
    onClickDate(date,e) {
      setEvent({...event, start: date, end: date})
      modalRef.current.showModal()
    },
  }

  const calendar = useCalendarApp({
    views: [monthView, createViewDay(), createViewWeek(), createViewMonthAgenda()],
    events: [],
    defaultView: monthView,
    plugins: [eventsService, eventModal],
    callbacks,
  })  

  useEffect(() => {
    axios
      .get('http://localhost:3001/admin/teaching-classes', { withCredentials: true })
      .then((res) => {
        setClasses(res.data)
        if (res.data.length > 0) setSelectedClass(res.data[0].classid)
      })
      .catch((err) => {
        console.error('Error fetching classes', err)
      })
  }, [])

  return (
    <div className="bg-white h-screen flex items-center justify-center">
      <div className="drop-shadow-md">
        <ScheduleXCalendar calendarApp={calendar} customComponents={customComponents}  />
      </div>

      <dialog
        data-modal
        ref={modalRef}
        className="bg-white p-4 rounded-lg shadow absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
      >
        <form action="">
          <div className="flex flex-col items-center w-80 p-4">
            <div className="flex w-full justify-end max-h-3">
              <div
                className="text-black cursor-pointer p-2 font-bold"
                onClick={() => {
                  modalRef.current.close()
                }}>
                X
              </div>
            </div>
            <h2 className="text-black font-semibold text-2xl p-4">Send Message</h2>
            <input
              type="text"
              placeholder="Message Title"
              ref={titleRef}
              className="input input-bordered w-full max-w-xs mb-2"
              required
            />
            <input
              type="text"
              placeholder="Message Description"
              ref={descRef}
              className="input input-bordered w-full max-w-xs mb-2"
              required
            />

            <div className="w-full mb-2">
              <label className="text-black block mb-1">Class</label>
              <select
                className="input input-bordered w-full"
                value={selectedClass || ""}
                onChange={(e) => {
                  setSelectedClass(parseInt(e.target.value))
                  setSelectedClassName(e.target.options[e.target.selectedIndex].text)
                }}
              >
                {classes.map((c) => (
                  <option key={c.classid} value={c.classid}>
                    {c.classname} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full">
              <label htmlFor="starttime" className="text-black">
                Start Time
              </label>
              <input
                type="time"
                ref={startTimeref}
                className="input w-full"
              />
            </div>
            <div className="w-full mt-2">
              <label htmlFor="endtime" className="text-black">
                End Time
              </label>
              <input
                type="time"
                ref={endTimeRef}
                className="input w-full"
              />
            </div>

            <button
              className="btn btn-primary bg-blue-400 mt-4"
              onClick={(e) => {
                e.preventDefault()
                if (!selectedClass) return alert("Please select a class")
                
                let eventstart = event.start
                let eventend = event.end
                //basically checking if  the user has selected a time if theyve not we just treat it like a full day event
                if(startTimeref.current.value && endTimeRef.current.value) {
                  eventstart = eventstart + " " + startTimeref.current.value
                  eventend = eventend + " " + endTimeRef.current.value
                }

                const updatedEvent = {
                  ...event,
                  title: titleRef.current.value,
                  description: descRef.current.value,
                  start: eventstart,
                  end: eventend,
                  classid: selectedClass,
                  classname: selectedClassName || classes.find(c => c.classid === selectedClass)?.classname,
                }
                console.log(updatedEvent)
                api.post("http://localhost:3001/announcement", updatedEvent)
                .then(res => {
                  console.log("Announcement posted:", res.data)
                  eventsService.add({...updatedEvent, id:res.data.announcementid });
                })
                .catch(err => {
                  console.error(err)
                  alert("Failed to post announcement")
                })

                setEvent(updatedEvent)


                modalRef.current.close()
              }}
            >
              Add Event
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default CalendarApp
const usedColors = new Set()

function mapColors(res) {
  res.data.forEach(event => {
    event.classid = parseInt(event.classid)

    if (!classColorMap[event.classid]) {
      // Filter unused colors
      const availableColors = colorClasses.filter(c => !usedColors.has(c))

      // Fallback in case all colors are used
      const chosenColor = availableColors.length > 0
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : colorClasses[Math.floor(Math.random() * colorClasses.length)] // allow repeats if necessary

      classColorMap[event.classid] = chosenColor
      usedColors.add(chosenColor)
    }
  })
}

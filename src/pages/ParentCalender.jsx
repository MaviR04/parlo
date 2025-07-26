import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar'
import { createEventModalPlugin } from '@schedule-x/event-modal'
import { useEffect, useState } from 'react'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import '@schedule-x/theme-default/dist/index.css'
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
  const [events, setEvents] = useState([])
  let navigate = useNavigate();


     if(!user.userRole || user.userRole !== "Parent"){
      if(user.userRole === "Admin"){
        navigate("/admin")
      }
      else if(user.userRole === "Teacher"){
        navigate("/teacher")
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
          <h3 className="font-bold text-lg text-blue-400">{calendarEvent.title}</h3>

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
          <div className='flex gap-2 items-center pt-1'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <h2 className='font-md'>{calendarEvent.teacher_name} - <span className='opacity-75'> {calendarEvent.teacher_role}</span> </h2>
          </div>

          <div className='flex gap-2 items-center pt-4'>
            <p className="font-medium">{calendarEvent.description}</p>
          </div>
  
        </div>
    </div>
    </div>
    );
  },
}


  

  useEffect(()=>{
    api.get("http://localhost:3001/announcement/for-parent")
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



  const monthView = createViewMonthGrid()



  const calendar = useCalendarApp({
    views: [monthView, createViewDay(), createViewWeek(), createViewMonthAgenda()],
    events: [],
    defaultView: monthView,
    plugins: [eventsService, eventModal],
  })  



  return (
    <div className="bg-white h-screen flex items-center justify-center">
      <div className="drop-shadow-md">
        <ScheduleXCalendar calendarApp={calendar} customComponents={customComponents}  />
      </div>
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

import { useEffect, useState } from "react"
import api from "../axios"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function ParentList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [parentsRes, eventsRes] = await Promise.all([
          api.get("/tracking/teachers/parents"),
          api.get("/tracking/teachers/parent-events"),
        ])

        const parents = parentsRes.data
        const events = eventsRes.data
        console.log(parents, events)
        // Merge logic
        const merged = parents.map((parent) => ({
          ...parent,
          events: events.filter((e) => Number(e.parentid) === parent.parentid),
        }))

        setData(merged)
      } catch (err) {
        console.error("Error fetching data", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <p className="p-4">Loading...</p>

  return (
    <TooltipProvider>
        <h1 className="font-semibold text-2xl p-2 mt-6">Parent Info</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2 p-2">
        {data.map((parent) => {
          const total = parent.events.length
          const holisticCount = parent.events.filter(
            (e) => e.classification === "holistic"
          ).length
          const goalOrientedCount = parent.events.filter(
            (e) => e.classification === "goal_oriented"
          ).length

          const holisticPercent = total ? (holisticCount / total) * 100 : 0
          const goalPercent = total ? (goalOrientedCount / total) * 100 : 0

          return (
            <Card key={parent.parentid} className="rounded-2xl shadow-md p-4">
              <CardContent className="space-y-4">
                {/* Parent info */}
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    {parent.fname} {parent.lname}
                  </h2>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-sm px-3 py-1 bg-gray-100 rounded-full">
                        {parent.designation && parent.designation === "holistic" ? "Holistic" : "Goal Oriented"}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        {parent.designation === "holistic"
                          ? "Parent appreciates detailed comments and whole-child progress."
                          : "Parent values goal tracking and measurable outcomes."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Event Classification Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Holistic ({holisticCount})</span>
                    <span>Goal Oriented ({goalOrientedCount})</span>
                  </div>
                  <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-200">
                    <div
                      className="bg-green-500"
                      style={{ width: `${holisticPercent}%` }}
                    />
                    <div
                      className="bg-blue-500"
                      style={{ width: `${goalPercent}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

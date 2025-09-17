import useBadges from "../hooks/useBadges";

export default function BadgesTab({ childId, termId }) {
  const { data, loading } = useBadges(childId, termId, true);

  return (
    <div className="shadow-lg rounded-2xl border-1">
      <h2 className="text-2xl text-white bg-blue-400 font-semibold mb-6 rounded-t-2xl p-2 ">Badges Earned</h2> 
      <div className=" bg-orange-400 bg-yellow-400 bg-green-400 bg-teal-400 bg-red-300 bg-green-300"></div>
      <div className="px-4 pb-2 pt-2">          
        {loading ? <p>Loading badges…</p> :
          !data || Object.keys(data).length === 0 ? <p className="text-gray-500 italic">No badges earned this term.</p> :
          Object.entries(data).map(([activity, badges]) => (
            <div key={activity} className="mb-6">
              <h3 className="text-md font-semibold mb-3 text-gray-800">{activity}</h3>
              <div className="flex gap-4 flex-wrap">
                {badges.map((b, i) => (
                  <div key={i}
                    className={`flex items-center bg-${b.color == "gold" ? "yellow" : b.color}-400 gap-3 px-5 py-3 rounded-full shadow-md text-gray-800 font-semibold text-base transition-transform hover:scale-105`}
                    >
                    <span>{b.name}</span>
                    <span className="bg-white text-gray-800 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-sm">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
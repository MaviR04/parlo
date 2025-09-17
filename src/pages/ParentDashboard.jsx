import { useEffect, useState } from "react";
import api from "../axios";
import { Link } from "react-router-dom";
import BadgesTab from "../components/Activities/tabs/BadgesTab"
import InsightsTab from "../components/academics/InsightsTab";

export default function ParentDashboard({ user }) {
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [comments, setCommments] = useState(null);
    const [designation, setDesignation] = useState("goal_oriented")

    useEffect(() => {
        async function fetchChildren() {
            try {
                const res = await api.get("/parent/my-children", { withCredentials: true });
                setChildren(res.data);
                console.log(res.data)
                res.data.forEach(async child => {
                    const childComments = await api.get(`/p-comments/${child.childid}/6`, {withCredentials: true});
                    console.log(childComments.data);
                     const commentsWithChildId = childComments.data.map(comment => {
                        return {
                        ...comment,
                        childname: child.fname + " " + child.lname // Add the childid property to each comment object
                        };
                    });
                    setCommments(commentsWithChildId); 
                });
            } catch (err) {
                console.error("❌ Failed to load children", err);
                setError("Failed to load your children list.");
            } finally {
                setLoading(false);
            }
        }
        fetchChildren();
    }, []);

    useEffect( ()=>{
       async function FetchDesignation(){
            const res =  await api.get("/tracking/designation")
            console.log(res.data.designation);
            setDesignation(res.data.designation);
        }
        FetchDesignation();
    },[])


    if (loading) return <p className="text-center mt-10">Loading your children...</p>;
    if (error) return <p className="text-center text-red-600 mt-10">{error}</p>;

    return (
       <div className="bg-gray-50 min-h-screen">
            <div className=" bg-gray-50 px-4 py-6">
                <h1 className="text-3xl font-semibold text-gray-800 mb-6">My Children</h1>

                {children.length === 0 ? (
                    <p className="text-gray-600">No children found linked to your account.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {children.map((child) => (
                            <Link
                                key={child.childid}
                                to={`/parent/student/${child.childid}`}
                                className="p-4 rounded-xl border shadow-sm bg-white hover:bg-gray-50 hover:shadow-md hover:border-blue-300 transition"
                            >
                                <h2 className="text-lg font-medium text-gray-800">
                                    {child.fname} {child.lname}
                                </h2>
                                <p className="text-sm text-gray-500">{child.classname}</p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
           {designation == "goal_oriented" ?  <InsightsTab childId={children[0].childid} termId={6}/> : 
            <div className="grid grid-cols-2 gap-10 p-2">
               <div className=" shadow-md rounded-2xl">                 
                    <h1 className="text-2xl bg-blue-400 font-semibold p-2 rounded-t-2xl text-white">Recent Comments about your children</h1>
                    <div className=" text-black flex flex-wrap gap-4 p-4">
                        
                        {
                            comments ?
                            comments.map(comment => (
                                <div className="bg-white p-4 rounded-2xl text-black w-80 shadow-md">
                                    <h3 className="text-xl font-semibold"> {comment.title ? comment.title : comment.activity_name} </h3>
                                    <p className="text-sm font-medium mt-2">for: {comment.childname}</p>
                                    <p className="text-sm font-medium text-gray-700">by: {comment.author_fname + " " + comment.author_lname}</p>
                                    <div className={" bg-" + comment.label_color + "-300" + " text-" + comment.label_color + "-600" + " rounded-2xl w-fit px-2 text-sm mt-1 " }>{comment.label_name}</div>
                                    <p className="text-md mt-3">{comment.body}</p>


                                </div>
                            )) :
                            "fetching comments"
                        }
                    </div> 
               </div>
                <div>
                    <BadgesTab childId={children[0].childid} termId={6} />
                </div>
            </div>
                }
        </div>
    );
}

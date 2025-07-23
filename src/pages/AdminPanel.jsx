import axios from "axios"
import AddChildForm from "../components/AddChildForm"
import AddClassForm from "../components/AddClasForm"
import AddUserForm from "../components/AddUserForm"
import AssignChildToClass from "../components/AssignChildToClass"
import AssignUserToClass from "../components/AssignUserToClass"
import api from "../axios"
import { useEffect } from "react"


export default function AdminPanel(){
    useEffect(() => { api.get("/auth/test")
    .then((res)=>{
        console.log("School ID:", res.data);
    })}, []);
   

    return(
        <div className="bg-white h-screen">
        <div>
            <h2 className="text-2xl font-bold p-4 text-blue-400">Admin Panel</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            <AddUserForm />
            <AddClassForm />
            <AddChildForm />
        </div>
        <h2 className="p-4 text-2xl font-bold text-blue-300">Assign Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white">
            <AssignUserToClass />
            <AssignChildToClass />
        </div>

        </div>
    )
}
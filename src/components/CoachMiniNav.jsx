import { Link } from "react-router-dom";

export default function CoachMiniNav() {
    return (
        <nav className="bg-blue-500 text-white p-2 flex gap-4">
            <Link to="/coach-dashboard">My Activities</Link>
            <Link to="/coach-log" >Log Weekly Report </Link>
            <Link to="/coach-history">History</Link>
            <Link to="/coach-badge">Badge Distribution</Link>
            <Link to="/coach/general-comments">General Comments</Link> {/* Placeholder for now */}
        </nav>
    );
}

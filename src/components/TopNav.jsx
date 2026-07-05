import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";

export default function TopNav() {
  return (
    <header className="topbar">
      <NavLink to="/" className="wordmark" end>
        Archive
      </NavLink>

      <nav className="page-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Index
        </NavLink>
        <span className="sep">,</span>
        <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
          About
        </NavLink>
      </nav>

      <div className="topbar-right">
        <NavLink to="/new" className={({ isActive }) => (isActive ? "active" : "")}>
          New Entry
        </NavLink>
        <span className="sep">,</span>
        <button className="link-btn" onClick={() => signOut(auth)}>
          Sign Out
        </button>
      </div>
    </header>
  );
}

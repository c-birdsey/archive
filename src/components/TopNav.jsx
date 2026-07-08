import { NavLink, useLocation } from "react-router-dom";

export default function TopNav() {
  const location = useLocation();
  const familiesActive = location.pathname.startsWith("/famil"); // /families and /family/:id

  return (
    <header className="topbar">
      <NavLink to="/" className="wordmark" end>
        Register
      </NavLink>

      <nav className="page-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Index
        </NavLink>
        <NavLink to="/families" className={familiesActive ? "active" : ""}>
          Families
        </NavLink>
      </nav>

      <div className="topbar-right">
        <NavLink to="/new" className={({ isActive }) => (isActive ? "active" : "")}>
          New Entry
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
          About
        </NavLink>
      </div>
    </header>
  );
}

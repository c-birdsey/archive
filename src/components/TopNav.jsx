import { NavLink, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase.js";

export default function TopNav({
  signedOut = false,
  onSignInClick,
  onSearchClick,
  onInfoClick,
  infoActive,
  onFamiliesClick,
  familiesActive,
  mobile = false,
}) {
  const location = useLocation();
  // Active either while the Families overlay is open, or while viewing a
  // specific family's (still routed) detail page.
  const familiesIsActive = familiesActive || location.pathname.startsWith("/family/");
  const addIsActive = location.pathname === "/new" || location.pathname === "/new-family" || location.pathname === "/flotsam/new";

  if (signedOut) {
    return (
      <header className="topbar">
        <NavLink to="/" className="wordmark" end>
          Register
        </NavLink>
        <button type="button" className="topbar-signin" onClick={onSignInClick}>
          Sign In
        </button>
      </header>
    );
  }

  // Mobile is restricted to Fragments only, so the whole header is its
  // own simpler layout rather than a subset of the desktop one -- no
  // Register wordmark (Fragments takes that corner instead), no
  // Index/Families/Search/Info, and no hover-dropdown (hover doesn't
  // exist on touch).
  if (mobile) {
    return (
      <header className="topbar topbar-mobile">
        <NavLink to="/flotsam" className="wordmark" end>
          Fragments
        </NavLink>
        <div className="topbar-right">
          <NavLink to="/flotsam/new" className={({ isActive }) => (isActive ? "active" : "")}>
            +Add
          </NavLink>
          <button type="button" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="topbar">
      <NavLink to="/" className="wordmark" end>
        Register
      </NavLink>

      <nav className="page-nav">
        <NavLink to="/index" end className={({ isActive }) => (isActive ? "active" : "")}>
          Index
        </NavLink>
        <button type="button" className={familiesIsActive ? "active" : ""} onClick={onFamiliesClick}>
          Families
        </button>
        <NavLink to="/flotsam" className={({ isActive }) => (isActive ? "active" : "")}>
          Fragments
        </NavLink>
        <button type="button" onClick={onSearchClick}>
          Search
        </button>
      </nav>

      <div className="topbar-right">
        <div className="nav-add">
          <span className={addIsActive ? "nav-add-label active" : "nav-add-label"}>+Add</span>
          <div className="nav-add-menu">
            <NavLink to="/new" className={({ isActive }) => (isActive ? "active" : "")}>
              Entry
            </NavLink>
            <NavLink to="/new-family" className={({ isActive }) => (isActive ? "active" : "")}>
              Family
            </NavLink>
            <NavLink to="/flotsam/new" className={({ isActive }) => (isActive ? "active" : "")}>
              Fragment
            </NavLink>
          </div>
        </div>
        <div className="topbar-end-group">
          <button type="button" className={infoActive ? "active" : ""} onClick={onInfoClick}>
            Info
          </button>
          <button type="button" onClick={() => signOut(auth)}>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

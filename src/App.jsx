import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { signInWithPopup, signOut } from "firebase/auth";
import { useAuth } from "./hooks/useAuth.js";
import { useEntries } from "./hooks/useEntries.js";
import { useFamilies } from "./hooks/useFamilies.js";
import { useFlotsam } from "./hooks/useFlotsam.js";
import { auth, googleProvider } from "./firebase.js";
import { ALLOWED_EMAILS } from "./firebase-config.js";
import { ensureDescriptorFieldsSeeded } from "./data/descriptorFields.js";
import TopNav from "./components/TopNav.jsx";
import SearchOverlay from "./components/SearchOverlay.jsx";
import InfoOverlay from "./components/InfoOverlay.jsx";
import FamiliesOverlay from "./components/FamiliesOverlay.jsx";
import ScrollToTopButton from "./components/ScrollToTopButton.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import IndexPage from "./pages/IndexPage.jsx";
import FamilyDetailPage from "./pages/FamilyDetailPage.jsx";
import NewEntryPage from "./pages/NewEntryPage.jsx";
import NewFamilyPage from "./pages/NewFamilyPage.jsx";
import EntryDetailPage from "./pages/EntryDetailPage.jsx";
import FlotsamPage from "./pages/FlotsamPage.jsx";
import FlotsamDetailPage from "./pages/FlotsamDetailPage.jsx";
import NewFlotsamPage from "./pages/NewFlotsamPage.jsx";
import DebugPage from "./pages/DebugPage.jsx";

const MOBILE_BREAKPOINT = 900;

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [overlay, setOverlay] = useState(null); // null | "search" | "info" | "families"
  const [authError, setAuthError] = useState("");
  const user = useAuth();
  const location = useLocation();

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Prevents a stray text-input caret from lingering on screen after the
  // element that owned it unmounts — e.g. leaving a page with a focused
  // search box, or the auth gate swapping views on sign-in/sign-out.
  // Also resets scroll position -- React Router doesn't do this on its
  // own, so navigating to a new page would otherwise keep whatever
  // scroll offset the previous page was left at.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setOverlay(null);
    window.scrollTo(0, 0);
  }, [location.pathname, user]);

  const isAllowed = Boolean(user && ALLOWED_EMAILS.includes(user.email));
  const { entries } = useEntries(isAllowed);
  const families = useFamilies(isAllowed);
  const flotsam = useFlotsam(isAllowed);

  useEffect(() => {
    if (isAllowed) ensureDescriptorFieldsSeeded();
  }, [isAllowed]);

  async function handleSignIn() {
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(describeAuthError(err));
    }
  }

  if (user && !isAllowed) {
    return (
      <div className="page">
        <p className="access-denied-notice">
          {user.email} isn't on the archive's access list.{" "}
          <button type="button" className="link-btn" onClick={() => signOut(auth)}>
            Please use a different account.
          </button>
        </p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="page">
        <TopNav signedOut onSignInClick={handleSignIn} />
        <LandingPage notice={authError || null} />
      </div>
    );
  }

  // Only the grid (/flotsam) and a single item (/flotsam/:id) invert --
  // the New/Edit form stays on the normal light theme like every other
  // overlay form, since the semi-transparent .overlay background assumes
  // a light page underneath it.
  const isFlotsam = /^\/flotsam(\/[^/]+)?$/.test(location.pathname) && location.pathname !== "/flotsam/new";

  return (
    <div className={isFlotsam ? "page page-flotsam" : "page"}>
      <TopNav
        mobile={isMobile}
        onSearchClick={() => setOverlay("search")}
        onInfoClick={() => setOverlay("info")}
        infoActive={overlay === "info"}
        onFamiliesClick={() => setOverlay("families")}
        familiesActive={overlay === "families"}
      />
      <Routes>
        {isMobile ? (
          <Route path="/" element={<Navigate to="/flotsam" replace />} />
        ) : (
          <Route
            path="/"
            element={<LandingPage showExploreLinks onFamiliesClick={() => setOverlay("families")} />}
          />
        )}
        <Route path="/flotsam" element={<FlotsamPage flotsam={flotsam} />} />
        <Route path="/flotsam/new" element={<NewFlotsamPage entries={entries} flotsam={flotsam} user={user} mobile={isMobile} />} />
        <Route path="/flotsam/:id" element={<FlotsamDetailPage flotsam={flotsam} mobile={isMobile} />} />
        <Route path="/flotsam/:id/edit" element={<NewFlotsamPage entries={entries} flotsam={flotsam} user={user} mobile={isMobile} />} />
        {/* Everything below is desktop-only -- on mobile, the whole
            archive (Index/Families/Entries) is off-limits and any of
            these paths just bounce back to Fragments. */}
        {isMobile ? (
          <Route path="*" element={<Navigate to="/flotsam" replace />} />
        ) : (
          <>
            <Route path="/index" element={<IndexPage entries={entries} />} />
            <Route
              path="/family/:id"
              element={<FamilyDetailPage entries={entries} onFamiliesClick={() => setOverlay("families")} />}
            />
            <Route path="/new" element={<NewEntryPage entries={entries} user={user} onInfoClick={() => setOverlay("info")} infoOpen={overlay === "info"} />} />
            <Route path="/new-family" element={<NewFamilyPage entries={entries} user={user} />} />
            <Route path="/family/:id/edit" element={<NewFamilyPage entries={entries} user={user} />} />
            <Route path="/entry/:id" element={<EntryDetailPage entries={entries} user={user} />} />
            <Route path="/entry/:id/edit" element={<NewEntryPage entries={entries} user={user} onInfoClick={() => setOverlay("info")} infoOpen={overlay === "info"} />} />
            <Route path="/__debug" element={<DebugPage user={user} />} />
          </>
        )}
      </Routes>
      <SearchOverlay
        open={overlay === "search"}
        onClose={() => setOverlay(null)}
        entries={entries}
        families={families}
      />
      <InfoOverlay open={overlay === "info"} onClose={() => setOverlay(null)} />
      <FamiliesOverlay
        open={overlay === "families"}
        onClose={() => setOverlay(null)}
        families={families}
      />
      <ScrollToTopButton />
    </div>
  );
}

function describeAuthError(err) {
  if (err.code === "auth/popup-closed-by-user") return "Sign-in was closed before completing.";
  if (err.code === "auth/unauthorized-domain") {
    return "This domain isn't authorized in Firebase Console → Authentication → Settings → Authorized domains.";
  }
  return `Sign-in failed: ${err.message}`;
}

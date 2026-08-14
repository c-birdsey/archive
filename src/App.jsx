import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { signInWithPopup, signOut } from "firebase/auth";
import { useAuth } from "./hooks/useAuth.js";
import { useEntries } from "./hooks/useEntries.js";
import { useFamilies } from "./hooks/useFamilies.js";
import { auth, googleProvider } from "./firebase.js";
import { ALLOWED_EMAILS } from "./firebase-config.js";
import { ensureDescriptorFieldsSeeded } from "./data/descriptorFields.js";
import PasscodeGate, { isLobbyUnlocked } from "./pages/PasscodeGate.jsx";
import MobileBlock from "./pages/MobileBlock.jsx";
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
import DebugPage from "./pages/DebugPage.jsx";

const MOBILE_BREAKPOINT = 900;

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [unlocked, setUnlocked] = useState(isLobbyUnlocked());
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

  if (isMobile) return <MobileBlock />;
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;

  if (!isAllowed) {
    const notice = user ? (
      <>
        {user.email} isn't on the archive's access list.{" "}
        <button type="button" className="link-btn" onClick={() => signOut(auth)}>
          Try a different account
        </button>
      </>
    ) : (
      authError || null
    );

    return (
      <div className="page">
        <TopNav signedOut denied={Boolean(user)} onSignInClick={handleSignIn} />
        <LandingPage notice={notice} />
      </div>
    );
  }

  return (
    <div className="page">
      <TopNav
        onSearchClick={() => setOverlay("search")}
        onInfoClick={() => setOverlay("info")}
        infoActive={overlay === "info"}
        onFamiliesClick={() => setOverlay("families")}
        familiesActive={overlay === "families"}
      />
      <Routes>
        <Route
          path="/"
          element={<LandingPage showExploreLinks onFamiliesClick={() => setOverlay("families")} />}
        />
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

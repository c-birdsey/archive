import { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { useEntries } from "./hooks/useEntries.js";
import { ALLOWED_EMAILS } from "./firebase-config.js";
import PasscodeGate, { isLobbyUnlocked } from "./pages/PasscodeGate.jsx";
import MobileBlock from "./pages/MobileBlock.jsx";
import SignInGate from "./pages/SignInGate.jsx";
import TopNav from "./components/TopNav.jsx";
import IndexPage from "./pages/IndexPage.jsx";
import TagIndexPage from "./pages/TagIndexPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import NewEntryPage from "./pages/NewEntryPage.jsx";
import EntryDetailPage from "./pages/EntryDetailPage.jsx";

const MOBILE_BREAKPOINT = 900;

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [unlocked, setUnlocked] = useState(isLobbyUnlocked());
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
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [location.pathname, user]);

  const isAllowed = user && ALLOWED_EMAILS.includes(user.email);
  const { entries } = useEntries(Boolean(isAllowed));

  if (isMobile) return <MobileBlock />;
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  if (user === undefined) return <div className="lobby"><p className="wordmark">Register</p></div>;
  if (!user) return <SignInGate />;
  if (!isAllowed) return <SignInGate deniedUser={user} />;

  return (
    <div className="page">
      <TopNav />
      <Routes>
        <Route path="/" element={<IndexPage entries={entries} />} />
        <Route path="/tag/:tag" element={<TagIndexPage entries={entries} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/new" element={<NewEntryPage entries={entries} user={user} />} />
        <Route path="/entry/:id" element={<EntryDetailPage entries={entries} />} />
        <Route path="/entry/:id/edit" element={<NewEntryPage entries={entries} user={user} />} />
      </Routes>
    </div>
  );
}

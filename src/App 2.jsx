import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { useEntries } from "./hooks/useEntries.js";
import { ALLOWED_EMAILS } from "./firebase-config.js";
import PasscodeGate, { isLobbyUnlocked } from "./pages/PasscodeGate.jsx";
import MobileBlock from "./pages/MobileBlock.jsx";
import SignInGate from "./pages/SignInGate.jsx";
import TopNav from "./components/TopNav.jsx";
import IndexPage from "./pages/IndexPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import NewEntryPage from "./pages/NewEntryPage.jsx";
import EntryDetailPage from "./pages/EntryDetailPage.jsx";

const MOBILE_BREAKPOINT = 900;

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [unlocked, setUnlocked] = useState(isLobbyUnlocked());
  const user = useAuth();

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isAllowed = user && ALLOWED_EMAILS.includes(user.email);
  const { entries } = useEntries(Boolean(isAllowed));

  if (isMobile) return <MobileBlock />;
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  if (user === undefined) return <div className="lobby"><p className="wordmark">Archive</p></div>;
  if (!user) return <SignInGate />;
  if (!isAllowed) return <SignInGate deniedUser={user} />;

  return (
    <div className="page">
      <TopNav syncStatus="live" />
      <Routes>
        <Route path="/" element={<IndexPage entries={entries} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/new" element={<NewEntryPage entries={entries} user={user} />} />
        <Route path="/entry/:id" element={<EntryDetailPage entries={entries} />} />
        <Route path="/entry/:id/edit" element={<NewEntryPage entries={entries} user={user} />} />
      </Routes>
    </div>
  );
}

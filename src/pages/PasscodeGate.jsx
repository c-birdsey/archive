import { useState } from "react";
import { LOBBY_PASSCODE } from "../firebase-config.js";

const SESSION_KEY = "archive_lobby_unlocked";

export function isLobbyUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

export default function PasscodeGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (value === LOBBY_PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setError(false);
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <div className="lobby">
      <form className="lobby-card" onSubmit={submit}>
        <p className="wordmark">Register</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Passcode"
          autoFocus
        />
        <button type="submit" className="solid-btn">Enter</button>
        {error && <p className="auth-error">Incorrect passcode.</p>}
      </form>
    </div>
  );
}

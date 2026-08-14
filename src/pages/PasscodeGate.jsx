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
    <div className="overlay">
      <form className="overlay-bar" onSubmit={submit}>
        <input
          type="password"
          className="search-overlay-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-protonpass-ignore="true"
          data-form-type="other"
        />
        <button type="submit" className="overlay-close">Enter</button>
      </form>
      {error && <p className="auth-error">Incorrect passcode.</p>}
    </div>
  );
}

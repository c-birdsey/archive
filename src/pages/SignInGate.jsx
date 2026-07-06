import { useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase.js";

export default function SignInGate({ deniedUser }) {
  const [error, setError] = useState("");

  async function handleSignIn() {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(describeAuthError(err));
    }
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <p className="wordmark">Register</p>

        {deniedUser ? (
          <>
            <p className="auth-error">
              {deniedUser.email} isn't on the archive's access list.
            </p>
            <button className="link-btn" onClick={() => signOut(auth)}>
              Try a different account
            </button>
          </>
        ) : (
          <button className="solid-btn" onClick={handleSignIn}>
            Sign in with Google
          </button>
        )}

        {error && <p className="auth-error">{error}</p>}
      </div>
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

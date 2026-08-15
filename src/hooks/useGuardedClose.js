import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Two-step close, shared by the Close button and the Escape-key handler
// so neither can bypass the other. If there's nothing to lose, the first
// attempt navigates away immediately; otherwise it flips into a
// confirming state (the button's label switches to the warning) and only
// a second attempt actually navigates. Clicking (or tabbing) away from
// the button without confirming resets it back to the plain label --
// see resetConfirming, wired to the button's onBlur.
export function useGuardedClose(hasChanges) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  function attemptClose() {
    if (hasChanges && !confirming) {
      setConfirming(true);
      return;
    }
    navigate(-1);
  }

  function resetConfirming() {
    setConfirming(false);
  }

  return { confirming, attemptClose, resetConfirming };
}

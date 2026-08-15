import { useEffect, useState } from "react";
import { subscribeFlotsam } from "../data/flotsam.js";

// Live subscription to the "flotsam" collection — same pattern as
// useFamilies/useEntries.
export function useFlotsam(enabled) {
  const [flotsam, setFlotsam] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setFlotsam([]);
      return;
    }
    return subscribeFlotsam(setFlotsam, (err) =>
      console.error("Failed to load flotsam", err)
    );
  }, [enabled]);

  return flotsam;
}

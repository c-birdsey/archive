import { useEffect, useState } from "react";
import { subscribeFamilies } from "../data/families.js";

// Live subscription to the "families" collection — same pattern as
// useEntries.
export function useFamilies(enabled) {
  const [families, setFamilies] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setFamilies([]);
      return;
    }
    return subscribeFamilies(setFamilies, (err) =>
      console.error("Failed to load families", err)
    );
  }, [enabled]);

  return families;
}

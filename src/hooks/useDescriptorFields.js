import { useEffect, useState } from "react";
import { subscribeDescriptorFields } from "../data/descriptorFields.js";

// Live subscription to the configurable descriptor field list
// (config/descriptorFields) — same pattern as useEntries.
export function useDescriptorFields(enabled) {
  const [fields, setFields] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setFields([]);
      return;
    }
    return subscribeDescriptorFields(setFields, (err) =>
      console.error("Failed to load descriptor fields", err)
    );
  }, [enabled]);

  return fields;
}

import { useEffect, useState } from "react";
import { subscribeEntries } from "../data/entries.js";

// Subscribes to the whole "entries" collection in real time. At the scale
// this app is meant for (a personal/small-group reference archive — tens
// to low thousands of entries) fetching everything client-side and
// filtering/searching in memory is simpler and more honest than partial
// pagination, and it's what makes the searchable dropdowns and full-text
// note search work without a separate search service.
export function useEntries(enabled) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setEntries([]);
      setLoading(true);
      return;
    }
    const unsub = subscribeEntries(
      (docs) => {
        setEntries(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load entries", err);
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [enabled]);

  return { entries, loading, error };
}

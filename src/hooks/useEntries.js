import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase.js";

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
    const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

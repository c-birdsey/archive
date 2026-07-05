import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";

export default function EntryDetailPage({ entries }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);

  const relatedEntries = useMemo(() => {
    if (!entry?.relatedIds) return [];
    return entry.relatedIds
      .map((rid) => entries.find((e) => e.id === rid))
      .filter(Boolean);
  }, [entry, entries]);

  if (!entry) {
    return (
      <main className="entry-detail">
        <p>This entry doesn't exist, or has been deleted.</p>
        <Link className="link-btn" to="/">Back to index</Link>
      </main>
    );
  }

  async function handleDelete() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "entries", entry.id));
      if (entry.imageStoragePath) {
        try { await deleteObject(ref(storage, entry.imageStoragePath)); }
        catch (e) { console.warn("Couldn't delete stored image:", e.message); }
      }
      navigate("/");
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  }

  return (
    <main className="entry-detail">
      <div className="entry-detail-meta">
        <span>{entry.type || "—"}</span>
        <span>{fullDate(entry.createdAt)}</span>
        <span>{entry.author?.name || "Unknown"}</span>
      </div>

      {entry.imageUrl && <img className="entry-detail-image" src={entry.imageUrl} alt="" />}

      <h1 className="entry-detail-title">{entry.title}</h1>

      {entry.link && (
        <a className="view-url" href={entry.link} target="_blank" rel="noopener noreferrer">
          {entry.link}
        </a>
      )}

      {entry.notes && <p className="entry-detail-notes">{entry.notes}</p>}

      {entry.tags && entry.tags.length > 0 && (
        <p className="entry-detail-tags">{entry.tags.join(", ")}</p>
      )}

      {relatedEntries.length > 0 && (
        <div className="entry-detail-related">
          <p className="related-label">Related</p>
          <ul>
            {relatedEntries.map((r) => (
              <li key={r.id}>
                <Link to={`/entry/${r.id}`}>{r.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="view-actions">
        <button className="link-btn" onClick={() => navigate(`/entry/${entry.id}/edit`)}>
          Edit
        </button>
        <button className="link-btn" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <Link className="link-btn" to="/">Back to index</Link>
      </div>
    </main>
  );
}

function fullDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

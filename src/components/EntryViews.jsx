import { useMemo } from "react";
import LetterGroupedList from "./LetterGroupedList.jsx";
import ScrollRevealTile from "./ScrollRevealTile.jsx";
import { isPdf } from "../data/entries.js";
import { youtubeThumbnail } from "../data/youtube.js";

export function ListView({ entries, onOpen }) {
  return (
    <LetterGroupedList
      items={entries}
      labelOf={(e) => e.title || ""}
      keyOf={(e) => e.id}
      renderItem={(entry) => (
        <button
          type="button"
          key={entry.id}
          className="list-row"
          onClick={() => onOpen(entry.id)}
        >
          <span className="row-title-cell">
            <span className="row-title">{entry.title}</span>
            {entry.tags && entry.tags.length > 0 && (
              <span className="row-tags"> — {entry.tags.join(", ")}</span>
            )}
          </span>
          <span className="row-author">{entry.postedBy?.name || "—"}</span>
          <span className="row-year">{yearOf(entry.createdAt)}</span>
        </button>
      )}
    />
  );
}

export function ImagesView({ entries, onOpen, chronological = false }) {
  // Default order is randomized rather than chronological/alphabetical --
  // stable across re-renders within a page load (filters, Firestore
  // updates) via a per-id weight assigned once and reused, but reshuffles
  // on next reload since the weight map itself doesn't survive a remount.
  // "Sort" switches to newest-first by creation time instead.
  const weights = useMemo(() => new Map(), []);
  const sorted = useMemo(() => {
    if (chronological) {
      return [...entries].sort((a, b) => dateOf(b.createdAt) - dateOf(a.createdAt));
    }
    for (const e of entries) {
      if (!weights.has(e.id)) weights.set(e.id, Math.random());
    }
    return [...entries].sort((a, b) => weights.get(a.id) - weights.get(b.id));
  }, [entries, weights, chronological]);
  return (
    <main className="images-grid">
      {sorted.map((entry) => {
        const cover = entry.content?.type === "images" ? entry.content.images?.[0] : null;
        const coverUrl = cover
          ? (isPdf(cover) ? cover.thumbUrl || null : cover.url)
          : youtubeThumbnail(entry.link);
        return <ImageTile key={entry.id} entry={entry} coverUrl={coverUrl} onOpen={onOpen} />;
      })}
    </main>
  );
}

// Entries are already all loaded client-side (see the README's "load
// everything, filter in memory" design), so ScrollRevealTile's fade-in is
// a scroll-triggered reveal, not paginated fetching.
function ImageTile({ entry, coverUrl, onOpen }) {
  return (
    <ScrollRevealTile
      className={`image-tile${coverUrl ? "" : " no-image"}`}
      onClick={() => onOpen(entry.id)}
    >
      {coverUrl ? (
        <div className="image-frame">
          <img src={coverUrl} alt="" loading="lazy" />
        </div>
      ) : (
        <div className="no-image-inner">
          <p>{entry.title}</p>
        </div>
      )}
      <p className="tile-title">{entry.title}</p>
      <p className="tile-meta">{entry.descriptors?.year || ""}</p>
    </ScrollRevealTile>
  );
}

function dateOf(d) {
  return d?.toDate ? d.toDate() : new Date(d || Date.now());
}
function yearOf(d) {
  return String(dateOf(d).getFullYear());
}

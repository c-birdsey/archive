export function ListView({ entries, onOpen }) {
  const sorted = [...entries].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  const groups = new Map();

  for (const entry of sorted) {
    const ch = (entry.title || "#").trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : "#";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const keys = [...groups.keys()].sort();

  return (
    <main>
      {keys.map((key) => (
        <div className="letter-group" key={key}>
          <p className="letter-head">{key}</p>
          {groups.get(key).map((entry) => (
            <button
              type="button"
              key={entry.id}
              className="list-row"
              onClick={() => onOpen(entry.id)}
            >
              <span className="row-type">{entry.type || "—"}</span>
              <span className="row-title-cell">
                <span className="row-title">{entry.title}</span>
                {entry.tags && entry.tags.length > 0 && (
                  <span className="row-tags"> — {entry.tags.join(", ")}</span>
                )}
              </span>
              <span className="row-author">{entry.author?.name || "—"}</span>
              <span className="row-year">{yearOf(entry.createdAt)}</span>
            </button>
          ))}
        </div>
      ))}
    </main>
  );
}

export function ImagesView({ entries, onOpen }) {
  const sorted = [...entries].sort((a, b) => dateOf(b.createdAt) - dateOf(a.createdAt));
  return (
    <main className="images-grid">
      {sorted.map((entry) => (
        <button
          type="button"
          key={entry.id}
          className={`image-tile${entry.imageUrl ? "" : " no-image"}`}
          onClick={() => onOpen(entry.id)}
        >
          {entry.imageUrl ? (
            <img src={entry.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="no-image-inner">
              <p>{entry.title}</p>
            </div>
          )}
          <p className="tile-title">{entry.title}</p>
          <p className="tile-meta">
            {entry.type || "—"}, {yearOf(entry.createdAt)}
          </p>
        </button>
      ))}
    </main>
  );
}

function dateOf(d) {
  return d?.toDate ? d.toDate() : new Date(d || Date.now());
}
function yearOf(d) {
  return String(dateOf(d).getFullYear());
}

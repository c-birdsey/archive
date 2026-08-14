import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { entrySearchText, familySearchText } from "../data/filters.js";

export default function SearchOverlay({ open, onClose, entries, families }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const entryHits = entries
      .filter((e) => entrySearchText(e).includes(q))
      .map((e) => ({ kind: "entry", id: e.id, title: e.title }));
    const familyHits = families
      .filter((f) => familySearchText(f).includes(q))
      .map((f) => ({ kind: "family", id: f.id, title: f.name }));
    return [...entryHits, ...familyHits];
  }, [entries, families, query]);

  if (!open) return null;

  function openResult(result) {
    navigate(result.kind === "entry" ? `/entry/${result.id}` : `/family/${result.id}`);
    onClose();
  }

  function handleBackdropClick(e) {
    if (e.target.closest("a, button, input, textarea, select")) return;
    onClose();
  }

  return (
    <div className="overlay" onClick={handleBackdropClick}>
      <div className="overlay-bar">
        <input
          ref={inputRef}
          type="search"
          className="search-overlay-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-protonpass-ignore="true"
          data-form-type="other"
        />
        <button type="button" className="overlay-close" onClick={onClose}>
          Close
        </button>
      </div>

      {query.trim() !== "" && (
        results.length === 0 ? (
          <div className="empty-state">
            <p>No matches for "{query.trim()}".</p>
          </div>
        ) : (
          <div className="search-results">
            {results.map((r) => (
              <button
                type="button"
                key={`${r.kind}-${r.id}`}
                className="list-row search-result-row"
                onClick={() => openResult(r)}
              >
                <span className="row-title-cell">
                  <span className="row-title">{r.title}</span>
                </span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

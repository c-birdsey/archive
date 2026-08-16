import { useEffect } from "react";

export default function InfoOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e) {
    if (e.target.closest("a, button, input, textarea, select")) return;
    onClose();
  }

  return (
    <div className="overlay" onClick={handleBackdropClick}>
      <button type="button" className="overlay-close overlay-close-floating" onClick={onClose}>
        Close
      </button>

      <div className="info-content">
        <p>
          Register is an architectural archive intended as a tool for tracing graphic records of
          ideas and and unconscious references. It is structured with
          minimal hierarchy, instead focusing on connections between and across
          authors and entries.
        </p>
        <p>
          Entries are classified into three primitive types: physical, comprising constructed 
          things (buildings, sculptures, landscapes); representational, comprising descriptive 
          things (drawings, models, renderings); and discursive, comprising analytical things 
          (essays, lectures, publications).
        </p>
        <p>
          Each entry is composed of a set of objective descriptors — empirical
          fields that relate to the source of the entry — and subjective
          qualifiers — intuitive and impressionistic fields that trace
          internal interests and associations. The
          descriptors allow for the ordered parsing of the archive, while the
          qualifiers build relationships across ideas.
          Entries can be directly linked to other entries, or added to
          collections, called families.
        </p>
        <p>Fragments are predecessors to entries; partial ideas and field observations without the complete 
          metadata required for an entry. This data type is effectively reactive and instinctual.
        </p>
        <p>
          Register is organized by Calder Birdsey and Thomas Chen. Published July 2026. 
        </p>
        <p className="info-update">Updated 26_0815</p>
      </div>
    </div>
  );
}

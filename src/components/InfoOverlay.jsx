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
          Register is an architectural archive for tracing a graphic record of
          ideas and and unconscious references. It is structured with
          minimal hierarchy, instead focusing on connections between and across
          authors and entries.
        </p>
        <p>
          Entries are classified into three primitive types: physical, comprising constructed 
          things (buildings, sculptures, landscapes); representational, comprising descriptive 
          things (drawings, models, renderings); and discursive, comprising analytical things 
          (essays, lectures, arguments).
        </p>
        <p>
          Each entry requires a set of objective descriptors — empirical
          fields that relate to the source of the entry — and subjective
          designations — intuitive and impressionistic fields that trace
          internal interests and associations. The
          descriptors allow for the ordered parsing of the archive, while the
          designations build relationships across otherwise unrelated ideas.
          Entries can be directly linked to other entries, or added to
          collections, called families. 
        </p>
        <p>
          Register is organized by Calder Birdsey and Thomas Chen. Published July 2026. 
        </p>
        <p className="info-update">Updated 08/13/2026</p>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function FamiliesOverlay({ open, onClose, families }) {
  const navigate = useNavigate();

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

  function openFamily(id) {
    onClose();
    navigate(`/family/${id}`);
  }

  return (
    <div className="overlay" onClick={handleBackdropClick}>
      <div className="overlay-bar">
        <h1 className="overlay-title">Families</h1>
        <button type="button" className="overlay-close" onClick={onClose}>
          Close
        </button>
      </div>

      {families.length === 0 ? (
        <div className="empty-state">
          <p>No families yet.</p>
        </div>
      ) : (
        <div className="families-list">
          {families.map((f) => (
            <button
              type="button"
              key={f.id}
              className="list-row family-overlay-row"
              onClick={() => openFamily(f.id)}
            >
              <span className="row-title">{f.name}</span>
              <span className="row-description">{f.description}</span>
              <span className="row-posted">
                {f.postedBy?.name || "Unknown"} | {monthYear(f.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function monthYear(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}${yyyy}`;
}

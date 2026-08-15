import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { deleteFlotsam } from "../data/flotsam.js";

export default function FlotsamDetailPage({ flotsam, mobile = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const item = flotsam.find((f) => f.id === id);

  if (!item) {
    return (
      <div className="content-shell">
        <main className="content-col-center">
          <p>This fragment doesn't exist, or has been deleted.</p>
          <Link className="link-btn" to="/flotsam">Back to fragments</Link>
        </main>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirm("Delete this fragment? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteFlotsam(item);
      navigate("/flotsam");
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="flotsam-detail">
      <aside className="flotsam-detail-sidebar">
        <div className="detail-poster-row">
          <span>{fullDate(item.createdAt)}</span>
          <button type="button" className="link-btn" onClick={() => navigate(`/flotsam/${item.id}/edit`)}>
            Edit
          </button>
          <button type="button" className="link-btn" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>

        <p className="detail-heading">{item.title}</p>

        {item.tags && item.tags.length > 0 && (
          <p className="flotsam-detail-tags">{item.tags.join(", ")}</p>
        )}

        {!mobile && (
          <button
            type="button"
            className="flotsam-convert-btn"
            onClick={() => navigate(`/new?fromFlotsam=${item.id}`)}
          >
            Convert to Entry
          </button>
        )}
      </aside>

      <div className="flotsam-detail-image">
        <img src={item.image?.url} alt="" />
      </div>
    </div>
  );
}

function fullDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

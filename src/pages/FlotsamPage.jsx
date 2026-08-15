import { useNavigate } from "react-router-dom";

// Lightweight, uncategorized images -- no descriptors, no filters, just
// a title and tags. Deliberately smaller/denser (4 columns vs. the Index
// page's 3) and inverted (see .page-flotsam in index.css) to read as a
// lower-stakes, secondary space rather than the main archive.
export default function FlotsamPage({ flotsam }) {
  const navigate = useNavigate();

  return (
    <>
      {flotsam.length === 0 ? (
        <div className="empty-state">
          <p>No fragments yet.</p>
          <button className="link-btn" onClick={() => navigate("/flotsam/new")}>
            + New fragment
          </button>
        </div>
      ) : (
        <main className="flotsam-grid">
          {flotsam.map((item) => (
            <button
              type="button"
              key={item.id}
              className="image-tile"
              onClick={() => navigate(`/flotsam/${item.id}`)}
            >
              <div className="image-frame">
                <img src={item.image?.url} alt="" loading="lazy" />
              </div>
              <p className="tile-title">{item.title}</p>
              {item.tags && item.tags.length > 0 && (
                <p className="flotsam-tile-tags">{item.tags.join(", ")}</p>
              )}
            </button>
          ))}
        </main>
      )}
    </>
  );
}

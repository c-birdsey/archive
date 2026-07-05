import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ListView, ImagesView } from "../components/EntryViews.jsx";

export default function TagIndexPage({ entries }) {
  const { tag } = useParams();
  const [view, setView] = useState("images");
  const navigate = useNavigate();

  const decodedTag = decodeURIComponent(tag);

  const visible = useMemo(() => {
    return entries.filter((e) =>
      (e.tags || []).some((t) => t.toLowerCase() === decodedTag.toLowerCase())
    );
  }, [entries, decodedTag]);

  return (
    <>
      <nav className="navrow">
        <div className="nav-group">
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            className={view === "images" ? "active" : ""}
            onClick={() => setView("images")}
          >
            Images
          </button>
        </div>

        <p className="tag-page-heading">Tag: {decodedTag}</p>

        <Link className="link-btn tag-page-back" to="/">Back to index</Link>
      </nav>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>No entries tagged "{decodedTag}".</p>
        </div>
      ) : view === "list" ? (
        <ListView entries={visible} onOpen={(id) => navigate(`/entry/${id}`)} />
      ) : (
        <ImagesView entries={visible} onOpen={(id) => navigate(`/entry/${id}`)} />
      )}
    </>
  );
}

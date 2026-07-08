import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListView, ImagesView } from "../components/EntryViews.jsx";

export default function IndexPage({ entries }) {
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const mediumFilter = searchParams.get("medium") || "all";

  function setMediumFilter(medium) {
    setSearchParams(medium === "all" ? {} : { medium });
  }

  const mediums = useMemo(() => {
    const set = new Set(entries.map((e) => e.descriptors?.medium).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => mediumFilter === "all" || e.descriptors?.medium === mediumFilter)
      .filter((e) => {
        if (!q) return true;
        const hay = [
          e.title, e.notes, e.postedBy?.name,
          ...(e.tags || []), ...Object.values(e.descriptors || {}),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [entries, query, mediumFilter]);

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

        <div className="nav-group">
          {mediums.map((m) => (
            <button
              key={m}
              className={mediumFilter === m ? "active" : ""}
              onClick={() => setMediumFilter(m)}
            >
              {m === "all" ? "All" : m}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </nav>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No entries yet.</p>
          <button className="link-btn" onClick={() => navigate("/new")}>
            + New entry
          </button>
        </div>
      ) : view === "list" ? (
        <ListView entries={visible} onOpen={(id) => navigate(`/entry/${id}`)} />
      ) : (
        <ImagesView entries={visible} onOpen={(id) => navigate(`/entry/${id}`)} />
      )}
    </>
  );
}

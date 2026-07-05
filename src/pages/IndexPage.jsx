import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListView, ImagesView } from "../components/EntryViews.jsx";

export default function IndexPage({ entries }) {
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const typeFilter = searchParams.get("type") || "all";

  function setTypeFilter(type) {
    setSearchParams(type === "all" ? {} : { type });
  }

  const types = useMemo(() => {
    const set = new Set(entries.map((e) => e.type).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => typeFilter === "all" || e.type === typeFilter)
      .filter((e) => {
        if (!q) return true;
        const hay = [e.title, e.notes, e.author?.name, ...(e.tags || [])].join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [entries, query, typeFilter]);

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
          {types.map((t) => (
            <button
              key={t}
              className={typeFilter === t ? "active" : ""}
              onClick={() => setTypeFilter(t)}
            >
              {t === "all" ? "All" : t}
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

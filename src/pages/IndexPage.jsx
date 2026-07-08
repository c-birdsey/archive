import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListView, ImagesView } from "../components/EntryViews.jsx";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";

export default function IndexPage({ entries }) {
  const [view, setView] = useState("images");
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const descriptorFields = useDescriptorFields(true);

  const dParam = searchParams.get("d") || "";
  const sep = dParam.indexOf(":");
  const filterKey = sep > -1 ? dParam.slice(0, sep) : null;
  const filterValue = sep > -1 ? dParam.slice(sep + 1) : null;
  const filterLabel = filterKey
    ? descriptorFields.find((f) => f.key === filterKey)?.label || filterKey
    : null;

  function clearFilter() {
    setSearchParams({});
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !filterKey || (e.descriptors?.[filterKey] || "").toLowerCase() === filterValue.toLowerCase())
      .filter((e) => {
        if (!q) return true;
        const hay = [
          e.title, e.notes, e.postedBy?.name,
          ...(e.tags || []), ...Object.values(e.descriptors || {}),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [entries, query, filterKey, filterValue]);

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

        {filterKey && (
          <p className="filter-indicator">
            Filtered by {filterLabel}: {filterValue}
            {" · "}
            <button type="button" className="link-btn" onClick={clearFilter}>Clear</button>
          </p>
        )}

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

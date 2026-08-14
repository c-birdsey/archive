import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListView, ImagesView } from "../components/EntryViews.jsx";
import CreatableSelect from "../components/CreatableSelect.jsx";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { matchesFilters, filterLabelFor } from "../data/filters.js";

const FILTER_COLUMN_KEYS = ["primative", "author", "year"];

function parseFilterParam(raw) {
  const sep = raw.indexOf(":");
  if (sep === -1) return null;
  return { key: raw.slice(0, sep), value: raw.slice(sep + 1) };
}

export default function IndexPage({ entries }) {
  const [view, setView] = useState("images");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const descriptorFields = useDescriptorFields(true);

  const filters = useMemo(
    () => searchParams.getAll("d").map(parseFilterParam).filter(Boolean),
    [searchParams]
  );

  function isActive(key, value) {
    return filters.some((f) => f.key === key && f.value === value);
  }

  function applyFilters(next) {
    setSearchParams(next.map((f) => ["d", `${f.key}:${f.value}`]));
  }

  function clearFilters() {
    setSearchParams({});
  }

  function removeFilter(key, value) {
    applyFilters(filters.filter((f) => !(f.key === key && f.value === value)));
  }

  function toggleFilterValue(key, value) {
    if (isActive(key, value)) {
      removeFilter(key, value);
    } else {
      applyFilters([...filters, { key, value }]);
    }
  }

  const filterColumns = useMemo(() => {
    return FILTER_COLUMN_KEYS.map((key) => ({
      key,
      label: filterLabelFor(key, descriptorFields),
      values: [...new Set(
        entries.map((e) => e.descriptors?.[key]).filter(Boolean)
      )].sort(),
    }));
  }, [entries, descriptorFields]);

  const tagOptions = useMemo(() => {
    const set = new Set(entries.flatMap((e) => e.tags || []));
    return [...set].sort().map((t) => ({ value: t, label: t }));
  }, [entries]);

  const selectedTags = useMemo(
    () => filters.filter((f) => f.key === "tag").map((f) => f.value),
    [filters]
  );

  function handleTagFilterChange(newTagValues) {
    const others = filters.filter((f) => f.key !== "tag");
    applyFilters([...others, ...newTagValues.map((value) => ({ key: "tag", value }))]);
  }

  const visible = useMemo(() => {
    return entries.filter((e) => matchesFilters(e, filters));
  }, [entries, filters]);

  useEffect(() => {
    if (!filtersOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  function handleFiltersBackdropClick(e) {
    if (e.target.closest("a, button, input, textarea, select")) return;
    setFiltersOpen(false);
  }

  return (
    <>
      <nav className="navrow">
        <button
          type="button"
          className={filtersOpen ? "link-btn active" : "link-btn"}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters {filtersOpen ? "−" : "+"}
        </button>

        {filters.length > 0 && (
          <p className="filter-indicator">
            {filters.map((f, i) => (
              <span key={`${f.key}:${f.value}`}>
                {i > 0 && ", "}
                {filterLabelFor(f.key, descriptorFields)} — {f.value}{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => removeFilter(f.key, f.value)}
                  aria-label={`Remove ${f.value} filter`}
                >
                  ×
                </button>
              </span>
            ))}
            {" · "}
            <button type="button" className="link-btn" onClick={clearFilters}>Clear all</button>
          </p>
        )}

        <div className="nav-group navrow-view-toggle">
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
            Grid
          </button>
        </div>
      </nav>

      {filtersOpen && (
        <div className="overlay filters-overlay" onClick={handleFiltersBackdropClick}>
          <div className="filters-panel">
            {filterColumns.map((col) => (
              <div className="filters-column" key={col.key}>
                <p className="filters-column-label">{col.label}</p>
                {col.values.length === 0 ? (
                  <p className="filters-empty">—</p>
                ) : (
                  col.values.map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={isActive(col.key, value) ? "active" : ""}
                      onClick={() => toggleFilterValue(col.key, value)}
                    >
                      {value}
                    </button>
                  ))
                )}
              </div>
            ))}
            <div className="filters-column">
              <p className="filters-column-label">Tag</p>
              <CreatableSelect
                options={tagOptions}
                selected={selectedTags}
                onChange={handleTagFilterChange}
                multiple
                allowCreate={false}
                placeholder="Search tags…"
              />
            </div>
          </div>
        </div>
      )}

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

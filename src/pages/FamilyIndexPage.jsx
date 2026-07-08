import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LetterGroupedList from "../components/LetterGroupedList.jsx";
import { useFamilies } from "../hooks/useFamilies.js";

export default function FamilyIndexPage() {
  const families = useFamilies(true);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) =>
      [f.name, f.description].join(" ").toLowerCase().includes(q)
    );
  }, [families, query]);

  return (
    <>
      <nav className="navrow">
        <p className="tag-page-heading">Families</p>
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </nav>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>No families yet.</p>
        </div>
      ) : (
        <LetterGroupedList
          items={visible}
          labelOf={(f) => f.name || ""}
          keyOf={(f) => f.id}
          renderItem={(family) => (
            <button
              type="button"
              key={family.id}
              className="list-row family-row"
              onClick={() => navigate(`/family/${family.id}`)}
            >
              <span className="row-title-cell">
                <span className="row-title">{family.name}</span>
                {family.description && (
                  <span className="row-tags"> — {family.description}</span>
                )}
              </span>
            </button>
          )}
        />
      )}
    </>
  );
}

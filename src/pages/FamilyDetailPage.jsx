import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ImagesView } from "../components/EntryViews.jsx";
import { useFamilies } from "../hooks/useFamilies.js";
import { deleteFamily } from "../data/families.js";

export default function FamilyDetailPage({ entries, onFamiliesClick }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const families = useFamilies(true);
  const [deleting, setDeleting] = useState(false);

  const family = useMemo(() => families.find((f) => f.id === id), [families, id]);
  const members = useMemo(() => {
    if (!family) return [];
    return entries.filter((e) => (family.entryIds || []).includes(e.id));
  }, [family, entries]);

  if (!family) {
    return (
      <main className="entry-detail">
        <p>This family doesn't exist, or has been deleted.</p>
        <button type="button" className="link-btn" onClick={onFamiliesClick}>Back to families</button>
      </main>
    );
  }

  async function handleDelete() {
    if (!confirm("Delete this family? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteFamily(family.id);
      navigate("/index");
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="family-detail-header">
        <div className="detail-poster-row">
          <span>{fullDate(family.createdAt)}</span>
          <button type="button" className="link-btn" onClick={() => navigate(`/family/${family.id}/edit`)}>
            Edit
          </button>
          <button type="button" className="link-btn" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        <p className="detail-heading">
          {family.name}
          {family.description && <span className="detail-heading-desc"> | {family.description}</span>}
        </p>
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <p>No entries in this family yet.</p>
        </div>
      ) : (
        <ImagesView entries={members} onOpen={(entryId) => navigate(`/entry/${entryId}`)} />
      )}
    </>
  );
}

function fullDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ImagesView } from "../components/EntryViews.jsx";
import { useFamilies } from "../hooks/useFamilies.js";

export default function FamilyDetailPage({ entries }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const families = useFamilies(true);

  const family = useMemo(() => families.find((f) => f.id === id), [families, id]);
  const members = useMemo(() => {
    if (!family) return [];
    return entries.filter((e) => (family.entryIds || []).includes(e.id));
  }, [family, entries]);

  if (!family) {
    return (
      <main className="entry-detail">
        <p>This family doesn't exist, or has been deleted.</p>
        <Link className="link-btn" to="/families">Back to families</Link>
      </main>
    );
  }

  return (
    <>
      <nav className="navrow">
        <p className="tag-page-heading">Family</p>
        <Link className="link-btn tag-page-back" to="/families">Back to families</Link>
      </nav>

      <main className="family-detail">
        <h1 className="entry-detail-title">{family.name}</h1>
        {family.description && <p className="family-detail-description">{family.description}</p>}
      </main>

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

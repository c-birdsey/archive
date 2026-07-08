import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { deleteEntry, getRelatedEntries, updateTags } from "../data/entries.js";
import { getFamiliesForEntry, removeEntryFromFamily } from "../data/families.js";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { useFamilies } from "../hooks/useFamilies.js";
import CreatableSelect from "../components/CreatableSelect.jsx";

export default function EntryDetailPage({ entries }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const descriptorFields = useDescriptorFields(true);
  const families = useFamilies(true);

  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);
  const relatedEntries = useMemo(() => getRelatedEntries(id, entries), [id, entries]);
  const entryFamilies = useMemo(() => getFamiliesForEntry(id, families), [id, families]);

  const tagOptions = useMemo(() => {
    const set = new Set(entries.flatMap((e) => e.tags || []));
    return [...set].sort().map((t) => ({ value: t, label: t }));
  }, [entries]);

  const descriptorLabel = (key) => descriptorFields.find((f) => f.key === key)?.label || key;
  const descriptorEntries = Object.entries(entry?.descriptors || {});

  if (!entry) {
    return (
      <main className="entry-detail">
        <p>This entry doesn't exist, or has been deleted.</p>
        <Link className="link-btn" to="/">Back to index</Link>
      </main>
    );
  }

  async function handleDelete() {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteEntry(entry);
      for (const family of entryFamilies) {
        await removeEntryFromFamily(family.id, entry.id);
      }
      navigate("/");
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  }

  function handleTagsChange(newTags) {
    updateTags(entry.id, newTags).catch((err) => alert(`Couldn't update tags: ${err.message}`));
  }

  return (
    <main className="entry-detail">
      <div className="entry-detail-meta">
        <span>{fullDate(entry.createdAt)}</span>
        <span>{entry.postedBy?.name || "Unknown"}</span>
      </div>

      <div className="entry-detail-primary">
        <div className="entry-detail-main">
          <h1 className="entry-detail-title">{entry.title}</h1>

          {entry.content?.type === "images" &&
            (entry.content.images || []).map((img, i) => (
              <img key={img.path || img.url || i} className="entry-detail-image" src={img.url} alt="" />
            ))}

          {entry.content?.type === "text" && (
            <p className="entry-detail-text">{entry.content.body}</p>
          )}

          {entry.link && (
            <a className="view-url" href={entry.link} target="_blank" rel="noopener noreferrer">
              {entry.link}
            </a>
          )}
        </div>

        <div className="entry-detail-sidebar">
          {descriptorEntries.length > 0 && (
            <dl className="entry-detail-descriptors">
              {descriptorEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{descriptorLabel(key)}</dt>
                  <dd>
                    <Link to={`/?d=${encodeURIComponent(key)}:${encodeURIComponent(value)}`}>{value}</Link>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="entry-detail-tags-editor">
            <CreatableSelect
              options={tagOptions}
              selected={entry.tags || []}
              onChange={handleTagsChange}
              multiple
              allowCreate
              placeholder="Add a tag…"
              renderLabel={(tag) => <Link to={`/tag/${encodeURIComponent(tag)}`}>{tag}</Link>}
            />
          </div>
        </div>
      </div>

      <div className="entry-detail-tertiary">
        {entry.notes && <p className="entry-detail-notes">{entry.notes}</p>}

        {relatedEntries.length > 0 && (
          <div className="entry-detail-related">
            <p className="related-label">Related</p>
            <ul>
              {relatedEntries.map((r) => (
                <li key={r.id}>
                  <Link to={`/entry/${r.id}`}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entryFamilies.length > 0 && (
          <p className="entry-detail-families">
            Family:{" "}
            {entryFamilies.map((f, i) => (
              <span key={f.id}>
                {i > 0 && ", "}
                <Link to={`/family/${f.id}`}>{f.name}</Link>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="view-actions">
        <button className="link-btn" onClick={() => navigate(`/entry/${entry.id}/edit`)}>
          Edit
        </button>
        <button className="link-btn" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <Link className="link-btn" to="/">Back to index</Link>
      </div>
    </main>
  );
}

function fullDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { deleteEntry, getRelatedEntries, updateTags, updateRelated } from "../data/entries.js";
import {
  createFamily, addEntryToFamily, removeEntryFromFamily, getFamiliesForEntry,
} from "../data/families.js";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { useFamilies } from "../hooks/useFamilies.js";
import CreatableSelect from "../components/CreatableSelect.jsx";
import Lightbox from "../components/Lightbox.jsx";

// Only these descriptors are worth filtering the whole archive by from an
// entry's page -- the rest (collaborator, location, status, etc.) stay
// as plain text.
const FILTERABLE_DESCRIPTOR_KEYS = new Set(["primative", "author", "year", "country"]);

export default function EntryDetailPage({ entries, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const descriptorFields = useDescriptorFields(true);
  const families = useFamilies(true);

  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);
  const relatedEntries = useMemo(() => getRelatedEntries(id, entries), [id, entries]);
  const entryFamilies = useMemo(() => getFamiliesForEntry(id, families), [id, families]);

  const tagOptions = useMemo(() => {
    const set = new Set(entries.flatMap((e) => e.tags || []));
    return [...set].sort().map((t) => ({ value: t, label: t }));
  }, [entries]);

  const relatedOptions = useMemo(() => {
    return entries
      .filter((e) => e.id !== id)
      .map((e) => ({ value: e.id, label: e.title }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [entries, id]);

  const familyOptions = useMemo(
    () => families.map((f) => ({ value: f.id, label: f.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [families]
  );

  // Entries that link to this one but aren't in this entry's own
  // relatedIds -- relatedIds is edited directly below, but these
  // reverse/incoming links only exist on the *other* entry, so they're
  // shown read-only here rather than folded into the editable selection.
  const reverseRelated = useMemo(
    () => relatedEntries.filter((r) => !(entry?.relatedIds || []).includes(r.id)),
    [relatedEntries, entry]
  );

  const descriptorLabel = (key) => descriptorFields.find((f) => f.key === key)?.label || key;
  const descriptorEntries = Object.entries(entry?.descriptors || {});
  const images = entry?.content?.type === "images" ? entry.content.images || [] : [];

  if (!entry) {
    return (
      <div className="content-shell">
        <main className="content-col-center">
          <p>This entry doesn't exist, or has been deleted.</p>
          <Link className="link-btn" to="/index">Back to index</Link>
        </main>
      </div>
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
      navigate("/index");
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  }

  function handleTagsChange(newTags) {
    updateTags(entry.id, newTags).catch((err) => alert(`Couldn't update tags: ${err.message}`));
  }

  function handleRelatedChange(newIds) {
    updateRelated(entry.id, newIds).catch((err) => alert(`Couldn't update related entries: ${err.message}`));
  }

  async function handleFamiliesChange(newIds) {
    const currentIds = entryFamilies.map((f) => f.id);
    const toAdd = newIds.filter((v) => !currentIds.includes(v));
    const toRemove = currentIds.filter((fid) => !newIds.includes(fid));
    try {
      for (const fid of toRemove) await removeEntryFromFamily(fid, entry.id);
      for (const value of toAdd) {
        const existingFamily = families.find((f) => f.id === value);
        if (existingFamily) {
          await addEntryToFamily(existingFamily.id, entry.id);
        } else if (value.trim()) {
          await createFamily({ name: value.trim(), description: "", user, entryId: entry.id });
        }
      }
    } catch (err) {
      alert(`Couldn't update families: ${err.message}`);
    }
  }

  return (
    <div className="entry-detail">
      <aside className="entry-detail-sidebar">
        {/* 1. Date / Edit / Delete */}
        <div className="detail-poster-row">
          <span>{fullDate(entry.createdAt)}</span>
          <button type="button" className="link-btn" onClick={() => navigate(`/entry/${entry.id}/edit`)}>
            Edit
          </button>
          <button type="button" className="link-btn" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>

        {/* 2. Name + description */}
        <p className="detail-heading">
          {entry.title}
          {entry.notes && <span className="detail-heading-desc"> | {entry.notes}</span>}
        </p>

        {/* 3. Metadata */}
        {descriptorEntries.length > 0 && (
          <dl className="entry-detail-descriptors">
            {descriptorEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{descriptorLabel(key)}</dt>
                <dd>
                  {key === "source" ? (
                    <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
                  ) : FILTERABLE_DESCRIPTOR_KEYS.has(key) ? (
                    <Link to={`/index?d=${encodeURIComponent(key)}:${encodeURIComponent(value)}`}>{value}</Link>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {entry.link && (
          <a className="view-url" href={entry.link} target="_blank" rel="noopener noreferrer">
            {linkLabel(entry.link)}
          </a>
        )}

        {/* 4. Connections: tags, related entries, families */}
        <div className="entry-detail-inline-field">
          <span>Tags</span>
          <CreatableSelect
            options={tagOptions}
            selected={entry.tags || []}
            onChange={handleTagsChange}
            multiple
            allowCreate
            placeholder="Search or add tags…"
            renderLabel={(tag) => <Link to={`/index?d=tag:${encodeURIComponent(tag)}`}>{tag}</Link>}
          />
        </div>

        <div className="entry-detail-inline-field">
          <span>Related Entries</span>
          <CreatableSelect
            options={relatedOptions}
            selected={entry.relatedIds || []}
            onChange={handleRelatedChange}
            multiple
            allowCreate={false}
            placeholder="Search entries…"
            renderLabel={(id, label) => <Link to={`/entry/${id}`}>{label}</Link>}
          />
          {reverseRelated.length > 0 && (
            <p className="entry-detail-reverse-related">
              Also linked from{" "}
              {reverseRelated.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link to={`/entry/${r.id}`}>{r.title}</Link>
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="entry-detail-inline-field">
          <span>Families</span>
          <CreatableSelect
            options={familyOptions}
            selected={entryFamilies.map((f) => f.id)}
            onChange={handleFamiliesChange}
            multiple
            allowCreate={false}
            placeholder="Search families…"
            renderLabel={(id, label) => <Link to={`/family/${id}`}>{label}</Link>}
          />
        </div>
      </aside>

      <main className="entry-detail-gallery">
        {images.map((img, i) => (
          <button
            type="button"
            key={img.path || img.url || i}
            className="entry-detail-gallery-item"
            onClick={() => setLightboxIndex(i)}
          >
            <img src={img.url} alt="" />
          </button>
        ))}

        {entry.content?.type === "text" && (
          <p className="entry-detail-text">{entry.content.body}</p>
        )}
      </main>

      <Lightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}

function linkLabel(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

function fullDate(d) {
  const date = d?.toDate ? d.toDate() : new Date(d || Date.now());
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";
import CreatableSelect from "../components/CreatableSelect.jsx";
import { createEntry, updateEntry } from "../data/entries.js";
import {
  createFamily, addEntryToFamily, removeEntryFromFamily, getFamiliesForEntry,
} from "../data/families.js";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { useFamilies } from "../hooks/useFamilies.js";

export default function NewEntryPage({ entries, user }) {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const descriptorFields = useDescriptorFields(true);
  const families = useFamilies(true);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState([]);
  const [related, setRelated] = useState([]); // array of entry ids
  const [descriptorValues, setDescriptorValues] = useState({});

  const [contentType, setContentType] = useState("none"); // none | text | images
  const [body, setBody] = useState("");

  // Each item: { key, url (preview or existing download URL), file? (new upload), path? (existing storage path) }
  // Order matters — images[0] is the primary/cover image.
  const [images, setImages] = useState([]);
  const [removedPaths, setRemovedPaths] = useState([]); // existing storage paths to delete on save
  const dragIndex = useRef(null);

  // A single-choice radio in the UI; the data model allows an entry to
  // belong to more than one family, but only the first membership found
  // is surfaced here to prefill editing.
  const [familyChoice, setFamilyChoice] = useState("none"); // none | existing:<id> | new
  const [originalFamilyId, setOriginalFamilyId] = useState(null);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyDesc, setNewFamilyDesc] = useState("");
  const familyPrefilled = useRef(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const snap = await getDoc(doc(db, "entries", id));
      if (!snap.exists()) {
        setError("This entry no longer exists.");
        setLoadingExisting(false);
        return;
      }
      const data = snap.data();
      setTitle(data.title || "");
      setNotes(data.notes || "");
      setLink(data.link || "");
      setTags(data.tags || []);
      setRelated(data.relatedIds || []);
      setDescriptorValues(data.descriptors || {});

      if (data.content?.type === "text") {
        setContentType("text");
        setBody(data.content.body || "");
      } else if (data.content?.type === "images") {
        setContentType("images");
        setImages(
          (data.content.images || []).map((img, i) => ({
            key: img.path || img.url || `existing-${i}`,
            url: img.url,
            path: img.path || null,
          }))
        );
      }
      setLoadingExisting(false);
    })();
  }, [id, isEditing]);

  useEffect(() => {
    if (!isEditing || familyPrefilled.current || families.length === 0) return;
    const owning = getFamiliesForEntry(id, families)[0];
    if (owning) {
      setOriginalFamilyId(owning.id);
      setFamilyChoice(`existing:${owning.id}`);
    }
    familyPrefilled.current = true;
  }, [isEditing, id, families]);

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

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems = files.map((file) => ({
      key: `new-${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((prev) => [...prev, ...newItems]);
    e.target.value = ""; // allow re-selecting the same file again later
  }

  function removeImage(key) {
    setImages((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.path) setRemovedPaths((r) => [...r, target.path]);
      return prev.filter((i) => i.key !== key);
    });
  }

  function handleDragStart(index) {
    dragIndex.current = index;
  }
  function handleDragOver(e) {
    e.preventDefault();
  }
  function handleDrop(index) {
    setImages((prev) => {
      if (dragIndex.current === null || dragIndex.current === index) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(dragIndex.current, 1);
      arr.splice(index, 0, moved);
      return arr;
    });
    dragIndex.current = null;
  }

  async function syncFamily(entryId) {
    if (familyChoice.startsWith("existing:")) {
      const familyId = familyChoice.split(":")[1];
      if (familyId !== originalFamilyId) {
        if (originalFamilyId) await removeEntryFromFamily(originalFamilyId, entryId);
        await addEntryToFamily(familyId, entryId);
      }
    } else if (familyChoice === "new" && newFamilyName.trim()) {
      if (originalFamilyId) await removeEntryFromFamily(originalFamilyId, entryId);
      await createFamily({ name: newFamilyName, description: newFamilyDesc, user, entryId });
    } else if (familyChoice === "none" && originalFamilyId) {
      await removeEntryFromFamily(originalFamilyId, entryId);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let content = null;
      if (contentType === "text") {
        content = { type: "text", body };
      } else if (contentType === "images") {
        const uploadedImages = [];
        for (const img of images) {
          if (img.file) {
            const path = `entries/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${img.file.name}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, img.file);
            const url = await getDownloadURL(storageRef);
            uploadedImages.push({ url, path });
          } else {
            uploadedImages.push({ url: img.url, path: img.path || null });
          }
        }
        content = { type: "images", images: uploadedImages };
      }
      for (const path of removedPaths) {
        try { await deleteObject(ref(storage, path)); }
        catch (err) { console.warn("Couldn't delete removed image:", err.message); }
      }

      const payload = {
        title, notes, link, content, descriptors: descriptorValues, tags, relatedIds: related,
      };

      let entryId = id;
      if (isEditing) {
        await updateEntry(id, payload);
      } else {
        const docRef = await createEntry({ ...payload, user });
        entryId = docRef.id;
      }

      await syncFamily(entryId);

      navigate(`/entry/${entryId}`);
    } catch (err) {
      setError(`Save failed: ${err.message}`);
      setSaving(false);
    }
  }

  if (loadingExisting) return <main className="form-page"><p>Loading…</p></main>;

  return (
    <main className="form-page">
      <h1 className="page-title">{isEditing ? "Edit entry" : "New entry"}</h1>

      <form onSubmit={handleSubmit} className="entry-form">
        <label className="field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>

        {descriptorFields.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            <input
              type="text"
              value={descriptorValues[f.key] || ""}
              onChange={(e) => setDescriptorValues((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}

        <div className="field">
          <span>Tags</span>
          <CreatableSelect
            options={tagOptions}
            selected={tags}
            onChange={setTags}
            multiple
            allowCreate
            placeholder="Search or add tags…"
          />
        </div>

        <div className="field">
          <span>Content</span>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
            <option value="none">None</option>
            <option value="text">Text</option>
            <option value="images">Image(s)</option>
          </select>
        </div>

        {contentType === "text" && (
          <label className="field">
            <span>Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
            />
          </label>
        )}

        {contentType === "images" && (
          <div className="field">
            {images.length > 0 && (
              <div className="image-manager">
                {images.map((img, i) => (
                  <div
                    key={img.key}
                    className={`image-item${i === 0 ? " primary" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(i)}
                  >
                    <img src={img.url} alt="" />
                    {i === 0 && <span className="primary-tag">Primary</span>}
                    <button
                      type="button"
                      className="image-remove"
                      onClick={() => removeImage(img.key)}
                      aria-label="Remove image"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" accept="image/*" multiple onChange={handleFilesChange} />
            {images.length > 1 && (
              <p className="field-hint">Drag to reorder — the first image is the cover.</p>
            )}
          </div>
        )}

        <label className="field">
          <span>Link</span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            maxLength={8000}
          />
        </label>

        <div className="field">
          <span>Related entries</span>
          <CreatableSelect
            options={relatedOptions}
            selected={related}
            onChange={setRelated}
            multiple
            allowCreate={false}
            placeholder="Search entries by title…"
          />
        </div>

        <fieldset className="field family-field">
          <legend>Family</legend>
          <label className="radio-row">
            <input type="radio" checked={familyChoice === "none"} onChange={() => setFamilyChoice("none")} /> None
          </label>
          {families.map((f) => (
            <label className="radio-row" key={f.id}>
              <input
                type="radio"
                checked={familyChoice === `existing:${f.id}`}
                onChange={() => setFamilyChoice(`existing:${f.id}`)}
              /> {f.name}
            </label>
          ))}
          <label className="radio-row">
            <input type="radio" checked={familyChoice === "new"} onChange={() => setFamilyChoice("new")} /> New family
          </label>
          {familyChoice === "new" && (
            <div className="family-new-fields">
              <input
                placeholder="Name"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
              />
              <input
                placeholder="Description"
                value={newFamilyDesc}
                onChange={(e) => setNewFamilyDesc(e.target.value)}
              />
            </div>
          )}
        </fieldset>

        {error && <p className="auth-error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="link-btn" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="solid-btn" disabled={saving}>
            {saving ? "Saving…" : "Commit to archive"}
          </button>
        </div>
      </form>
    </main>
  );
}

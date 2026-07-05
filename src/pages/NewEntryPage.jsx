import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoc, collection, doc, getDoc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";
import CreatableSelect from "../components/CreatableSelect.jsx";

export default function NewEntryPage({ entries, user }) {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [type, setType] = useState([]); // single-value array, reuses CreatableSelect
  const [tags, setTags] = useState([]);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [related, setRelated] = useState([]); // array of entry ids

  // Each item: { key, url (preview or existing download URL), file? (new upload), path? (existing storage path) }
  // Order matters — images[0] is the primary/cover image.
  const [images, setImages] = useState([]);
  const [removedPaths, setRemovedPaths] = useState([]); // existing storage paths to delete on save
  const dragIndex = useRef(null);

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
      setType(data.type ? [data.type] : []);
      setTags(data.tags || []);
      setLink(data.link || "");
      setNotes(data.notes || "");
      setRelated(data.relatedIds || []);

      if (Array.isArray(data.images) && data.images.length > 0) {
        setImages(
          data.images.map((img, i) => ({
            key: img.path || img.url || `existing-${i}`,
            url: img.url,
            path: img.path || null,
          }))
        );
      } else if (data.imageUrl) {
        // Legacy entries saved before multi-image support
        setImages([
          { key: data.imageStoragePath || data.imageUrl, url: data.imageUrl, path: data.imageStoragePath || null },
        ]);
      }
      setLoadingExisting(false);
    })();
  }, [id, isEditing]);

  const typeOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.type).filter(Boolean));
    return [...set].sort().map((t) => ({ value: t, label: t }));
  }, [entries]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      // Upload any new files, in the current order, then delete removed ones.
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
      for (const path of removedPaths) {
        try { await deleteObject(ref(storage, path)); }
        catch (err) { console.warn("Couldn't delete removed image:", err.message); }
      }

      const payload = {
        title: title.trim(),
        type: type[0] || "",
        tags,
        link: link.trim(),
        notes: notes.trim(),
        relatedIds: related,
        images: uploadedImages,
        // Mirrored for backward compatibility with anything still reading
        // the old single-image fields (e.g. entries created before this).
        imageUrl: uploadedImages[0]?.url || null,
        imageStoragePath: uploadedImages[0]?.path || null,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, "entries", id), payload);
        navigate(`/entry/${id}`);
      } else {
        const docRef = await addDoc(collection(db, "entries"), {
          ...payload,
          author: {
            uid: user.uid,
            name: user.displayName || user.email,
            email: user.email,
          },
          createdAt: serverTimestamp(),
        });
        navigate(`/entry/${docRef.id}`);
      }
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

        <label className="field">
          <span>Type</span>
          <CreatableSelect
            options={typeOptions}
            selected={type}
            onChange={setType}
            multiple={false}
            allowCreate
            placeholder="Search or add a type…"
          />
        </label>

        <label className="field">
          <span>Tags</span>
          <CreatableSelect
            options={tagOptions}
            selected={tags}
            onChange={setTags}
            multiple
            allowCreate
            placeholder="Search or add tags…"
          />
        </label>

        <div className="field">
          <span>Images</span>
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

        <label className="field">
          <span>Related entries</span>
          <CreatableSelect
            options={relatedOptions}
            selected={related}
            onChange={setRelated}
            multiple
            allowCreate={false}
            placeholder="Search entries by title…"
          />
        </label>

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

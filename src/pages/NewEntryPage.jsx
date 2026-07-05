import { useEffect, useMemo, useState } from "react";
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [existingImagePath, setExistingImagePath] = useState(null);
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
      setExistingImageUrl(data.imageUrl || null);
      setExistingImagePath(data.imageStoragePath || null);
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

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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
      let imageUrl = existingImageUrl;
      let imageStoragePath = existingImagePath;

      if (imageFile) {
        const path = `entries/${user.uid}/${Date.now()}-${imageFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
        imageStoragePath = path;

        if (existingImagePath) {
          try { await deleteObject(ref(storage, existingImagePath)); }
          catch (e) { console.warn("Couldn't delete replaced image:", e.message); }
        }
      }

      const payload = {
        title: title.trim(),
        type: type[0] || "",
        tags,
        link: link.trim(),
        notes: notes.trim(),
        relatedIds: related,
        imageUrl: imageUrl || null,
        imageStoragePath: imageStoragePath || null,
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

        <label className="field">
          <span>Image</span>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {(imagePreview || existingImageUrl) && (
            <img className="field-image-preview" src={imagePreview || existingImageUrl} alt="" />
          )}
        </label>

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

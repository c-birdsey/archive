import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";
import CreatableSelect from "../components/CreatableSelect.jsx";
import { assetName } from "../data/entries.js";
import { createFlotsam, updateFlotsam } from "../data/flotsam.js";
import { useGuardedClose } from "../hooks/useGuardedClose.js";

// Hints for LastPass/1Password/Bitwarden/Dashlane/Proton Pass to leave
// this field alone -- it isn't a login, but password managers often
// misidentify plain text inputs and clutter them with icons.
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-protonpass-ignore": "true",
  "data-form-type": "other",
};

// The lightweight counterpart to NewEntryPage -- title, tags, and a
// single image, no descriptors or other metadata.
export default function NewFlotsamPage({ entries, flotsam, user, mobile = false }) {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState([]);
  // { key, url, file? (new upload), path? (existing storage path) } or null
  const [image, setImage] = useState(null);
  const [removedPath, setRemovedPath] = useState(null);
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const snap = await getDoc(doc(db, "flotsam", id));
      if (!snap.exists()) {
        setError("This fragment no longer exists.");
        setLoadingExisting(false);
        return;
      }
      const data = snap.data();
      setTitle(data.title || "");
      setTags(data.tags || []);
      if (data.image) {
        setImage({ key: data.image.path || data.image.url, url: data.image.url, path: data.image.path || null });
      }
      setLoadingExisting(false);
    })();
  }, [id, isEditing]);

  const initialSnapshotRef = useRef(null);
  function buildSnapshot() {
    return JSON.stringify({ title, tags: [...tags].sort(), imageKey: image?.key || null });
  }
  if (initialSnapshotRef.current === null && !loadingExisting) {
    initialSnapshotRef.current = buildSnapshot();
  }
  // On mobile, Cancel just closes -- no double-check, unlike the desktop
  // form (and unlike Entry/Family, which aren't reachable on mobile).
  const hasChanges = !mobile && initialSnapshotRef.current !== null && buildSnapshot() !== initialSnapshotRef.current;
  const { confirming, attemptClose, resetConfirming } = useGuardedClose(hasChanges);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attemptClose]);

  const tagOptions = useMemo(() => {
    const set = new Set([
      ...entries.flatMap((e) => e.tags || []),
      ...flotsam.flatMap((f) => f.tags || []),
    ]);
    return [...set].sort().map((t) => ({ value: t, label: t }));
  }, [entries, flotsam]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (image?.path) setRemovedPath(image.path);
    setImage({
      key: `new-${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      file,
    });
    e.target.value = ""; // allow re-selecting the same file again later
  }

  function removeImage() {
    if (image?.path) setRemovedPath(image.path);
    setImage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!image) {
      setError("An image is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let imagePayload;
      if (image.file) {
        const path = `flotsam/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${image.file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, image.file);
        const url = await getDownloadURL(storageRef);
        imagePayload = { url, path };
      } else {
        imagePayload = { url: image.url, path: image.path || null };
      }
      if (removedPath) {
        try { await deleteObject(ref(storage, removedPath)); }
        catch (err) { console.warn("Couldn't delete removed image:", err.message); }
      }

      let flotsamId = id;
      if (isEditing) {
        await updateFlotsam(id, { title, tags, image: imagePayload });
      } else {
        const docRef = await createFlotsam({ title, tags, image: imagePayload });
        flotsamId = docRef.id;
      }

      navigate(`/flotsam/${flotsamId}`);
    } catch (err) {
      setError(`Save failed: ${err.message}`);
      setSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="overlay">
        <div className="overlay-bar">
          <h1 className="overlay-title">{isEditing ? "Edit Fragment" : "New Fragment"}</h1>
          <button type="button" className="overlay-close" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="overlay">
      <form onSubmit={handleSubmit} className="entry-form">
        <div className="overlay-bar">
          <h1 className="overlay-title">{isEditing ? "Edit Fragment" : "New Fragment"}</h1>
          <button
            type="submit"
            className="overlay-submit overlay-submit-top"
            disabled={saving || !title.trim() || !image}
          >
            {saving ? "Saving…" : "Submit"}
          </button>
          <button type="button" className="overlay-close" onClick={attemptClose} onBlur={resetConfirming}>
            {confirming ? "Edits will be lost. Continue?" : "Cancel"}
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <label className="field entry-form-full">
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={200}
            {...NO_AUTOFILL}
          />
        </label>

        <div className="field entry-form-full">
          <span>Tags</span>
          <CreatableSelect
            options={tagOptions}
            selected={tags}
            onChange={setTags}
            multiple
            allowCreate
            placeholder="Add more"
          />
        </div>

        <div className="field entry-form-full">
          <div className="field-label-row">
            <span className="asset-upload-label" onClick={() => fileInputRef.current?.click()}>
              {image ? "Replace Image" : "Upload Image"}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            hidden
          />
          {image ? (
            <div className="creatable-chips">
              <span className="chip">
                {assetName(image)}
                <button type="button" onClick={removeImage} aria-label="Remove image">
                  &times;
                </button>
              </span>
            </div>
          ) : (
            <p className="asset-empty">No image linked</p>
          )}
        </div>

        <button
          type="submit"
          className="overlay-submit overlay-submit-bottom"
          disabled={saving || !title.trim() || !image}
        >
          {saving ? "Saving…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

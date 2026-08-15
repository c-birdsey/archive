import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import CreatableSelect from "../components/CreatableSelect.jsx";
import { createFamily, updateFamily } from "../data/families.js";
import { useGuardedClose } from "../hooks/useGuardedClose.js";

// Hints for LastPass/1Password/Bitwarden/Dashlane/Proton Pass to leave
// these fields alone -- none of them are logins, but password managers
// often misidentify plain text inputs and clutter them with icons.
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-protonpass-ignore": "true",
  "data-form-type": "other",
};

export default function NewFamilyPage({ entries, user }) {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryIds, setEntryIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  const initialSnapshotRef = useRef(null);
  function buildSnapshot() {
    return JSON.stringify({ name, description, entryIds: [...entryIds].sort() });
  }
  if (initialSnapshotRef.current === null && !loadingExisting) {
    initialSnapshotRef.current = buildSnapshot();
  }
  const hasChanges = initialSnapshotRef.current !== null && buildSnapshot() !== initialSnapshotRef.current;
  const { confirming, attemptClose, resetConfirming } = useGuardedClose(hasChanges);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const snap = await getDoc(doc(db, "families", id));
      if (!snap.exists()) {
        setError("This family no longer exists.");
        setLoadingExisting(false);
        return;
      }
      const data = snap.data();
      setName(data.name || "");
      setDescription(data.description || "");
      setEntryIds(data.entryIds || []);
      setLoadingExisting(false);
    })();
  }, [id, isEditing]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attemptClose]);

  const entryOptions = useMemo(
    () => entries.map((e) => ({ value: e.id, label: e.title })).sort((a, b) => a.label.localeCompare(b.label)),
    [entries]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEditing) {
        await updateFamily(id, { name, description, entryIds });
        navigate(`/family/${id}`);
      } else {
        const docRef = await createFamily({ name, description, user, entryIds });
        navigate(`/family/${docRef.id}`);
      }
    } catch (err) {
      setError(`Save failed: ${err.message}`);
      setSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="overlay">
        <div className="overlay-bar">
          <h1 className="overlay-title">Edit Family</h1>
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
          <h1 className="overlay-title">{isEditing ? "Edit Family" : "New Family"}</h1>
          <button type="submit" className="overlay-submit" disabled={saving || !name.trim() || !description.trim()}>
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Title"
            maxLength={200}
            {...NO_AUTOFILL}
          />
        </label>

        <label className="field entry-form-full">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description…"
            rows={4}
            maxLength={2000}
            {...NO_AUTOFILL}
          />
        </label>

        <div className="field entry-form-full">
          <span>Entries</span>
          <CreatableSelect
            options={entryOptions}
            selected={entryIds}
            onChange={setEntryIds}
            multiple
            allowCreate={false}
            placeholder="Search entries by title…"
          />
        </div>
      </form>
    </div>
  );
}

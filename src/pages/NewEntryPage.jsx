import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";
import CreatableSelect from "../components/CreatableSelect.jsx";
import { createEntry, updateEntry, assetName, isPdf } from "../data/entries.js";
import {
  createFamily, addEntryToFamily, removeEntryFromFamily, getFamiliesForEntry,
} from "../data/families.js";
import { deleteFlotsamRecord } from "../data/flotsam.js";
import { renderPdfFirstPage } from "../data/pdfThumbnail.js";
import { useDescriptorFields } from "../hooks/useDescriptorFields.js";
import { useFamilies } from "../hooks/useFamilies.js";
import { useGuardedClose } from "../hooks/useGuardedClose.js";

// Fixed-option fields render as a plain clickable list (like the Filters
// panel) instead of a free-text input.
const CHOICE_OPTIONS = {
  primative: ["Physical", "Representational", "Discursive"],
  medium: ["Drawing", "Model", "Painting", "Photograph", "Sculpture"],
  status: ["Built", "Unbuilt", "Demolished", "In Progress"],
};

// Medium is the one choice field where a Representational entry can be
// more than one thing at once (e.g. a Drawing that's also a Photograph) --
// every other choice field stays single-select. Stored as a string array
// on descriptors.medium, the one exception to descriptors otherwise being
// key -> string (see cleanDescriptors in data/entries.js).
const MULTI_CHOICE_KEYS = new Set(["medium"]);

const FIELD_PLACEHOLDERS = {
  author: "Name",
  year: "YYYY",
  project: "Project",
  collaborator: "Name(s)",
  source: "URL",
  location: "Municipality, Country",
};

// Hints for LastPass/1Password/Bitwarden/Dashlane/Proton Pass to leave
// these fields alone -- none of them are logins, but password managers
// often misidentify plain text/URL inputs and clutter them with icons.
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-protonpass-ignore": "true",
  "data-form-type": "other",
};

// Only the fields relevant to the selected primative show, in order:
// Author/Year always lead, then the primative-specific field (Medium for
// Representational, Location for Physical, Source for Discursive), then
// Project, then Status (Physical only), then Collaborator. Source only
// appears for Discursive entries, where it's the primative-specific field
// above -- Physical/Representational entries don't get a Source field at
// all.
function buildFieldRow(primative, descriptorFields) {
  const byKey = Object.fromEntries(descriptorFields.map((f) => [f.key, f]));
  const used = new Set(["primative"]);
  const row = [];

  function add(key) {
    const f = byKey[key];
    if (f && !used.has(key)) {
      row.push(f);
      used.add(key);
    }
  }

  add("author");
  add("year");
  if (primative === "Representational") add("medium");
  else if (primative === "Physical") add("location");
  else if (primative === "Discursive") add("source");
  add("project");
  if (primative === "Physical") add("status");
  add("collaborator");

  return row;
}

// Author/Project get the same live search-and-create dropdown as Tags
// (CreatableSelect), prepopulated with values already used across other
// entries, instead of a plain text input.
const AUTOCOMPLETE_KEYS = new Set(["author", "project"]);

export default function NewEntryPage({ entries, user, onInfoClick, infoOpen }) {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [searchParams] = useSearchParams();
  const fromFlotsamId = isEditing ? null : searchParams.get("fromFlotsam");

  const descriptorFields = useDescriptorFields(true);
  const families = useFamilies(true);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState([]);
  const [related, setRelated] = useState([]); // array of entry ids
  const [descriptorValues, setDescriptorValues] = useState({});

  // Entries created before this rebuild may carry text-only content; the
  // form no longer offers creating/editing that, but preserves it
  // untouched on save unless images are added (which replaces it).
  const [preservedTextContent, setPreservedTextContent] = useState(null);

  // Each item: { key, url (preview or existing download URL), file? (new upload), path? (existing storage path) }
  // Order matters — images[0] is the primary/cover image.
  const [images, setImages] = useState([]);
  const [removedPaths, setRemovedPaths] = useState([]); // existing storage paths to delete on save
  const fileInputRef = useRef(null);

  // A multi-select search field, matching the data model: an entry can
  // belong to any number of families. Each value is either an existing
  // family's id or a freshly-typed name (created on submit).
  const [familyIds, setFamilyIds] = useState([]);
  const [originalFamilyIds, setOriginalFamilyIds] = useState([]);
  const familyPrefilled = useRef(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  // Set when arriving via a flotsam item's "Convert to Entry" link --
  // its title/tags/image prefill the form once a primative type is
  // picked (see the effect below), and its record gets deleted once the
  // resulting entry is actually saved.
  const [sourceFlotsam, setSourceFlotsam] = useState(null);
  const flotsamApplied = useRef(false);

  useEffect(() => {
    if (!fromFlotsamId) return;
    (async () => {
      const snap = await getDoc(doc(db, "flotsam", fromFlotsamId));
      if (snap.exists()) setSourceFlotsam({ id: snap.id, ...snap.data() });
    })();
  }, [fromFlotsamId]);

  const initialSnapshotRef = useRef(null);
  function buildSnapshot() {
    return JSON.stringify({
      title, notes, link,
      tags: [...tags].sort(),
      related: [...related].sort(),
      descriptorValues,
      familyIds: [...familyIds].sort(),
      imageKeys: images.map((img) => img.key),
    });
  }
  if (initialSnapshotRef.current === null && !loadingExisting) {
    initialSnapshotRef.current = buildSnapshot();
  }
  const hasChanges = initialSnapshotRef.current !== null && buildSnapshot() !== initialSnapshotRef.current;
  const { confirming, attemptClose, resetConfirming } = useGuardedClose(hasChanges);

  // If the Info popup is open on top of this form, let its own Escape
  // handler close that first rather than also navigating away here.
  useEffect(() => {
    if (infoOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [infoOpen, attemptClose]);

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
      const descriptors = { ...(data.descriptors || {}) };
      // Older entries stored a single medium string -- wrap it so the
      // multi-select choice list above reads it correctly.
      if (descriptors.medium && !Array.isArray(descriptors.medium)) {
        descriptors.medium = [descriptors.medium];
      }
      setDescriptorValues(descriptors);

      if (data.content?.type === "text") {
        setPreservedTextContent(data.content);
      } else if (data.content?.type === "images") {
        setImages(
          (data.content.images || []).map((img, i) => ({
            key: img.path || img.url || `existing-${i}`,
            url: img.url,
            path: img.path || null,
            thumbUrl: img.thumbUrl || null,
            thumbPath: img.thumbPath || null,
          }))
        );
      }
      setLoadingExisting(false);
    })();
  }, [id, isEditing]);

  useEffect(() => {
    if (!isEditing || familyPrefilled.current || families.length === 0) return;
    const owning = getFamiliesForEntry(id, families).map((f) => f.id);
    if (owning.length > 0) {
      setOriginalFamilyIds(owning);
      setFamilyIds(owning);
    }
    familyPrefilled.current = true;
  }, [isEditing, id, families]);

  // The flotsam item's title/tags/image only apply once a primative type
  // is picked -- that's the point at which the rest of the form appears,
  // so this waits for it rather than prefilling into a hidden form.
  useEffect(() => {
    if (!sourceFlotsam || flotsamApplied.current || !descriptorValues.primative) return;
    flotsamApplied.current = true;
    setTitle(sourceFlotsam.title || "");
    setTags(sourceFlotsam.tags || []);
    if (sourceFlotsam.image?.url) {
      setImages([{
        key: sourceFlotsam.image.path || sourceFlotsam.image.url,
        url: sourceFlotsam.image.url,
        path: sourceFlotsam.image.path || null,
      }]);
    }
  }, [sourceFlotsam, descriptorValues.primative]);

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

  const primativeField = descriptorFields.find((f) => f.key === "primative");
  const fieldRow = useMemo(
    () => buildFieldRow(descriptorValues.primative, descriptorFields),
    [descriptorValues.primative, descriptorFields]
  );

  const descriptorOptions = useMemo(() => {
    const map = {};
    for (const key of AUTOCOMPLETE_KEYS) {
      const set = new Set(entries.map((e) => e.descriptors?.[key]).filter(Boolean));
      map[key] = [...set].sort().map((v) => ({ value: v, label: v }));
    }
    return map;
  }, [entries]);

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
      const removed = [target?.path, target?.thumbPath].filter(Boolean);
      if (removed.length > 0) setRemovedPaths((r) => [...r, ...removed]);
      return prev.filter((i) => i.key !== key);
    });
  }

  function clearAllImages() {
    setImages((prev) => {
      const paths = prev.flatMap((i) => [i.path, i.thumbPath]).filter(Boolean);
      if (paths.length > 0) setRemovedPaths((r) => [...r, ...paths]);
      return [];
    });
  }

  async function syncFamily(entryId) {
    const removed = originalFamilyIds.filter((fid) => !familyIds.includes(fid));
    for (const fid of removed) {
      await removeEntryFromFamily(fid, entryId);
    }
    for (const value of familyIds) {
      if (originalFamilyIds.includes(value)) continue; // unchanged membership
      const existingFamily = families.find((f) => f.id === value);
      if (existingFamily) {
        await addEntryToFamily(existingFamily.id, entryId);
      } else if (value.trim()) {
        await createFamily({ name: value.trim(), description: "", user, entryId });
      }
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
      if (images.length > 0) {
        const uploadedImages = [];
        for (const img of images) {
          if (img.file) {
            const path = `entries/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${img.file.name}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, img.file);
            const url = await getDownloadURL(storageRef);
            const uploaded = { url, path };
            if (isPdf(img)) {
              const thumbBlob = await renderPdfFirstPage(img.file);
              const thumbPath = `${path}-thumb.jpg`;
              const thumbRef = ref(storage, thumbPath);
              await uploadBytes(thumbRef, thumbBlob);
              uploaded.thumbUrl = await getDownloadURL(thumbRef);
              uploaded.thumbPath = thumbPath;
            }
            uploadedImages.push(uploaded);
          } else {
            const uploaded = { url: img.url, path: img.path || null };
            if (img.thumbUrl) {
              uploaded.thumbUrl = img.thumbUrl;
              uploaded.thumbPath = img.thumbPath || null;
            }
            uploadedImages.push(uploaded);
          }
        }
        content = { type: "images", images: uploadedImages };
      } else if (preservedTextContent) {
        content = preservedTextContent;
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

      // The image is now owned by the entry doc above (same Storage
      // path), so only the flotsam record itself is removed here.
      if (sourceFlotsam) {
        try { await deleteFlotsamRecord(sourceFlotsam.id); }
        catch (err) { console.warn("Couldn't remove converted flotsam item:", err.message); }
      }

      navigate(`/entry/${entryId}`);
    } catch (err) {
      setError(`Save failed: ${err.message}`);
      setSaving(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="overlay">
        <div className="overlay-bar">
          <h1 className="overlay-title">{isEditing ? "Edit Entry" : "New Entry"}</h1>
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
          <h1 className="overlay-title">{isEditing ? "Edit Entry" : "New Entry"}</h1>
          {descriptorValues.primative && (
            <button type="submit" className="overlay-submit" disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Submit"}
            </button>
          )}
          <button type="button" className="overlay-close" onClick={attemptClose} onBlur={resetConfirming}>
            {confirming ? "Edits will be lost. Continue?" : "Cancel"}
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {primativeField && (
          <div className="field entry-form-full field-primative">
            <div className="field-label-row">
              <span>Primative Type</span>
              <button
                type="button"
                className="info-icon-btn"
                onClick={onInfoClick}
                aria-label="What is Primative Type?"
              >
                i
              </button>
            </div>
            <div className="choice-list">
              {CHOICE_OPTIONS.primative.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={descriptorValues.primative === option ? "active" : ""}
                  onClick={() => setDescriptorValues((d) => ({ ...d, primative: option }))}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {descriptorValues.primative && (
          <>
            <div className="entry-form-row">
              <label className="field">
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

              {fieldRow.map((f) =>
                CHOICE_OPTIONS[f.key] ? (
                  <div className="field" key={f.key}>
                    <span>{f.label}</span>
                    <div className="choice-list">
                      {CHOICE_OPTIONS[f.key].map((option) => {
                        const isMulti = MULTI_CHOICE_KEYS.has(f.key);
                        const current = descriptorValues[f.key];
                        const active = isMulti
                          ? Array.isArray(current) && current.includes(option)
                          : current === option;
                        return (
                          <button
                            type="button"
                            key={option}
                            className={active ? "active" : ""}
                            onClick={() => setDescriptorValues((d) => {
                              if (!isMulti) return { ...d, [f.key]: option };
                              const arr = Array.isArray(d[f.key]) ? d[f.key] : [];
                              const next = arr.includes(option)
                                ? arr.filter((o) => o !== option)
                                : [...arr, option];
                              return { ...d, [f.key]: next };
                            })}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : AUTOCOMPLETE_KEYS.has(f.key) ? (
                  <div className="field" key={f.key}>
                    <span>{f.label}</span>
                    <CreatableSelect
                      options={descriptorOptions[f.key] || []}
                      selected={descriptorValues[f.key] ? [descriptorValues[f.key]] : []}
                      onChange={(vals) => setDescriptorValues((d) => ({ ...d, [f.key]: vals[0] || "" }))}
                      allowCreate
                      placeholder={FIELD_PLACEHOLDERS[f.key] || f.label}
                    />
                  </div>
                ) : (
                  <label className="field" key={f.key}>
                    <span>{f.label}</span>
                    <input
                      type="text"
                      value={descriptorValues[f.key] || ""}
                      onChange={(e) => setDescriptorValues((d) => ({ ...d, [f.key]: e.target.value }))}
                      placeholder={FIELD_PLACEHOLDERS[f.key] || f.label}
                      {...NO_AUTOFILL}
                    />
                  </label>
                )
              )}
            </div>

            <label className="field entry-form-full">
              <span>Description</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Description…"
                rows={4}
                maxLength={8000}
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

            <label className="field entry-form-full">
              <span>Link</span>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="URL"
                {...NO_AUTOFILL}
              />
            </label>

            <div className="field entry-form-full">
              <div className="field-label-row">
                <span className="asset-upload-label" onClick={() => fileInputRef.current?.click()}>
                  Upload Assets
                </span>
                {images.length > 0 && (
                  <button type="button" className="link-btn" onClick={clearAllImages}>
                    Clear All
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFilesChange}
                hidden
              />
              {images.length === 0 ? (
                <p className="asset-empty">No assets linked</p>
              ) : (
                <div className="creatable-chips">
                  {images.map((img) => (
                    <span className="chip" key={img.key}>
                      {assetName(img)}
                      <button
                        type="button"
                        onClick={() => removeImage(img.key)}
                        aria-label={`Remove ${assetName(img)}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="field entry-form-full">
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

            <div className="field entry-form-full">
              <span>Families</span>
              <CreatableSelect
                options={familyOptions}
                selected={familyIds}
                onChange={setFamilyIds}
                multiple
                allowCreate={false}
                placeholder="Search families…"
              />
            </div>
          </>
        )}
      </form>
    </div>
  );
}

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";

const COLLECTION = "entries";

export function subscribeEntries(onChange, onError) {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

// Only keys with a non-empty value are stored — descriptors are meant to
// be absent, not present-and-blank, when not applicable to an entry.
// Descriptors are normally key -> string; medium is the one exception,
// key -> string[], so a Representational entry can be more than one
// medium at once (see MULTI_CHOICE_KEYS in NewEntryPage.jsx).
function cleanDescriptors(descriptors) {
  const out = {};
  for (const [key, value] of Object.entries(descriptors || {})) {
    if (Array.isArray(value)) {
      const cleaned = value.map((v) => String(v ?? "").trim()).filter(Boolean);
      if (cleaned.length > 0) out[key] = cleaned;
      continue;
    }
    const trimmed = String(value ?? "").trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

function poster(user) {
  return { uid: user.uid, name: user.displayName || user.email, email: user.email };
}

// content.images holds both pictures and PDFs (same {url, path} shape) --
// distinguished by extension since there's no separate content type.
export function isPdf(item) {
  if (item?.file) return item.file.type === "application/pdf" || /\.pdf$/i.test(item.file.name || "");
  return /\.pdf(\?|#|$)/i.test(item?.path || item?.url || "");
}

// A new upload has a File, so its name is straightforward. An existing
// (already-saved) asset only has a storage path/url; strip the
// "<timestamp>-<random>-" prefix NewEntryPage writes on upload so it
// reads as a plain filename either way.
export function assetName(item) {
  if (item.file) return item.file.name;
  const source = item.path || item.url || "asset";
  const last = decodeURIComponent(source.split("/").pop().split("?")[0]);
  return last.replace(/^\d+-[a-z0-9]+-/, "");
}

export async function createEntry({ title, notes, link, content, descriptors, tags, relatedIds, user }) {
  return addDoc(collection(db, COLLECTION), {
    title: title.trim(),
    notes: notes?.trim() || "",
    link: link?.trim() || "",
    content: content || null,
    descriptors: cleanDescriptors(descriptors),
    tags: tags || [],
    relatedIds: relatedIds || [],
    postedBy: poster(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateEntry(id, { title, notes, link, content, descriptors, tags, relatedIds }) {
  await updateDoc(doc(db, COLLECTION, id), {
    title: title.trim(),
    notes: notes?.trim() || "",
    link: link?.trim() || "",
    content: content || null,
    descriptors: cleanDescriptors(descriptors),
    tags: tags || [],
    relatedIds: relatedIds || [],
    updatedAt: serverTimestamp(),
  });
}

// A narrower sibling of updateEntry() for the entry page's inline tag
// editor — a partial update so it doesn't have to round-trip every
// other field (and risk clobbering them with stale local state) just
// to add or remove a tag.
export async function updateTags(id, tags) {
  await updateDoc(doc(db, COLLECTION, id), { tags: tags || [], updatedAt: serverTimestamp() });
}

// Same narrow-partial-update pattern as updateTags(), for the entry page's
// inline related-entries editor.
export async function updateRelated(id, relatedIds) {
  await updateDoc(doc(db, COLLECTION, id), { relatedIds: relatedIds || [], updatedAt: serverTimestamp() });
}

export async function deleteEntry(entry) {
  await deleteDoc(doc(db, COLLECTION, entry.id));
  if (entry.content?.type === "images") {
    for (const img of entry.content.images || []) {
      for (const path of [img.path, img.thumbPath]) {
        if (!path) continue;
        try { await deleteObject(ref(storage, path)); }
        catch (e) { console.warn("Couldn't delete stored image:", e.message); }
      }
    }
  }
}

// Related is two-way without dual-writes: an entry's related list is its
// own relatedIds, plus any entry that points back at it. Computed in
// memory since the whole collection is already loaded client-side (see
// subscribeEntries / README's "load everything, filter in memory" design).
export function getRelatedEntries(entryId, allEntries) {
  const entry = allEntries.find((e) => e.id === entryId);
  const forward = (entry?.relatedIds || [])
    .map((rid) => allEntries.find((e) => e.id === rid))
    .filter(Boolean);
  const reverse = allEntries.filter(
    (e) => e.id !== entryId && (e.relatedIds || []).includes(entryId)
  );
  const merged = new Map();
  for (const e of [...forward, ...reverse]) merged.set(e.id, e);
  return [...merged.values()];
}

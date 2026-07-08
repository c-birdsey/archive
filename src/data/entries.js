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
function cleanDescriptors(descriptors) {
  const out = {};
  for (const [key, value] of Object.entries(descriptors || {})) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

function poster(user) {
  return { uid: user.uid, name: user.displayName || user.email, email: user.email };
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

export async function deleteEntry(entry) {
  await deleteDoc(doc(db, COLLECTION, entry.id));
  if (entry.content?.type === "images") {
    for (const img of entry.content.images || []) {
      if (!img.path) continue;
      try { await deleteObject(ref(storage, img.path)); }
      catch (e) { console.warn("Couldn't delete stored image:", e.message); }
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

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase.js";

const COLLECTION = "flotsam";

export function subscribeFlotsam(onChange, onError) {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createFlotsam({ title, tags, image }) {
  return addDoc(collection(db, COLLECTION), {
    title: title.trim(),
    tags: tags || [],
    image,
    createdAt: serverTimestamp(),
  });
}

export async function updateFlotsam(id, { title, tags, image }) {
  await updateDoc(doc(db, COLLECTION, id), {
    title: title.trim(),
    tags: tags || [],
    image,
  });
}

// Deletes the Firestore doc and its stored image.
export async function deleteFlotsam(flotsam) {
  await deleteDoc(doc(db, COLLECTION, flotsam.id));
  if (flotsam.image?.path) {
    try { await deleteObject(ref(storage, flotsam.image.path)); }
    catch (e) { console.warn("Couldn't delete stored image:", e.message); }
  }
}

// Used only by the "Convert to Entry" flow -- removes just the Firestore
// record, leaving the Storage file in place since the new entry doc now
// references that same image.
export async function deleteFlotsamRecord(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

import {
  addDoc, arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";

const COLLECTION = "families";

export function subscribeFamilies(onChange, onError) {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function createFamily({ name, description, user, entryId }) {
  return addDoc(collection(db, COLLECTION), {
    name: name.trim(),
    description: description?.trim() || "",
    postedBy: { uid: user.uid, name: user.displayName || user.email, email: user.email },
    entryIds: entryId ? [entryId] : [],
    createdAt: serverTimestamp(),
  });
}

export async function addEntryToFamily(familyId, entryId) {
  await updateDoc(doc(db, COLLECTION, familyId), { entryIds: arrayUnion(entryId) });
}

export async function removeEntryFromFamily(familyId, entryId) {
  await updateDoc(doc(db, COLLECTION, familyId), { entryIds: arrayRemove(entryId) });
}

// An entry can belong to more than one family — membership lives only on
// the family doc (entryIds), so this is a filter over the already-loaded
// families list rather than a query or a back-reference on the entry.
export function getFamiliesForEntry(entryId, allFamilies) {
  return allFamilies.filter((f) => (f.entryIds || []).includes(entryId));
}

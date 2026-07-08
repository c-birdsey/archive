import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { deleteObject, listAll, ref } from "firebase/storage";
import { db, storage } from "../firebase.js";

// Wipes all entries and families, and every file under the entries/
// storage prefix. Does NOT touch config/descriptorFields — that's schema
// configuration, not archive data. Irreversible; callers must confirm.
export async function purgeEverything() {
  for (const name of ["entries", "families"]) {
    const snap = await getDocs(collection(db, name));
    for (const d of snap.docs) await deleteDoc(doc(db, name, d.id));
  }
  await deleteAllUnder("entries");
}

async function deleteAllUnder(path) {
  const { items, prefixes } = await listAll(ref(storage, path));
  for (const item of items) await deleteObject(item);
  for (const sub of prefixes) await deleteAllUnder(sub.fullPath);
}

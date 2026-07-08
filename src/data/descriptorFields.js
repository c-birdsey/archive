import { doc, getDoc, onSnapshot, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase.js";

// Descriptors are objective characteristics of an entry's content (year,
// medium, architect, etc). The set of available fields is data, not code —
// stored in one config doc so new fields can be added from the app without
// a deploy. This is the starting set; edit/extend via addDescriptorField.
export const DEFAULT_DESCRIPTOR_FIELDS = [
  { key: "author", label: "Author" },
  { key: "collaborator", label: "Collaborator" },
  { key: "year", label: "Year" },
  { key: "medium", label: "Medium" },
  { key: "project", label: "Project" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "source", label: "Publication / Source" },
];

const DOC_REF = doc(db, "config", "descriptorFields");

export async function ensureDescriptorFieldsSeeded() {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) {
    await setDoc(DOC_REF, { fields: DEFAULT_DESCRIPTOR_FIELDS });
  }
}

export function subscribeDescriptorFields(onChange, onError) {
  return onSnapshot(
    DOC_REF,
    (snap) => onChange(snap.exists() ? snap.data().fields || [] : []),
    onError
  );
}

export async function addDescriptorField(key, label) {
  await updateDoc(DOC_REF, { fields: arrayUnion({ key, label }) });
}

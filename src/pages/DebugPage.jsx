import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase.js";
import {
  DEFAULT_DESCRIPTOR_FIELDS, addDescriptorField, ensureDescriptorFieldsSeeded,
  subscribeDescriptorFields,
} from "../data/descriptorFields.js";
import { createEntry, getRelatedEntries, subscribeEntries } from "../data/entries.js";
import { createFamily, getFamiliesForEntry, subscribeFamilies } from "../data/families.js";
import { purgeEverything } from "../data/purge.js";

// Temporary, unstyled harness for exercising the new data layer end to end
// (schema-v2) before any real UI is built on top of it. Not linked from
// nav — reached directly at /__debug. Delete once the real UI lands.
export default function DebugPage({ user }) {
  const [fields, setFields] = useState([]);
  const [entries, setEntries] = useState([]);
  const [families, setFamilies] = useState([]);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [contentType, setContentType] = useState("none");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [descriptorValues, setDescriptorValues] = useState({});
  const [tagsInput, setTagsInput] = useState("");
  const [relatedIds, setRelatedIds] = useState([]);
  const [familyChoice, setFamilyChoice] = useState("none"); // none | existing:<id> | new
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyDesc, setNewFamilyDesc] = useState("");

  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");

  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeDescriptorFields(setFields, (e) => setStatus(`fields error: ${e.message}`)),
      subscribeEntries(setEntries, (e) => setStatus(`entries error: ${e.message}`)),
      subscribeFamilies(setFamilies, (e) => setStatus(`families error: ${e.message}`)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  async function handleSeed() {
    await ensureDescriptorFieldsSeeded();
    setStatus("Descriptor fields seeded (no-op if already present).");
  }

  async function handleAddField(e) {
    e.preventDefault();
    if (!newFieldKey.trim() || !newFieldLabel.trim()) return;
    await addDescriptorField(newFieldKey.trim(), newFieldLabel.trim());
    setNewFieldKey("");
    setNewFieldLabel("");
  }

  async function handleCreateEntry(e) {
    e.preventDefault();
    if (!title.trim()) return setStatus("Title required.");
    setStatus("Saving…");
    try {
      let content = null;
      if (contentType === "text") {
        content = { type: "text", body };
      } else if (contentType === "images" && files.length > 0) {
        const uploaded = [];
        for (const file of files) {
          const path = `entries/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploaded.push({ url, path });
        }
        content = { type: "images", images: uploaded };
      }

      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

      const docRef = await createEntry({
        title, notes, content, descriptors: descriptorValues, tags, relatedIds, user,
      });

      if (familyChoice === "new" && newFamilyName.trim()) {
        await createFamily({ name: newFamilyName, description: newFamilyDesc, user, entryId: docRef.id });
      } else if (familyChoice.startsWith("existing:")) {
        const familyId = familyChoice.split(":")[1];
        const { addEntryToFamily } = await import("../data/families.js");
        await addEntryToFamily(familyId, docRef.id);
      }

      setStatus(`Created entry ${docRef.id}.`);
      setTitle(""); setNotes(""); setBody(""); setFiles([]);
      setDescriptorValues({}); setTagsInput(""); setRelatedIds([]);
      setFamilyChoice("none"); setNewFamilyName(""); setNewFamilyDesc("");
    } catch (err) {
      setStatus(`Save failed: ${err.message}`);
    }
  }

  async function handlePurge() {
    const typed = prompt('This deletes ALL entries, families, and stored images. Type "PURGE" to confirm.');
    if (typed !== "PURGE") return;
    setStatus("Purging…");
    try {
      await purgeEverything();
      setStatus("Purged.");
    } catch (err) {
      setStatus(`Purge failed: ${err.message}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1>schema-v2 debug harness</h1>
      <p style={{ color: "#900" }}>{status}</p>

      <section style={{ marginBottom: 32, border: "1px solid #ccc", padding: 12 }}>
        <h2>Descriptor fields</h2>
        <button onClick={handleSeed} type="button">Seed defaults</button>
        <ul>
          {fields.map((f) => <li key={f.key}>{f.key} — {f.label}</li>)}
        </ul>
        <p style={{ fontSize: 12, color: "#666" }}>
          Defaults available: {DEFAULT_DESCRIPTOR_FIELDS.map((f) => f.key).join(", ")}
        </p>
        <form onSubmit={handleAddField}>
          <input placeholder="key" value={newFieldKey} onChange={(e) => setNewFieldKey(e.target.value)} />
          <input placeholder="label" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} />
          <button type="submit">Add field</button>
        </form>
      </section>

      <section style={{ marginBottom: 32, border: "1px solid #ccc", padding: 12 }}>
        <h2>Create entry</h2>
        <form onSubmit={handleCreateEntry}>
          <div><label>Title <input value={title} onChange={(e) => setTitle(e.target.value)} /></label></div>
          <div><label>Notes <textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div>

          <div>
            <label>
              Content type{" "}
              <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="images">Image(s)</option>
              </select>
            </label>
          </div>
          {contentType === "text" && (
            <div><textarea placeholder="body" value={body} onChange={(e) => setBody(e.target.value)} /></div>
          )}
          {contentType === "images" && (
            <div>
              <input type="file" accept="image/*" multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </div>
          )}

          <fieldset>
            <legend>Descriptors</legend>
            {fields.map((f) => (
              <div key={f.key}>
                <label>{f.label}{" "}
                  <input
                    value={descriptorValues[f.key] || ""}
                    onChange={(e) => setDescriptorValues((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                </label>
              </div>
            ))}
            {fields.length === 0 && <p>No descriptor fields seeded yet.</p>}
          </fieldset>

          <div><label>Tags (comma-separated){" "}
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </label></div>

          <fieldset>
            <legend>Related entries</legend>
            {entries.map((e) => (
              <label key={e.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={relatedIds.includes(e.id)}
                  onChange={(ev) => setRelatedIds((prev) =>
                    ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)
                  )}
                />
                {e.title}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Family</legend>
            <label style={{ display: "block" }}>
              <input type="radio" checked={familyChoice === "none"} onChange={() => setFamilyChoice("none")} /> None
            </label>
            {families.map((f) => (
              <label key={f.id} style={{ display: "block" }}>
                <input type="radio" checked={familyChoice === `existing:${f.id}`}
                  onChange={() => setFamilyChoice(`existing:${f.id}`)} /> {f.name}
              </label>
            ))}
            <label style={{ display: "block" }}>
              <input type="radio" checked={familyChoice === "new"} onChange={() => setFamilyChoice("new")} /> New family
            </label>
            {familyChoice === "new" && (
              <div>
                <input placeholder="name" value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} />
                <input placeholder="description" value={newFamilyDesc} onChange={(e) => setNewFamilyDesc(e.target.value)} />
              </div>
            )}
          </fieldset>

          <button type="submit">Create entry</button>
        </form>
      </section>

      <section style={{ marginBottom: 32, border: "1px solid #ccc", padding: 12 }}>
        <h2>Entries ({entries.length})</h2>
        {entries.map((e) => (
          <div key={e.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{e.title}</strong> — {e.id}
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
{JSON.stringify({ content: e.content, descriptors: e.descriptors, tags: e.tags, relatedIds: e.relatedIds }, null, 2)}
            </pre>
            <div>Related (two-way): {getRelatedEntries(e.id, entries).map((r) => r.title).join(", ") || "—"}</div>
            <div>Families: {getFamiliesForEntry(e.id, families).map((f) => f.name).join(", ") || "—"}</div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 32, border: "1px solid #ccc", padding: 12 }}>
        <h2>Families ({families.length})</h2>
        {families.map((f) => (
          <div key={f.id}>
            <strong>{f.name}</strong> — entries: {f.entryIds?.map((id) => entries.find((e) => e.id === id)?.title || id).join(", ") || "—"}
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid #900", padding: 12 }}>
        <h2>Purge</h2>
        <button onClick={handlePurge} type="button" style={{ color: "#900" }}>
          Delete ALL entries, families, and stored images
        </button>
      </section>
    </main>
  );
}

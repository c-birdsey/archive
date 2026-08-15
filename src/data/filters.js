// Tags and descriptors are both "metadata that narrows the index" from the
// user's point of view, so they share one filter mechanism (?d=key:value)
// and one visual treatment, rather than tags getting their own route/page.
export function matchesFilter(entry, key, value) {
  const v = value.toLowerCase();
  if (key === "tag") {
    return (entry.tags || []).some((t) => t.toLowerCase() === v);
  }
  const stored = entry.descriptors?.[key];
  if (Array.isArray(stored)) {
    return stored.some((s) => s.toLowerCase() === v);
  }
  return (stored || "").toLowerCase() === v;
}

// Multiple filters can be active at once (repeated ?d=key:value params).
// Within the same key, matching is OR'd (either author shows); across
// different keys it's AND'd (this author AND that year).
export function matchesFilters(entry, filters) {
  if (filters.length === 0) return true;
  const byKey = new Map();
  for (const f of filters) {
    if (!byKey.has(f.key)) byKey.set(f.key, []);
    byKey.get(f.key).push(f.value);
  }
  for (const [key, values] of byKey) {
    if (!values.some((v) => matchesFilter(entry, key, v))) return false;
  }
  return true;
}

export function filterLabelFor(key, descriptorFields) {
  if (key === "tag") return "Tag";
  return descriptorFields.find((f) => f.key === key)?.label || key;
}

export function entrySearchText(entry) {
  return [
    entry.title, entry.notes, entry.postedBy?.name,
    ...(entry.tags || []), ...Object.values(entry.descriptors || {}),
  ].join(" ").toLowerCase();
}

export function familySearchText(family) {
  return [family.name, family.description].join(" ").toLowerCase();
}

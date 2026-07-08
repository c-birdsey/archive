// A typographic index grouped under big letter-group dividers (A, B, C...).
// Shared by the entries List view and the Families index.
export default function LetterGroupedList({ items, labelOf, keyOf, renderItem }) {
  const sorted = [...items].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  const groups = new Map();

  for (const item of sorted) {
    const ch = (labelOf(item) || "#").trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(ch) ? ch : "#";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const keys = [...groups.keys()].sort();

  return (
    <main>
      {keys.map((key) => (
        <div className="letter-group" key={key}>
          <p className="letter-head">{key}</p>
          {groups.get(key).map((item) => renderItem(item, keyOf(item)))}
        </div>
      ))}
    </main>
  );
}

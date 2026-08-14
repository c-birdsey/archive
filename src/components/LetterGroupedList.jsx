const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// A typographic index grouped under big letter-group dividers (A, B, C...),
// with a fixed A-Z rail (studiolin.org) for jumping straight to a letter.
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

  function jumpTo(letter) {
    document.getElementById(`az-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="letter-grouped">
      <main>
        {keys.map((key) => (
          <div className="letter-group" id={`az-${key}`} key={key}>
            <p className="letter-head">{key}</p>
            {groups.get(key).map((item) => renderItem(item, keyOf(item)))}
          </div>
        ))}
      </main>

      <nav className="az-rail" aria-label="Jump to letter">
        {ALPHABET.map((letter) => (
          <button
            type="button"
            key={letter}
            disabled={!groups.has(letter)}
            onClick={() => jumpTo(letter)}
          >
            {letter}
          </button>
        ))}
      </nav>
    </div>
  );
}

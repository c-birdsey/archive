# Archive

A shared reference/moodboard catalog for two people (Calder + Thomas). React (Vite) frontend, Firebase backend (Auth, Firestore, Storage), deployed to GitHub Pages at `archive.calderbirdsey.com`.

## Stack & architecture

- **Vite + React**, no TypeScript, no Tailwind — plain CSS in `src/styles/index.css`.
- **Firebase**: Auth (Google sign-in only), Firestore (single `entries` collection), Storage (images).
- **react-router-dom** for routing: `/` (index), `/new` (create), `/entry/:id` (view), `/entry/:id/edit` (edit), `/about`.
- **Deployment**: GitHub Actions (`.github/workflows/deploy.yml`) auto-builds and deploys to GitHub Pages on every push to `main`. No manual deploy step needed.
- `vite.config.js` — `base` is currently `"/"` since we're on a custom domain (`archive.calderbirdsey.com`), not the `/archive/` subpath. Don't change this without checking the deployment target.

## Access model — two layers, not equally strong

1. **Passcode lobby** (`PasscodeGate.jsx`) — a shared password gate before sign-in. This is explicitly a **soft deterrent, not real security** — it ships in the JS bundle, readable by anyone who opens dev tools. Don't "fix" this by trying to hide it harder; that's not the point of it.
2. **Google sign-in + allowlist** — the real access control. `ALLOWED_EMAILS` in `firebase-config.js` is just for app-side messaging (clear rejection message). The actual enforcement is in Firestore/Storage security rules (documented in README.md), which hardcode the same email list. **If you add/remove an allowed person, update both the rules (Firebase Console) and `ALLOWED_EMAILS` — they must stay in sync.**

## Data model — schema-v2

This replaced an earlier `type`/`author`/`images` shape; don't assume any code or docs describing that old shape are still accurate.

### `entries` collection

Each doc:
- `title` (string, required)
- `postedBy` — `{ uid, name, email }`, auto-set from the signed-in Google account at creation, **never editable**. This is "who submitted the entry," not necessarily the content's actual creator.
- `descriptors` — a freeform `key → string` object. The set of available keys is **data, not code**: stored in a single Firestore config doc (`config/descriptorFields`, shape `{ fields: [{key,label}] }`), seeded/merged on every allowed sign-in via `ensureDescriptorFieldsSeeded()` (`src/data/descriptorFields.js`), and extendable at runtime with `addDescriptorField(key, label)` — no deploy needed. Current default keys: `primative` (Physical / Representational / Discursive — the one descriptor rendered as a radio group instead of free text, in `NewEntryPage.jsx`), `author`, `collaborator`, `year`, `medium`, `project`, `location`, `status`, `source`, `country`. Only non-empty values are persisted (`cleanDescriptors()` in `src/data/entries.js`).
- `tags` — string array, via `CreatableSelect.jsx` (multi-select, allow-create)
- `content` — polymorphic, one of:
  - `null` (no content)
  - `{ type: "text", body }`
  - `{ type: "images", images: [{ url, path }, ...] }` — **ordered, `images[0]` = primary/cover**, drag-to-reorder in `NewEntryPage.jsx`. No top-level `images`/`imageUrl`/`imageStoragePath` fields exist — everything image-related lives under `content`.
- `link` — optional URL
- `notes` — long-form text
- `relatedIds` — array of other entries' Firestore doc IDs (not titles — titles can change, IDs can't). **One-directional as entered** (linking A→B does not write anything to B), but resolved bidirectionally for *display* — `getRelatedEntries()` in `src/data/entries.js` shows an entry's related list as its own `relatedIds` plus any entry that points back at it.
- `createdAt` / `updatedAt` — server timestamps

Anyone signed in can edit or delete any entry (not just the original poster) — this was a deliberate choice for a small trusted group, not an oversight.

### `families` collection

A real, separate top-level collection — **not** derived from `relatedIds` or tags. Each doc: `{ name, description, postedBy, entryIds: [...], createdAt }`. Membership lives only on the family doc (`entryIds`, via `arrayUnion`/`arrayRemove` in `src/data/families.js`) — there's no back-reference on the entry. The data model allows an entry to belong to multiple families; the New Entry form's radio-button UI currently only surfaces/edits one membership at a time.

### Filtering & search

`src/data/filters.js` holds the shared filter/search helpers: `matchesFilter(entry, key, value)` (handles both `descriptors.*` keys and the special `"tag"` key), `filterLabelFor(key, descriptorFields)`, and `entrySearchText()`/`familySearchText()` for the search overlay. Filters are carried as a `?d=key:value` query param on `/` (`IndexPage.jsx`) — both the Index page's own Filters panel and links from `EntryDetailPage.jsx`'s descriptor/tag values write to this same param, so there's one filtering mechanism, not several.

## Design direction — read before touching any styling

The aesthetic is deliberately modeled on **Studio Lin's website** (studiolin.org): pure white ground, **one typeface** (Inter) at a handful of sizes, no cards/borders/shadows/color-coding. Hierarchy comes from whitespace, alignment, and type weight — not ornament. The List view is a typographic index with big letter-group dividers (A, B, C...), similar to Studio Lin's own project index. The Images view is a plain grid, no captions overlaid on images.

**Explicit prior decisions, don't relitigate without asking:**
- No comma separators between nav items anywhere (tried, then explicitly reversed — just use flex `gap`, not commas).
- Action labels are Title Case: "Sign Out" (not "Sign out"). Nav labels themselves (`+Add`, `Info`) are an intentional exception, matching the reference mockups.
- Nav layout: `Index`/`Families`/`Search` on the left, `+Add`/`Info`/`Sign Out` on the right, as two separate groups. Sign Out is a persistent nav item, not tucked into the About/Info page.
- No fake/decorative status indicators — a "synced" label was removed because it was hardcoded and meaningless. Don't add UI chrome that doesn't reflect real state.
- Text-only tiles in the Images grid (entries without an image) get a full faint black outline (`rgba(0,0,0,0.15)`) so they hold their shape in the grid — not just a bottom border.

## Known gotchas (things that already bit us once)

- **Never drag a whole folder to overwrite `src/pages/` or `src/components/`** when applying partial updates — if the update only touches 2 of 6 files in a folder, a full-folder overwrite silently deletes the other 4. This caused two broken deploys in one session. Always check `ls src/pages/` shows all expected files after any file-replacement operation, before committing.
- **Firebase Storage requires the Blaze (pay-as-you-go) plan** — this is already set up and paid for, not a blocker anymore, but don't suggest "switch back to free tier" as a fix for anything; it's not available.
- **GitHub Pages custom domain**: `archive.calderbirdsey.com` is a Cloudflare CNAME record (set to **DNS-only / grey cloud**, not proxied) pointing at `c-birdsey.github.io`. There's a `public/CNAME` file in the repo containing the domain — Vite copies `public/` into the build output automatically. If the custom domain setting in GitHub Pages settings ever looks wrong, check for a stray/duplicate CNAME situation before assuming DNS is broken.
- **CreatableSelect** (`components/CreatableSelect.jsx`) selects options on `mousedown` with `preventDefault`, not `onClick` — this was a deliberate fix for a click-registration race condition in the dropdown. Don't "simplify" it back to onClick.

## Communication preferences

Direct, skeptical, no filler, no unearned praise. Push back if something's not feasible or is a bad idea — don't just agree and proceed. Concrete and specific over conceptual. This applies to how you talk to Calder, not just how the code should work.

# Archive — shared reference catalog

A React app (Vite) backed by Firebase, deployed to GitHub Pages at
`archive.calderbirdsey.com`. Everyone on the allowlist signs in with
Google and reads/writes the same shared collection of entries — you
add something, Thomas sees it immediately, and vice versa, with
authorship attached to each entry.

Visual direction: white ground, one typeface (Inter), typographic index
with letter-group dividers, List/Images toggle. No cards, no borders,
no shadows — structure comes from whitespace and alignment, not
ornament, following the Studio Lin reference this was built against.

## Access model — read this first

There are two separate gates, and they are not equally strong:

1. **Passcode lobby.** A single shared password that unlocks the app in
   this browser session. This is a **soft deterrent, not real security**
   — it's baked into the JavaScript bundle that ships to every visitor,
   so anyone who opens browser dev tools and looks at the source can
   read it out. It's there to keep the site off search engines and stop
   people from accidentally wandering in, not to stop someone who's
   actually trying to get in.
2. **Google sign-in + allowlist.** This is the real access control.
   Only the specific email addresses you list get past sign-in, and
   that's enforced twice: once in the app (so a rejected person gets a
   clear message instead of a broken screen) and once for real, in the
   Firestore and Storage security rules below. The rules are what
   actually stops someone outside the allowlist from reading or writing
   data — the app-side check is just UX.

If you need the passcode itself to be real security (not just a lobby
deterrent), that requires moving the check into a Cloud Function. Ask
if you want that — it's a bigger infrastructure step than what's built
here.

## 1. Create the Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Google Analytics is optional, skip it.

## 2. Enable Authentication

**Build → Authentication → Get started → Sign-in method → Google → Enable.**
Pick any support email.

## 3. Enable Firestore

**Build → Firestore Database → Create database.** Production mode, any
nearby region.

## 4. Enable Storage

**Build → Storage → Get started.** Requires the Blaze (pay-as-you-go)
plan — already the case for this project. Production mode, same region.

## 5. Security rules — this is what actually locks the archive down

**Firestore rules** (Firestore Database → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAllowed() {
      return request.auth != null &&
        request.auth.token.email in [
          "you@gmail.com",
          "thomas@gmail.com"
        ];
    }

    match /entries/{entryId} {
      allow read, write: if isAllowed();
    }

    match /families/{familyId} {
      allow read, write: if isAllowed();
    }

    match /config/{docId} {
      allow read, write: if isAllowed();
    }
  }
}
```

**Storage rules** (Storage → Rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAllowed() {
      return request.auth != null &&
        request.auth.token.email in [
          "you@gmail.com",
          "thomas@gmail.com"
        ];
    }
    match /entries/{allPaths=**} {
      allow read, write: if isAllowed();
    }
  }
}
```

Replace the email list with your actual group in **both** places, and
publish both rule sets. This list is the actual access boundary — the
`ALLOWED_EMAILS` array in `firebase-config.js` is a convenience for the
app's own messaging, not enforcement.

**To add or remove someone later**, you edit both rule sets and the
`ALLOWED_EMAILS` array, then republish the rules. This is a hardcoded
list rather than a self-service database of allowed users, on purpose —
it's simpler and easier to audit for a small trusted group. If the
group grows past a handful of people or needs to change often, a
Firestore-backed allowlist (checked via `exists()` in the rules) is the
next step — ask if you get there.

## 6. Get your web app config

**Project settings (gear icon) → General → Your apps → Add app → Web.**
Skip Firebase Hosting. Copy the `firebaseConfig` object.

## 7. Fill in `src/firebase-config.js`

- `firebaseConfig` — from step 6. Not a secret; safe to commit.
- `ALLOWED_EMAILS` — same list as the security rules, for app-side messaging.
- `LOBBY_PASSCODE` — the shared passcode for the lobby gate (see the
  access model note above about what this does and doesn't protect).

## 8. Authorize your sign-in domains

**Authentication → Settings → Authorized domains → Add domain.** Add
both your GitHub Pages domain (or custom domain, if you're using one —
see below) and `localhost` for local dev. Without this, sign-in fails
with `auth/unauthorized-domain`, which the app will show you directly.

## 9. Local development

```
npm install
npm run dev
```

## 10. Deploy to GitHub Pages

This repo is deployed at a **custom domain** (`archive.calderbirdsey.com`),
not the default `username.github.io/repo` subpath, which is why
`vite.config.js` has `base: "/"` rather than a repo-name subpath. If
you fork this to run at the default subpath instead, you'd need to
change `base` back to `/your-repo-name/` and remove `public/CNAME`.

1. Push this project to a GitHub repo.
2. **Settings → Pages → Source → GitHub Actions.**
3. The included workflow (`.github/workflows/deploy.yml`) builds and
   deploys automatically on every push to `main`. First deploy takes a
   couple of minutes; check the **Actions** tab for progress.
4. For a custom domain: add a CNAME record at your DNS provider pointing
   the subdomain at `yourusername.github.io` (**DNS-only, not proxied**,
   if you're on Cloudflare — a proxied/orange-cloud record breaks GitHub
   Pages' certificate provisioning). `public/CNAME` holds the domain
   name itself and Vite copies it into the build automatically; set it
   again in **Settings → Pages → Custom domain**.
5. GitHub Pages serves static files with no server-side routing, but
   this app uses real URL paths (`BrowserRouter`, not hash routing) —
   so a direct hit or hard refresh on anything but `/` (e.g. `/entry/abc123`)
   would 404 without help. `public/404.html` + the redirect-restore logic
   at the top of `src/main.jsx` handle this: GitHub Pages serves
   `404.html` for any unmatched path, which stashes the requested URL
   and bounces to `/`, and `main.jsx` restores it via
   `history.replaceState` before `BrowserRouter` ever reads the location.

## Data model

Two Firestore collections are in play right now: `entries` is what the
real UI reads and writes; `families` and `config/descriptorFields` back
a newer, richer schema (`src/data/`) that's built and working but not
yet wired into any real page — it's only reachable through the
temporary `/__debug` harness (see below). Expect this section to
collapse into one schema once that migration lands.

### `entries` (current, live schema — what the app actually uses today)

| Field | Type | Notes |
|---|---|---|
| `title` | string | required |
| `author` | `{ uid, name, email }` | set once, from Google account, at creation — not editable |
| `type` | string | free text via searchable/creatable dropdown |
| `tags` | string[] | same pattern, multi-select |
| `images` | `{ url, path }[]` | ordered, first = primary/cover; drag-to-reorder on create/edit |
| `imageUrl` / `imageStoragePath` | string \| null | mirrors `images[0]`, kept for backward compatibility with pre-multi-image entries and any code still reading the singular fields |
| `link` | string | optional |
| `notes` | string | long-form |
| `relatedIds` | string[] | other entries' Firestore doc IDs, resolved to titles at render time |
| `createdAt` / `updatedAt` | Firestore timestamp | server-set |

**Related entries are one-directional as entered.** If you link A → B,
B doesn't automatically show A as related — you'd add that link from
B's own edit page if you want it to go both ways. Keeping it explicit
avoids surprising auto-generated links.

### `entries` (schema-v2, in progress — via `src/data/entries.js`)

Same collection name, different shape, not yet read by any real page:

| Field | Type | Notes |
|---|---|---|
| `title` | string | required |
| `postedBy` | `{ uid, name, email }` | same as `author` above, renamed |
| `content` | `{ type: "text", body }` \| `{ type: "images", images: { url, path }[] }` \| `null` | polymorphic — an entry has at most one content type |
| `descriptors` | object | freeform key → string value; only non-empty values are stored. The set of available keys is data, not code — see below |
| `tags` | string[] | unchanged |
| `relatedIds` | string[] | unchanged in shape, but **now two-way**: `getRelatedEntries()` merges an entry's own `relatedIds` with any entry that links back to it, computed in memory rather than dual-written |
| `notes` | string | unchanged |
| `createdAt` / `updatedAt` | Firestore timestamp | unchanged |

**`config/descriptorFields`** (single doc) holds the list of available
descriptor fields as `{ key, label }` pairs, seeded from
`DEFAULT_DESCRIPTOR_FIELDS` in `src/data/descriptorFields.js` and
extendable at runtime via `addDescriptorField()` — new fields don't
need a deploy.

**`families`** is a new collection for grouping entries that belong
together (e.g. a series). An entry can belong to more than one family;
membership lives only on the family doc's `entryIds` array, not as a
back-reference on the entry.

### `/__debug` — temporary harness for the schema-v2 data layer

An unstyled page at `/__debug` (not linked from nav, gated behind the
same sign-in + allowlist as everything else) exists to exercise the
new data layer end to end against real Firestore — seed descriptor
fields, create entries with either content type, link families, purge
everything. It's scaffolding, not a feature: delete it once real UI is
built on top of `src/data/`.

## Honest limitations

- **The passcode is not real security.** Covered above — don't rely on
  it to protect anything sensitive.
- **Desktop-only is enforced client-side, not server-side.** The mobile
  block is a width check in React; it stops the UI from rendering badly
  on a phone, it does not prevent someone from disabling JS or spoofing
  a viewport to get at the underlying data. Combined with the real
  access control (sign-in + rules), this is fine for its actual purpose
  — keeping the experience usable, not adding a security layer.
- **No full-text search service.** Search across notes/titles/tags
  works by loading all entries client-side and filtering in memory.
  Fine up to a few hundred/low thousands of entries; if the archive
  gets much larger than that, you'd want something like Algolia in
  front of it.
- **No video support in this build.** Firebase Storage could hold
  video, but there's no compression or transcoding available client-side,
  so an uncompressed phone video would be a slow, expensive entry to
  load. Left out deliberately; can be added once you know you need it.
- **Editing an image on an entry deletes the old one from Storage.**
  Intentional — otherwise replaced images accumulate as orphaned files
  you're still paying storage for.
- **Two schemas coexist right now** (see Data model above), which is a
  deliberate mid-migration state, not drift — but it means `src/data/`
  and `src/hooks/useEntries.js` are reading/writing different shapes of
  the same `entries` collection until the migration is finished.

## Project structure

```
index.html                     Vite entry HTML
vite.config.js                 base: "/" (custom domain, not a repo subpath)
public/
  CNAME                        custom domain name, copied into build by Vite
  404.html                     GitHub Pages SPA-routing fallback (see deploy step 10)
src/
  main.jsx                     React root, router, restores path stashed by 404.html
  App.jsx                      gate sequence (mobile → passcode → auth → allowlist) + routes
  firebase.js                  Firebase SDK init
  firebase-config.js           your project config + allowlist + passcode (fill in)
  hooks/
    useAuth.js                 auth state
    useEntries.js              live Firestore subscription — reads the current (v1) entries schema
  data/
    entries.js                 schema-v2 entries: content, descriptors, two-way related
    families.js                schema-v2 families collection
    descriptorFields.js        schema-v2 configurable descriptor field list
    purge.js                   wipes all entries/families/stored images — irreversible
  components/
    TopNav.jsx                 page nav + sign out
    CreatableSelect.jsx        searchable/creatable dropdown (type, tags, related)
  pages/
    PasscodeGate.jsx
    MobileBlock.jsx
    SignInGate.jsx
    IndexPage.jsx               List/Images toggle, search, type filter
    TagIndexPage.jsx            entries filtered by tag or type
    AboutPage.jsx
    NewEntryPage.jsx            create + edit (same component, id param decides)
    EntryDetailPage.jsx         full metadata view, edit/delete, related links
    DebugPage.jsx                temporary schema-v2 harness at /__debug
  styles/
    index.css                   all styling
.github/workflows/deploy.yml    build + deploy on push to main
```

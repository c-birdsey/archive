# Archive — shared reference catalog

A React app (Vite) backed by Firebase, deployed to GitHub Pages. Everyone
on the allowlist signs in with Google and reads/writes the same shared
collection of entries — you add something, Thomas sees it immediately,
and vice versa, with authorship attached to each entry.

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
deterrent), that requires moving the check into a Cloud Function, which
needs the Blaze (pay-as-you-go) Firebase plan. Ask if you want that —
it's a bigger infrastructure step than what's built here.

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

**Build → Storage → Get started.** Production mode, same region.

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

## 8. Authorize your GitHub Pages domain

**Authentication → Settings → Authorized domains → Add domain** →
`yourusername.github.io`. Without this, sign-in fails with
`auth/unauthorized-domain`, which the app will show you directly.

## 9. Local development

```
npm install
npm run dev
```

Google sign-in popups work on `localhost`; add `localhost` to the
authorized domains list if you hit the same error as above.

## 10. Deploy to GitHub Pages

1. In `vite.config.js`, set `base` to match your repo name exactly,
   e.g. `base: "/archive/"` for `github.com/you/archive`.
2. Push this project to a GitHub repo.
3. **Settings → Pages → Source → GitHub Actions.**
4. The included workflow (`.github/workflows/deploy.yml`) builds and
   deploys automatically on every push to `main`. First deploy takes a
   couple of minutes; check the **Actions** tab for progress.

## Data model

Single Firestore collection, `entries`. Each document:

| Field | Type | Notes |
|---|---|---|
| `title` | string | required |
| `author` | `{ uid, name, email }` | set once, from Google account, at creation — not editable |
| `type` | string | free text via searchable/creatable dropdown |
| `tags` | string[] | same pattern, multi-select |
| `imageUrl` / `imageStoragePath` | string \| null | Storage download URL + path (path used for cleanup on delete/replace) |
| `link` | string | optional |
| `notes` | string | long-form |
| `relatedIds` | string[] | other entries' Firestore doc IDs, resolved to titles at render time |
| `createdAt` / `updatedAt` | Firestore timestamp | server-set |

**Related entries are one-directional as entered.** If you link A → B,
B doesn't automatically show A as related — you'd add that link from
B's own edit page if you want it to go both ways. Keeping it explicit
avoids surprising auto-generated links.

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
- **Free tier limits exist** for Firestore and Storage. Comfortable for
  a personal/small-group archive; check Firebase's pricing page if
  usage grows a lot.
- **Editing an image on an entry deletes the old one from Storage.**
  Intentional — otherwise replaced images accumulate as orphaned files
  you're still paying storage for.

## Project structure

```
index.html              Vite entry HTML
vite.config.js           base path must match your repo name
src/
  main.jsx                React root, router
  App.jsx                 gate sequence (mobile → passcode → auth → allowlist) + routes
  firebase.js              Firebase SDK init
  firebase-config.js       your project config + allowlist + passcode (fill in)
  hooks/
    useAuth.js              auth state
    useEntries.js            live Firestore subscription
  components/
    TopNav.jsx               page nav + sync status + sign out
    CreatableSelect.jsx      searchable/creatable dropdown (type, tags, related)
  pages/
    PasscodeGate.jsx
    MobileBlock.jsx
    SignInGate.jsx
    IndexPage.jsx            List/Images toggle, search, type filter
    AboutPage.jsx            placeholder copy
    NewEntryPage.jsx         create + edit (same component, id param decides)
    EntryDetailPage.jsx      full metadata view, edit/delete, related links
  styles/
    index.css               all styling
.github/workflows/deploy.yml   build + deploy on push to main
```

// Paste the config object from Firebase Console →
// Project settings → General → Your apps → SDK setup and configuration.
//
// This is NOT a secret. Firebase web config is meant to be public — your
// real access control comes from Firestore/Storage security rules (see
// README.md), not from hiding these values.

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
    apiKey: "AIzaSyDg2AjfPUtnnzEAcx_lj1Hxix0sGn9NoN8",
    authDomain: "archive-4c247.firebaseapp.com",
    projectId: "archive-4c247",
    storageBucket: "archive-4c247.firebasestorage.app",
    messagingSenderId: "166099669404",
    appId: "1:166099669404:web:9583f8948138ca4bdb3859",
    measurementId: "G-DTCYKRE5JV"
};

// Everyone who's allowed to sign in and read/write the shared archive.
// This list must be kept in sync with the security rules in README.md —
// this constant only controls the app's own messaging (so someone not on
// the list gets a clear explanation instead of a confusing permission
// error). The rules are what actually enforce it.
export const ALLOWED_EMAILS = [
    "calder.birdsey@gmail.com",
    "cctommychen@gmail.com",
];

// Lobby passcode. This is a soft deterrent, NOT real security — anyone
// who opens browser dev tools can read this value out of the shipped
// JS bundle. It keeps the site out of casual/accidental discovery
// before someone even gets to the real access control (Google sign-in
// + the allowlist above, enforced by security rules). See README.md
// for the tradeoffs and how to do this properly with a Cloud Function
// if you ever need it to be a real lock.
export const LOBBY_PASSCODE = "archival";
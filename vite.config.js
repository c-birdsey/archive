import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: `base` must match your GitHub repo name for GitHub Pages to
// serve assets from the right path, e.g. if your repo is
// github.com/yourname/archive, base should be "/archive/".
// If you deploy to a custom domain instead, set this back to "/".
export default defineConfig({
  plugins: [react()],
  base: "/archive/",
});

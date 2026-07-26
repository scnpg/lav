// Runs right after `expo export -p web` (see build:web in package.json).
// Plain Node fs calls, no extra dependency - needs to behave identically on
// this Windows dev machine and the Linux GitHub Actions runner, and both
// already have Node.
//
// Two GitHub Pages gotchas this closes:
//   1. GitHub Pages runs everything through Jekyll by default, which
//      silently drops any folder starting with an underscore - including
//      Expo's own _expo/ asset directory. An empty .nojekyll file at the
//      published root disables that processing.
//   2. GitHub Pages has no concept of client-side routing: a direct hit on
//      a deep link (e.g. /lav/bathrooms/abc123, or any expo-router route
//      besides the root) 404s before React ever loads, since there's no
//      matching static file. Duplicating index.html to 404.html means
//      GitHub serves the SPA shell for that request instead of a real 404
//      page, and expo-router's client-side routing takes it from there.
const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "..", "dist");

if (!fs.existsSync(distDir)) {
  console.error(`postbuild-web: ${distDir} does not exist - did expo export run first?`);
  process.exit(1);
}

fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

const indexHtml = path.join(distDir, "index.html");
if (!fs.existsSync(indexHtml)) {
  console.error(`postbuild-web: ${indexHtml} does not exist - check web.output is "single" in app.json.`);
  process.exit(1);
}
fs.copyFileSync(indexHtml, path.join(distDir, "404.html"));

console.log("postbuild-web: wrote dist/.nojekyll and dist/404.html");

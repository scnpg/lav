// Runs right after `expo export -p web` (see build:web in package.json).
// Plain Node fs calls, no extra dependency - needs to behave identically on
// this Windows dev machine and the Linux GitHub Actions runner, and both
// already have Node.
//
// Three GitHub Pages / PWA gotchas this closes:
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
//   3. Metro's web export doesn't inject PWA tags into index.html by
//      itself - the manifest link, apple-touch-icon, and theme-color meta
//      are appended here so the site is installable ("Add to Home Screen")
//      without needing an app-store build. public/manifest.webmanifest and
//      public/icon-512.png / apple-touch-icon.png are plain static files
//      Expo's web export already copies into dist/ verbatim (SDK 47+'s
//      "public folder" convention) - nothing to copy here, just the tags
//      that reference them.
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

const PWA_TAGS = `
    <link rel="manifest" href="/lav/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/lav/apple-touch-icon.png" />
    <meta name="theme-color" content="#FDFBF7" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Lav" />
  </head>`;

let html = fs.readFileSync(indexHtml, "utf8");
if (!html.includes("manifest.webmanifest")) {
  html = html.replace("</head>", PWA_TAGS);
  fs.writeFileSync(indexHtml, html);
}

// 404.html is a copy of index.html made *after* the PWA tags above are
// injected, so a deep-link fallback load gets the same installability tags
// as a direct hit on "/".
fs.copyFileSync(indexHtml, path.join(distDir, "404.html"));

const manifestExists = fs.existsSync(path.join(distDir, "manifest.webmanifest"));
if (!manifestExists) {
  console.warn(
    "postbuild-web: dist/manifest.webmanifest is missing - Expo's web export didn't copy the public/ folder. Check the Expo SDK version supports the public-folder convention."
  );
}

console.log("postbuild-web: wrote dist/.nojekyll, dist/404.html, and PWA tags in index.html");

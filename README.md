# Lav.

A bathroom-based social map app — Beli/Letterboxd/Google Maps for bathrooms. Discover nearby
bathrooms (or search any street/landmark/business/person, even in a city you don't know), rate and
log visits on a 0–10 scorecard, build public lists/collections, follow a social feed, and submit
new spots or edits — with every community submission going through a moderation queue (or, for
admins, publishing instantly) before it's live.

> **Status: feature-complete app, actively iterating on design/UX.** Every tab (Map, Feed, Search,
> Lists, Profile), the full rating engine, gamification (points/levels), friends, and the
> submissions moderation queue are built, wired to a real Supabase backend, and typechecked. The
> design system (Andalusian/Moorish tile-inspired palette, arabesque motifs, custom loading/logo
> components) is an ongoing pass, not a one-time skin. See "Current feature set" below for what's
> real today and "Known gaps" for what's deliberately still stubbed or missing.

## Vision — where this is going

Lav's goal is to be **the definitive social app for finding a decent bathroom** — the same
category Beli occupies for restaurants and Letterboxd for film, applied to a genuinely universal,
recurring need that currently has no good answer beyond word-of-mouth and desperate search-engine
queries. Concretely, that means:

- **Comprehensive coverage, not just what's nearby.** The Map/Search combination (bathrooms,
  landmarks/streets/businesses, and people, all from one search experience) exists so someone can
  find a bathroom whether they're in their own neighborhood or a city they've never set foot in.
  Bulk OSM ingestion (`scripts/`) and community submissions both feed the same `bathrooms` table
  rather than competing datasets.
- **Trustworthy data, kept trustworthy by moderation, not just by volume.** Every non-admin
  submission goes through a queue before it's public; ratings are a statistical *mode* (resistant
  to a single outlier skewing a bathroom's score), not a raw average; a real trust/reputation
  system (currently a seeded placeholder number - see "Known gaps") is meant to eventually let
  earned trust unlock the same fast-tracking admins already have, not just an admin flag.
- **A social layer that makes logging bathrooms feel worth doing.** Friends, a feed, levels/
  points, collections — the Beli-style loop of "log it, see what your friends thought, build a
  list" applied to something that's normally an entirely private, undocumented part of daily life.
- **A design identity that doesn't feel like a utility app.** The Andalusian/Moorish
  tile-inspired palette and arabesque motifs are a deliberate bet that a mundane-sounding premise
  can still have a considered, specific visual point of view instead of generic "clean SaaS"
  styling.

None of that is fully realized yet. "Current feature set" below is what's real today; "Known
gaps" and "Future improvements" are the biggest remaining pieces — an in-app moderation screen and
a real trust/reputation system are probably the two most load-bearing gaps between here and there.

## Repo structure

```
lav/
  apps/
    mobile/                 Expo Router app (TypeScript). package.json name: lav-mobile
      app/
        (tabs)/               Map, Feed, Search, Lists, Profile
        auth/                 sign-in, sign-up, onboarding
        bathrooms/            [id] detail screen, submit (new-pin/amendment wizard - no longer
                               a tab, reachable via the map's FAB or a bathroom's "Suggest edit")
        collections/          [id] a public collection's bathroom list
        profile/              [userId] another user's public profile
      src/
        components/           Shared UI: PressableScale, ArabesqueLoader/Pattern/Divider,
                               LavLogo, LoadingScreen, Toast, LevelBadge/ProgressBar, bathroom/
                               (rating modal, photo gallery, edit modal...), map/, profile/,
                               verification/ (prototype - see "Known gaps")
        features/              Per-domain API modules: bathrooms, submissions, friends, lists,
                               places (Nominatim geocoding), reports, profile, verification
        hooks/                 useLiveLocation, useLocationOnDemand, useAsync
        lib/                   Supabase client, env, auth context, map style + theme config,
                               bathroomCache (AsyncStorage offline fallback)
        types/                 Hand-written DB types + enums mirroring the SQL schema
        constants/             Enum labels, amenities, vibe tags
        theme/                 Design tokens (colors/spacing/radii/type) + cross-platform shadow
                               helper - no NativeWind, see below
  scripts/                    Standalone Node ingestion utilities (Overpass API, a Taiwan OSM
                               bulk import) - populate `bathrooms` outside the running app
  supabase/
    migrations/             0001-0033: extensions, tables, indexes, triggers, RPCs, RLS, storage,
                             the rating engine, gamification, friends, submissions moderation,
                             admin instant-publish, trigram-indexed search
    seed/                   seed.sql (sample data) + a one-off approve_pending_submissions.sql
    functions/
      moderate-photo/       Edge Function: mock / Google Vision / AWS Rekognition provider
  package.json               Workspace root scripts
  pnpm-workspace.yaml
```

This is a single pnpm workspace (not a more elaborate monorepo tool) with one app — `apps/mobile`
is the only package today, but the workspace shape leaves room to add more later without
restructuring.

**Why no NativeWind**: this environment resolved Expo SDK 56 / React 19.2 / React Native 0.85 /
Babel 8 — newer than NativeWind 4.2.6's verified-compatible range. Rather than gamble on an
unverified babel plugin, `src/theme/` is a small hand-rolled token + `StyleSheet` system instead.
Revisit this if/when NativeWind ships a version explicitly tested against this stack.

**Why (mostly) no SVG library**: `react-native-svg` is a dependency now, but used in exactly one
place - `LavLogo`'s icon, where hitting an exact geometric shape (and a size pinned to the "L"
wordmark's own cap-height) needed real vector paths. Everything else arabesque/geometric
(`ArabesquePattern.tsx`'s `EightPointedStar`/`FloralBloom`, `ArabesqueLoader`, `ArabesqueDivider`,
the map-pin crosshair/teardrop) still uses the original plain-`View` technique: rotation +
per-corner `borderRadius` tricks, no vector library needed.

## Architecture

A top-to-bottom tour of how a request actually flows through this app.

### Layering

```
app/                        Expo Router screens - routing + composition only, no direct
                             Supabase calls
  |
  v
src/features/*/api.ts        One module per domain (bathrooms, submissions, friends, lists,
                             places, reports, profile) - every Supabase call site lives here
  |
  v
src/lib/supabase.ts          A single configured Supabase JS client (anon key, AsyncStorage-
                             backed session persistence)
  |
  v  (HTTPS: PostgREST for plain table reads/writes, RPC for anything needing server logic)
Supabase (local via `supabase start`/Docker, or a hosted project)
  Postgres + PostGIS          bathrooms, profiles, bathroom_reviews, bathroom_submissions, ...
  Row Level Security          every table - no anon write access anywhere; most reads scoped to
                               "authenticated"; a few admin-only RPCs additionally gate on
                               is_admin()
  RPCs (SQL/plpgsql)          search_verified_bathrooms, get_bathroom_review_stats,
                               process_bathroom_submission, find_nearby_duplicate_bathrooms, ...
  Storage                     bathroom_photos, avatars buckets
  Auth                        email/password, session persisted in AsyncStorage
  Edge Function               moderate-photo (mock / Google Vision / AWS Rekognition)
```

Screens never talk to Supabase directly - they call a `features/*/api.ts` function, which returns
an already-shaped, typed result (see `src/types/database.ts`, a hand-written mirror of the SQL
schema). That keeps every RLS/column-privacy assumption for a given table in one place instead of
scattered across every screen that happens to touch it.

### The platform-split pattern

Anywhere web and native genuinely diverge (mainly: MapLibre), the file is split by Expo's own
convention - `Component.web.tsx` / `Component.native.tsx` - rather than one file with
`Platform.OS` branches inside it. `MapView`, `PinPickerMap`, and `LoggedBathroomsMap` all follow
this. The `.native.tsx` side is usually an honest, simpler fallback (a plain list), not a real
map yet - see "Known gaps."

### Data flow, worked example: the Map tab

1. `MapView` reports its current viewport (both on initial load and after every pan/zoom
   settles, debounced).
2. `app/(tabs)/index.tsx` calls `getBathroomsInBounds(bounds)` - a bounded PostgREST query, never
   a full-table fetch (there are 350k+ rows; shipping all of them to every client on every pan
   would be its own outage).
3. Results get cached to `AsyncStorage` (`src/lib/bathroomCache.ts`) on success, and read back as
   a fallback if a later fetch fails, so poor connectivity shows the last-known pins instead of a
   blank map.
4. Typing in the search bar does two things in parallel: `searchBathrooms()` filters whatever's
   already loaded (client-side, instant), and a debounced call to Nominatim
   (`src/features/places/search.ts`) looks up landmarks/streets/businesses the map may not have
   pins loaded for yet - tapping one flies the camera there and lets the viewport-fetch pick up
   whatever's actually nearby.
5. Tapping a pin opens `BathroomBottomCard`; "Rate & log" opens `RateBathroomModal`, which writes
   to `bathroom_reviews` and optimistically patches the pin's score in local state before the
   next real fetch reconciles it against the server-computed value.

### The rating engine

`bathroom_reviews` is the live 0-10 "Beli for bathrooms" table - one row per (user, bathroom),
upserted on re-rating rather than accumulating duplicates. `bathrooms.overall_score` is
maintained as the **statistical mode** across all raters for that bathroom (not a mean) via
`get_bathroom_review_stats()` - a mode resists one outlier rater skewing the whole score, at the
cost of only being meaningful once raters start landing on shared values. Sub-scores
(cleanliness/smell/ambience/privacy) stay as plain 1-5 averages.

### The submission/moderation pipeline

A new pin or a suggested edit never writes straight to `bathrooms` for a regular user - it lands
in `bathroom_submissions` (`status='pending'`) via `submitNewBathroom`/`submitBathroomAmendment`.
An admin actions it later through `process_bathroom_submission(sub_id, operator_id)`, which either
inserts a new `bathrooms` row or merges the amendment into an existing one, then attaches any
submitted photos. `approve_pending_bathroom_submissions()` loops that same per-row function over
the whole pending queue (also runs on a daily `pg_cron` job) - there's no in-app review screen yet,
so today this runs via direct SQL/the RPC (see "Known gaps"). The one exception: **admins publish
instantly** - an `AFTER INSERT` trigger on `bathroom_submissions` calls
`process_bathroom_submission` immediately when the submitter is an admin, scoped strictly to the
row just inserted so it can never accidentally fast-track someone else's unrelated pending
submission sitting in the same queue.

### Search

Three independent sources meet at one search experience (the Search tab, and a lighter version on
the Map tab): people (`profiles`, plain ILIKE on username/display name - RLS already lets any
signed-in user read any profile), places (Nominatim, third-party, no local data), and bathrooms
(`search_verified_bathrooms`, a Postgres RPC). The bathroom search is trigram-indexed
(`pg_trgm`, GIN indexes on `name`/`venue_name` - a plain B-tree can't accelerate a leading-wildcard
`ILIKE '%...%'`, but a trigram GIN index can) and ranked match-quality-first: a name-prefix match
outranks a name-contains match, which outranks a venue/address/tag-only match, with rating only
as the final tiebreaker within a tier - so a mediocre-but-exact match still surfaces above an
unrelated five-star bathroom that only matched on its city name.

### Bulk data ingestion

Two standalone Node scripts populate `bathrooms` from OpenStreetMap outside the running app:
`scripts/import-taiwan-osm.mjs` (a one-time bulk load from a pre-exported GeoJSON file) and
`scripts/ingest-overpass-bathrooms.ts` (queries the live Overpass API for arbitrary bounding
boxes). Both share the same safety posture: every inserted row starts at `status='pending'`
(never `'verified'` - an import is never treated as a substitute for real verification), and
dedup against existing rows runs at a strict 2m radius via `find_nearby_duplicate_bathrooms`,
checked one candidate at a time rather than concurrently - a concurrent batch can let two new
candidates near *each other* (not near any existing row) both slip past the dedup check before
either commits, which the Taiwan import actually hit in practice before switching to sequential
processing.

### Design system

`src/theme/tokens.ts` is the single source of truth for color/spacing/radius/type - a hand-rolled
token object, not NativeWind (see "Why no NativeWind" above). Every arabesque/geometric motif is
built from plain `View`/`Svg` primitives - rotated squares, per-corner `borderRadius` "petal"
tricks, and (for the `LavLogo` icon specifically) real vector paths. `src/lib/mapTheme.ts`
re-colors the third-party MapLibre vector style in place to match the same tokens, so the map
doesn't look like a bolted-on component next to the rest of the UI.

## Current feature set

- **Map** (`(tabs)/index.tsx`): MapLibre-based (see "Map setup"), clustered bathroom pins, filter
  chips, a search bar (bathrooms by name/venue plus any street/landmark/business/neighborhood via
  Nominatim geocoding), "Use my location," and a labeled "+ Submit" button (bottom-left) that opens
  the submission wizard.
- **Search** (`(tabs)/search.tsx`): a dedicated tab combining three sources behind one search box —
  other users (by username/display name), places/landmarks/businesses (Nominatim), and bathrooms
  worldwide (not just the current map viewport — see "Architecture" for the trigram-indexed,
  relevance-ranked query behind it). Tapping a person opens their profile, a bathroom opens its
  detail screen, a place flies the Map tab there.
- **Bathroom detail** (`bathrooms/[id].tsx`): stats (rating breakdown, review count), a photo
  carousel + full gallery/lightbox, amenities, access/cost/gender/toilet-type facts, reviews list,
  save-to-collection, report flow, and "Suggest an edit."
- **Rate & Log** (`RateBathroomModal.tsx`): a Beli-style scorecard — one 0–10 overall rating
  (`bathrooms.overall_score` is the statistical *mode* across raters) plus four 1–5 sub-scores
  (cleanliness/smell/ambience/privacy), multi-photo upload, free-text notes, and inline
  access/cost/gender/toilet-type/amenity corrections (multi-select, merged non-destructively with
  whatever's already on file).
- **Submit** (`bathrooms/submit.tsx`, reached from the Map tab's FAB or a bathroom's "Suggest
  edit" — it doesn't have its own tab): a map-pin wizard for a brand-new bathroom or a suggested
  edit to an existing one. Defaults the pin to the submitter's live location (falls back to a
  configurable default center only until GPS resolves), supports the same place/landmark search as
  the Map tab to jump the pin to a business, and collects the same access/cost/gender/toilet-type/
  amenities/multi-photo fields as Rate & Log. Goes to a moderation queue
  (`bathroom_submissions`) — an admin approves it later, *except* an admin's own submission, which
  publishes instantly (see `instant_approve_admin_submission` trigger, migration 0030).
- **Feed**: Recent / Popular Near Me / Friends tabs over `bathroom_reviews`.
- **Lists**: a user's saved bathrooms (bookmarks) plus named collections (public or private).
- **Profile**: points/level with a progress bar toward the next level, a Logged/Day-streak/Want-to-
  go/Friends stat row, Been-There and Want-to-go leaderboards, collections, a map of everywhere
  you've logged, username/display-name/avatar editing, and (this account only) an admin flag.
- **Friends**: send/accept/remove, used to scope the Friends feed tab and the profile friend count.
- **Reports**: flag a bathroom's listing as wrong/inappropriate from the detail screen.
- **Design system**: an Andalusian/Moorish-tile-inspired palette (warm porcelain base, a deep
  Spanish-ceramic-blue accent — see `src/theme/tokens.ts`'s own header comment for the full
  reasoning), a matching MapLibre re-theme (`src/lib/mapTheme.ts`), `PressableScale` (hover/press
  scale+darken), `ArabesqueLoader`/`ArabesquePattern`/`ArabesqueDivider` for loading spinners/
  watermarks/accent borders, and a `LavLogo` (an SVG arabesque-tile icon + serif "Lav" wordmark,
  sized to the wordmark's own cap-height) used on a branded `LoadingScreen`, the auth screens, and
  every tab header — tapping it from anywhere always returns to the Map tab, the standard
  "logo is a home link" convention.

## Known gaps

- **No in-app admin moderation screen.** Admins currently approve/reject pending submissions via
  direct SQL/the `approve_pending_bathroom_submissions` RPC (also runs on a daily cron, migration
  0027) rather than a review UI — `getMySubmissions()` exists for a submitter to see their own
  submission history, but nothing renders the *incoming* queue yet.
- **`src/features/verification/` and `src/components/verification/`** (a "is this bathroom still
  here" prompt) and **`src/features/profile/badges.ts` / `mockAchievements.ts`** are prototype-
  stage — built but not wired into any real screen yet (the "mock" naming is deliberate: sample
  data, not a live query).
- **No real native map.** `MapView`/`PinPickerMap` have `.web.tsx` implementations (MapLibre GL JS)
  and `.native.tsx` fallbacks (a plain list/coordinate display) — a real interactive native map
  needs a custom dev client build (`@maplibre/maplibre-react-native`), not attempted here yet.
- **`useLocationOnDemand`** (one-shot, tap-triggered location read) is defined but currently unused
  — the submit wizard and the Map tab both use `useLiveLocation` (continuous watch) instead.
- **Search ranks by match quality then rating, not distance.** `search_verified_bathrooms` doesn't
  take a location parameter; the Search screen computes real distance client-side for display
  (when it has a GPS fix) but doesn't currently re-sort by it. Fine at "which bathroom did you
  mean" scale, not yet "which of these five identically-named chains is actually closest."
- Real friend graph exists (`friendships` table + RLS), but `visibility = 'friends'` on lists is
  still conservative (author + admins only) rather than actually checking the friend graph.
- See "Future improvements" for the rest.

## 1. Prerequisites

- **Node.js 20+** (`.nvmrc` pins `20`). Check with `node -v`.
- **pnpm** - enable via Corepack (ships with Node 16.13+):
  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```
  or install directly: `npm install -g pnpm`. Check with `pnpm -v`.
- **Supabase CLI** - for local Postgres, migrations, and Edge Functions:
  ```bash
  npm install -g supabase
  ```
  (or `brew install supabase/tap/supabase` on macOS). Check with `supabase --version`.
- **A Supabase account/project** (or Docker, for `supabase start` to run Postgres locally - the
  Supabase CLI needs Docker Desktop running for local dev).
- **iOS Simulator** (macOS + Xcode) / **Android Studio** with an emulator, if you want to run on
  simulators instead of a physical device. Plain web (`pnpm web`) needs neither.
- **Expo Go will not work for this app** once you try the Map tab or the bathroom-submission
  wizard on iOS/Android — `@maplibre/maplibre-react-native` is a native module, so you'd need a custom dev client
  (`expo-dev-client` is already a dependency). Web doesn't have this restriction (see "Running the
  app" below) and is the easiest way to actually try the app today.

## 2. Local install

```bash
git clone <this-repo-url> lav
cd lav
pnpm install
```

This installs both the workspace root and `apps/mobile` in one pass (pnpm workspaces).

### Environment files

Two separate `.env` files, copied from their checked-in `.env.example`:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp supabase/functions/.env.example supabase/functions/.env
```

**`apps/mobile/.env`** (only `EXPO_PUBLIC_*` vars are inlined into the client bundle by Expo -
never put a secret in a var with that prefix):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
```

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project's
  **Project Settings > API**, or printed by `supabase status` if running locally.
- `EXPO_PUBLIC_MAP_STYLE_URL` — see "Map setup" below. If unset, `src/lib/mapStyle.ts` falls back
  to OpenFreeMap's free hosted "Liberty" style automatically, so the app still runs without this
  set.

**`supabase/functions/.env`** (used by `supabase functions serve --env-file supabase/functions/.env`
for local Edge Function testing; deployed functions get secrets via `supabase secrets set`
instead — see "Moderation setup"):

```
CONTENT_MODERATION_PROVIDER=mock
GOOGLE_CLOUD_VISION_API_KEY=
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Everything in this file is optional — with `CONTENT_MODERATION_PROVIDER=mock` (or unset), the photo
moderation pipeline works fully offline with realistic fake results. Do **not** add
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` here — Supabase injects those into every Edge
Function automatically, both locally and when deployed; setting them yourself just shadows the
real ones.

The service role key itself (`SUPABASE_SERVICE_ROLE_KEY`) should never be put in any file under
`apps/mobile/` and is never read by the mobile app — it only exists inside the Supabase project
config CLI tooling. Never commit it anywhere.

## 3. Supabase setup

### Create the project

Either:
- **Hosted**: create a project at [supabase.com](https://supabase.com), or
- **Local**: run `supabase init` is not needed (already done — `supabase/config.toml` exists), just
  run `supabase start` from the repo root (requires Docker running). This spins up local Postgres,
  Studio, Storage, and Auth, and prints local URLs/keys to use in `apps/mobile/.env`.

PostGIS and pgcrypto don't need manual enabling — `supabase/migrations/0001_extensions.sql` runs
`create extension if not exists "postgis"` / `"pgcrypto"` as part of the migration set below.

### Link a hosted project (skip if running fully local)

```bash
supabase login
supabase link --project-ref your-project-ref
```

### Run migrations

```bash
# Local Postgres (supabase start) - also runs seed.sql automatically afterward:
supabase db reset

# Hosted project (after `supabase link`):
supabase db push
```

`supabase db reset` is the easiest local loop from a clean slate: it drops, re-runs every file in
`supabase/migrations/` in order, then runs the seed file configured in `supabase/config.toml`
(`db.seed.sql_paths = ["./seed/seed.sql"]`). **Once you have real data in a local database you
care about, prefer applying just the new migration(s) directly instead of a full reset** — a
reset wipes everything, seed data included. For a hosted project, `supabase db push` only applies
migrations — run the seed step separately (next section) since you may not want fake data in a
real project.

### Seed data (optional, recommended for a fresh local DB)

Already runs automatically with `supabase db reset` locally. To run it by hand against any
Postgres connection string (e.g. a hosted project, if you really want the sample data there):

```bash
psql "$(supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).DB_URL' 2>/dev/null || echo "<your-db-url>")" \
  -f supabase/seed/seed.sql
```

or more simply, paste the contents of `supabase/seed/seed.sql` into the Supabase Studio SQL editor.

The seed creates a handful of sample users (password `password123`) and sample bathrooms. See the
comments at the top of `supabase/seed/seed.sql` — it inserts directly into
`auth.users`/`auth.identities`, which is the standard (if slightly version-fragile) pattern for
local Supabase seed data; if it errors on your CLI version, create users via Studio's Auth UI
instead and re-run the rest of the file.

### Storage buckets

Already created by migration `0007_storage.sql` — no manual dashboard step needed. `bathroom_photos`
(migration 0017) is the public bucket every review/submission/community photo uploads to today;
RLS only checks that the first path segment is the uploader's own id.

### RLS policies

Already applied by `0006_rls.sql` (table policies) and `0007_storage.sql` (storage policies), plus
policy additions in later migrations as new tables were added — no manual dashboard step needed.
Every table has Row Level Security enabled; there's no anon-role write access anywhere.

### Deploy the Edge Function (hosted projects only — local `supabase start` serves it automatically)

```bash
supabase functions deploy moderate-photo
# or, from the repo root: pnpm supabase:functions:deploy

# Set moderation provider secrets on the hosted project (optional - defaults to mock if unset):
supabase secrets set CONTENT_MODERATION_PROVIDER=mock
```

### Make an account an admin

Admins get instant-publish on their own bathroom submissions (see "Current feature set") and can
approve/reject others' via the RPC/SQL described in "Known gaps". Promote any account by running
in the Supabase SQL editor (or via `psql`):

```sql
update profiles set role = 'admin' where username = 'their_username';
-- or:
update profiles set role = 'admin' where id = (select id from auth.users where email = 'someone@example.com');
```

## 4. Map setup

Lav deliberately avoids Google Maps and Mapbox — see `src/lib/mapStyle.ts` for the one place this
is configured. Set `EXPO_PUBLIC_MAP_STYLE_URL` in `apps/mobile/.env` to any MapLibre-compatible
vector style JSON URL:

- **OpenFreeMap** (default fallback if unset, OSM-based, no key required):
  `https://tiles.openfreemap.org/styles/liberty`
- **MapTiler** (OSM-based, free tier): `https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY`
- **Stadia Maps** (OSM-based, free tier): `https://tiles.stadiamaps.com/styles/alidade_smooth.json`
- **Self-hosted** `tileserver-gl` + OSM data, for full control in production.

If you use any third-party OSM-based tile host, check their usage policy/attribution
requirements — most require a visible "© OpenStreetMap contributors" credit, which
`MapView.web/native.tsx` already render via MapLibre's attribution control. The place/landmark
search bar (Map tab, Search tab, and the submission wizard) separately calls the free Nominatim geocoder directly from the
client — fine for local development, but its usage policy asks for a proper `User-Agent` and a
rate limit a production deployment should respect via a backend proxy (see the comment at the top
of `src/features/places/search.ts`).

`src/lib/mapTheme.ts` re-colors the loaded vector style in place to match `src/theme/tokens.ts` -
if the palette ever changes, that's the other file to update alongside it.

## 5. Typecheck

```bash
pnpm typecheck
# equivalent to: pnpm --filter lav-mobile typecheck  ->  tsc --noEmit
```

## 6. Running the app

```bash
pnpm dev          # equivalent to: pnpm --filter lav-mobile start
# or: pnpm web     (web only - works in a plain browser, no native build needed)
```

**Web is the easiest way to actually try the app** — `MapView.web.tsx`/`PinPickerMap.web.tsx` use
`maplibre-gl` (a JS/DOM library), so `pnpm web` (or pressing `w` after `pnpm dev`) needs no native
build at all.

Because `@maplibre/maplibre-react-native` is a native module, **plain Expo Go will not work** for
the Map tab or the submission wizard on either platform — you'll need a custom dev client. How you
build one differs by platform.

### iOS

**With a Mac (Xcode installed):**

```bash
cd apps/mobile
npx expo prebuild          # generates ios/ and android/ native projects (gitignored)
npx expo run:ios
```

This builds and installs locally over a cable (simulator or a connected physical device). A free
Apple ID works for your own device via Xcode's "Personal Team" signing, but that provisioning
profile expires every 7 days without a paid Apple Developer Program membership, so you'll need to
rebuild/reinstall periodically.

**Without a Mac — EAS Build (Expo's cloud build service):**

```bash
cd apps/mobile
npx eas login                                    # one-time, needs a free Expo account
npx eas device:create                             # registers your iPhone's UDID with Apple -
                                                   # opens a page to open on the phone itself
npx eas build --profile development --platform ios
# or: pnpm build:ios:dev
```

The build runs on Expo's servers - no Xcode needed locally. When it finishes, `eas build` prints
an install link (also emailed, and viewable at https://expo.dev under your project); open that
link **on the iPhone itself** in Safari to install it, same as any ad-hoc distribution. Two real
constraints worth knowing up front:

- **Installing on a physical device (not just the iOS Simulator) requires enrolling in the paid
  Apple Developer Program** (US $99/year) — this is Apple's device-provisioning rule, not
  something EAS or this repo can route around. `eas device:create`/`eas build` will prompt you
  through linking that account the first time.
- The `development` profile (`apps/mobile/eas.json`) builds a **dev client** (bundles the Expo
  dev-client runtime), not a production build — install it once, then use `expo start --dev-client`
  or `pnpm tunnel` (below) for actual day-to-day development instead of rebuilding for every code
  change. Only native-module changes (a new native dependency, an `app.json` plugin config change)
  need a fresh `eas build`.

### Android

Android has none of iOS's device-provisioning friction — **no paid developer account, no device
registration, no 7-day expiry.** Any Android device can install any APK you hand it (Settings may
prompt to allow "install from this source" once).

**Local build** (works on Windows/Mac/Linux, needs Android Studio + its SDK installed):

```bash
cd apps/mobile
npx expo prebuild          # generates ios/ and android/ native projects (gitignored), if not done already
npx expo run:android       # builds and installs on a connected/USB-debugging-enabled device or emulator
```

**EAS Build (no local Android Studio needed at all):**

```bash
cd apps/mobile
npx eas login                                        # one-time, needs a free Expo account (skip if already done)
npx eas build --profile development --platform android
# or: pnpm build:android:dev
```

`eas.json`'s `development`/`preview` profiles are both set to `"buildType": "apk"` — a directly
installable file, not the Play-Store-only `.aab` format EAS defaults to otherwise. When the build
finishes, download the `.apk` from the link `eas build` prints (or https://expo.dev) straight onto
the phone and open it to install - no App Store/Play Store step, no Safari-specific install flow
like iOS's ad-hoc distribution.

After the first build (either platform, either path), subsequent iterations can use
`expo start --dev-client` and reload in the installed dev client app instead of rebuilding every
time. Note that a real interactive native map isn't wired up yet either way — see "Known gaps".

### Testing on a physical phone via tunnel mode

```bash
pnpm tunnel       # equivalent to: pnpm --filter lav-mobile tunnel  ->  expo start --tunnel
```

Use this when your phone can't reach your dev machine's LAN IP directly (different Wi-Fi/VPN,
corporate network, etc.) — it proxies the Metro bundler through `@expo/ngrok` (already a
devDependency here) so your dev client (or plain Expo Go, for the tabs that don't touch MapLibre -
Feed/Search/Lists/Profile/auth) can load the JS bundle from anywhere.

**This does not, by itself, make a local Supabase instance reachable from the phone.**
`--tunnel` only proxies Metro's own dev-server traffic — it has no effect on the app's own runtime
`fetch` calls to whatever `EXPO_PUBLIC_SUPABASE_URL` points at. If that's `http://127.0.0.1:54321`
(the default `supabase start` local URL), the phone resolves `127.0.0.1` as *itself*, not your
computer, and every Supabase call fails. To actually test against a real backend from a physical
device, pick one:

- **Easiest: point `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` at a hosted Supabase
  project** (see "Create the project" above) instead of a local one — works from anywhere,
  tunnel or not.
- **Same Wi-Fi as your dev machine**: skip tunnel mode entirely, use plain `pnpm dev`/`expo start`,
  and set `EXPO_PUBLIC_SUPABASE_URL` to `http://<your-machine's-LAN-IP>:54321` instead of
  `127.0.0.1`.
- **Must use tunnel AND a local backend**: you'd need to separately expose port 54321 too (e.g. a
  second tunnel), which Expo's own `--tunnel` flag doesn't set up for you.

## 7. Moderation setup

`supabase/functions/moderate-photo` already implements the full provider abstraction
(`supabase/functions/moderate-photo/providers.ts`):

- `CONTENT_MODERATION_PROVIDER=mock` (default) — no external API calls; returns deterministic but
  varied fake SafeSearch-style results.
- `CONTENT_MODERATION_PROVIDER=google_vision` — calls the Google Cloud Vision SafeSearch REST API;
  requires `GOOGLE_CLOUD_VISION_API_KEY`.
- `CONTENT_MODERATION_PROVIDER=aws_rekognition` — calls AWS Rekognition's
  `DetectModerationLabels`; requires `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

If a real provider is selected but its credentials are missing, the function logs a warning and
falls back to mock automatically — it never hard-fails.

Today, photos attached via Rate & Log / Submit go straight to the public `bathroom_photos` bucket
(see `0017_bathroom_images.sql`) without running through this Edge Function first — wiring
automatic scanning back into that upload path (or replacing it with the older quarantine-bucket
flow this function was originally written against) is one of the items in "Future improvements."

## 8. Email setup (Resend SMTP)

Supabase Auth's confirmation/recovery/magic-link emails are sent by Supabase's own Auth service
(GoTrue) directly over SMTP - there's no app code or Edge Function in the path, so switching
providers is entirely configuration, not a migration or a function to deploy. (An earlier draft of
this setup assumed otherwise - see below for why that approach was dropped.)

**Local dev** (`supabase start`): `supabase/config.toml`'s `[auth.email.smtp]` section is disabled
by default, so local dev keeps using `[local_smtp]`/Mailpit (`http://127.0.0.1:54324`) - every
confirmation link is already captured there without needing a real inbox or eating into Resend's
quota on every test signup. Flip `enabled = true` in that section only if you specifically want to
test real Resend delivery locally, and put `RESEND_API_KEY` in `supabase/.env` (copy
`supabase/.env.example`) - the CLI loads it automatically and `config.toml` reads it via
`env(RESEND_API_KEY)`.

**Hosted project** (the only thing that affects email real users receive - `config.toml` has no
effect here): Project Settings > Authentication > SMTP Settings in the Supabase dashboard.

- Host: `smtp.resend.com`
- Port: `465` (SSL) or `587` (TLS) - either works
- Username: `resend`
- Password: your Resend API key
- Sender name: `Lav App`
- Sender email: an address at a domain you've **verified in Resend** (Resend dashboard > Domains).
  This is the part that actually determines "lands in the inbox vs. spam," not the SMTP settings
  above - Resend's shared `resend.dev` testing domain has no DKIM/SPF alignment with your brand and
  gets filtered hard by Gmail once volume passes trivial testing.

Verify the API key works before wiring any of this up: `pnpm test:resend -- you@example.com` (see
`scripts/test-resend-auth.js`) sends a real test email directly through Resend's API, independent
of Supabase entirely.

Once custom SMTP is configured (local or hosted), Supabase's own aggressive default rate limit on
its built-in mailer (a handful of emails/hour, meant to prevent abuse of the shared sender) no
longer applies - sending is governed by Resend's plan limits instead.

`apps/mobile/src/lib/auth.tsx`'s `resendConfirmationEmail()` wraps `supabase.auth.resend()` for the
"Resend confirmation email" action on the sign-up screen's "check your inbox" state
(`app/auth/sign-up.tsx`) - this works the same way regardless of which SMTP provider is configured.

**Why there's no Edge Function or SQL migration for this**: Supabase Auth's built-in email
templates are sent by GoTrue itself over the SMTP settings above - there's nothing for an Edge
Function calling Resend's REST API to hook into for *this* flow, and no SQL table controls SMTP
config (it's CLI/dashboard config, not project data). A Resend-calling Edge Function would be the
right pattern for a genuinely separate need - a custom welcome email, a digest, anything outside
Supabase Auth's own templates - but building one now with nothing to trigger it would just be dead
code. Happy to add it once there's an actual use case.

## 9. Deployment notes (nothing is deployed yet)

- Migrations/functions: `supabase db push` and `supabase functions deploy moderate-photo` against
  the linked hosted project.
- Mobile builds: EAS Build (`eas build`) once an Expo account/project is set up — not configured
  in this repo yet (no `eas.json`).
- Web: `expo export --platform web` produces a static bundle deployable to any static host.
- **Production TODOs**: replace the OpenFreeMap dev tile style and the direct-from-client Nominatim
  calls with a production-scale tile/geocoding provider; add EXIF-stripping at upload time; build
  the in-app admin moderation screen (see "Known gaps"); wire photo uploads through
  `moderate-photo` (or retire it) instead of publishing straight to the public bucket; add a real
  interactive native map.

## 10. Security/privacy notes

- The Supabase **service role key never appears in `apps/mobile/`** and is never read by the
  client — only Supabase CLI tooling and the Edge Function's server-side runtime see it.
- `bathrooms.private_access_code` (and a submission's plausibility-check coordinates) are
  **column-level REVOKEd** from the `authenticated` Postgres role — even a buggy `select *` from
  any non-admin client fails with a permission error rather than leaking them. Admins read them
  only through a dedicated RPC that checks `is_admin()` itself.
- No table or RPC ever stores or returns a user's live location. Two client-only hooks read device
  location, neither writes it to storage or the database: `useLocationOnDemand` (one-shot, unused
  today — see "Known gaps") and `useLiveLocation` (continuous `watchPositionAsync` for as long as
  the Map or Submit screen is mounted; shown only as a dot on the user's own map, or used to seed
  a new submission's pin).
- Every table has Row Level Security enabled (`0006_rls.sql` plus later migrations); there is no
  anon-role write access anywhere — every write requires a signed-in user.
- Photos upload straight to a public bucket today (see "Moderation setup" for the gap this leaves).

## 11. Future improvements

An in-app admin moderation screen for the submissions queue; wiring the verification
("is this bathroom still here?") and achievements/badges prototypes into real screens; a real
interactive native map (custom dev client build); routing photo uploads through the
`moderate-photo` Edge Function (or retiring it) instead of publishing directly; a friend-graph-aware
`visibility = 'friends'` check on lists (current behavior is a conservative author+admins-only
placeholder); comments on lists; distance-aware search ranking (see "Known gaps"); venue claiming;
a real trust/reputation score beyond the seeded placeholder number; push notifications; production-grade
image moderation (face blurring, EXIF stripping); production map tile hosting; offline saves.

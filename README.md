# Lav.

A bathroom-based social map app — Beli/Letterboxd/Google Maps for bathrooms. Discover nearby
bathrooms on a map, check in, review, build public lists, and browse a social feed — with every
new bathroom and photo going through moderation before it appears publicly.

> **Status: backend + app scaffold only.** Database (migrations, RLS, RPCs), seed data, the photo
> moderation Edge Function, and the Expo app's config/lib layer are built and typechecked. **No
> screens exist yet** (`app/` only has empty route folders) — this README documents exactly what
> you can do with the repo *today*. The "Running the app" section is written for once screens land;
> until then `expo start` will boot but show Expo Router's "no routes found" message.

## Repo structure

```
lav/
  apps/
    mobile/            Expo Router app (TypeScript). package.json name: lav-mobile
      app/              Expo Router routes - currently empty stub folders only
      src/
        lib/            Supabase client, env, auth context, map style config
        types/           Hand-written DB types + enums mirroring the SQL schema
        constants/       Enum labels, amenities, vibe tags
        features/
          bathrooms/     api.ts (CRUD/search/nearby), reviewsApi.ts (reviews + check-ins)
        theme/           Design tokens + cross-platform shadow helper (no NativeWind - see below)
        hooks/           useAsync, useLocationOnDemand
  supabase/
    migrations/         0001-0007: extensions, tables, indexes, triggers, RPCs, RLS, storage
    seed/seed.sql        Sample users, 12 bathrooms (DC), reviews, check-ins, lists, photos
    functions/
      moderate-photo/    Edge Function: mock / Google Vision / AWS Rekognition provider
  package.json           Workspace root scripts
  pnpm-workspace.yaml
```

This is a single pnpm workspace (not a more elaborate monorepo tool) with one app — `apps/mobile`
is the only package today, but the workspace shape leaves room to add more later without
restructuring.

**Why no NativeWind**: this environment resolved Expo SDK 56 / React 19.2 / React Native 0.85 /
Babel 8 — newer than NativeWind 4.2.6's verified-compatible range. Rather than gamble on an
unverified babel plugin, `src/theme/` is a small hand-rolled token + `StyleSheet` system instead.
Revisit this if/when NativeWind ships a version explicitly tested against this stack.

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
  simulators instead of a physical device.
- **Expo Go will not work for this app once the map screen exists** - `@maplibre/maplibre-react-native`
  is a native module, so you'll need a custom dev client (`expo-dev-client` is already a
  dependency). Covered in "Running the app" below.

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
EXPO_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
```

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project's
  **Project Settings > API**, or printed by `supabase status` if running locally.
- `EXPO_PUBLIC_MAP_STYLE_URL` — see "Map setup" below. If unset, `src/lib/mapStyle.ts` falls back
  to MapLibre's free public demo style automatically, so the app still runs without this set.

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

`supabase db reset` is the easiest local loop: it drops, re-runs every file in
`supabase/migrations/` in order, then runs the seed file configured in `supabase/config.toml`
(`db.seed.sql_paths = ["./seed/seed.sql"]`). For a hosted project, `supabase db push` only applies
migrations — run the seed step separately (next section) since you may not want fake data in a
real project.

### Seed data (optional, recommended for local dev)

Already runs automatically with `supabase db reset` locally. To run it by hand against any
Postgres connection string (e.g. a hosted project, if you really want the sample data there):

```bash
psql "$(supabase status -o json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).DB_URL' 2>/dev/null || echo "<your-db-url>")" \
  -f supabase/seed/seed.sql
```

or more simply, paste the contents of `supabase/seed/seed.sql` into the Supabase Studio SQL editor.

The seed creates 6 users (`ian@lav.app`, `arman@lav.app`, plus 4 fake accounts), all with password
`password123`, and 12 Washington DC bathrooms (11 verified covering every required category, 1
pending). See the comments at the top of `supabase/seed/seed.sql` — it inserts directly into
`auth.users`/`auth.identities`, which is the standard (if slightly version-fragile) pattern for
local Supabase seed data; if it errors on your CLI version, create the 6 users via Studio's Auth UI
instead and re-run the rest of the file.

### Storage buckets

Already created by migration `0007_storage.sql` (`insert into storage.buckets ...`) — no manual
dashboard step needed:
- `bathroom-photo-quarantine` — private. Users upload here first.
- `bathroom-photo-public` — public read. Only admins can write here (enforced by storage RLS
  policies in the same migration), after manually approving a photo.

### RLS policies

Already applied by `0006_rls.sql` (table policies) and `0007_storage.sql` (storage policies) — no
manual dashboard step needed. See that file's comments for the column-level lockdown on
`bathrooms.private_access_code` specifically.

### Deploy the Edge Function (hosted projects only — local `supabase start` serves it automatically)

```bash
supabase functions deploy moderate-photo
# or, from the repo root: pnpm supabase:functions:deploy

# Set moderation provider secrets on the hosted project (optional - defaults to mock if unset):
supabase secrets set CONTENT_MODERATION_PROVIDER=mock
```

### Create the first admin

The seed data already makes `ian@lav.app` and `arman@lav.app` admins. To promote any other
account, run in the Supabase SQL editor (or via `psql`):

```sql
update profiles set role = 'admin' where username = 'their_username';
-- or:
update profiles set role = 'admin' where id = (select id from auth.users where email = 'someone@example.com');
```

## 4. Map setup

Lav deliberately avoids Google Maps and Mapbox — see `src/lib/mapStyle.ts` for the one place this
is configured. Set `EXPO_PUBLIC_MAP_STYLE_URL` in `apps/mobile/.env` to any MapLibre-compatible
vector style JSON URL:

- **MapLibre demo style** (default fallback if unset): `https://demotiles.maplibre.org/style.json`
  — free, no signup, low detail, fine for development only.
- **MapTiler** (OSM-based, free tier): `https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY`
- **Stadia Maps** (OSM-based, free tier): `https://tiles.stadiamaps.com/styles/alidade_smooth.json`
- **OpenFreeMap** (OSM-based, no key required): `https://tiles.openfreemap.org/styles/liberty`
- **Self-hosted** `tileserver-gl` + OSM data, for full control in production.

If you use any third-party OSM-based tile host, check their usage policy/attribution
requirements — most require a visible "© OpenStreetMap contributors" credit.

## 5. Typecheck

```bash
pnpm typecheck
# equivalent to: pnpm --filter lav-mobile typecheck  ->  tsc --noEmit
```

This currently passes cleanly against everything in `src/` (no `app/` screens exist yet to check).

## 6. Running the app (once screens exist)

Not functional yet — there are no routes under `apps/mobile/app/` beyond empty folders, so
`expo start` will boot the dev server but Expo Router will report no matching route. Once screens
are added, the flow will be:

```bash
pnpm dev          # equivalent to: pnpm --filter lav-mobile start
# or: pnpm --filter lav-mobile web   (web only, works in a plain browser)
```

Because `@maplibre/maplibre-react-native` is a native module, **plain Expo Go will not work** for
the Map tab on iOS/Android — you'll need a custom dev client:

```bash
cd apps/mobile
npx expo prebuild          # generates ios/ and android/ native projects (gitignored)
npx expo run:ios           # or: npx expo run:android
```

After the first `expo run:*`, subsequent iterations can use `expo start --dev-client` and reload
in the installed dev client app instead of rebuilding every time. Web (`expo start --web`) needs no
native build since `MapView.web.tsx` will use `maplibre-gl` (a JS/DOM library) instead.

## 7. Moderation setup

`supabase/functions/moderate-photo` already implements the full provider abstraction
(`supabase/functions/moderate-photo/providers.ts`):

- `CONTENT_MODERATION_PROVIDER=mock` (default) — no external API calls; returns deterministic but
  varied fake SafeSearch-style results so the admin moderation queue (once built) has something
  realistic to triage.
- `CONTENT_MODERATION_PROVIDER=google_vision` — calls the Google Cloud Vision SafeSearch REST API;
  requires `GOOGLE_CLOUD_VISION_API_KEY`.
- `CONTENT_MODERATION_PROVIDER=aws_rekognition` — calls AWS Rekognition's
  `DetectModerationLabels`; requires `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

If a real provider is selected but its credentials are missing, the function logs a warning and
falls back to mock automatically — it never hard-fails.

**No photo becomes public without an admin action**, regardless of provider or scan result: the
automated scan only ever writes `moderation_status` (a triage signal). Publishing requires an
admin to flip `bathroom_photos.status` to `'approved'` — enforced in the database, not just in
application code (see `0006_rls.sql` and the `sync_photo_public_flag` trigger in
`0004_triggers.sql`). The admin moderation UI itself doesn't exist yet (task in progress).

## 8. Deployment notes (forward-looking — nothing is deployed yet)

- Migrations/functions: `supabase db push` and `supabase functions deploy moderate-photo` against
  the linked hosted project.
- Mobile builds: EAS Build (`eas build`) once an Expo account/project is set up — not configured
  in this repo yet (no `eas.json`).
- Web: `expo export --platform web` produces a static bundle deployable to any static host.
- **Production TODOs**: replace the MapLibre demo style with a paid/self-hosted tile provider;
  add EXIF-stripping at upload time (currently a documented gap, see `photosApi` TODO once
  written); move score aggregation (`update_bathroom_scores`) from a client-triggered RPC call to
  a database trigger or scheduled job; add a real friend graph before treating `visibility =
  'friends'` as more than "author + admins only".

## 9. Security/privacy notes

- The Supabase **service role key never appears in `apps/mobile/`** and is never read by the
  client — only Supabase CLI tooling and the Edge Function's server-side runtime see it.
- `bathrooms.private_access_code` (and the submitter's plausibility-check coordinates,
  `submission_latitude`/`submission_longitude`) are **column-level REVOKEd** from the
  `authenticated` Postgres role in `0006_rls.sql` — even a buggy `select *` from any non-admin
  client fails with a permission error rather than leaking them. Admins read them only through the
  dedicated `admin_get_bathroom_private_fields()` RPC, which checks `is_admin()` itself.
- No table or RPC ever stores or returns a user's live location — `useLocationOnDemand` (once
  wired into a screen) only requests location when the user explicitly taps a button, and the
  coordinates never leave React state into storage or the database.
- Every table has Row Level Security enabled (`0006_rls.sql`); there is no anon-role access
  anywhere — every read/write requires a signed-in user.
- Photos are private (quarantine bucket) until an admin approves them; see "Moderation setup"
  above.

## 10. Future improvements

Real friend graph (current `visibility = 'friends'` rows are visible only to their author + admins
as a conservative placeholder), comments on lists, advanced/full-text search, venue claiming,
trust/reputation scoring beyond the seeded placeholder number, push notifications, production-grade
image moderation (face blurring, EXIF stripping), production map tile hosting, offline saves, real
leaderboards, and badges (`First Flush`, `Porcelain Elite`, etc. — names only exist as an idea so
far, no schema for them yet).

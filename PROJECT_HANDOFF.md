# Lav — Project Handoff

For full setup instructions see [README.md](README.md). This doc is for picking the build back up.

## 1. Current status

Backend (Supabase schema/RLS/seed/Edge Function) is complete and unverified-against-a-live-project
(never run against real Supabase, only reviewed/typed by hand). The Expo app has a working
navigation shell and **one real screen (Map, mock data only)**. Every other tab is still a static
placeholder. Nothing talks to Supabase yet — by design, not by accident.

## 2. Product concept

Lav = Beli + Letterboxd + Google Maps, for bathrooms. Utility (find a clean bathroom near you) and
social flex (brag about rare/fancy/cursed bathrooms via check-ins, reviews, ranked lists) in one
minimalist, premium, slightly-playful app. New bathrooms and photos are invisible until an admin
approves them — moderation is core to the product, not an afterthought.

## 3. Tech stack (exact pinned versions matter — see §9)

Expo SDK 56 · Expo Router 56 · React 19.2.3 · React Native 0.85.3 · TypeScript ~6.0.3 ·
`@supabase/supabase-js` 2.108.2 · `@maplibre/maplibre-react-native` 11.3.6 (native, not yet used) +
`maplibre-gl` 5.24.0 (web, not yet used) · pnpm workspace monorepo · hand-rolled theme tokens
(`src/theme/`) instead of NativeWind — see §9 for why.

## 4. Folder structure

```
lav/
  apps/mobile/              Expo Router app (package name: lav-mobile)
    app/                    Routes. (tabs)/ has Map(real)+Feed/Submit/Lists/Profile(placeholders),
                            auth/sign-in.tsx (placeholder), _layout.tsx, +not-found.tsx
    src/
      components/           PlaceholderScreen, Wordmark, components/map/* (Map screen pieces)
      features/bathrooms/   api.ts + reviewsApi.ts (real Supabase calls, unused by any screen yet),
                            mockData.ts (9 mock bathrooms, used by the Map screen)
      lib/                  supabase.ts, auth.tsx, env.ts, mapStyle.ts, format.ts, id.ts, profiles.ts
      types/, constants/    DB types/enums mirroring the SQL schema, amenity/tag/enum labels
      theme/                Design tokens + cardShadow() helper
      hooks/                useAsync, useLocationOnDemand
  supabase/
    migrations/0001-0007    extensions, tables, indexes, triggers, RPCs, RLS, storage policies
    seed/seed.sql           6 users + 12 DC bathrooms + reviews/check-ins/lists/photos/reports
    functions/moderate-photo/  mock / Google Vision / AWS Rekognition provider abstraction
```

## 5. Already implemented

- **Database**: every table, RLS policy, RPC (`get_verified_bathrooms_nearby`,
  `search_verified_bathrooms`, `update_bathroom_scores`, `find_nearby_duplicate_bathrooms`,
  `admin_get_bathroom_private_fields`), storage buckets, seed data. `private_access_code` is
  column-REVOKEd from `authenticated` — only readable via the admin RPC.
- **App shell**: root `Stack` + bottom `Tabs` (Map/Feed/Submit/Lists/Profile), branded 404.
- **Map screen** (`app/(tabs)/index.tsx`): search (client-side text filter), 4 filter chips
  (Free/Wheelchair/Bidet/Public-only, AND logic), a **mock, non-geographic** map panel with
  tappable pins (`MockMapView` — plain `View`s positioned by normalizing lat/lng, not a real map),
  a bottom card on pin selection, a "Use my location" button that's a literal `Alert.alert`
  placeholder (no `expo-location` call).
- **Data layer written but unused**: `src/features/bathrooms/api.ts` and `reviewsApi.ts` have real
  Supabase queries ready to swap in for the mock data.

## 6. Still placeholder / not started

- Feed, Submit, Lists, Profile tabs — static `PlaceholderScreen` text only.
- `auth/sign-in.tsx` — static screen, no real Supabase auth wired (the `AuthProvider` in
  `src/lib/auth.tsx` exists but is imported nowhere yet).
- Admin moderation UI — doesn't exist.
- Real map: `MapView.native.tsx` / `MapView.web.tsx` (MapLibre) — packages are installed,
  **never rendered**. `MockMapView` is the only map UI today.
- Photo upload/moderation UI, `photosApi.ts` — not written.
- No screen calls Supabase. No `.env` file exists (only `.env.example`) — the app has never been
  run against a real or local Supabase project.

## 7. Known working commands

```bash
pnpm install                              # from repo root
pnpm --filter lav-mobile typecheck        # currently passes clean
pnpm --filter lav-mobile web              # or: npx expo start --web (apps/mobile)
npx expo export --platform web            # one-shot bundle check, most reliable way to verify
                                           # web builds without a possibly-stale dev server
```
No `eas.json` — no EAS builds configured. iOS/Android never built (MapLibre native module would
require `expo prebuild` + `expo run:ios`/`run:android`, untested in this environment).

## 8. Known issues / risks

- **Never run against real Supabase.** Migrations/RLS/RPCs are correct by inspection and careful
  reasoning, not by an actual `supabase db reset` + query test.
- **MapLibre is unverified.** Installed, peer-deps check out on paper, but zero render attempted
  (native or web). Expect friction when `MapView.*.tsx` actually gets built.
- This sandbox resolved a noticeably newer dependency snapshot than typical training data
  (Expo 56, RN 0.85, React 19.2, TypeScript 6, Babel 7.29). Don't assume "latest" on npm is safe —
  verify peer deps before bumping anything (see §9).
- `src/types/database.ts` has a `Flatten<T>` mapped-type workaround for a real TS+postgrest-js
  generic-resolution bug (named interfaces silently collapsed the whole schema to `never`). Don't
  remove it without re-testing — it's load-bearing, not decorative (comment in that file explains).

## 9. Dependency/version notes

- **react/react-dom mismatch (fixed)**: `react-dom` was briefly pinned to `19.2.7` while `react`
  was `19.2.3`. Both are now `19.2.3` (apps/mobile/package.json). Keep these in lockstep on any
  future bump.
- **`react-native-worklets` (added)**: `react-native-reanimated@4.x` extracted its JS runtime into
  this separate package; expo-router needs reanimated transitively. Missing it caused a Metro
  `UnableToResolveError` → 500 on the web bundle.
- **`@babel/core` must stay on the 7.x line** (`^7.29.7`), not npm's `latest` tag (`8.0.1`).
  `babel-preset-expo` and the whole RN Babel plugin ecosystem asserts Babel `^7.0.0-0` and hard-fails
  on 8.x. This was the second half of the white-screen bug fixed in commit `022f9d4`.
- No NativeWind/Tailwind — dropped deliberately given the newer-than-usual stack; `src/theme/`
  fills that role. Revisit only if a NativeWind release explicitly verifies against Expo 56/RN 0.85.

## 10. Git history

```
022f9d4  fix Expo web app shell        - react-native-worklets added, @babel/core 8.x -> 7.x,
                                          react-dom pinned to match react
2b0d683  Add minimal Expo Router app shell with tab navigation
6f5aaf7  Add README with setup instructions for current scaffold state
44cab1c  initial Lav scaffold           - full DB schema, seed, Edge Function, app config
```
**Uncommitted right now**: the Map screen implementation (`app/(tabs)/index.tsx` modified,
`src/components/map/` and `src/features/bathrooms/mockData.ts` new, untracked). Local `main` is
also 1 commit ahead of `origin/main` (unpushed).

## 11. Recommended next steps, in order

1. Commit the current Map screen work (see §10).
2. Stand up a real Supabase project, run migrations + seed, fill in `apps/mobile/.env` — prove the
   backend actually works before building more UI against it.
3. Wire `src/lib/auth.tsx`'s `AuthProvider` into `app/_layout.tsx` + build real sign-in/sign-up on
   `auth/sign-in.tsx`.
4. Swap `MockMapView` + `mockData.ts` for `getNearbyBathrooms()` (`src/features/bathrooms/api.ts`)
   — keep the screen's component structure, just change the data source.
5. Build `MapView.native.tsx`/`MapView.web.tsx` (real MapLibre) only after step 4 proves data flow
   works — don't fight two unknowns (real data + real map) at once.
6. Bathroom profile screen (`/bathrooms/[id]`), then Submit, then Feed, then Lists, then Profile,
   then Admin — roughly the order in README's "Build order".

## 12. Rules for future Claude sessions

- **One feature at a time.** Don't implement Map+Feed+Submit in the same pass even if asked
  broadly — confirm scope first if a request looks broad.
- **Always run `pnpm --filter lav-mobile typecheck` before declaring anything done.**
- **Always verify the web build actually renders** — prefer `npx expo export --platform web` over
  trusting a long-running dev server, which has repeatedly shown stale-cache symptoms in this repo
  after dependency changes (see §8/§9 history).
- **Don't bump a dependency to npm's `latest` tag without checking peer dependencies first** — two
  separate build breaks in this repo's history came from exactly that.
- **Commit only when explicitly asked**, with a message describing what changed and why.
- **Don't add backend/Supabase wiring "while you're in there"** — every session so far has been
  scoped to one layer (backend, shell, one screen) on purpose; keep doing that.

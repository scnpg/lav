# Bathroom Inventory & Verification Strategy

Status: planning document. Nothing in this file is implemented yet - Lav is still running on
mock data ([src/features/bathrooms/mockData.ts](../apps/mobile/src/features/bathrooms/mockData.ts)),
not connected to Supabase. See [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md) for current build state.
This doc exists so the inventory/verification/anti-abuse system gets designed deliberately
*before* real data starts flowing in, instead of bolted on after the fact.

## 1. Correction: the map is not the data

MapLibre GL JS + OpenFreeMap (see `src/lib/mapStyle.ts`) give Lav its basemap rendering only -
streets, labels, tiles, pan/zoom. They contain **zero bathroom data**. OpenFreeMap is a
vector-tile *style* host, not a points-of-interest API, and nothing about switching map
providers ever gets us bathroom inventory for free.

Lav has to build and maintain its own bathroom database, sourced from a mix of public open
data, OpenStreetMap, manual admin scouting, and user submissions (Section 3). Everything below
is about how that database gets populated, verified, and kept honest.

## 2. Launch regions

Lav launches in **dense city clusters, not nationwide.** A thin nationwide layer of bathrooms
with no local density anywhere fails the core product loop (Beli/Letterboxd-style apps need
enough local density that checking in and browsing nearby is actually useful) and makes
verification unmanageable (no concentration of users near any one candidate to confirm it).

| Region | Why |
|---|---|
| **NYC** | Strong launch candidate - NYC publishes public restroom open data (NYC Open Data / NYC Parks restroom locations), giving a real, license-clear seed dataset on day one, independent of OSM coverage gaps. |
| **DC** | Relevant to the team, enables in-person/local verification. Data availability is *not* assumed - see Section 3.1, DC sources need to be researched portal-by-portal before they're trusted. |
| **Baltimore / UMBC** | Same rationale as DC: team/local relevance enables hands-on verification, particularly around a campus (UMBC) where foot traffic and admin scouting are both feasible. Data availability likewise needs source-by-source research. |

Additional cities get added the same way: pick a dense cluster, research its open-data
portal(s) for restroom/facility datasets, cross-check against OSM coverage, then seed - never
spray a single source across the whole country at once.

## 3. Bathroom source pipeline

Sources are listed in roughly the order they get evaluated/imported. Every source maps to a
starting verification status (Section 4) - **no source other than a firsthand admin visit
starts at `verified`.**

1. **OpenStreetMap `amenity=toilets`** - broadest coverage, free, ODbL-licensed (requires
   attribution, share-alike on derived data extracts - the *display* of OSM-derived points
   doesn't relicense Lav's own database, but bulk-imported tags should keep their OSM
   `node_id` for provenance/re-sync). Starts at `imported_candidate`.
2. **NYC public restroom open data** - city-published, license-clear. Starts at
   `imported_candidate`, but a clean government source can be fast-tracked to
   `needs_user_confirmation` sooner than a scraped/inferred source.
3. **DC open data / parks / public restroom sources, if available** - not yet confirmed to
   exist or to have usable licensing. Action item: check `opendata.dc.gov`, DC Parks &
   Recreation, and DC's open-data catalog for a restroom/facility dataset before assuming one
   exists. Starts at `imported_candidate` if and when a usable source is found.
4. **Baltimore open data / parks / public facility sources, if available** - same caveat as DC.
   Check Baltimore's open-data portal and Baltimore City Recreation & Parks. Starts at
   `imported_candidate` if found.
5. **Refuge Restrooms, if license/API terms permit** - community-sourced, often covers
   gender-neutral/accessible bathrooms other sources miss. Gated on actually reading their
   API terms of service before any import - do not import first and check the license later.
   Starts at `imported_candidate`.
6. **Manual admin seeding** - an admin (in person, traveling, or researching) adds a bathroom
   directly. This is the **highest-trust source** and the only one that can start above
   `imported_candidate` - see Section 8 ("Global admin seeding") for exactly how high.
7. **User submissions** - any signed-in user can submit a new bathroom. Starts at
   `pending_user_submission`.
8. **Venue inference** (e.g. "this is a Starbucks, Starbucks usually has a bathroom") - the
   *lowest*-confidence source. Never shown to regular users under any circumstance until
   promoted. Always starts `needs_admin_review`, always admin-only visibility, and is the only
   source type that's permanently admin-only rather than just "while pending."

### 3.1 Research-before-trust rule

For any source marked "if available" above (DC, Baltimore, Refuge Restrooms): the engineering
task is "go check," not "assume and build the importer." A source only gets wired into the
pipeline once someone has actually opened the portal/API docs, confirmed a usable license, and
confirmed the data has real restroom rows (not just parks/facilities with no restroom field).

## 4. Verification statuses

```
imported_candidate ─┐
                     ├─► needs_user_confirmation ─► verified
pending_user_        │                          └─► rejected
  submission ─────────┤
                     ├─► needs_admin_review ─► verified
                     │                       └─► rejected
                     └─► (any status) ─► duplicate | stale | hidden
```

| Status | Meaning |
|---|---|
| `imported_candidate` | Came from an automated/bulk source (OSM, open data, Refuge Restrooms). Nobody has looked at it yet. |
| `pending_user_submission` | A user submitted it directly. Awaiting the same confirmation/review pipeline as an imported candidate. |
| `needs_user_confirmation` | Queued for the yes/no/maybe prompt (Section 5) to nearby users. |
| `needs_admin_review` | Either flagged by moderation (Section 6), low-confidence (venue inference), or has ambiguous/conflicting user confirmation votes. |
| `verified` | Cleared the bar in Section 4.1. The only status shown as a normal public map pin. |
| `rejected` | Determined not to exist / not a real bathroom / not accessible as described. Kept (not deleted) for audit + duplicate-prevention. |
| `duplicate` | Matches an existing bathroom (same physical location). Points to the canonical record. |
| `stale` | Was verified once, but a report or re-check suggests it's closed/moved/no longer accessible. Re-enters review, doesn't just silently disappear. |
| `hidden` | Admin-suppressed (e.g. abuse target, legal request, withdrawn at owner's request) without being "rejected" as factually false. |

This is a superset of the current `bathroom_status` check constraint in
[0002_tables.sql](../supabase/migrations/0002_tables.sql)
(`pending, verified, rejected, duplicate, hidden`). Adopting this richer model is a schema
migration to do later (Section 11, item 5) - `pending` maps to a mix of `imported_candidate` /
`pending_user_submission` / `needs_user_confirmation` / `needs_admin_review` depending on
provenance, and `verified`/`rejected`/`duplicate`/`hidden` carry over unchanged.

### 4.1 Public visibility rule

**Only `verified` bathrooms render as normal public map pins.** Every other status - including
`imported_candidate` and any venue-inferred candidate regardless of status - is admin-only.
This is the same posture Lav already takes with photo moderation (quarantine bucket until
approved) and bathroom submissions (invisible until admin-verified) per the current RLS
policies - this doc just extends that posture to a richer status set instead of collapsing
everything into one `pending` bucket.

## 5. User confirmation model

Lav can ask a user near a candidate bathroom a simple existence question instead of relying
only on admin review. This is the main way `needs_user_confirmation` candidates move forward
without an admin having to personally visit every single one.

**Prompt:** "Does a bathroom exist at [venue/location]?" with exactly three answers:

- **Yes, this bathroom exists**
- **No, this bathroom does not exist**
- **Maybe / not sure**

**Rules:**

1. Only prompt users plausibly near the candidate - **within 10 miles**. Never prompt someone
   on the other side of the country about a candidate they have no way to have firsthand
   knowledge of.
2. **Frequency-capped.** No user gets bombarded with prompts. A reasonable starting cap:
   at most one or two confirmation prompts per user per day, surfaced opportunistically (e.g.
   when they open the Map tab near a candidate), never as a push notification spam loop.
3. **Opt-in / low-friction.** The prompt is dismissible with zero penalty. Answering is a
   single tap. Nothing about the core map/search/review experience should ever require
   answering a confirmation prompt first.
4. Exactly the three answers above - no free text required (an optional comment can be offered,
   never mandatory).
5. **One answer never verifies a bathroom.** A single "yes" does not flip `needs_user_confirmation`
   straight to `verified`.
6. Promotion to `verified` (or to `rejected`) considers, together: **consensus** across multiple
   answers, **admin review**, **source reliability** (a government open-data candidate needs
   less confirmation than a venue-inferred one), **duplicate detection** (is this actually the
   same bathroom as an existing verified one a few meters away?), and **report history** (has
   this exact candidate already been reported as fake/closed?).
7. **Rewards (Section 9) are only granted once the bathroom reaches its final outcome and the
   user's answer matches it.** A "yes" vote isn't rewarded the moment it's cast - it's rewarded
   (or not) once the candidate actually resolves to `verified` or `rejected`.
8. **Spammy, repeated, or suspicious answer patterns are never rewarded** and feed into the
   trust-penalty path (Section 10) - e.g. a user who answers "yes" to every single prompt
   regardless of locale/plausibility, or who answers dozens of prompts in seconds.

## 6. Moderation model

Every piece of user-generated content (submissions, reviews, captions, access tips, photos,
list names) passes through moderation before it's eligible to become public. Flag or filter:

- racial slurs
- hate speech
- targeted harassment
- explicit sexual content
- spam
- impossible coordinates (e.g. middle of the ocean, `0,0`, outside any plausible city bounds)
- duplicate locations
- obviously fake submissions
- suspicious repeated submissions from one user (rate/pattern-based, not content-based)

**Important exception:** unusual or absurd-sounding *business names* are never auto-rejected
on vibes alone. Real venues have genuinely strange names. Instead, an unusual name contributes
to a **moderation score** that routes the submission to `needs_admin_review` rather than
auto-rejecting it - a human makes the actual call. This mirrors the existing photo moderation
pipeline's `needs_human_review` state (see `supabase/functions/moderate-photo`) - automated
signals route to a human, they don't unilaterally decide.

## 7. Verification confidence levels

A bathroom's confidence level is separate from (but correlated with) its verification status -
status is the workflow state, confidence is "how sure are we this is real and accurate."

| Level | Meaning |
|---|---|
| 0 | Imported candidate. No human or user signal yet. |
| 1 | Location probably exists, based on source data alone (e.g. a government open-data row). |
| 2 | One or more users have confirmed existence. |
| 3 | An admin, or a sufficiently trusted user (Section 10), has verified access details. |
| 4 | Verified with photo, review, and/or access details attached - multiple corroborating signals. |
| 5 | Recently re-verified by a trusted user or admin - the freshest, highest-confidence state. |

A bathroom can regress (e.g. a `stale` report can drop a Level 5 bathroom back down) - confidence
is not monotonically increasing, it reflects current trust in the data, not historical peak trust.

## 8. Global admin seeding

Launch regions (Section 2) govern where Lav actively promotes itself, defaults its map view, and
prioritizes consumer-facing user-confirmation prompts - they are **not** a restriction on where
an admin can add a bathroom.

**An admin can add a verified bathroom anywhere in the world**, while traveling, scouting, or
documenting from research, independent of the three launch regions:

- City/region fields on a bathroom are free-text + lat/lng, never constrained to a fixed enum
  of "supported cities" - adding a bathroom in a city Lav hasn't launched in yet should never
  be blocked by the data model.
- When an admin personally visits and documents a bathroom firsthand (photo, access notes,
  on-site), it can be created **directly at `verified` / confidence Level 4 or 5** - that's
  exactly the "recently verified by trusted admin" case in Section 7. It does not need to pass
  through `needs_user_confirmation` at all, because the admin *is* the strongest available
  verification signal.
- When an admin adds a bathroom from research rather than a personal visit (e.g. cross-checking
  a map listing without having been there), it should start at a lower confidence
  (`imported_candidate` / Level 0-1) and go through the normal pipeline like any other source -
  admin status doesn't override "actually verify this" if the admin hasn't actually verified it.
- The admin bathroom-entry tool should make this distinction explicit at creation time
  ("I visited this in person" vs. "I'm adding this from research") rather than silently always
  picking one path.

This means the inventory naturally grows two ways at once: launch-region density from open data
+ user confirmation, and worldwide outposts from direct admin scouting - both feeding the same
database, same status model, same map.

## 9. Achievements & leveling

Goal: reward useful verification work, make zero reward available for spam, and make trust
something earned over time rather than granted on request.

### 9.1 Core user stats

- Lav Level
- Total contribution points
- Verified bathrooms added
- Correct confirmation votes
- Helpful access tips (approved)
- Approved photos
- Approved reviews
- Duplicate reports confirmed
- Stale/closed reports confirmed
- City-specific contribution counts (e.g. "12 verified in DC")

### 9.2 Points model

| Action | Points |
|---|---|
| Correct yes/no existence confirmation, after final verification | +2 |
| Correct maybe/not-sure, when final data was genuinely ambiguous | +1 |
| Approved new bathroom submission | +10 |
| Approved photo | +5 |
| Helpful access tip approved | +4 |
| Confirmed duplicate report | +3 |
| Confirmed closed/stale report | +3 |
| False/spam report | 0, and a possible trust penalty (Section 10) |

All "correct"/"confirmed"/"approved" outcomes are paid out **after** the underlying item
resolves - never at submission time - consistent with Section 5, rule 7.

### 9.3 Badges

- **First Flush** - first approved contribution of any kind.
- **Cartographer** (I/II/III, **Master Cartographer**) - see 9.4.
- **Campus Cartographer** - verified bathrooms near a specific campus (e.g. UMBC).
- **City Scout** - verified bathrooms within a specific city.
- **NYC Founder**, **DC Founder**, **Baltimore Founder**, **UMBC Founder** - early verified
  contributions in each launch region, awarded once per region per user, presumably capped to
  an early window (e.g. region's first N verified contributions or first M months post-launch).
- **Verification Streak** - consecutive days with at least one correct confirmation vote.
- **Access Angel** - approved access tips reaching a threshold.
- **Photo Scout** - approved photos reaching a threshold.
- **Duplicate Detective** - confirmed duplicate reports reaching a threshold.
- **Stale Spotter** - confirmed stale/closed reports reaching a threshold.
- **Porcelain Elite** - sustained high-confidence contribution over time (exact threshold TBD
  when the points/levels schema is built - candidate definition: top percentile of total
  points within a season, or a fixed high point threshold).
- **Bidet Baron** - flavor badge for bidet-tagged bathroom contributions (submissions, reviews,
  or access tips on bathrooms tagged `bidet`), matching the existing `bidet` vibe tag and
  amenity key already in `src/types/enums.ts`.

### 9.4 Cartographer badge logic

Based on **correct bathroom existence confirmations** (Section 5):

| Badge | Threshold |
|---|---|
| Cartographer I | 5 correct confirmations |
| Cartographer II | 25 correct confirmations |
| Cartographer III | 100 correct confirmations |
| Master Cartographer | 250 correct confirmations **or** 50 verified submitted bathrooms |

## 10. Trust & reputation

Trust is **earned from a track record of confirmed-accurate contributions** - it is never
self-declared, purchasable, or grantable by the user themselves.

- Higher-trust users get **more weight** in the consensus calculation that moves a candidate
  from `needs_user_confirmation` toward `verified`/`rejected` (Section 5, rule 6) - e.g. a vote
  from a user with a long correct-confirmation history could count for more than a brand-new
  account's vote in a weighted consensus score.
- **No user, regardless of trust level, can unilaterally verify a bathroom by themselves.**
  Verification is always a function of (weighted consensus) + (source reliability) + (duplicate
  check) + (report history), with admin review as the override/escalation path - never a single
  person's say-so, admin included, outside of the firsthand-admin-visit case in Section 8.
- Trust can go down, not just up: confirmed spam/false reports, confirmed bad-faith
  confirmation votes, or a pattern of suspicious submissions all apply a trust penalty
  (Section 5, rule 8; Section 6). This is the same `trust_score` column that already exists on
  `profiles` in the current schema (`supabase/migrations/0002_tables.sql`) - this strategy is
  what eventually drives that number, it's not a new column.

## 11. Future implementation plan

In order:

1. Add mock achievements and level UI (client-only, same mock-data pattern as the current Map
   tab and bathroom detail screen - no backend yet).
2. Add mock verification prompt UI (the yes/no/maybe prompt from Section 5, against mock
   candidates, no real consensus logic yet).
3. Add docs for each data import source (one doc per source in `docs/`, covering exact API/portal
   URL, license terms, field mapping to `bathrooms` columns, and import cadence) once a source
   from Section 3 is actually evaluated and confirmed usable.
4. Add a database schema for badges/points/contributions (new tables: something like
   `user_stats`, `badges`, `user_badges`, `contribution_events` - additive migrations, doesn't
   touch existing tables).
5. Add a Supabase-backed verification queue (the `needs_user_confirmation` /
   `needs_admin_review` pipeline becomes real, status enum migrates per Section 4).
6. Add an admin review queue (UI for admins to clear `needs_admin_review` candidates, run the
   global-seeding flow from Section 8, and action reports).

None of the above is built yet. This document is the plan those steps get checked against.

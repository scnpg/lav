-- Lav: core schema
-- All enums are enforced as text + check constraints (not Postgres enum types) so that
-- adding a new value later is a cheap migration instead of an enum-rewrite.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row. Created by a trigger (see 0004) when
-- a user signs up, so the app never has to "remember" to create it.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  trust_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Public user profile, 1:1 with auth.users.';

-- ---------------------------------------------------------------------------
-- bathrooms: the core entity. New submissions default to status='pending'
-- and are invisible to everyone except their submitter + admins until an
-- admin sets status='verified'.
-- ---------------------------------------------------------------------------
create table if not exists bathrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_name text,
  description text,
  address text,
  city text,
  region text,
  country text,
  floor text,

  location geography(Point, 4326) not null,
  latitude double precision not null,
  longitude double precision not null,

  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'duplicate', 'hidden')),

  access_type text
    check (access_type in (
      'public', 'customer_only', 'purchase_required', 'receipt_code', 'ask_staff',
      'key_required', 'code_required', 'employee_only', 'ticket_required',
      'hotel_guest_only', 'event_only', 'private_rare', 'unknown'
    )),
  purchase_required boolean not null default false,
  purchase_note text,
  access_difficulty text
    check (access_difficulty in ('easy', 'medium', 'hard', 'nearly_impossible', 'invite_only', 'unknown')),
  access_notes text,

  -- Never selected by public RPCs / public RLS policies. Admin-only, for
  -- verification purposes. See README "Security/privacy notes".
  private_access_code text,
  access_code_public_allowed boolean not null default false,

  cost_type text check (cost_type in ('free', 'purchase_required', 'paid', 'unknown')),
  cost_amount numeric,

  gender_category text
    check (gender_category in ('male', 'female', 'all_gender', 'family', 'accessible', 'unknown')),
  toilet_type text
    check (toilet_type in ('sitting', 'squat', 'bidet', 'urinal_only', 'mixed', 'unknown')),

  -- Boolean amenity map, see src/constants/amenities.ts for the supported keys.
  amenities jsonb not null default '{}'::jsonb,
  -- Vibe tags, see src/constants/tags.ts for the supported values.
  tags text[] not null default '{}'::text[],
  open_hours jsonb not null default '{}'::jsonb,

  -- TODO(scores): MVP computes these via the update_bathroom_scores() RPC,
  -- called from the client after a review is created/edited. Move this to a
  -- database trigger or scheduled job once write volume justifies it.
  cleanliness_score numeric not null default 0,
  safety_score numeric not null default 0,
  privacy_score numeric not null default 0,
  smell_score numeric not null default 0,
  prestige_score numeric not null default 0,
  overall_score numeric not null default 0,
  review_count int not null default 0,
  photo_count int not null default 0,

  submitted_by uuid references profiles(id) on delete set null,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  last_verified_at timestamptz,

  -- Captured only at submission time, for admin plausibility checks
  -- ("is this submission near where they say the bathroom is?"). Never
  -- displayed publicly. See README privacy notes.
  submission_latitude double precision,
  submission_longitude double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table bathrooms is 'Core bathroom listing. Pending until an admin verifies it.';
comment on column bathrooms.private_access_code is 'Admin-only. Never returned by public RPCs or exposed via RLS to non-admins.';
comment on column bathrooms.submission_latitude is 'Submitter''s device location at submit time, admin-only plausibility signal. Not the bathroom location.';

-- ---------------------------------------------------------------------------
-- bathroom_photos: every photo starts in quarantine (is_public = false) and
-- only becomes public once an admin approves it. See README photo lifecycle.
-- ---------------------------------------------------------------------------
create table if not exists bathroom_photos (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid references bathrooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,

  storage_path text not null,
  public_url text,
  caption text,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_status text not null default 'pending_scan'
    check (moderation_status in (
      'pending_scan', 'scan_passed', 'scan_failed', 'needs_human_review', 'approved', 'rejected'
    )),
  moderation_provider text,
  moderation_result jsonb not null default '{}'::jsonb,
  rejection_reason text,

  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,

  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table bathroom_photos is 'Photo lifecycle: quarantine upload -> automated scan -> admin review -> public.';

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid references bathrooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,

  cleanliness int check (cleanliness between 1 and 5),
  safety int check (safety between 1 and 5),
  privacy int check (privacy between 1 and 5),
  smell int check (smell between 1 and 5),
  prestige int check (prestige between 1 and 5),
  overall int check (overall between 1 and 5),

  caption text,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- checkins: never automatic. Always an explicit user action.
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid references bathrooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  caption text,
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- saved_bathrooms
-- ---------------------------------------------------------------------------
create table if not exists saved_bathrooms (
  user_id uuid references profiles(id) on delete cascade,
  bathroom_id uuid references bathrooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bathroom_id)
);

-- ---------------------------------------------------------------------------
-- bathroom_lists (Letterboxd-style ranked/unranked lists)
-- ---------------------------------------------------------------------------
create table if not exists bathroom_lists (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  is_ranked boolean not null default true,
  cover_photo_url text,
  like_count int not null default 0,
  save_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bathroom_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references bathroom_lists(id) on delete cascade,
  bathroom_id uuid references bathrooms(id) on delete cascade,
  position int not null,
  note text,
  created_at timestamptz not null default now(),
  unique (list_id, bathroom_id)
);

create table if not exists bathroom_list_likes (
  user_id uuid references profiles(id) on delete cascade,
  list_id uuid references bathroom_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table if not exists saved_bathroom_lists (
  user_id uuid references profiles(id) on delete cascade,
  list_id uuid references bathroom_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

-- ---------------------------------------------------------------------------
-- reports: a report targets exactly one of bathroom/review/list/photo.
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid references bathrooms(id) on delete cascade,
  review_id uuid references reviews(id) on delete cascade,
  list_id uuid references bathroom_lists(id) on delete cascade,
  photo_id uuid references bathroom_photos(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  reason text,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_target_required check (
    bathroom_id is not null or review_id is not null or list_id is not null or photo_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- moderation_events: audit trail for admin actions.
-- ---------------------------------------------------------------------------
create table if not exists moderation_events (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid references bathrooms(id) on delete cascade,
  photo_id uuid references bathroom_photos(id) on delete cascade,
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

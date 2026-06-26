-- Lav: local/dev seed data
--
-- Run via `supabase db reset` (applies all migrations, then this file) or
-- `psql "$DB_URL" -f supabase/seed/seed.sql` against an already-migrated DB.
--
-- ASSUMPTION: auth.users / auth.identities are inserted directly with SQL
-- (the standard community pattern for local Supabase seed data - see
-- https://supabase.com/docs/guides/local-development/seeding-your-database).
-- This depends on GoTrue's current table shape. If your Supabase CLI version
-- has changed that schema and this section errors, create the 6 users below
-- through Supabase Studio's Auth UI (or `supabase.auth.admin.createUser`)
-- using the same emails, then re-run just the sections below the
-- "PROFILES" marker with the real generated user ids swapped in.
--
-- All seed users share the password: password123
--
-- City: Washington, DC (coordinates are real DC neighborhoods; venue names
-- are invented, not real businesses).

begin;

-- ---------------------------------------------------------------------------
-- AUTH USERS
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ian@lav.app', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ian"}', now() - interval '90 days', now() - interval '90 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'arman@lav.app', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Arman"}', now() - interval '90 days', now() - interval '90 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'jordan@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Jordan"}', now() - interval '60 days', now() - interval '60 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'priya@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Priya"}', now() - interval '55 days', now() - interval '55 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'max@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Max"}', now() - interval '40 days', now() - interval '40 days', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'sam@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Sam"}', now() - interval '30 days', now() - interval '30 days', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities
  (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '{"sub":"a0000000-0000-4000-8000-000000000001","email":"ian@lav.app"}', 'email', 'a0000000-0000-4000-8000-000000000001', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '{"sub":"a0000000-0000-4000-8000-000000000002","email":"arman@lav.app"}', 'email', 'a0000000-0000-4000-8000-000000000002', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', '{"sub":"a0000000-0000-4000-8000-000000000003","email":"jordan@example.com"}', 'email', 'a0000000-0000-4000-8000-000000000003', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', '{"sub":"a0000000-0000-4000-8000-000000000004","email":"priya@example.com"}', 'email', 'a0000000-0000-4000-8000-000000000004', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', '{"sub":"a0000000-0000-4000-8000-000000000005","email":"max@example.com"}', 'email', 'a0000000-0000-4000-8000-000000000005', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '{"sub":"a0000000-0000-4000-8000-000000000006","email":"sam@example.com"}', 'email', 'a0000000-0000-4000-8000-000000000006', now(), now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- PROFILES (rows already exist via the handle_new_user trigger - we just
-- fill in nicer usernames/bios/roles than the trigger's auto-generated ones)
-- ---------------------------------------------------------------------------
update profiles set username = 'ian', display_name = 'Ian', role = 'admin', trust_score = 100,
  bio = 'Co-builder of Lav. Connoisseur of hotel lobby restrooms.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=ian'
  where id = 'a0000000-0000-4000-8000-000000000001';

update profiles set username = 'arman', display_name = 'Arman', role = 'admin', trust_score = 100,
  bio = 'Co-builder of Lav. Will find the bathroom with no line.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=arman'
  where id = 'a0000000-0000-4000-8000-000000000002';

update profiles set username = 'jordan_dc', display_name = 'Jordan', role = 'user', trust_score = 12,
  bio = 'DC local. Campus bathroom historian.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=jordan'
  where id = 'a0000000-0000-4000-8000-000000000003';

update profiles set username = 'priya_eats', display_name = 'Priya', role = 'user', trust_score = 8,
  bio = 'Will rate the bathroom before the food.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=priya'
  where id = 'a0000000-0000-4000-8000-000000000004';

update profiles set username = 'max_walks', display_name = 'Max', role = 'user', trust_score = 5,
  bio = 'Professional walker of long distances to nicer bathrooms.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=max'
  where id = 'a0000000-0000-4000-8000-000000000005';

update profiles set username = 'sam_b', display_name = 'Sam', role = 'user', trust_score = 3,
  bio = 'New to Lav. Still figuring out the scoring system.',
  avatar_url = 'https://api.dicebear.com/7.x/notionists/png?seed=sam'
  where id = 'a0000000-0000-4000-8000-000000000006';

-- ---------------------------------------------------------------------------
-- BATHROOMS (11 verified + 1 pending submission)
-- ---------------------------------------------------------------------------

-- 1. Public restroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000001', 'Eastern Market Plaza Restroom', 'Eastern Market Plaza',
  'City-maintained public restroom right outside the market hall. Busy on weekends but turns over fast.',
  '225 7th St SE', 'Washington', 'DC', 'USA', 'Ground floor',
  38.8847, -76.9956, 'verified', 'public', false, 'easy', 'free',
  'all_gender', 'sitting',
  '{"toilet_paper": true, "soap": true, "hand_dryer": true, "wheelchair_accessible": true, "baby_changing": true}',
  array['clean','emergency_save'],
  '{"is_24_hours": false, "open": "07:00", "close": "20:00"}',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', now() - interval '80 days', now() - interval '10 days', now() - interval '85 days'
);

-- 2. Coffee shop restroom (purchase required, key-based)
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, purchase_note, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000002', 'Capitol Grounds Coffee', 'Capitol Grounds Coffee',
  'Single-occupancy restroom behind the espresso bar. Key on a giant wooden spoon, very on-brand.',
  '301 Pennsylvania Ave SE', 'Washington', 'DC', 'USA', '1',
  38.8857, -76.9942, 'verified', 'purchase_required', true, 'Must buy any menu item', 'easy', 'Ask the barista for the key after you order',
  'purchase_required', 'all_gender', 'sitting',
  '{"toilet_paper": true, "soap": true, "hand_dryer": true, "mirror": true}',
  array['clean','restaurant'],
  '{"is_24_hours": false, "open": "06:30", "close": "19:00"}',
  'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', now() - interval '70 days', now() - interval '20 days', now() - interval '75 days'
);

-- 3. Hotel lobby restroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000003', 'The Meridian Hotel Lobby', 'The Meridian Hotel',
  'Marble-and-brass restroom tucked past the lobby bar. Nobody checks if you''re a guest.',
  '1500 New Hampshire Ave NW', 'Washington', 'DC', 'USA', 'Lobby',
  38.9097, -77.0434, 'verified', 'ask_staff', false, 'easy', 'Walk in like you belong, restrooms are past the lobby bar', 'free',
  'all_gender', 'sitting',
  '{"mirror": true, "full_length_mirror": true, "soap": true, "hand_dryer": true, "paper_towels": true, "outlet": true}',
  array['hotel','luxury','elite','outfit_check'],
  '{"is_24_hours": true}',
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', now() - interval '65 days', now() - interval '5 days', now() - interval '70 days'
);

-- 4. Campus bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000004', 'Foggy Bottom University Student Center', 'University Student Center',
  '3rd floor restroom, usually empty between classes. Open to the public during building hours.',
  '800 21st St NW', 'Washington', 'DC', 'USA', '3',
  38.9000, -77.0481, 'verified', 'public', false, 'easy', 'free',
  'all_gender', 'mixed',
  '{"toilet_paper": true, "soap": true, "hand_dryer": true, "wheelchair_accessible": true, "tampons": true, "pads": true}',
  array['campus','emergency_save','no_line'],
  '{"is_24_hours": false, "open": "07:00", "close": "23:00"}',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', now() - interval '60 days', now() - interval '15 days', now() - interval '62 days'
);

-- 5. Luxury / private / rare bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000005', 'The Hayworth Society Club', 'The Hayworth Society Club',
  'Members-only social club. The restroom alone is worth the membership fee.',
  '1523 Wisconsin Ave NW', 'Washington', 'DC', 'USA', '2',
  38.9076, -77.0723, 'verified', 'private_rare', false, 'invite_only', 'Members-only; a member has to sign you in at the front desk', 'free',
  'all_gender', 'bidet',
  '{"bidet": true, "full_length_mirror": true, "mirror": true, "soap": true, "hand_dryer": true, "outlet": true, "touchless_flush": true, "touchless_sink": true, "coat_hook": true}',
  array['luxury','private_rare','elite','hidden_gem','bidet'],
  '{"is_24_hours": false, "open": "11:00", "close": "01:00"}',
  'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', now() - interval '50 days', now() - interval '8 days', now() - interval '55 days'
);

-- 6. Sketchy bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000006', 'Tunnel Station Mart Restroom', 'Tunnel Station Mart',
  'Behind the snack aisle. Bring your own paper towels.',
  '50 Massachusetts Ave NE', 'Washington', 'DC', 'USA', 'Ground floor',
  38.9026, -77.0048, 'verified', 'ask_staff', false, 'medium', 'Ask the cashier, sometimes the door is jammed', 'free',
  'unknown', 'unknown',
  '{}',
  array['sketchy','cursed'],
  '{"is_24_hours": true}',
  'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', now() - interval '45 days', now() - interval '45 days', now() - interval '48 days'
);

-- 7. Event-only bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000007', 'Capitol Block Party Pop-Up', 'Capitol Block Party (seasonal)',
  'Trailer restroom set up for ticketed events on the grounds. Nicer than you''d expect for a portable unit.',
  '200 Independence Ave SW', 'Washington', 'DC', 'USA', 'Ground level',
  38.8895, -77.0353, 'verified', 'event_only', false, 'medium', 'Only available during ticketed events; check the event page for restroom locations', 'free',
  'all_gender', 'unknown',
  '{"hand_dryer": true, "soap": true}',
  array['event_only'],
  '{"is_24_hours": false, "open": "varies", "close": "varies"}',
  'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', now() - interval '40 days', now() - interval '40 days', now() - interval '42 days'
);

-- 8. Accessible bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000008', 'National Mall Visitor Pavilion', 'Visitor Pavilion',
  'Full accessible stall with a fold-down changing table and plenty of turning room.',
  '1000 Jefferson Dr SW', 'Washington', 'DC', 'USA', 'Ground floor',
  38.8913, -77.0200, 'verified', 'public', false, 'easy', 'free',
  'accessible', 'sitting',
  '{"wheelchair_accessible": true, "baby_changing": true, "toilet_paper": true, "soap": true, "hand_dryer": true, "coat_hook": true, "sharps_disposal": true}',
  array['clean','hidden_gem'],
  '{"is_24_hours": false, "open": "08:00", "close": "17:30"}',
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', now() - interval '35 days', now() - interval '6 days', now() - interval '38 days'
);

-- 9. Purchase-required bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, purchase_note, access_difficulty, access_notes, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000009', 'Union Market Hall Restroom', 'Union Market Hall',
  'Shared restroom for the food hall. Door code changes weekly, printed on vendor receipts.',
  '1309 5th St NE', 'Washington', 'DC', 'USA', 'Ground floor',
  38.9088, -76.9988, 'verified', 'purchase_required', true, 'Buy anything from a vendor stall to get the code', 'medium', 'Code printed at the bottom of any vendor receipt, changes weekly', 'purchase_required',
  'all_gender', 'sitting',
  '{"soap": true, "hand_dryer": true, "toilet_paper": true, "mirror": true}',
  array['mall','restaurant'],
  '{"is_24_hours": false, "open": "08:00", "close": "20:00"}',
  'a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', now() - interval '30 days', now() - interval '30 days', now() - interval '33 days'
);

-- 10. Code-required bathroom (private_access_code is admin-only, never public)
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, access_notes, private_access_code, access_code_public_allowed, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000010', 'Velvet Hour Speakeasy', 'Velvet Hour',
  'Unmarked door next to the coat check. Worth the hunt.',
  '1100 U St NW', 'Washington', 'DC', 'USA', 'Basement',
  38.9169, -77.0286, 'verified', 'code_required', true, 'medium', 'Code is printed at the bottom of your receipt', '2580', false, 'purchase_required',
  'all_gender', 'sitting',
  '{"mirror": true, "full_length_mirror": true, "soap": true, "hand_dryer": true, "outlet": true}',
  array['luxury','elite','outfit_check','no_line'],
  '{"is_24_hours": false, "open": "18:00", "close": "02:00"}',
  'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', now() - interval '25 days', now() - interval '25 days', now() - interval '28 days'
);

-- 11. Bidet bathroom
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, purchase_note, access_difficulty, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by, verified_by, verified_at, last_verified_at, created_at)
values (
  'c0000000-0000-4000-8000-000000000011', 'Riverside Wellness Spa', 'Riverside Wellness Spa',
  'Day-pass spa on the waterfront. Heated bidet seats, eucalyptus towels, the works.',
  '99 Water St SW', 'Washington', 'DC', 'USA', '1',
  38.8765, -77.0047, 'verified', 'customer_only', true, 'Spa membership or day pass required', 'medium', 'purchase_required',
  'all_gender', 'bidet',
  '{"bidet": true, "touchless_flush": true, "touchless_sink": true, "full_length_mirror": true, "mirror": true, "soap": true, "hand_dryer": true, "outlet": true}',
  array['luxury','bidet','clean','hidden_gem'],
  '{"is_24_hours": false, "open": "09:00", "close": "21:00"}',
  'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', now() - interval '20 days', now() - interval '4 days', now() - interval '22 days'
);

-- 12. Pending submission (not yet verified - must not appear publicly).
-- submission_latitude/longitude simulate the submitter's GPS at submit time
-- for admin plausibility review; they are intentionally close-but-not-equal
-- to the claimed bathroom location.
insert into bathrooms (id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, access_difficulty, cost_type,
  gender_category, toilet_type, amenities, tags, open_hours, submitted_by,
  submission_latitude, submission_longitude, created_at)
values (
  'c0000000-0000-4000-8000-000000000012', 'Underground Container Park Restroom', 'Container Park Market',
  'New shipping-container food hall by the waterfront. Restroom is in the container at the far end.',
  '70 District Sq SW', 'Washington', 'DC', 'USA', 'Ground level',
  38.8761, -77.0102, 'pending', 'customer_only', true, 'easy', 'purchase_required',
  'all_gender', 'sitting',
  '{"soap": true, "hand_dryer": true}',
  array['mall'],
  '{"is_24_hours": false, "open": "11:00", "close": "22:00"}',
  'a0000000-0000-4000-8000-000000000003',
  38.8763, -77.0099, now() - interval '2 days'
);

-- ---------------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------------
insert into reviews (id, bathroom_id, user_id, cleanliness, safety, privacy, smell, prestige, overall, caption, visibility, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 5, 5, 4, 5, 3, 5, 'Cleaner than my apartment bathroom, no joke.', 'public', now() - interval '9 days'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 4, 4, 3, 4, 2, 4, 'Quick in and out, no line on a Tuesday.', 'public', now() - interval '8 days'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 4, 5, 4, 4, 3, 4, 'Worth the price of a coffee. Key on a giant spoon is a whole bit.', 'public', now() - interval '19 days'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 5, 5, 5, 5, 5, 5, 'Marble floors. Real hand towels. I felt like a guest of the hotel for ninety seconds.', 'public', now() - interval '4 days'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 5, 4, 4, 5, 5, 5, 'Walked past the bellhop like I owned the place.', 'public', now() - interval '3 days'),
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 3, 4, 3, 3, 2, 3, 'Standard campus bathroom energy but reliable.', 'public', now() - interval '14 days'),
  ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 4, 4, 4, 3, 2, 4, '3rd floor stall is the move, never a line.', 'public', now() - interval '13 days'),
  ('d0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 5, 5, 5, 5, 5, 5, 'If you know, you know. The bidet seat alone justifies the membership.', 'friends', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 5, 5, 5, 4, 5, 5, 'Got signed in by a member and instantly understood the hype.', 'public', now() - interval '6 days'),
  ('d0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005', 1, 2, 2, 1, 1, 1, 'Door barely locks. Smelled like the inside of a vacuum bag. Use only if desperate.', 'public', now() - interval '44 days'),
  ('d0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', 3, 3, 3, 3, 2, 3, 'Better than a port-a-potty, exactly what you''d expect from an event trailer.', 'public', now() - interval '39 days'),
  ('d0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 5, 5, 4, 4, 3, 5, 'Genuinely great accessible stall, plenty of room and always stocked.', 'public', now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000006', 3, 3, 3, 3, 2, 3, 'Code changes weekly so check your receipt, but it''s clean enough.', 'public', now() - interval '29 days'),
  ('d0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000002', 4, 4, 5, 4, 5, 5, 'The hunt for the door is half the experience. Receipt code is the other half.', 'public', now() - interval '24 days'),
  ('d0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000003', 4, 4, 4, 4, 4, 4, 'Surprisingly chill for how exclusive it feels.', 'public', now() - interval '23 days'),
  ('d0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005', 5, 5, 5, 5, 4, 5, 'Heated seat. Eucalyptus towels. I have ascended.', 'public', now() - interval '19 days');

-- ---------------------------------------------------------------------------
-- CHECKINS (always explicit - never automatic)
-- ---------------------------------------------------------------------------
insert into checkins (id, bathroom_id, user_id, caption, visibility, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'flex of the week', 'public', now() - interval '4 days'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'treat yourself', 'public', now() - interval '19 days'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'never again', 'private', now() - interval '44 days'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', null, 'public', now() - interval '9 days'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'members only, lol', 'friends', now() - interval '7 days'),
  ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000006', 'got the code off a receipt on the floor, don''t judge', 'public', now() - interval '29 days'),
  ('e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'the receipt code is the best part', 'public', now() - interval '23 days');

-- ---------------------------------------------------------------------------
-- LISTS + ITEMS
-- ---------------------------------------------------------------------------
insert into bathroom_lists (id, creator_id, title, description, visibility, is_ranked, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Cleanest Bathrooms in DC', 'The bathrooms that make you forget you''re in a major city.', 'public', true, now() - interval '30 days'),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Elite Date-Night Bathrooms', 'For when the bathroom needs to match the outfit.', 'public', true, now() - interval '25 days'),
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'Bathrooms You Can Use Without Buying Anything', 'Free is a feature.', 'public', false, now() - interval '20 days'),
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'Emergency Bathrooms Near Campus', 'For when class runs long and you can''t wait.', 'friends', true, now() - interval '15 days'),
  ('f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'Hidden Bathrooms With No Line', 'The ones nobody''s fighting you for.', 'private', false, now() - interval '10 days');

insert into bathroom_list_items (id, list_id, bathroom_id, position, note) values
  ('10000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 1, 'Surprisingly spotless for a public restroom'),
  ('10000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 2, 'Always stocked, always cold AC'),
  ('10000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000011', 3, 'Spa-clean, obviously'),
  ('10000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', 1, 'If your date can get you in here, marry them'),
  ('10000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000010', 2, 'Receipt code is half the charm'),
  ('10000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 3, 'Classic flex, zero risk'),
  ('10000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 1, null),
  ('10000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 2, null),
  ('10000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000008', 3, null),
  ('10000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 1, '3rd floor, never a line'),
  ('10000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 2, 'Buy a drip coffee, get the key'),
  ('10000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000009', 1, null),
  ('10000000-0000-4000-8000-000000000013', 'f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000007', 2, null);

insert into bathroom_list_likes (user_id, list_id) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000003');

insert into saved_bathroom_lists (user_id, list_id) values
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001');

insert into saved_bathrooms (user_id, bathroom_id) values
  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005'),
  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000010'),
  ('a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000011'),
  ('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003');

-- ---------------------------------------------------------------------------
-- PHOTOS
-- NOTE: public_url values point at picsum.photos placeholder images because
-- this seed script can only write Postgres rows, not real files into
-- Supabase Storage. storage_path values are illustrative of the upload
-- convention ({user_id}/{filename}) but do not correspond to real objects.
-- See README "Seed data" for how to test the real upload path.
-- ---------------------------------------------------------------------------
insert into bathroom_photos (id, bathroom_id, user_id, storage_path, public_url, caption, status, moderation_status, moderation_provider, moderation_result, reviewed_by, reviewed_at, created_at) values
  ('20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004/seed-eastern-market-1.jpg', 'https://picsum.photos/seed/lav-eastern-market/900/600', 'Empty stall, mid-morning', 'approved', 'approved', 'mock', '{"provider":"mock","flagged":false,"categories":{"adult":"VERY_UNLIKELY","racy":"UNLIKELY","violence":"VERY_UNLIKELY"}}', 'a0000000-0000-4000-8000-000000000001', now() - interval '9 days', now() - interval '9 days'),
  ('20000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001/seed-meridian-1.jpg', 'https://picsum.photos/seed/lav-meridian-hotel/900/600', 'The marble. The brass. Unreal.', 'approved', 'approved', 'mock', '{"provider":"mock","flagged":false,"categories":{"adult":"VERY_UNLIKELY","racy":"UNLIKELY","violence":"VERY_UNLIKELY"}}', 'a0000000-0000-4000-8000-000000000002', now() - interval '4 days', now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002/seed-hayworth-1.jpg', 'https://picsum.photos/seed/lav-hayworth-club/900/600', null, 'approved', 'approved', 'mock', '{"provider":"mock","flagged":false,"categories":{"adult":"VERY_UNLIKELY","racy":"VERY_UNLIKELY","violence":"VERY_UNLIKELY"}}', 'a0000000-0000-4000-8000-000000000001', now() - interval '6 days', now() - interval '6 days'),
  ('20000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005/seed-riverside-1.jpg', 'https://picsum.photos/seed/lav-riverside-spa/900/600', 'Heated seats are not a drill', 'approved', 'approved', 'mock', '{"provider":"mock","flagged":false,"categories":{"adult":"VERY_UNLIKELY","racy":"UNLIKELY","violence":"VERY_UNLIKELY"}}', 'a0000000-0000-4000-8000-000000000002', now() - interval '19 days', now() - interval '19 days'),
  ('20000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006/seed-tunnel-1.jpg', null, 'idk man', 'pending', 'needs_human_review', 'mock', '{"provider":"mock","flagged":true,"reasons":["possible_occupied_stall"],"categories":{"adult":"UNLIKELY","racy":"POSSIBLE","violence":"VERY_UNLIKELY"}}', null, null, now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- MODERATION EVENTS (admin audit trail)
-- ---------------------------------------------------------------------------
insert into moderation_events (id, bathroom_id, photo_id, admin_id, action, notes, created_at) values
  ('30000000-0000-4000-8000-000000000001', null, '20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'approve_photo', 'Matches venue, no people visible.', now() - interval '9 days'),
  ('30000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000009', null, 'a0000000-0000-4000-8000-000000000002', 'verify_bathroom', 'Confirmed address and code policy with vendor.', now() - interval '30 days');

-- ---------------------------------------------------------------------------
-- REPORTS
-- ---------------------------------------------------------------------------
insert into reports (id, bathroom_id, user_id, reason, details, status, created_at) values
  ('40000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000004', 'inaccurate_info', 'Side entrance is closed now, you have to ask the cashier directly.', 'open', now() - interval '3 days');

-- ---------------------------------------------------------------------------
-- Recompute aggregate scores from the seeded reviews above, exactly the way
-- the client does after a real review is submitted (see update_bathroom_scores
-- in 0005_rpc_functions.sql).
-- ---------------------------------------------------------------------------
do $$
declare
  b record;
begin
  for b in select id from bathrooms where status = 'verified' loop
    perform update_bathroom_scores(b.id);
  end loop;
end $$;

commit;

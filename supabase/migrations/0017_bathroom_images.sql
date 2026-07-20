-- Lav: bathroom_images - simple public review/showcase photos
--
-- Deliberately NOT the existing bathroom_photos/bathroom-photo-quarantine
-- pipeline (0007_storage.sql), which is a full moderated lifecycle (private
-- quarantine upload -> automated scan -> admin review -> public). That one
-- stays exactly as-is for whatever future moderated-upload flow needs it.
-- This is the new, simpler "attach a photo to your rating, or just add one
-- from the bathroom's Action Panel" flow the rating engine calls for: straight
-- to a public bucket, no quarantine or admin step. review_id is nullable
-- because "Add Photo" is its own Action Panel button, separate from "Rate &
-- Log" - a photo doesn't have to be attached to a rating.
create table if not exists bathroom_images (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  review_id uuid references bathroom_reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  created_at timestamptz not null default now()
);

comment on table bathroom_images is 'Unmoderated, public user-submitted bathroom photos - powers the detail screen''s media carousel. See bathroom_photos storage bucket below for the backing files.';

create index if not exists bathroom_images_bathroom_id_idx on bathroom_images (bathroom_id);
create index if not exists bathroom_images_user_id_idx on bathroom_images (user_id);
create index if not exists bathroom_images_review_id_idx on bathroom_images (review_id);

alter table bathroom_images enable row level security;

create policy "bathroom_images_select_all_authenticated"
  on bathroom_images for select
  to authenticated
  using (true);

create policy "bathroom_images_insert_own"
  on bathroom_images for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "bathroom_images_delete_own"
  on bathroom_images for delete
  to authenticated
  using (user_id = auth.uid());

-- Storage bucket: public read (same reasoning as avatars - these photos
-- aren't sensitive), owner-only write, {user_id}/{filename} folder-ownership
-- convention matching every other bucket in this project.
insert into storage.buckets (id, name, public)
values ('bathroom_photos', 'bathroom_photos', true)
on conflict (id) do nothing;

create policy "bathroom_photos_bucket_select_all"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'bathroom_photos');

create policy "bathroom_photos_bucket_select_anon"
  on storage.objects for select
  to anon
  using (bucket_id = 'bathroom_photos');

create policy "bathroom_photos_bucket_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bathroom_photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bathroom_photos_bucket_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bathroom_photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

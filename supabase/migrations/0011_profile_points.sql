-- Lav: profile points
--
-- Gamification counter, separate from trust_score (which is a
-- content-moderation signal, not an engagement score). Same protection
-- pattern as trust_score: only the backend should ever change this (e.g. a
-- future "award points for a verified submission" RPC/trigger), so it's
-- revoked from client UPDATEs the same way.
alter table profiles add column if not exists points integer not null default 0;

revoke update (points) on profiles from authenticated;

comment on column profiles.points is 'Gamification/engagement score. Not user-editable - see trust_score for the separate moderation-trust signal.';

-- Voice preference now lives on the profile, not on the Mac's local
-- UserDefaults: the website is the single source of truth so it can be
-- toggled from any device (mobile browser included), and the Mac companion
-- just reads it back on each heartbeat.
alter table public.profiles
  add column voice_responses_enabled boolean not null default true;

-- So the toggle takes effect live across tabs/devices (website speaking its
-- own "ask" responses, in particular) without a page refresh.
alter publication supabase_realtime add table public.profiles;

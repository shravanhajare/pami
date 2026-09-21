create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default 'macos',
  os_version text,
  agent_version text,
  token_hash text unique not null,
  pairing_code text unique,
  pairing_expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'trusted', 'revoked')),
  state text not null default 'offline'
    check (state in (
      'offline', 'standby', 'activated', 'listening', 'thinking',
      'executing', 'waiting_for_approval', 'completed', 'paused'
    )),
  last_seen_at timestamptz,
  paired_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.devices enable row level security;

-- Browser reads are RLS-enforced. All other device-row writes (pairing,
-- heartbeat, state updates) go through Edge Functions using the service-role
-- key — see supabase/functions/. The one write the browser is allowed to make
-- directly is revoking a device it owns.
create policy "select own devices" on public.devices
  for select using (auth.uid() = user_id);

create policy "user can revoke own devices" on public.devices
  for update using (auth.uid() = user_id)
  with check (status = 'revoked');

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  agent_version text,
  os_version text
);

alter table public.device_sessions enable row level security;

create policy "select own device sessions" on public.device_sessions
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.devices;

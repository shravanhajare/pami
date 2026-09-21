create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id),
  source text not null default 'web'
    check (source in ('web', 'mac', 'voice', 'mobile')),
  type text not null default 'manual_activation',
  title text not null default 'Activate PAMI',
  status text not null default 'pending'
    check (status in (
      'pending', 'acknowledged', 'in_progress', 'waiting_for_approval',
      'completed', 'failed', 'cancelled'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "select own tasks" on public.tasks
  for select using (auth.uid() = user_id);

create policy "insert own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

-- No client update policy: status transitions happen via the device-token
-- authenticated device-task-ack Edge Function (service role).

alter publication supabase_realtime add table public.tasks;

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_index int not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  level text not null default 'info'
    check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

-- Scaffolded per the project's DB mandate; left unused until their own
-- future milestones (approval workflows, tool execution).
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  requested_action jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  tool_name text not null,
  input jsonb,
  output jsonb,
  status text,
  created_at timestamptz not null default now()
);

alter table public.task_steps enable row level security;
alter table public.task_events enable row level security;
alter table public.task_logs enable row level security;
alter table public.approvals enable row level security;
alter table public.tool_calls enable row level security;

create policy "select own task steps" on public.task_steps
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy "select own task events" on public.task_events
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy "select own task logs" on public.task_logs
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy "select own approvals" on public.approvals
  for select using (auth.uid() = user_id);

create policy "select own tool calls" on public.tool_calls
  for select using (
    exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );

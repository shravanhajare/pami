-- Web Push subscriptions (one row per browser/device that opted in), so
-- an approval request created by the Mac (device-request-approval) can push
-- a notification straight to the phone instead of waiting for the dashboard
-- to be opened and checked.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Browser writes its own subscription directly (RLS-enforced); the Edge
-- Function that sends the actual push uses the service-role key and reads
-- across users as needed, same pattern as devices/tasks.
create policy "select own push subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "insert own push subscriptions" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "delete own push subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════
-- Astrovia — Supabase schema
-- Run this once in the Supabase SQL editor when you provision the project.
-- It creates the astrology profile table (name, email + birth details)
-- with row-level security and auto-creation on signup.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Profiles: mirrors the app's users + birth_charts essentials ──────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text,
  email           text unique,
  birth_date      date,                     -- e.g. 1990-04-15
  birth_time      time,                     -- e.g. 08:30 (24h, local birth time)
  birth_location  text,                     -- human-readable place name
  birth_lat       double precision,
  birth_lng       double precision,
  birth_timezone  text,                     -- IANA zone, e.g. Asia/Kolkata
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'Astrovia user profiles: identity + birth details for chart computation';

-- ── Updated-at touch trigger ──────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Auto-create profile on signup (picks up Google full_name too) ────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row level security: users own exactly their profile ──────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ── Optional: birth charts table (full app parity, extend later) ─────────
create table if not exists public.birth_charts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default 'Chart',
  birth_date    date not null,
  birth_time    time not null,
  place_name    text,
  lat           double precision not null,
  lng           double precision not null,
  timezone      text not null,
  chart_data    jsonb,                       -- full computed chart snapshot
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.birth_charts enable row level security;

drop policy if exists "charts_all_own" on public.birth_charts;
create policy "charts_all_own"
  on public.birth_charts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

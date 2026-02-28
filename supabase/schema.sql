-- Seal — Supabase Schema
-- Run this in your Supabase SQL editor or via supabase db push

-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- One row per authenticated user.
-- The server stores the RSA public key in plaintext (needed to encrypt files for the user).
-- The private key is stored only as an encrypted blob; the server never sees the raw key.
create table if not exists public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text not null unique,
  public_key                  text,                       -- base64 SPKI-encoded RSA public key
  encrypted_private_key_blob  text,                       -- JSON: { encryptedKey, iv, salt } all base64
  salt                        text,                       -- base64 PBKDF2 salt (also inside blob, kept here for convenience)
  created_at                  timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

-- Anyone authenticated can read another user's public_key and email (needed to encrypt files for them)
create policy "profiles: read public key of others"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can insert their own profile (on key setup)
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Users can update their own profile (key recovery / re-upload)
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── Contacts ─────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  contact_email       text not null,
  contact_public_key  text,
  created_at          timestamptz default now(),
  unique (user_id, contact_email)
);

alter table public.contacts enable row level security;

-- Users can only see their own contacts
create policy "contacts: read own"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "contacts: insert own"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "contacts: update own"
  on public.contacts for update
  using (auth.uid() = user_id);

create policy "contacts: delete own"
  on public.contacts for delete
  using (auth.uid() = user_id);

-- ─── Trigger: auto-create profile on signup ───────────────────────────────────
-- Creates a minimal profile row when a new user signs up.
-- The public_key and encrypted_private_key_blob are filled in later during key setup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

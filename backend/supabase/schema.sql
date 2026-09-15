create extension if not exists pgcrypto;

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  tse_id text not null,
  ballot_name text not null,
  ballot_number text not null,
  party_name text,
  party_initials text,
  office text not null check (office in ('prefeito', 'vice-prefeito', 'vereador', 'governador', 'presidente')),
  status text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tse_id, office)
);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  office text not null check (office in ('prefeito', 'vice-prefeito', 'vereador', 'governador', 'presidente')),
  fingerprint_hash text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (fingerprint_hash, office)
);

create table if not exists campaign_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sponsor_name text not null,
  sponsor_document text not null,
  body text not null,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  office text,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);

create or replace view poll_results as
select
  c.id as candidate_id,
  c.ballot_name,
  c.ballot_number,
  c.party_initials,
  c.office,
  count(v.id)::integer as votes
from candidates c
left join poll_votes v on v.candidate_id = c.id
group by c.id, c.ballot_name, c.ballot_number, c.party_initials, c.office;

alter table poll_votes add column if not exists office text;
alter table poll_votes drop constraint if exists poll_votes_fingerprint_hash_key;

alter table candidates enable row level security;
alter table poll_votes enable row level security;
alter table campaign_ads enable row level security;
alter table sync_logs enable row level security;



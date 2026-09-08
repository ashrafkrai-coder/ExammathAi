-- =====================================================================
-- Exam Matematik SPM - Skema Bank Rujukan Supabase
-- Jalankan fail ini dalam Supabase SQL Editor (Project > SQL Editor).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. math_reference_sources
-- ---------------------------------------------------------------------
create table if not exists math_reference_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference_type text,
  tingkatan smallint check (tingkatan in (4,5)),
  tajuk text not null,
  subtajuk text,
  original_text text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. math_reference_chunks
-- ---------------------------------------------------------------------
create table if not exists math_reference_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references math_reference_sources(id) on delete cascade,
  chunk_no integer not null,
  title text,
  content text not null,
  keywords text[] default '{}',
  created_at timestamptz default now(),
  unique (source_id, chunk_no)
);

-- ---------------------------------------------------------------------
-- 3. math_question_examples
-- ---------------------------------------------------------------------
create table if not exists math_question_examples (
  id uuid primary key default gen_random_uuid(),
  tingkatan smallint check (tingkatan in (4,5)),
  tajuk text,
  question_text text,
  options jsonb,
  correct_answer text,
  working_text text,
  source_id uuid references math_reference_sources(id),
  approved boolean default true,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Indeks
-- ---------------------------------------------------------------------
create index if not exists idx_sources_tingkatan on math_reference_sources (tingkatan);
create index if not exists idx_sources_tajuk on math_reference_sources (tajuk);
create index if not exists idx_sources_is_active on math_reference_sources (is_active);
create index if not exists idx_sources_tingkatan_tajuk_active
  on math_reference_sources (tingkatan, tajuk, is_active);

create index if not exists idx_chunks_source_id on math_reference_chunks (source_id);

create index if not exists idx_examples_tingkatan on math_question_examples (tingkatan);
create index if not exists idx_examples_tajuk on math_question_examples (tajuk);

-- ---------------------------------------------------------------------
-- updated_at trigger untuk math_reference_sources
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sources_updated_at on math_reference_sources;
create trigger trg_sources_updated_at
  before update on math_reference_sources
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- Rujukan adalah SULIT: hanya server (service_role, yang memintas RLS)
-- boleh membaca jadual ini. anon & authenticated TIDAK diberi apa-apa
-- polisi, jadi PostgREST akan menyekat semua baris bagi kedua-dua peranan.
-- ---------------------------------------------------------------------
alter table math_reference_sources enable row level security;
alter table math_reference_chunks enable row level security;
alter table math_question_examples enable row level security;

-- Tiada polisi dicipta untuk anon/authenticated dengan sengaja (default-deny).

revoke all on math_reference_sources from anon, authenticated;
revoke all on math_reference_chunks from anon, authenticated;
revoke all on math_question_examples from anon, authenticated;

-- service_role Supabase memintas RLS secara automatik dan digunakan
-- hanya oleh fungsi Vercel (api/*.js) melalui SUPABASE_SECRET_KEY.

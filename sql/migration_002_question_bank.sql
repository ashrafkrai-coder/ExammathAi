-- =====================================================================
-- Exam Matematik SPM - Migrasi 002: Bank Soalan (guna semula + tanpa ulang)
-- Jalankan fail ini dalam Supabase SQL Editor SELEPAS sql/schema.sql.
--
-- Tujuan: setiap soalan yang berjaya dijana AI disimpan automatik ke
-- math_question_examples. Permintaan janaan seterusnya akan cuba ambil
-- soalan sedia ada daripada bank ini dahulu (bagi Tingkatan+Tajuk+Tahap
-- yang sepadan dan belum pernah dilihat oleh guru berkenaan) sebelum
-- memanggil AI untuk baki yang diperlukan - menjadikan janaan lebih
-- pantas dan tetap berfungsi walaupun AI sedang sibuk/gagal sementara.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lajur tambahan pada math_question_examples untuk padanan bank
-- ---------------------------------------------------------------------
alter table math_question_examples
  add column if not exists tahap text check (tahap in ('mudah','sederhana','sukar')),
  add column if not exists bilangan_pilihan smallint default 4;

create index if not exists idx_examples_bank_lookup
  on math_question_examples (tingkatan, tajuk, tahap, approved);

-- ---------------------------------------------------------------------
-- 2. math_question_usage - jejak soalan bank yang telah diberikan
--    kepada setiap guru (elak ulangan soalan yang sama kepada guru sama)
-- ---------------------------------------------------------------------
create table if not exists math_question_usage (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  question_id uuid not null references math_question_examples(id) on delete cascade,
  used_at timestamptz default now(),
  unique (teacher_id, question_id)
);

create index if not exists idx_usage_teacher on math_question_usage (teacher_id);

-- ---------------------------------------------------------------------
-- Row Level Security - sama seperti jadual lain: hanya server
-- (service_role melalui SUPABASE_SECRET_KEY) boleh mengakses.
-- ---------------------------------------------------------------------
alter table math_question_usage enable row level security;
revoke all on math_question_usage from anon, authenticated;

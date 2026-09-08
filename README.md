# Exam Matematik SPM

PWA untuk guru menjana set soalan Matematik Tingkatan 4 & 5, berpandukan
Bank Rujukan yang disimpan dalam Supabase. AI hanya dibenarkan menjana
soalan berdasarkan rujukan yang sepadan (Tingkatan + Tajuk) — tiada
rekaan fakta/formula di luar rujukan. Akses dikawal oleh log masuk guru
(Supabase Auth) — tiada siapa boleh menjana soalan tanpa log masuk.

**Status semasa: BELUM DIDEPLOY.** Ini adalah pratonton tempatan sahaja,
mengikut arahan supaya tidak deploy sehingga diminta.

## 1. Senarai fail

```
index.html                    Halaman log masuk + halaman utama PWA
manifest.json                 Manifest PWA (ikon, tema, standalone)
sw.js                          Service worker (cache app-shell, bukan /api/*)
css/style.css                  Semua gaya (tema Navy Akademik + Biru Elektrik + Emas)
js/auth.js                     Log masuk/keluar guru (Supabase Auth), gate akses ke aplikasi
js/app.js                      Logik UI: tab, tetapan, kelompok jana soalan, progress, simpanan
js/docxExport.js               Eksport set soalan kepada fail .docx sebenar (pustaka `docx` via CDN)
icons/icon-192.png             Ikon PWA 192x192 (dijana skrip, tiada dependensi luar)
icons/icon-512.png             Ikon PWA 512x512
icons/icon-maskable-512.png    Ikon "maskable" untuk Android

api/generate.js               Fungsi Vercel: /api/generate (jana SATU kelompok soalan) — perlu log masuk
api/topics.js                  Fungsi Vercel: /api/topics (senarai tajuk aktif ikut Tingkatan) — perlu log masuk
api/status.js                  Fungsi Vercel: /api/status (status Supabase & kunci API, boolean sahaja) — awam
api/config.js                   Fungsi Vercel: /api/config (URL + kunci publishable Supabase — selamat didedahkan) — awam

lib/supabaseAdmin.js           Klien Supabase (kunci secret) — sisi-server sahaja
lib/verifyAuth.js               Sahkan token log masuk guru (JWT) terhadap SUPABASE_JWKS_URL
lib/referenceContext.js        Baca sources + chunks aktif, susun jadi konteks AI
lib/promptBuilder.js           Bina system/user prompt (Bahasa Melayu, format JSON wajib)
lib/aiProviders.js             Pemanggil Gemini + had kelompok & timeout
lib/questionValidator.js       Sahkan output JSON AI (bilangan tepat, pilihan lengkap, dsb.)
lib/validateInput.js           Sahkan input permintaan /api/generate & /api/topics
lib/httpShim.js                 res.status().json() gaya-Vercel (dikongsi devServer + ujian)

sql/schema.sql                  Skema Supabase penuh: 3 jadual, RLS, indeks, revoke anon/authenticated

scripts/devServer.js            Pelayan pratonton TEMPATAN (bukan untuk deploy)
scripts/generateIcons.js         Skrip penjana ikon PNG (zlib terbina-dalam sahaja)

tests/*.test.js                  Ujian automatik (node --test) — termasuk ujian log masuk/JWT
.env.example                    Templat pembolehubah persekitaran (tiada nilai sebenar)
```

## 2. Tetapan Supabase

1. Buka projek Supabase anda > **SQL Editor**, dan jalankan kandungan
   penuh [sql/schema.sql](sql/schema.sql). Ini akan:
   - Cipta jadual `math_reference_sources`, `math_reference_chunks`, `math_question_examples`.
   - Aktifkan Row Level Security pada ketiga-tiga jadual **tanpa** polisi
     untuk `anon`/`authenticated` (default-deny) + `revoke all`.
   - Cipta indeks pada `tingkatan`, `tajuk`, `is_active`.

   > **Nota:** kunci `sb_secret_...`/`sb_publishable_...` (kunci API projek)
   > TIDAK boleh menjalankan `CREATE TABLE` — ia hanya untuk akses data
   > (PostgREST), bukan DDL/skema. Skema mesti dijalankan melalui SQL
   > Editor Supabase (atau sambungan Postgres terus dengan kata laluan
   > pangkalan data, bukan kunci API projek).

2. Masukkan bahan rujukan terus ke `math_reference_sources` &
   `math_reference_chunks` melalui Supabase Table Editor / SQL — bukan
   melalui PWA (PWA sengaja tidak mempunyai paparan upload rujukan).
   Pastikan `is_active = true` untuk rujukan yang mahu tersedia dalam
   dropdown Tajuk.
3. Cipta akaun guru di **Authentication > Users** (Supabase Dashboard) —
   e-mel + kata laluan. Tiada borang daftar awam disediakan dalam PWA
   ini; pentadbir sistem yang mencipta akaun guru.

## 3. Pembolehubah persekitaran

Salin `.env.example` kepada `.env` dan isikan nilai sebenar:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...              # RAHSIA — jangan dedahkan
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...     # selamat didedahkan di pelayar
SUPABASE_JWKS_URL=https://xxxxx.supabase.co/auth/v1/.well-known/jwks.json
GEMINI_API_KEY=...
```

- `SUPABASE_SECRET_KEY` — kunci "secret" (pengganti moden `service_role`
  key lama). Dibaca HANYA oleh `lib/supabaseAdmin.js` di sisi pelayan
  untuk membaca Bank Rujukan. Tidak pernah dihantar ke pelayar.
- `SUPABASE_PUBLISHABLE_KEY` — kunci "publishable" (pengganti moden
  `anon` key lama). Direka untuk didedahkan di sisi klien (seperti
  kunci publishable Stripe) — dihantar ke pelayar melalui `/api/config`
  supaya `js/auth.js` boleh memanggil terus endpoint log masuk Supabase
  Auth (`/auth/v1/token`).
- `SUPABASE_JWKS_URL` — digunakan oleh `lib/verifyAuth.js` untuk
  mengesahkan token sesi guru (JWT) sebelum membenarkan `/api/generate`
  atau `/api/topics` berjalan. Jika ditinggalkan kosong, ia diterbitkan
  secara automatik daripada `SUPABASE_URL`.

Aplikasi ini hanya menyokong Gemini sebagai penyedia AI. Tab **Tetapan
API** dalam PWA akan menunjukkan status Gemini (Bersedia / Belum
Ditetapkan) berdasarkan `GEMINI_API_KEY`. `SUPABASE_SECRET_KEY` dan
`GEMINI_API_KEY` **tidak pernah** dihantar ke pelayar — hanya dibaca
oleh `api/*.js` di sisi pelayan.

## 4. Jalankan pratonton tempatan

```bash
npm install
npm run dev
```

Buka **http://localhost:3000** di pelayar. Anda akan melihat skrin log
masuk terlebih dahulu — log masuk dengan akaun guru yang dicipta di
langkah 2.3.

`npm run dev` menjalankan `scripts/devServer.js` — pelayan Node ringan
(tiada pergantungan luaran) yang memuatkan `.env` secara automatik,
menyajikan fail statik (`index.html`, `css/`, `js/`, ikon) dan
menjalankan kod **sebenar** `api/*.js` (bukan tiruan) menggunakan bentuk
`req.query` / `req.body` / `res.status().json()` yang sama seperti
Vercel. Ini bukan langkah deploy — semata-mata untuk ujian di komputer
ini sebelum arahan "deploy" diberikan.

## 5. Jalankan ujian automatik

```bash
npm test
```

28 ujian (`node --test`) merangkumi:

- Tingkatan 4 dengan 10 soalan (Gemini, 1 kelompok) — berjaya.
- Tingkatan 5 dengan 40 soalan (Gemini, 4 kelompok maksimum 10/kelompok) — berjaya, digabung tepat 40.
- Tiada bahan rujukan untuk Tingkatan+Tajuk dipilih — ralat mesra 404.
- Kunci API penyedia AI belum ditetapkan — ralat mesra 400.
- AI mengembalikan kurang soalan daripada diminta — proses dihentikan, ralat 422, tiada hasil separa dipaparkan.
- `/api/generate` & `/api/topics` menolak permintaan tanpa log masuk, atau dengan token tamat tempoh (401).
- Pengesahan token JWT (`lib/verifyAuth.js`) terhadap JWKS sebenar (kunci sah, kunci lain, token tamat tempoh, header hilang/format salah).
- Pengesahan input (`/api/generate`, `/api/topics`) — pelbagai kes tidak sah.
- Pengesahan & penghuraian JSON daripada AI (`questionValidator`) — pelbagai kes rosak/tidak lengkap.

Ujian menggunakan `fetch` palsu (lihat `tests/helpers/fakeFetch.js`) bagi
panggilan Supabase/AI, dan satu pelayan HTTP tempatan sebenar (loopback,
lihat `tests/helpers/testAuth.js`) bagi JWKS — kerana `jose` (pustaka
pengesahan JWT) menggunakan modul `http`/`https` Node terus, bukan
`fetch`. Tiada panggilan rangkaian luaran sebenar semasa `npm test`.

UI turut diuji secara visual (desktop ~1280–1400px & mobile ~390px)
menggunakan Chromium automatik dengan Supabase Auth ditiru (mock): skrin
log masuk (kosong, kata laluan salah, kata laluan betul), sesi berterusan
selepas muat semula halaman, log keluar, navigasi tab, ralat mesra bila
Supabase/API belum ditetapkan, dan laluan penuh log masuk → menjana →
papar soalan (dengan LaTeX/KaTeX) → tunjuk jawapan/langkah kerja →
simpan → eksport Word (.docx sebenar, disahkan saiz fail) → salin ke
papan klip — tiada ralat JavaScript console/null/undefined dikesan.

## 6. Alur kerja log masuk

1. `js/auth.js` memuatkan `/api/config` (URL + kunci publishable
   Supabase — selamat didedahkan) dan menyemak sesi tersimpan
   (`localStorage`). Jika sah/masih segar, aplikasi terus dibuka.
2. Jika tiada sesi, skrin log masuk dipaparkan. Guru masukkan e-mel +
   kata laluan → `js/auth.js` memanggil terus
   `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` (Supabase
   Auth/GoTrue) menggunakan kunci publishable.
3. Token sesi (access + refresh token) disimpan dalam `localStorage`
   pelayar (peranti ini sahaja). `js/app.js` (dimuatkan secara dinamik
   HANYA selepas log masuk berjaya) menyertakan token ini sebagai header
   `Authorization: Bearer ...` pada setiap panggilan `/api/generate` &
   `/api/topics`.
4. Pelayan (`lib/verifyAuth.js`) mengesahkan token tersebut terhadap
   `SUPABASE_JWKS_URL` (kunci awam sahaja — tiada rahsia terlibat) bagi
   setiap permintaan. Token tiada/tidak sah/tamat tempoh → ralat mesra
   401 dikembalikan dan permintaan ditolak.
5. Butang **Log Keluar** (header) membersihkan sesi tempatan dan
   memberitahu Supabase Auth, lalu memuat semula ke skrin log masuk.

## 7. Alur kerja penjanaan soalan (ringkasan)

1. Guru pilih Tingkatan, Tajuk (dropdown dibaca terus daripada Supabase
   melalui `/api/topics`), Tahap, Bilangan Soalan, Bilangan Pilihan, dan
   Penyedia AI.
2. Klik **Jana Soalan**. Frontend membahagikan jumlah soalan kepada
   beberapa kelompok mengikut had Gemini (maks 10 setiap kelompok), dan
   memanggil `/api/generate` sekali bagi setiap kelompok secara
   berurutan.
3. Kad kemajuan memaparkan bar animasi bergaya shimmer, peratus besar,
   `X / Y soalan siap`, dan status `Menjana soalan A hingga B`.
4. Setiap panggilan `/api/generate`:
   - Membaca rujukan aktif (`math_reference_sources` + `math_reference_chunks`) bagi Tingkatan+Tajuk. Jika tiada, ralat 404 mesra dipaparkan dan proses dihentikan.
   - Menghantar HANYA konteks rujukan tersebut kepada AI (tiada silibus/fail luaran).
   - Mengesahkan JSON yang dikembalikan AI: bilangan soalan tepat, pilihan lengkap, jawapan sah, ada langkah kerja.
   - Jika tidak sah/tidak cukup, ralat jelas dikembalikan dan **seluruh proses dihentikan** — tiada hasil separa dipaparkan.
5. Apabila semua kelompok berjaya dan jumlah akhir == jumlah diminta,
   hasil dipaparkan dalam kad soalan (dengan suis Tunjuk/Sembunyi
   Jawapan & Langkah Kerja), boleh disimpan (localStorage), dicetak,
   dieksport ke Word (.docx sebenar), atau disalin.

## 8. Nota reka bentuk (UI)

Tema dikemas kini kepada **Navy Akademik + Biru Elektrik + Putih + Emas**
(`#14213D` / `#2563EB` / `#F4B942`) dengan fon `Inter` + `Plus Jakarta
Sans`, banner hero dengan simbol Matematik halus di latar, kad kemajuan
bergaya shimmer, dan lencana tahap kesukaran berwarna. Semua ID elemen
dan fungsi `js/app.js` sedia ada dikekalkan — hanya `index.html` dan
`css/style.css` yang dikemas kini untuk reka bentuk ini (kecuali dua
baris kecil di `js/app.js` untuk header `Authorization` dan trigger
init yang selamat dimuatkan selepas log masuk, dan `js/auth.js` yang
baharu untuk log masuk).

Dua penyesuaian sengaja daripada spesifikasi asal reka bentuk (bagi
mengelak mengubah logik `js/app.js`):
- **Tingkatan** kekal sebagai dropdown bergaya (bukan segmented control
  sebenar) — segmented control memerlukan JS tambahan untuk
  menyegerakkan nilai dengan `#fTingkatan`.
- **Bilangan Soalan** kekal sebagai dropdown (bukan slider) — nilai
  yang dibenarkan (5/10/15/20/30/40) tidak sekata, jadi slider asli
  memerlukan pemetaan indeks→nilai melalui JS tambahan.

## 9. Nota keselamatan

- `SUPABASE_SECRET_KEY` hanya wujud dalam pembolehubah persekitaran
  pelayan — tidak pernah di HTML/JS frontend.
- `SUPABASE_PUBLISHABLE_KEY` selamat didedahkan di pelayar (seperti
  kunci publishable Stripe) — ia hanya boleh memulakan log masuk, bukan
  membaca data terus (jadual rujukan tidak memberi akses kepada
  `anon`/`authenticated`, lihat di bawah).
- `/api/generate` dan `/api/topics` menolak sebarang permintaan tanpa
  token sesi guru yang sah (disahkan terhadap `SUPABASE_JWKS_URL`).
- Jadual rujukan (`math_reference_sources`, `math_reference_chunks`,
  `math_question_examples`) mempunyai RLS diaktifkan tanpa polisi untuk
  `anon`/`authenticated`, ditambah `revoke all` — hanya kunci `secret`
  (dipintas RLS secara automatik oleh Supabase, digunakan hanya oleh
  `lib/supabaseAdmin.js`) boleh membacanya.
- Tiada paparan upload fail/silibus/rujukan disediakan dalam PWA ini
  seperti diarahkan — semua rujukan dimasukkan terus ke Supabase oleh
  guru/pentadbir.
- Tiada borang daftar akaun awam — akaun guru dicipta oleh pentadbir
  melalui Supabase Dashboard sahaja.

## 10. Jangan deploy dahulu

Seperti arahan, projek ini **belum di-deploy** ke Vercel. Apabila anda
sudah bersedia dan memberi arahan "deploy", langkah seterusnya ialah
`vercel link` + `vercel env add` (untuk setiap pembolehubah dalam
`.env.example`) + `vercel deploy --prod`.

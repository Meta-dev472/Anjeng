# AGENTS.md — Panduan Kerja untuk Agen AI

Dokumen ini menjelaskan **cara proyek ini bekerja** supaya agen AI (atau kontributor baru) bisa
langsung produktif tanpa menebak-nebak. Bacalah bagian **Aturan Wajib** dan **Jebakan** sebelum
mengubah apa pun.

---

## 1. Apa ini

Website resmi **OSIS SMK Texar Karawang**. Satu situs statis (tanpa backend, tanpa API, tanpa
database) berisi 16 halaman + 404 yang terasa seperti SPA.

| Aspek | Keputusan |
|---|---|
| Bahasa konten | Indonesia (semua komentar kode juga Indonesia) |
| Pola arsitektur | **MPA** — tiap route punya file HTML sungguhan (URL & SEO asli) |
| Rasa SPA | **Swup 4** menukar isi `<main id="swup">` saja, jadi tanpa reload |
| Animasi | **GSAP** + ScrollTrigger |
| Smooth scroll | **Lenis** (digerakkan oleh ticker GSAP, satu loop rAF) |
| Build | **Vite 8** (`appType: 'mpa'`) |
| Ikon | **SVG inline** dari `lucide-static`. **Emoji DILARANG.** |
| Warna | Token semantik CSS, tema **terang (default)** & **gelap** |
| Sistem desain | `design.md` (fondasi Pinterest): krem hangat + **SATU aksen merah** `#e60023`, radius 16/32/pill, kartu flat tanpa bayangan |
| Deploy | Netlify (lihat `netlify.toml`); tidak butuh rewrite apa pun |

Data statistik yang **tidak boleh diubah tanpa diminta**: `120+` Anggota aktif, `10+` Program
kerja aktif, `18` Angkatan (angka `120+` masih contoh; lihat juga mini metrics di hero).

**Teks/kalimat/slogan TIDAK boleh diubah** ketika menerapkan gaya dari `design.md` — yang
mengikuti design.md hanya elemen visual: warna, font, radius, bayangan, komponen.

---

## 2. Perintah

```bash
npm run dev       # server dev (Vite)
npm run build     # keluaran produksi ke dist/
npm run preview   # menyajikan hasil build
```

Tidak ada framework test (jest/vitest) — verifikasi dilakukan dengan `npm run build` + memeriksa
`dist/`. Lihat bagian **Cara Verifikasi**.

> **Penting:** situs **tidak berjalan** kalau `dist/index.html` dibuka langsung lewat `file://`
> — module script diblokir browser. Selalu lewat `npm run dev` / `npm run preview`.

---

## 3. Peta file

```
index.html                    Beranda (satu-satunya halaman dengan kelas .home)
404.html                      Halaman fallback
profil/ visi-misi/ proker/    Halaman isi
proker/{akademik,seni,olahraga,sosial}/   4 halaman pilar
struktur/ galeri/ berita/ gabung/ kontak/
berita/{3 artikel}/           Tiap artikel punya URL sendiri

src/
  main.js                     ENTRY: tema, scroll, nav, lifecycle halaman, router Swup
  style.css                   SATU stylesheet, 26+ bagian bernomor (lihat §6)
  lib/
    motion.js                 prefersReducedMotion, isTouchOnly, safeInit()
    theme.js                  terang/gelap (localStorage: osis-theme) + meta theme-color
    scroll.js                 instance Lenis, jumpToTop/glideToTop, header state, anchor
    animations.js             prepare/play/kill/refresh animasi, counter angka, tilt 3D
    nav.js                    drawer mobile, dropdown Proker, penanda halaman aktif
    gallery.js                filter kategori + lightbox
  partials/
    header.html               navbar + drawer + toggle tema  (disisipkan saat build)
    footer.html               footer + sitemap + kontak
    init.html                 <script> inline anti-flash & default tema
  assets/logo-sumber.png      berkas logo asli (TIDAK disajikan, hanya arsip)

public/                       disalin apa adanya ke dist/ (favicon.png, logo.png, logo-texar.webp, foto/)
vite.config.js                plugin "osis:site-blueprint" (partial, URL, sitemap)
netlify.toml                  build + header cache
.env                          VITE_SITE_URL (domain asli untuk canonical/sitemap)
```

---

## 4. Alur build (`vite.config.js`)

Plugin `osis:site-blueprint` melakukan empat hal **tanpa dependensi tambahan**:

1. **Menemukan semua `*.html`** secara rekursif (kecuali `node_modules`, `dist`, `.git`, `src`,
   `public`) dan menjadikannya entry MPA. **Menambah halaman = cukup menambah folder + `index.html`**,
   tidak ada daftar manual yang perlu diperbarui.
2. **Menyisipkan partial** — `<!-- @include header.html -->` diganti isi `src/partials/*.html`
   (mendukung include bertingkat, maksimal 5 level).
3. **Mengganti placeholder URL** — `%SITE_URL%` dan `%PAGE_URL%` (dipakai untuk `canonical` & OG).
   Plugin memperingatkan saat build bila sebuah halaman tidak memakainya.
4. **Membuat `sitemap.xml` + `robots.txt`** dari daftar halaman yang sama. `404.html` dikecualikan;
   prioritas ditentukan dari kedalaman URL.

Di `dev`/`preview` juga dipasang middleware yang mengalihkan `/profil` → `/profil/` (301) agar
perilaku lokal sama dengan Netlify.

**Alur runtime** (`src/main.js`):

```
load
 ├─ initTheme()                    ← dipasang paling awal, TIDAK menunggu boot
 ├─ initSmoothScroll() + anchor    ← 1 instance Lenis untuk seluruh sesi
 ├─ initNav()                      ← header tidak ikut ditukar Swup → cukup sekali
 └─ boot()
     ├─ prepareCurrentPage()       ← kondisi awal animasi (sebelum browser menggambar)
     ├─ playCurrentPage()          ← animasi masuk + galeri + nav aktif + refresh
     └─ initRouter()               ← Swup
          visit:start      → closeNav, destroyGallery, killPageAnimations, glideToTop
          content:replace  → jumpToTop, prepareCurrentPage
          page:view        → playCurrentPage
```

**Dua tahap animasi** (`prepare` → `play`) itu bukan hiasan: `prepare` dijalankan pada task yang
sama dengan penggantian DOM, jadi browser belum menggambar dan tidak ada kedipan "muncul lalu
melompat". Semua `init` dibungkus `safeInit()` supaya satu error tidak mematikan fitur lain
(kesalahan dicetak sebagai `[init:nama] gagal:`).

---

## 5. Aturan wajib

### 5.1 Ikon: SVG, bukan emoji
Ambil path asli dari paket dev `lucide-static`, jangan tulis path dari ingatan:

```bash
cat node_modules/lucide-static/icons/users.svg
```

Tempel sebagai SVG inline dengan kelas `icon` dan `stroke="currentColor"` supaya ikut warna teks:

```html
<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="…"/>
</svg>
```

Ikon murni dekoratif diberi `aria-hidden="true"`. Kalau ikon berdiri sendiri sebagai tombol,
beri `aria-label` pada tombolnya.

### 5.2 Warna: hanya lewat token
**Jangan hardcode warna di komponen.** Semua warna harus lewat token semantik dari `:root`
(dan ditukar di `[data-theme='dark']`). Token yang sering dipakai:

| Kelompok | Token |
|---|---|
| Permukaan | `--bg`, `--bg-soft`, `--surface`, `--surface-glass`, `--surface-raised` |
| Teks | `--heading`, `--text`, `--text-muted`, `--text-faint` |
| Garis | `--border`, `--border-strong` |
| Aksen | `--accent` (merah `#e60023`, satu-satunya warna aksen), `--accent-hover` (pressed `#cc001f`), `--accent-ink`, `--accent-soft`, `--accent-ring`, `--accent-glow`, `--on-accent` |
| Aksen merah | `--accent-red*` — nilainya KINI SAMA dengan `--accent` (merah tunggal); dipertahankan agar markup lama tak perlu diubah |
| Fokus | `--focus-outer` (biru `#435ee5`, khusus ring fokus keyboard) + `--focus-inner` (celah putih) |
| Chip ikon | `--chip-bg`, `--chip-border`, `--chip-icon`, `--chip-invert-*` |
| Section "selalu gelap" | `--dark-bg`, `--dark-heading`, `--dark-text`, `--dark-border`, `--dark-glass`, `--dark-glow-*` |
| Hero Beranda | `--hero-bg`, `--hero-heading`, `--hero-text(-faint)`, `--hero-border`, `--hero-glass`, `--hero-visual-*`, `--hero-shadow(-soft)` |

Aturan turunannya:
- Butuh **teks** berwarna aksen? pakai `--accent-ink`.
- Merah aksen **langka** (design.md: satu CTA merah per lipatan). Aksi sekunder/kartu netral
  memakai ink/krem (`--chip-invert-*`, `--surface-raised`), bukan merah.
- Section yang memang gelap di kedua tema (pita angka, CTA band, vision, footer) kini
  memakai **charcoal hangat `#262622`** (surface-dark design.md), bukan hitam kebiruan.
- **Tanpa bayangan** di kartu (design.md flat); satu-satunya bayangan adalah `--shadow-lg`
  untuk dropdown/lightbox/modal, plus scrim `--scrim`.
- Ring fokus keyboard = dua lapis `--focus-outer` + `--focus-inner` (lihat §2).
- Komponen baru harus ditambahkan ke blok `html.theme-anim .…` (§23 style.css) agar transisi
  450ms saat ganti tema ikut berlaku.

### 5.3 Tipografi
- **Inter** = font teks & antarmuka (substitusi utama Pin Sans dari design.md): body, tombol,
  navbar, footer, halaman isi — dimuat oleh **semua** halaman.
- **Plus Jakarta Sans** = tier display, dipakai `--font-display` di dalam `.home`:
  judul hero (600, kata kunci aksen 700), judul section & angka (700).
  Hanya `index.html` yang memuat font ini — jangan memakainya di halaman lain.
- Bobot 800 sudah dihapus — jangan menambahnya lagi; display maksimal 700 dengan
  `letter-spacing` negatif (ala display design.md).
- Font dimuat per halaman lewat `<link>` Google Fonts di `<head>` (bukan satu partial bersama),
  jadi **mengubah set font berarti mengedit font link di setiap file HTML** (17 file).
- ⚠️ Ingat Swup menyimpan aset (`persistAssets`) — font yang dimuat satu halaman akan membekas
  ke halaman berikutnya dalam satu sesi. Itu sebabnya tier display dibatasi di Beranda.

### 5.4 Animasi: pasang lewat atribut `data-*`
| Atribut | Efek |
|---|---|
| `data-intro` | Animasi masuk halaman (fade + naik), stagger 0.1s. Untuk elemen hero. |
| `data-reveal` | Fade + naik saat masuk viewport (sekali jalan). |
| `data-reveal-stagger` | Wadah; **anak-anaknya** dianimasikan berurutan. |
| `data-parallax="60"` | Parallax scrub; nilainya persen tinggi elemen (`-40` = arah sebaliknya). |
| `data-tilt` | Kartu miring mengikuti kursor (otomatis mati di perangkat sentuh). |
| `data-count="120" data-count-suffix="+"` | Angka berhitung naik. Teks di HTML harus sudah berisi nilai akhir (fallback tanpa JS). |

Semua animasi **dibangun ulang tiap perpindahan halaman**, jadi:
- jangan menyimpan referensi elemen halaman di variabel modul tingkat atas;
- jangan menambahkan event listener ke elemen di dalam `#swup` saat `init` yang hanya dipanggil sekali;
- setiap komponen dinamis wajib punya pasangan `init…()` / `destroy…()` (contoh: `gallery.js`);
- setelah mengubah tinggi konten, panggil `refreshPageAnimations()` (ScrollTrigger.refresh).

Anti-kedip: `src/partials/init.html` menambahkan kelas `.js` ke `<html>`, dan CSS menyembunyikan
`[data-intro]`/`[data-reveal]`. Kalau app gagal boot dalam 2,5 detik, `.js` dilepas dan konten
tetap terlihat. `prefers-reduced-motion` selalu menampilkan konten tanpa animasi.

### 5.5 Tema terang/gelap
- **Default = terang.** Auto-deteksi `prefers-color-scheme` sengaja tidak dipakai; mode gelap
  hanya aktif bila pengunjung menekan `#theme-toggle`. Pilihan disimpan di `localStorage` (`osis-theme`).
- Tema diterapkan sebagai atribut `data-theme` pada `<html>` — **satu sumber kebenaran**.
- Skrip inline di `init.html` (di `@include` dalam `<head>`) mencegah kedipan tema; `theme.js`
  memakai **event delegation** pada `document` supaya toggle tetap hidup walau modul lain gagal.
- Saat mengganti tema, `theme.js` juga memperbarui `<meta name="theme-color">`.
- Nilai statis `theme-color` di semua halaman sudah `#ffffff` (default terang); runtime yang
  menggantinya saat toggle.

### 5.6 Navigasi (header partial)
`src/partials/header.html` dipakai **semua** halaman — perubahan di sana berdampak ke 17 file.
- `data-nav="kunci"` → penanda halaman aktif (`aria-current="page"`); kuncinya = path dengan `/` → `-`
  (`proker/akademik` → `proker-akademik`).
- `data-nav-parent="proker"` → induk tetap aktif saat berada di halaman pilar.
- Dropdown Proker = klik (bukan hover), tombol `#nav-proker-toggle`, Escape & klik-luar menutup.
- Drawer mobile memakai **checkbox hack** (`#nav-toggle`), bukan JS untuk membuka.
  Panel dibungkus `.header__nav-layer` (`position: fixed` + `overflow: hidden`) — inilah yang
  mencegah halaman bisa digeser ke kanan di ponsel. Jangan kembalikan pola
  `right: -100%` / `translateX` pada elemen fixed langsung.
- Jangan pakai `100vw` (termasuk lebar scrollbar → memicu overflow horizontal).

### 5.7 Galeri & lightbox
Struktur yang diharapkan JavaScript (`src/lib/gallery.js`):
```html
<div data-gallery>
  <button data-filter="all">Semua</button>          <!-- chip filter -->
  <span data-gallery-count>…</span>
  <article data-photo data-category="seni" data-caption="Judul foto">
    <span class="photo__media"></span>               <!-- atau <img> langsung -->
  </article>
</div>
```
Lightbox dibuat otomatis; kalau item berisi `<img>`, gambar asli itulah yang ditampilkan.
Filter memanggil `refreshPageAnimations()` agar ScrollTrigger tetap akurat.

### 5.8 Slot foto (placeholder → foto asli)
Proyek ini **belum punya foto asli**. Pola yang dipakai: elemen `<span class="…-media">` sebagai
slot **permukaan polos + satu lingkaran samar** — arsir diagonal/hatching khas template AI
sengaja DIHAPUS. Mengganti dengan foto asli = cukup menukar span itu dengan
`<img src="/foto/nama.jpg" alt="…">` (taruh berkas di `public/foto/`). Overlay, caption, dan
lightbox tetap bekerja. Jangan hapus pembungkus `figure`-nya.

Konvensi anti-"AI-look" yang dipertahankan: latar section bersih tanpa tekstur grid,
ikon kartu Sorotan ber-tint pastel per pilar (`showcase__icon--buku/seni/olahraga/sosial`),
statistik hero berupa stat row terintegrasi (bukan kartu melayang), dan ikon tombol utama
berupa kompas beranimasi (bukan panah generik).

### 5.9 Ornamen geometris kecil (Pinterest-style)
Dua komponen dekoratif di bagian 1c `style.css`: `.quarter-arc` (busur 1/4 lingkaran,
cutout interior via `::before` yang **wajib** diganti ulang di tiap varian warna) dan
`.dot-grid` (grid titik `radial-gradient`, warna via `currentColor`). Terpasang di 3 tempat:
hero (arc + dots), showcase (dots), cta-band (arc + dots merah samar). Semua `aria-hidden`,
`pointer-events: none`, memakai token tema, **hilang di ponsel ≤767px** (kecuali arc),
dan ikut transisi tema 450ms.

**Aturan disiplin (agar situs tetap tenang):** maksimal SATU ornamen per sudut section,
hanya 2–3 section situs-wide, ukuran kecil (arc 84–116px, dots 64–84px), inset negatif
ringan saja. Jangan menambah bentuk baru di luar dua pola ini tanpa diminta — ini gestur
kesengajaan, bukan sistem.

---

## 6. Struktur `src/style.css`

Satu file, dibagi bagian bernomor. **Tambahkan aturan di bagian yang sesuai, atau buat bagian
baru di akhir (dengan nomor lanjut)** — jangan menyelipkan aturan acak di tengah bagian lain.

| Bagian | Isi |
|---|---|
| 1 / 1b | Token terang (default) & gelap — palet design.md (krem hangat + merah tunggal) |
| 2–4 | Reset, `.icon`, utility (`.section-tag`, `.section-title`, tombol) |
| 5 | Header/navbar |
| 6 | Hero Beranda (permukaan krem bersih TANPA tekstur grid, stat row tanpa kartu dengan divider vertikal, photo grid) |
| 7–11 | Section lama: profil, visi-misi, proker, CTA band, footer |
| 12–13 | Transisi tema & media query lama (mobile-first: 480 → 768 → 1024 → 1280) |
| 15–21 | Halaman dalam: page-hero, kartu, teks panjang, slot foto/galeri/lightbox, dropdown, footer sitemap, 404 |
| 21b | Anti-kedip |
| 22 | Transisi antar halaman (#swup) |
| 23 | Daftar komponen yang ikut transisi tema |
| 24–25 | Media query komponen baru & `prefers-reduced-motion` |
| 26 / 26b | Beranda: tipografi display, showcase, stats band, indeks, media query |

Catatan: nomor bagian **14 tidak dipakai** (penomoran lama), jadi jangan bingung kalau urutannya
meloncat. Konvensi kelas: **BEM** (`blok__elemen--modifier`), mobile-first, Flexbox/Grid.

---

## 7. Menambah / mengubah halaman

Template minimum `halaman/index.html`:

```html
<!DOCTYPE html>
<html lang="id" data-page="nama-halaman">     <!-- data-page = atribut yang disinkron Swup -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Judul Halaman | OSIS SMK Texar Karawang</title>
  <meta name="description" content="…(≥ 120 karakter, unik per halaman)…">
  <link rel="canonical" href="%PAGE_URL%">

  <!-- OG + Twitter: salin dari halaman lain, gunakan %PAGE_URL% -->
  <meta name="theme-color" content="#ffffff">

  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">

  <!-- @include init.html -->
  <script type="module" src="/src/main.js"></script>
</head>
<body>
  <!-- @include header.html -->

  <main id="swup">           <!-- WAJIB: hanya isi ini yang ditukar Swup -->
    <section class="page-hero">…</section>
    <section class="section">…</section>
  </main>

  <!-- @include footer.html -->
</body>
</html>
```

Checklist setelah menambah halaman:
1. `title` unik + `description` unik.
2. Pakai `%PAGE_URL%` untuk canonical & `og:url` (kalau tidak, plugin memberi peringatan saat build).
3. Tambahkan tautan ke halaman itu di `src/partials/header.html` dan/atau `footer.html` (dan beri `data-nav`).
4. `npm run build`, lalu pastikan `sitemap.xml` bertambah dan tidak ada tautan rusak.

Halaman Beranda adalah pengecualian: satu-satunya yang memakai pembungkus `.home`,
`--font-display` (Plus Jakarta Sans), dan font link tambahan Plus Jakarta Sans.

---

## 8. Jebakan yang sudah pernah memakan korban

| Gejala | Penyebab & penanganan |
|---|---|
| Toggle tema tidak bereaksi | Dulu `initTheme` ikut mati kalau boot gagal. Sekarang dipasang sebelum boot + `safeInit`. Jangan turunkan kembali ke pola "tunggu boot". |
| Tema terasa "tidak mengubah apa pun" | Dulu ada 30+ override warna terpisah. Sekarang token-based — pastikan komponen baru memakai token, bukan warna literal. |
| Halaman bisa digeser ke kanan di ponsel | Elemen `position: fixed` yang digeser keluar viewport tetap menambah area geser. Solusinya layer `overflow: hidden` (§5.6) + `html { overflow-x: clip }`. `hidden` pada `body` saja tidak cukup. |
| Animasi mati di halaman kedua | ScrollTrigger perlu dibangun ulang + `refresh()` setelah DOM ditukar (dan setelah font siap). |
| Konten hilang/blank sesaat | Elemen `[data-intro]`/`[data-reveal]` disembunyikan CSS. Kalau animasi gagal, `forceRevealAll()` wajib jalan. |
| Tombol X menu tertimbun drawer | `z-index` tidak berlaku pada elemen `position: static`. |
| Font heading halaman lain tiba-tiba berubah | Efek samping `persistAssets` Swup (lihat §5.3). |

---

## 9. Masih placeholder — jangan dianggap final

1. **Tautan Google Form** di `gabung/index.html` (2 tempat, ditandai komentar `GANTI`).
2. **Nama pengurus** di `struktur/index.html` — masih `[Nama Ketua]`, `[Nama Wakil Ketua]`, dst.
3. **Semua foto** masih slot. Taruh foto asli di `public/foto/`.
4. **Domain asli** di `.env` (`VITE_SITE_URL`) — memengaruhi canonical, OG, `sitemap.xml`, `robots.txt`.
5. **`og:image`** belum dipasang karena berkasnya belum ada.
6. **Angka `120+`** di statistik hero adalah contoh.
7. **Tautan sosial** (`Instagram`/`TikTok`/`YouTube`) masih `href="#"`.

(Favicon sudah diganti dari monogram "OT" menjadi `public/favicon.png` yang dibuat dari
`public/logo.png`; jika logo berganti, regenerasi favicon dari logo baru itu.)

**Logos berpasangan SETINGGI-SAMA di header** (partial `header.html`, satu tempat untuk
semua halaman): logo BAFU (`/logo-texar.webp`) + logo OSIS (`/logo.png`) memakai kelas sama
(`.header__logo-icon`, `width: auto`) — lebar mengikuti rasio asli masing-masing, jadi yang
disamakan adalah TINGGI render, bukan kotaknya. **Tanpa pembatas** di antara mereka —
pemisah cukup dari `gap` flexbox — lalu teks dua baris "OSIS SMK TEXAR" (uppercase via CSS)
dengan sub-heading "Official Website" (`.header__logo-sub`, micro-tag tracking lebar).
Skala brand sengaja kompak + geser optis ke kiri (`margin-left` negatif di
`.header__logo`): mobile <1024px = ikon 34px, font 0.88rem, sub 0.5rem, margin −0.25rem;
desktop ≥1024px (mq yang sama dengan pergantian nav drawer→desktop) = ikon 38px,
font 0.97rem, sub 0.55rem, margin −0.4rem. Kompensasi margin internal gambar logo —
ubalah hanya jika gambar logonya ikut berubah.

⚠️ `logo-texar.webp` telah DI-TRIM dari 600×600 (bermargin kosong 67–87px per sisi, emblem
hanya 71% tinggi kanvas) menjadi **467×427** yang mengisi kanvas 100% — penyebabnya logo
BAFU tampak lebih kecil dari OSIS padahal kotak CSS-nya sama. Salinan sumber ter-trim ada
di `src/assets/logo-texar-sumber.webp`. **Jika logo diganti, trim dulu margin transparannya**
(Pillow: alpha `getbbox()` → `crop`) sebelum dipakai, dan jangan tambahkan elemen
pembatas/garis antar-logo atau buat tinggi render keduanya berbeda (permintaan eksplisit
pemilik).

---

## 10. Cara verifikasi (tanpa browser)

Lingkungan kerja agen biasanya **tidak punya browser**, jadi penilaian visual tidak bisa dilakukan
sendiri — katakan itu apa adanya kepada pengguna. Yang bisa dan wajib dilakukan:

```bash
npm run build                                  # harus bersih
node -e "…"                                    # cek keseimbangan kurung CSS, token, kelas baru
npm run preview -- --port 4173 &               # lalu curl tiap route
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/proker/seni/
```

Pemeriksaan rutin yang berguna:
- keseimbangan `{` dan `}` di `src/style.css`;
- setiap `href="/…"` di `dist/` menunjuk berkas yang benar-benar ada (0 tautan rusak);
- jumlah halaman di `sitemap.xml` = jumlah file HTML − 1 (`404.html` dikecualikan);
- tidak ada emoji di keluaran (`grep -P '[\x{1F300}-\x{1FAFF}]'`) dan tidak ada sisa `@include`;
- token/kelas baru benar-benar ada di bundle (`dist/assets/*.css`), bukan hanya di sumber.

---

## 11. Gaya kerja yang diharapkan

- Utamakan **mengubah berkas yang sudah ada** ketimbang membuat berkas baru; jaga jumlah perubahan
  tetap kecil dan terarah.
- Pertahankan **struktur & layout dasar** yang sudah ada kecuali diminta mengubahnya; jangan
  mengubah angka statistik atau konten faktual tanpa permintaan eksplisit.
- Komponen yang dipakai bersama (header/footer/`.btn`) berdampak ke 17 halaman — periksa dulu
  siapa saja pemakainya sebelum mengubahnya.
- Konfirmasi dulu untuk keputusan yang mahal diubah: URL/route baru, skema warna global, penambahan
  dependensi, atau penggantian font.
- Tulis komentar dalam bahasa Indonesia dengan gaya yang sama seperti kode sekitarnya.

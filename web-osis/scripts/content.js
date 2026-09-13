// ==========================================================================
// MESIN KONTEN — jembatan antara panel admin (content/*.json) dan halaman
// statis. Dipakai oleh vite.config.js saat dev & build.
//
// Prinsip:
//   - Halaman menandai area dinamis dengan region:
//       <!-- @content:start KERY:arg --> konten lama/fallback <!-- @content:end -->
//     Region diganti hasil render dari JSON. Konten lama di dalamnya hanya
//     fallback bila JSON hilang — jangan dianggap sumber kebenaran.
//   - Body berita adalah HTML dari panel admin (dipercaya), TIDAK di-escape.
//     Semua nilai lain (judul, label, caption) di-escape.
//   - Halaman detail berita digenerate dari templates/berita-post.html ke
//     .content-tmp/berita/<slug>/index.html (dipindai Vite sebagai entry MPA).
// ==========================================================================

import { readFileSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = resolve(ROOT, 'content');
const TMP_DIR = resolve(ROOT, '.content-tmp');

/* ------------------------------------------------------------------ */
/* Load JSON — selalu dibaca ulang agar edit di dev langsung terlihat */
/* ------------------------------------------------------------------ */
function readJson(name) {
  const file = join(CONTENT_DIR, name);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[content] JSON rusak: ${name} — fallback ke konten statis.`, err.message);
    return null;
  }
}

export function loadContent() {
  return {
    site: readJson('site.json') || {},
    berita: readJson('berita.json') || [],
    galeri: readJson('galeri.json') || [],
    struktur: readJson('struktur.json') || {},
  };
}

/* ------------------------------------------------------------------ */
/* Util                                                               */
/* ------------------------------------------------------------------ */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-09-10" → "10 September 2026" */
export function tanggalHuman(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

/* Ikon untuk kartu statistik (path Lucide — sudah diverifikasi) */
const STAT_ICONS = {
  anggota: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  proker: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  angkatan: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  aspirasi: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sekbid: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
};

const statIcon = (key) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STAT_ICONS[key] || ''}</svg>`;

/* ================================================================== */
/* RENDERER TIAP REGION                                               */
/* ================================================================== */

function renderHeroCopy(site) {
  const h = site.hero || {};
  if (!h.headlinePre && !h.subtext) return '';
  const accent = (word, cls) => `<em class="hero__headline-accent${cls ? ` ${cls}` : ''}">${esc(word)}</em>`;
  const headline =
    esc(h.headlinePre || '') +
    accent(h.accent1 || '') +
    ', ' +
    accent(h.accent2 || '', 'hero__headline-accent--red') +
    ', dan ' +
    accent(h.accent3 || '') +
    esc(h.headlineAfter || '');
  return `${h.eyebrow ? `<p class="hero__eyebrow" data-intro>${esc(h.eyebrow)}</p>` : ''}<h1 class="hero__headline" data-intro>${headline}</h1>${h.subtext ? `<p class="hero__subtext" data-intro>${esc(h.subtext)}</p>` : ''}`;
}

function renderEventBanner(site) {
  const ev = site.event;
  if (!ev || ev.enabled === false || !ev.title) return '';
  const img = ev.image ? `<img class="hero__notice-media" src="${esc(ev.image)}" alt="" loading="lazy">` : '';
  const link = ev.link
    ? `<a class="hero__notice-link" href="${esc(ev.link)}"><span class="hero__notice-link-text">Selengkapnya</span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>`
    : '';
  return `<aside class="hero__notice" data-intro aria-label="Pengumuman event terdekat">${img}<div class="hero__notice-overlay" aria-hidden="true"></div><div class="hero__notice-body"><p class="hero__notice-tag"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>${esc(ev.tag || 'Event selanjutnya')}</p><p class="hero__notice-title">${esc(ev.title)}</p></div>${link}</aside>`;
}

function renderHeroStats(site) {
  const s = site.stats || {};
  const items = [
    ['anggota', s.anggota, 'Anggota aktif', '+'],
    ['proker', s.proker, 'Program kerja aktif', '+'],
    ['angkatan', s.angkatan, 'Angkatan', ''],
    ['aspirasi', s.aspirasi, 'Aspirasi terpenuhi', '+'],
    ['sekbid', s.sekbid, 'Sekbid aktif', ''],
  ];
  return `<div class="hero__stats" data-intro aria-roledescription="carousel" aria-label="Statistik organisasi"><ul class="hero__stats-track">${items
    .filter(([, num]) => num !== undefined && num !== null && num !== '')
    .map(([key, num, label, suffix]) => `<li class="hero__stat"><span class="hero__stat-icon" aria-hidden="true">${statIcon(key)}</span><span class="hero__stat-number" data-count="${esc(String(num).replace(/\D/g, ''))}"${suffix ? ` data-count-suffix="${suffix}"` : ''}>${esc(num)}${suffix}</span><span class="hero__stat-label">${esc(label)}</span></li>`)
    .join('')}</ul></div>`;
}

function renderMarquee(site) {
  const s = site.stats || {};
  const row1 = [
    [s.anggota ?? '120+', 'Anggota aktif', 'anggota'],
    [s.proker ?? '10+', 'Program kerja aktif', 'proker'],
    [s.angkatan ?? '18', 'Angkatan', 'angkatan'],
    [s.aspirasi ?? '500+', 'Aspirasi terpenuhi', 'aspirasi'],
  ];
  const row2 = [
    [s.sekbid ?? '8', 'Divisi kepengurusan', 'sekbid'],
    ['4', 'Pilar kegiatan', 'layers'],
    ['100%', 'Kegiatan dikelola siswa', 'badge'],
    [site.periode || '2026/2027', 'Periode kepengurusan', 'calendar'],
  ];
  const ICONS = {
    anggota: STAT_ICONS.anggota,
    proker: STAT_ICONS.proker,
    angkatan: STAT_ICONS.angkatan,
    aspirasi: STAT_ICONS.aspirasi,
    sekbid: STAT_ICONS.sekbid,
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    badge: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/>',
    calendar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M16 2v3"/><path d="M3 9h18"/><path d="M8 2v3"/><path d="M17 13h-6"/><path d="M13 17H7"/><path d="M7 13h.01"/><path d="M17 17h.01"/>',
  };
  const item = ([num, label, icon], hidden) =>
    `<li class="marquee__item"${hidden ? ' aria-hidden="true"' : ''}><span class="marquee__icon"${hidden ? '' : ' aria-hidden="true"'}><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon] || ''}</svg></span><div class="marquee__text"><span class="marquee__number">${esc(num)}</span><span class="marquee__label">${esc(label)}</span></div></li>`;
  const row = (items, dir) =>
    `<div class="marquee__row marquee__row--${dir}"><ul class="marquee__track">${items.map((i) => item(i, false)).join('')}${items.map((i) => item(i, true)).join('')}</ul></div>`;
  return `<div class="marquee marquee--profile" aria-label="Organisasi dalam angka" data-reveal>${row(row1, 'right')}${row(row2, 'left')}</div>`;
}

function renderBeritaIndex(berita) {
  if (!berita.length) return '';
  // Grid beranda berita: grid--3 sesuai halaman asli (bukan grid--2)
  const card = (p) =>
    `<a href="/berita/${esc(p.slug)}/" class="card card--link"><div class="photo"><span class="photo__media" data-reveal-img aria-hidden="true"${p.image ? ` style="background-image:url('${esc(p.image)}')"` : ''}></span><span class="photo__label">${esc(p.category)}</span></div><p class="card__meta"><span>${esc(tanggalHuman(p.date))}</span><span>${esc(p.category)}</span></p><h3 class="card__title">${esc(p.title)}</h3><p class="card__text">${esc(p.excerpt)}</p><span class="card__more">Baca selengkapnya <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span></a>`;
  return `<div class="grid grid--3" data-reveal-stagger>${berita.map(card).join('')}</div>`;
}

function renderBeritaLainnya(berita, slug) {
  const post = berita.find((p) => p.slug === slug);
  const lain = berita.filter((p) => p.slug !== slug && (!post || p.category === post.category));
  const fallback = lain.length ? lain : berita.filter((p) => p.slug !== slug);
  if (!fallback.length) return '';
  return `<div class="grid grid--2" data-reveal-stagger>${fallback
    .slice(0, 2)
    .map((p) => `<a href="/berita/${esc(p.slug)}/" class="card card--link"><p class="card__meta"><span>${esc(tanggalHuman(p.date))}</span><span>${esc(p.category)}</span></p><h3 class="card__title">${esc(p.title)}</h3><p class="card__text">${esc(p.excerpt)}</p><span class="card__more">Baca <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span></a>`)
    .join('')}</div>`;
}

function renderBeritaHero(berita, slug) {
  const p = berita.find((x) => x.slug === slug);
  if (!p) return '';
  return `<nav class="page-hero__breadcrumb" aria-label="Breadcrumb" data-intro><a href="/">Beranda</a><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg><a href="/berita/">Berita</a><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg><span aria-current="page">${esc(p.shortTitle || p.title)}</span></nav><span class="section-tag section-tag--light" data-intro>${esc(p.category)}</span><h1 class="page-hero__title" data-intro>${esc(p.title)}</h1><p class="page-hero__lead" data-intro>${esc(p.lead)}</p><div class="page-hero__meta" data-intro><span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>${esc(tanggalHuman(p.date))}</span><span><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-4"/><path d="M16 12h4"/><path d="M16 17h4"/><path d="M4 5v10a2 2 0 0 0 2 2h2"/><path d="M8 5v10a2 2 0 0 1-2 2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="19" cy="19" r="2"/></svg>${esc(p.category)}</span></div>`;
}

function renderBeritaBody(berita, slug) {
  const p = berita.find((x) => x.slug === slug);
  // body = HTML dari panel admin (dipercaya) — sengaja tanpa escape
  return p?.body || '';
}

function renderGaleriGrid(galeri) {
  if (!galeri.length) return '';
  const LABEL = { akademik: 'Akademik', seni: 'Seni', olahraga: 'Olahraga', sosial: 'Sosial' };
  return `<div class="gallery__grid" data-reveal-stagger>${galeri
    .map(
      (g) => `<button type="button" class="photo" data-photo data-category="${esc(g.category)}" data-caption="${esc(g.caption)}"><span class="photo__media" data-reveal-img aria-hidden="true"${g.image ? ` style="background-image:url('${esc(g.image)}')"` : ''}></span><span class="photo__label">${esc(LABEL[g.category] || g.category)}</span></button>`,
    )
    .join('')}</div>`;
}

function renderStrukturInti(struktur) {
  const inti = struktur.inti || [];
  if (!inti.length) return '';
  return `<div class="grid grid--4" data-reveal-stagger>${inti
    .map(
      (p) => `<article class="person"><div class="photo photo--square"><span class="photo__media" data-reveal-img aria-hidden="true"${p.foto ? ` style="background-image:url('${esc(p.foto)}')"` : ''}></span><span class="photo__label">${p.foto ? '' : 'Slot foto'}</span></div><div><h3 class="person__name">${esc(p.name)}</h3><p class="person__role">${esc(p.role)}</p></div><p class="person__text">${esc(p.text)}</p></article>`,
    )
    .join('')}</div>`;
}

function renderStrukturDivisi(struktur) {
  const divisi = struktur.divisi || [];
  if (!divisi.length) return '';
  return `<div class="grid grid--4" data-reveal-stagger>${divisi
    .map(
      (d) => `<article class="card">${d.icon ? `<div class="card__icon" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d.icon}</svg></div>` : ''}<h3 class="card__title">${esc(d.title)}</h3><p class="card__text">${esc(d.text)}</p></article>`,
    )
    .join('')}</div>`;
}

const RENDERERS = {
  'event-banner': (_arg, data) => renderEventBanner(data.site),
  'hero-copy': (_arg, data) => renderHeroCopy(data.site),
  'hero-stats': (_arg, data) => renderHeroStats(data.site),
  'marquee-profile': (_arg, data) => renderMarquee(data.site),
  'berita-index': (_arg, data) => renderBeritaIndex(data.berita),
  'galeri-grid': (_arg, data) => renderGaleriGrid(data.galeri),
  'struktur-inti': (_arg, data) => renderStrukturInti(data.struktur),
  'struktur-divisi': (_arg, data) => renderStrukturDivisi(data.struktur),
  'berita-lainnya': (arg, data) => renderBeritaLainnya(data.berita, arg),
  'berita-hero': (arg, data) => renderBeritaHero(data.berita, arg),
  'berita-body': (arg, data) => renderBeritaBody(data.berita, arg),
};

/* ------------------------------------------------------------------ */
/* Suntik region ke HTML satu halaman                                 */
/* ------------------------------------------------------------------ */
export function injectContent(html, data) {
  return html.replace(
    /<!--\s*@content:start\s*([\w-]+)(?::([\w./-]+))?\s*-->[\s\S]*?<!--\s*@content:end\s*-->/g,
    (_match, key, arg) => {
      const renderer = RENDERERS[key];
      if (!renderer) return _match; // region tak dikenal: biarkan (peringatan dev)
      const out = renderer(arg, data);
      return out !== undefined && out !== null ? out : _match;
    },
  );
}

/* ================================================================== */
/* GENERATOR HALAMAN BERITA DETAIL                                    */
/* ================================================================== */

/** Buat .content-tmp/berita/<slug>/index.html dari templates/berita-post.html
 *  untuk setiap entri berita.json. Diregenerasi penuh setiap build (slug
 *  yang dihapus otomatis hilang). */
export function generateBeritaPages() {
  const templatePath = resolve(ROOT, 'templates', 'berita-post.html');
  if (!existsSync(templatePath)) return [];
  const template = readFileSync(templatePath, 'utf8');
  const berita = loadContent().berita;

  // Halaman detail ditulis langsung ke berita/<slug>/ (di-gitignore) supaya
  // path dev & dist persis seperti halaman biasa. Hapus dulu seluruh slug
  // lama (kecuali index.html daftar) agar slug terhapus ikut hilang.
  const BERITA_DIR = resolve(ROOT, 'berita');
  if (existsSync(BERITA_DIR)) {
    for (const entry of readdirSync(BERITA_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        rmSync(join(BERITA_DIR, entry.name), { recursive: true, force: true });
      }
    }
  }

  const files = [];
  for (const post of berita) {
    if (!post.slug || !post.title) continue;
    const dir = join(BERITA_DIR, post.slug);
    mkdirSync(dir, { recursive: true });
    const html = template
      .replaceAll('%SLUG%', esc(post.slug))
      .replaceAll('%TITLE%', esc(post.title))
      .replaceAll('%DESCRIPTION%', esc(post.excerpt || post.lead || ''))
      .replaceAll('%CATEGORY%', esc(post.category || 'Kepengurusan'))
      .replaceAll('%DATE%', esc(post.date || ''))
      .replaceAll('%DATE_HUMAN%', esc(tanggalHuman(post.date)));
    writeFileSync(join(dir, 'index.html'), html);
    files.push(join(dir, 'index.html'));
  }
  return files;
}

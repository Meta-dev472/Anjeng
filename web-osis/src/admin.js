// ==========================================================================
// PANEL ADMIN — logika front-end (/admin/)
// --------------------------------------------------------------------------
// Semua operasi lewat /api/admin (api/admin.js — Vercel Serverless Function):
//   login/logout/me · aspirasi CRUD · content (get) · content-save (commit)
// Tidak memakai Swup/GSAP — halaman fungsional, satu entry terpisah.
// ==========================================================================

import './admin.css';

const API = '/api/admin';

// Token path rahasia — disisipkan build ke <meta x-admin-path> di halaman
// panel. Setiap panggilan API wajib membawanya; tanpa ini API menjawab 404.
const SECRET_PATH =
  document.querySelector('meta[name="x-admin-path"]')?.content || 'admin';

const $ = (sel) => document.querySelector(sel);
const viewLogin = $('#view-login');
const viewDash = $('#view-dash');
const note = $('#admin-note');
const loginNote = $('#login-note');

const setNote = (msg, tone = '') => {
  note.textContent = msg || '';
  note.dataset.tone = tone;
};

async function api(action, payload = {}, method = 'POST') {
  const opts =
    method === 'GET'
      ? { headers: { 'x-admin-path': SECRET_PATH } }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-admin-path': SECRET_PATH },
          body: JSON.stringify({ action, ...payload }),
        };
  const url = method === 'GET' ? `${API}?action=${action}` : API;
  const res = await fetch(url, opts);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Kesalahan ${res.status}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Sesi                                                               */
/* ------------------------------------------------------------------ */

function showDash() {
  viewLogin.hidden = true;
  viewDash.hidden = false;
  $('#admin-actions').hidden = false;
  loadAll();
}

function showLogin() {
  viewLogin.hidden = false;
  viewDash.hidden = true;
  $('#admin-actions').hidden = true;
}

async function checkSession() {
  try {
    const { authed } = await api('me', {}, 'GET');
    if (authed) showDash();
    else showLogin();
  } catch {
    showLogin();
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  loginNote.textContent = '';
  const pass = $('#login-pass').value;
  try {
    await api('login', { pass });
    $('#login-pass').value = '';
    showDash();
  } catch (err) {
    loginNote.textContent = err.message;
    loginNote.dataset.tone = 'err';
  }
});

$('#btn-logout').addEventListener('click', async () => {
  try {
    await api('logout');
  } finally {
    showLogin();
  }
});

/* ------------------------------------------------------------------ */
/* Tab                                                                */
/* ------------------------------------------------------------------ */

$('#admin-tabs').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-tab]');
  if (!btn) return;
  for (const tab of $('#admin-tabs').querySelectorAll('button[data-tab]')) {
    tab.setAttribute('aria-selected', String(tab === btn));
  }
  for (const panel of document.querySelectorAll('.admin-tab')) {
    panel.hidden = panel.dataset.tabpanel !== btn.dataset.tab;
  }
});

/* ------------------------------------------------------------------ */
/* Konten: muat & isi form                                            */
/* ------------------------------------------------------------------ */

const state = { site: {}, berita: [], galeri: [], struktur: {} };

async function loadAll() {
  setNote('Memuat konten…');
  try {
    const data = await api('content', {}, 'GET');
    state.site = data.site || {};
    state.berita = data.berita || [];
    state.galeri = data.galeri || [];
    state.struktur = data.struktur || {};

    /* Beranda — event */
    const ev = state.site.event || {};
    $('#e-tag').value = ev.tag || '';
    $('#e-title').value = ev.title || '';
    $('#e-image').value = ev.image || '';
    $('#e-link').value = ev.link || '';
    $('#e-enabled').checked = ev.enabled !== false;

    /* Beranda — statistik */
    const s = state.site.stats || {};
    $('#s-anggota').value = s.anggota || '';
    $('#s-proker').value = s.proker || '';
    $('#s-angkatan').value = s.angkatan || '';
    $('#s-aspirasi').value = s.aspirasi || '';
    $('#s-sekbid').value = s.sekbid || '';
    $('#s-periode').value = state.site.periode || '';

    /* Beranda — hero (schema terstruktur: pembuka + 3 kata aksen + penutup) */
    const h = state.site.hero || {};
    $('#h-eyebrow').value = h.eyebrow || '';
    $('#h-pre').value = h.headlinePre || '';
    $('#h-a1').value = h.accent1 || '';
    $('#h-a2').value = h.accent2 || '';
    $('#h-a3').value = h.accent3 || '';
    $('#h-after').value = h.headlineAfter || '';
    $('#h-subtext').value = h.subtext || '';

    /* Galeri & struktur (editor JSON) */
    $('#json-galeri').value = JSON.stringify(state.galeri, null, 2);
    $('#json-inti').value = JSON.stringify(state.struktur.inti || [], null, 2);
    $('#json-divisi').value = JSON.stringify(state.struktur.divisi || [], null, 2);

    renderBerita();
    renderAspirasi();

    setNote('Konten termuat. Perubahan disimpan sebagai commit GitHub → deploy otomatis.', 'ok');
  } catch (err) {
    setNote(err.message, 'err');
    if (err.message.includes('401') || err.message.includes('Belum masuk')) showLogin();
  }
}

/* ------------------------------------------------------------------ */
/* Berita                                                             */
/* ------------------------------------------------------------------ */

function renderBerita() {
  const wrap = $('#berita-list');
  if (!state.berita.length) {
    wrap.innerHTML = '<p class="admin-empty">Belum ada berita.</p>';
    return;
  }
  wrap.innerHTML = state.berita
    .map(
      (p) => `<div class="admin-row">
        <div class="admin-row__body">
          <p class="admin-row__title">${escapeHtml(p.title)}</p>
          <p class="admin-row__meta">${escapeHtml(p.date)} · ${escapeHtml(p.category)} · /berita/${escapeHtml(p.slug)}/</p>
        </div>
        <div class="admin-row__actions">
          <button type="button" class="admin-btn" data-edit="${escapeAttr(p.slug)}">Edit</button>
          <button type="button" class="admin-btn admin-btn--danger" data-del="${escapeAttr(p.slug)}">Hapus</button>
        </div>
      </div>`,
    )
    .join('');
}

$('#berita-list').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit]');
  const del = event.target.closest('[data-del]');

  if (edit) {
    const p = state.berita.find((x) => x.slug === edit.dataset.edit);
    if (!p) return;
    $('#b-slug').value = p.slug || '';
    $('#b-title').value = p.title || '';
    $('#b-shorttitle').value = p.shortTitle || '';
    $('#b-category').value = p.category || '';
    $('#b-date').value = p.date || '';
    $('#b-lead').value = p.lead || '';
    $('#b-excerpt').value = p.excerpt || '';
    $('#b-image').value = p.image || '';
    $('#b-body').value = p.body || '';
    $('#b-slug').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setNote(`Artikel “${p.slug}” dimuat ke editor. Jangan ubah slug saat mengedit.`, 'ok');
  }

  if (del) {
    if (!confirm(`Hapus artikel "${del.dataset.del}"? Halamannya hilang setelah deploy.`)) return;
    state.berita = state.berita.filter((x) => x.slug !== del.dataset.del);
    renderBerita();
    await saveContent({ berita: state.berita }, 'Hapus artikel');
  }
});

$('#b-clear').addEventListener('click', () => {
  for (const id of ['b-slug', 'b-title', 'b-shorttitle', 'b-category', 'b-date', 'b-lead', 'b-excerpt', 'b-image', 'b-body']) {
    $(`#${id}`).value = '';
  }
});

$('#b-save').addEventListener('click', () => {
  const slug = $('#b-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!slug) return setNote('Slug wajib diisi (a-z, 0-9, tanda minus).', 'err');
  if (!$('#b-title').value.trim()) return setNote('Judul wajib diisi.', 'err');

  const post = {
    slug,
    title: $('#b-title').value.trim(),
    shortTitle: $('#b-shorttitle').value.trim(),
    category: $('#b-category').value.trim() || 'Kepengurusan',
    date: $('#b-date').value || new Date().toISOString().slice(0, 10),
    lead: $('#b-lead').value.trim(),
    excerpt: $('#b-excerpt').value.trim() || $('#b-lead').value.trim(),
    image: $('#b-image').value.trim(),
    body: $('#b-body').value,
  };

  const i = state.berita.findIndex((x) => x.slug === slug);
  if (i >= 0) state.berita[i] = post;
  else state.berita.unshift(post);
  state.berita.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  renderBerita();
  saveContent({ berita: state.berita });
});

/* ------------------------------------------------------------------ */
/* Simpan konten (commit GitHub)                                      */
/* ------------------------------------------------------------------ */

function collectSite() {
  return {
    ...state.site,
    periode: $('#s-periode').value.trim(),
    event: {
      enabled: $('#e-enabled').checked,
      tag: $('#e-tag').value.trim(),
      title: $('#e-title').value.trim(),
      image: $('#e-image').value.trim(),
      link: $('#e-link').value.trim(),
    },
    stats: {
      anggota: $('#s-anggota').value.trim(),
      proker: $('#s-proker').value.trim(),
      angkatan: $('#s-angkatan').value.trim(),
      aspirasi: $('#s-aspirasi').value.trim(),
      sekbid: $('#s-sekbid').value.trim(),
    },
    hero: {
      ...state.site.hero,
      eyebrow: $('#h-eyebrow').value.trim(),
      headlinePre: $('#h-pre').value,
      accent1: $('#h-a1').value.trim(),
      accent2: $('#h-a2').value.trim(),
      accent3: $('#h-a3').value.trim(),
      headlineAfter: $('#h-after').value,
      subtext: $('#h-subtext').value.trim(),
    },
  };
}

function collectStruktur() {
  const inti = JSON.parse($('#json-inti').value);
  const divisi = JSON.parse($('#json-divisi').value);
  if (!Array.isArray(inti) || !Array.isArray(divisi)) throw new Error('Struktur harus array JSON');
  return { inti, divisi };
}

function collectGaleri() {
  const galeri = JSON.parse($('#json-galeri').value);
  if (!Array.isArray(galeri)) throw new Error('Galeri harus array JSON');
  return galeri;
}

async function saveContent(overrides = {}, label = 'Update konten') {
  setNote('Menyimpan… (commit ke GitHub)');
  try {
    const files = {};
    if (overrides.site || overrides.site === null) files['site.json'] = overrides.site;
    for (const key of ['berita', 'galeri', 'struktur']) {
      if (overrides[key] !== undefined) files[`${key}.json`] = overrides[key];
    }
    if (!Object.keys(files).length) {
      files['site.json'] = collectSite();
      try {
        files['galeri.json'] = collectGaleri();
        files['struktur.json'] = collectStruktur();
      } catch (err) {
        return setNote(`JSON tidak valid: ${err.message}`, 'err');
      }
    }
    for (const [file, data] of Object.entries(files)) {
      await api('content-save', { file, data });
    }
    setNote(`Tersimpan (${label}). Deploy berjalan — konten tayang ±1–2 menit.`, 'ok');
    await loadAll();
  } catch (err) {
    setNote(err.message, 'err');
  }
}

$('#btn-save-content').addEventListener('click', () => saveContent({}, 'Simpan perubahan'));
$('#btn-reload-content').addEventListener('click', loadAll);

/* ------------------------------------------------------------------ */
/* Aspirasi                                                           */
/* ------------------------------------------------------------------ */

async function renderAspirasi() {
  const wrap = $('#aspirasi-list');
  try {
    const { items } = await api('aspirasi', {}, 'GET');
    if (!items.length) {
      wrap.innerHTML = '<p class="admin-empty">Belum ada aspirasi masuk.</p>';
      return;
    }
    wrap.innerHTML = items
      .map(
        (a) => `<div class="admin-row">
          <div class="admin-row__body">
            <p class="admin-row__title">${escapeHtml(a.name)} <span class="admin-chip admin-chip--${escapeAttr(a.status || 'baru')}">${escapeHtml(a.status || 'baru')}</span></p>
            <p class="admin-row__meta">${new Date(a.createdAt).toLocaleString('id-ID')}</p>
            <p class="admin-row__text">${escapeHtml(a.message)}</p>
          </div>
          <div class="admin-row__actions">
            <button type="button" class="admin-btn" data-asp-status="${escapeAttr(a.id)}" data-status="dibaca">Tandai Dibaca</button>
            <button type="button" class="admin-btn" data-asp-status="${escapeAttr(a.id)}" data-status="selesai">Selesai</button>
            <button type="button" class="admin-btn admin-btn--danger" data-asp-del="${escapeAttr(a.id)}">Hapus</button>
          </div>
        </div>`,
      )
      .join('');
  } catch (err) {
    wrap.innerHTML = `<p class="admin-empty">${escapeHtml(err.message)}</p>`;
  }
}

$('#aspirasi-list').addEventListener('click', async (event) => {
  const st = event.target.closest('[data-asp-status]');
  const del = event.target.closest('[data-asp-del]');
  try {
    if (st) {
      await api('aspirasi-status', { id: st.dataset.aspStatus, status: st.dataset.status });
      renderAspirasi();
    }
    if (del && confirm('Hapus aspirasi ini secara permanen?')) {
      await api('aspirasi-delete', { id: del.dataset.aspDel });
      renderAspirasi();
    }
  } catch (err) {
    setNote(err.message, 'err');
  }
});

/* ------------------------------------------------------------------ */
/* Util                                                               */
/* ------------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const escapeAttr = escapeHtml;

/* Boot */
checkSession();

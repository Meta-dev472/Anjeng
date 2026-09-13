// ==========================================================================
// ADMIN API — Vercel Serverless Function (Node.js, ESM)
// --------------------------------------------------------------------------
// Satu endpoint untuk semua kebutuhan panel admin. Sesi = cookie HMAC
// HttpOnly (tanda tangan timestamp, tanpa penyimpanan server-side).
//
//   POST { "action": "login",    "pass": "..." }   → Set-Cookie sesi
//   POST { "action": "me" }                        → cek sesi
//   POST { "action": "logout" }                    → hapus cookie
//
//   GET  ?action=aspirasi                          → daftar aspirasi
//   POST { "action": "aspirasi-create", "data": … }
//   POST { "action": "aspirasi-status", "id": …, "status": "baru|dibaca|selesai" }
//   POST { "action": "aspirasi-delete", "id": … }
//
//   GET  ?action=content                           → { site, berita, galeri, struktur }
//   POST { "action": "content-save", "file": "site.json", "data": … }
//        → commit ke GitHub (main) → Vercel rebuild otomatis
//
// File ini berada di api/admin.js → otomatis tersaji di route /api/admin.
// Env yang wajib diisi di dashboard Vercel (Project → Settings → Environment
// Variables):
//   ADMIN_PASS_SHA256   sha256 hex dari password admin (bukan plaintext!)
//   ADMIN_SESSION_KEY   string acak panjang (≥ 32 char) untuk HMAC sesi
//   GITHUB_TOKEN        fine-grained token: Contents read+write pada repo ini
//   GITHUB_REPO         "owner/repo"
//   GITHUB_BRANCH       default "main"
//   ADMIN_PATH          path rahasia panel (mis. "portal-c41f8e"). Folder
//                       output admin/ di-rename saat build ke path ini, dan
//                       API menolak aksi tanpa header x-admin-path yang cocok
//                       (404). Fallback "admin" = lokal/dev.
//   BLOB_READ_WRITE_TOKEN — dibuat lewat Vercel Blob store di dashboard
//                           (Storage → Create Blob store → connect ke project);
//                           Vercel mengisi env ini otomatis saat store di-link.
// ==========================================================================

import crypto from 'node:crypto';
import { list, get, del, set } from '@vercel/blob';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/* ------------------------------ sesi ------------------------------ */

const COOKIE = 'osis_admin';

function signSession() {
  const ts = Date.now().toString();
  const mac = crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_KEY || '')
    .update(ts)
    .digest('hex');
  return `${ts}.${mac}`;
}

function verifySession(cookieValue) {
  if (!cookieValue) return false;
  const [ts, mac] = String(cookieValue).split('.');
  if (!ts || !mac) return false;
  const expect = crypto
    .createHmac('sha256', process.env.ADMIN_SESSION_KEY || '')
    .update(ts)
    .digest('hex');
  if (!safeEqual(mac, expect)) return false;
  // sesi berlaku 12 jam
  return Date.now() - Number(ts) < 12 * 60 * 60 * 1000;
}

function sessionCookie(value, maxAge) {
  const flags = [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
  ];
  return { 'set-cookie': flags.join('; ') };
}

const isAuthed = (request) => verifySession(parseCookies(request).get(COOKIE));

function parseCookies(request) {
  const map = new Map();
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return map;
}

/* ---------------------------- GitHub ------------------------------ */

const CONTENT_FILES = ['site.json', 'berita.json', 'galeri.json', 'struktur.json'];

async function ghRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'osis-admin-panel',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function githubGetContent(file) {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const data = await ghRequest(
    `/repos/${repo}/contents/content/${file}?ref=${encodeURIComponent(branch)}`,
  );
  return {
    sha: data.sha,
    text: Buffer.from(data.content || '', 'base64').toString('utf8'),
  };
}

async function githubSaveContent(file, text) {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const { sha } = await githubGetContent(file);
  return ghRequest(`/repos/${repo}/contents/content/${file}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `content(${file}): update dari panel admin`,
      content: Buffer.from(text, 'utf8').toString('base64'),
      sha,
      branch,
    }),
  });
}

/* --------------------------- aspirasi ----------------------------- */

// Vercel Blob: satu store, kunci "aspirasi/a:<uuid>" (prefix = folder).
const KEY_PREFIX = 'aspirasi/a:';

async function listAspirasi() {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: KEY_PREFIX, cursor });
    for (const blob of page.blobs) {
      const text = await get(blob.pathname);
      if (!text) continue;
      try {
        out.push(JSON.parse(text));
      } catch {
        /* entri rusak: lewati, jangan tumbangkan daftar */
      }
    }
    cursor = page.cursor;
  } while (cursor);
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return out;
}

const ASPIRASI_STATUS = new Set(['baru', 'dibaca', 'selesai']);

async function saveAspirasi(record) {
  await set(`${KEY_PREFIX}${record.id}`, JSON.stringify(record), {
    access: 'public',
    addRandomSuffix: false,
  });
}

/* --------------------------- handler ------------------------------ */

export default async function handler(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  let body = {};
  if (method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body bukan JSON valid' }, 400);
    }
  }

  const action = method === 'GET' ? url.searchParams.get('action') : body.action;

  /* ---------- gerbang path rahasia ----------
     Semua aksi KECUALI form publik wajib membawa header x-admin-path yang
     cocok dengan env ADMIN_PATH. Header ini hanya ada di halaman panel
     (path rahasianya sendiri). Respons 404, bukan 401 — supaya fuzzer
     melihat endpoint "tidak ada", bukan "terkunci". */
  const SECRET_PATH = (process.env.ADMIN_PATH || 'admin').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const givenPath = (request.headers.get('x-admin-path') || '').toLowerCase();
  const pathOk =
    givenPath.length > 0 &&
    givenPath.length === SECRET_PATH.length &&
    safeEqual(givenPath, SECRET_PATH);
  if (action !== 'aspirasi-public' && !pathOk) {
    return json({ error: 'Not Found' }, 404);
  }

  try {
    /* ---------- publik: kirim aspirasi dari form /kontak/ ---------- */
    if (action === 'aspirasi-public') {
      const { name, message } = body.data || {};
      const nama = String(name || '').trim();
      const pesan = String(message || '').trim();
      if (pesan.length < 10 || pesan.length > 1000 || nama.length > 80) {
        return json({ error: 'Data tidak valid' }, 400);
      }
      const id = crypto.randomUUID();
      await saveAspirasi({
        id,
        name: nama || 'Anonim',
        message: pesan,
        status: 'baru',
        createdAt: new Date().toISOString(),
      });
      return json({ ok: true });
    }

    /* ---------- auth ---------- */
    if (action === 'login') {
      const expect = process.env.ADMIN_PASS_SHA256;
      if (!expect) return json({ error: 'ADMIN_PASS_SHA256 belum diisi di env Vercel' }, 500);
      if (!body.pass || !safeEqual(sha256(String(body.pass)), expect)) {
        return json({ error: 'Password salah' }, 401);
      }
      return json(
        { ok: true },
        200,
        sessionCookie(signSession(), 12 * 60 * 60),
      );
    }
    if (action === 'logout') {
      return json({ ok: true }, 200, sessionCookie('', 0));
    }
    if (action === 'me') {
      return json({ authed: isAuthed(request) });
    }

    /* ---------- semua aksi lain wajib sesi ---------- */
    if (!isAuthed(request)) return json({ error: 'Belum masuk' }, 401);

    if (action === 'aspirasi') return json({ items: await listAspirasi() });

    if (action === 'aspirasi-status') {
      const { id, status } = body;
      if (!id || !ASPIRASI_STATUS.has(status)) return json({ error: 'Data tidak valid' }, 400);
      const pathname = `${KEY_PREFIX}${id}`;
      const text = await get(pathname);
      if (!text) return json({ error: 'Aspirasi tidak ditemukan' }, 404);
      const data = JSON.parse(text);
      data.status = status;
      await saveAspirasi(data);
      return json({ ok: true });
    }

    if (action === 'aspirasi-delete') {
      if (!body.id) return json({ error: 'id wajib' }, 400);
      await del(`${KEY_PREFIX}${body.id}`);
      return json({ ok: true });
    }

    if (action === 'content') {
      const out = {};
      for (const file of CONTENT_FILES) {
        try {
          const { text } = await githubGetContent(file);
          out[file.replace('.json', '')] = JSON.parse(text);
        } catch (err) {
          return json({ error: `Gagal membaca ${file}: ${err.message}` }, 502);
        }
      }
      return json(out);
    }

    if (action === 'content-save') {
      const { file, data } = body;
      const name = String(file || '');
      if (!CONTENT_FILES.includes(name)) return json({ error: 'File tidak dikenal' }, 400);
      if (data === undefined) return json({ error: 'data wajib' }, 400);
      // Validasi JSON sebelum commit — JSON rusak akan melumpuhkan build.
      let text;
      try {
        text = JSON.stringify(data, null, 2) + '\n';
        JSON.parse(text);
      } catch (err) {
        return json({ error: `JSON tidak valid: ${err.message}` }, 400);
      }
      await githubSaveContent(name, text);
      return json({ ok: true, note: 'Commit terkirim — deploy berjalan otomatis.' });
    }

    return json({ error: `Aksi tidak dikenal: ${action}` }, 400);
  } catch (err) {
    console.error('[admin-api]', err);
    return json({ error: err.message || 'Kesalahan server' }, 500);
  }
}

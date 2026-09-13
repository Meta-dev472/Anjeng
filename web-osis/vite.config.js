import { defineConfig, loadEnv } from 'vite';
import { readFileSync, readdirSync, existsSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';
import { loadContent, injectContent, generateBeritaPages } from './scripts/content.js';

// ==========================================================================
// OSIS SMK TEXAR KARAWANG — KONFIGURASI BUILD
//
// Situs ini adalah MPA (Multi-Page Application) yang terasa seperti SPA:
//   - Setiap route punya file HTML sungguhan  → URL & SEO asli
//   - Transisi antar halaman ditangani Swup   → tanpa reload
//
// Tiga pekerjaan yang dilakukan file ini:
//   1. Menemukan semua file HTML sebagai entry Vite (tanpa daftar manual)
//   2. Menyisipkan partial header/footer saat build  → tanpa duplikasi
//   3. Menghasilkan sitemap.xml & robots.txt dari daftar halaman itu
// ==========================================================================

const ROOT = process.cwd();

// Folder yang tidak dipindai sebagai halaman
// ('templates' berisi template mentah berita — bukan halaman yang layak disajikan)
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'src', 'public', 'templates', 'content', 'scripts', 'api']);

// Dipakai bila .env belum diisi — ganti dengan domain asli saat deploy
const DEFAULT_SITE_URL = 'https://osis.smktexarkarawang.sch.id';

/* --------------------------------------------------------------------------
   Utilitas: kumpulkan semua file HTML halaman (rekursif)
   -------------------------------------------------------------------------- */
function collectHtmlFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectHtmlFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.html')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/* Path file → URL halaman:  index.html → '/',  proker/index.html → '/proker/' */
function toPagePath(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'/index.html'.length) + '/';
  return '/' + rel;
}

/* Kedalaman URL dipakai untuk prioritas sitemap */
function pagePriority(pagePath) {
  if (pagePath === '/') return '1.0';
  const depth = pagePath.split('/').filter(Boolean).length;
  if (depth === 1) return '0.8';
  if (depth === 2) return '0.6';
  return '0.5';
}

/* --------------------------------------------------------------------------
   Plugin: partial HTML + URL per halaman (canonical/OG) + sitemap & robots
   -------------------------------------------------------------------------- */
function siteBlueprint(htmlFiles, siteUrl, adminPath) {
  // Panel admin di-deploy ke PATH RAHASIA dari env ADMIN_PATH (nama folder
  // output di-rename saat build). Sumbernya tetap admin/index.html di repo —
  // yang dirahasiakan hanya path produksi. Fallback 'admin' = lokal/dev.
  const ADMIN_SRC = resolve(ROOT, 'admin', 'index.html');

  const pages = htmlFiles
    .map((file) => ({ file, path: toPagePath(file) }))
    .filter(
      (page) =>
        page.path !== '/404.html' && // 404 tidak masuk sitemap
        resolve(page.file) !== ADMIN_SRC // panel admin tidak masuk sitemap
    )
    .sort((a, b) => a.path.localeCompare(b.path));

  const cache = new Map();

  const partialContent = (name) => {
    // Dibaca ulang setiap kali agar perubahan partial langsung terlihat di
    // mode dev (tanpa restart server).
    const file = resolve(ROOT, 'src/partials', name);
    cache.set(name, readFileSync(file, 'utf8'));
    return cache.get(name);
  };

  const inlinePartials = (html, depth = 0) => {
    if (depth > 5) return html; // jaga-jaga terhadap include melingkar
    return html.replace(/<!--\s*@include\s+([\w./-]+)\s*-->/g, (_match, name) =>
      inlinePartials(partialContent(name), depth + 1)
    );
  };

  // Di dev/preview, Vite tidak otomatis mengarahkan /profil → /profil/ seperti
  // Vercel (trailingSlash: true). Middleware kecil ini menyamakan perilakunya
  // supaya apa yang diuji di lokal sama dengan yang terjadi di produksi.
  const prettyUrlRedirect = () => (req, res, next) => {
    const [pathname, search] = req.url.split('?');
    if (pathname === '/' || pathname.endsWith('/')) return next();
    if (/\.[a-z0-9]+$/i.test(pathname)) return next();

    const candidate = resolve(ROOT, `.${pathname}`, 'index.html');
    if (!existsSync(candidate)) return next();

    res.writeHead(301, {
      Location: `${pathname}/${search ? `?${search}` : ''}`,
    });
    res.end();
  };

  return {
    name: 'osis:site-blueprint',

    configureServer(server) {
      server.middlewares.use(prettyUrlRedirect());
    },

    configurePreviewServer(server) {
      server.middlewares.use(prettyUrlRedirect());
    },

    // 0. Konten dari panel admin (content/*.json) disuntikkan ke region
    //    @content — JALAN SEBELUM partial agar hasil render ikut menemani
    //    header/footer. Berita detail juga digenerate ulang setiap build.
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const pagePath = toPagePath(ctx.filename);
        const pageUrl = siteUrl + pagePath;

        const withContent = injectContent(html, loadContent());

        let withPartials = inlinePartials(withContent)
          .replaceAll('%SITE_URL%', siteUrl)
          .replaceAll('%PAGE_URL%', pageUrl);

        // Halaman admin: sisipkan token path rahasia. Meta ini HANYA ada di
        // halaman admin — siapa pun yang tahu path rahasia otomatis tahu
        // token untuk memanggil /api/admin; yang tidak tahu path, dapat 404.
        if (resolve(ctx.filename) === ADMIN_SRC) {
          withPartials = withPartials.replace(
            '</head>',
            `  <meta name="x-admin-path" content="${adminPath}">\n  </head>`
          );
          return withPartials;
        }

        if (pagePath !== '/404.html' && !withPartials.includes(pageUrl)) {
          this.warn(
            `Halaman ${pagePath} belum memakai %PAGE_URL% (canonical/OG) — SEO-nya tidak lengkap.`
          );
        }

        return withPartials;
      },
    },

    // 2. Sitemap & robots dibuat dari daftar halaman yang sama
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);

      const urls = pages
        .filter((page) => page.path.startsWith('/admin') === false) // /admin/ tidak diindeks
        .map(
          (page) =>
            `  <url>\n` +
            `    <loc>${siteUrl}${page.path}</loc>\n` +
            `    <lastmod>${lastmod}</lastmod>\n` +
            `    <changefreq>${page.path === '/' ? 'weekly' : 'monthly'}</changefreq>\n` +
            `    <priority>${pagePriority(page.path)}</priority>\n` +
            `  </url>`
        )
        .join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `${urls}\n</urlset>\n`,
      });

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source:
          `User-agent: *\n` +
          `Allow: /\n\n` +
          `Sitemap: ${siteUrl}/sitemap.xml\n`,
      });

      this.info?.(`sitemap.xml & robots.txt dibuat untuk ${pages.length} halaman.`);
    },

    // 3. Rename output admin → path rahasia. Dilakukan SETELAH build menulis
    //    dist (closeBundle) — memutasi objek bundle secara langsung tidak
    //    didukung rolldown-vite (error pada Object.set). Sumber di repo tetap
    //    admin/index.html; dist produksi tidak pernah memuat /admin/.
    closeBundle() {
      if (adminPath === 'admin') return;
      const from = resolve(ROOT, 'dist', 'admin', 'index.html');
      if (!existsSync(from)) return;
      const to = resolve(ROOT, 'dist', adminPath, 'index.html');
      mkdirSync(join(ROOT, 'dist', adminPath), { recursive: true });
      renameSync(from, to);
      rmSync(resolve(ROOT, 'dist', 'admin'), { recursive: true, force: true });
      this.info?.(`Panel admin dipindah ke /${adminPath}/ (env ADMIN_PATH).`);
    },
  };
}

/* -------------------------------------------------------------------------- */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, '');
  const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

  // Path rahasia panel admin: env ADMIN_PATH (Vercel dashboard), bukan di repo.
  // Validasi ketat supaya nilai jahat tidak bisa traversal (../../dst.)
  const adminPath =
    (env.ADMIN_PATH || 'admin').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'admin';
  if (adminPath === 'api' || adminPath === 'assets') {
    throw new Error('ADMIN_PATH tidak boleh "api" atau "assets".');
  }

  // Halaman detail berita digenerate dulu dari content/berita.json ke
  // berita/<slug>/index.html, lalu dipindai bersama halaman lain.
  generateBeritaPages();
  const htmlFiles = collectHtmlFiles(ROOT);

  // Entry MPA: kunci bebas, Vite menyusun output mengikuti path relatif root
  const input = Object.fromEntries(
    htmlFiles.map((file) => {
      const path = toPagePath(file);
      const key =
        path === '/'
          ? 'index'
          : path.replace(/^\/|\/$/g, '').replace(/\//g, '--');
      return [key, file];
    })
  );

  return {
    // 'mpa' = tanpa fallback index.html, jadi perilaku dev sama dengan produksi
    appType: 'mpa',
    plugins: [siteBlueprint(htmlFiles, siteUrl, adminPath)],
    build: {
      rollupOptions: { input },
    },
  };
});

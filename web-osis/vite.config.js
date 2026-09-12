import { defineConfig, loadEnv } from 'vite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';

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
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'src', 'public']);

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
function siteBlueprint(htmlFiles, siteUrl) {
  const pages = htmlFiles
    .map((file) => ({ file, path: toPagePath(file) }))
    .filter((page) => page.path !== '/404.html') // 404 tidak masuk sitemap
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
  // Netlify. Middleware kecil ini menyamakan perilakunya supaya apa yang
  // diuji di lokal sama dengan yang terjadi di produksi.
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

    // 1. Partial + URL halaman (jalan di dev maupun build)
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const pagePath = toPagePath(ctx.filename);
        const pageUrl = siteUrl + pagePath;

        const withPartials = inlinePartials(html)
          .replaceAll('%SITE_URL%', siteUrl)
          .replaceAll('%PAGE_URL%', pageUrl);

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
  };
}

/* -------------------------------------------------------------------------- */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, '');
  const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

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
    plugins: [siteBlueprint(htmlFiles, siteUrl)],
    build: {
      rollupOptions: { input },
    },
  };
});

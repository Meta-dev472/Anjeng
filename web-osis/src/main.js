// ==========================================================================
// OSIS SMK TEXAR KARAWANG — ENTRY UTAMA
// Stack: Vite + GSAP (ScrollTrigger) + Lenis (smooth scroll) + Swup (routing)
//
// Cara kerja singkat:
//   - Situs ini MPA: setiap route punya file HTML sungguhan (URL & SEO asli).
//   - Swup mengambil halaman tujuan lalu menukar isi <main id="swup"> saja,
//     sehingga header, tema, dan instance Lenis tetap hidup → tanpa reload.
//   - Setelah konten ditukar, animasi halaman dibangun ULANG untuk konten baru.
//   - Semua init dibungkus safeInit() agar satu error tidak mematikan fitur lain.
// ==========================================================================

import 'lenis/dist/lenis.css';
import './style.css';

import Swup from 'swup';
import SwupHeadPlugin from '@swup/head-plugin';
import SwupPreloadPlugin from '@swup/preload-plugin';

import { prefersReducedMotion, safeInit } from './lib/motion.js';
import { initTheme } from './lib/theme.js';
import {
  initSmoothScroll,
  initHeaderState,
  initAnchorLinks,
  initScrollProgress,
  jumpToTop,
  glideToTop,
} from './lib/scroll.js';
import {
  preparePageAnimations,
  playPageAnimations,
  killPageAnimations,
  refreshPageAnimations,
  forceRevealAll,
  playHeaderIntro,
} from './lib/animations.js';
import { initNav, closeNav, syncActiveNav } from './lib/nav.js';
import { initGallery, destroyGallery, initLightboxKeys } from './lib/gallery.js';
import { initStats, destroyStats } from './lib/stats.js';
import { initAspirasiForm, destroyAspirasiForm } from './lib/aspirasi.js';

// --------------------------------------------------------------------------
// 1. TEMA — dipasang paling awal, tidak menunggu boot.
//    Header tidak ditukar Swup, jadi satu listener bertahan untuk selamanya.
// --------------------------------------------------------------------------
initTheme();

// --------------------------------------------------------------------------
// 2. SITUS — scroll mulus & tautan hash
// --------------------------------------------------------------------------
safeInit('smooth-scroll', initSmoothScroll);
safeInit('anchor-links', initAnchorLinks);
safeInit('scroll-progress', initScrollProgress);

// --------------------------------------------------------------------------
// 3. NAVIGASI — drawer, dropdown Proker, penanda halaman aktif
// --------------------------------------------------------------------------
safeInit('nav', initNav);

// --------------------------------------------------------------------------
// 4. LIFECYCLE HALAMAN
//    prepare → kondisi awal (dijalankan sebelum browser menggambar)
//    play    → memutar animasi masuk + menyiapkan komponen halaman
// --------------------------------------------------------------------------
function prepareCurrentPage() {
  if (prefersReducedMotion) return;
  safeInit('page-prepare', () => preparePageAnimations());
}

function playCurrentPage() {
  if (!prefersReducedMotion) {
    const played = safeInit('page-animations', () => playPageAnimations());
    // Jaring pengaman: konten tidak boleh tertinggal tersembunyi
    if (!played) safeInit('force-reveal', forceRevealAll);
  }

  safeInit('gallery', () => {
    initGallery();
    initLightboxKeys();
  });

  // Carousel statistik + count-up ber-IO (anime.js) — Beranda
  safeInit('stats', initStats);

  // Form aspirasi publik — /kontak/
  safeInit('aspirasi-form', initAspirasiForm);

  safeInit('active-nav', syncActiveNav);

  safeInit('year', () => {
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  });

  // Tinggi halaman baru sudah final setelah font siap → posisi trigger akurat
  safeInit('refresh', () => {
    refreshPageAnimations();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => refreshPageAnimations());
    }
  });
}

// --------------------------------------------------------------------------
// 5. ROUTING (Swup)
// --------------------------------------------------------------------------
function initRouter() {
  const swup = new Swup({
    // Hanya <main> yang ditukar; header & footer tetap (tanpa kedip)
    containers: ['#swup'],
    // Interupsi hanya tautan internal; mailto:, https:, dan anchor dibiarkan
    // ditangani browser / penanganan anchor di atas
    linkSelector: 'a[href^="/"]:not([data-no-swup])',
    animateHistoryBrowsing: true,
    plugins: [
      // Preload saat kursor menyentuh tautan → perpindahan terasa instan
      new SwupPreloadPlugin(),
      // <title> & meta tiap halaman tetap dipakai; aset tidak dimuat ulang
      new SwupHeadPlugin({
        persistAssets: true,
        attributes: ['lang', 'dir', 'data-page'],
      }),
    ],
  });

  swup.hooks.on('visit:start', () => {
    // Bersihkan state yang terikat pada halaman lama
    closeNav();
    destroyGallery();
    destroyStats();
    destroyAspirasiForm();
    killPageAnimations();

    // Naik ke atas dengan animasi (pilihan "ke atas dengan animasi")
    if (prefersReducedMotion) jumpToTop();
    else glideToTop();
  });

  // Dipanggil tepat setelah DOM ditukar — masih satu task, jadi browser
  // belum sempat menggambar dan animasi bisa dimulai tanpa kedipan.
  swup.hooks.on('content:replace', () => {
    jumpToTop();
    prepareCurrentPage();
  });

  swup.hooks.on('page:view', () => {
    playCurrentPage();
  });

  return swup;
}

// --------------------------------------------------------------------------
// 6. BOOT
// --------------------------------------------------------------------------
function boot() {
  safeInit('header-state', initHeaderState);

  // Halaman pertama: siapkan lalu putar animasinya
  prepareCurrentPage();
  playCurrentPage();

  // Animasi header hanya di load pertama — header tidak ikut ditukar
  safeInit('header-intro', playHeaderIntro);

  safeInit('router', initRouter);

  window.addEventListener('load', () => refreshPageAnimations());

  // Tandai aplikasi berhasil boot — mematikan pengaman anti-kedip di
  // src/partials/init.html sehingga class .js tetap dipertahankan.
  window.__osisBooted = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

import gsap from 'gsap';
import { prefersReducedMotion } from './motion.js';

// ==========================================================================
// TEMA TERANG / GELAP
// Nilai tema disimpan di localStorage dan diterapkan sebagai atribut
// [data-theme] pada <html>. Seluruh warna halaman mengikuti token CSS,
// jadi menukar atribut ini otomatis mengubah semua komponen.
// ==========================================================================

const THEME_KEY = 'osis-theme';

export function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute('data-theme', next);

  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {
    /* localStorage bisa diblokir (mode privat) — abaikan */
  }

  // Warna antarmuka browser (address bar) ikut menyesuaikan tema
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', next === 'dark' ? '#0a0a0a' : '#ffffff');

  // Transisi warna halus 450ms; class dibersihkan setelah selesai
  root.classList.add('theme-anim');
  setTimeout(() => root.classList.remove('theme-anim'), 450);

  if (!prefersReducedMotion) {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      gsap.fromTo(
        toggle,
        { rotate: -30, scale: 0.85 },
        { rotate: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' }
      );
    }
  }
}

/**
 * Dipasang SEKARANG (bukan menunggu boot) memakai event delegation, sehingga
 * tombol tema tetap hidup walau modul lain gagal. Header juga tidak ikut
 * ditukar Swup, jadi satu listener ini cukup untuk seluruh kunjungan.
 */
export function initTheme() {
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('#theme-toggle');
    if (!toggle) return;

    const next =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light'
        : 'dark';
    applyTheme(next);
  });
}

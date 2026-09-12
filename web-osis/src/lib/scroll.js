import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './motion.js';

gsap.registerPlugin(ScrollTrigger);

// ==========================================================================
// SMOOTH SCROLL (Lenis) + SINKRONISASI SCROLLTRIGGER
// Satu instance Lenis dipakai untuk seluruh sesi — termasuk setelah
// berpindah halaman, karena <main> ditukar tanpa memuat ulang dokumen.
// ==========================================================================

let lenis = null;

export function getLenis() {
  return lenis;
}

export function initSmoothScroll() {
  if (prefersReducedMotion) return null; // biarkan scroll native

  lenis = new Lenis({
    duration: 1.15, // makin besar makin "berat"
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out expo
    smoothWheel: true,
  });

  // Setiap frame Lenis, minta ScrollTrigger menghitung ulang
  lenis.on('scroll', ScrollTrigger.update);

  // Lenis digerakkan oleh ticker GSAP agar hanya ada satu loop rAF
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/**
 * Langsung (tanpa animasi) ke posisi paling atas. Dipakai tepat setelah
 * konten halaman ditukar supaya halaman baru selalu dimulai dari atas.
 */
export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

/** Naik ke atas dengan animasi halus (persis pilihan "ke atas dengan animasi") */
export function glideToTop() {
  if (lenis) lenis.scrollTo(0, { duration: 0.45, force: true });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Kunci scroll saat drawer mobile terbuka */
export function setScrollLock(locked) {
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}

// --------------------------------------------------------------------------
// HEADER — makin solid setelah halaman di-scroll
// --------------------------------------------------------------------------
export function initHeaderState() {
  const header = document.getElementById('header');
  if (!header) return;

  const sync = () => header.classList.toggle('header--scrolled', window.scrollY > 24);
  sync();

  if (lenis) lenis.on('scroll', sync);
  else window.addEventListener('scroll', sync, { passive: true });
}

// --------------------------------------------------------------------------
// ANCHOR DALAM SATU HALAMAN (mis. skip-link "#konten")
// Tautan antar halaman ditangani Swup; yang ini khusus hash di halaman aktif.
// --------------------------------------------------------------------------
export function initAnchorLinks() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;

    const target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();

    // Tutup drawer mobile bila sedang terbuka
    const navToggle = document.getElementById('nav-toggle');
    if (navToggle && navToggle.checked) {
      navToggle.checked = false;
      navToggle.dispatchEvent(new Event('change'));
    }

    if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.4 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
}

/** Fungsi bersama untuk tombol "kembali ke atas" bila ditambahkan nanti */
export function scrollToElement(el) {
  if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.2 });
  else el.scrollIntoView({ behavior: 'smooth' });
}

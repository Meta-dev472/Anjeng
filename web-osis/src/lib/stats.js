// ==========================================================================
// STATISTIK HERO — carousel kartu (ponsel) + count-up (anime.js)
// --------------------------------------------------------------------------
// PONSEL: track scroll-snap bisa di-swipe manual; anime.js menganimasikan
//   snap antar-slide (easeOutExpo), dot indicator, autoplay 4,5 detik yang
//   pause saat hover/sentuh & saat tab tersembunyi.
// DESKTOP: track menjadi display:contents (grid 3+2) — carousel idle,
//   count-up tetap jalan.
// COUNT-UP: baru dimulai saat kartu masuk viewport (IntersectionObserver),
//   bukan saat page load — pengguna yang scroll cepat tetap melihatnya.
// Tanpa JS: track tetap swipeable (scroll-snap native), angka statis utuh.
//
// CATATAN PERBAIKAN (jangan dihapus):
//   - Target slide dihitung dari offsetLeft kartu ASLI (bukan index ×
//     clientWidth): kartu terakhir full-width digeser gap 0.5rem, jadi
//     rumus index meleset → mandatory snap "menarik" track (lompatan).
//   - Saat tween anime berjalan, scroll-snap-type DINONAKTIFKAN dulu
//     (browser ikut re-snap tiap frame → animasi tersentak), lalu
//     diaktifkan lagi tepat di titik snap setelah tween selesai.
// ==========================================================================

import anime from 'animejs';
import { prefersReducedMotion, isTouchOnly } from './motion.js';

const AUTOPLAY_MS = 4500;
const EASE = 'easeOutExpo';

/* ------------------------------------------------------------------ */
/* State modul (dibersihkan lewat destroyStats saat pindah halaman)   */
/* ------------------------------------------------------------------ */
let observer = null;
let dotsBox = null;
let autoplayTimer = null;
let snapAnim = null;
let carouselRoot = null;
let snapTargets = [0];

/* ================================================================== */
/* 1. COUNT-UP — anime.js, dipicu IntersectionObserver                */
/* ================================================================== */
function countUp(node) {
  const target = Number.parseFloat(node.dataset.count);
  if (Number.isNaN(target)) return;
  const suffix = node.dataset.countSuffix || '';

  if (prefersReducedMotion) {
    node.textContent = `${Math.round(target)}${suffix}`;
    return;
  }

  const state = { value: 0 };
  anime({
    targets: state,
    value: target,
    round: 1,
    duration: 1400,
    easing: EASE,
    update: () => {
      node.textContent = `${Math.round(state.value)}${suffix}`;
    },
  });
}

/** Amati semua [data-count]; count-up jalan sekali saat kartu terlihat */
function initCountUp(root) {
  const nodes = root.querySelectorAll('[data-count]');
  if (!nodes.length) return;

  if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    nodes.forEach(countUp); // reduced-motion: langsung nilai akhir
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 },
  );

  nodes.forEach((node) => observer.observe(node));
}

/* ================================================================== */
/* 2. CAROUSEL — snap halus, dots, autoplay (hanya ponsel)            */
/* ================================================================== */

/**
 * Ukur posisi snap ASLI dari offsetLeft tiap kartu (diklem ke max scroll).
 * Dua kartu bersebelahan yang jaraknya < 40% layar dianggap satu halaman —
 * ini menangani kartu terakhir full-width yang mulus tanpa meleset gap.
 */
function measureTargets() {
  if (!carouselRoot) return;
  const track = carouselRoot.track;
  const max = track.scrollWidth - track.clientWidth;
  snapTargets = [0];

  Array.from(track.children).forEach((card) => {
    const pos = Math.min(Math.max(card.offsetLeft, 0), Math.max(max, 0));
    if (pos - snapTargets[snapTargets.length - 1] > track.clientWidth * 0.4) {
      snapTargets.push(pos);
    }
  });
}

function activePage() {
  if (!carouselRoot) return 0;
  const x = carouselRoot.track.scrollLeft;
  let best = 0;
  snapTargets.forEach((target, i) => {
    if (Math.abs(target - x) < Math.abs(snapTargets[best] - x)) best = i;
  });
  return best;
}

function renderDots() {
  if (!dotsBox) return;
  const total = snapTargets.length;
  const current = activePage();

  if (dotsBox.childElementCount !== total) {
    dotsBox.replaceChildren(
      ...Array.from({ length: total }, (_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'hero__stats-dot';
        dot.setAttribute('aria-label', `Ke slide ${i + 1} dari ${total}`);
        dot.addEventListener('click', () => goTo(i));
        return dot;
      }),
    );
  }

  [...dotsBox.children].forEach((dot, i) => {
    dot.classList.toggle('is-active', i === current);
  });
}

/**
 * Snap ke halaman tertentu — dianimasikan anime.js (easeOutExpo).
 * Scroll-snap dimatikan selama tween (konflik re-snap), dinyalakan lagi
 * tepat di titik target agar native swipe tetap dapat snap setelahnya.
 */
function goTo(index) {
  if (!carouselRoot) return;
  const track = carouselRoot.track;
  const clamped = Math.min(Math.max(index, 0), snapTargets.length - 1);
  const targetX = snapTargets[clamped];

  if (
    prefersReducedMotion ||
    typeof track.scrollTo !== 'function' ||
    track.clientWidth === 0
  ) {
    track.scrollLeft = targetX; // fallback tanpa animasi
    return;
  }

  if (snapAnim) {
    snapAnim.pause();
    snapAnim = null;
  }

  track.style.scrollSnapType = 'none';
  snapAnim = anime({
    targets: track,
    scrollLeft: targetX,
    duration: 750,
    easing: EASE,
    complete: () => {
      // Landing persis di titik snap → mengaktifkan kembali mandatory
      // snap tidak akan menarik track (tanpa lompatan).
      track.scrollLeft = targetX;
      track.style.scrollSnapType = '';
      snapAnim = null;
      renderDots();
    },
  });
}

/** Tween yang sedang jalan diselesaikan SEKETIKA di titik target —
 *  dipakai saat pengguna menyentuh track (hindari tarik-menarik snap). */
function finishSnapInstantly() {
  if (!snapAnim || !carouselRoot) return;
  const track = carouselRoot.track;
  const targetX = snapAnim.animations[0]?.to ?? track.scrollLeft;
  snapAnim.pause();
  snapAnim = null;
  track.scrollLeft = targetX;
  track.style.scrollSnapType = '';
}

/** Autoplay: jeda panjang (4,5s), berhenti saat hover/sentuh/sembunyi.
 *  reduced-motion: tidak ada autoplay — pengguna geser manual saja. */
function startAutoplay() {
  if (prefersReducedMotion) return;
  stopAutoplay();
  autoplayTimer = setInterval(() => {
    const next = (activePage() + 1) % snapTargets.length;
    goTo(next);
  }, AUTOPLAY_MS);
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

/** Ponsel saja (perangkat tanpa hover): pasang carousel + dots + autoplay */
function initCarousel(root) {
  if (!isTouchOnly) return; // desktop = grid statis, tanpa carousel
  const track = root.querySelector('.hero__stats-track');
  if (!track) return;

  carouselRoot = { root, track };

  dotsBox = document.createElement('div');
  dotsBox.className = 'hero__stats-dots';
  dotsBox.setAttribute('aria-hidden', 'true');
  root.appendChild(dotsBox);

  // Ukur ulang saat resize & setelah font siap (lebar kartu berubah)
  window.addEventListener('resize', onResize);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measureTargets();
      renderDots();
    });
  }

  // Geser manual (swipe/scroll) → sinkronkan dots (rAF throttled)
  let raf = 0;
  track.addEventListener(
    'scroll',
    () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        renderDots();
      });
    },
    { passive: true },
  );

  track.addEventListener('pointerdown', () => {
    finishSnapInstantly();
    stopAutoplay();
  });
  track.addEventListener('pointerup', startAutoplay);
  track.addEventListener('pointercancel', startAutoplay);

  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);

  document.addEventListener('visibilitychange', onVisibility);

  measureTargets();
  renderDots();
  startAutoplay();
}

let resizeRaf = 0;
function onResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    measureTargets();
    renderDots();
  });
}

function onVisibility() {
  if (document.hidden) stopAutoplay();
  else startAutoplay();
}

/* ================================================================== */
/* 3. API PUBLIK                                                      */
/* ================================================================== */
export function initStats() {
  // Count-up untuk SEMUA [data-count] di halaman (hero + stats-band) —
  // setara perilaku lama; carousel hanya untuk blok hero__stats.
  initCountUp(document);

  const root = document.querySelector('.hero__stats');
  if (root) initCarousel(root);
}

/** Bersihkan listener/observer/timer — dipanggil Swup visit:start */
export function destroyStats() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (snapAnim) {
    snapAnim.pause();
    snapAnim = null;
  }
  stopAutoplay();
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
  carouselRoot = null;
  dotsBox = null;
}

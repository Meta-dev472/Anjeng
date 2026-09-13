import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion, isTouchOnly } from './motion.js';

gsap.registerPlugin(ScrollTrigger);

// ==========================================================================
// ANIMASI HALAMAN (GSAP)
//
// Alur kerjanya sengaja dipisah dua tahap supaya TIDAK ada kedipan konten:
//   1. preparePageAnimations() — dipanggil tepat setelah DOM halaman ditukar
//      (masih dalam satu task yang sama, jadi browser belum sempat menggambar).
//      Di sini elemen hanya DITETAPKAN ke kondisi awal (tersembunyi).
//   2. playPageAnimations() — memutar animasi masuk. Karena kondisi awal
//      sudah dipegang GSAP, animasi cukup memakai .to() dan tidak ada
//      satu frame pun konten tampil lalu melompat.
// ==========================================================================

let introTween = null;

/* --------------------------------------------------------------------------
   Tahap 1 — kondisi awal
   -------------------------------------------------------------------------- */
export function preparePageAnimations(root = document) {
  if (prefersReducedMotion) return; // konten langsung tampil apa adanya

  const reveals = root.querySelectorAll('[data-reveal]');
  if (reveals.length) gsap.set(reveals, { opacity: 0, y: 48 });

  root.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
    if (group.children.length) gsap.set(group.children, { opacity: 0, y: 56 });
  });

  const intro = root.querySelectorAll('[data-intro]');
  if (intro.length) gsap.set(intro, { opacity: 0, y: 26 });

  // Media foto: kondisi awal zoom-out + transparan (direveal saat discroll)
  const revealImgs = root.querySelectorAll('[data-reveal-img]');
  if (revealImgs.length) gsap.set(revealImgs, { opacity: 0, scale: 0.88 });
}

/* --------------------------------------------------------------------------
   Tahap 2 — animasi masuk
   -------------------------------------------------------------------------- */
export function playPageAnimations(root = document) {
  if (prefersReducedMotion) return;

  // 1. Intro halaman (hero / page-hero) — diputar segera
  const intro = root.querySelectorAll('[data-intro]');
  if (intro.length) {
    introTween = gsap.to(intro, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      // Hero beranda kini memuat lebih banyak elemen berurutan (eyebrow →
      // judul → deskripsi → statistik → galeri → tombol), jadi jeda antar
      // elemen diperkecil agar rangkaiannya selesai sebelum pengguna mulai
      // membaca isi — 0.1s per elemen terasa lambat di halaman panjang.
      stagger: 0.08,
      delay: 0.04,
    });
  }

  // 2. Reveal saat elemen masuk viewport
  root.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  root.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
    gsap.to(group.children, {
      opacity: 1,
      y: 0,
      duration: 0.85,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });

  // 2b. Reveal media foto: zoom-in halus + fade saat masuk viewport.
  //     Transform pada ELEMEN MEDIA (bukan kartunya) agar tidak bentrok
  //     dengan efek hover scale yang juga menganimasikan elemen itu.
  root.querySelectorAll('[data-reveal-img]').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      scale: 1,
      duration: 1.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  // 3. Parallax: [data-parallax="60"] = bergeser 60% tinggi elemen saat scroll
  root.querySelectorAll('[data-parallax]').forEach((el) => {
    const amount = parseFloat(el.dataset.parallax);
    if (Number.isNaN(amount)) return;

    const trigger = el.closest('section') || el.parentElement;
    if (!trigger) return;

    gsap.to(el, {
      yPercent: amount,
      ease: 'none',
      scrollTrigger: {
        trigger,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  // 4. Tilt 3D mengikuti kursor (hanya perangkat ber-hover)
  initCardTilt(root);

  // 5. Angka beranimasi (Beranda)
}

/* --------------------------------------------------------------------------
   Header — animasi masuk HANYA di load pertama.
   Header tidak ikut ditukar Swup, jadi animasi ini tidak boleh diulang.
   clearProps penting: transform yang tertinggal membuat elemen fixed
   (drawer mobile) mengacu ke header, bukan ke viewport.
   -------------------------------------------------------------------------- */
export function playHeaderIntro() {
  if (prefersReducedMotion) return;

  gsap.from('.header', {
    y: -70,
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
    clearProps: 'all',
  });
}

function initCardTilt(root) {
  if (isTouchOnly || prefersReducedMotion) return;

  const cards = root.querySelectorAll('[data-tilt], .proker-card, .vision-card');
  const strength = 9;

  cards.forEach((card) => {
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      gsap.to(card, {
        rotateY: x * strength,
        rotateX: -y * strength,
        transformPerspective: 700,
        duration: 0.4,
        ease: 'power2.out',
      });
    });

    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power3.out' });
    });
  });
}

/* --------------------------------------------------------------------------
   Pembersihan & penyelamatan
   -------------------------------------------------------------------------- */

/** Buang semua ScrollTrigger sebelum konten lama dibuang (mencegah kebocoran) */
export function killPageAnimations() {
  if (introTween) {
    introTween.kill();
    introTween = null;
  }
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

/** Hitung ulang posisi trigger setelah tinggi/isi halaman berubah */
export function refreshPageAnimations() {
  ScrollTrigger.refresh();
}

/**
 * Jaring pengaman: kalau rangkaian animasi gagal di tengah jalan, konten
 * tidak boleh tertinggal tersembunyi.
 */
export function forceRevealAll() {
  // opacity ditulis eksplisit (1), bukan sekadar clearProps: aturan CSS
  // anti-kedip menyembunyikan elemen ini dan hanya inline style yang
  // bisa mengalahkannya.
  gsap.set('[data-reveal], [data-intro], [data-reveal-stagger] > *, [data-reveal-img]', {
    opacity: 1,
    y: 0,
    clearProps: 'transform',
  });

  // Media foto reveal: kembalikan skala juga
  gsap.set('[data-reveal-img]', { scale: 1 });

  // Angka beranimasi juga dihentikan di nilai akhirnya
  document.querySelectorAll('[data-count]').forEach((node) => {
    const target = Number.parseFloat(node.dataset.count);
    if (Number.isNaN(target)) return;
    node.textContent = `${Math.round(target)}${node.dataset.countSuffix || ''}`;
  });
}

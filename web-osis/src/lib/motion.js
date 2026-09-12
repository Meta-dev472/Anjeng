// ==========================================================================
// PREFERENSI GERAK & PEMBUNGKUS INIT
// Dipakai bersama oleh modul tema, animasi, navigasi, dan galeri.
// ==========================================================================

/** Pengguna yang memilih "kurangi gerakan" akan mendapat situs tanpa animasi */
export const prefersReducedMotion =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True bila halaman dibuka tanpa gesture hover (ponsel/tablet) */
export const isTouchOnly =
  typeof window.matchMedia === 'function' &&
  !window.matchMedia('(hover: hover)').matches;

/**
 * Jalankan satu init secara terisolasi.
 * Error pada satu fitur tidak boleh mematikan fitur lain — dan kegagalan
 * dilaporkan ke console agar bisa didiagnosis, bukan mati diam-diam.
 */
export function safeInit(name, fn) {
  try {
    fn();
    return true;
  } catch (err) {
    console.error(`[init:${name}] gagal:`, err);
    return false;
  }
}

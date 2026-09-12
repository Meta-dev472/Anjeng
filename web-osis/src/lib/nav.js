import { setScrollLock } from './scroll.js';

// ==========================================================================
// NAVIGASI
//   - Drawer mobile (checkbox hack)  → kunci scroll saat terbuka
//   - Submenu Proker                 → dropdown di desktop, accordion di mobile
//   - Penanda halaman aktif          → aria-current + class is-active
// Header TIDAK ikut ditukar Swup, jadi listener cukup dipasang sekali.
// ==========================================================================

const TOGGLE_ID = 'nav-toggle';
const MENU_ITEM = '.header__nav-item--menu';
const MENU_BUTTON = '#nav-proker-toggle';

/* --------------------------------------------------------------------------
   Submenu Proker
   -------------------------------------------------------------------------- */
function setProkerMenu(open) {
  const item = document.querySelector(MENU_ITEM);
  const button = document.querySelector(MENU_BUTTON);
  if (!item || !button) return;

  item.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
}

export function closeProkerMenu() {
  setProkerMenu(false);
}

/* --------------------------------------------------------------------------
   Tutup semua navigasi — dipanggil setiap kali berpindah halaman
   -------------------------------------------------------------------------- */
export function closeNav() {
  const input = document.getElementById(TOGGLE_ID);
  if (input && input.checked) {
    input.checked = false;
    input.dispatchEvent(new Event('change'));
  }
  closeProkerMenu();
}

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */
export function initNav() {
  const input = document.getElementById(TOGGLE_ID);

  // Kunci scroll halaman di belakang drawer saat menu mobile terbuka
  input?.addEventListener('change', () => setScrollLock(input.checked));

  const button = document.querySelector(MENU_BUTTON);
  const item = document.querySelector(MENU_ITEM);

  if (button && item) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setProkerMenu(!item.classList.contains('is-open'));
    });

    // Klik di luar menu menutup dropdown
    document.addEventListener('click', (event) => {
      if (!item.contains(event.target)) closeProkerMenu();
    });

    // Escape menutup dropdown dan mengembalikan fokus ke tombolnya
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!item.classList.contains('is-open')) return;
      closeProkerMenu();
      button.focus();
    });
  }

  syncActiveNav();
}

/* --------------------------------------------------------------------------
   Penanda halaman aktif
   -------------------------------------------------------------------------- */
function currentKey() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '');
  if (path === '' || path === 'index.html') return 'beranda';
  return path.replace(/\//g, '-'); // proker/akademik → proker-akademik
}

export function syncActiveNav() {
  const key = currentKey();

  // Tautan biasa: halaman ini persis
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const active = el.dataset.nav === key;
    el.classList.toggle('is-active', active);

    if (active && el.tagName === 'A') el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  // Induk menu (tombol Proker): aktif juga saat berada di halaman pilarnya
  document.querySelectorAll('[data-nav-parent]').forEach((el) => {
    const parent = el.dataset.navParent;
    el.classList.toggle('is-active', key === parent || key.startsWith(`${parent}-`));
  });
}

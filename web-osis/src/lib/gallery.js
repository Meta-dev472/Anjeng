import { setScrollLock } from './scroll.js';
import { refreshPageAnimations } from './animations.js';

// ==========================================================================
// GALERI — filter kategori + lightbox
//
// Semua foto masih berupa SLOT (placeholder). Begitu Anda menaruh
// <img src="..." alt="..."> di dalam item galeri, lightbox otomatis
// menampilkan gambar aslinya tanpa perubahan kode.
// ==========================================================================

const ICON = {
  close:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  prev:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  next:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
};

let lightbox = null;
let mediaBox = null;
let captionText = null;
let counter = null;
let openItem = null;
let visibleItems = [];
let currentIndex = 0;

/* --------------------------------------------------------------------------
   Lightbox
   -------------------------------------------------------------------------- */
function buildLightbox() {
  lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.id = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Pratinjau foto');
  lightbox.hidden = true;

  lightbox.innerHTML = `
    <button type="button" class="lightbox__backdrop" data-lightbox-close tabindex="-1" aria-label="Tutup pratinjau"></button>
    <div class="lightbox__panel">
      <figure class="lightbox__figure">
        <div class="lightbox__media" data-lightbox-media></div>
        <figcaption class="lightbox__caption">
          <span class="lightbox__text" data-lightbox-caption></span>
          <span class="lightbox__counter" data-lightbox-counter></span>
        </figcaption>
      </figure>
      <button type="button" class="lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="Foto sebelumnya">${ICON.prev}</button>
      <button type="button" class="lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="Foto berikutnya">${ICON.next}</button>
      <button type="button" class="lightbox__close" data-lightbox-close aria-label="Tutup pratinjau">${ICON.close}</button>
    </div>
  `;

  document.body.appendChild(lightbox);

  mediaBox = lightbox.querySelector('[data-lightbox-media]');
  captionText = lightbox.querySelector('[data-lightbox-caption]');
  counter = lightbox.querySelector('[data-lightbox-counter]');

  lightbox.querySelectorAll('[data-lightbox-close]').forEach((el) => {
    el.addEventListener('click', closeLightbox);
  });
  lightbox.querySelector('[data-lightbox-prev]').addEventListener('click', () => step(-1));
  lightbox.querySelector('[data-lightbox-next]').addEventListener('click', () => step(1));

  // Klik pada latar di luar panel menutup pratinjau
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

function renderLightbox() {
  const item = visibleItems[currentIndex];
  if (!item || !mediaBox) return;

  // Foto asli bila sudah ada <img>; kalau masih slot, pakai visual slotnya
  const source =
    item.querySelector('img') || item.querySelector('.photo__media') || null;

  const media = source
    ? source.cloneNode(true)
    : document.createElement('div');

  if (media.tagName === 'DIV' && !media.className) {
    media.className = 'photo__media photo__media--empty';
  }
  media.removeAttribute?.('id');

  mediaBox.replaceChildren(media);

  const caption = item.dataset.caption || '';
  captionText.textContent = caption;
  captionText.hidden = !caption;
  counter.textContent = `${currentIndex + 1} / ${visibleItems.length}`;
}

function openLightbox(item) {
  if (!lightbox) buildLightbox();

  visibleItems = collectVisibleItems();
  currentIndex = Math.max(0, visibleItems.indexOf(item));
  openItem = item;

  renderLightbox();
  lightbox.hidden = false;
  // Paksa reflow agar transisi masuk tetap berjalan
  void lightbox.offsetWidth;
  lightbox.classList.add('is-open');

  setScrollLock(true);
  document.documentElement.classList.add('lightbox-open');
  lightbox.querySelector('.lightbox__close')?.focus();
}

function step(direction) {
  if (visibleItems.length < 2) return;
  currentIndex = (currentIndex + direction + visibleItems.length) % visibleItems.length;
  renderLightbox();
}

export function closeLightbox() {
  if (!lightbox || lightbox.hidden) return;

  // Simpan referensinya: bila pengguna berpindah halaman lalu membuka
  // pratinjau lain dalam rentang 220ms, timeout ini tidak boleh menutup
  // pratinjau yang baru.
  const el = lightbox;
  el.classList.remove('is-open');
  setTimeout(() => {
    if (lightbox === el) el.hidden = true;
  }, 220);

  setScrollLock(false);
  document.documentElement.classList.remove('lightbox-open');
  openItem?.focus();
  openItem = null;
}

/* --------------------------------------------------------------------------
   Filter kategori
   -------------------------------------------------------------------------- */
function collectVisibleItems() {
  const root = document.querySelector('[data-gallery]');
  if (!root) return [];
  return [...root.querySelectorAll('[data-photo]')].filter((el) => !el.hidden);
}

function initFilters(root) {
  const chips = [...root.querySelectorAll('[data-filter]')];
  if (!chips.length) return;

  const countEl = root.querySelector('[data-gallery-count]');
  const emptyEl = root.querySelector('[data-gallery-empty]');

  const applyFilter = (value) => {
    const items = [...root.querySelectorAll('[data-photo]')];
    let shown = 0;

    items.forEach((item) => {
      const match = value === 'all' || item.dataset.category === value;
      item.hidden = !match;
      if (match) shown += 1;
    });

    chips.forEach((chip) => {
      const active = chip.dataset.filter === value;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    if (countEl) countEl.textContent = String(shown);
    if (emptyEl) emptyEl.hidden = shown !== 0;

    refreshPageAnimations();
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => applyFilter(chip.dataset.filter || 'all'));
  });

  applyFilter(chips.find((chip) => chip.classList.contains('is-active'))?.dataset.filter || 'all');
}

/* --------------------------------------------------------------------------
   Init & pembersihan (dipanggil ulang setiap halaman galeri dibuka)
   -------------------------------------------------------------------------- */
export function initGallery() {
  destroyGallery();

  const root = document.querySelector('[data-gallery]');
  if (!root) return;

  root.querySelectorAll('[data-photo]').forEach((item) => {
    item.addEventListener('click', () => openLightbox(item));
  });

  initFilters(root);
}

export function destroyGallery() {
  if (lightbox) {
    lightbox.remove();
    lightbox = null;
    mediaBox = null;
    captionText = null;
    counter = null;
    setScrollLock(false);
    document.documentElement.classList.remove('lightbox-open');
  }
  visibleItems = [];
  openItem = null;
}

/* Keyboard: Escape menutup, panah kiri/kanan berpindah foto */
export function initLightboxKeys() {
  if (window.__osisLightboxKeys) return;
  window.__osisLightboxKeys = true;

  document.addEventListener('keydown', (event) => {
    if (!lightbox || lightbox.hidden) return;

    if (event.key === 'Escape') closeLightbox();
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  });
}

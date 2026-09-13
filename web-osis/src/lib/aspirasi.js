// ==========================================================================
// FORM ASPIRASI PUBLIK — /kontak/
// --------------------------------------------------------------------------
// Kirim ke /api/admin (action: aspirasi-public → Vercel Blob).
// - Validasi client + tampilkan status inline (aria-live)
// - Honeypot "company" dicek di sisi client juga (bot yang isi → dibuang)
// - Aman di navigasi Swup: init per halaman, tidak dobel-listener
// ==========================================================================

const ENDPOINT = '/api/admin';

export function initAspirasiForm() {
  const form = document.getElementById('aspirasi-form');
  if (!form) return false;
  if (form.dataset.bound) return true;
  form.dataset.bound = '1';

  const status = form.querySelector('#aspirasi-status');
  const submit = form.querySelector('.aspirasi-form__submit');

  const setStatus = (msg, tone = '') => {
    if (!status) return;
    status.textContent = msg;
    status.dataset.tone = tone; // 'ok' | 'err' | ''
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const pesan = String(data.get('message') || '').trim();
    const nama = String(data.get('name') || '').trim();

    if (String(data.get('company') || '')) return; // honeypot terisi → abaikan
    if (pesan.length < 10) {
      setStatus('Aspirasi terlalu pendek — minimal 10 karakter.', 'err');
      form.querySelector('#aspirasi-pesan')?.focus();
      return;
    }

    const label = submit?.textContent;
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Mengirim…';
    }
    setStatus('');

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'aspirasi-public', data: { name: nama, message: pesan } }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Gagal mengirim (${res.status})`);

      form.reset();
      setStatus('Aspirasi terkirim. Terima kasih — pesanmu akan dibahas dalam rapat kepengurusan.', 'ok');
    } catch (err) {
      setStatus(
        err.message.includes('fetch')
          ? 'Gagal terhubung ke server. Coba lagi sebentar.'
          : err.message,
        'err',
      );
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = label || 'Kirim Aspirasi';
      }
    }
  });
}

export function destroyAspirasiForm() {
  const form = document.getElementById('aspirasi-form');
  if (form) delete form.dataset.bound;
}

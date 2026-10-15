/* Utilidades de interfaz: íconos, formato, badges, modal, toasts y radiografías sintéticas. */
(function () {
  const P = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
    triage: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
    stetho: '<path d="M11 2v2M5 2v2M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    chat: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    chart: '<path d="M3 3v18h18M8 17V9M13 17V5M18 17v-3"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
    spark: '<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    headset: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
    edit: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    arrowUp: '<path d="M7 17 17 7M7 7h10v10"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    userx: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    send: '<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    pen: '<path d="M12 20h9M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13M9 13a4.5 4.5 0 0 0 3-4M15 13a4.5 4.5 0 0 1-3-4"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  };
  const icon = (n, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + (P[n] || '') + '</svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const pad = (n) => String(n).padStart(2, '0');
  // Las fechas sin hora ("2026-10-15") se leen como fecha local: new Date() las tomaría como medianoche UTC (el día anterior en Argentina).
  const aFecha = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : new Date(s));
  const fDate = (iso) => { const d = aFecha(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
  const fTime = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const fShort = (iso) => { const d = new Date(iso); return DIAS[d.getDay()] + ' ' + pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + ' · ' + fTime(iso); };
  const fLong = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const RES = { normal: ['Normal', 'b-normal'], incierto: ['Incierto', 'b-incierto'], patologico: ['Patológico', 'b-patologico'] };
  const resBadge = (r, solid) => {
    if (!r) return '<span class="badge b-gray">Sin análisis</span>';
    const [l, c] = RES[r];
    const solidCls = { normal: 'b-solid-green', incierto: 'b-solid-amber', patologico: 'b-solid-red' }[r];
    return '<span class="badge ' + (solid ? solidCls : c) + '">' + l + '</span>';
  };
  const NIVEL = { baja: 'Baja', media: 'Media', alta: 'Alta' };

  /* ---------- Modal ---------- */
  const modalEl = () => document.getElementById('modal');
  function openModal({ title, body, foot, wide, onMount }) {
    const m = modalEl();
    m.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2>' + title + '</h2><button class="icon-btn" data-close aria-label="Cerrar">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + body + '</div>' + (foot ? '<div class="modal-foot">' + foot + '</div>' : '') + '</div>';
    m.hidden = false;
    m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    m.onclick = (ev) => { if (ev.target === m) closeModal(); };
    if (onMount) onMount(m.querySelector('.modal'));
    const first = m.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return m.querySelector('.modal');
  }
  function closeModal() { const m = modalEl(); m.hidden = true; m.innerHTML = ''; }
  function confirmModal(title, text, okLabel, onOk) {
    openModal({
      title, body: '<p style="margin:0">' + text + '</p>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="cm-ok">' + (okLabel || 'Confirmar') + '</button>',
      onMount: (m) => m.querySelector('#cm-ok').addEventListener('click', () => { closeModal(); onOk(); }),
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalEl().hidden) closeModal(); });

  function toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.innerHTML = icon(kind === 'warn' ? 'alert' : 'check') + '<span>' + text + '</span>';
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 3200);
  }

  function formData(root) {
    const o = {};
    root.querySelectorAll('[name]').forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    return o;
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- Radiografías ----------
     Un estudio tiene la imagen subida (dataURL en e.imagen) o una radiografía del conjunto de test del TP (e.imagenRef). */
  const refTest = (e) => (e.imagenRef && window.TEST_SET ? TEST_SET.find((t) => t.id === e.imagenRef) : null);
  const srcEstudio = (e) => e.imagen || (refTest(e) || {}).src || '';
  function xrayHtml(e) {
    const p = Store.paciente(e.pacienteId) || {};
    const tag = esc(p.nombre + ' · ' + e.tipo + (e.proyeccion ? ' ' + e.proyeccion : '') + ' · ' + fDate(e.fecha));
    const ar = e.imgAspect ? ' style="aspect-ratio:' + e.imgAspect + '"' : ' style="aspect-ratio:1"';
    return '<div class="xray"' + ar + '><img src="' + srcEstudio(e) + '" alt="Radiografía del estudio">' +
      '<canvas class="cam-layer" data-cam="' + e.id + '" width="448" height="448" hidden></canvas><span class="tag">' + tag + '</span></div>';
  }
  function mountXrays() { /* las imágenes se muestran directamente */ }
  /* Devuelve la imagen del estudio lista para pasarla a la CNN. */
  function fuenteEstudio(e) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('No se pudo leer la imagen del estudio')); im.src = srcEstudio(e); });
  }

  window.UI = { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays, fuenteEstudio, refTest, srcEstudio };
})();

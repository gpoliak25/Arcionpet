/* Vistas · helpers compartidos por todas las vistas. Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const S = () => Store.s;
  const A = Store.A;
  const go = (h) => { location.hash = h; };
  const ui = { qPac: '', qEst: '', qInf: '', qQa: '', qHemo: '', triage: 'todos', agenda: 7, hemoUbic: 'todas', hemoEstado: 'activas', analizando: {} };
  function pageHead(ic, title, sub, actions, color) {
    return '<div class="page-head"><div class="page-icon ' + (color || '') + '">' + icon(ic) + '</div>' +
      '<div class="page-title"><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
  }
  const searchBox = (id, ph, val) => '<label class="search">' + icon('search') + '<input id="' + id + '" placeholder="' + ph + '" value="' + esc(val) + '" autocomplete="off"></label>';
  const empty = (ic, t, s) => '<div class="empty"><div class="eic">' + icon(ic) + '</div><strong>' + t + '</strong>' + (s || '') + '</div>';
  const pacLabel = (p) => p ? esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ')</span>' : '<span class="muted">—</span>';
  const tutorName = (t) => t ? esc(t.apellido + ', ' + t.nombre) : '—';
  const match = (q, ...fields) => !q || fields.join(' ').toLowerCase().includes(q.toLowerCase());
  function bindSearch(root, id, key, rerender) {
    const el = root.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('input', () => { ui[key] = el.value; rerender(); });
  }
  function on(root, sel, ev, fn) { root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(el, e))); }
  const pacienteOptions = (sel, filtro) => S().pacientes.filter((p) => p.activo !== false || p.id === sel).filter(filtro || (() => true))
    .map((p) => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + ' (' + esc(p.especie) + ') — ' + tutorName(Store.tutor(p.tutorId)) + '</option>').join('');
  function kpi(ic, color, label, value, sub, href) {
    return '<div class="card kpi' + (href ? ' clickable" data-go="' + href : '') + '"><div class="ki ' + color + '">' + icon(ic) + '</div><div><div class="kl">' + label + '</div><div class="kv">' + value + '</div>' + (sub ? '<div class="ks">' + sub + '</div>' : '') + '</div></div>';
  }

  /* =========================================================== TURNOS */
  function turnoEstadoBadge(t) {
    const m = { confirmado: ['Confirmado', 'b-blue'], pendiente: ['Pedido del portal', 'b-incierto'], atendido: ['Atendido', 'b-normal'], no_vino: ['No vino', 'b-gray'], cancelado: ['Cancelado', 'b-gray'] }[t.estado];
    return '<span class="badge ' + m[1] + '">' + m[0] + '</span>';
  }

  /* "Asignado a": responsable del seguimiento (veterinarios de la clínica). */
  function asignadoSelect(coleccion, id, valor) {
    const editable = Store.puede(coleccion === 'estudios' ? 'triage' : coleccion, 'editar');
    if (!editable) return valor ? esc(Store.nombreUsuario(valor)) : '<span class="muted">Sin asignar</span>';
    return '<select class="asig" data-asig="' + coleccion + '" data-id="' + id + '" aria-label="Asignado a"><option value="">Sin asignar</option>' +
      Store.veterinarios().map((u) => '<option value="' + u.id + '"' + (u.id === valor ? ' selected' : '') + '>' + esc(u.nombre) + '</option>').join('') + '</select>';
  }
  function bindAsignados(root) {
    root.querySelectorAll('[data-asig]').forEach((s) => {
      s.addEventListener('click', (e) => e.stopPropagation());
      s.addEventListener('change', () => { Store.A.asignar(s.dataset.asig, s.dataset.id, s.value); UI.toast(s.value ? 'Asignado a ' + Store.nombreUsuario(s.value) : 'Sin asignar'); });
    });
  }
  /* Etiqueta de demora respecto del SLA configurado. */
  function demoraBadge(tipo, id) {
    const d = Store.demoraDe(tipo, id);
    return d ? ' <span class="badge b-solid-red" title="Supera el SLA de ' + d.limite + ' h">' + icon('clock') + ' Demorado ' + Math.round(d.horas) + ' h</span>' : '';
  }

  window.VC = { asignadoSelect, bindAsignados, demoraBadge, S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui };
  window.Views = Object.assign(window.Views || {}, { ui });
})();

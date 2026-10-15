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

  /* Calendario de un día con una columna por recurso (turnos de la clínica y de peluquería).
     o = { dia, recursos, turnos, agenda, segExtra, ayuda, subtitulo(r) }. */
  const PX_MIN = 1.2;
  const COLOR_TURNO = { pendiente: 'amber', confirmado: 'blue', atendido: 'green', no_vino: 'gray', cancelado: 'gray' };
  const isoDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const aMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  function calDia(o) {
    const { esc: e, fTime, fLong, icon: ic } = UI, TU = Dominio.turnos;
    const ag = o.agenda, ini = aMin(ag.inicio), finAg = aMin(ag.fin), dia = o.dia;
    const delDia = o.turnos.filter((t) => new Date(t.fecha).toDateString() === dia.toDateString() && t.estado !== 'cancelado');
    const occ = TU.ocupacion(o.turnos, o.recursos, dia, ag);
    const alto = (finAg - ini) * PX_MIN;
    const horas = []; for (let m = ini; m < finAg; m += 60) horas.push(m);
    const col = (r) => '<div class="cal-col" data-col="' + r.id + '" style="height:' + alto + 'px;background-size:100% ' + (60 * PX_MIN) + 'px">' +
      delDia.filter((t) => (t.recursos || []).includes(r.id)).map((t) => {
        const d = new Date(t.fecha), top = (d.getHours() * 60 + d.getMinutes() - ini) * PX_MIN, h = Math.max((t.duracion || 30) * PX_MIN - 2, 18);
        const p = Store.paciente(t.pacienteId) || {};
        return '<button class="cal-ev ' + COLOR_TURNO[t.estado] + '" data-ver="' + t.id + '" style="top:' + top + 'px;height:' + h + 'px" title="' + e(p.nombre + ' · ' + t.tipo + ' · ' + fTime(t.fecha) + ' · ' + (TU.ESTADOS[t.estado] || '')) + '"><b>' + fTime(t.fecha) + ' ' + e(p.nombre) + '</b><span>' + e(t.tipo) + '</span></button>';
      }).join('') + '</div>';
    return '<div class="card"><div class="card-head" style="flex-wrap:wrap;gap:10px"><span class="ic">' + ic('calendar') + '</span><h3 style="flex:1;min-width:180px">' + fLong(dia) + '</h3>' +
      '<div class="seg"><button data-dia="-1" aria-label="Día anterior">‹</button><button data-dia="0">Hoy</button><button data-dia="1" aria-label="Día siguiente">›</button></div>' +
      '<input type="date" id="cal-fecha" class="filter" value="' + isoDia(dia) + '">' + (o.segExtra || '') + '</div>' +
      (o.recursos.length ? '<div class="cal" style="grid-template-columns:52px repeat(' + o.recursos.length + ', minmax(150px, 1fr))">' +
        '<div></div>' + o.recursos.map((r) => '<div class="cal-h"><b>' + e(r.nombre) + '</b><span>' + e(o.subtitulo ? o.subtitulo(r) : TU.TIPOS_RECURSO[r.tipo]) + ' · ' + occ[r.id] + ' % ocupado</span></div>').join('') +
        '<div class="cal-horas" style="height:' + alto + 'px">' + horas.map((m) => '<span style="top:' + ((m - ini) * PX_MIN) + 'px">' + hhmm(m) + '</span>').join('') + '</div>' +
        o.recursos.map(col).join('') + '</div><p class="small muted" style="margin:10px 22px 16px">' + (o.ayuda || 'Hacé clic en un hueco para agendar con ese recurso y a esa hora, o en un turno para ver el detalle.') + '</p>'
        : empty('calendar', 'Sin recursos para mostrar', '')) + '</div>';
  }
  /* o = { dia, agenda, clave (ui donde se guarda el día), onSlot(recursoId, dia, hora), onVer(id) } */
  function bindCal(root, o) {
    on(root, '[data-dia]', 'click', (el) => { const d = new Date(o.dia); d.setDate(d.getDate() + Number(el.dataset.dia)); ui[o.clave] = el.dataset.dia === '0' ? null : isoDia(d); App.render(); });
    const fd = root.querySelector('#cal-fecha'); if (fd) fd.onchange = (ev) => { ui[o.clave] = ev.target.value || null; App.render(); };
    on(root, '.cal-ev', 'click', (el, ev) => { ev.stopPropagation(); o.onVer(el.dataset.ver); });
    on(root, '.cal-col', 'click', (el, ev) => {
      if (ev.target.closest('.cal-ev')) return;
      const r = el.getBoundingClientRect();
      const min = aMin(o.agenda.inicio) + Math.floor((ev.clientY - r.top) / PX_MIN / o.agenda.intervalo) * o.agenda.intervalo;
      o.onSlot(el.dataset.col, isoDia(o.dia), hhmm(min));
    });
  }

  window.VC = { asignadoSelect, bindAsignados, demoraBadge, S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui, calDia, bindCal, isoDia };
  window.Views = Object.assign(window.Views || {}, { ui });
})();

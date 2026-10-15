/* Vistas · Inicio. Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const { S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;

  /* =========================================================== INICIO */
  function inicio() {
    const s = S(), now = new Date(), h = now.getHours();
    const P = (m) => Store.puede(m);
    const nombre = Store.usuario().nombre.replace(/^(Dra?\.|Lic\.)\s+/, '').split(' ')[0];
    const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const hoy = s.turnos.filter((t) => Store.isToday(t.fecha) && !['cancelado'].includes(t.estado)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pendPortal = s.turnos.filter((t) => t.estado === 'pendiente');
    const borradores = s.informes.filter((i) => i.estado === 'borrador');
    const icActivas = s.interconsultas.filter((i) => i.estado !== 'cerrada');
    const propios = s.pacientes.filter((p) => p.origen === 'clinica').length;

    const att = [];
    if (P('imagenes')) Store.contradicciones().forEach((c) => { const p = Store.paciente(c.pacienteId) || {}; att.push({ ic: 'alert', c: 'red', t: 'Estudios contradictorios: ' + p.nombre, s: 'Mismo día, uno Normal y otro Patológico', go: '#/estudios/' + c.estudios[0] }); });
    const MOD_SLA = { triage: 'triage', derivaciones: 'derivaciones', interconsultas: 'interconsultas' }, TXT_SLA = { triage: 'Urgente sin informe firmado', derivaciones: 'Derivación sin respuesta', interconsultas: 'Interconsulta sin respuesta' };
    Store.demoras().filter((d) => P(MOD_SLA[d.tipo])).forEach((d) => att.push({ ic: 'clock', c: 'red', t: TXT_SLA[d.tipo] + ' · ' + Math.round(d.horas) + ' h', s: 'SLA ' + d.limite + ' h · ' + (d.asignadoA ? Store.nombreUsuario(d.asignadoA) : 'sin asignar'), go: d.tipo === 'triage' ? '#/estudios/' + d.id : d.tipo === 'interconsultas' ? '#/interconsultas/' + d.id : '#/derivaciones' }));
    if (P('informes')) borradores.forEach((i) => { const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId); att.push({ ic: 'file', c: '', t: 'Informe de ' + p.nombre, s: Store.puedeAccion('firmarInforme') ? 'Borrador para revisar y firmar' : 'Pendiente de firma del veterinario', go: '#/informes/' + i.id }); });
    if (P('turnos')) pendPortal.forEach((t) => { const p = Store.paciente(t.pacienteId); att.push({ ic: 'globe', c: 'green', t: 'Pedido de turno: ' + p.nombre, s: t.tipo + ' · ' + fShort(t.fecha) + ' · Portal Cliente', go: '#/turnos' }); });
    if (P('derivaciones')) s.derivaciones.filter((d) => d.estado === 'respondida' && !d.vista).forEach((d) => { const p = Store.paciente(Store.estudio(d.estudioId).pacienteId); att.push({ ic: 'stetho', c: 'green', t: 'Derivación respondida: ' + p.nombre, s: d.a, go: '#/derivaciones' }); });
    if (P('interconsultas')) s.interconsultas.filter((i) => i.noLeida).forEach((i) => att.push({ ic: 'chat', c: 'violet', t: 'Respuesta de soporte', s: i.asunto, go: '#/interconsultas/' + i.id }));
    if (P('inventario')) {
      const ia = Store.inventarioAlertas();
      if (ia.vencidos.length) att.push({ ic: 'alert', c: 'red', t: ia.vencidos.length + (ia.vencidos.length === 1 ? ' lote vencido' : ' lotes vencidos') + ' en farmacia', s: 'No se pueden vender: dar de baja', go: '#/farmacia' });
      ia.declaraciones.forEach((d) => att.push({ ic: 'clipboard', c: 'violet', t: 'Declarar en SIGTRAZAVET', s: ((Store.producto(d.productoId) || {}).nombre || '') + ' · lote ' + d.lote, go: '#/farmacia' }));
      if (ia.bajoMinimo.length) att.push({ ic: 'package', c: '', t: ia.bajoMinimo.length + (ia.bajoMinimo.length === 1 ? ' producto' : ' productos') + ' bajo el stock mínimo', s: ia.bajoMinimo.slice(0, 3).map((p) => p.nombre).join(', ') + (ia.bajoMinimo.length > 3 ? '…' : ''), go: '#/inventario' });
      if (ia.porVencer.length) att.push({ ic: 'clock', c: '', t: ia.porVencer.length + (ia.porVencer.length === 1 ? ' lote vence' : ' lotes vencen') + ' en 30 días', s: 'Farmacia veterinaria', go: '#/farmacia' });
    }
    if (P('hemocomponentes')) Store.hemoAlertas().forEach((x) => { const d = Store.daysBetween(new Date(), x.vence); att.push({ ic: 'drop', c: 'red', t: x.comp + ' ' + x.id, s: (d === 0 ? 'Vence hoy' : 'Vence en ' + d + ' d') + ' · ' + x.ubicacion, go: '#/hemocomponentes' }); });

    const recientes = Store.estudiosActivos().slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
    const pk = s.pack;

    const html =
      '<div class="greeting"><small>' + fLong(now) + '</small><h1>' + saludo + ', ' + esc(nombre) + ' 👋</h1>' +
      '<p>' + (att.length ? 'Tenés ' + att.length + (att.length === 1 ? ' cosa que necesita' : ' cosas que necesitan') + ' tu atención.' : 'Todo al día. ¡Buen trabajo!') + '</p></div>' +
      '<div class="grid kpis">' +
      (P('pacientes') ? kpi('paw', '', 'Pacientes', s.pacientes.filter((p) => p.activo !== false).length, 'propios y de la red', '#/pacientes') : '') +
      (P('turnos') ? kpi('calendar', '', 'Turnos de hoy', hoy.length, pendPortal.length ? pendPortal.length + ' pedido' + (pendPortal.length > 1 ? 's' : '') + ' del portal' : 'sin pedidos pendientes', '#/turnos') : '') +
      (P('informes') ? kpi('file', 'amber', Store.puedeAccion('firmarInforme') ? 'Informes para firmar' : 'Informes en borrador', borradores.length, '', '#/informes') : '') +
      (P('ventas') && Store.rol() !== 'veterinario' ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); const r = Dominio.ventas.resumen(s.ventas, d.toISOString()); return kpi('cart', 'violet', 'Ventas de hoy', '$ ' + Math.round(r.total).toLocaleString('es-AR'), r.cantidad + (r.cantidad === 1 ? ' venta' : ' ventas'), '#/ventas'); })() : '') +
      (P('interconsultas') ? kpi('chat', 'violet', 'Interconsultas activas', icActivas.length, '', '#/interconsultas') : '') +
      '</div>' +
      '<div class="grid two">' + (P('turnos') ?
      '<div class="card"><div class="card-head"><span class="ic">' + icon('clock') + '</span><h3>Agenda de hoy</h3><a class="link" href="#/turnos">Ver todo ' + icon('arrow') + '</a></div>' +
      (hoy.length ? hoy.map((t) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="att-ic green">' + icon('calendar') + '</div><div class="grow"><div class="t">' + fTime(t.fecha) + ' · ' + esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ')</span></div><div class="s">' + esc(t.tipo) + '</div></div>' + turnoEstadoBadge(t) + '</div>'; }).join('')
        : empty('calendar', 'Sin turnos para hoy', '<span class="small">Los turnos que reserven tus clientes desde el portal aparecen acá.</span>')) +
      '</div>' : '<div class="card">' + empty('paw', 'Bienvenido/a a ArcionPet', '<span class="small">Usá el menú para acceder a los módulos de tu rol.</span>') + '</div>') +
      '<div class="card"><div class="card-head"><h3>Necesita atención</h3></div>' +
      (att.length ? att.slice(0, 8).map((a) => '<div class="list-row clickable" data-go="' + a.go + '"><div class="att-ic ' + a.c + '">' + icon(a.ic) + '</div><div class="grow"><div class="t">' + esc(a.t) + '</div><div class="s">' + esc(a.s) + '</div></div></div>').join('') + (att.length > 8 ? '<div class="list-row"><span class="small muted">y ' + (att.length - 8) + ' pendiente' + (att.length - 8 > 1 ? 's' : '') + ' más (ver notificaciones)</span></div>' : '')
        : empty('check', 'Nada pendiente', '')) +
      '</div></div>' +
      ((P('imagenes') || P('interconsultas')) ? '<div class="grid two">' : '') + (P('imagenes') ?
      '<div class="card"><div class="card-head"><span class="ic">' + icon('scan') + '</span><h3>Estudios recientes</h3><a class="link" href="#/estudios">Ver todo ' + icon('arrow') + '</a></div>' +
      recientes.map((e) => { const p = Store.paciente(e.pacienteId); return '<div class="list-row clickable" data-go="#/estudios/' + e.id + '"><div class="grow"><div class="t">' + esc(p.nombre) + ' · ' + esc(e.tipo) + '</div><div class="s">' + esc(e.motivo) + '</div></div>' + resBadge(e.resultado) + '</div>'; }).join('') +
      '</div>' : '') + (P('interconsultas') ?
      '<div class="card"><div class="card-head"><span class="ic" style="color:var(--violet)">' + icon('headset') + '</span><h3>Soporte EISPLUS</h3><a class="link" href="#/interconsultas">Ver todo ' + icon('arrow') + '</a></div>' +
      '<div class="card-pad" style="padding-top:8px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="strong">' + esc(pk.nombre) + '</span><span class="muted">' + pk.usadas + ' / ' + pk.total + ' · quedan ' + (pk.total - pk.usadas) + '</span></div>' +
      '<div class="progress violet"><div style="width:' + (pk.usadas / pk.total * 100) + '%"></div></div>' +
      '<p class="small muted" style="margin:12px 0 0">Consultá casos dudosos con el equipo central de la red. El cupo se renueva el 1° de cada mes.</p>' +
      '<button class="btn sm" style="margin-top:14px" data-go="#/arcion">' + icon('spark') + 'Preguntale a ARCION Pet</button></div></div>' : '') +
      ((P('imagenes') || P('interconsultas')) ? '</div>' : '');
    return { html, mount(root) { on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); } };
  }

  Object.assign(window.Views, { inicio });
})();

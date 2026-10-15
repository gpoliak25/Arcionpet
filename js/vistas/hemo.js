/* Vistas · Banco de sangre: consolidado de la red, compatibilidad donante–receptor, transfusiones por paciente y
   solicitudes de unidades a la red. Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fShort, openModal, closeModal, toast, formData } = UI;
  const { S, A, pageHead, searchBox, empty, match, bindSearch, on, pacienteOptions, ui } = VC;
  const H = () => Dominio.hemo;
  const estado = (u) => Views.hemoEstadoEfectivo(u), badge = (u) => Views.hemoEstadoBadge(u), vence = (u) => Views.venceBadge(u);
  const editar = () => Store.puede('hemocomponentes', 'editar');
  const esVet = () => Store.rol() === 'veterinario';
  const NIVEL = { ok: ['green', 'Compatible'], precaucion: ['amber', 'Compatible con precauciones'], bloqueo: ['red', 'No compatible'] };
  const SOL = { enviada: ['Enviada', 'b-blue'], parcial: ['Parcial', 'b-incierto'], recibida: ['Recibida', 'b-normal'], cancelada: ['Cancelada', 'b-gray'] };

  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof H().ErrorHemo) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }
  const compatHtml = (c) => '<div class="callout ' + NIVEL[c.nivel][0] + '" style="display:block;margin:10px 0">' + icon(c.nivel === 'ok' ? 'check' : 'alert') + ' <b>' + NIVEL[c.nivel][1] + '</b>' +
    (c.motivos.length ? '<ul style="margin:6px 0 0;padding-left:18px">' + c.motivos.map((m) => '<li class="small">' + esc(m) + '</li>').join('') + '</ul>' : '') + '</div>';

  /* =========================================================== PÁGINA */
  function hemocomponentes() {
    const tab = ui.hemoTab || 'stock';
    const reservas = Store.reservasPorVencer();
    const alertas = Store.hemoAlertas().filter((u) => u.estado !== 'reservada');
    const abiertas = (S().hemoSolicitudes || []).filter((x) => ['enviada', 'parcial'].includes(x.estado));
    let cuerpo = '';
    if (tab === 'stock') cuerpo = stockHtml();
    if (tab === 'transfusiones') cuerpo = transfusionesHtml();
    if (tab === 'solicitudes') cuerpo = solicitudesHtml();
    const html = pageHead('drop', 'Consolidado de hemocomponentes', 'Stock de la clínica y de la red EISPLUS, con trazabilidad de cada unidad de su origen al paciente.',
      editar() ? '<button class="btn" id="btn-sol">' + icon('network') + 'Solicitar a la red</button><button class="btn primary" id="btn-ingreso">' + icon('plus') + 'Registrar ingreso</button>' : '', 'red') +
      (reservas.length ? '<div class="callout red" style="margin-bottom:14px;display:block">' + icon('alert') + ' <b>Reservas por vencer:</b> transfundí o liberá la unidad antes de que venza.' +
        reservas.map((u) => { const p = Store.paciente(u.pacienteId) || {}, d = Store.daysBetween(new Date(), u.vence); return '<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><span class="grow">' + esc(u.id) + ' · ' + esc(u.comp) + ' ' + esc(u.grupo) + ' · reservada para <b>' + esc(p.nombre || '') + '</b> · ' + (d === 0 ? 'vence hoy' : 'vence en ' + d + ' d') + '</span><button class="btn sm" data-u="' + u.id + '">Ver unidad</button></div>'; }).join('') + '</div>' : '') +
      (alertas.length ? '<div class="callout amber" style="margin-bottom:14px">' + icon('clock') + '<span><b>' + alertas.length + (alertas.length === 1 ? ' unidad vence' : ' unidades vencen') + ' pronto:</b> ' + alertas.map((u) => esc(u.id) + ' (' + esc(u.comp) + ', ' + esc(u.ubicacion) + ')').join(' · ') + '</span></div>' : '') +
      '<div class="tabs">' + [['stock', 'Stock'], ['transfusiones', 'Transfusiones'], ['solicitudes', 'Solicitudes a la red' + (abiertas.length ? ' (' + abiertas.length + ')' : '')]].map(([k, l]) => '<button data-htab="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' + cuerpo;
    return {
      html, mount(root) {
        on(root, '[data-htab]', 'click', (el) => { ui.hemoTab = el.dataset.htab; App.render(); });
        on(root, '[data-u]', 'click', (el) => unidad(el.dataset.u));
        on(root, '[data-sol]', 'click', (el) => solicitudDetalle(el.dataset.sol));
        const b = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
        b('#btn-ingreso', ingreso); b('#btn-sol', () => solicitudForm());
        if (tab === 'stock') {
          bindSearch(root, 'q-hemo', 'qHemo', () => App.render(true));
          on(root, '[data-ub]', 'click', (el) => { ui.hemoUbic = el.dataset.ub; App.render(); });
          on(root, '[data-es]', 'click', (el) => { ui.hemoEstado = el.dataset.es; App.render(); });
        }
      },
    };
  }

  function stockHtml() {
    const all = S().hemo;
    const activas = all.filter((u) => ['disponible', 'reservada'].includes(estado(u)));
    const lista = all.filter((u) => {
      const est = estado(u);
      if (ui.hemoUbic === 'clinica' && u.ubicacion !== 'Esta clínica') return false;
      if (ui.hemoUbic === 'red' && u.ubicacion === 'Esta clínica') return false;
      if (ui.hemoEstado === 'activas' && !['disponible', 'reservada'].includes(est)) return false;
      if (ui.hemoEstado === 'historial' && ['disponible', 'reservada'].includes(est)) return false;
      const p = u.pacienteId ? Store.paciente(u.pacienteId) : null;
      return match(ui.qHemo, u.id, u.comp, u.grupo, u.especie, u.ubicacion, u.donante, p ? p.nombre : '');
    }).sort((a, b) => a.vence.localeCompare(b.vence));
    return '<div class="hemo-types">' + H().COMPONENTES.map((c) => {
      const us = activas.filter((u) => u.comp === c), disp = us.filter((u) => estado(u) === 'disponible');
      const grupos = {}; disp.forEach((u) => { const k = u.especie.slice(0, 3) + ' ' + u.grupo; grupos[k] = (grupos[k] || 0) + 1; });
      return '<div class="card hemo-type"><div class="ht"><span class="drop-ic">' + icon('drop') + '</span>' + c + '</div><div class="hn">' + disp.length + '</div><div class="hs">disponibles · ' + disp.reduce((a, u) => a + u.volumen, 0) + ' ml' + (us.length - disp.length ? ' · ' + (us.length - disp.length) + ' reservada' + (us.length - disp.length > 1 ? 's' : '') : '') + '</div><div class="groups">' + (Object.entries(grupos).map(([g, n]) => '<span class="chip">' + esc(g) + ' · ' + n + '</span>').join('') || '<span class="small muted">Sin stock</span>') + '</div></div>';
    }).join('') + '</div>' +
      '<div class="toolbar">' + searchBox('q-hemo', 'Buscar por unidad, grupo, donante o paciente…', ui.qHemo) +
      '<div class="seg">' + [['todas', 'Toda la red'], ['clinica', 'Esta clínica'], ['red', 'Otras sedes']].map(([k, l]) => '<button data-ub="' + k + '" class="' + ((ui.hemoUbic || 'todas') === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      '<div class="seg">' + [['activas', 'En stock'], ['historial', 'Historial'], ['todas', 'Todas']].map(([k, l]) => '<button data-es="' + k + '" class="' + ((ui.hemoEstado || 'activas') === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Componente</th><th>Especie · grupo</th><th>Volumen</th><th>Ubicación</th><th>Vence</th><th>Estado</th><th class="actions">Trazabilidad</th></tr></thead><tbody>' +
      (lista.map((u) => { const p = u.pacienteId ? Store.paciente(u.pacienteId) : null; return '<tr class="clickable" data-u="' + u.id + '"><td class="strong nowrap">' + esc(u.id) + '</td><td>' + esc(u.comp) + '</td><td class="nowrap">' + esc(u.especie) + ' · ' + esc(u.grupo) + '</td><td>' + u.volumen + ' ml</td><td>' + esc(u.ubicacion) + '</td><td class="nowrap">' + vence(u) + '</td><td>' + badge(u) + (p ? '<div class="sp">' + esc(p.nombre) + '</div>' : '') + '</td><td class="actions"><button class="icon-btn" title="Ver trazabilidad">' + icon('eye') + '</button></td></tr>'; }).join('') ||
        '<tr><td colspan="8">' + empty('drop', 'Sin unidades', '<span class="small">Probá con otro filtro.</span>') + '</td></tr>') + '</tbody></table></div>';
  }

  function transfusionesHtml() {
    const tx = (S().hemoTransfusiones || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    return '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Unidad</th><th>Componente</th><th>Volumen</th><th>Prueba cruzada</th><th>Compatibilidad</th><th>Reacción</th><th>Veterinario/a</th></tr></thead><tbody>' +
      (tx.map((x) => { const p = Store.paciente(x.pacienteId) || {}; return '<tr><td class="nowrap">' + fShort(x.fecha) + '</td><td class="strong">' + esc(p.nombre || '') + '<div class="sp">' + esc(p.grupoSanguineo || 'sin tipificar') + '</div></td><td class="clickable" data-u="' + x.unidadId + '">' + esc(x.unidadId) + '</td><td>' + esc(x.comp) + '<div class="sp">' + esc(x.grupoUnidad) + '</div></td><td>' + x.volumen + ' ml</td><td>' + (x.pruebaCruzada === 'compatible' ? 'Compatible' : 'No realizada') + '</td><td><span class="badge ' + ({ ok: 'b-normal', precaucion: 'b-incierto', bloqueo: 'b-patologico' })[x.compatibilidad || 'ok'] + '">' + NIVEL[x.compatibilidad || 'ok'][1] + '</span></td><td>' + esc(H().REACCIONES[x.reaccion] || '') + (x.reaccionDetalle ? '<div class="sp">' + esc(x.reaccionDetalle) + '</div>' : '') + '</td><td>' + esc(x.veterinario || '') + '</td></tr>'; }).join('') ||
        '<tr><td colspan="9">' + empty('drop', 'Sin transfusiones registradas', '') + '</td></tr>') + '</tbody></table></div>';
  }

  function solicitudesHtml() {
    const sols = (S().hemoSolicitudes || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    return '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Pedido</th><th>Para</th><th>Urgencia</th><th>Unidades</th><th>Estado</th></tr></thead><tbody>' +
      (sols.map((x) => { const p = x.pacienteId ? Store.paciente(x.pacienteId) : null; return '<tr class="clickable" data-sol="' + x.id + '"><td class="nowrap">' + fShort(x.fecha) + '</td><td>' + x.cantidad + ' × ' + esc(x.comp) + ' · ' + esc(x.especie) + ' ' + esc(x.grupo || '(cualquier grupo)') + '<div class="sp">' + esc(x.motivo) + '</div></td><td>' + (p ? esc(p.nombre) : 'Stock de la clínica') + '</td><td>' + (x.urgencia === 'urgente' ? '<span class="badge b-patologico">Urgente</span>' : 'Normal') + '</td><td>' + x.unidades.length + ' de ' + x.cantidad + '</td><td><span class="badge ' + SOL[x.estado][1] + '">' + SOL[x.estado][0] + '</span></td></tr>'; }).join('') ||
        '<tr><td colspan="6">' + empty('network', 'Sin solicitudes a la red', editar() ? '<span class="small">Pedí unidades con “Solicitar a la red”.</span>' : '') + '</td></tr>') + '</tbody></table></div>';
  }

  /* =========================================================== UNIDAD */
  const EV_CLS = { extraccion: '', proceso: '', traslado: '', reserva: 'amber', transfusion: '', vencimiento: 'red', descarte: 'red', liberacion: 'amber' };
  function unidad(id) {
    const u = S().hemo.find((x) => x.id === id), est = estado(u), p = u.pacienteId ? Store.paciente(u.pacienteId) : null;
    const enClinica = u.ubicacion === 'Esta clínica', ed = editar();
    let acciones = '';
    if (ed && est === 'disponible' && enClinica) acciones = '<button class="btn" id="h-res">Reservar para paciente</button>' + (esVet() ? '<button class="btn primary" id="h-tx">Transfundir</button>' : '');
    if (ed && est === 'disponible' && !enClinica) acciones = '<button class="btn primary" id="h-tras">Pedir a esta clínica</button>';
    if (ed && est === 'reservada') acciones = '<button class="btn" id="h-lib">Liberar reserva</button>' + (esVet() ? '<button class="btn primary" id="h-tx">Registrar transfusión</button>' : '');
    if (ed && est === 'vencida') acciones = '<button class="btn danger" id="h-desc">Registrar descarte</button>';
    openModal({
      title: 'Unidad ' + esc(u.id), wide: true,
      body: '<div class="grid halves" style="margin:0"><div><dl class="dl"><dt>Componente</dt><dd>' + esc(u.comp) + '</dd><dt>Especie · grupo</dt><dd>' + esc(u.especie) + ' · ' + esc(u.grupo) + '</dd><dt>Volumen</dt><dd>' + u.volumen + ' ml</dd><dt>Donante</dt><dd>' + esc(u.donante) + '</dd><dt>Extracción</dt><dd>' + fDate(u.extraccion) + '</dd><dt>Vencimiento</dt><dd>' + vence(u) + '</dd><dt>Ubicación</dt><dd>' + esc(u.ubicacion) + '</dd><dt>Estado</dt><dd>' + badge(u) + (p ? ' · ' + esc(p.nombre) + ' (' + esc(p.grupoSanguineo || 'sin tipificar') + ')' : '') + '</dd></dl>' +
        (p && est === 'reservada' ? compatHtml(H().compatibilidad(u, p, S().hemoTransfusiones, new Date())) : '') +
        '<div id="h-form" style="margin-top:16px"></div></div>' +
        '<div><div class="section-title" style="margin-top:0">Trazabilidad: del origen al paciente</div><ul class="timeline">' +
        u.eventos.map((ev) => '<li class="' + (EV_CLS[ev.tipo] || '') + '"><div class="tt">' + esc(ev.texto) + '</div><div class="ts">' + fDate(ev.fecha) + ' · ' + esc(ev.lugar) + '</div></li>').join('') + '</ul></div></div>',
      foot: '<button class="btn" data-close>Cerrar</button>' + acciones,
      onMount(m) {
        const form = m.querySelector('#h-form');
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        b('#h-res', () => reservaForm(form, u));
        b('#h-tx', () => transfusionForm(form, u));
        b('#h-lib', () => { A.hemoEvento(id, 'liberacion', 'Reserva liberada por ' + Store.usuario().nombre, { estado: 'disponible', pacienteId: null }); toast('Reserva liberada'); closeModal(); });
        b('#h-desc', () => { A.hemoEvento(id, 'descarte', 'Descartada por vencimiento (' + Store.usuario().nombre + ')', { estado: 'descartada' }); toast('Descarte registrado'); closeModal(); });
        b('#h-tras', () => { closeModal(); setTimeout(() => solicitudForm({ comp: u.comp, especie: u.especie, grupo: u.grupo, unidadId: u.id }), 30); });
      },
    });
  }

  /* Selector de paciente con el control de compatibilidad en vivo. */
  function selectorPaciente(form, u, fijo) {
    const opts = fijo ? '<option value="' + fijo.id + '">' + esc(fijo.nombre) + '</option>' : pacienteOptions(null, (x) => x.especie === u.especie);
    if (!opts) { toast('No hay pacientes ' + u.especie.toLowerCase() + 's en la clínica', 'warn'); return null; }
    form.innerHTML = '<div class="field"><label>Paciente receptor</label><select id="h-pac"' + (fijo ? ' disabled' : '') + '>' + opts + '</select></div><div id="h-compat"></div><div id="h-just" class="field" style="display:none"><label>Justificación (unidad no compatible) *</label><textarea id="h-justif" style="min-height:50px" placeholder="Ej.: emergencia sin unidades compatibles, decisión del veterinario"></textarea></div><div id="h-extra"></div>';
    const sel = form.querySelector('#h-pac');
    const ver = () => { const c = H().compatibilidad(u, Store.paciente(sel.value), S().hemoTransfusiones, new Date()); form.querySelector('#h-compat').innerHTML = compatHtml(c); form.querySelector('#h-just').style.display = c.nivel === 'bloqueo' ? '' : 'none'; return c; };
    sel.onchange = ver; ver();
    return { sel, just: () => form.querySelector('#h-justif').value.trim() };
  }
  function reservaForm(form, u) {
    const s = selectorPaciente(form, u); if (!s) return;
    form.querySelector('#h-extra').innerHTML = '<button class="btn primary sm" id="h-go">Confirmar reserva</button>';
    form.querySelector('#h-go').onclick = () => intentar(() => A.reservarHemo(u.id, s.sel.value, s.just()), () => { closeModal(); toast('Unidad reservada para ' + Store.paciente(s.sel.value).nombre); });
  }
  function transfusionForm(form, u) {
    const s = selectorPaciente(form, u, u.pacienteId ? Store.paciente(u.pacienteId) : null); if (!s) return;
    form.querySelector('#h-extra').innerHTML = '<div class="form-grid" style="margin-top:6px">' +
      '<div class="field"><label>Volumen administrado (ml)</label><input type="number" id="t-vol" min="1" max="' + u.volumen + '" value="' + u.volumen + '"></div>' +
      '<div class="field"><label>Prueba cruzada</label><select id="t-pc"><option value="compatible">Compatible</option><option value="no_realizada">No realizada</option></select></div>' +
      '<div class="field full"><label>Premedicación</label><input id="t-pre" placeholder="Opcional"></div>' +
      '<div class="field"><label>Reacciones</label><select id="t-re">' + Object.entries(H().REACCIONES).map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Detalle de la reacción</label><input id="t-red" placeholder="Si hubo"></div></div>' +
      '<button class="btn primary sm" id="h-go" style="margin-top:10px">Registrar transfusión</button>';
    form.querySelector('#h-go').onclick = () => {
      const q = (x) => form.querySelector(x).value;
      intentar(() => A.transfundir(u.id, { pacienteId: s.sel.value, volumen: Number(q('#t-vol')), pruebaCruzada: q('#t-pc'), premedicacion: q('#t-pre'), reaccion: q('#t-re'), reaccionDetalle: q('#t-red'), justificacion: s.just() }), () => { closeModal(); toast('Transfusión registrada en la ficha del paciente'); });
    };
  }

  /* =========================================================== SOLICITUDES A LA RED */
  function solicitudForm(pre) {
    pre = pre || {};
    openModal({
      title: 'Solicitar unidades a la red',
      body: '<div class="form-grid">' +
        '<div class="field full"><label>Para el paciente (opcional)</label><select name="pacienteId" id="s-pac"><option value="">— Stock de la clínica —</option>' + pacienteOptions(null, (x) => x.especie !== 'Otro') + '</select></div>' +
        '<div class="field"><label>Componente</label><select name="comp">' + H().COMPONENTES.map((c) => '<option' + (c === pre.comp ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Especie</label><select name="especie" id="s-esp">' + Object.keys(H().GRUPOS).map((e) => '<option' + (e === pre.especie ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Grupo</label><select name="grupo" id="s-gr"></select></div>' +
        '<div class="field"><label>Cantidad</label><input type="number" name="cantidad" min="1" max="10" value="1"></div>' +
        '<div class="field"><label>Urgencia</label><select name="urgencia"><option value="normal">Normal</option><option value="urgente">Urgente</option></select></div>' +
        '<div class="field full"><label>Motivo *</label><input name="motivo" placeholder="Ej.: anemia hemolítica, cirugía programada"></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="s-ok">Enviar solicitud</button>',
      onMount(m) {
        const esp = m.querySelector('#s-esp'), gr = m.querySelector('#s-gr'), pac = m.querySelector('#s-pac');
        const grupos = (sel) => { gr.innerHTML = '<option value="">Cualquier grupo</option>' + H().GRUPOS[esp.value].map((g) => '<option' + (g === sel ? ' selected' : '') + '>' + g + '</option>').join(''); };
        grupos(pre.grupo); esp.onchange = () => grupos();
        pac.onchange = () => { const p = Store.paciente(pac.value); if (p) { esp.value = p.especie; grupos(p.grupoSanguineo); } };
        m.querySelector('#s-ok').onclick = () => {
          const f = formData(m);
          intentar(() => {
            const s = A.solicitarHemo({ pacienteId: f.pacienteId || null, comp: f.comp, especie: f.especie, grupo: f.grupo || null, cantidad: Number(f.cantidad), urgencia: f.urgencia, motivo: f.motivo.trim() });
            if (pre.unidadId) A.asignarHemo(s.id, pre.unidadId);
            return s;
          }, (s) => { closeModal(); ui.hemoTab = 'solicitudes'; toast(pre.unidadId ? 'Unidad ' + pre.unidadId + ' trasladada a esta clínica' : 'Solicitud enviada a la red'); setTimeout(() => solicitudDetalle(s.id), 50); });
        };
      },
    });
  }

  function solicitudDetalle(id) {
    const s = S().hemoSolicitudes.find((x) => x.id === id), p = s.pacienteId ? Store.paciente(s.pacienteId) : null;
    const abierta = ['enviada', 'parcial'].includes(s.estado);
    const cand = abierta ? H().candidatas(S().hemo, s, new Date()) : [];
    openModal({
      title: 'Solicitud a la red <span class="badge ' + SOL[s.estado][1] + '">' + SOL[s.estado][0] + '</span>', wide: true,
      body: '<dl class="dl"><dt>Pedido</dt><dd>' + s.cantidad + ' × ' + esc(s.comp) + ' · ' + esc(s.especie) + ' ' + esc(s.grupo || '(cualquier grupo)') + '</dd><dt>Para</dt><dd>' + (p ? esc(p.nombre) + ' (' + esc(p.grupoSanguineo || 'sin tipificar') + ')' : 'Stock de la clínica') + '</dd><dt>Motivo</dt><dd>' + esc(s.motivo) + '</dd><dt>Urgencia</dt><dd>' + (s.urgencia === 'urgente' ? 'Urgente' : 'Normal') + '</dd><dt>Enviada</dt><dd>' + fShort(s.fecha) + '</dd>' +
        (s.unidades.length ? '<dt>Recibidas</dt><dd>' + s.unidades.map((x) => esc(x.unidadId) + ' desde ' + esc(x.sede)).join('<br>') + '</dd>' : '') + '</dl>' +
        (abierta ? '<div class="section-title">Unidades disponibles en la red</div>' + (cand.length ? cand.map((u) => { const c = p ? H().compatibilidad(u, p, S().hemoTransfusiones, new Date()) : null; return '<div class="list-row"><div class="grow"><span class="t">' + esc(u.id) + ' · ' + esc(u.comp) + ' ' + esc(u.grupo) + ' · ' + u.volumen + ' ml</span><div class="s">' + esc(u.ubicacion) + ' · vence ' + fDate(u.vence) + (c ? ' · <b>' + NIVEL[c.nivel][1] + '</b>' : '') + '</div></div>' + (editar() ? '<button class="btn sm primary" data-asig="' + u.id + '">Pedir traslado</button>' : '') + '</div>'; }).join('')
          : '<p class="muted small">Todavía no hay unidades que cubran el pedido. La solicitud queda visible para las sedes de la red.</p>' + (Store.demo ? '<button class="btn sm" id="s-sim">Simular respuesta de la red</button>' : '')) : ''),
      foot: '<button class="btn" data-close>Cerrar</button>' + (abierta && editar() ? '<button class="btn ghost" id="s-cancel">Cancelar solicitud</button>' : ''),
      onMount(m) {
        m.querySelectorAll('[data-asig]').forEach((b) => { b.onclick = () => intentar(() => A.asignarHemo(id, b.dataset.asig), (r) => { closeModal(); toast('Unidad ' + b.dataset.asig + ' trasladada a esta clínica' + (r.pacienteId ? ' y reservada' : '')); setTimeout(() => solicitudDetalle(id), 50); }); });
        const sim = m.querySelector('#s-sim'); if (sim) sim.onclick = () => { A.simularRespuestaRed(id); closeModal(); setTimeout(() => solicitudDetalle(id), 50); };
        const bc = m.querySelector('#s-cancel'); if (bc) bc.onclick = () => { A.cancelarSolicitudHemo(id); closeModal(); toast('Solicitud cancelada'); };
      },
    });
  }

  /* =========================================================== INGRESO */
  function ingreso() {
    openModal({
      title: 'Registrar ingreso de unidad',
      body: '<div class="form-grid">' +
        '<div class="field"><label>Componente</label><select name="comp">' + H().COMPONENTES.map((c) => '<option>' + c + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Especie</label><select name="especie" id="h-esp"><option>Canino</option><option>Felino</option></select></div>' +
        '<div class="field"><label>Grupo</label><select name="grupo" id="h-gr"></select></div>' +
        '<div class="field"><label>Volumen (ml)</label><input type="number" name="volumen" value="250"></div>' +
        '<div class="field"><label>Donante</label><input name="donante" placeholder="Nombre del donante"></div>' +
        '<div class="field"><label>Vencimiento</label><input type="date" name="vence" value="' + new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10) + '"></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="hi-ok">Registrar</button>',
      onMount(m) {
        const esp = m.querySelector('#h-esp'), gr = m.querySelector('#h-gr');
        const sync = () => { gr.innerHTML = H().GRUPOS[esp.value].map((g) => '<option>' + g + '</option>').join(''); };
        sync(); esp.onchange = sync;
        m.querySelector('#hi-ok').onclick = () => {
          const f = formData(m);
          if (!f.donante) return toast('Indicá el donante', 'warn');
          if (!(+f.volumen > 0)) return toast('Indicá el volumen', 'warn');
          const n = 450 + S().hemo.length, now = new Date().toISOString();
          const u = { id: 'HC-0' + n, comp: f.comp, especie: f.especie, grupo: f.grupo, volumen: +f.volumen, donante: f.donante + ' (' + f.especie + ')', ubicacion: 'Esta clínica', extraccion: now, vence: new Date(f.vence + 'T12:00:00').toISOString(), estado: 'disponible', pacienteId: null,
            eventos: [{ fecha: now, tipo: 'extraccion', texto: 'Extracción a donante ' + f.donante, lugar: 'Esta clínica' }, { fecha: now, tipo: 'proceso', texto: 'Etiquetado y almacenamiento (' + Store.usuario().nombre + ')', lugar: 'Esta clínica' }] };
          S().hemo.push(u); Store.save(); closeModal(); toast('Unidad ' + u.id + ' registrada');
        };
      },
    });
  }

  Object.assign(window.Views, { hemocomponentes, hemoUnidad: unidad, hemoIngreso: ingreso, hemoSolicitud: solicitudForm });
})();

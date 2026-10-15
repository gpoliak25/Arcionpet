/* Vistas · Servicios (turnos). Calendario por recurso, servicios con duración y conflictos, cierre con cobro y portal del tutor.
   Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, openModal, closeModal, toast, formData } = UI;
  const { S, A, go, pageHead, empty, tutorName, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;
  const TU = () => Dominio.turnos;
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const iso = (d) => VC.isoDia(d);
  const recursosDe = (t) => (t.recursos || []).map((id) => (Store.recurso(id) || {}).nombre).filter(Boolean).join(' · ');

  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof TU().ErrorTurno || e instanceof Dominio.ventas.ErrorVenta || e instanceof Dominio.inventario.ErrorStock) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }

  /* =========================================================== TURNOS */
  function turnos() {
    const s = S(), now = new Date();
    const dia = ui.calDia ? new Date(ui.calDia + 'T12:00:00') : new Date();
    const tipoRec = ui.calRec || 'profesional';
    const hoy = s.turnos.filter((t) => Store.isToday(t.fecha) && ['confirmado', 'atendido'].includes(t.estado));
    const porAtender = hoy.filter((t) => t.estado === 'confirmado' && new Date(t.fecha) > now);
    const pedidos = s.turnos.filter((t) => t.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasados = s.turnos.filter((t) => t.estado === 'confirmado' && TU().fin(t) < now.getTime()).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const sinCobrar = s.turnos.filter((t) => t.estado === 'atendido' && !t.ventaId && !t.estudioId && Store.daysBetween(t.fecha, now) <= 7);
    const fila = (t, acciones) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="grow"><span class="t">' + esc(p.nombre) + ' · ' + esc(t.tipo) + '</span> <span class="muted">· ' + fShort(t.fecha) + ' · ' + esc(recursosDe(t)) + '</span>' + (t.nota ? '<div class="s">' + esc(t.nota) + '</div>' : '') + '</div>' + acciones + '</div>'; };

    const html = pageHead('calendar', 'Turnos', 'Agenda por profesional, sala y equipo. Los conflictos se detectan al agendar.',
      (Store.demo ? '<button class="btn" id="btn-portal">' + icon('globe') + 'Portal Cliente</button>' : '') + '<button class="btn primary" id="btn-turno">' + icon('plus') + 'Nuevo turno</button>') +
      '<div class="grid kpis">' +
      kpi('clock', '', 'Turnos de hoy', hoy.length, porAtender.length + ' por atender') +
      kpi('globe', '', 'Pedidos a confirmar', pedidos.length, pedidos.length ? 'desde el Portal Cliente' : '') +
      kpi('history', 'amber', 'Pasados sin cerrar', pasados.length, pasados.length ? 'marcá atendido o no vino' : 'todo cerrado') +
      kpi('cart', 'violet', 'Atendidos sin cobrar', sinCobrar.length, 'últimos 7 días') + '</div>' +
      (pedidos.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic">' + icon('globe') + '</span><h3>Pedidos del Portal Cliente</h3></div>' +
        pedidos.map((t) => fila(t, '<button class="btn sm primary" data-st="confirmado" data-id="' + t.id + '">' + icon('check') + 'Confirmar</button><button class="btn sm ghost" data-ver="' + t.id + '">Ver</button>')).join('') + '</div>' : '') +
      (pasados.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:var(--muted)">' + icon('history') + '</span><h3>Turnos pasados sin cerrar</h3></div>' +
        pasados.map((t) => fila(t, '<button class="btn sm" data-atender="' + t.id + '">' + icon('check') + 'Atendido</button><button class="btn sm ghost" data-st="no_vino" data-id="' + t.id + '">' + icon('userx') + 'No vino</button>')).join('') + '</div>' : '') +
      (sinCobrar.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:#6D28D9">' + icon('cart') + '</span><h3>Atendidos sin cobrar</h3></div>' +
        sinCobrar.map((t) => fila(t, '<button class="btn sm violet" data-cobrar="' + t.id + '">' + icon('cart') + 'Cobrar</button>')).join('') + '</div>' : '') +
      calendario(dia, tipoRec);
    return {
      html, mount(root) {
        root.querySelector('#btn-turno').onclick = () => turnoForm();
        const bp = root.querySelector('#btn-portal'); if (bp) bp.onclick = () => portal();
        on(root, '[data-st]', 'click', (el) => {
          const msg = { confirmado: 'Turno confirmado. Se notificó al tutor.', no_vino: 'Turno marcado como ausente' }[el.dataset.st];
          intentar(() => A.setTurno(el.dataset.id, el.dataset.st), () => toast(msg));
        });
        on(root, '[data-atender]', 'click', (el) => atenderForm(el.dataset.atender));
        on(root, '[data-cobrar]', 'click', (el) => cobrar(el.dataset.cobrar));
        on(root, '.list-row [data-ver]', 'click', (el) => turnoDetalle(el.dataset.ver));
        on(root, '[data-rec]', 'click', (el) => { ui.calRec = el.dataset.rec; App.render(); });
        // clic en un hueco del calendario: nuevo turno con ese recurso y esa hora
        VC.bindCal(root, { dia, agenda: Store.agenda, clave: 'calDia', onVer: turnoDetalle, onSlot: (recurso, d, hora) => turnoForm(null, { dia: d, hora, recurso }) });
      },
    };
  }

  /* Calendario de un día: una columna por recurso, los turnos como bloques según hora y duración. */
  function calendario(dia, tipoRec) {
    return VC.calDia({
      dia, agenda: Store.agenda, turnos: S().turnos,
      recursos: (S().recursos || []).filter((r) => r.activo !== false && (tipoRec === 'todos' || r.tipo === tipoRec)),
      segExtra: '<div class="seg">' + [['profesional', 'Profesionales'], ['sala', 'Salas'], ['equipo', 'Equipos'], ['todos', 'Todos']].map(([k, l]) => '<button data-rec="' + k + '" class="' + (tipoRec === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>',
    });
  }

  function turnoDetalle(id) {
    const t = S().turnos.find((x) => x.id === id), p = Store.paciente(t.pacienteId), tu = Store.tutor(p.tutorId) || {};
    const sv = Store.servicio(t.servicioId) || {};
    const activo = TU().OCUPA.includes(t.estado);
    openModal({
      title: esc(p.nombre) + ' · ' + esc(t.tipo) + ' ' + turnoEstadoBadge(t),
      body: '<dl class="dl"><dt>Fecha</dt><dd>' + fShort(t.fecha) + ' · ' + t.duracion + ' min</dd><dt>Recursos</dt><dd>' + esc(recursosDe(t)) + '</dd>' +
        '<dt>Tutor</dt><dd><a href="#/tutores/' + tu.id + '">' + tutorName(tu) + '</a> · ' + esc(tu.tel || '') + '</dd><dt>Origen</dt><dd>' + (t.origen === 'portal' ? 'Portal Cliente' : 'Clínica') + '</dd>' +
        (sv.precio ? '<dt>Precio de referencia</dt><dd>' + pesos(sv.precio) + '</dd>' : '') +
        (t.nota ? '<dt>Nota</dt><dd>' + esc(t.nota) + '</dd>' : '') +
        (t.estudioId ? '<dt>Estudio</dt><dd><a href="#/estudios/' + t.estudioId + '">Ver estudio</a> (cerró el turno al cargarse)</dd>' : '') +
        (t.ventaId ? '<dt>Cobro</dt><dd>Venta registrada</dd>' : '') +
        (t.cancelacion ? '<dt>Cancelación</dt><dd>' + fShort(t.cancelacion.fecha) + (t.cancelacion.motivo ? ' · ' + esc(t.cancelacion.motivo) : '') + (t.cancelacion.por === 'tutor' ? ' · por el tutor' : '') + '</dd>' : '') +
        (t.historial || []).map((h) => '<dt>Reprogramado</dt><dd>' + fShort(h.desde) + ' → ' + fShort(h.hacia) + (h.por === 'tutor' ? ' · por el tutor' : '') + '</dd>').join('') + '</dl>',
      foot: '<button class="btn" data-close>Cerrar</button>' +
        (activo ? '<button class="btn ghost" id="td-cancel">Cancelar turno</button><button class="btn" id="td-repro">Reprogramar</button>' : '') +
        (t.estado === 'pendiente' ? '<button class="btn primary" id="td-conf">Confirmar</button>' : '') +
        (t.estado === 'confirmado' ? '<button class="btn" id="td-novino">No vino</button><button class="btn primary" id="td-atender">Atendido</button>' : '') +
        (t.estado === 'atendido' && !t.ventaId && !t.estudioId && Store.puede('ventas', 'editar') ? '<button class="btn violet" id="td-cobrar">' + icon('cart') + 'Cobrar</button>' : ''),
      onMount(m) {
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        b('#td-conf', () => intentar(() => A.setTurno(id, 'confirmado'), () => { closeModal(); toast('Turno confirmado. Se notificó al tutor.'); }));
        b('#td-novino', () => intentar(() => A.setTurno(id, 'no_vino'), () => { closeModal(); toast('Turno marcado como ausente'); }));
        b('#td-atender', () => { closeModal(); setTimeout(() => atenderForm(id), 30); });
        b('#td-cobrar', () => { closeModal(); cobrar(id); });
        b('#td-repro', () => { closeModal(); setTimeout(() => reprogramarForm(id), 30); });
        b('#td-cancel', () => openModal({
          title: 'Cancelar turno', body: '<div class="field"><label>Motivo</label><input name="motivo" placeholder="Opcional"></div>',
          foot: '<button class="btn" data-close>Volver</button><button class="btn danger" id="tc-ok">Cancelar turno</button>',
          onMount(m2) { m2.querySelector('#tc-ok').onclick = () => intentar(() => A.setTurno(id, 'cancelado', { motivo: formData(m2).motivo }), () => { closeModal(); closeModal(); toast('Turno cancelado'); }); },
        }));
      },
    });
  }

  /* Cierre del turno. Si el servicio aplica una vacuna o un antiparasitario, el veterinario registra la aplicación. */
  function atenderForm(id) {
    const t = S().turnos.find((x) => x.id === id), sv = Store.servicio(t.servicioId) || {}, p = Store.paciente(t.pacienteId);
    const vet = Store.rol() === 'veterinario';
    const prods = sv.aplicaCategoria ? S().productos.filter((x) => x.catalogo === 'farmacia' && x.categoria === sv.aplicaCategoria && x.activo !== false && Dominio.inventario.estado(x, S().lotes, new Date()).vendible > 0) : [];
    const cobra = Store.puede('ventas', 'editar') && sv.precio > 0;
    openModal({
      title: 'Turno atendido · ' + esc(p.nombre),
      body: '<p class="muted" style="margin-top:0">' + esc(t.tipo) + ' · ' + fShort(t.fecha) + '</p>' +
        (sv.aplicaCategoria ? (vet
          ? '<div class="section-title">Aplicación (' + esc(sv.aplicaCategoria.toLowerCase()) + ')</div><p class="small muted" style="margin-top:0">Se descuenta del stock (primero el lote que vence antes), queda en la ficha clínica y se agenda la próxima dosis. Botiquín profesional, Res. SENASA 654/2026, art. 20.</p>' +
            '<div class="form-grid"><div class="field full"><label>Producto aplicado</label><select name="productoId"><option value="">— No se aplicó nada —</option>' + prods.map((x) => '<option value="' + x.id + '">' + esc(x.nombre + ' · ' + x.presentacion) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label>Dosis</label><input name="dosis" value="1 dosis"></div><div class="field"><label>Vía</label><select name="via">' + Dominio.ventas.VIAS.map((v) => '<option' + (v === (sv.aplicaCategoria === 'Vacunas' ? 'Subcutánea' : 'Oral') ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div></div>'
          : '<div class="callout amber">' + icon('alert') + '<span>La aplicación de ' + esc(sv.aplicaCategoria.toLowerCase()) + ' la registra el veterinario. Pedile que cierre este turno desde su usuario.</span></div>') : ''),
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn" id="at-ok">Marcar atendido</button>' + (cobra ? '<button class="btn primary" id="at-cobrar">' + icon('cart') + 'Atendido y cobrar</button>' : ''),
      onMount(m) {
        const cerrar = (yCobrar) => {
          if (sv.aplicaCategoria && !vet) return toast('El veterinario tiene que registrar la aplicación', 'warn');
          const f = formData(m);
          const ap = f.productoId ? { productoId: f.productoId, cantidad: 1, dosis: f.dosis, frecuencia: 'dosis única', duracion: '1 día', via: f.via } : null;
          intentar(() => A.atenderTurno(id, ap), (r) => { closeModal(); toast('Turno atendido' + (r.aplicacion ? ' · aplicación registrada' : '')); if (yCobrar) cobrar(id); });
        };
        m.querySelector('#at-ok').onclick = () => cerrar(false);
        const bc = m.querySelector('#at-cobrar'); if (bc) bc.onclick = () => cerrar(true);
      },
    });
  }

  /* Carga el punto de venta con el servicio (y el producto aplicado, si hubo) para cobrarlo. */
  function cobrar(id) {
    const t = S().turnos.find((x) => x.id === id), sv = Store.servicio(t.servicioId) || {}, p = Store.paciente(t.pacienteId);
    const ap = t.aplicacionId ? (S().fichaClinica || []).find((f) => f.id === t.aplicacionId) : null;
    const prod = ap ? Store.producto(ap.items[0].productoId) : null;
    // el producto aplicado ya salió del stock (autoconsumo): se cobra dentro de la línea del servicio
    const linea = { servicioId: sv.id, turnoId: t.id, descripcion: sv.nombre + (prod ? ' · ' + prod.nombre : ''), precio: sv.precio + (prod ? prod.precio * ap.items[0].cantidad : 0) };
    ui.pos = null; ui.pos = Object.assign(Views.ventaNueva.estadoInicial(), { tutorId: p.tutorId, pacienteId: p.id, servicios: [linea] });
    go('#/ventas/nueva');
  }

  /* =========================================================== FORMULARIO DE TURNO */
  function turnoForm(pid, pre) {
    pre = pre || {};
    const servs = (S().servicios || []).filter((x) => x.activo !== false);
    const d = new Date(); d.setDate(d.getDate() + 1);
    const recursosTipo = (tipo) => (S().recursos || []).filter((r) => r.activo !== false && r.tipo === tipo);
    const svIni = servs.find((x) => pre.recurso && x.recursosDefecto.includes(pre.recurso)) || servs[0];
    openModal({
      title: 'Nuevo turno', wide: true,
      body: '<div class="form-grid">' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field"><label>Servicio</label><select name="servicioId" id="tf-sv">' + servs.map((x) => '<option value="' + x.id + '"' + (x === svIni ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Duración (min)</label><input type="number" name="duracion" id="tf-dur" min="5" max="480" step="5"></div>' +
        '<div id="tf-recs" class="full form-grid" style="padding:0"></div>' +
        '<div class="field"><label>Fecha</label><input type="date" name="dia" id="tf-dia" value="' + (pre.dia || iso(d)) + '"></div>' +
        '<div class="field"><label>Hora</label><input type="time" name="hora" id="tf-hora" value="' + (pre.hora || '10:00') + '" step="900"></div>' +
        '<div class="field full"><label>Horarios libres</label><div id="tf-libres" class="chips"></div></div>' +
        '<div class="field full"><label>Nota</label><input name="nota" placeholder="Opcional"></div>' +
        '</div><div id="tf-aviso" style="margin-top:10px"></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="t-ok">Agendar</button>',
      onMount(m) {
        const sel = (n) => m.querySelector('[name="' + n + '"]');
        const svSel = m.querySelector('#tf-sv');
        const armar = () => {
          const sv = Store.servicio(svSel.value);
          m.querySelector('#tf-dur').value = sv.duracion;
          m.querySelector('#tf-recs').innerHTML = sv.requiere.map((tipo) => {
            const ops = recursosTipo(tipo);
            const elegido = (pre.recurso && ops.some((r) => r.id === pre.recurso)) ? pre.recurso : sv.recursosDefecto.find((id) => ops.some((r) => r.id === id));
            return '<div class="field"><label>' + TU().TIPOS_RECURSO[tipo] + '</label><select data-recurso>' + ops.map((r) => '<option value="' + r.id + '"' + (r.id === elegido ? ' selected' : '') + '>' + esc(r.nombre) + '</option>').join('') + '</select></div>';
          }).join('');
          m.querySelectorAll('[data-recurso]').forEach((s) => { s.onchange = revisar; });
          revisar();
        };
        const datos = () => {
          const f = formData(m);
          return { pacienteId: f.pacienteId, servicioId: f.servicioId, duracion: Number(f.duracion), recursos: [...m.querySelectorAll('[data-recurso]')].map((s) => s.value), fecha: new Date(f.dia + 'T' + (f.hora || '10:00') + ':00').toISOString(), nota: f.nota };
        };
        function revisar() {
          const t = datos();
          const e = TU().validar(t, Store.ctxTurnos());
          m.querySelector('#tf-aviso').innerHTML = e.length ? '<div class="callout amber">' + icon('alert') + '<span>' + esc(e[0]) + '</span></div>' : '<div class="callout green">' + icon('check') + '<span>Disponible</span></div>';
          const libres = TU().horariosLibres(new Date(sel('dia').value + 'T12:00:00'), t, Store.ctxTurnos(), 12);
          m.querySelector('#tf-libres').innerHTML = libres.length ? libres.map((x) => '<button type="button" class="chip" data-h="' + fTime(x) + '">' + fTime(x) + '</button>').join('') : '<span class="small muted">No hay horarios libres ese día con estos recursos.</span>';
          m.querySelectorAll('[data-h]').forEach((c) => { c.onclick = () => { sel('hora').value = c.dataset.h; revisar(); }; });
        }
        svSel.onchange = armar;
        ['pacienteId', 'dia', 'hora', 'duracion'].forEach((n) => { sel(n).onchange = revisar; });
        armar();
        m.querySelector('#t-ok').onclick = () => intentar(() => A.addTurno(Object.assign(datos(), { estado: 'confirmado', origen: 'clinica' })), () => { closeModal(); toast('Turno agendado'); });
      },
    });
  }

  function reprogramarForm(id, portal) {
    const t = S().turnos.find((x) => x.id === id);
    const d0 = new Date(t.fecha) > new Date() ? new Date(t.fecha) : new Date();
    openModal({
      title: 'Reprogramar turno',
      body: '<p class="muted" style="margin-top:0">' + esc(t.tipo) + ' · hoy: ' + fShort(t.fecha) + ' · ' + esc(recursosDe(t)) + '</p>' +
        '<div class="field"><label>Día</label><input type="date" id="rp-dia" value="' + iso(d0) + '"></div><div class="field" style="margin-top:10px"><label>Horarios libres</label><div id="rp-libres" class="chips"></div></div>' +
        (portal ? '<p class="small muted">El cambio le llega a la clínica para que lo confirme.</p>' : ''),
      foot: '<button class="btn" data-close>Cancelar</button>',
      onMount(m) {
        const ver = () => {
          const libres = TU().horariosLibres(new Date(m.querySelector('#rp-dia').value + 'T12:00:00'), t, Store.ctxTurnos(), 16);
          m.querySelector('#rp-libres').innerHTML = libres.length ? libres.map((x) => '<button type="button" class="chip" data-f="' + x + '">' + fTime(x) + '</button>').join('') : '<span class="small muted">Sin horarios libres ese día.</span>';
          m.querySelectorAll('[data-f]').forEach((c) => { c.onclick = () => intentar(() => A.reprogramarTurno(id, c.dataset.f, { portal }), () => { closeModal(); toast(portal ? 'Pedido de cambio enviado a la clínica' : 'Turno reprogramado para el ' + fShort(c.dataset.f)); if (portal) portal(); }); });
        };
        m.querySelector('#rp-dia').onchange = ver; ver();
      },
    });
  }

  /* =========================================================== PORTAL CLIENTE (simulación, solo DEMO_MODE) */
  function portal() {
    const tutores = S().tutores.filter((t) => t.activo !== false);
    if (!ui.portalTutor || !tutores.some((t) => t.id === ui.portalTutor)) ui.portalTutor = tutores[0].id;
    const tu = Store.tutor(ui.portalTutor);
    const mascotas = S().pacientes.filter((p) => p.tutorId === tu.id && p.activo !== false);
    const suyos = S().turnos.filter((t) => mascotas.some((p) => p.id === t.pacienteId) && new Date(t.fecha) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const servs = (S().servicios || []).filter((x) => x.activo !== false && x.portal);
    const d = new Date(); d.setDate(d.getDate() + 1);
    openModal({
      title: 'Portal Cliente', wide: true,
      body: '<div class="callout green" style="margin-bottom:14px">' + icon('globe') + '<span>Simulación de lo que ve el <b>tutor</b>. Sus pedidos y cambios le llegan a la clínica para confirmar.</span></div>' +
        '<div class="field"><label>Ingresaste como</label><select id="pt-tutor">' + tutores.map((t) => '<option value="' + t.id + '"' + (t.id === tu.id ? ' selected' : '') + '>' + tutorName(t) + '</option>').join('') + '</select></div>' +
        '<div class="section-title">Mis turnos</div>' +
        (suyos.length ? suyos.map((t) => { const p = Store.paciente(t.pacienteId); const vivo = TU().OCUPA.includes(t.estado); return '<div class="list-row"><div class="grow"><span class="t">' + esc(p.nombre) + ' · ' + esc(t.tipo) + '</span><div class="s">' + fShort(t.fecha) + '</div></div>' + turnoEstadoBadge(t) + (vivo ? '<button class="btn sm" data-prepro="' + t.id + '">Cambiar</button><button class="btn sm ghost" data-pcancel="' + t.id + '">Cancelar</button>' : '') + '</div>'; }).join('') : '<p class="muted small">No tenés turnos próximos.</p>') +
        '<div class="section-title">Pedir un turno</div><div class="form-grid">' +
        '<div class="field"><label>Mascota</label><select name="pacienteId">' + mascotas.map((p) => '<option value="' + p.id + '">' + esc(p.nombre) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Servicio</label><select name="servicioId">' + servs.map((x) => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Día</label><input type="date" name="dia" value="' + iso(d) + '"></div>' +
        '<div class="field full"><label>Horarios disponibles</label><div id="pt-libres" class="chips"></div></div>' +
        '<div class="field full"><label>Mensaje para la clínica</label><input name="nota" placeholder="Opcional"></div></div>',
      foot: '<button class="btn" data-close>Cerrar</button>',
      onMount(m) {
        m.querySelector('#pt-tutor').onchange = (e) => { ui.portalTutor = e.target.value; closeModal(); portal(); };
        m.querySelectorAll('[data-pcancel]').forEach((b) => { b.onclick = () => intentar(() => A.setTurno(b.dataset.pcancel, 'cancelado', { por: 'tutor', motivo: 'Cancelado desde el Portal Cliente' }), () => { toast('Turno cancelado. La clínica ya lo sabe.'); closeModal(); portal(); }); });
        m.querySelectorAll('[data-prepro]').forEach((b) => { b.onclick = () => { closeModal(); setTimeout(() => reprogramarForm(b.dataset.prepro, portal), 30); }; });
        const sel = (n) => m.querySelector('[name="' + n + '"]');
        const ver = () => {
          const sv = Store.servicio(sel('servicioId').value);
          if (!sv || !sel('pacienteId').value) { m.querySelector('#pt-libres').innerHTML = '<span class="small muted">No hay mascotas activas.</span>'; return; }
          const base = { pacienteId: sel('pacienteId').value, servicioId: sv.id, duracion: sv.duracion, recursos: sv.recursosDefecto.slice() };
          const libres = TU().horariosLibres(new Date(sel('dia').value + 'T12:00:00'), base, Store.ctxTurnos(), 16);
          m.querySelector('#pt-libres').innerHTML = libres.length ? libres.map((x) => '<button type="button" class="chip" data-f="' + x + '">' + fTime(x) + '</button>').join('') : '<span class="small muted">Sin horarios ese día. Probá con otro.</span>';
          m.querySelectorAll('[data-f]').forEach((c) => { c.onclick = () => intentar(() => A.addTurno(Object.assign(base, { fecha: c.dataset.f, estado: 'pendiente', origen: 'portal', nota: sel('nota').value ? 'Mensaje del tutor: "' + sel('nota').value + '"' : '' })), () => { toast('Pedido enviado. Te avisamos cuando la clínica lo confirme.', 'warn'); closeModal(); portal(); }); });
        };
        ['pacienteId', 'servicioId', 'dia'].forEach((n) => { sel(n).onchange = ver; });
        ver();
      },
    });
  }

  Object.assign(window.Views, { turnos, turnoForm, turnoDetalle, atenderForm, portal, portalForm: portal });
})();

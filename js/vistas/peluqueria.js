/* Vistas · Peluquería (módulo propio): agenda por peluquero, fichas por mascota con fotos y servicios con precios por tamaño.
   Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, openModal, closeModal, toast, formData } = UI;
  const { S, A, go, pageHead, empty, tutorName, match, bindSearch, searchBox, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;
  const TU = () => Dominio.turnos, PE = () => Dominio.peluqueria;
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const turno = (id) => (S().pelTurnos || []).find((t) => t.id === id);
  const peluquero = (t) => (t.recursos || []).map((id) => (Store.pelRecurso(id) || {}).nombre).join(' · ');
  const TABS = [['peluqueria', 'Agenda'], ['peluqueria-fichas', 'Fichas'], ['peluqueria-servicios', 'Servicios y precios']];
  const tabs = (actual) => '<div class="tabs">' + TABS.map(([r, l]) => '<a href="#/' + r + '" class="' + (r === actual ? 'on' : '') + '">' + l + '</a>').join('') + '</div>';

  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof TU().ErrorTurno || e instanceof PE().ErrorPeluqueria || e instanceof Dominio.inventario.ErrorStock) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }
  /* Achica la foto en el navegador (lado mayor 640 px, JPEG) para que entre en el almacenamiento local. */
  function achicar(file) {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 640 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = mal; img.src = r.result; };
      r.onerror = mal; r.readAsDataURL(file);
    });
  }
  const alertaPiel = (f) => f && f.piel && !/^sin alergias/i.test(f.piel.trim());

  /* =========================================================== AGENDA */
  function agenda() {
    const s = S(), now = new Date();
    const dia = ui.pelDia ? new Date(ui.pelDia + 'T12:00:00') : new Date();
    const hoy = (s.pelTurnos || []).filter((t) => Store.isToday(t.fecha) && ['confirmado', 'atendido'].includes(t.estado));
    const pasados = (s.pelTurnos || []).filter((t) => t.estado === 'confirmado' && TU().fin(t) < now.getTime());
    const sinCobrar = (s.pelTurnos || []).filter((t) => t.estado === 'atendido' && !t.ventaId && Store.daysBetween(t.fecha, now) <= 7);
    const fila = (t, acc) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="grow"><span class="t">' + esc(p.nombre) + ' · ' + esc(t.tipo) + '</span> <span class="muted">· ' + fShort(t.fecha) + ' · ' + esc(peluquero(t)) + ' · ' + pesos(t.precio) + '</span></div>' + acc + '</div>'; };
    const html = pageHead('scissors', 'Peluquería', 'Agenda por peluquero. Precio y duración según el tamaño de la mascota.', '<button class="btn primary" id="btn-pt">' + icon('plus') + 'Nuevo turno</button>') + tabs('peluqueria') +
      '<div class="grid kpis">' + kpi('clock', '', 'Turnos de hoy', hoy.length, hoy.filter((t) => t.estado === 'confirmado').length + ' por atender') +
      kpi('history', 'amber', 'Pasados sin cerrar', pasados.length, pasados.length ? 'marcá atendido o no vino' : 'todo cerrado') +
      kpi('cart', 'violet', 'Atendidos sin cobrar', sinCobrar.length, 'últimos 7 días') + '</div>' +
      (pasados.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:var(--muted)">' + icon('history') + '</span><h3>Turnos pasados sin cerrar</h3></div>' + pasados.map((t) => fila(t, '<button class="btn sm" data-atender="' + t.id + '">' + icon('check') + 'Atendido</button><button class="btn sm ghost" data-novino="' + t.id + '">No vino</button>')).join('') + '</div>' : '') +
      (sinCobrar.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:#6D28D9">' + icon('cart') + '</span><h3>Atendidos sin cobrar</h3></div>' + sinCobrar.map((t) => fila(t, '<button class="btn sm violet" data-cobrar="' + t.id + '">' + icon('cart') + 'Cobrar</button>')).join('') + '</div>' : '') +
      VC.calDia({ dia, agenda: Store.agenda, turnos: s.pelTurnos || [], recursos: (s.pelRecursos || []).filter((r) => r.activo !== false), subtitulo: () => 'Peluquero/a' });
    return {
      html, mount(root) {
        root.querySelector('#btn-pt').onclick = () => turnoForm();
        on(root, '[data-atender]', 'click', (el) => atenderForm(el.dataset.atender));
        on(root, '[data-cobrar]', 'click', (el) => cobrar(el.dataset.cobrar));
        on(root, '[data-novino]', 'click', (el) => intentar(() => A.setPelTurno(el.dataset.novino, 'no_vino'), () => toast('Turno marcado como ausente')));
        VC.bindCal(root, { dia, agenda: Store.agenda, clave: 'pelDia', onVer: detalle, onSlot: (recurso, d, hora) => turnoForm({ dia: d, hora, recurso }) });
      },
    };
  }

  function turnoForm(pre) {
    pre = pre || {};
    const servs = (S().pelServicios || []).filter((x) => x.activo !== false);
    const pels = (S().pelRecursos || []).filter((r) => r.activo !== false);
    const d = new Date(); d.setDate(d.getDate() + 1);
    openModal({
      title: 'Nuevo turno de peluquería', wide: true,
      body: '<div class="form-grid">' +
        '<div class="field full"><label>Mascota</label><select name="pacienteId">' + pacienteOptions(pre.pacienteId) + '</select></div>' +
        '<div class="field"><label>Servicio</label><select name="servicioId">' + servs.map((x) => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Peluquero/a</label><select name="recurso">' + pels.map((r) => '<option value="' + r.id + '"' + (r.id === pre.recurso ? ' selected' : '') + '>' + esc(r.nombre) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Fecha</label><input type="date" name="dia" value="' + (pre.dia || VC.isoDia(d)) + '"></div>' +
        '<div class="field"><label>Hora</label><input type="time" name="hora" value="' + (pre.hora || '10:00') + '" step="900"></div>' +
        '<div class="field full"><label>Horarios libres</label><div id="pf-libres" class="chips"></div></div></div>' +
        '<div id="pf-cot" class="callout" style="margin-top:12px;display:block"></div><div id="pf-aviso" style="margin-top:10px"></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="pf-ok">Agendar</button>',
      onMount(m) {
        const sel = (n) => m.querySelector('[name="' + n + '"]');
        const datos = () => {
          const f = formData(m), sv = Store.pelServicio(f.servicioId), pac = Store.paciente(f.pacienteId);
          const cot = PE().cotizar(sv, pac, Store.pelFicha(pac.id));
          return { t: { pacienteId: pac.id, servicioId: sv.id, duracion: cot.duracion, recursos: [f.recurso], fecha: new Date(f.dia + 'T' + (f.hora || '10:00') + ':00').toISOString() }, cot, pac };
        };
        const revisar = () => {
          const { t, cot, pac } = datos(), ficha = Store.pelFicha(pac.id);
          m.querySelector('#pf-cot').innerHTML = '<b>' + pesos(cot.precio) + '</b> · ' + cot.duracion + ' min · tamaño ' + esc(PE().TAMANOS[cot.tamano].toLowerCase()) + (cot.peloLargo ? ' · pelo largo (+20 % precio, +25 % tiempo)' : '') +
            (ficha && ficha.temperamento ? '<div class="small">Temperamento: ' + esc(ficha.temperamento) + '</div>' : '') + (alertaPiel(ficha) ? '<div class="small" style="color:var(--red)">Piel: ' + esc(ficha.piel) + '</div>' : '');
          const e = TU().validar(t, Store.ctxPel());
          m.querySelector('#pf-aviso').innerHTML = e.length ? '<div class="callout amber">' + icon('alert') + '<span>' + esc(e[0]) + '</span></div>' : '<div class="callout green">' + icon('check') + '<span>Disponible</span></div>';
          const libres = TU().horariosLibres(new Date(sel('dia').value + 'T12:00:00'), t, Store.ctxPel(), 12);
          m.querySelector('#pf-libres').innerHTML = libres.length ? libres.map((x) => '<button type="button" class="chip" data-h="' + fTime(x) + '">' + fTime(x) + '</button>').join('') : '<span class="small muted">Sin horarios libres ese día.</span>';
          m.querySelectorAll('[data-h]').forEach((c) => { c.onclick = () => { sel('hora').value = c.dataset.h; revisar(); }; });
        };
        ['pacienteId', 'servicioId', 'recurso', 'dia', 'hora'].forEach((n) => { sel(n).onchange = revisar; });
        revisar();
        m.querySelector('#pf-ok').onclick = () => intentar(() => A.addPelTurno(datos().t), () => { closeModal(); toast('Turno de peluquería agendado'); });
      },
    });
  }

  function detalle(id) {
    const t = turno(id), p = Store.paciente(t.pacienteId), tu = Store.tutor(p.tutorId) || {}, ficha = Store.pelFicha(p.id);
    const activo = TU().OCUPA.includes(t.estado);
    openModal({
      title: esc(p.nombre) + ' · ' + esc(t.tipo) + ' ' + turnoEstadoBadge(t),
      body: '<dl class="dl"><dt>Fecha</dt><dd>' + fShort(t.fecha) + ' · ' + t.duracion + ' min</dd><dt>Peluquero/a</dt><dd>' + esc(peluquero(t)) + '</dd><dt>Precio</dt><dd>' + pesos(t.precio) + '</dd>' +
        '<dt>Tutor</dt><dd><a href="#/tutores/' + tu.id + '">' + tutorName(tu) + '</a> · ' + esc(tu.tel || '') + '</dd>' +
        (ficha ? (ficha.preferencias ? '<dt>Preferencias</dt><dd>' + esc(ficha.preferencias) + '</dd>' : '') + (ficha.temperamento ? '<dt>Temperamento</dt><dd>' + esc(ficha.temperamento) + '</dd>' : '') + (ficha.piel ? '<dt>Piel</dt><dd' + (alertaPiel(ficha) ? ' style="color:var(--red)"' : '') + '>' + esc(ficha.piel) + '</dd>' : '') : '') +
        (t.ventaId ? '<dt>Cobro</dt><dd>Venta registrada</dd>' : '') + '</dl>',
      foot: '<button class="btn" data-close>Cerrar</button><button class="btn ghost" id="pd-ficha">Ficha</button>' +
        (activo ? '<button class="btn ghost" id="pd-cancel">Cancelar turno</button><button class="btn" id="pd-repro">Reprogramar</button>' : '') +
        (t.estado === 'confirmado' ? '<button class="btn primary" id="pd-atender">Atendido</button>' : '') +
        (t.estado === 'atendido' && !t.ventaId && Store.puede('ventas', 'editar') ? '<button class="btn violet" id="pd-cobrar">' + icon('cart') + 'Cobrar</button>' : ''),
      onMount(m) {
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        b('#pd-ficha', () => { closeModal(); setTimeout(() => fichaModal(p.id), 30); });
        b('#pd-atender', () => { closeModal(); setTimeout(() => atenderForm(id), 30); });
        b('#pd-cobrar', () => { closeModal(); cobrar(id); });
        b('#pd-cancel', () => intentar(() => A.setPelTurno(id, 'cancelado'), () => { closeModal(); toast('Turno cancelado'); }));
        b('#pd-repro', () => { closeModal(); setTimeout(() => reprogramar(id), 30); });
      },
    });
  }

  function reprogramar(id) {
    const t = turno(id);
    const d0 = new Date(t.fecha) > new Date() ? new Date(t.fecha) : new Date();
    openModal({
      title: 'Reprogramar turno de peluquería',
      body: '<div class="field"><label>Día</label><input type="date" id="rp-dia" value="' + VC.isoDia(d0) + '"></div><div class="field" style="margin-top:10px"><label>Horarios libres con ' + esc(peluquero(t)) + '</label><div id="rp-libres" class="chips"></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button>',
      onMount(m) {
        const ver = () => {
          const libres = TU().horariosLibres(new Date(m.querySelector('#rp-dia').value + 'T12:00:00'), t, Store.ctxPel(), 16);
          m.querySelector('#rp-libres').innerHTML = libres.length ? libres.map((x) => '<button type="button" class="chip" data-f="' + x + '">' + fTime(x) + '</button>').join('') : '<span class="small muted">Sin horarios libres ese día.</span>';
          m.querySelectorAll('[data-f]').forEach((c) => { c.onclick = () => intentar(() => A.reprogramarPelTurno(id, c.dataset.f), () => { closeModal(); toast('Turno reprogramado para el ' + fShort(c.dataset.f)); }); });
        };
        m.querySelector('#rp-dia').onchange = ver; ver();
      },
    });
  }

  /* Cierre del turno: insumos, nota de la visita y fotos antes/después. */
  function atenderForm(id) {
    const t = turno(id), sv = Store.pelServicio(t.servicioId), p = Store.paciente(t.pacienteId);
    const ins = (sv.insumos || []).map((i) => ({ p: Store.producto(i.productoId), cantidad: i.cantidad })).filter((x) => x.p);
    const cobra = Store.puede('ventas', 'editar');
    openModal({
      title: 'Turno atendido · ' + esc(p.nombre), wide: true,
      body: '<p class="muted" style="margin-top:0">' + esc(t.tipo) + ' · ' + fShort(t.fecha) + ' · ' + pesos(t.precio) + '</p>' +
        (ins.length ? '<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="insumos" checked> <span>Descontar insumos del inventario: ' + ins.map((x) => esc(x.cantidad + ' × ' + x.p.nombre) + ' <span class="sp">(' + Dominio.inventario.estado(x.p, S().lotes, new Date()).vendible + ' disp.)</span>').join(', ') + '</span></label>' : '') +
        '<div class="form-grid" style="margin-top:12px"><div class="field full"><label>Nota de la visita</label><input name="nota" placeholder="Ej.: se portó bien, piel sin novedades"></div>' +
        '<div class="field"><label>Foto antes</label><input type="file" accept="image/*" data-foto="antes"></div><div class="field"><label>Foto después</label><input type="file" accept="image/*" data-foto="despues"></div></div>' +
        (sv.frecuenciaDias ? '<p class="small muted">Se agenda la próxima visita sugerida en ' + sv.frecuenciaDias + ' días para el recordatorio al tutor.</p>' : ''),
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn" id="pa-ok">Marcar atendido</button>' + (cobra ? '<button class="btn primary" id="pa-cobrar">' + icon('cart') + 'Atendido y cobrar</button>' : ''),
      onMount(m) {
        const cerrar = async (yCobrar) => {
          const f = formData(m), fotos = [];
          for (const el of m.querySelectorAll('[data-foto]')) { if (el.files && el.files[0]) { try { fotos.push({ tipo: el.dataset.foto, src: await achicar(el.files[0]) }); } catch (e) { return toast('No se pudo leer la foto', 'warn'); } } }
          intentar(() => A.atenderPelTurno(id, { insumos: !!f.insumos, nota: f.nota, fotos }), () => {
            closeModal();
            if (!Store.guardadoOk) toast('No hay espacio para guardar las fotos en este navegador: quitá fotos viejas de la ficha', 'warn'); else toast('Turno atendido');
            if (yCobrar) cobrar(id);
          });
        };
        m.querySelector('#pa-ok').onclick = () => cerrar(false);
        const bc = m.querySelector('#pa-cobrar'); if (bc) bc.onclick = () => cerrar(true);
      },
    });
  }

  /* Pasa el servicio al punto de venta, en el punto de venta de peluquería si existe. */
  function cobrar(id) {
    const t = turno(id), p = Store.paciente(t.pacienteId);
    const pv = (Store.facturacionCfg().puntosVenta || []).find((x) => /peluquer/i.test(x.nombre));
    const cot = PE().cotizar(Store.pelServicio(t.servicioId), p, Store.pelFicha(p.id));
    ui.pos = Object.assign(Views.ventaNueva.estadoInicial(), { tutorId: p.tutorId, pacienteId: p.id, servicios: [{ servicioId: t.servicioId, turnoId: t.id, descripcion: 'Peluquería · ' + t.tipo + ' (' + cot.tamano + ')', precio: t.precio }] }, pv ? { pv: pv.numero } : {});
    go('#/ventas/nueva');
  }

  /* =========================================================== FICHAS */
  function fichas() {
    const pacs = S().pacientes.filter((p) => p.activo !== false && match(ui.qPel, p.nombre, p.raza, p.especie, (Store.tutor(p.tutorId) || {}).apellido));
    const ultima = (pid) => (S().pelTurnos || []).filter((t) => t.pacienteId === pid && t.estado === 'atendido').map((t) => t.fecha).sort().pop();
    const html = pageHead('scissors', 'Peluquería', 'Ficha de peluquería por mascota: preferencias, temperamento, piel y fotos.') + tabs('peluqueria-fichas') +
      '<div class="toolbar">' + searchBox('q-pel', 'Buscar mascota, raza o tutor…', ui.qPel || '') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Mascota</th><th>Tutor</th><th>Tamaño</th><th>Última visita</th><th>Fotos</th><th>Alertas</th></tr></thead><tbody>' +
      (pacs.map((p) => { const f = Store.pelFicha(p.id), u = ultima(p.id); return '<tr class="clickable" data-ficha="' + p.id + '"><td class="strong">' + esc(p.nombre) + '<div class="sp">' + esc(p.especie + ' · ' + p.raza) + '</div></td><td>' + tutorName(Store.tutor(p.tutorId)) + '</td><td>' + esc(PE().TAMANOS[PE().tamano(p, f)]) + '</td><td class="nowrap">' + (u ? fDate(u) : '—') + '</td><td>' + ((f && f.fotos || []).length || '—') + '</td><td>' + (alertaPiel(f) ? '<span class="badge b-patologico">Piel</span>' : '') + (f && f.temperamento ? ' <span class="badge b-incierto" title="' + esc(f.temperamento) + '">Temperamento</span>' : '') + '</td></tr>'; }).join('') ||
        '<tr><td colspan="6">' + empty('paw', 'Sin mascotas', '') + '</td></tr>') + '</tbody></table></div>';
    return { html, mount(root) { bindSearch(root, 'q-pel', 'qPel', () => App.render(true)); on(root, '[data-ficha]', 'click', (el) => fichaModal(el.dataset.ficha)); } };
  }

  function fichaModal(pid) {
    const p = Store.paciente(pid), f = Store.pelFicha(pid) || { fotos: [], visitas: [] };
    const editar = Store.puede('peluqueria', 'editar');
    const area = (n, l, ph) => '<div class="field full"><label>' + l + '</label><textarea name="' + n + '" style="min-height:52px"' + (editar ? '' : ' readonly') + ' placeholder="' + esc(ph) + '">' + esc(f[n] || '') + '</textarea></div>';
    openModal({
      title: 'Ficha de peluquería · ' + esc(p.nombre), wide: true,
      body: '<p class="muted" style="margin-top:0">' + esc(p.especie + ' · ' + p.raza + (p.peso ? ' · ' + p.peso + ' kg' : '')) + ' · tutor: ' + tutorName(Store.tutor(p.tutorId)) + '</p><div class="form-grid">' +
        '<div class="field"><label>Tamaño</label><select name="tamano"' + (editar ? '' : ' disabled') + '><option value="">Automático por peso (' + esc(PE().TAMANOS[PE().tamano(p)].toLowerCase()) + ')</option>' + Object.entries(PE().TAMANOS).map(([k, l]) => '<option value="' + k + '"' + (f.tamano === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Pelaje</label><input readonly value="' + (PE().peloLargo(p) ? 'Largo o doble manto (recargo)' : 'Corto o medio') + '"></div>' +
        area('preferencias', 'Preferencias', 'Ej.: corte tipo cachorro, moño') + area('temperamento', 'Temperamento', 'Ej.: nervioso con el secador') + area('piel', 'Piel y alergias', 'Ej.: dermatitis, usar shampoo hipoalergénico') + area('observaciones', 'Observaciones', '') + '</div>' +
        '<div class="section-title">Fotos (' + (f.fotos || []).length + ' de ' + PE().MAX_FOTOS + ')</div><div class="pel-fotos">' +
        ((f.fotos || []).map((x) => '<figure><img src="' + x.src + '" alt="Foto ' + x.tipo + '"><figcaption>' + (x.tipo === 'antes' ? 'Antes' : 'Después') + ' · ' + fDate(x.fecha) + (editar ? ' <button class="icon-btn danger" data-qfoto="' + x.id + '" aria-label="Quitar foto">' + icon('x') + '</button>' : '') + '</figcaption></figure>').join('') || '<p class="small muted">Sin fotos.</p>') + '</div>' +
        (editar ? '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><select id="pf-tipo" class="filter"><option value="antes">Antes</option><option value="despues">Después</option></select><input type="file" accept="image/*" id="pf-foto"></div>' : '') +
        '<div class="section-title">Visitas</div>' + (((f.visitas || []).slice().reverse().map((v) => '<div class="list-row"><div class="grow"><span class="t">' + esc(v.servicio) + '</span> <span class="muted">· ' + fShort(v.fecha) + '</span>' + (v.nota ? '<div class="s">' + esc(v.nota) + '</div>' : '') + '</div></div>').join('')) || '<p class="small muted">Sin visitas registradas.</p>'),
      foot: '<button class="btn" data-close>Cerrar</button>' + (editar ? '<button class="btn" id="pf-turno">' + icon('calendar') + 'Dar turno</button><button class="btn primary" id="pf-ok">Guardar ficha</button>' : ''),
      onMount(m) {
        const reabrir = () => { closeModal(); setTimeout(() => fichaModal(pid), 30); };
        const ok = m.querySelector('#pf-ok');
        if (ok) ok.onclick = () => { const d = formData(m); intentar(() => A.guardarPelFicha(pid, { tamano: d.tamano, preferencias: d.preferencias, temperamento: d.temperamento, piel: d.piel, observaciones: d.observaciones }), () => { closeModal(); toast('Ficha guardada'); }); };
        const bt = m.querySelector('#pf-turno'); if (bt) bt.onclick = () => { closeModal(); setTimeout(() => turnoForm({ pacienteId: pid }), 30); };
        const fi = m.querySelector('#pf-foto');
        if (fi) fi.onchange = async () => {
          if (!fi.files[0]) return;
          let src; try { src = await achicar(fi.files[0]); } catch (e) { return toast('No se pudo leer la foto', 'warn'); }
          intentar(() => A.agregarFotoPel(pid, m.querySelector('#pf-tipo').value, src), () => { if (!Store.guardadoOk) toast('No hay espacio para guardar la foto en este navegador', 'warn'); reabrir(); });
        };
        m.querySelectorAll('[data-qfoto]').forEach((b) => { b.onclick = () => intentar(() => A.quitarFotoPel(pid, b.dataset.qfoto), reabrir); });
      },
    });
  }

  /* =========================================================== SERVICIOS Y PRECIOS */
  function servicios() {
    const servs = S().pelServicios || [], edit = Store.puedeAccion('editarPrecios');
    const tam = Object.keys(PE().TAMANOS);
    const html = pageHead('scissors', 'Peluquería', 'Precios con IVA incluido y duración por tamaño. Las razas de pelo largo o doble manto llevan +20 % de precio y +25 % de tiempo en los servicios marcados.') + tabs('peluqueria-servicios') +
      '<div class="table-wrap"><table><thead><tr><th>Servicio</th>' + tam.map((t) => '<th>' + esc(PE().TAMANOS[t].split(' (')[0]) + '</th>').join('') + '<th>Insumos</th><th>Repetir</th><th class="actions"></th></tr></thead><tbody>' +
      servs.map((x) => '<tr><td class="strong">' + esc(x.nombre) + (x.recargoPeloLargo ? ' <span class="badge b-gray" title="Recargo por pelo largo">+ pelo largo</span>' : '') + '</td>' + tam.map((t) => '<td class="nowrap">' + pesos(x.porTamano[t].precio) + '<div class="sp">' + x.porTamano[t].duracion + ' min</div></td>').join('') +
        '<td class="sp">' + esc((x.insumos || []).map((i) => i.cantidad + ' × ' + ((Store.producto(i.productoId) || {}).nombre || '?')).join(', ') || '—') + '</td><td class="sp">' + (x.frecuenciaDias ? 'cada ' + x.frecuenciaDias + ' días' : '—') + '</td>' +
        '<td class="actions">' + (edit ? '<button class="icon-btn" data-esv="' + x.id + '" title="Editar">' + icon('edit') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' +
      (edit ? '' : '<p class="small muted">Los precios los cambia administración.</p>');
    return { html, mount(root) { on(root, '[data-esv]', 'click', (el) => servicioForm(el.dataset.esv)); } };
  }

  function servicioForm(id) {
    const x = Store.pelServicio(id), tam = Object.keys(PE().TAMANOS);
    openModal({
      title: 'Editar servicio · ' + esc(x.nombre), wide: true,
      body: '<div class="form-grid"><div class="field full"><label>Nombre</label><input name="nombre" value="' + esc(x.nombre) + '"></div>' +
        tam.map((t) => '<div class="field"><label>' + esc(PE().TAMANOS[t]) + ': precio ($)</label><input type="number" min="1" step="100" name="p_' + t + '" value="' + x.porTamano[t].precio + '"></div><div class="field"><label>Duración (min)</label><input type="number" min="5" max="480" step="5" name="d_' + t + '" value="' + x.porTamano[t].duracion + '"></div>').join('') +
        '<div class="field"><label>Repetir cada (días)</label><input type="number" min="7" max="365" name="frecuenciaDias" value="' + (x.frecuenciaDias || '') + '" placeholder="Sin recordatorio"></div>' +
        '<label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="recargoPeloLargo"' + (x.recargoPeloLargo ? ' checked' : '') + '> Recargo por pelo largo</label>' +
        '<label class="field full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="activo"' + (x.activo !== false ? ' checked' : '') + '> Activo (se ofrece en la agenda)</label></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="sv-ok">Guardar</button>',
      onMount(m) {
        m.querySelector('#sv-ok').onclick = () => {
          const f = formData(m), porTamano = {};
          tam.forEach((t) => { porTamano[t] = { precio: Number(f['p_' + t]), duracion: Number(f['d_' + t]) }; });
          intentar(() => A.guardarPelServicio({ id, nombre: f.nombre.trim(), porTamano, frecuenciaDias: f.frecuenciaDias === '' ? null : Number(f.frecuenciaDias), recargoPeloLargo: !!f.recargoPeloLargo, activo: !!f.activo }), () => { closeModal(); toast('Servicio actualizado'); });
        };
      },
    });
  }

  Object.assign(window.Views, { peluqueria: agenda, peluqueriaFichas: fichas, peluqueriaServicios: servicios, pelFicha: fichaModal, pelTurnoForm: turnoForm });
})();

/* Vistas · Clínica (pacientes, hemocomponentes). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const { S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;

  /* =========================================================== PACIENTES */
  function pacientes() {
    const list = S().pacientes.filter((p) => { const t = Store.tutor(p.tutorId) || {}; return match(ui.qPac, p.nombre, p.raza, p.especie, t.nombre, t.apellido, t.doc); });
    const rows = list.map((p) => {
      const t = Store.tutor(p.tutorId);
      return '<tr class="clickable" data-ver="' + p.id + '"><td class="strong">' + esc(p.nombre) + (p.origen === 'red' ? ' <span class="badge b-violet" title="Incorporado desde la red EISPLUS">red</span>' : '') + '</td><td><span class="chip">' + esc(p.especie) + '</span></td><td>' + esc(p.raza) + '</td><td>' + Store.edad(p.nacimiento) + '</td><td>' + tutorName(t) + '</td>' +
        '<td class="actions"><button class="icon-btn" data-edit="' + p.id + '" title="Editar">' + icon('edit') + '</button><button class="icon-btn danger" data-del="' + p.id + '" title="Eliminar">' + icon('trash') + '</button></td></tr>';
    }).join('');
    const html = pageHead('paw', 'Pacientes', 'Mascotas de la clínica y las incorporadas desde la red EISPLUS.',
      '<button class="btn" id="btn-red">' + icon('network') + 'Buscar en la red</button><button class="btn" id="btn-tutores">' + icon('users') + 'Tutores</button><button class="btn primary" id="btn-nuevo">' + icon('plus') + 'Nuevo paciente</button>') +
      '<div class="toolbar">' + searchBox('q-pac', 'Buscar por mascota, raza, tutor o documento…', ui.qPac) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Edad</th><th>Tutor</th><th class="actions">Acciones</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">' + empty('search', 'Sin resultados', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-pac', 'qPac', () => App.render(true));
        root.querySelector('#btn-nuevo').onclick = () => pacienteForm();
        root.querySelector('#btn-red').onclick = buscarEnRed;
        root.querySelector('#btn-tutores').onclick = () => go('#/tutores');
        on(root, '[data-ver]', 'click', (el) => pacienteDetalle(el.dataset.ver));
        on(root, '[data-edit]', 'click', (el, e) => { e.stopPropagation(); pacienteForm(el.dataset.edit); });
        on(root, '[data-del]', 'click', (el, e) => {
          e.stopPropagation(); const p = Store.paciente(el.dataset.del);
          confirmModal('Eliminar paciente', '¿Eliminar a <b>' + esc(p.nombre) + '</b> junto con sus estudios, informes y turnos? Esta acción no se puede deshacer.', 'Eliminar', () => { A.deletePaciente(p.id); toast('Paciente eliminado'); });
        });
      },
    };
  }
  function pacienteForm(id, opts) {
    const p = id ? Store.paciente(id) : { especie: 'Canino', sexo: 'Hembra', tutorId: (opts || {}).tutorId };
    const tutOpts = S().tutores.filter((t) => t.activo !== false || t.id === p.tutorId).map((t) => '<option value="' + t.id + '"' + (t.id === p.tutorId ? ' selected' : '') + '>' + tutorName(t) + ' · ' + esc(Dominio.tutores.TIPOS_DOC[t.tipoDoc || 'DNI'] + ' ' + t.doc) + '</option>').join('');
    openModal({
      title: id ? 'Editar paciente' : 'Nuevo paciente',
      body: '<div class="form-grid">' +
        '<div class="field"><label>Nombre</label><input name="nombre" value="' + esc(p.nombre || '') + '" required></div>' +
        '<div class="field"><label>Especie</label><select name="especie">' + ['Canino', 'Felino', 'Otro'].map((x) => '<option' + (x === p.especie ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Raza</label><input name="raza" value="' + esc(p.raza || '') + '"></div>' +
        '<div class="field"><label>Sexo</label><select name="sexo">' + ['Hembra', 'Macho'].map((x) => '<option' + (x === p.sexo ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Fecha de nacimiento</label><input type="date" name="nacimiento" value="' + esc(p.nacimiento || '') + '" required></div>' +
        '<div class="field"><label>Peso (kg)</label><input type="number" step="0.1" name="peso" value="' + esc(p.peso || '') + '"></div>' +
        '<div class="field full"><label>Tutor</label><select name="tutorId" id="f-tutor"><option value="">— Nuevo tutor —</option>' + tutOpts + '</select></div>' +
        '<div class="field" data-nt><label>Nombre del tutor</label><input name="tNombre"></div>' +
        '<div class="field" data-nt><label>Apellido del tutor</label><input name="tApellido"></div>' +
        '<div class="field" data-nt><label>Documento</label><input name="tDoc"></div>' +
        '<div class="field" data-nt><label>Teléfono</label><input name="tTel"></div>' +
        '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="f-ok">' + (id ? 'Guardar' : 'Crear paciente') + '</button>',
      onMount(m) {
        const sel = m.querySelector('#f-tutor');
        const sync = () => m.querySelectorAll('[data-nt]').forEach((el) => { el.style.display = sel.value ? 'none' : ''; });
        if (!id && !p.tutorId && sel.options.length > 1) sel.value = sel.options[1].value;
        sync(); sel.onchange = sync;
        m.querySelector('#f-ok').onclick = () => {
          const f = formData(m);
          if (!f.nombre || !f.nacimiento) return toast('Completá nombre y fecha de nacimiento', 'warn');
          if (!f.tutorId) { const err = Dominio.tutores.validar({ nombre: f.tNombre, apellido: f.tApellido, tipoDoc: 'DNI', doc: f.tDoc }, S().tutores); if (err.length) return toast('Tutor: ' + err[0], 'warn'); }
          const data = { nombre: f.nombre, especie: f.especie, raza: f.raza || 'Mestizo', sexo: f.sexo, nacimiento: f.nacimiento, peso: parseFloat(f.peso) || null };
          if (id) { if (!f.tutorId) data.tutorId = A.addTutor({ nombre: f.tNombre, apellido: f.tApellido, doc: f.tDoc, tel: f.tTel, email: '' }).id; else data.tutorId = f.tutorId; A.updatePaciente(id, data); toast('Paciente actualizado'); }
          else { data.tutorId = f.tutorId; data.origen = 'clinica'; A.addPaciente(data, f.tutorId ? null : { nombre: f.tNombre, apellido: f.tApellido, doc: f.tDoc, tel: f.tTel, email: '' }); toast(esc(f.nombre) + ' fue agregado a la clínica'); }
          closeModal();
        };
      },
    });
  }
  function buscarEnRed() {
    const render = (q) => {
      const rows = S().redPacientes.filter((r) => match(q, r.nombre, r.raza, r.tutor.nombre, r.tutor.apellido, r.tutor.doc));
      return rows.length ? rows.map((r) => '<div class="list-row"><div class="att-ic violet">' + icon('paw') + '</div><div class="grow"><div class="t">' + esc(r.nombre) + ' <span class="sp">(' + esc(r.especie) + ' · ' + esc(r.raza) + ' · ' + Store.edad(r.nacimiento) + ')</span></div><div class="s">Tutor: ' + esc(r.tutor.apellido + ', ' + r.tutor.nombre) + ' · DNI ' + esc(r.tutor.doc) + ' · ' + esc(r.clinica) + '</div></div><button class="btn sm primary" data-imp="' + r.id + '">Incorporar</button></div>').join('')
        : empty('network', 'Sin coincidencias en la red', '<span class="small">Probá con otro nombre o documento.</span>');
    };
    openModal({
      title: 'Buscar en la red EISPLUS', wide: true,
      body: '<p class="muted" style="margin-top:0">Pacientes atendidos en otras clínicas de la red. Al incorporarlos, su historia queda disponible en esta clínica.</p>' + searchBox('q-red', 'Nombre de la mascota, tutor o documento…', '') + '<div id="red-res" style="margin-top:12px;border:1px solid var(--line);border-radius:12px">' + render('') + '</div>',
      onMount(m) {
        const box = m.querySelector('#red-res');
        const bind = () => box.querySelectorAll('[data-imp]').forEach((b) => b.onclick = () => { const p = A.importarDeRed(b.dataset.imp); toast(esc(p.nombre) + ' incorporado desde la red'); box.innerHTML = render(m.querySelector('#q-red').value); bind(); });
        m.querySelector('#q-red').oninput = (e) => { box.innerHTML = render(e.target.value); bind(); };
        bind();
      },
    });
  }
  function pacienteDetalle(id) {
    const p = Store.paciente(id), t = Store.tutor(p.tutorId) || {};
    const est = S().estudios.filter((e) => e.pacienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tur = S().turnos.filter((x) => x.pacienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const hemo = S().hemo.filter((u) => u.pacienteId === id);
    openModal({
      title: esc(p.nombre) + ' <span class="sp">· ' + esc(p.especie) + '</span>', wide: true,
      body: '<dl class="dl"><dt>Raza</dt><dd>' + esc(p.raza) + '</dd><dt>Edad</dt><dd>' + Store.edad(p.nacimiento) + ' (nac. ' + fDate(p.nacimiento) + ')</dd><dt>Sexo / peso</dt><dd>' + esc(p.sexo) + (p.peso ? ' · ' + p.peso + ' kg' : '') + '</dd><dt>Tutor</dt><dd><a href="#/tutores/' + t.id + '">' + tutorName(t) + '</a> · ' + esc(Dominio.tutores.TIPOS_DOC[t.tipoDoc || 'DNI'] + ' ' + t.doc) + ' · ' + esc(t.tel) + '</dd><dt>Origen</dt><dd>' + (p.origen === 'red' ? 'Incorporado desde la red EISPLUS' : 'Paciente de la clínica') + '</dd></dl>' +
        '<div class="section-title">Estudios (' + est.length + ')</div>' +
        (est.length ? '<div class="table-wrap"><table><tbody>' + est.map((e) => '<tr class="clickable" data-est="' + e.id + '"><td class="nowrap">' + fDate(e.fecha) + '</td><td>' + esc(e.tipo) + '</td><td>' + esc(e.motivo) + '</td><td>' + resBadge(e.resultado) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Sin estudios.</p>') +
        '<div class="section-title">Turnos (' + tur.length + ')</div>' +
        (tur.length ? tur.map((x) => '<div class="small" style="padding:4px 0">' + fShort(x.fecha) + ' · ' + esc(x.tipo) + ' · ' + turnoEstadoBadge(x) + '</div>').join('') : '<p class="muted">Sin turnos.</p>') +
        (hemo.length ? '<div class="section-title">Hemocomponentes</div>' + hemo.map((u) => '<div class="small">' + esc(u.id) + ' · ' + esc(u.comp) + ' · ' + esc(u.grupo) + ' · ' + hemoEstadoBadge(u) + '</div>').join('') : ''),
      foot: '<button class="btn" id="pd-turno">' + icon('calendar') + 'Nuevo turno</button><button class="btn primary" id="pd-est">' + icon('scan') + 'Nuevo estudio</button>',
      onMount(m) {
        m.querySelectorAll('[data-est]').forEach((r) => r.onclick = () => { closeModal(); go('#/estudios/' + r.dataset.est); });
        m.querySelector('#pd-turno').onclick = () => Views.turnoForm(id);
        m.querySelector('#pd-est').onclick = () => Views.estudioForm(id);
      },
    });
  }

  /* =========================================================== HEMOCOMPONENTES */
  function hemoEstadoEfectivo(u) {
    if ((u.estado === 'disponible' || u.estado === 'reservada') && Store.daysBetween(new Date(), u.vence) < 0) return 'vencida';
    return u.estado;
  }
  function hemoEstadoBadge(u) {
    const m = { disponible: ['Disponible', 'b-normal'], reservada: ['Reservada', 'b-blue'], transfundida: ['Transfundida', 'b-violet'], vencida: ['Vencida', 'b-patologico'], descartada: ['Descartada', 'b-gray'], traslado: ['En traslado', 'b-incierto'] }[hemoEstadoEfectivo(u)];
    return '<span class="badge ' + m[1] + '">' + m[0] + '</span>';
  }
  function venceBadge(u) {
    const d = Store.daysBetween(new Date(), u.vence), est = hemoEstadoEfectivo(u);
    if (est === 'transfundida' || est === 'descartada') return '<span class="muted">' + fDate(u.vence) + '</span>';
    if (d < 0) return '<span style="color:var(--red)" class="strong">' + fDate(u.vence) + '</span>';
    if (d <= 7) return fDate(u.vence) + ' <span class="badge b-patologico">' + (d === 0 ? 'hoy' : d + ' d') + '</span>';
    return fDate(u.vence) + ' <span class="sp">(' + d + ' d)</span>';
  }
  const COMPS = ['Glóbulos rojos', 'Plasma fresco congelado', 'Sangre entera', 'Plaquetas'];
  function hemocomponentes() {
    const s = S(), all = s.hemo;
    const activas = all.filter((u) => ['disponible', 'reservada'].includes(hemoEstadoEfectivo(u)));
    const alertas = Store.hemoAlertas();
    const filtered = all.filter((u) => {
      const est = hemoEstadoEfectivo(u);
      if (ui.hemoUbic === 'clinica' && u.ubicacion !== 'Esta clínica') return false;
      if (ui.hemoUbic === 'red' && u.ubicacion === 'Esta clínica') return false;
      if (ui.hemoEstado === 'activas' && !['disponible', 'reservada'].includes(est)) return false;
      if (ui.hemoEstado === 'historial' && ['disponible', 'reservada'].includes(est)) return false;
      const p = u.pacienteId ? Store.paciente(u.pacienteId) : null;
      return match(ui.qHemo, u.id, u.comp, u.grupo, u.especie, u.ubicacion, u.donante, p ? p.nombre : '');
    }).sort((a, b) => a.vence.localeCompare(b.vence));
    const html = pageHead('drop', 'Consolidado de hemocomponentes', 'Stock de la clínica y de la red EISPLUS, con trazabilidad de cada unidad de su origen a su uso.', '<button class="btn primary" id="btn-ingreso">' + icon('plus') + 'Registrar ingreso</button>', 'red') +
      (alertas.length ? '<div class="callout red" style="margin-bottom:20px">' + icon('alert') + '<span><b>' + alertas.length + (alertas.length === 1 ? ' unidad vence' : ' unidades vencen') + ' en los próximos 7 días:</b> ' + alertas.map((u) => esc(u.id) + ' (' + esc(u.comp) + ', ' + esc(u.ubicacion) + ')').join(' · ') + '</span></div>' : '') +
      '<div class="hemo-types">' + COMPS.map((c) => {
        const us = activas.filter((u) => u.comp === c), disp = us.filter((u) => hemoEstadoEfectivo(u) === 'disponible');
        const grupos = {}; disp.forEach((u) => { const k = u.especie.slice(0, 3) + ' ' + u.grupo; grupos[k] = (grupos[k] || 0) + 1; });
        const vol = disp.reduce((a, u) => a + u.volumen, 0);
        return '<div class="card hemo-type"><div class="ht"><span class="drop-ic">' + icon('drop') + '</span>' + c + '</div><div class="hn">' + disp.length + '</div><div class="hs">disponibles · ' + vol + ' ml' + (us.length - disp.length ? ' · ' + (us.length - disp.length) + ' reservada' + (us.length - disp.length > 1 ? 's' : '') : '') + '</div><div class="groups">' + (Object.entries(grupos).map(([g, n]) => '<span class="chip">' + esc(g) + ' · ' + n + '</span>').join('') || '<span class="small muted">Sin stock</span>') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="toolbar">' + searchBox('q-hemo', 'Buscar por unidad, grupo, donante o paciente…', ui.qHemo) +
      '<div class="seg">' + [['todas', 'Toda la red'], ['clinica', 'Esta clínica'], ['red', 'Otras sedes']].map(([k, l]) => '<button data-ub="' + k + '" class="' + (ui.hemoUbic === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      '<div class="seg">' + [['activas', 'En stock'], ['historial', 'Historial'], ['todas', 'Todas']].map(([k, l]) => '<button data-es="' + k + '" class="' + (ui.hemoEstado === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Componente</th><th>Especie · grupo</th><th>Volumen</th><th>Ubicación</th><th>Vence</th><th>Estado</th><th class="actions">Trazabilidad</th></tr></thead><tbody>' +
      (filtered.map((u) => { const p = u.pacienteId ? Store.paciente(u.pacienteId) : null; return '<tr class="clickable" data-u="' + u.id + '"><td class="strong nowrap">' + esc(u.id) + '</td><td>' + esc(u.comp) + '</td><td class="nowrap">' + esc(u.especie) + ' · ' + esc(u.grupo) + '</td><td>' + u.volumen + ' ml</td><td>' + esc(u.ubicacion) + '</td><td class="nowrap">' + venceBadge(u) + '</td><td>' + hemoEstadoBadge(u) + (p ? '<div class="sp">' + esc(p.nombre) + '</div>' : '') + '</td><td class="actions"><button class="icon-btn" title="Ver trazabilidad">' + icon('eye') + '</button></td></tr>'; }).join('') ||
        '<tr><td colspan="8">' + empty('drop', 'Sin unidades', '<span class="small">Probá con otro filtro.</span>') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-hemo', 'qHemo', () => App.render(true));
        on(root, '[data-ub]', 'click', (el) => { ui.hemoUbic = el.dataset.ub; App.render(); });
        on(root, '[data-es]', 'click', (el) => { ui.hemoEstado = el.dataset.es; App.render(); });
        on(root, '[data-u]', 'click', (el) => hemoUnidad(el.dataset.u));
        root.querySelector('#btn-ingreso').onclick = hemoIngreso;
      },
    };
  }
  const EV_CLS = { extraccion: '', proceso: '', traslado: '', reserva: 'amber', transfusion: '', vencimiento: 'red', descarte: 'red', liberacion: 'amber' };
  function hemoUnidad(id) {
    const u = S().hemo.find((x) => x.id === id), est = hemoEstadoEfectivo(u), p = u.pacienteId ? Store.paciente(u.pacienteId) : null;
    const enClinica = u.ubicacion === 'Esta clínica';
    let acciones = '';
    if (est === 'disponible' && enClinica) acciones = '<button class="btn" id="h-res">Reservar para paciente</button><button class="btn primary" id="h-tx">Transfundir</button>';
    if (est === 'disponible' && !enClinica) acciones = '<button class="btn primary" id="h-tras">Solicitar traslado a esta clínica</button>';
    if (est === 'reservada') acciones = '<button class="btn" id="h-lib">Liberar reserva</button><button class="btn primary" id="h-tx">Registrar transfusión</button>';
    if (est === 'vencida') acciones = '<button class="btn danger" id="h-desc">Registrar descarte</button>';
    openModal({
      title: 'Unidad ' + esc(u.id), wide: true,
      body: '<div class="grid halves" style="margin:0"><div><dl class="dl"><dt>Componente</dt><dd>' + esc(u.comp) + '</dd><dt>Especie · grupo</dt><dd>' + esc(u.especie) + ' · ' + esc(u.grupo) + '</dd><dt>Volumen</dt><dd>' + u.volumen + ' ml</dd><dt>Donante</dt><dd>' + esc(u.donante) + '</dd><dt>Extracción</dt><dd>' + fDate(u.extraccion) + '</dd><dt>Vencimiento</dt><dd>' + venceBadge(u) + '</dd><dt>Ubicación</dt><dd>' + esc(u.ubicacion) + '</dd><dt>Estado</dt><dd>' + hemoEstadoBadge(u) + '</dd>' + (p ? '<dt>Paciente</dt><dd>' + esc(p.nombre) + ' (' + esc(p.especie) + ')</dd>' : '') + '</dl>' +
        '<div id="h-form" style="margin-top:16px"></div></div>' +
        '<div><div class="section-title" style="margin-top:0">Trazabilidad: del origen al paciente</div><ul class="timeline">' +
        u.eventos.map((ev) => '<li class="' + (EV_CLS[ev.tipo] || '') + '"><div class="tt">' + esc(ev.texto) + '</div><div class="ts">' + fDate(ev.fecha) + ' · ' + esc(ev.lugar) + '</div></li>').join('') + '</ul></div></div>',
      foot: '<button class="btn" data-close>Cerrar</button>' + acciones,
      onMount(m) {
        const form = m.querySelector('#h-form');
        const pacSel = (lbl, okLbl, fn) => {
          const opts = pacienteOptions(u.pacienteId, (x) => x.especie === u.especie);
          if (!opts) return toast('No hay pacientes ' + u.especie.toLowerCase() + 's en la clínica', 'warn');
          form.innerHTML = '<div class="field"><label>' + lbl + '</label><select id="h-pac">' + opts + '</select></div><label style="display:flex;gap:8px;margin:10px 0" class="small"><input type="checkbox" id="h-cruz"> Prueba cruzada compatible</label><button class="btn primary sm" id="h-go">' + okLbl + '</button>';
          form.querySelector('#h-go').onclick = () => { if (!form.querySelector('#h-cruz').checked) return toast('Confirmá la prueba cruzada', 'warn'); fn(Store.paciente(form.querySelector('#h-pac').value)); closeModal(); };
        };
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        b('#h-res', () => pacSel('Reservar para', 'Confirmar reserva', (pp) => { A.hemoEvento(id, 'reserva', 'Reservada para ' + pp.nombre + ' (prueba cruzada compatible)', { estado: 'reservada', pacienteId: pp.id }); toast('Unidad reservada para ' + pp.nombre); }));
        b('#h-tx', () => {
          if (u.pacienteId) { const pp = Store.paciente(u.pacienteId); A.hemoEvento(id, 'transfusion', 'Transfundida a ' + pp.nombre + ' por ' + S().usuario.completo, { estado: 'transfundida' }); toast('Transfusión registrada'); closeModal(); }
          else pacSel('Paciente receptor', 'Registrar transfusión', (pp) => { A.hemoEvento(id, 'transfusion', 'Transfundida a ' + pp.nombre + ' por ' + S().usuario.completo, { estado: 'transfundida', pacienteId: pp.id }); toast('Transfusión registrada'); });
        });
        b('#h-lib', () => { A.hemoEvento(id, 'liberacion', 'Reserva liberada', { estado: 'disponible', pacienteId: null }); toast('Reserva liberada'); closeModal(); });
        b('#h-desc', () => { A.hemoEvento(id, 'descarte', 'Descartada por vencimiento', { estado: 'descartada' }); toast('Descarte registrado'); closeModal(); });
        b('#h-tras', () => {
          const origen = u.ubicacion;
          A.hemoEvento(id, 'traslado', 'Traslado solicitado desde ' + origen, {});
          A.hemoEvento(id, 'traslado', 'Recibida en cadena de frío', { ubicacion: 'Esta clínica' });
          toast('Unidad trasladada a esta clínica'); closeModal();
        });
      },
    });
  }
  function hemoIngreso() {
    openModal({
      title: 'Registrar ingreso de unidad',
      body: '<div class="form-grid">' +
        '<div class="field"><label>Componente</label><select name="comp">' + COMPS.map((c) => '<option>' + c + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Especie</label><select name="especie" id="h-esp"><option>Canino</option><option>Felino</option></select></div>' +
        '<div class="field"><label>Grupo</label><select name="grupo" id="h-gr"></select></div>' +
        '<div class="field"><label>Volumen (ml)</label><input type="number" name="volumen" value="250"></div>' +
        '<div class="field"><label>Donante</label><input name="donante" placeholder="Nombre del donante"></div>' +
        '<div class="field"><label>Vencimiento</label><input type="date" name="vence" value="' + new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10) + '"></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="hi-ok">Registrar</button>',
      onMount(m) {
        const esp = m.querySelector('#h-esp'), gr = m.querySelector('#h-gr');
        const sync = () => { gr.innerHTML = (esp.value === 'Canino' ? ['DEA 1.1 −', 'DEA 1.1 +'] : ['Tipo A', 'Tipo B', 'Tipo AB']).map((g) => '<option>' + g + '</option>').join(''); };
        sync(); esp.onchange = sync;
        m.querySelector('#hi-ok').onclick = () => {
          const f = formData(m);
          if (!f.donante) return toast('Indicá el donante', 'warn');
          const n = 450 + S().hemo.length, now = new Date().toISOString();
          const u = { id: 'HC-0' + n, comp: f.comp, especie: f.especie, grupo: f.grupo, volumen: +f.volumen || 0, donante: f.donante + ' (' + f.especie + ')', ubicacion: 'Esta clínica', extraccion: now, vence: new Date(f.vence + 'T12:00:00').toISOString(), estado: 'disponible', pacienteId: null,
            eventos: [{ fecha: now, tipo: 'extraccion', texto: 'Extracción a donante ' + f.donante, lugar: 'Esta clínica' }, { fecha: now, tipo: 'proceso', texto: 'Etiquetado y almacenamiento', lugar: 'Esta clínica' }] };
          S().hemo.push(u); Store.save(); closeModal(); toast('Unidad ' + u.id + ' registrada');
        };
      },
    });
  }

  /* =========================================================== TUTORES */
  const TD = () => Dominio.tutores;
  const docTexto = (t) => (TD().TIPOS_DOC[t.tipoDoc || 'DNI'] || 'DNI') + ' ' + (t.doc || '—');
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  function tutores() {
    const verBajas = ui.tutBajas === true;
    const editar = Store.puede('tutores', 'editar');
    const lista = S().tutores.filter((t) => (verBajas ? t.activo === false : t.activo !== false)).filter((t) => {
      const mascotas = TD().mascotasDe(t.id, S().pacientes).map((p) => p.nombre).join(' ');
      return match(ui.qTut, t.nombre, t.apellido, t.doc, t.tel, t.email, mascotas);
    }).sort((a, b) => (a.apellido + a.nombre).localeCompare(b.apellido + b.nombre));
    const bajas = S().tutores.filter((t) => t.activo === false).length;
    const rows = lista.map((t) => {
      const r = TD().resumen(t.id, S().pacientes, S().turnos);
      const mascotas = TD().mascotasDe(t.id, S().pacientes);
      return '<tr class="clickable" data-go="#/tutores/' + t.id + '"><td><div class="strong">' + tutorName(t) + '</div>' + (t.activo === false ? '<span class="badge b-gray">Dado de baja</span>' : '') + '</td>' +
        '<td class="nowrap">' + esc(docTexto(t)) + '</td><td>' + esc(t.tel || '—') + '<div class="sp">' + esc(t.email || '') + '</div></td>' +
        '<td>' + (mascotas.map((p) => '<span class="chip" style="margin:0 4px 4px 0">' + esc(p.nombre) + '</span>').join('') || '<span class="muted">—</span>') + '</td>' +
        '<td class="nowrap">' + (r.proximo ? fShort(r.proximo.fecha) : '<span class="muted">—</span>') + '</td>' +
        '<td class="actions">' + (editar ? '<button class="icon-btn" data-edit="' + t.id + '" title="Editar">' + icon('edit') + '</button>' : '') + '</td></tr>';
    }).join('');
    const html = pageHead('users', 'Tutores', 'Responsables de las mascotas: contacto, mascotas a cargo, turnos y compras.', editar ? '<button class="btn primary" id="btn-nuevo">' + icon('plus') + 'Nuevo tutor</button>' : '') +
      '<div class="toolbar">' + searchBox('q-tut', 'Buscar por nombre, documento, teléfono, email o mascota…', ui.qTut || '') +
      '<div class="seg"><button data-bajas="0" class="' + (verBajas ? '' : 'on') + '">Activos</button><button data-bajas="1" class="' + (verBajas ? 'on' : '') + '">Dados de baja (' + bajas + ')</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Tutor</th><th>Documento</th><th>Contacto</th><th>Mascotas</th><th>Próximo turno</th><th class="actions"></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">' + empty('users', verBajas ? 'No hay tutores dados de baja' : 'Sin resultados', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-tut', 'qTut', () => App.render(true));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        on(root, '[data-bajas]', 'click', (el) => { ui.tutBajas = el.dataset.bajas === '1'; App.render(); });
        on(root, '[data-edit]', 'click', (el, e) => { e.stopPropagation(); tutorForm(el.dataset.edit); });
        const bn = root.querySelector('#btn-nuevo'); if (bn) bn.onclick = () => tutorForm(null, (t) => go('#/tutores/' + t.id));
      },
    };
  }

  function tutorForm(id, alGuardar) {
    const t = id ? Store.tutor(id) : { tipoDoc: 'DNI' };
    const campo = (name, label, val, extra) => '<div class="field' + (extra && extra.full ? ' full' : '') + '"><label>' + label + '</label><input name="' + name + '" value="' + esc(val || '') + '"' + (extra && extra.ph ? ' placeholder="' + extra.ph + '"' : '') + (extra && extra.type ? ' type="' + extra.type + '"' : '') + '></div>';
    openModal({
      title: id ? 'Editar tutor' : 'Nuevo tutor',
      body: '<div class="form-grid">' + campo('nombre', 'Nombre', t.nombre) + campo('apellido', 'Apellido', t.apellido) +
        '<div class="field"><label>Tipo de documento</label><select name="tipoDoc">' + Object.entries(TD().TIPOS_DOC).map(([k, l]) => '<option value="' + k + '"' + ((t.tipoDoc || 'DNI') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        campo('doc', 'Número', t.doc, { ph: 'Sin puntos' }) +
        campo('tel', 'Teléfono', t.tel, { type: 'tel' }) + campo('email', 'Email', t.email, { type: 'email' }) +
        campo('domicilio', 'Domicilio', t.domicilio, { full: true }) +
        campo('cuit', 'CUIT (opcional, para facturación)', t.cuit, { ph: '20-12345678-9' }) +
        '<div class="field full"><label>Notas</label><textarea name="notas" style="min-height:60px">' + esc(t.notas || '') + '</textarea></div>' +
        '</div><p class="small muted" style="margin:12px 0 0">El documento se usa en la receta veterinaria electrónica (Res. SENASA 654/2026, art. 18).</p>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="tf-ok">' + (id ? 'Guardar' : 'Crear tutor') + '</button>',
      onMount(m) {
        m.querySelector('#tf-ok').onclick = () => {
          const f = formData(m);
          const datos = { nombre: f.nombre, apellido: f.apellido, tipoDoc: f.tipoDoc, doc: f.doc, tel: f.tel, email: f.email, domicilio: f.domicilio, cuit: f.cuit, notas: f.notas };
          const errores = TD().validar(Object.assign({ id }, datos), S().tutores);
          if (errores.length) return toast(errores[0], 'warn');
          let res;
          if (id) { A.updateTutor(id, datos); res = Store.tutor(id); toast('Tutor actualizado'); }
          else { res = A.addTutor(datos); toast(esc(datos.nombre + ' ' + datos.apellido) + ' fue agregado/a'); }
          closeModal();
          if (alGuardar) alGuardar(res);
        };
      },
    });
  }

  function tutorDetalle(id) {
    const t = Store.tutor(id);
    if (!t) return { html: empty('users', 'Tutor no encontrado', ''), mount() {} };
    const editar = Store.puede('tutores', 'editar');
    const mascotas = TD().mascotasDe(id, S().pacientes);
    const turnos = TD().historialTurnos(id, S().pacientes, S().turnos);
    const r = TD().resumen(id, S().pacientes, S().turnos);
    const cmp = TD().compras(id, S().ventas);
    const nombre = (pid) => (Store.paciente(pid) || {}).nombre || '—';
    const dato = (k, v) => '<dt>' + k + '</dt><dd>' + (v || '<span class="muted">—</span>') + '</dd>';
    const html = '<a href="#/tutores" class="btn ghost sm" style="margin-bottom:12px">← Tutores</a>' +
      pageHead('users', tutorName(t), esc(docTexto(t)) + (t.activo === false ? ' · <span class="badge b-gray">Dado de baja el ' + fDate(t.fechaBaja) + '</span>' : ''),
        editar ? '<button class="btn" id="tb-edit">' + icon('edit') + 'Editar</button>' + (t.activo === false ? '<button class="btn" id="tb-alta">Reactivar</button>' : '<button class="btn danger" id="tb-baja">Dar de baja</button>') + (t.activo !== false && Store.puede('pacientes', 'editar') ? '<button class="btn primary" id="tb-mascota">' + icon('plus') + 'Agregar mascota</button>' : '') : '') +
      '<div class="grid kpis">' +
      kpi('paw', '', 'Mascotas a cargo', mascotas.length, '') +
      kpi('calendar', '', 'Próximo turno', r.proximo ? fShort(r.proximo.fecha).split(' · ')[0] : '—', r.proximo ? esc(nombre(r.proximo.pacienteId) + ' · ' + r.proximo.tipo) : 'sin turnos') +
      kpi('history', 'amber', 'Última visita', r.ultima ? fDate(r.ultima.fecha) : '—', r.ultima ? esc(nombre(r.ultima.pacienteId) + ' · ' + r.ultima.tipo) : '') +
      kpi('file', 'violet', 'Compras', pesos(cmp.total), cmp.lista.length + (cmp.lista.length === 1 ? ' operación' : ' operaciones')) +
      '</div>' +
      '<div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>Contacto</h3></div><div class="card-pad" style="padding-top:6px"><dl class="dl">' +
      dato('Teléfono', t.tel ? '<a href="tel:' + esc(t.tel.replace(/\s/g, '')) + '">' + esc(t.tel) + '</a>' : '') +
      dato('Email', t.email ? '<a href="mailto:' + esc(t.email) + '">' + esc(t.email) + '</a>' : '') +
      dato('Domicilio', esc(t.domicilio)) + dato('Documento', esc(docTexto(t))) + dato('CUIT', esc(t.cuit)) + dato('Notas', esc(t.notas)) +
      '</dl></div></div>' +
      '<div class="card"><div class="card-head"><h3>Mascotas a cargo</h3></div>' +
      (mascotas.length ? mascotas.map((p) => '<div class="list-row clickable" data-pac="' + p.id + '"><div class="att-ic green">' + icon('paw') + '</div><div class="grow"><div class="t">' + esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ' · ' + esc(p.raza) + ')</span></div><div class="s">' + Store.edad(p.nacimiento) + (p.peso ? ' · ' + p.peso + ' kg' : '') + '</div></div>' + icon('arrow') + '</div>').join('')
        : empty('paw', 'Sin mascotas a cargo', '')) + '</div></div>' +
      '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic">' + icon('calendar') + '</span><h3>Historial de turnos</h3></div>' +
      (turnos.length ? '<div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Mascota</th><th>Tipo</th><th>Origen</th><th>Estado</th></tr></thead><tbody>' +
        turnos.map((x) => '<tr><td class="nowrap">' + fShort(x.fecha) + '</td><td>' + esc(nombre(x.pacienteId)) + '</td><td>' + esc(x.tipo) + '</td><td class="muted">' + (x.origen === 'portal' ? 'Portal Cliente' : 'Clínica') + '</td><td>' + turnoEstadoBadge(x) + '</td></tr>').join('') + '</tbody></table></div>'
        : empty('calendar', 'Sin turnos', '')) + '</div>' +
      '<div class="card"><div class="card-head"><span class="ic" style="color:var(--violet)">' + icon('file') + '</span><h3>Compras</h3>' + (cmp.lista.length ? '<span class="small muted">Total ' + pesos(cmp.total) + '</span>' : '') + '</div>' +
      (cmp.lista.length ? '<div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Mascota</th><th>Pago</th><th style="text-align:right">Total</th></tr></thead><tbody>' +
        cmp.lista.map((v) => '<tr' + (v.estado === 'anulada' ? ' style="opacity:.55"' : '') + '><td class="nowrap">' + fShort(v.fecha) + '</td><td>' + esc((v.items || []).map((i) => i.cantidad + '× ' + i.nombre).join(', ')) + (v.estado === 'anulada' ? ' <span class="badge b-gray">Anulada</span>' : '') + '</td><td>' + esc(v.pacienteId ? nombre(v.pacienteId) : '—') + '</td><td>' + esc(v.medioPago || '') + '</td><td style="text-align:right" class="nowrap">' + pesos(v.total) + '</td></tr>').join('') + '</tbody></table></div>'
        : empty('file', 'Todavía no hay compras registradas', '')) + '</div>';
    return {
      html, mount(root) {
        on(root, '[data-pac]', 'click', (el) => pacienteDetalle(el.dataset.pac));
        const b = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
        b('#tb-edit', () => tutorForm(id));
        b('#tb-baja', () => confirmModal('Dar de baja al tutor', 'El tutor deja de aparecer para nuevas altas, pero se conservan sus datos, sus mascotas, sus turnos y sus compras. Podés reactivarlo cuando quieras.', 'Dar de baja', () => { A.bajaTutor(id); toast('Tutor dado de baja'); }));
        b('#tb-alta', () => { A.reactivarTutor(id); toast('Tutor reactivado'); });
        b('#tb-mascota', () => pacienteForm(null, { tutorId: id }));
      },
    };
  }

  Object.assign(window.Views, { pacientes, pacienteForm, buscarEnRed, tutores, tutorForm, tutorDetalle, pacienteDetalle, hemoEstadoEfectivo, hemoEstadoBadge, venceBadge, hemocomponentes, hemoUnidad, hemoIngreso });
})();

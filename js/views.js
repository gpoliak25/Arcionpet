/* Vistas de la demo. Cada vista devuelve { html, mount(root) }. */
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

  const pacienteOptions = (sel, filtro) => S().pacientes.filter(filtro || (() => true))
    .map((p) => '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nombre) + ' (' + esc(p.especie) + ') — ' + tutorName(Store.tutor(p.tutorId)) + '</option>').join('');

  /* =========================================================== INICIO */
  function inicio() {
    const s = S(), u = s.usuario, now = new Date(), h = now.getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const hoy = s.turnos.filter((t) => Store.isToday(t.fecha) && !['cancelado'].includes(t.estado)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pendPortal = s.turnos.filter((t) => t.estado === 'pendiente');
    const borradores = s.informes.filter((i) => i.estado === 'borrador');
    const icActivas = s.interconsultas.filter((i) => i.estado !== 'cerrada');
    const propios = s.pacientes.filter((p) => p.origen === 'clinica').length;

    const att = [];
    borradores.forEach((i) => { const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId); att.push({ ic: 'file', c: '', t: 'Informe de ' + p.nombre, s: 'Borrador para revisar y firmar', go: '#/informes/' + i.id }); });
    pendPortal.forEach((t) => { const p = Store.paciente(t.pacienteId); att.push({ ic: 'globe', c: 'green', t: 'Pedido de turno: ' + p.nombre, s: t.tipo + ' · ' + fShort(t.fecha) + ' · Portal Cliente', go: '#/turnos' }); });
    s.derivaciones.filter((d) => d.estado === 'respondida' && !d.vista).forEach((d) => { const p = Store.paciente(Store.estudio(d.estudioId).pacienteId); att.push({ ic: 'stetho', c: 'green', t: 'Derivación respondida: ' + p.nombre, s: d.a, go: '#/derivaciones' }); });
    s.interconsultas.filter((i) => i.noLeida).forEach((i) => att.push({ ic: 'chat', c: 'violet', t: 'Respuesta de soporte', s: i.asunto, go: '#/interconsultas/' + i.id }));
    Store.hemoAlertas().forEach((x) => { const d = Store.daysBetween(new Date(), x.vence); att.push({ ic: 'drop', c: 'red', t: x.comp + ' ' + x.id, s: (d === 0 ? 'Vence hoy' : 'Vence en ' + d + ' d') + ' · ' + x.ubicacion, go: '#/hemocomponentes' }); });

    const recientes = s.estudios.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);
    const pk = s.pack;

    const html =
      '<div class="greeting"><small>' + fLong(now) + '</small><h1>' + saludo + ', ' + esc(u.nombre) + ' 👋</h1>' +
      '<p>' + (att.length ? 'Tenés ' + att.length + (att.length === 1 ? ' cosa que necesita' : ' cosas que necesitan') + ' tu atención.' : 'Todo al día. ¡Buen trabajo!') + '</p></div>' +
      '<div class="grid kpis">' +
      kpi('paw', '', 'Pacientes', s.pacientes.length, 'propios y de la red', '#/pacientes') +
      kpi('calendar', '', 'Turnos de hoy', hoy.length, pendPortal.length ? pendPortal.length + ' pedido' + (pendPortal.length > 1 ? 's' : '') + ' del portal' : 'sin pedidos pendientes', '#/turnos') +
      kpi('file', 'amber', 'Informes para firmar', borradores.length, '', '#/informes') +
      kpi('chat', 'violet', 'Interconsultas activas', icActivas.length, '', '#/interconsultas') +
      '</div>' +
      '<div class="grid two">' +
      '<div class="card"><div class="card-head"><span class="ic">' + icon('clock') + '</span><h3>Agenda de hoy</h3><a class="link" href="#/turnos">Ver todo ' + icon('arrow') + '</a></div>' +
      (hoy.length ? hoy.map((t) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="att-ic green">' + icon('calendar') + '</div><div class="grow"><div class="t">' + fTime(t.fecha) + ' · ' + esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ')</span></div><div class="s">' + esc(t.tipo) + '</div></div>' + turnoEstadoBadge(t) + '</div>'; }).join('')
        : empty('calendar', 'Sin turnos para hoy', '<span class="small">Los turnos que reserven tus clientes desde el portal aparecen acá.</span>')) +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Necesita atención</h3></div>' +
      (att.length ? att.slice(0, 6).map((a) => '<div class="list-row clickable" data-go="' + a.go + '"><div class="att-ic ' + a.c + '">' + icon(a.ic) + '</div><div class="grow"><div class="t">' + esc(a.t) + '</div><div class="s">' + esc(a.s) + '</div></div></div>').join('')
        : empty('check', 'Nada pendiente', '')) +
      '</div></div>' +
      '<div class="grid two">' +
      '<div class="card"><div class="card-head"><span class="ic">' + icon('scan') + '</span><h3>Estudios recientes</h3><a class="link" href="#/estudios">Ver todo ' + icon('arrow') + '</a></div>' +
      recientes.map((e) => { const p = Store.paciente(e.pacienteId); return '<div class="list-row clickable" data-go="#/estudios/' + e.id + '"><div class="grow"><div class="t">' + esc(p.nombre) + ' · ' + esc(e.tipo) + '</div><div class="s">' + esc(e.motivo) + '</div></div>' + resBadge(e.resultado) + '</div>'; }).join('') +
      '</div>' +
      '<div class="card"><div class="card-head"><span class="ic" style="color:var(--violet)">' + icon('headset') + '</span><h3>Soporte EISPLUS</h3><a class="link" href="#/interconsultas">Ver todo ' + icon('arrow') + '</a></div>' +
      '<div class="card-pad" style="padding-top:8px"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="strong">' + esc(pk.nombre) + '</span><span class="muted">' + pk.usadas + ' / ' + pk.total + ' · quedan ' + (pk.total - pk.usadas) + '</span></div>' +
      '<div class="progress violet"><div style="width:' + (pk.usadas / pk.total * 100) + '%"></div></div>' +
      '<p class="small muted" style="margin:12px 0 0">Consultá casos dudosos con el equipo central de la red. El cupo se renueva el 1° de cada mes.</p>' +
      '<button class="btn sm" style="margin-top:14px" data-go="#/arcion">' + icon('spark') + 'Preguntale a ARCION</button></div></div>' +
      '</div>';
    return { html, mount(root) { on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); } };
  }
  function kpi(ic, color, label, value, sub, href) {
    return '<div class="card kpi' + (href ? ' clickable" data-go="' + href : '') + '"><div class="ki ' + color + '">' + icon(ic) + '</div><div><div class="kl">' + label + '</div><div class="kv">' + value + '</div>' + (sub ? '<div class="ks">' + sub + '</div>' : '') + '</div></div>';
  }

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
        root.querySelector('#btn-tutores').onclick = tutoresModal;
        on(root, '[data-ver]', 'click', (el) => pacienteDetalle(el.dataset.ver));
        on(root, '[data-edit]', 'click', (el, e) => { e.stopPropagation(); pacienteForm(el.dataset.edit); });
        on(root, '[data-del]', 'click', (el, e) => {
          e.stopPropagation(); const p = Store.paciente(el.dataset.del);
          confirmModal('Eliminar paciente', '¿Eliminar a <b>' + esc(p.nombre) + '</b> junto con sus estudios, informes y turnos? Esta acción no se puede deshacer.', 'Eliminar', () => { A.deletePaciente(p.id); toast('Paciente eliminado'); });
        });
      },
    };
  }
  function pacienteForm(id) {
    const p = id ? Store.paciente(id) : { especie: 'Canino', sexo: 'Hembra' };
    const tutOpts = S().tutores.map((t) => '<option value="' + t.id + '"' + (t.id === p.tutorId ? ' selected' : '') + '>' + tutorName(t) + ' · DNI ' + esc(t.doc) + '</option>').join('');
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
        if (!id && S().tutores.length) sel.value = S().tutores[0].id;
        sync(); sel.onchange = sync;
        m.querySelector('#f-ok').onclick = () => {
          const f = formData(m);
          if (!f.nombre || !f.nacimiento) return toast('Completá nombre y fecha de nacimiento', 'warn');
          if (!f.tutorId && (!f.tNombre || !f.tApellido)) return toast('Indicá el tutor', 'warn');
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
  function tutoresModal() {
    const rows = S().tutores.map((t) => {
      const mascotas = S().pacientes.filter((p) => p.tutorId === t.id).map((p) => p.nombre).join(', ') || '—';
      return '<tr><td class="strong">' + tutorName(t) + '</td><td>' + esc(t.doc) + '</td><td>' + esc(t.tel) + '<div class="sp">' + esc(t.email) + '</div></td><td>' + esc(mascotas) + '</td></tr>';
    }).join('');
    openModal({ title: 'Tutores', wide: true, body: '<div class="table-wrap"><table><thead><tr><th>Tutor</th><th>Documento</th><th>Contacto</th><th>Mascotas</th></tr></thead><tbody>' + rows + '</tbody></table></div>' });
  }
  function pacienteDetalle(id) {
    const p = Store.paciente(id), t = Store.tutor(p.tutorId) || {};
    const est = S().estudios.filter((e) => e.pacienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tur = S().turnos.filter((x) => x.pacienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const hemo = S().hemo.filter((u) => u.pacienteId === id);
    openModal({
      title: esc(p.nombre) + ' <span class="sp">· ' + esc(p.especie) + '</span>', wide: true,
      body: '<dl class="dl"><dt>Raza</dt><dd>' + esc(p.raza) + '</dd><dt>Edad</dt><dd>' + Store.edad(p.nacimiento) + ' (nac. ' + fDate(p.nacimiento) + ')</dd><dt>Sexo / peso</dt><dd>' + esc(p.sexo) + (p.peso ? ' · ' + p.peso + ' kg' : '') + '</dd><dt>Tutor</dt><dd>' + tutorName(t) + ' · DNI ' + esc(t.doc) + ' · ' + esc(t.tel) + '</dd><dt>Origen</dt><dd>' + (p.origen === 'red' ? 'Incorporado desde la red EISPLUS' : 'Paciente de la clínica') + '</dd></dl>' +
        '<div class="section-title">Estudios (' + est.length + ')</div>' +
        (est.length ? '<div class="table-wrap"><table><tbody>' + est.map((e) => '<tr class="clickable" data-est="' + e.id + '"><td class="nowrap">' + fDate(e.fecha) + '</td><td>' + esc(e.tipo) + '</td><td>' + esc(e.motivo) + '</td><td>' + resBadge(e.resultado) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Sin estudios.</p>') +
        '<div class="section-title">Turnos (' + tur.length + ')</div>' +
        (tur.length ? tur.map((x) => '<div class="small" style="padding:4px 0">' + fShort(x.fecha) + ' · ' + esc(x.tipo) + ' · ' + turnoEstadoBadge(x) + '</div>').join('') : '<p class="muted">Sin turnos.</p>') +
        (hemo.length ? '<div class="section-title">Hemocomponentes</div>' + hemo.map((u) => '<div class="small">' + esc(u.id) + ' · ' + esc(u.comp) + ' · ' + esc(u.grupo) + ' · ' + hemoEstadoBadge(u) + '</div>').join('') : ''),
      foot: '<button class="btn" id="pd-turno">' + icon('calendar') + 'Nuevo turno</button><button class="btn primary" id="pd-est">' + icon('scan') + 'Nuevo estudio</button>',
      onMount(m) {
        m.querySelectorAll('[data-est]').forEach((r) => r.onclick = () => { closeModal(); go('#/estudios/' + r.dataset.est); });
        m.querySelector('#pd-turno').onclick = () => turnoForm(id);
        m.querySelector('#pd-est').onclick = () => estudioForm(id);
      },
    });
  }

  /* =========================================================== TURNOS */
  function turnoEstadoBadge(t) {
    const m = { confirmado: ['Confirmado', 'b-blue'], pendiente: ['Pedido del portal', 'b-incierto'], atendido: ['Atendido', 'b-normal'], no_vino: ['No vino', 'b-gray'], cancelado: ['Cancelado', 'b-gray'] }[t.estado];
    return '<span class="badge ' + m[1] + '">' + m[0] + '</span>';
  }
  function turnos() {
    const s = S(), now = new Date();
    const hoy = s.turnos.filter((t) => Store.isToday(t.fecha) && t.estado === 'confirmado');
    const porAtender = hoy.filter((t) => new Date(t.fecha) > now);
    const pedidos = s.turnos.filter((t) => t.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasados = s.turnos.filter((t) => t.estado === 'confirmado' && new Date(t.fecha) < now && !Store.isToday(t.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const limite = new Date(); limite.setDate(limite.getDate() + ui.agenda);
    const agenda = s.turnos.filter((t) => t.estado === 'confirmado' && new Date(t.fecha) >= new Date(new Date().setHours(0, 0, 0, 0)) && new Date(t.fecha) <= limite).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porDia = {};
    agenda.forEach((t) => { const k = t.fecha.slice(0, 10); (porDia[k] = porDia[k] || []).push(t); });
    const fila = (t, acciones) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="grow"><span class="t">' + esc(p.nombre) + ' · ' + esc(t.tipo) + '</span> <span class="muted">· ' + fShort(t.fecha) + '</span>' + (t.nota ? '<div class="s">' + esc(t.nota) + '</div>' : '') + '</div>' + acciones + '</div>'; };

    const html = pageHead('calendar', 'Turnos', 'Agenda de la clínica y pedidos de turno desde el Portal Cliente.',
      '<button class="btn" id="btn-portal">' + icon('globe') + 'Simular pedido del portal</button><button class="btn primary" id="btn-turno">' + icon('plus') + 'Nuevo turno</button>') +
      '<div class="grid kpis">' +
      kpi('clock', '', 'Turnos de hoy', hoy.length, porAtender.length + ' por atender') +
      kpi('globe', '', 'Pedidos a confirmar', pedidos.length, pedidos.length ? 'desde el Portal Cliente' : '') +
      kpi('history', 'amber', 'Pasados sin cerrar', pasados.length, pasados.length ? 'marcá atendido o no vino' : 'todo cerrado') + '</div>' +
      (pedidos.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic">' + icon('globe') + '</span><h3>Pedidos del Portal Cliente</h3></div>' +
        pedidos.map((t) => fila(t, '<button class="btn sm primary" data-st="confirmado" data-id="' + t.id + '">' + icon('check') + 'Confirmar</button><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Rechazar</button>')).join('') + '</div>' : '') +
      (pasados.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:var(--muted)">' + icon('history') + '</span><h3>Turnos pasados sin cerrar</h3></div>' +
        pasados.map((t) => fila(t, '<button class="btn sm" data-st="atendido" data-id="' + t.id + '">' + icon('check') + 'Atendido</button><button class="btn sm ghost" data-st="no_vino" data-id="' + t.id + '">' + icon('userx') + 'No vino</button><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Cancelar</button>')).join('') + '</div>' : '') +
      '<div class="card"><div class="card-head"><span class="ic">' + icon('calendar') + '</span><h3>Agenda</h3><div class="seg">' + [7, 14, 21].map((n) => '<button data-ag="' + n + '" class="' + (ui.agenda === n ? 'on' : '') + '">' + n + ' días</button>').join('') + '</div></div>' +
      (agenda.length ? Object.keys(porDia).map((k) => '<div class="section-title" style="margin:14px 22px 4px">' + fLong(new Date(k + 'T12:00:00')) + '</div>' +
        porDia[k].map((t) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="strong" style="width:54px">' + fTime(t.fecha) + '</div><div class="grow"><div class="t">' + esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ')</span></div><div class="s">' + esc(t.tipo) + (t.origen === 'portal' ? ' · reservado desde el portal' : '') + '</div></div><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Cancelar</button></div>'; }).join('')).join('')
        : empty('calendar', 'Sin turnos confirmados', '<span class="small">No hay turnos en los próximos ' + ui.agenda + ' días.</span>')) + '</div>';
    return {
      html, mount(root) {
        root.querySelector('#btn-turno').onclick = () => turnoForm();
        root.querySelector('#btn-portal').onclick = portalForm;
        on(root, '[data-ag]', 'click', (el) => { ui.agenda = +el.dataset.ag; App.render(); });
        on(root, '[data-st]', 'click', (el) => {
          const msg = { confirmado: 'Turno confirmado. Se notificó al tutor.', cancelado: 'Turno cancelado', atendido: 'Turno marcado como atendido', no_vino: 'Turno marcado como ausente' }[el.dataset.st];
          A.setTurno(el.dataset.id, el.dataset.st); toast(msg);
        });
      },
    };
  }
  function turnoForm(pid, extra) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    openModal({
      title: (extra && extra.title) || 'Nuevo turno',
      body: (extra && extra.intro || '') + '<div class="form-grid">' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field"><label>Fecha</label><input type="date" name="dia" value="' + d.toISOString().slice(0, 10) + '"></div>' +
        '<div class="field"><label>Hora</label><input type="time" name="hora" value="10:00" step="900"></div>' +
        '<div class="field full"><label>Tipo</label><select name="tipo">' + ['Consulta general', 'Vacunación', 'Radiografía', 'Control', 'Cirugía', 'Castración', 'Control cardiológico'].map((x) => '<option>' + x + '</option>').join('') + '</select></div>' +
        ((extra && extra.nota) ? '<div class="field full"><label>Mensaje del tutor</label><textarea name="nota" style="min-height:60px">¿Tienen lugar ese día? Gracias.</textarea></div>' : '') +
        '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="t-ok">' + ((extra && extra.ok) || 'Agendar') + '</button>',
      onMount(m) {
        m.querySelector('#t-ok').onclick = () => {
          const f = formData(m);
          const fecha = new Date(f.dia + 'T' + (f.hora || '10:00') + ':00').toISOString();
          if (extra && extra.portal) { A.addTurno({ pacienteId: f.pacienteId, fecha, tipo: f.tipo, estado: 'pendiente', origen: 'portal', nota: 'Pedido desde el Portal Cliente: "' + (f.nota || '') + '"' }); toast('Llegó un pedido de turno desde el Portal Cliente', 'warn'); }
          else { A.addTurno({ pacienteId: f.pacienteId, fecha, tipo: f.tipo, estado: 'confirmado', origen: 'clinica' }); toast('Turno agendado'); }
          closeModal();
        };
      },
    });
  }
  function portalForm() {
    turnoForm(null, { title: 'Portal Cliente · pedir turno', ok: 'Enviar pedido', portal: true, nota: true,
      intro: '<div class="callout green" style="margin-bottom:14px">' + icon('globe') + '<span>Simulación de lo que ve el <b>tutor</b> en el Portal Cliente. El pedido llega a la clínica para que lo confirme.</span></div>' });
  }

  /* =========================================================== ESTUDIOS */
  function estudios() {
    const list = S().estudios.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((e) => {
      const p = Store.paciente(e.pacienteId) || {};
      return match(ui.qEst, p.nombre, e.tipo, e.motivo, e.resultado ? Store.RES_LABEL[e.resultado] : 'sin análisis');
    });
    const rows = list.map((e) => '<tr class="clickable" data-ver="' + e.id + '"><td class="strong nowrap">' + fDate(e.fecha) + '</td><td class="nowrap">' + pacLabel(Store.paciente(e.pacienteId)) + '</td><td>' + esc(e.tipo) + '</td><td><div class="truncate">' + esc(e.motivo) + '</div></td><td>' + resBadge(e.resultado) + (e.derivado ? ' <span class="small" style="color:var(--amber-d)">derivado</span>' : '') + '</td><td>' + (e.confianza != null ? e.confianza + '%' : '—') + '</td>' +
      '<td class="actions"><button class="icon-btn" title="Ver">' + icon('eye') + '</button><button class="icon-btn danger" data-del="' + e.id + '" title="Eliminar">' + icon('trash') + '</button></td></tr>').join('');
    const html = pageHead('scan', 'Estudios', 'Radiografías analizadas.', '<button class="btn primary" id="btn-nuevo">' + icon('plus') + 'Nuevo estudio</button>') +
      '<div class="toolbar">' + searchBox('q-est', 'Buscar por paciente, tipo, motivo o resultado…', ui.qEst) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Motivo</th><th>Resultado</th><th title="Probabilidad de hallazgo patológico estimada por la IA">Confianza</th><th class="actions">Acciones</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">' + empty('search', 'Sin resultados', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-est', 'qEst', () => App.render(true));
        root.querySelector('#btn-nuevo').onclick = () => estudioForm();
        on(root, '[data-ver]', 'click', (el) => go('#/estudios/' + el.dataset.ver));
        on(root, '[data-del]', 'click', (el, e) => { e.stopPropagation(); confirmModal('Eliminar estudio', '¿Eliminar este estudio y su informe asociado?', 'Eliminar', () => { A.deleteEstudio(el.dataset.del); toast('Estudio eliminado'); }); });
      },
    };
  }
  function estudioForm(pid) {
    let imagen = null, aspect = null, fuente = 'test', ref = null;
    const usados = new Set(S().estudios.map((e) => e.imagenRef).filter(Boolean));
    const galeria = (window.TEST_SET || []).map((t) => '<button type="button" class="thumb' + (usados.has(t.id) ? ' used' : '') + '" data-ref="' + t.id + '" title="' + t.id + '"><img src="' + t.src + '" alt="" loading="lazy"></button>').join('');
    openModal({
      title: 'Nuevo estudio', wide: true,
      body: '<div class="grid halves" style="margin:0"><div class="form-grid" style="align-content:start">' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field"><label>Tipo</label><select name="tipo"><option>Tórax</option></select><div class="hint">Los modelos del TP se entrenaron con radiografías de tórax.</div></div>' +
        '<div class="field"><label>Proyección</label><select name="proyeccion"><option>LL derecha</option><option>LL izquierda</option><option>VD</option><option>DV</option></select></div>' +
        '<div class="field full"><label>Motivo de consulta</label><textarea name="motivo" style="min-height:70px" placeholder="Ej.: Tos crónica y pérdida de peso"></textarea></div>' +
        '<div class="field full"><label>Imagen seleccionada</label><img id="f-prev" class="preview" alt="" hidden><div id="f-prev-none" class="small muted">Elegí una radiografía a la derecha.</div></div>' +
        '</div><div>' +
        '<div class="tabs" style="margin-bottom:12px"><button type="button" data-src="test" class="on">Conjunto de test del TP</button><button type="button" data-src="subir">Subir radiografía</button></div>' +
        '<div id="src-test"><p class="small muted" style="margin-top:0">67 radiografías reales de tórax que los modelos <b>no vieron</b> al entrenar. La etiqueta real se muestra recién después del análisis.</p><div class="thumbs">' + galeria + '</div></div>' +
        '<div id="src-subir" hidden><label class="drop">' + icon('upload') + '<div id="drop-t">Elegí una radiografía de tórax (JPG o PNG)</div><input type="file" accept="image/*" hidden id="f-img"></label></div>' +
        '</div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="e-ok">' + icon('spark') + 'Cargar y analizar con la CNN</button>',
      onMount(m) {
        const prev = m.querySelector('#f-prev'), none = m.querySelector('#f-prev-none');
        const mostrar = (src) => { prev.src = src; prev.hidden = !src; none.hidden = !!src; };
        m.querySelectorAll('[data-ref]').forEach((b) => b.onclick = () => {
          ref = b.dataset.ref; m.querySelectorAll('[data-ref]').forEach((x) => x.classList.toggle('on', x === b));
          mostrar(TEST_SET.find((t) => t.id === ref).src);
        });
        m.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => {
          fuente = b.dataset.src;
          m.querySelectorAll('[data-src]').forEach((x) => x.classList.toggle('on', x === b));
          m.querySelector('#src-test').hidden = fuente !== 'test'; m.querySelector('#src-subir').hidden = fuente !== 'subir';
          mostrar(fuente === 'test' ? (ref ? TEST_SET.find((t) => t.id === ref).src : '') : imagen);
        });
        m.querySelector('#f-img').onchange = (ev) => {
          const file = ev.target.files[0]; if (!file) return;
          const rd = new FileReader();
          rd.onload = () => { // reducimos para no exceder el almacenamiento local
            const img = new Image(); img.onload = () => {
              const c = document.createElement('canvas'), k = Math.min(1, 900 / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k;
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); imagen = c.toDataURL('image/jpeg', 0.88); aspect = (img.width / img.height).toFixed(4);
              m.querySelector('#drop-t').textContent = '✓ ' + file.name; mostrar(imagen);
            }; img.src = rd.result;
          };
          rd.readAsDataURL(file);
        };
        m.querySelector('#e-ok').onclick = () => {
          const f = formData(m);
          if (!f.pacienteId) return toast('Primero creá un paciente', 'warn');
          if (!f.motivo) return toast('Indicá el motivo de consulta', 'warn');
          if (fuente === 'test' && !ref) return toast('Elegí una radiografía', 'warn');
          if (fuente === 'subir' && !imagen) return toast('Elegí una imagen para subir', 'warn');
          const datos = { pacienteId: f.pacienteId, tipo: f.tipo, proyeccion: f.proyeccion, motivo: f.motivo, fecha: new Date().toISOString() };
          if (fuente === 'subir') Object.assign(datos, { imagen, imgAspect: aspect }); else datos.imagenRef = ref;
          let e;
          try { e = A.addEstudio(datos); } catch (err) { return toast('La imagen es demasiado grande para la demo', 'warn'); }
          ui.analizando[e.id] = Date.now();
          closeModal(); go('#/estudios/' + e.id);
        };
      },
    });
  }

  /* Corre la CNN sobre la imagen del estudio y guarda el resultado. */
  const enCurso = {};
  function analizarEstudio(id, minMs) {
    if (enCurso[id]) return enCurso[id];
    const t0 = Date.now();
    enCurso[id] = (async () => {
      try {
        const e = Store.estudio(id); if (!e) return null;
        const src = await UI.fuenteEstudio(e);
        const { probs, modelo } = await CNN.predict(src);
        const r = CNN.interpretar(probs);
        const espera = (minMs || 0) - (Date.now() - t0);
        if (espera > 0) await new Promise((res) => setTimeout(res, espera));
        const mi = CNN.info(modelo);
        r.probs = { ok: +probs.ok.toFixed(4), patologica: +probs.patologica.toFixed(4) };
        r.modelo = { clave: modelo, nombre: mi.catalogo.nombre, reentrenado: !!mi.reentrenado };
        return A.aplicarAnalisis(id, r);
      } finally { delete enCurso[id]; delete ui.analizando[id]; }
    })();
    return enCurso[id];
  }

  function estudioDetalle(id) {
    const e = Store.estudio(id);
    if (!e) return { html: empty('scan', 'Estudio no encontrado', ''), mount() {} };
    const p = Store.paciente(e.pacienteId), inf = Store.informeDeEstudio(id), der = S().derivaciones.find((d) => d.estudioId === id);
    const analizando = !!ui.analizando[id] || !e.resultado;
    const ref = UI.refTest(e);
    let panel;
    if (analizando) {
      panel = '<div class="card card-pad"><div class="analyzing"><div class="spinner"></div><strong style="color:var(--text)">La red neuronal convolucional está analizando la radiografía…</strong><span class="small">' + esc(CNN.CATALOGO[CNN.activo].nombre) + ' · entrada RGB 224×224</span></div></div>';
    } else {
      const col = { normal: 'var(--emerald)', incierto: 'var(--amber)', patologico: 'var(--red)' }[e.resultado];
      const pr = e.probs || null;
      let refHtml = '';
      if (ref) {
        const real = ref.clase === 'patologica', predPos = e.resultado !== 'normal';
        refHtml = '<div class="callout ' + (real === predPos ? 'green' : 'red') + '" style="margin-top:16px">' + icon(real === predPos ? 'check' : 'alert') + '<span><b>Etiqueta real (dataset del TP):</b> ' + (real ? 'Patológica' + (ref.dx ? ' · ' + esc(ref.dx) : '') : 'OK (sin patología)') + '. ' +
          (real === predPos ? 'La CNN acertó.' : (real ? '<b>Falso negativo</b> de la CNN: por esto el veterinario revisa cada estudio.' : '<b>Falso positivo</b> de la CNN.')) + '</span></div>';
      }
      panel = '<div class="card card-pad">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="section-title" style="margin:0;flex:1">Resultado de la IA</div><span class="cnn-badge">' + icon('brain') + esc(e.modelo ? e.modelo.nombre : 'CNN') + '</span></div>' +
        '<div class="conf-big" style="margin-top:8px"><span class="n" style="color:' + col + '">' + Store.RES_LABEL[e.resultado] + '</span></div>' +
        '<div style="margin:14px 0 6px;display:flex;justify-content:space-between" class="small"><span>Probabilidad de patología (salida softmax de la red)</span><span class="strong">' + e.confianza + '%</span></div>' +
        '<div class="progress" style="position:relative"><div style="width:' + e.confianza + '%;background:' + col + '"></div></div>' +
        '<div class="small muted" style="margin-top:6px">Normal &lt; ' + CNN.UMBRAL_INCIERTO * 100 + '% · Incierto ' + CNN.UMBRAL_INCIERTO * 100 + '–' + (CNN.UMBRAL_PATOLOGICO * 100 - 1) + '% · Patológico ≥ ' + CNN.UMBRAL_PATOLOGICO * 100 + '%. El umbral de ' + CNN.UMBRAL_PATOLOGICO * 100 + '% es el que eligió el TP para priorizar la sensibilidad: no dejar pasar patologías.' +
        (pr ? '<div class="section-title">Salida de la red por clase</div>' +
          [['ok', 'OK (sin patología)', 'var(--emerald)'], ['patologica', 'Patológica', 'var(--red)']].map(([k, l, c]) => '<div class="prob-row' + (pr[k] >= 0.5 ? ' top' : '') + '"><span>' + l + '</span><div class="progress"><div style="width:' + (pr[k] * 100).toFixed(1) + '%;background:' + c + '"></div></div><span class="pv">' + (pr[k] * 100).toFixed(1) + '%</span></div>').join('') : '') +
        refHtml +
        (e.resultado === 'incierto' && !der ? '<div class="callout amber" style="margin-top:16px">' + icon('alert') + '<span>Resultado incierto: se recomienda <b>derivar</b> a un especialista de la red para una segunda lectura.</span></div>' : '') +
        (der ? '<div class="callout ' + (der.estado === 'respondida' ? 'green' : 'violet') + '" style="margin-top:16px">' + icon('stetho') + '<span>' + (der.estado === 'respondida' ? '<b>Segunda lectura de ' + esc(der.a) + ':</b> ' + esc(der.respuesta) : 'Derivado a la red EISPLUS el ' + fDate(der.fecha) + ' · pendiente de respuesta.') + '</span></div>' : '') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
        (inf ? '<button class="btn primary" data-go="#/informes/' + inf.id + '">' + icon('file') + (inf.estado === 'firmado' ? 'Ver informe firmado' : 'Revisar borrador') + '</button>' : '<button class="btn primary" id="btn-inf">' + icon('spark') + 'Generar borrador con IA</button>') +
        (!der ? '<button class="btn" id="btn-der">' + icon('stetho') + 'Derivar a especialista</button>' : '') +
        '<button class="btn" id="btn-ic">' + icon('headset') + 'Interconsulta</button>' +
        '</div>' +
        '<p class="small muted" style="margin:16px 0 0">' + icon('info') + ' Modelos entrenados en el TP con 308 radiografías de tórax. Es una herramienta de apoyo: <a href="#/modelo">ver desempeño del modelo</a>.</p>' +
        '</div>';
    }
    const camDisp = !analizando && CNN.CATALOGO[(e.modelo && e.modelo.clave) || CNN.activo].camLayer;
    const html = '<a href="#/estudios" class="btn ghost sm" style="margin-bottom:12px">← Estudios</a>' +
      pageHead('scan', esc(p.nombre) + ' · ' + esc(e.tipo), esc(p.especie + ' · ' + p.raza + ' · ' + Store.edad(p.nacimiento)) + ' · ' + fDate(e.fecha) + ' · ' + esc(e.motivo)) +
      '<div class="study-layout"><div>' + xrayHtml(e) +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">' +
      (camDisp ? '<button class="btn sm" id="btn-cam">' + icon('eye') + (ui.cam === id ? 'Ocultar' : 'Ver') + ' Grad-CAM</button>' : '') +
      (!analizando ? '<button class="btn sm ghost" id="btn-re">' + icon('history') + 'Volver a analizar</button>' : '') +
      '<span class="small muted" style="margin-left:auto">Proyección: ' + esc(e.proyeccion || '—') + (e.imagen ? ' · imagen subida' : ref ? ' · conjunto de test del TP' : '') + '</span></div>' +
      '<div class="cam-legend" id="cam-legend" hidden><span>Menor</span><span class="grad"></span><span>Mayor peso hacia "patológica" (Grad-CAM sobre la última capa convolucional)</span></div>' +
      '</div><div>' + panel + '</div></div>';
    return {
      html, mount(root) {
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        if (analizando) {
          const pend = ui.analizando[id];
          analizarEstudio(id, pend ? 1300 - (Date.now() - pend) : 0)
            .then((r) => { if (r && pend) toast('CNN: ' + Store.RES_LABEL[r.resultado] + ' (' + r.confianza + '% probabilidad de patología)'); })
            .catch((err) => { console.error(err); delete ui.analizando[id]; toast('No se pudo analizar la imagen: ' + err.message, 'warn'); });
          return;
        }
        const camBtn = root.querySelector('#btn-cam');
        if (camBtn) camBtn.onclick = () => { ui.cam = ui.cam === id ? null : id; App.render(); };
        if (ui.cam === id && camDisp) (async () => {
          const layer = root.querySelector('[data-cam]');
          const data = await CNN.cam(await UI.fuenteEstudio(e), 'patologica');
          if (!data || !document.body.contains(layer)) return;
          CNN.paintCam(layer, data); layer.hidden = false; root.querySelector('#cam-legend').hidden = false;
        })();
        root.querySelector('#btn-re').onclick = () => { ui.analizando[id] = Date.now(); App.render(); };
        const bi = root.querySelector('#btn-inf'); if (bi) bi.onclick = () => { const i = A.generarInforme(id); toast('Borrador generado con IA'); go('#/informes/' + i.id); };
        const bd = root.querySelector('#btn-der'); if (bd) bd.onclick = () => derivarForm(id);
        root.querySelector('#btn-ic').onclick = () => interconsultaForm(e.pacienteId, Store.paciente(e.pacienteId).nombre + ': ' + (e.hallazgos[0] || e.motivo));
      },
    };
  }
  function derivarForm(eid) {
    const e = Store.estudio(eid);
    openModal({
      title: 'Derivar a especialista',
      body: '<p class="muted" style="margin-top:0">El estudio se envía a un especialista de la red EISPLUS para una segunda lectura.</p><div class="field"><label>Motivo de la derivación</label><textarea name="motivo">Resultado ' + esc(Store.RES_LABEL[e.resultado].toLowerCase()) + ': ' + esc(e.hallazgos.join(', ') || e.motivo) + '. Solicito segunda lectura.</textarea></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="d-ok">' + icon('send') + 'Derivar</button>',
      onMount(m) { m.querySelector('#d-ok').onclick = () => { A.derivar(eid, formData(m).motivo); closeModal(); toast('Estudio derivado a la red EISPLUS'); }; },
    });
  }

  /* =========================================================== TRIAGE */
  function triage() {
    const all = Store.triage();
    const urg = all.filter((r) => r.prioridad === 'urgente').length;
    const rows = all.filter((r) => ui.triage === 'todos' || r.prioridad === ui.triage);
    const html = pageHead('triage', 'Triage', 'Estudios que requieren atención, priorizados. · ' + urg + ' urgente' + (urg === 1 ? '' : 's') + '.', '<div class="seg">' + [['todos', 'Todos'], ['urgente', 'Urgentes'], ['revisar', 'A revisar']].map(([k, l]) => '<button data-f="' + k + '" class="' + (ui.triage === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>', 'amber') +
      '<div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>Paciente</th><th>Resultado IA</th><th>Informe</th><th>Estudio</th><th>Espera</th></tr></thead><tbody>' +
      (rows.map((r) => '<tr class="clickable" data-go="#/estudios/' + r.e.id + '"><td>' + (r.prioridad === 'urgente' ? '<span class="badge b-solid-red">Urgente</span>' : '<span class="badge b-solid-orange">A revisar</span>') + '</td><td>' + pacLabel(Store.paciente(r.e.pacienteId)) + '</td><td>' + resBadge(r.e.resultado, true) + (r.e.derivado ? ' <span class="small" style="color:var(--amber-d)">derivado</span>' : '') + '</td><td class="muted">' + (r.inf ? 'Borrador' : 'Sin informe') + '</td><td class="muted">' + esc(r.e.tipo) + ' · ' + fDate(r.e.fecha) + '</td><td class="strong" style="color:' + (r.espera >= 3 ? '#EA580C' : 'var(--text)') + '">' + (r.espera === 0 ? 'hoy' : r.espera + ' d') + '</td></tr>').join('') ||
        '<tr><td colspan="6">' + empty('check', 'Nada para priorizar', '<span class="small">Todos los estudios tienen su informe firmado.</span>') + '</td></tr>') +
      '</tbody></table></div><p class="small muted" style="margin-top:12px">' + icon('info') + ' Urgente: resultado patológico o incierto. A revisar: resultado normal sin informe firmado. Dentro de cada grupo se ordena por resultado y días de espera.</p>';
    return { html, mount(root) { on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); on(root, '[data-f]', 'click', (el) => { ui.triage = el.dataset.f; App.render(); }); } };
  }

  /* =========================================================== INFORMES */
  function informes() {
    const list = S().informes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((i) => {
      const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId);
      return match(ui.qInf, p.nombre, i.estado, i.firmadoPor || '', i.estado === 'firmado' ? 'firmado' : 'borrador');
    });
    const rows = list.map((i) => {
      const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId);
      return '<tr class="clickable" data-go="#/informes/' + i.id + '"><td class="strong">' + fDate(i.fecha) + '</td><td>' + esc(p.nombre) + '</td><td class="muted">' + esc(e.tipo) + ' · ' + fDate(e.fecha) + '</td><td>' + (i.estado === 'firmado' ? '<span class="badge b-normal">Firmado</span>' : '<span class="badge b-incierto">Borrador</span>') + '</td><td>' + NIVEL[i.nivel] + '</td><td>' + (i.firmadoPor ? esc(i.firmadoPor) : '—') + '</td>' +
        '<td class="actions"><button class="icon-btn" title="Ver">' + icon('eye') + '</button>' + (i.estado === 'borrador' ? '<button class="icon-btn danger" data-del="' + i.id + '" title="Descartar borrador">' + icon('trash') + '</button>' : '') + '</td></tr>';
    }).join('');
    const html = pageHead('file', 'Informes', 'Borradores y firmados.', '<button class="btn primary" id="btn-gen">' + icon('spark') + 'Generar informe</button>') +
      '<div class="toolbar">' + searchBox('q-inf', 'Buscar por paciente, estado o firmante…', ui.qInf) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Estudio</th><th>Estado</th><th>Confianza</th><th>Firmado por</th><th class="actions">Acciones</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">' + empty('file', 'Sin informes', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-inf', 'qInf', () => App.render(true));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        on(root, '[data-del]', 'click', (el, ev) => { ev.stopPropagation(); confirmModal('Descartar borrador', '¿Descartar este borrador? Podés volver a generarlo desde el estudio.', 'Descartar', () => { A.deleteInforme(el.dataset.del); toast('Borrador descartado'); }); });
        root.querySelector('#btn-gen').onclick = () => {
          const sin = S().estudios.filter((e) => e.resultado && !Store.informeDeEstudio(e.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
          if (!sin.length) return toast('Todos los estudios analizados ya tienen informe', 'warn');
          openModal({
            title: 'Generar informe con IA',
            body: '<div class="field"><label>Estudio</label><select name="eid">' + sin.map((e) => { const p = Store.paciente(e.pacienteId); return '<option value="' + e.id + '">' + esc(p.nombre) + ' · ' + esc(e.tipo) + ' · ' + fDate(e.fecha) + ' · ' + Store.RES_LABEL[e.resultado] + '</option>'; }).join('') + '</select></div>',
            foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="g-ok">' + icon('spark') + 'Generar borrador</button>',
            onMount(m) { m.querySelector('#g-ok').onclick = () => { const i = A.generarInforme(formData(m).eid); closeModal(); toast('Borrador generado con IA'); go('#/informes/' + i.id); }; },
          });
        };
      },
    };
  }
  function informeDetalle(id) {
    const inf = S().informes.find((i) => i.id === id);
    if (!inf) return { html: empty('file', 'Informe no encontrado', ''), mount() {} };
    const e = Store.estudio(inf.estudioId), p = Store.paciente(e.pacienteId);
    const texto = inf.texto || Store.borradorInforme(e);
    const firmado = inf.estado === 'firmado';
    const html = '<a href="#/informes" class="btn ghost sm" style="margin-bottom:12px">← Informes</a>' +
      pageHead('file', 'Informe de ' + esc(p.nombre), esc(e.tipo) + ' · ' + fDate(e.fecha) + ' · ' + (firmado ? 'Firmado' : 'Borrador generado con IA · confianza ' + NIVEL[inf.nivel].toLowerCase()),
        firmado ? '<button class="btn" id="btn-dl">' + icon('download') + 'Descargar</button><button class="btn" onclick="window.print()">Imprimir</button>' : '') +
      '<div class="study-layout"><div>' + xrayHtml(e) + '<div style="margin-top:12px;display:flex;gap:10px;align-items:center">' + resBadge(e.resultado) + '<span class="small muted">' + e.confianza + '% probabilidad de patología</span><a class="small" href="#/estudios/' + e.id + '" style="margin-left:auto">Ver estudio →</a></div></div>' +
      '<div class="card card-pad">' +
      (firmado
        ? '<pre class="report-text" style="margin:0">' + esc(inf.texto) + '</pre><div class="signature">' + icon('pen') + ' Firmado digitalmente por <b>' + esc(inf.firmadoPor) + '</b> el ' + fDate(inf.fechaFirma) + ' a las ' + fTime(inf.fechaFirma) + '</div>'
        : '<div class="callout amber" style="margin-bottom:14px">' + icon('alert') + '<span>Borrador generado por IA. Sigue en borrador hasta que lo revises y lo firmes.</span></div>' +
          '<div class="field"><label>Texto del informe (editable)</label><textarea id="inf-txt" style="min-height:380px;font-size:14px;line-height:1.55">' + esc(texto) + '</textarea></div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button class="btn" id="btn-save">Guardar borrador</button><button class="btn" id="btn-regen">' + icon('spark') + 'Regenerar</button><button class="btn primary" id="btn-sign" style="margin-left:auto">' + icon('pen') + 'Revisar y firmar</button></div>') +
      '</div></div>';
    return {
      html, mount(root) {
        mountXrays(root);
        if (firmado) { root.querySelector('#btn-dl').onclick = () => download('informe-' + p.nombre.toLowerCase() + '-' + fDate(e.fecha).replace(/\//g, '-') + '.txt', inf.texto + '\n\nFirmado por ' + inf.firmadoPor + ' · ' + fDate(inf.fechaFirma), 'text/plain'); return; }
        const ta = root.querySelector('#inf-txt');
        root.querySelector('#btn-save').onclick = () => { A.guardarTexto(id, ta.value); toast('Borrador guardado'); };
        root.querySelector('#btn-regen').onclick = () => confirmModal('Regenerar borrador', 'Se reemplazará el texto actual por un nuevo borrador de la IA.', 'Regenerar', () => { A.generarInforme(e.id); toast('Borrador regenerado'); });
        root.querySelector('#btn-sign').onclick = () => firmaModal(id, ta.value, e);
      },
    };
  }
  function firmaModal(iid, texto, e) {
    openModal({
      title: 'Firmar informe',
      body: '<p class="muted" style="margin-top:0">Tu veredicto alimenta el <b>control de calidad</b> de la IA y el dataset de reentrenamiento.</p>' +
        '<div class="field"><label>La IA clasificó el estudio como <b>' + Store.RES_LABEL[e.resultado] + '</b>. Tu veredicto:</label>' +
        '<select name="veredicto" id="f-ver"><option value="coincide">Coincido con la IA</option><option value="corrige">Corrijo el resultado</option><option value="descarta">Descarto el resultado de la IA</option></select></div>' +
        '<div class="field" id="f-cor" style="margin-top:12px;display:none"><label>Diagnóstico / corrección</label><input name="correccion" placeholder="Ej.: Patrón intersticial"></div>' +
        '<label style="display:flex;gap:8px;margin-top:16px;align-items:flex-start"><input type="checkbox" name="ok" style="margin-top:4px"><span>Revisé el estudio y el contenido del informe, y lo firmo bajo mi responsabilidad profesional.</span></label>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="s-ok">' + icon('pen') + 'Firmar como ' + esc(S().usuario.completo) + '</button>',
      onMount(m) {
        const v = m.querySelector('#f-ver'); v.onchange = () => { m.querySelector('#f-cor').style.display = v.value === 'coincide' ? 'none' : ''; };
        m.querySelector('#s-ok').onclick = () => {
          const f = formData(m);
          if (!f.ok) return toast('Confirmá que revisaste el informe', 'warn');
          if (f.veredicto !== 'coincide' && !f.correccion) return toast('Indicá la corrección', 'warn');
          A.firmarInforme(iid, { texto, veredicto: f.veredicto, correccion: f.veredicto === 'coincide' ? null : f.correccion });
          closeModal(); toast('Informe firmado. Se registró en control de calidad.');
        };
      },
    });
  }

  /* =========================================================== DERIVACIONES */
  function derivaciones() {
    const list = S().derivaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const pend = list.filter((d) => d.estado === 'pendiente').length;
    const html = pageHead('stetho', 'Derivaciones', 'Estudios escalados a un especialista para segunda opinión. · ' + pend + ' sin responder.') +
      (list.length ? list.map((d) => {
        const e = Store.estudio(d.estudioId), p = Store.paciente(e.pacienteId);
        return '<div class="card card-pad" style="margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px">' +
          '<div><span class="strong">' + esc(p.nombre) + '</span> <span class="sp">(' + esc(p.especie) + ') · ' + esc(e.tipo) + ' · ' + fDate(e.fecha) + '</span></div>' +
          '<div class="muted" style="margin:4px 0">' + esc(d.motivo) + '</div>' +
          '<div class="small muted">De ' + esc(d.de) + ' → ' + (d.a ? esc(d.a) : 'sin asignar') + ' · ' + fDate(d.fecha) + '</div>' +
          (d.respuesta ? '<div class="callout green" style="margin-top:10px">' + icon('stetho') + '<span><b>Respuesta:</b> ' + esc(d.respuesta) + '</span></div>' : '') +
          '</div><div style="display:flex;gap:8px;align-items:center">' + (d.estado === 'pendiente' ? '<span class="badge b-incierto">Pendiente</span><button class="btn sm" data-sim="' + d.id + '" title="Solo para la demo">Simular respuesta</button>' : '<span class="badge b-normal">Respondida</span>') +
          '<button class="icon-btn" data-go="#/estudios/' + e.id + '" title="Abrir estudio">' + icon('arrowUp') + '</button></div></div>';
      }).join('') : '<div class="card">' + empty('stetho', 'Sin derivaciones', '<span class="small">Derivá un estudio incierto desde su detalle.</span>') + '</div>');
    return {
      html, mount(root) {
        list.filter((d) => d.estado === 'respondida').forEach((d) => A.verDerivacion(d.id));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        on(root, '[data-sim]', 'click', (el) => {
          const d = S().derivaciones.find((x) => x.id === el.dataset.sim), e = Store.estudio(d.estudioId);
          const resp = /intersticial|dudoso|craneal/i.test(d.motivo + e.motivo)
            ? 'Revisadas ambas proyecciones: compatible con patrón intersticial crónico, sin evidencia de masa. Sugiero control radiográfico en 30 días.'
            : 'Coincido con la lectura inicial. Recomiendo completar con ecografía y control clínico en 15 días.';
          A.responderDerivacion(d.id, 'Dr. Martín Acosta · Diagnóstico por imágenes', resp); toast('El especialista respondió la derivación');
        });
      },
    };
  }

  /* =========================================================== INTERCONSULTAS */
  const IC_ESTADO = { cola: ['En cola', 'b-blue'], curso: ['En curso', 'b-violet'], cerrada: ['Cerrada', 'b-gray'] };
  function interconsultas() {
    const pk = S().pack, list = S().interconsultas.slice().sort((a, b) => b.actualizada.localeCompare(a.actualizada));
    const mes = new Date().toISOString().slice(0, 7);
    const html = pageHead('headset', 'Interconsultas EISPLUS', 'Consultá casos con el equipo central de veterinarios de soporte de la red.', '<button class="btn violet" id="btn-nueva">' + icon('headset') + 'Nueva interconsulta</button>', 'violet') +
      '<div class="card card-pad" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px"><span>' + esc(pk.nombre) + ' · ' + mes + ' (se renueva el 1° de cada mes)</span><span class="muted">' + pk.usadas + ' / ' + pk.total + ' · quedan ' + (pk.total - pk.usadas) + '</span></div><div class="progress violet"><div style="width:' + (pk.usadas / pk.total * 100) + '%"></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Asunto</th><th>Paciente</th><th>Estado</th><th>Soporte</th><th>Actualizada</th></tr></thead><tbody>' +
      list.map((i) => { const p = Store.paciente(i.pacienteId); const n = i.mensajes.length; return '<tr class="clickable" data-go="#/interconsultas/' + i.id + '"><td><div class="' + (i.noLeida ? 'strong' : '') + '">' + esc(i.asunto) + (i.noLeida ? ' <span class="badge b-violet">nuevo</span>' : '') + '</div><div class="small muted">' + (i.urgente ? '<span class="badge b-patologico" style="margin-right:6px">Urgente</span>' : '') + esc(i.mensajes[0].de) + ' · ' + n + (n === 1 ? ' mensaje' : ' mensajes') + '</div></td><td>' + (p ? esc(p.nombre) : '—') + '</td><td><span class="badge ' + IC_ESTADO[i.estado][1] + '">' + IC_ESTADO[i.estado][0] + '</span></td><td>' + (i.soporte ? '<span style="color:var(--violet)">' + icon('headset') + '</span> ' + esc(i.soporte) : '<span class="muted">Sin asignar</span>') + '</td><td class="nowrap">' + fShort(i.actualizada) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    return { html, mount(root) { on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); root.querySelector('#btn-nueva').onclick = () => interconsultaForm(); } };
  }
  function interconsultaForm(pid, asunto) {
    const pk = S().pack;
    if (pk.usadas >= pk.total) return toast('Se agotó el cupo mensual de interconsultas', 'warn');
    openModal({
      title: 'Nueva interconsulta',
      body: '<div class="callout violet" style="margin-bottom:14px">' + icon('headset') + '<span>Consume 1 consulta del ' + esc(pk.nombre) + ' · quedan ' + (pk.total - pk.usadas) + ' este mes.</span></div><div class="form-grid">' +
        '<div class="field full"><label>Asunto</label><input name="asunto" value="' + esc(asunto || '') + '" placeholder="Ej.: Michi: ¿conviene PAAF del nódulo?"></div>' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field full"><label>Consulta</label><textarea name="texto" placeholder="Describí el caso y qué necesitás del equipo de soporte"></textarea></div>' +
        '<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="urgente"> Marcar como urgente</label></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn violet" id="ic-ok">' + icon('send') + 'Enviar</button>',
      onMount(m) {
        m.querySelector('#ic-ok').onclick = () => {
          const f = formData(m);
          if (!f.asunto || !f.texto) return toast('Completá asunto y consulta', 'warn');
          const ic = A.nuevaInterconsulta(f); closeModal(); toast('Interconsulta enviada al equipo EISPLUS'); go('#/interconsultas/' + ic.id);
          simularSoporte(ic.id);
        };
      },
    });
  }
  const SOPORTE = ['Dra. Paula Ferrari', 'Dr. Andrés Molina'];
  function simularSoporte(id) {
    setTimeout(() => {
      const ic = S().interconsultas.find((x) => x.id === id);
      if (!ic || ic.estado === 'cerrada') return;
      const quien = ic.soporte || SOPORTE[S().interconsultas.indexOf(ic) % 2];
      const txt = ic.mensajes.length <= 1
        ? 'Hola, tomo el caso. Revisé los estudios cargados en la plataforma. Te sugiero ' + (ic.urgente ? 'estabilizar primero y ' : '') + 'sumar una proyección complementaria; con eso confirmamos. ¿Me pasás la evolución de las últimas 48 h?'
        : 'Perfecto, gracias. Con esa información coincido con tu plan. Si en 7 días no mejora, lo volvemos a revisar.';
      A.mensajeInterconsulta(id, txt, 'support', quien);
      if (!location.hash.startsWith('#/interconsultas/' + id)) toast('Nueva respuesta de ' + quien);
    }, 3500);
  }
  function interconsultaDetalle(id) {
    const ic = S().interconsultas.find((x) => x.id === id);
    if (!ic) return { html: empty('chat', 'Interconsulta no encontrada', ''), mount() {} };
    const p = Store.paciente(ic.pacienteId);
    const html = '<a href="#/interconsultas" class="btn ghost sm" style="margin-bottom:12px">← Interconsultas</a>' +
      pageHead('headset', esc(ic.asunto), (p ? esc(p.nombre) + ' · ' : '') + '<span class="badge ' + IC_ESTADO[ic.estado][1] + '">' + IC_ESTADO[ic.estado][0] + '</span>' + (ic.urgente ? ' <span class="badge b-patologico">Urgente</span>' : '') + (ic.soporte ? ' · Soporte: ' + esc(ic.soporte) : ''),
        ic.estado !== 'cerrada' ? '<button class="btn" id="btn-close">' + icon('check') + 'Cerrar consulta</button>' : '', 'violet') +
      '<div class="card card-pad"><div class="thread">' + ic.mensajes.map((m) => '<div class="msg ' + m.rol + '"><div class="meta">' + esc(m.de) + ' · ' + fShort(m.fecha) + '</div>' + esc(m.texto) + '</div>').join('') +
      (ic.estado === 'cola' ? '<div class="small muted" style="text-align:center">Esperando que un veterinario de soporte tome el caso…</div>' : '') + '</div>' +
      (ic.estado !== 'cerrada' ? '<div class="arcion-form" style="padding:16px 0 0"><input id="ic-msg" placeholder="Escribí un mensaje…"><button id="ic-send" aria-label="Enviar">' + icon('send') + '</button></div>' : '<p class="small muted" style="margin:16px 0 0">Consulta cerrada.</p>') + '</div>';
    return {
      html, mount(root) {
        A.leerInterconsulta(id);
        const send = root.querySelector('#ic-send');
        if (send) {
          const inp = root.querySelector('#ic-msg');
          const fire = () => { if (!inp.value.trim()) return; A.mensajeInterconsulta(id, inp.value.trim()); simularSoporte(id); };
          send.onclick = fire; inp.onkeydown = (e) => { if (e.key === 'Enter') fire(); };
        }
        const bc = root.querySelector('#btn-close'); if (bc) bc.onclick = () => { A.cerrarInterconsulta(id); toast('Interconsulta cerrada'); };
      },
    };
  }

  /* =========================================================== CONTROL DE CALIDAD */
  function datasetRows() {
    return S().evaluaciones.map((q) => {
      const e = Store.estudio(q.estudioId) || {}, p = Store.paciente(e.pacienteId) || {};
      return {
        fecha: q.fecha.slice(0, 10), estudio_id: q.estudioId, paciente: p.nombre, especie: p.especie, tipo: e.tipo, proyeccion: e.proyeccion, motivo: e.motivo,
        ia_modelo: e.modelo ? e.modelo.clave : '', ia_resultado: q.ia, ia_probabilidad_patologia: e.confianza, veredicto: q.veredicto, correccion: q.correccion || '', imagen_dataset: e.imagenRef || '', etiqueta_dataset: (UI.refTest(e) || {}).clase || '',
        etiqueta_final: q.veredicto === 'coincide' ? q.ia : (q.correccion || ''), veterinario: q.vet,
      };
    });
  }
  function calidad() {
    const st = Store.qaStats();
    const list = S().evaluaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((q) => { const e = Store.estudio(q.estudioId) || {}, p = Store.paciente(e.pacienteId) || {}; return match(ui.qQa, p.nombre, q.vet, q.correccion || '', q.veredicto, Store.RES_LABEL[q.ia]); });
    const VB = { coincide: ['Coincide', 'b-solid-green'], corrige: ['Corrige', 'b-solid-orange'], descarta: ['Descarta', 'b-solid-red'] };
    const html = pageHead('clipboard', 'Control de calidad (QA)', 'Concordancia IA–veterinario y dataset etiquetado para reentrenamiento.', '<button class="btn" id="btn-csv">' + icon('download') + 'CSV</button><button class="btn" id="btn-json">' + icon('download') + 'JSON</button>') +
      '<div class="grid kpis">' +
      '<div class="card big-kpi"><div class="kl">Concordancia IA–vet</div><div class="kv" style="color:var(--green)">' + st.pct + '%</div><div class="ks">sobre ' + st.total + ' evaluados</div></div>' +
      '<div class="card big-kpi"><div class="kl">Evaluados</div><div class="kv">' + st.total + '</div><div class="ks">con veredicto</div></div>' +
      '<div class="card big-kpi"><div class="kl">Discrepancias</div><div class="kv" style="color:#EA580C">' + st.discrepancias + '</div><div class="ks">corrige o descarta</div></div></div>' +
      '<div class="toolbar">' + searchBox('q-qa', 'Buscar por paciente, veterinario, hallazgo o veredicto…', ui.qQa) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>IA</th><th>Veredicto</th><th>Corrección</th><th>Veterinario/a</th></tr></thead><tbody>' +
      (list.map((q) => { const e = Store.estudio(q.estudioId) || {}; return '<tr class="clickable" data-go="#/estudios/' + q.estudioId + '"><td class="strong">' + fDate(q.fecha) + '</td><td>' + pacLabel(Store.paciente(e.pacienteId)) + '</td><td>' + Store.RES_LABEL[q.ia] + '</td><td><span class="badge ' + VB[q.veredicto][1] + '">' + VB[q.veredicto][0] + '</span></td><td>' + (q.correccion ? esc(q.correccion) : '—') + '</td><td>' + esc(q.vet) + '</td></tr>'; }).join('') ||
        '<tr><td colspan="6">' + empty('clipboard', 'Sin evaluaciones', '<span class="small">Se registran al firmar informes.</span>') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-qa', 'qQa', () => App.render(true));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        const stamp = new Date().toISOString().slice(0, 10);
        root.querySelector('#btn-json').onclick = () => { download('arcionpet-dataset-' + stamp + '.json', JSON.stringify(datasetRows(), null, 2), 'application/json'); toast('Dataset exportado en JSON'); };
        root.querySelector('#btn-csv').onclick = () => {
          const rows = datasetRows(); if (!rows.length) return toast('No hay datos para exportar', 'warn');
          const cols = Object.keys(rows[0]);
          const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
          download('arcionpet-dataset-' + stamp + '.csv', '﻿' + [cols.join(',')].concat(rows.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n'), 'text/csv;charset=utf-8');
          toast('Dataset exportado en CSV');
        };
      },
    };
  }

  /* =========================================================== ANALÍTICA */
  function analitica() {
    const s = S(), est = s.estudios, st = Store.qaStats(), now = new Date();
    const esteMes = est.filter((e) => { const d = new Date(e.fecha); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
    const pendDer = s.derivaciones.filter((d) => d.estado === 'pendiente').length;
    const cnt = (r) => est.filter((e) => e.resultado === r).length;
    const total = est.length || 1;
    const res = [['Patológico', cnt('patologico'), 'var(--red)'], ['Incierto', cnt('incierto'), 'var(--amber)'], ['Normal', cnt('normal'), 'var(--emerald)'], ['Sin análisis', est.filter((e) => !e.resultado).length, '#94A3B8']];
    const analizados = est.filter((e) => e.resultado);
    const firm = analizados.filter((e) => (Store.informeDeEstudio(e.id) || {}).estado === 'firmado').length;
    const borr = analizados.filter((e) => (Store.informeDeEstudio(e.id) || {}).estado === 'borrador').length;
    const meses = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); meses.push({ k: d.getFullYear() + '-' + d.getMonth(), l: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2), n: 0 }); }
    est.forEach((e) => { const d = new Date(e.fecha), m = meses.find((x) => x.k === d.getFullYear() + '-' + d.getMonth()); if (m) m.n++; });
    const maxM = Math.max(1, ...meses.map((m) => m.n));
    const hall = {};
    est.forEach((e) => e.hallazgos.forEach((h) => { hall[h] = (hall[h] || 0) + 1; }));
    const top = Object.entries(hall).sort((a, b) => b[1] - a[1]).slice(0, 6), maxH = top.length ? top[0][1] : 1;
    const html = pageHead('chart', 'Analítica', 'Indicadores de actividad y calidad de la clínica.') +
      '<div class="grid kpis">' + kpi('scan', '', 'Estudios totales', est.length, '') + kpi('calendar', '', 'Este mes', esteMes, '') + kpi('check', '', 'Concordancia IA–vet', st.pct + '%', st.total + ' evaluados') + kpi('stetho', '', 'Derivaciones pendientes', pendDer, '') + '</div>' +
      '<div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>Resultados de la IA</h3></div><div class="card-pad" style="padding-top:8px">' + res.map(([l, n, c]) => '<div class="bar-row"><div class="bl"><span>' + l + '</span><span>' + n + ' (' + Math.round(n / total * 100) + '%)</span></div><div class="progress"><div style="width:' + (n / total * 100) + '%;background:' + c + '"></div></div></div>').join('') + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Estado de informes</h3></div><div class="trio"><div><div class="n" style="color:var(--emerald)">' + firm + '</div><div class="l">Firmados</div></div><div><div class="n" style="color:#EA580C">' + borr + '</div><div class="l">En borrador</div></div><div><div class="n" style="color:#64748B">' + (analizados.length - firm - borr) + '</div><div class="l">Sin informe</div></div></div></div>' +
      '</div><div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>Estudios por mes</h3></div><div class="card-pad"><div class="cols">' + meses.map((m) => '<div class="col"><span class="cv">' + m.n + '</span><div class="cb" style="height:' + (m.n / maxM * 150) + 'px"></div><span class="cl">' + m.l + '</span></div>').join('') + '</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Hallazgos más frecuentes</h3></div><div class="card-pad" style="padding-top:8px">' + (top.length ? top.map(([h, n]) => '<div class="bar-row"><div class="bl"><span>' + esc(h) + '</span><span>' + n + '</span></div><div class="progress"><div style="width:' + (n / maxH * 100) + '%"></div></div></div>').join('') : '<p class="muted">Sin hallazgos registrados.</p>') + '</div></div>' +
      '</div>';
    return { html, mount() {} };
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

  /* =========================================================== MODELO CNN */
  const evals = {}; // clave -> resultado de CNN.evaluar
  const evalEnCurso = {};
  const reent = { estado: 'idle', msg: '', prog: 0, historia: [], res: null, test: null, base: null };
  const pct = (v, d) => (v == null ? '—' : (v * 100).toFixed(d == null ? 0 : d) + '%');
  const num = (v) => (v == null ? '—' : v.toFixed(3).replace('.', ','));

  function rocSvg(r) {
    const y = r.porImagen.map(([id]) => (TEST_SET.find((t) => t.id === id).clase === 'patologica' ? 1 : 0));
    const p = r.porImagen.map(([, v]) => v);
    const P = y.filter(Boolean).length, N = y.length - P;
    const pts = [[0, 0]];
    const ord = p.map((v, i) => [v, y[i]]).sort((a, b) => b[0] - a[0]);
    let tp = 0, fp = 0;
    ord.forEach(([, yy]) => { if (yy) tp++; else fp++; pts.push([fp / N, tp / P]); });
    const W = 260, H = 220, M = 30;
    const X = (v) => M + v * (W - M - 10), Y = (v) => H - M + 10 - v * (H - M - 10);
    const op = r.m30, punto = [1 - op.especificidad, op.recall];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" style="height:220px">' +
      '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(1) + '" stroke="#CBD5E1" stroke-dasharray="4 4"/>' +
      '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(0) + '" stroke="#94A3B8"/><line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(0) + '" y2="' + Y(1) + '" stroke="#94A3B8"/>' +
      '<polyline fill="none" stroke="#2E8B22" stroke-width="2.5" points="' + pts.map(([a, b]) => X(a).toFixed(1) + ',' + Y(b).toFixed(1)).join(' ') + '"/>' +
      '<circle cx="' + X(punto[0]) + '" cy="' + Y(punto[1]) + '" r="5" fill="#F59E0B" stroke="#fff" stroke-width="1.5"/>' +
      '<text x="' + (X(punto[0]) + 8) + '" y="' + (Y(punto[1]) + 14) + '">umbral 0,30</text>' +
      '<text x="' + X(0.55) + '" y="' + Y(0.12) + '" style="font-weight:600;fill:#1F5F17">AUC ' + num(r.auc) + '</text>' +
      '<text x="' + X(0.3) + '" y="' + (H - 4) + '">falsos positivos (1 − especificidad)</text>' +
      '<text x="4" y="' + (Y(1) - 2) + '">recall</text></svg>';
  }
  function matriz(m, titulo) {
    return '<div><div class="small strong" style="margin-bottom:6px">' + titulo + '</div><table class="confusion" style="border:1px solid var(--line);border-radius:10px"><thead><tr><th style="text-align:left">Real ↓ / CNN →</th><th>OK</th><th>Patológica</th></tr></thead><tbody>' +
      '<tr><th style="text-align:left;text-transform:none;letter-spacing:0">OK</th><td class="diag">' + m.tn + '</td><td class="' + (m.fp ? 'off' : '') + '">' + m.fp + '</td></tr>' +
      '<tr><th style="text-align:left;text-transform:none;letter-spacing:0">Patológica</th><td class="' + (m.fn ? 'off' : '') + '">' + m.fn + '</td><td class="diag">' + m.tp + '</td></tr></tbody></table>' +
      '<div class="small muted" style="margin-top:6px">Exactitud ' + pct(m.accuracy) + ' · Precisión ' + pct(m.precision) + ' · Recall ' + pct(m.recall) + ' · Especificidad ' + pct(m.especificidad) + '</div></div>';
  }
  function modelo() {
    const act = CNN.activo, C = CNN.CATALOGO;
    const filas = Object.keys(C).map((k) => {
      const c = C[k], r = evals[k], mi = CNN.info(k);
      return '<tr><td><div class="strong">' + esc(c.nombre) + '</div><div class="small muted">' + (c.miembros ? 'promedio de ' + c.miembros.join(' + ') : esc(k) + '.keras') + '</div></td>' +
        '<td>' + (c.tp.auc != null ? num(c.tp.auc) : k === 'ensamble' ? '<span class="small muted">nuevo</span>' : '—') + '</td>' +
        '<td class="strong">' + (r ? num(r.auc) : evalEnCurso[k] ? '<span class="small muted" id="ev-' + k + '">evaluando…</span>' : '<span class="small muted">pendiente</span>') + '</td>' +
        '<td>' + (r ? pct(r.m50.accuracy) : '—') + '</td><td>' + (r ? pct(r.m30.recall) : '—') + '</td><td>' + (r ? pct(r.m30.precision) : '—') + '</td>' +
        '<td class="actions">' + (k === act ? '<span class="badge b-normal">En uso</span>' : '<button class="btn sm" data-usar="' + k + '">Usar</button>') + '</td></tr>';
    }).join('');
    const r = evals[act], mi = CNN.info(act);
    const pasos = act === 'ensamble'
      ? ['Radiografía', 'Se generan 2 entradas: la imagen y su espejo horizontal (TTA)', 'Cada una pasa por los 2 MobileNetV2 del TP (fine-tuning y fase 1): 4 predicciones', 'Promedio de las 4 probabilidades de “patológica”', 'Patológico desde 0,30 (umbral del TP); incierto entre 0,20 y 0,30', 'Grad-CAM calculado sobre el MobileNetV2 con fine-tuning']
      : act === 'cnn_desde_cero'
      ? ['Radiografía', 'RGB 224×224 · escala a [0, 1]', '5 × (Conv 3×3 + BatchNorm + MaxPool): 32 → 64 → 128 → 128 → 128 filtros', 'Pooling global promedio', 'Dense 256 + Dropout 0,5', 'Softmax: OK / Patológica']
      : ['Radiografía', 'RGB 224×224 · escala a [−1, 1] (preprocess_input de MobileNetV2)', 'MobileNetV2 (ImageNet): 17 bloques residuales invertidos con convoluciones depthwise', 'Última capa convolucional out_relu (7×7×1280) → Grad-CAM', 'Pooling global promedio + Dropout 0,3', 'Softmax: OK / Patológica → patológico desde 0,30 (umbral del TP); incierto entre 0,20 y 0,30'];
    const errores = r ? r.porImagen.filter(([id, v]) => (TEST_SET.find((t) => t.id === id).clase === 'patologica') !== (v >= CNN.UMBRAL_PATOLOGICO)).length : 0;
    const html = pageHead('brain', 'Modelo CNN', 'Modelos del TP de Aprendizaje Automático, convertidos de Keras a TensorFlow.js y ejecutados en el navegador.') +
      '<div class="callout green" style="margin-bottom:20px">' + icon('info') + '<span>Dataset del TP: <b>441 radiografías de tórax</b> (OK / patológicas), divididas en 308 de entrenamiento, 66 de validación y 67 de test. Las métricas “en el navegador” se calculan acá mismo sobre las <b>67 de test</b>, que ningún modelo vio al entrenar.</span></div>' +
      '<div class="table-wrap" style="margin-bottom:20px"><table><thead><tr><th>Modelo</th><th>AUC (TP)</th><th>AUC en el navegador</th><th>Exactitud @0,5</th><th>Recall @0,30</th><th>Precisión @0,30</th><th class="actions"></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
      '<div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>' + esc(C[act].nombre) + '</h3>' + (mi.parametros ? '<span class="small muted">' + mi.parametros.toLocaleString('es-AR') + ' parámetros · ' + mi.capas + ' capas</span>' : '') + '</div><div class="card-pad" style="padding-top:6px"><p class="small muted" style="margin-top:0">' + esc(C[act].descripcion) + '</p><ul class="timeline">' + pasos.map((p) => '<li><div class="tt" style="font-weight:500">' + p + '</div></li>').join('') + '</ul>' +
      (mi.reentrenado ? '<div class="callout violet" style="margin-top:14px">' + icon('brain') + '<span>Capa final reentrenada en esta clínica el ' + fDate(mi.reentrenado.fecha) + ' con ' + mi.reentrenado.imagenes + ' radiografías.</span></div>' : '') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Curva ROC (test)</h3></div><div class="card-pad" style="padding-top:6px">' + (r ? rocSvg(r) : '<div class="analyzing"><div class="spinner"></div><span class="small">Evaluando sobre el conjunto de test…</span></div>') + '</div></div>' +
      '</div>' +
      (r ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Matrices de confusión (test, 67 imágenes)</h3></div><div class="card-pad" style="padding-top:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">' +
        matriz(r.m30, 'Umbral 0,30 (el que usa la app: desde acá, Patológico)') + matriz(r.m50, 'Umbral 0,50') + '</div></div>' +
        '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Predicciones sobre el test</h3><div class="seg"><button data-gal="todas" class="' + (ui.gal !== 'errores' ? 'on' : '') + '">Todas</button><button data-gal="errores" class="' + (ui.gal === 'errores' ? 'on' : '') + '">Errores (' + errores + ')</button></div></div><div class="card-pad" style="padding-top:6px"><div class="sample-grid">' +
        r.porImagen.filter(([id, v]) => ui.gal !== 'errores' || (TEST_SET.find((t) => t.id === id).clase === 'patologica') !== (v >= CNN.UMBRAL_PATOLOGICO)).map(([id, v]) => {
          const t = TEST_SET.find((x) => x.id === id), real = t.clase === 'patologica', ok = real === (v >= CNN.UMBRAL_PATOLOGICO);
          return '<div><img src="' + t.src + '" alt="" loading="lazy" style="width:100%;border-radius:8px;display:block;aspect-ratio:1;object-fit:cover"><div class="small" style="margin-top:4px">' + (ok ? '✅' : '❌') + ' <b>' + pct(v) + '</b> pat.<br><span class="muted">Real: ' + (real ? esc(t.dx || 'Patológica') : 'OK') + '</span></div></div>';
        }).join('') + '</div></div></div>' : '') +
      (C[act].reentrenable ? reentrenoHtml(mi) : '<div class="callout violet">' + icon('info') + '<span>Para reentrenar con radiografías de la clínica, elegí uno de los modelos MobileNetV2 individuales.</span></div>');
    return {
      html, mount(root) {
        on(root, '[data-usar]', 'click', async (el) => { el.disabled = true; el.textContent = 'Cargando…'; await CNN.usar(el.dataset.usar); toast('Modelo en uso: ' + C[el.dataset.usar].nombre); reanalizarTodo(); });
        on(root, '[data-gal]', 'click', (el) => { ui.gal = el.dataset.gal; App.render(); });
        bindReentreno(root);
        evaluarPendientes();
      },
    };
  }
  async function evaluarPendientes() {
    const orden = [CNN.activo].concat(Object.keys(CNN.CATALOGO).filter((k) => k !== CNN.activo));
    for (const k of orden) {
      if (evals[k] || evalEnCurso[k]) continue;
      evalEnCurso[k] = true;
      try {
        evals[k] = await CNN.evaluar(k, (n, t) => { const el = document.getElementById('ev-' + k); if (el) el.textContent = 'evaluando… ' + n + '/' + t; });
      } catch (e) { console.error(e); }
      delete evalEnCurso[k];
      if (location.hash.startsWith('#/modelo')) App.render();
    }
  }
  function reentrenoHtml(mi) {
    const e = reent;
    let estado = '';
    if (e.estado === 'running') estado = '<div class="small strong" id="re-msg">' + esc(e.msg) + '</div><div class="progress" style="margin:8px 0"><div id="re-bar" style="width:' + Math.round(e.prog * 100) + '%"></div></div>';
    if (e.estado === 'error') estado = '<div class="callout red">' + icon('alert') + '<span>' + esc(e.msg) + '</span></div>';
    if (e.estado === 'done') {
      const a = e.base, b = e.test, mejor = b.auc >= a.auc;
      estado = '<div class="callout ' + (mejor ? 'green' : 'amber') + '" style="margin-bottom:14px">' + icon(mejor ? 'check' : 'alert') + '<span>Capa final reentrenada con ' + e.res.meta.imagenes + ' radiografías (' + e.res.meta.ok + ' OK, ' + e.res.meta.patologica + ' patológicas). En el test: AUC <b>' + num(a.auc) + ' → ' + num(b.auc) + '</b>, recall @0,30 ' + pct(a.m30.recall) + ' → ' + pct(b.m30.recall) + ', precisión @0,30 ' + pct(a.m30.precision) + ' → ' + pct(b.m30.precision) + '.' + (mejor ? '' : ' El nuevo modelo rinde peor en el test: conviene descartarlo o sumar más imágenes.') + '</span></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="re-adopt">' + icon('check') + 'Usar el modelo reentrenado</button><button class="btn" id="re-discard">Descartar</button></div>';
    }
    return '<div class="card"><div class="card-head"><h3>Reentrenar con radiografías de la clínica</h3>' + (mi.reentrenado ? '<button class="btn sm" id="re-restore">' + icon('history') + 'Volver a la capa original del TP</button>' : '') + '</div><div class="card-pad" style="padding-top:6px">' +
      '<p class="small muted" style="margin-top:0">Igual que la fase 1 del TP: la base MobileNetV2 queda congelada y se reentrena solo la capa de clasificación con imágenes nuevas, ya diagnosticadas por un veterinario (con espejo horizontal y class_weight balanceado). El resultado se valida contra el mismo conjunto de test antes de adoptarlo.</p>' +
      '<div class="file-row"><label>Radiografías OK</label><input type="file" accept="image/*" multiple id="re-ok"' + (e.estado === 'running' ? ' disabled' : '') + '></div>' +
      '<div class="file-row"><label>Radiografías patológicas</label><input type="file" accept="image/*" multiple id="re-pat"' + (e.estado === 'running' ? ' disabled' : '') + '></div>' +
      '<div class="form-grid" style="max-width:260px;margin-top:10px"><div class="field"><label>Épocas</label><input type="number" id="re-ep" value="20" min="2" max="100"></div></div>' +
      '<button class="btn primary" id="re-go" style="margin:14px 0"' + (e.estado === 'running' ? ' disabled' : '') + '>' + icon('brain') + 'Reentrenar</button>' +
      '<div id="re-status">' + estado + '</div></div></div>';
  }
  function bindReentreno(root) {
    const go_ = root.querySelector('#re-go'); if (!go_) return;
    go_.onclick = async () => {
      const archivos = { ok: root.querySelector('#re-ok').files, patologica: root.querySelector('#re-pat').files };
      Object.assign(reent, { estado: 'running', msg: 'Preparando…', prog: 0, res: null });
      App.render();
      const pintar = () => { const m = document.getElementById('re-msg'), b = document.getElementById('re-bar'); if (m) { m.textContent = reent.msg; b.style.width = Math.round(reent.prog * 100) + '%'; } };
      try {
        const res = await CNN.reentrenar({ archivos, epochs: Math.max(2, +root.querySelector('#re-ep').value || 20),
          onStage: (msg, p) => { reent.msg = msg; reent.prog = p * 0.4; pintar(); },
          onEpoch: (ep, tot, logs) => { reent.msg = 'Época ' + ep + '/' + tot + ' · pérdida ' + logs.loss.toFixed(3) + ' · exactitud ' + Math.round(logs.acc * 100) + '%'; reent.prog = 0.4 + 0.4 * ep / tot; pintar(); } });
        reent.msg = 'Validando contra el conjunto de test…'; pintar();
        reent.base = evals[CNN.activo] || await CNN.evaluar(CNN.activo);
        reent.test = await CNN.evaluarCabeza(res.pesos, (n, t) => { reent.prog = 0.8 + 0.2 * n / t; pintar(); });
        Object.assign(reent, { estado: 'done', res });
      } catch (err) { console.error(err); Object.assign(reent, { estado: 'error', msg: err.message }); }
      App.render();
    };
    const a = root.querySelector('#re-adopt'); if (a) a.onclick = async () => { await CNN.adoptarCabeza(reent.res); reent.estado = 'idle'; delete evals[CNN.activo]; toast('Modelo reentrenado en uso'); reanalizarTodo(); };
    const d = root.querySelector('#re-discard'); if (d) d.onclick = () => { reent.estado = 'idle'; App.render(); };
    const rs = root.querySelector('#re-restore'); if (rs) rs.onclick = () => confirmModal('Volver al modelo del TP', 'Se descarta la capa reentrenada en la clínica.', 'Restaurar', async () => { await CNN.restaurarCabeza(); delete evals[CNN.activo]; toast('Capa original restaurada'); reanalizarTodo(); });
  }
  async function reanalizarTodo() {
    App.render();
    for (const e of S().estudios.slice()) { try { await analizarEstudio(e.id); } catch (err) { console.error(err); } }
    toast('Estudios reanalizados con el modelo actual');
  }

  window.Views = { inicio, pacientes, turnos, estudios, estudioDetalle, triage, informes, informeDetalle, derivaciones, interconsultas, interconsultaDetalle, calidad, analitica, hemocomponentes, pacienteDetalle, modelo, analizarEstudio, ui };
})();

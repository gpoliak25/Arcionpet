/* Vistas · Aliados: directorio de servicios de terceros recomendados por la clínica, verificación, recomendación al
   tutor con consentimiento y valoración. Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fShort, openModal, closeModal, toast, formData } = UI;
  const { S, A, pageHead, empty, tutorName, on, pacienteOptions, ui } = VC;
  const AL = () => Dominio.aliados, PE = () => Dominio.peluqueria;
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const ESTADO = { pendiente: 'b-incierto', verificado: 'b-normal', suspendido: 'b-gray' };
  const admin = () => Store.puedeAccion('verificarAliado');
  const recomendar = () => Store.puede('aliados', 'editar');
  const dec = (x) => Number(x).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const estrellas = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof AL().ErrorAliado) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }
  /* Filtros que salen del paciente: especie, tamaño y condiciones (senior, cachorro, con medicación). */
  function filtrosPaciente(pid) {
    const p = Store.paciente(pid);
    if (!p) return null;
    const recetas = (S().recetas || []).filter((r) => r.animal && r.animal.pacienteId === pid && ['vigente', 'dispensada'].includes(r.estado) && Dominio.ventas.diasVigencia(r, new Date()) >= -30).length;
    const cirugia = S().turnos.some((t) => t.pacienteId === pid && ['cirugia', 'castracion'].includes(t.servicioId) && t.estado === 'atendido' && Store.daysBetween(t.fecha, new Date()) <= 30);
    return { especie: p.especie, tamano: PE().tamano(p, Store.pelFicha ? Store.pelFicha(pid) : null), condiciones: AL().condicionesPaciente(p, { ahora: new Date(), recetasVigentes: recetas, cirugiaReciente: cirugia }) };
  }

  /* =========================================================== DIRECTORIO */
  function directorio() {
    const f = ui.alF = ui.alF || { tipo: '', especie: '', tamano: '', zona: '', condiciones: [], pacienteId: '' };
    const lista = AL().filtrar(Store.aliadosVisibles(), f).sort((a, b) => ({ verificado: 0, pendiente: 1, suspendido: 2 })[a.estado] - ({ verificado: 0, pendiente: 1, suspendido: 2 })[b.estado] || a.nombre.localeCompare(b.nombre));
    const recs = S().aliadoRecomendaciones || [];
    const card = (a) => {
      const v = AL().promedio(a.id, recs);
      return '<div class="card card-pad aliado' + (a.estado === 'suspendido' ? ' off' : '') + '" data-al="' + a.id + '">' +
        (a.fotos && a.fotos[0] ? '<img src="' + a.fotos[0] + '" alt="" class="al-foto">' : '') +
        '<div style="display:flex;gap:8px;align-items:flex-start"><div class="grow"><div class="strong">' + esc(a.nombre) + '</div><div class="sp">' + esc(AL().TIPOS[a.tipo]) + ' · ' + esc(a.zona) + '</div></div><span class="badge ' + ESTADO[a.estado] + '">' + AL().ESTADOS[a.estado] + '</span></div>' +
        (v.n ? '<div class="small" style="color:#B45309;margin-top:6px">' + estrellas(v.promedio) + ' <span class="muted">' + dec(v.promedio) + ' · ' + v.n + ' valoración' + (v.n > 1 ? 'es' : '') + '</span></div>' : '') +
        '<div class="small" style="margin-top:6px">' + esc((a.especies || []).join(', ')) + ' · ' + esc((a.tamanos || []).join(', ')) + '</div>' +
        ((a.condiciones || []).length ? '<div class="chips" style="margin-top:6px">' + a.condiciones.map((c) => '<span class="chip">' + esc(AL().CONDICIONES[c]) + '</span>').join('') + '</div>' : '') +
        (a.precioDesde ? '<div class="small" style="margin-top:6px">Desde ' + pesos(a.precioDesde) + ' ' + esc(a.precioDetalle || '') + '</div>' : '') +
        (a.acuerdoComercial ? '<div class="small" style="margin-top:4px;color:#6D28D9">Acuerdo comercial: ' + esc(a.acuerdoComercial) + '</div>' : '') +
        (a.origen === 'red' ? '<div class="small muted" style="margin-top:4px">' + icon('network') + ' Aliado de la red · ' + esc(a.sede || '') + '</div>' : '') + '</div>';
    };
    const pacSel = '<select class="filter" id="al-pac"><option value="">Para un paciente…</option>' + pacienteOptions(f.pacienteId || null, (p) => p.especie !== 'Otro') + '</select>';
    const html = pageHead('users', 'Aliados', 'Servicios de terceros que la clínica recomienda: paseadores, guarderías, hoteles, transporte, adiestradores y cuidadores. ' + AL().AVISO_TERCERO,
      Store.puede('aliados', 'editar') ? '<button class="btn primary" id="al-nuevo">' + icon('plus') + 'Nuevo aliado</button>' : '') +
      '<div class="toolbar" style="flex-wrap:wrap">' + pacSel +
      '<select class="filter" id="al-tipo"><option value="">Todos los servicios</option>' + Object.entries(AL().TIPOS).map(([k, l]) => '<option value="' + k + '"' + (f.tipo === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      '<select class="filter" id="al-esp"><option value="">Toda especie</option>' + ['Canino', 'Felino'].map((e) => '<option' + (f.especie === e ? ' selected' : '') + '>' + e + '</option>').join('') + '</select>' +
      '<select class="filter" id="al-tam"><option value="">Todo tamaño</option>' + AL().TAMANOS.map((t) => '<option' + (f.tamano === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
      '<input class="filter" id="al-zona" placeholder="Zona" value="' + esc(f.zona) + '" style="max-width:140px"></div>' +
      '<div class="chips" style="margin:-4px 0 14px">' + Object.entries(AL().CONDICIONES).map(([k, l]) => '<button type="button" class="chip" data-cond="' + k + '" style="' + (f.condiciones.includes(k) ? 'border-color:var(--green);color:var(--green);font-weight:600' : '') + '">' + l + '</button>').join('') + '</div>' +
      (S().config.compartirAliadosRed ? '' : '<p class="small muted" style="margin-top:-6px">Directorio propio de la clínica. Los aliados verificados de la red EISPLUS se ven si se activa en Configuración → Módulos y flags.</p>') +
      (lista.length ? '<div class="aliados-grid">' + lista.map(card).join('') + '</div>' : empty('users', 'Sin aliados para esos filtros', ''));
    return {
      html, mount(root) {
        const set = (k, v) => { f[k] = v; App.render(); };
        root.querySelector('#al-tipo').onchange = (e) => set('tipo', e.target.value);
        root.querySelector('#al-esp').onchange = (e) => set('especie', e.target.value);
        root.querySelector('#al-tam').onchange = (e) => set('tamano', e.target.value);
        root.querySelector('#al-zona').onchange = (e) => set('zona', e.target.value.trim());
        root.querySelector('#al-pac').onchange = (e) => { const fp = filtrosPaciente(e.target.value); Object.assign(f, fp || { especie: '', tamano: '', condiciones: [] }, { pacienteId: e.target.value }); App.render(); };
        on(root, '[data-cond]', 'click', (el) => { const c = el.dataset.cond; f.condiciones = f.condiciones.includes(c) ? f.condiciones.filter((x) => x !== c) : f.condiciones.concat([c]); App.render(); });
        on(root, '[data-al]', 'click', (el) => detalle(el.dataset.al));
        const bn = root.querySelector('#al-nuevo'); if (bn) bn.onclick = () => form();
      },
    };
  }

  function detalle(id) {
    const a = Store.aliado(id), recs = (S().aliadoRecomendaciones || []).filter((r) => r.aliadoId === id), v = AL().promedio(id, recs);
    const falt = AL().faltantes(a, new Date().toISOString());
    const propio = a.origen !== 'red';
    openModal({
      title: esc(a.nombre) + ' <span class="badge ' + ESTADO[a.estado] + '">' + AL().ESTADOS[a.estado] + '</span>', wide: true,
      body: ((a.fotos || []).length ? '<div class="pel-fotos" style="margin-bottom:12px">' + a.fotos.map((src) => '<figure><img src="' + src + '" alt=""></figure>').join('') + '</div>' : '') +
        '<div class="grid halves" style="margin:0"><dl class="dl"><dt>Servicio</dt><dd>' + esc(AL().TIPOS[a.tipo]) + '</dd><dt>Zona</dt><dd>' + esc(a.zona) + '</dd><dt>Contacto</dt><dd>' + esc([a.telefono, a.email].filter(Boolean).join(' · ')) + '</dd><dt>Horarios</dt><dd>' + esc(a.horarios || '—') + '</dd>' +
        '<dt>Precio de referencia</dt><dd>' + (a.precioDesde ? 'Desde ' + pesos(a.precioDesde) + ' ' + esc(a.precioDetalle || '') : '—') + '</dd><dt>Acepta</dt><dd>' + esc((a.especies || []).join(', ')) + ' · ' + esc((a.tamanos || []).join(', ')) + '</dd>' +
        '<dt>Condiciones</dt><dd>' + esc((a.condiciones || []).map((c) => AL().CONDICIONES[c]).join(', ') || '—') + '</dd><dt>Acuerdo comercial</dt><dd>' + esc(a.acuerdoComercial || 'No tiene') + '</dd>' +
        (a.origen === 'red' ? '<dt>Origen</dt><dd>Aliado verificado por ' + esc(a.sede || 'la red') + '</dd>' : '') + '</dl>' +
        '<div><div class="section-title" style="margin-top:0">Documentación</div>' + Object.entries(AL().DOCUMENTOS).map(([k, l]) => { const d = (a.documentos || {})[k]; const req = (AL().REQUERIDOS[a.tipo] || []).includes(k); return '<div class="small" style="padding:3px 0">' + (d && d.detalle ? icon('check') + ' ' : (req ? '<span style="color:var(--red)">✗</span> ' : '· ')) + '<b>' + l + '</b>' + (req ? '' : ' <span class="muted">(opcional)</span>') + (d && d.detalle ? ': ' + esc(d.detalle) + (d.vence ? ' · vence ' + fDate(d.vence + 'T12:00:00') : '') : '') + '</div>'; }).join('') +
        (falt.length && a.estado !== 'verificado' ? '<div class="callout amber" style="margin-top:8px">' + icon('alert') + '<span>Para verificarlo falta: ' + esc(falt.map((k) => AL().DOCUMENTOS[k].toLowerCase()).join(', ')) + '.</span></div>' : '') +
        (a.suspension ? '<div class="callout red" style="margin-top:8px">' + icon('alert') + '<span>Suspendido el ' + fDate(a.suspension.fecha) + ': ' + esc(a.suspension.motivo) + '</span></div>' : '') +
        '<div class="section-title">Valoraciones</div>' + (v.n ? '<div style="color:#B45309">' + estrellas(v.promedio) + ' <span class="muted small">' + dec(v.promedio) + ' sobre ' + v.n + '</span></div>' + recs.filter((r) => r.valoracion && r.valoracion.comentario).map((r) => '<div class="small muted">“' + esc(r.valoracion.comentario) + '”</div>').join('') : '<p class="small muted">Todavía sin valoraciones.</p>') +
        '<div class="small muted" style="margin-top:6px">' + recs.length + ' recomendación' + (recs.length === 1 ? '' : 'es') + ', ' + recs.filter((r) => r.concretada).length + ' concretada' + (recs.filter((r) => r.concretada).length === 1 ? '' : 's') + '.</div></div></div>',
      foot: '<button class="btn" data-close>Cerrar</button>' +
        (propio && Store.puede('aliados', 'editar') ? '<button class="btn" id="ad-edit">' + icon('edit') + 'Editar</button>' : '') +
        (propio && admin() && a.estado !== 'verificado' ? '<button class="btn" id="ad-ver">' + icon('check') + 'Verificar</button>' : '') +
        (propio && admin() && a.estado === 'verificado' ? '<button class="btn danger" id="ad-susp">Suspender</button>' : '') +
        (recomendar() && a.estado === 'verificado' ? '<button class="btn primary" id="ad-rec">' + icon('send') + 'Recomendar a un tutor</button>' : ''),
      onMount(m) {
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        b('#ad-edit', () => { closeModal(); setTimeout(() => form(id), 30); });
        b('#ad-ver', () => intentar(() => A.verificarAliado(id), () => { closeModal(); toast('Aliado verificado: ya se puede recomendar'); }));
        b('#ad-susp', () => openModal({ title: 'Suspender aliado', body: '<div class="field"><label>Motivo *</label><input name="motivo"></div><p class="small muted">Un aliado suspendido no se puede recomendar. Para volver a recomendarlo hay que verificarlo de nuevo.</p>', foot: '<button class="btn" data-close>Cancelar</button><button class="btn danger" id="su-ok">Suspender</button>',
          onMount(m2) { m2.querySelector('#su-ok').onclick = () => intentar(() => A.suspenderAliado(id, formData(m2).motivo), () => { closeModal(); closeModal(); toast('Aliado suspendido'); }); } }));
        b('#ad-rec', () => { closeModal(); setTimeout(() => recomendarForm(ui.alF && ui.alF.pacienteId, id), 30); });
      },
    });
  }

  function form(id) {
    const a = id ? Store.aliado(id) : { tipo: 'paseador', especies: ['Canino'], tamanos: ['chico', 'mediano'], condiciones: [], documentos: {}, fotos: [] };
    const chk = (name, val, lista, label) => '<label class="chip" style="cursor:pointer"><input type="checkbox" name="' + name + '_' + val + '"' + (lista.includes(val) ? ' checked' : '') + ' style="margin-right:4px">' + label + '</label>';
    const doc = (k) => { const d = (a.documentos || {})[k] || {}; return '<div class="field"><label>' + AL().DOCUMENTOS[k] + '</label><input name="doc_' + k + '" value="' + esc(d.detalle || '') + '" placeholder="N.º, compañía o detalle"></div><div class="field"><label>Vence</label><input type="date" name="vence_' + k + '" value="' + esc(d.vence || '') + '"></div>'; };
    openModal({
      title: id ? 'Editar aliado' : 'Nuevo aliado', wide: true,
      body: '<div class="form-grid">' +
        '<div class="field"><label>Nombre *</label><input name="nombre" value="' + esc(a.nombre || '') + '"></div>' +
        '<div class="field"><label>Servicio *</label><select name="tipo">' + Object.entries(AL().TIPOS).map(([k, l]) => '<option value="' + k + '"' + (a.tipo === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Zona *</label><input name="zona" value="' + esc(a.zona || '') + '"></div><div class="field"><label>Horarios</label><input name="horarios" value="' + esc(a.horarios || '') + '"></div>' +
        '<div class="field"><label>Teléfono</label><input name="telefono" value="' + esc(a.telefono || '') + '"></div><div class="field"><label>Email</label><input name="email" value="' + esc(a.email || '') + '"></div>' +
        '<div class="field"><label>Precio de referencia desde ($)</label><input type="number" min="0" name="precioDesde" value="' + esc(a.precioDesde || '') + '"></div><div class="field"><label>Detalle del precio</label><input name="precioDetalle" value="' + esc(a.precioDetalle || '') + '" placeholder="Ej.: por paseo"></div>' +
        '<div class="field full"><label>Especies y tamaños *</label><div class="chips">' + ['Canino', 'Felino'].map((e) => chk('esp', e, a.especies || [], e)).join('') + AL().TAMANOS.map((t) => chk('tam', t, a.tamanos || [], t)).join('') + '</div></div>' +
        '<div class="field full"><label>Acepta pacientes</label><div class="chips">' + Object.entries(AL().CONDICIONES).map(([k, l]) => chk('cond', k, a.condiciones || [], l)).join('') + '</div></div>' +
        '<div class="field full"><label>Acuerdo comercial con la clínica</label><input name="acuerdoComercial" value="' + esc(a.acuerdoComercial || '') + '" placeholder="Si existe, se informa al tutor en cada recomendación"></div>' +
        Object.keys(AL().DOCUMENTOS).map(doc).join('') +
        '<div class="field full"><label>Fotos (hasta 6)</label><input type="file" accept="image/*" multiple id="al-fotos"></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="af-ok">' + (id ? 'Guardar' : 'Crear aliado') + '</button>',
      onMount(m) {
        m.querySelector('#af-ok').onclick = async () => {
          const f = formData(m), fotos = (a.fotos || []).slice();
          for (const file of m.querySelector('#al-fotos').files) { try { fotos.push(await Views.achicarFoto(file)); } catch (e) { return toast('No se pudo leer una foto', 'warn'); } }
          const documentos = {};
          Object.keys(AL().DOCUMENTOS).forEach((k) => { if (f['doc_' + k]) documentos[k] = { detalle: f['doc_' + k].trim(), vence: f['vence_' + k] || null }; });
          const datos = { nombre: f.nombre.trim(), tipo: f.tipo, zona: f.zona.trim(), horarios: f.horarios, telefono: f.telefono.trim(), email: f.email.trim(), precioDesde: f.precioDesde === '' ? null : Number(f.precioDesde), precioDetalle: f.precioDetalle, acuerdoComercial: f.acuerdoComercial.trim(),
            especies: ['Canino', 'Felino'].filter((e) => f['esp_' + e]), tamanos: AL().TAMANOS.filter((t) => f['tam_' + t]), condiciones: Object.keys(AL().CONDICIONES).filter((c) => f['cond_' + c]), documentos, fotos };
          if (id) datos.id = id;
          intentar(() => A.guardarAliado(datos), (r) => { closeModal(); toast(id ? 'Aliado actualizado' : 'Aliado creado: queda pendiente de verificación'); if (!id) setTimeout(() => detalle(r.id), 30); });
        };
      },
    });
  }

  /* =========================================================== RECOMENDAR */
  function recomendarForm(pacienteId, aliadoId) {
    openModal({
      title: 'Recomendar un aliado al tutor', wide: true,
      body: '<div class="form-grid"><div class="field"><label>Paciente</label><select name="pacienteId" id="rf-pac">' + pacienteOptions(pacienteId || null, (p) => p.especie !== 'Otro') + '</select></div>' +
        '<div class="field"><label>Aliado (verificados y compatibles)</label><select name="aliadoId" id="rf-al"></select></div>' +
        '<div class="field full"><label>Motivo</label><input name="motivo" id="rf-mot" placeholder="Ej.: paseos cortos por su cardiopatía"></div>' +
        '<div class="field"><label>Enviar por</label><select name="canal" id="rf-can">' + Object.entries(AL().CANALES).map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('') + '</select></div></div>' +
        '<div class="section-title">Mensaje para el tutor</div><pre class="al-msg" id="rf-msg"></pre>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="rf-ok">' + icon('send') + 'Registrar y enviar</button>',
      onMount(m) {
        const pac = m.querySelector('#rf-pac'), al = m.querySelector('#rf-al');
        const opciones = () => {
          const fp = filtrosPaciente(pac.value) || {};
          const ok = AL().filtrar(Store.aliadosVisibles(), { especie: fp.especie, tamano: fp.tamano, soloVerificados: true });
          const elegido = aliadoId && ok.some((a) => a.id === aliadoId) ? aliadoId : al.value;
          al.innerHTML = ok.length ? ok.map((a) => { const cubre = (fp.condiciones || []).every((c) => (a.condiciones || []).includes(c)); return '<option value="' + a.id + '"' + (a.id === elegido ? ' selected' : '') + '>' + esc(a.nombre + ' · ' + AL().TIPOS[a.tipo]) + (cubre ? '' : ' (no indica atender: ' + (fp.condiciones || []).filter((c) => !(a.condiciones || []).includes(c)).map((c) => AL().CONDICIONES[c].toLowerCase()).join(', ') + ')') + '</option>'; }).join('') : '<option value="">Sin aliados verificados para esta mascota</option>';
          preview();
        };
        const preview = () => {
          const a = Store.aliado(al.value), p = Store.paciente(pac.value);
          m.querySelector('#rf-msg').textContent = a && p ? AL().mensaje({ aliado: a, paciente: p, tutor: Store.tutor(p.tutorId), motivo: m.querySelector('#rf-mot').value, clinica: Store.clinica }) : '';
        };
        pac.onchange = opciones; al.onchange = preview; m.querySelector('#rf-mot').oninput = preview;
        opciones();
        m.querySelector('#rf-ok').onclick = () => {
          const f = formData(m);
          intentar(() => A.recomendarAliado({ pacienteId: f.pacienteId, aliadoId: f.aliadoId, motivo: f.motivo.trim(), canal: f.canal }), (r) => { closeModal(); enviado(r); });
        };
      },
    });
  }
  /* Enlace para enviar el mensaje desde WhatsApp o el correo del equipo. */
  function enlaceEnvio(r) {
    const t = Store.tutor(r.tutorId) || {};
    if (r.canal === 'whatsapp') { const d = String(t.tel || '').replace(/\D/g, '').replace(/^0/, ''); return 'https://wa.me/' + (d.startsWith('54') ? d : '549' + d) + '?text=' + encodeURIComponent(r.texto); }
    return 'mailto:' + encodeURIComponent(t.email || '') + '?subject=' + encodeURIComponent('Recomendación de ' + (Store.clinica.nombre || 'la clínica')) + '&body=' + encodeURIComponent(r.texto);
  }
  function enviado(r) {
    openModal({
      title: 'Recomendación registrada',
      body: '<p class="muted" style="margin-top:0">Quedó en la ficha de la mascota. Enviá el mensaje al tutor:</p><pre class="al-msg">' + esc(r.texto) + '</pre>',
      foot: '<button class="btn" data-close>Cerrar</button><a class="btn primary" target="_blank" rel="noopener" id="rv-env" href="' + esc(enlaceEnvio(r)) + '">' + icon('send') + 'Abrir ' + AL().CANALES[r.canal] + '</a>',
    });
  }

  /* =========================================================== RECOMENDACIONES */
  function recomendaciones() {
    const recs = (S().aliadoRecomendaciones || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const sg = AL().seguimiento(recs, S().aliados);
    const html = pageHead('send', 'Recomendaciones de aliados', 'Seguimiento de lo que se recomendó a cada tutor: si lo usó, cómo lo valoró y si autorizó compartir datos.', recomendar() ? '<button class="btn primary" id="rc-nueva">' + icon('plus') + 'Recomendar</button>' : '') +
      '<div class="grid kpis">' + VC.kpi('send', '', 'Enviadas', sg.enviadas, '') + VC.kpi('check', '', 'Concretadas', sg.concretadas, sg.tasa + '% de las enviadas') + VC.kpi('chart', 'amber', 'Valoración promedio', sg.valoracion == null ? '—' : dec(sg.valoracion) + ' / 5', '') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Aliado</th><th>Canal</th><th>Estado</th><th>Consentimiento</th><th class="actions"></th></tr></thead><tbody>' +
      (recs.map((r) => { const p = Store.paciente(r.pacienteId) || {}, a = Store.aliado(r.aliadoId) || {}; return '<tr><td class="nowrap">' + fDate(r.fecha) + '</td><td class="strong">' + esc(p.nombre || '') + '<div class="sp">' + tutorName(Store.tutor(r.tutorId)) + '</div></td><td>' + esc(a.nombre || '') + '<div class="sp">' + esc(AL().TIPOS[a.tipo] || '') + '</div></td><td>' + AL().CANALES[r.canal] + '</td><td>' + (r.valoracion ? '<span class="badge b-normal">Valorada ' + r.valoracion.puntaje + '/5</span>' : r.concretada ? '<span class="badge b-blue">Concretada</span>' : '<span class="badge b-incierto">Enviada</span>') + '</td><td class="sp">' + (r.consentimiento ? 'Sí (' + esc(r.consentimiento.medio) + ')' + ((r.compartidos || []).length ? ' · datos compartidos' : '') : 'No') + '</td><td class="actions"><button class="btn sm" data-rec="' + r.id + '">Ver</button></td></tr>'; }).join('') ||
        '<tr><td colspan="7">' + empty('send', 'Sin recomendaciones', '') + '</td></tr>') + '</tbody></table></div>';
    return { html, mount(root) { on(root, '[data-rec]', 'click', (el) => recDetalle(el.dataset.rec)); const b = root.querySelector('#rc-nueva'); if (b) b.onclick = () => recomendarForm(); } };
  }

  function recDetalle(id) {
    const r = S().aliadoRecomendaciones.find((x) => x.id === id), p = Store.paciente(r.pacienteId) || {}, a = Store.aliado(r.aliadoId) || {};
    const ed = Store.puede('aliados', 'editar');
    openModal({
      title: esc(p.nombre) + ' · ' + esc(a.nombre), wide: true,
      body: '<dl class="dl"><dt>Fecha</dt><dd>' + fShort(r.fecha) + ' · ' + AL().CANALES[r.canal] + '</dd><dt>Tutor</dt><dd>' + tutorName(Store.tutor(r.tutorId)) + '</dd><dt>Motivo</dt><dd>' + esc(r.motivo || '—') + '</dd>' +
        '<dt>Usó el servicio</dt><dd>' + (r.concretada ? 'Sí, ' + fDate(r.fechaConcretada) : 'Todavía no') + '</dd>' +
        '<dt>Valoración</dt><dd>' + (r.valoracion ? estrellas(r.valoracion.puntaje) + ' ' + esc(r.valoracion.comentario || '') : '—') + '</dd>' +
        '<dt>Consentimiento</dt><dd>' + (r.consentimiento ? 'Otorgado (' + esc(r.consentimiento.medio) + ', ' + fDate(r.consentimiento.fecha) + '): ' + esc(r.consentimiento.alcance) : 'No: no se comparte ningún dato con el aliado') + '</dd>' +
        ((r.compartidos || []).length ? '<dt>Datos compartidos</dt><dd>' + r.compartidos.map((c) => fShort(c.fecha) + ' · ' + esc(c.datos)).join('<br>') + '</dd>' : '') + '</dl>' +
        (r.texto ? '<div class="section-title">Mensaje enviado</div><pre class="al-msg">' + esc(r.texto) + '</pre>' : '') + '<div id="rd-form"></div>',
      foot: '<button class="btn" data-close>Cerrar</button>' + (ed ? (!r.concretada ? '<button class="btn" id="rd-conc">El tutor lo usó</button>' : '') + (r.concretada && !r.valoracion ? '<button class="btn" id="rd-val">Registrar valoración</button>' : '') +
        (!r.consentimiento ? '<button class="btn" id="rd-cons">Registrar consentimiento</button>' : '<button class="btn primary" id="rd-comp">Compartir datos con el aliado</button>') : ''),
      onMount(m) {
        const form = m.querySelector('#rd-form');
        const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
        const reabrir = () => { closeModal(); setTimeout(() => recDetalle(id), 30); };
        b('#rd-conc', () => { A.concretarRecomendacion(id); toast('Marcada como concretada'); reabrir(); });
        b('#rd-val', () => {
          form.innerHTML = '<div class="form-grid" style="margin-top:12px"><div class="field"><label>Puntaje del tutor</label><select id="rv-p">' + [5, 4, 3, 2, 1].map((n) => '<option value="' + n + '">' + estrellas(n) + ' (' + n + ')</option>').join('') + '</select></div><div class="field"><label>Comentario</label><input id="rv-c"></div></div><button class="btn primary sm" id="rv-ok">Guardar valoración</button>';
          form.querySelector('#rv-ok').onclick = () => intentar(() => A.valorarRecomendacion(id, Number(form.querySelector('#rv-p').value), form.querySelector('#rv-c').value.trim()), () => { toast('Valoración registrada'); reabrir(); });
        });
        b('#rd-cons', () => {
          form.innerHTML = '<div class="callout amber" style="margin-top:12px">' + icon('info') + '<span>Registrá el consentimiento solo si el tutor lo dio de forma expresa (Ley 25.326). Sin él, no se comparte nada con el aliado.</span></div><div class="form-grid"><div class="field"><label>Cómo lo dio</label><select id="cs-m"><option value="verbal">Verbal, en la clínica</option><option value="escrito">Por escrito</option><option value="portal">Desde el portal</option></select></div><div class="field"><label>Qué autorizó a compartir *</label><input id="cs-a" placeholder="Ej.: nombre de la mascota y su medicación"></div></div><button class="btn primary sm" id="cs-ok">Registrar consentimiento</button>';
          form.querySelector('#cs-ok').onclick = () => intentar(() => A.registrarConsentimiento(id, { medio: form.querySelector('#cs-m').value, alcance: form.querySelector('#cs-a').value }), () => { toast('Consentimiento registrado'); reabrir(); });
        });
        b('#rd-comp', () => intentar(() => A.compartirConAliado(id), () => { toast('Datos compartidos según el consentimiento'); reabrir(); }));
      },
    });
  }

  Object.assign(window.Views, { aliados: directorio, aliadosRecomendaciones: recomendaciones, aliadoDetalle: detalle, recomendarAliado: recomendarForm });
})();

/* Vistas · Recordatorios a tutores: cola de envíos con su estado, consentimiento de cada tutor y calendario de salud
   de cada paciente. Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fShort, openModal, closeModal, toast, formData } = UI;
  const { S, A, pageHead, empty, tutorName, on, kpi, ui } = VC;
  const R = () => Dominio.recordatorios;
  const ESTADO = { programado: 'b-blue', enviado: 'b-violet', entregado: 'b-normal', fallo: 'b-patologico', cancelado: 'b-gray', omitido: 'b-gray' };
  const intentar = (fn, ok) => { try { const r = fn(); if (ok) ok(r); return true; } catch (e) { toast(e.message, 'warn'); return false; } };

  /* =========================================================== PANEL */
  function recordatorios() {
    Store.A.procesarRecordatorios();
    const cola = (S().recordatorios || []).slice().sort((a, b) => (a.estado === 'programado' ? 0 : 1) - (b.estado === 'programado' ? 0 : 1) || a.envioEn.localeCompare(b.envioEn));
    const filtro = ui.recEstado || 'activos';
    const lista = cola.filter((r) => filtro === 'todos' || (filtro === 'activos' ? ['programado', 'fallo'].includes(r.estado) : r.estado === filtro));
    const sg = R().seguimiento(cola, S().turnos, S().pelTurnos);
    const cfg = Store.recordatoriosCfg;
    const sinCanal = cola.filter((r) => r.estado === 'programado' && r.error).length;
    const sinConsentimiento = S().tutores.filter((t) => t.activo !== false && !(t.recordatorios || {}).consentimiento).length;
    const html = pageHead('send', 'Recordatorios', 'Avisos automáticos a los tutores: vacunas, antiparasitarios, controles, peluquería y turnos. Se envían solos, en el horario permitido, sin duplicados.', '<button class="btn" id="rc-proc">' + icon('send') + 'Procesar ahora</button>') +
      (Store.demo ? '<div class="callout green" style="margin-bottom:14px">' + icon('info') + '<span>Modo demostración: los envíos son simulados.</span></div>' : '') +
      (sinCanal ? '<div class="callout amber" style="margin-bottom:14px">' + icon('alert') + '<span><b>' + sinCanal + ' aviso' + (sinCanal > 1 ? 's' : '') + ' en cola sin canal de envío.</b> Configurá el proveedor de email en Configuración → Recordatorios. WhatsApp se activa cuando estén aprobadas las plantillas.</span></div>' : '') +
      '<div class="grid kpis">' + kpi('clock', '', 'Programados', sg.porEstado.programado || 0, 'en la cola') + kpi('send', 'violet', 'Enviados', (sg.porEstado.enviado || 0) + (sg.porEstado.entregado || 0), (sg.porEstado.entregado || 0) + ' entregados') +
      kpi('alert', 'red', 'Fallidos', sg.porEstado.fallo || 0, 'después de ' + cfg.reintentos.max + ' reintentos') + kpi('check', '', 'Turnos concretados', sg.tasa + '%', sg.concretados + ' de ' + sg.avisosSalud + ' avisos de salud') + '</div>' +
      '<p class="small muted">Anticipación: ' + cfg.anticipacionDias.join(', ') + ' días antes · turnos: ' + cfg.turnoHoras.join(' y ') + ' h antes · horario de envío ' + cfg.horario.desde + ' a ' + cfg.horario.hasta + ' · canales: ' + Object.entries(cfg.canales).filter(([, v]) => v).map(([k]) => R().CANALES[k]).join(', ') + (cfg.canales.whatsapp && !cfg.whatsappPlantillasAprobadas ? ' (WhatsApp en espera de plantillas aprobadas)' : '') + '. ' + (sinConsentimiento ? sinConsentimiento + ' tutor' + (sinConsentimiento > 1 ? 'es' : '') + ' sin consentimiento no recibe' + (sinConsentimiento > 1 ? 'n' : '') + ' avisos.' : '') + '</p>' +
      '<div class="toolbar"><div class="seg">' + [['activos', 'En cola'], ['enviado', 'Enviados'], ['entregado', 'Entregados'], ['fallo', 'Fallidos'], ['cancelado', 'Cancelados'], ['todos', 'Todos']].map(([k, l]) => '<button data-re="' + k + '" class="' + (filtro === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Para</th><th>Aviso</th><th>Fecha</th><th>Envío</th><th>Canal</th><th>Estado</th></tr></thead><tbody>' +
      (lista.map((r) => { const p = Store.paciente(r.pacienteId) || {}, t = Store.tutor(r.tutorId) || {}; return '<tr class="clickable" data-rc="' + r.id + '"><td class="strong">' + esc(p.nombre || '') + '<div class="sp">' + tutorName(t) + '</div></td><td>' + esc(R().TIPOS[r.tipo]) + '<div class="sp">' + esc(r.item) + ' · ' + esc(r.anticipacion) + ' antes</div></td><td class="nowrap">' + fShort(r.objetivo) + '</td><td class="nowrap">' + fShort(r.enviado || r.proximoIntento || r.envioEn) + (r.intentos ? '<div class="sp">' + r.intentos + ' intento' + (r.intentos > 1 ? 's' : '') + '</div>' : '') + '</td><td>' + esc((r.canal ? [r.canal] : r.canales).map((c) => R().CANALES[c]).join(', ')) + '</td><td><span class="badge ' + ESTADO[r.estado] + '">' + R().ESTADOS[r.estado] + '</span>' + (r.error && r.estado !== 'entregado' ? '<div class="sp">' + esc(r.error) + '</div>' : '') + '</td></tr>'; }).join('') ||
        '<tr><td colspan="6">' + empty('send', 'Sin avisos en esta vista', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        on(root, '[data-re]', 'click', (el) => { ui.recEstado = el.dataset.re; App.render(); });
        on(root, '[data-rc]', 'click', (el) => detalle(el.dataset.rc));
        root.querySelector('#rc-proc').onclick = () => { Store.A.procesarRecordatorios(); App.render(); toast('Cola procesada'); };
      },
    };
  }

  function detalle(id) {
    const r = S().recordatorios.find((x) => x.id === id), p = Store.paciente(r.pacienteId), t = Store.tutor(r.tutorId);
    const texto = r.texto || R().mensaje(r, { config: Store.recordatoriosCfg, tutor: t, paciente: p, clinica: Store.clinica });
    openModal({
      title: esc(R().TIPOS[r.tipo]) + ' · ' + esc(p.nombre) + ' <span class="badge ' + ESTADO[r.estado] + '">' + R().ESTADOS[r.estado] + '</span>', wide: true,
      body: '<dl class="dl"><dt>Tutor</dt><dd>' + tutorName(t) + ' · ' + esc([t.email, t.tel].filter(Boolean).join(' · ')) + '</dd><dt>Fecha</dt><dd>' + fShort(r.objetivo) + ' (' + esc(r.anticipacion) + ' antes)</dd><dt>Envío</dt><dd>' + fShort(r.envioEn) + '</dd><dt>Clave</dt><dd class="sp">' + esc(r.clave) + '</dd>' +
        (r.motivo ? '<dt>Motivo</dt><dd>' + esc(r.motivo) + '</dd>' : '') + '</dl>' +
        '<div class="section-title">' + (r.texto ? 'Mensaje enviado' : 'Vista previa del mensaje') + '</div><pre class="al-msg">' + esc(texto) + '</pre>' +
        ((r.historial || []).length ? '<div class="section-title">Intentos</div>' + r.historial.map((h) => '<div class="small">' + fShort(h.fecha) + ' · ' + R().CANALES[h.canal] + ' · ' + (h.ok ? 'enviado' : 'falló: ' + esc(h.error || '')) + '</div>').join('') : ''),
      foot: '<button class="btn" data-close>Cerrar</button>',
    });
  }

  /* =========================================================== CONSENTIMIENTO DEL TUTOR */
  function consentimientoForm(tutorId) {
    const t = Store.tutor(tutorId), c = t.recordatorios || {};
    openModal({
      title: 'Recordatorios · ' + tutorName(t),
      body: '<p class="muted" style="margin-top:0">Registrá la autorización del tutor para recibir avisos (Ley 25.326 de protección de datos personales). Cada mensaje trae un enlace para darse de baja.</p>' +
        (c.baja ? '<div class="callout amber" style="margin-bottom:10px">' + icon('alert') + '<span>Se dio de baja el ' + fDate(c.baja) + '. Para volver a enviarle avisos, registrá un nuevo consentimiento.</span></div>' : '') +
        '<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="consentimiento"' + (c.consentimiento && !c.baja ? ' checked' : '') + '> <span>El tutor autoriza recibir recordatorios de vacunas, controles y turnos.</span></label>' +
        '<div class="form-grid" style="margin-top:10px"><div class="field"><label>Cómo lo autorizó</label><select name="medio">' + [['escrito', 'Por escrito'], ['verbal', 'Verbal, en la clínica'], ['portal', 'Desde el portal']].map(([k, l]) => '<option value="' + k + '"' + (c.medio === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Canales</label><div class="chips">' + Object.entries(R().CANALES).map(([k, l]) => '<label class="chip" style="cursor:pointer"><input type="checkbox" name="c_' + k + '"' + ((c.canales || ['email']).includes(k) ? ' checked' : '') + ' style="margin-right:4px">' + l + '</label>').join('') + '</div></div></div>',
      foot: '<button class="btn" data-close>Cancelar</button>' + (c.consentimiento && !c.baja ? '<button class="btn ghost" id="cr-baja">Dar de baja</button>' : '') + '<button class="btn primary" id="cr-ok">Guardar</button>',
      onMount(m) {
        m.querySelector('#cr-ok').onclick = () => { const f = formData(m); intentar(() => A.consentimientoRecordatorios(tutorId, { consentimiento: !!f.consentimiento, medio: f.medio, canales: Object.keys(R().CANALES).filter((k) => f['c_' + k]) }), () => { closeModal(); toast(f.consentimiento ? 'Consentimiento registrado' : 'El tutor no recibirá recordatorios'); }); };
        const bb = m.querySelector('#cr-baja'); if (bb) bb.onclick = () => { A.bajaRecordatorios(tutorId, 'clinica'); closeModal(); toast('Baja registrada: se cancelaron los avisos pendientes'); };
      },
    });
  }
  const estadoConsentimiento = (t) => { const c = t.recordatorios || {}; return c.baja ? '<span class="badge b-gray">Dado de baja</span>' : c.consentimiento ? '<span class="badge b-normal">Acepta (' + esc((c.canales || []).map((k) => R().CANALES[k]).join(', ')) + ')</span>' : '<span class="badge b-incierto">Sin consentimiento</span>'; };

  /* =========================================================== CALENDARIO DE SALUD (ficha del paciente) */
  function calendarioHtml(pid) {
    const items = (S().calendarioSalud || []).filter((c) => c.pacienteId === pid && c.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const vet = Store.rol() === 'veterinario';
    return '<div class="section-title">Calendario de salud</div>' + (items.length ? items.map((c) => '<div class="small" style="display:flex;gap:8px;align-items:center;padding:3px 0"><span class="grow">' + fDate(c.fecha + 'T12:00:00') + ' · <b>' + esc(c.nombre) + '</b> <span class="muted">(' + esc(c.categoria) + ')</span></span>' + (vet ? '<button class="btn sm ghost" data-csf="' + c.id + '">Cambiar fecha</button><button class="btn sm ghost" data-csx="' + c.id + '">Quitar</button>' : '') + '</div>').join('') : '<p class="small muted">Sin vacunas, desparasitaciones ni controles pendientes.</p>') +
      (vet ? '<button class="btn sm" id="cs-add" style="margin-top:6px">' + icon('plus') + 'Indicar control</button>' : '');
  }
  function bindCalendario(m, pid, reabrir) {
    const b = (sel, fn) => { const el = m.querySelector(sel); if (el) el.onclick = fn; };
    b('#cs-add', () => openModal({
      title: 'Indicar control', body: '<div class="form-grid"><div class="field full"><label>Qué corresponde *</label><input name="nombre" placeholder="Ej.: control de la herida"></div><div class="field"><label>Tipo</label><select name="categoria"><option>Control</option><option>Vacunas</option><option>Antiparasitarios</option></select></div><div class="field"><label>Fecha *</label><input type="date" name="fecha" value="' + new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) + '"></div></div><p class="small muted">El tutor recibe el recordatorio según las reglas de la clínica, si dio su consentimiento.</p>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ci-ok">Agregar</button>',
      onMount(m2) { m2.querySelector('#ci-ok').onclick = () => intentar(() => A.agregarItemSalud(pid, formData(m2)), () => { closeModal(); toast('Control agregado al calendario de salud'); reabrir(); }); },
    }));
    m.querySelectorAll('[data-csf]').forEach((el) => { el.onclick = () => openModal({
      title: 'Cambiar fecha', body: '<div class="field"><label>Nueva fecha</label><input type="date" name="fecha" value="' + S().calendarioSalud.find((x) => x.id === el.dataset.csf).fecha + '"></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="cf-ok">Guardar</button>',
      onMount(m2) { m2.querySelector('#cf-ok').onclick = () => intentar(() => A.editarItemSalud(el.dataset.csf, { fecha: formData(m2).fecha }), () => { closeModal(); toast('Fecha actualizada: los avisos se recalculan'); reabrir(); }); },
    }); });
    m.querySelectorAll('[data-csx]').forEach((el) => { el.onclick = () => intentar(() => A.editarItemSalud(el.dataset.csx, { estado: 'cancelado', motivo: 'Quitado por el veterinario' }), () => { toast('Quitado del calendario'); reabrir(); }); });
  }

  Object.assign(window.Views, { recordatorios, recordatorioDetalle: detalle, consentimientoForm, estadoConsentimiento, calendarioSaludHtml: calendarioHtml, bindCalendarioSalud: bindCalendario });
})();

/* Estado de la demo: persistido en localStorage, con IA simulada y métricas derivadas. */
(function () {
  const KEY = 'arcionpet-demo';
  let S;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === SEED.version) return parsed;
      }
    } catch (e) { /* sin storage: usamos la semilla */ }
    return clone(SEED);
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignorado */ }
    listeners.forEach((fn) => fn());
  }
  const listeners = [];
  S = load();

  let seq = Date.now() % 100000;
  const uid = (p) => p + (++seq).toString(36);

  /* ---------- Fechas ---------- */
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const isToday = (iso) => daysBetween(iso, new Date()) === 0;

  /* ---------- Lookups ---------- */
  const byId = (list, id) => S[list].find((x) => x.id === id);
  const paciente = (id) => byId('pacientes', id);
  const tutor = (id) => byId('tutores', id);
  const estudio = (id) => byId('estudios', id);
  const informeDeEstudio = (eid) => S.informes.find((i) => i.estudioId === eid);

  function edad(nac) {
    const n = new Date(nac), h = new Date();
    let m = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
    if (h.getDate() < n.getDate()) m--;
    const y = Math.floor(m / 12), r = m % 12;
    if (y === 0) return r + (r === 1 ? ' mes' : ' meses');
    if (r === 0) return y + (y === 1 ? ' año' : ' años');
    return y + (y === 1 ? ' año' : ' años') + ' y ' + r + (r === 1 ? ' mes' : ' meses');
  }

  /* ---------- Resultado de la CNN ----------
     confianza = probabilidad de hallazgo patológico estimada por la red (1 − P(normal)), en %.
     < 40 Normal · 40–69 Incierto · ≥ 70 Patológico (ver CNN.interpretar) */
  function nivelConfianza(e) {
    const d = Math.abs(e.confianza - 50); // distancia al punto de máxima duda
    return d >= 35 ? 'alta' : d >= 20 ? 'media' : 'baja';
  }

  const RES_LABEL = { normal: 'Normal', incierto: 'Incierto', patologico: 'Patológico' };

  function borradorInforme(e) {
    const p = paciente(e.pacienteId) || {};
    const hall = e.hallazgos && e.hallazgos.length ? e.hallazgos : [];
    const zona = e.tipo === 'Tórax' ? 'tórax' : 'miembro';
    let descripcion, conclusion, sugerencia;
    if (e.resultado === 'normal') {
      descripcion = e.tipo === 'Tórax'
        ? 'Silueta cardíaca de tamaño y forma conservados. Campos pulmonares con patrón y radiolucidez dentro de parámetros normales. Tráquea de diámetro y trayecto normales. Sin evidencia de efusión pleural.'
        : 'Estructuras óseas con densidad y corticales conservadas. Superficies articulares congruentes. Sin evidencia de líneas de fractura ni reacción perióstica.';
      conclusion = 'Estudio radiológico de ' + zona + ' sin hallazgos significativos.';
      sugerencia = 'Correlacionar con la clínica. Control según evolución.';
    } else {
      descripcion = 'Se observa: ' + hall.map((h) => h.toLowerCase()).join('; ') + '. ' +
        (e.tipo === 'Tórax'
          ? 'Resto de las estructuras torácicas evaluables sin particularidades.'
          : 'Resto de las estructuras óseas evaluables sin particularidades.');
      conclusion = (e.resultado === 'incierto' ? 'Hallazgo de significado incierto compatible con: ' : 'Hallazgos compatibles con: ') + hall.join(', ') + '.';
      sugerencia = e.resultado === 'incierto'
        ? 'Se sugiere segunda lectura por especialista (derivación) y/o proyecciones complementarias.'
        : 'Se sugiere correlación clínica y estudios complementarios según criterio del profesional.';
    }
    return [
      'INFORME RADIOLÓGICO — ' + e.tipo.toUpperCase() + (e.proyeccion ? ' (' + e.proyeccion + ')' : ''),
      '',
      'Paciente: ' + p.nombre + ' · ' + p.especie + ' · ' + p.raza + ' · ' + edad(p.nacimiento),
      'Motivo de consulta: ' + e.motivo,
      '',
      'DESCRIPCIÓN',
      descripcion,
      '',
      'CONCLUSIÓN',
      conclusion,
      '',
      'SUGERENCIAS',
      sugerencia,
      '',
      'Resultado IA: ' + RES_LABEL[e.resultado] + ' (' + e.confianza + '% probabilidad de patología). Borrador generado automáticamente: requiere revisión y firma del médico veterinario.',
    ].join('\n');
  }

  /* ---------- Derivados ---------- */
  function triage() {
    const rows = S.estudios
      .filter((e) => e.resultado)
      .map((e) => {
        const inf = informeDeEstudio(e.id);
        return { e, inf, espera: daysBetween(e.fecha, new Date()), prioridad: e.resultado === 'normal' ? 'revisar' : 'urgente' };
      })
      .filter((r) => !(r.inf && r.inf.estado === 'firmado'));
    rows.sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'urgente' ? -1 : 1) ||
      (b.e.resultado === 'patologico') - (a.e.resultado === 'patologico') || b.espera - a.espera || b.e.confianza - a.e.confianza);
    return rows;
  }

  function hemoAlertas() {
    return S.hemo.filter((u) => (u.estado === 'disponible' || u.estado === 'reservada') && daysBetween(new Date(), u.vence) <= 7 && daysBetween(new Date(), u.vence) >= 0);
  }

  function notificaciones() {
    const n = [];
    S.turnos.filter((t) => t.estado === 'pendiente').forEach((t) => {
      const p = paciente(t.pacienteId);
      n.push({ id: 'n-' + t.id, ic: 'globe', t: 'Pedido de turno desde el Portal Cliente', s: p.nombre + ' · ' + t.tipo, go: '#/turnos' });
    });
    S.derivaciones.filter((d) => d.estado === 'respondida' && !d.vista).forEach((d) => {
      const e = estudio(d.estudioId), p = paciente(e.pacienteId);
      n.push({ id: 'n-' + d.id, ic: 'stetho', t: 'Derivación respondida', s: p.nombre + ' · ' + (d.a || 'Especialista'), go: '#/derivaciones' });
    });
    S.interconsultas.filter((i) => i.noLeida).forEach((i) => {
      n.push({ id: 'n-' + i.id, ic: 'chat', t: 'Nueva respuesta en interconsulta', s: i.asunto, go: '#/interconsultas/' + i.id });
    });
    hemoAlertas().forEach((u) => {
      const d = daysBetween(new Date(), u.vence);
      n.push({ id: 'n-' + u.id, ic: 'drop', t: 'Hemocomponente por vencer', s: u.id + ' · ' + u.comp + ' · ' + (d === 0 ? 'vence hoy' : 'vence en ' + d + ' d'), go: '#/hemocomponentes' });
    });
    return n;
  }

  function qaStats() {
    const ev = S.evaluaciones;
    const coinc = ev.filter((q) => q.veredicto === 'coincide').length;
    return { total: ev.length, coinciden: coinc, discrepancias: ev.length - coinc, pct: ev.length ? Math.round(coinc / ev.length * 100) : 0 };
  }

  /* ---------- Mutaciones ---------- */
  const A = {
    reset() { S = clone(SEED); save(); },
    addPaciente(p, t) {
      if (t) { t.id = uid('t'); S.tutores.push(t); p.tutorId = t.id; }
      p.id = uid('p'); S.pacientes.push(p); save(); return p;
    },
    updatePaciente(id, data) { Object.assign(paciente(id), data); save(); },
    deletePaciente(id) {
      S.pacientes = S.pacientes.filter((p) => p.id !== id);
      const eids = S.estudios.filter((e) => e.pacienteId === id).map((e) => e.id);
      S.estudios = S.estudios.filter((e) => e.pacienteId !== id);
      S.informes = S.informes.filter((i) => !eids.includes(i.estudioId));
      S.derivaciones = S.derivaciones.filter((d) => !eids.includes(d.estudioId));
      S.turnos = S.turnos.filter((t) => t.pacienteId !== id);
      save();
    },
    importarDeRed(rid) {
      const r = S.redPacientes.find((x) => x.id === rid);
      let t = S.tutores.find((x) => x.doc === r.tutor.doc);
      if (!t) { t = Object.assign({ id: uid('t'), tel: '', email: '' }, r.tutor); S.tutores.push(t); }
      const p = { id: uid('p'), nombre: r.nombre, especie: r.especie, raza: r.raza, nacimiento: r.nacimiento, sexo: r.sexo, peso: r.peso, tutorId: t.id, origen: 'red' };
      S.pacientes.push(p);
      S.redPacientes = S.redPacientes.filter((x) => x.id !== rid);
      save(); return p;
    },
    addTutor(t) { t.id = uid('t'); S.tutores.push(t); save(); return t; },
    addTurno(t) { t.id = uid('tu'); S.turnos.push(t); save(); return t; },
    setTurno(id, estado) { byId('turnos', id).estado = estado; save(); },
    addEstudio(e) { e.id = uid('e'); e.resultado = null; e.confianza = null; e.hallazgos = []; e.derivado = false; S.estudios.push(e); save(); return e; },
    /* res = { resultado, confianza, hallazgos, probs, modelo } calculado por la CNN */
    aplicarAnalisis(id, res) {
      const e = estudio(id);
      if (!e) return null;
      Object.assign(e, res, { analizadoEn: new Date().toISOString() });
      const inf = informeDeEstudio(id);
      if (inf && inf.estado === 'borrador' && !inf.texto) inf.nivel = nivelConfianza(e);
      save(); return e;
    },
    deleteEstudio(id) {
      S.estudios = S.estudios.filter((e) => e.id !== id);
      S.informes = S.informes.filter((i) => i.estudioId !== id);
      S.derivaciones = S.derivaciones.filter((d) => d.estudioId !== id);
      save();
    },
    generarInforme(eid) {
      const e = estudio(eid);
      let inf = informeDeEstudio(eid);
      if (inf && inf.estado === 'firmado') return inf;
      if (!inf) { inf = { id: uid('i'), estudioId: eid }; S.informes.push(inf); }
      Object.assign(inf, { fecha: new Date().toISOString(), estado: 'borrador', nivel: nivelConfianza(e), texto: borradorInforme(e) });
      save(); return inf;
    },
    guardarTexto(iid, texto) { byId('informes', iid).texto = texto; save(); },
    firmarInforme(iid, { texto, veredicto, correccion }) {
      const inf = byId('informes', iid), e = estudio(inf.estudioId);
      Object.assign(inf, { texto, estado: 'firmado', firmadoPor: S.usuario.completo, fechaFirma: new Date().toISOString() });
      S.evaluaciones.push({ id: uid('q'), estudioId: e.id, fecha: new Date().toISOString(), ia: e.resultado, veredicto, correccion: correccion || null, vet: S.usuario.completo });
      save(); return inf;
    },
    deleteInforme(id) { S.informes = S.informes.filter((i) => i.id !== id); save(); },
    derivar(eid, motivo) {
      const e = estudio(eid); e.derivado = true;
      const d = { id: uid('d'), estudioId: eid, fecha: new Date().toISOString(), motivo, de: S.usuario.completo, a: null, estado: 'pendiente', respuesta: null };
      S.derivaciones.push(d); save(); return d;
    },
    responderDerivacion(id, a, respuesta) { Object.assign(byId('derivaciones', id), { a, respuesta, estado: 'respondida', fechaRespuesta: new Date().toISOString(), vista: false }); save(); },
    verDerivacion(id) { const d = byId('derivaciones', id); if (d && !d.vista) { d.vista = true; save(); } },
    nuevaInterconsulta({ asunto, pacienteId, urgente, texto }) {
      if (S.pack.usadas >= S.pack.total) return null;
      S.pack.usadas++;
      const now = new Date().toISOString();
      const ic = { id: uid('ic'), asunto, pacienteId, urgente, estado: 'cola', soporte: null, actualizada: now, mensajes: [{ de: S.usuario.completo, rol: 'me', fecha: now, texto }] };
      S.interconsultas.unshift(ic); save(); return ic;
    },
    mensajeInterconsulta(id, texto, rol, de) {
      const ic = byId('interconsultas', id), now = new Date().toISOString();
      ic.mensajes.push({ de: de || S.usuario.completo, rol: rol || 'me', fecha: now, texto });
      ic.actualizada = now;
      if (rol === 'support') { ic.estado = 'curso'; ic.soporte = de; ic.noLeida = true; }
      save();
    },
    leerInterconsulta(id) { const ic = byId('interconsultas', id); if (ic && ic.noLeida) { ic.noLeida = false; save(); } },
    cerrarInterconsulta(id) { byId('interconsultas', id).estado = 'cerrada'; save(); },
    hemoEvento(id, tipo, texto, cambios) {
      const u = byId('hemo', id);
      Object.assign(u, cambios || {});
      u.eventos.push({ fecha: new Date().toISOString(), tipo, texto, lugar: u.ubicacion });
      save(); return u;
    },
  };

  window.Store = {
    get s() { return S; }, save, on: (fn) => listeners.push(fn), uid,
    paciente, tutor, estudio, informeDeEstudio, edad, daysBetween, isToday, nivelConfianza, borradorInforme,
    triage, notificaciones, qaStats, hemoAlertas, RES_LABEL, A,
  };
})();

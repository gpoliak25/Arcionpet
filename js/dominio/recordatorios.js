/* Recordatorios automáticos a tutores: vacunas, antiparasitarios, controles, peluquería y turnos.
   Funciones puras: planificación (qué avisos tienen que existir), cancelación de los que ya no corresponden,
   procesamiento de la cola con reintentos y armado del mensaje. El planificador es idempotente: cada aviso tiene una
   clave única y nunca se envía dos veces. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { recordatorios: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const HORA = 3600000, DIA = 24 * HORA, MIN = 60000;
  const CANALES = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' };
  const ESTADOS = { programado: 'Programado', enviado: 'Enviado', entregado: 'Entregado', fallo: 'Falló', cancelado: 'Cancelado', omitido: 'Omitido' };
  const TIPOS = { vacuna: 'Vacuna', antiparasitario: 'Antiparasitario', control: 'Control', peluqueria: 'Peluquería', turno: 'Turno' };
  const DEFECTO = {
    anticipacionDias: [15, 7, 1],
    turnoHoras: [48, 2],
    canales: { email: true, whatsapp: false, sms: false },
    whatsappPlantillasAprobadas: false, // WhatsApp Business exige plantillas aprobadas: hasta entonces no se usa
    horario: { desde: '09:00', hasta: '20:00' },
    reintentos: { max: 3, esperaMin: 30 },
    urlPortal: 'https://portal.example.com/arcionpet',
    plantillas: {
      vacuna: 'Hola, {tutor}. A {mascota} le toca {item} el {fecha}. ¿Le sacamos turno? Pedilo acá: {enlace}',
      antiparasitario: 'Hola, {tutor}. A {mascota} le toca la próxima dosis de {item} el {fecha}. Si querés, sacá turno acá: {enlace}',
      control: 'Hola, {tutor}. A {mascota} le toca el control indicado ({item}) el {fecha}. Sacá turno acá: {enlace}',
      peluqueria: 'Hola, {tutor}. Ya es momento del próximo {item} de {mascota} (sugerido para el {fecha}). Reservá acá: {enlace}',
      turno: 'Hola, {tutor}. Te recordamos el turno de {mascota}: {item} el {fecha} a las {hora}. Confirmá, reprogramá o cancelá acá: {enlace}',
    },
  };
  const config = (c) => Object.assign({}, DEFECTO, c || {}, { plantillas: Object.assign({}, DEFECTO.plantillas, (c || {}).plantillas), canales: Object.assign({}, DEFECTO.canales, (c || {}).canales), horario: Object.assign({}, DEFECTO.horario, (c || {}).horario), reintentos: Object.assign({}, DEFECTO.reintentos, (c || {}).reintentos) });

  function validarConfig(c) {
    const e = [], x = config(c);
    if (!x.anticipacionDias.length || x.anticipacionDias.some((d) => !(Number.isInteger(d) && d >= 0 && d <= 60))) e.push('La anticipación debe ser de 0 a 60 días');
    if (!x.turnoHoras.length || x.turnoHoras.some((h) => !(Number.isInteger(h) && h >= 1 && h <= 168))) e.push('Los avisos de turno deben ser de 1 a 168 horas antes');
    if (!/^\d{2}:\d{2}$/.test(x.horario.desde) || !/^\d{2}:\d{2}$/.test(x.horario.hasta) || x.horario.desde >= x.horario.hasta) e.push('El horario de envío no es válido');
    if (!(Number.isInteger(x.reintentos.max) && x.reintentos.max >= 0 && x.reintentos.max <= 10)) e.push('Los reintentos deben ser de 0 a 10');
    if (!Object.values(x.canales).some(Boolean)) e.push('Activá al menos un canal');
    Object.entries(x.plantillas).forEach(([k, p]) => { if (!String(p).includes('{mascota}')) e.push('La plantilla de ' + TIPOS[k].toLowerCase() + ' tiene que nombrar a la mascota ({mascota})'); });
    return e;
  }

  /* Canales que se pueden usar con este tutor: los que activó la clínica (WhatsApp solo con plantillas aprobadas),
     los que el tutor autorizó y para los que hay dato de contacto. */
  function canales(tutor, cfg) {
    const c = config(cfg), r = tutor.recordatorios || {};
    if (!r.consentimiento || r.baja) return [];
    return (r.canales || ['email']).filter((k) => c.canales[k] && (k !== 'whatsapp' || c.whatsappPlantillasAprobadas) && (k === 'email' ? !!tutor.email : !!tutor.tel));
  }

  /* Lleva un horario de envío al horario permitido (si cae de noche, sale a la mañana siguiente o antes, el mismo día). */
  function enHorario(fecha, cfg) {
    const c = config(cfg), d = new Date(fecha);
    const [dh, dm] = c.horario.desde.split(':').map(Number), [hh, hm] = c.horario.hasta.split(':').map(Number);
    const min = d.getHours() * 60 + d.getMinutes();
    if (min < dh * 60 + dm) d.setHours(dh, dm, 0, 0);
    else if (min > hh * 60 + hm) { d.setDate(d.getDate() + 1); d.setHours(dh, dm, 0, 0); }
    return d;
  }
  const dentroDeHorario = (fecha, cfg) => enHorario(fecha, cfg).getTime() === new Date(fecha).getTime();

  const TIPO_ITEM = (it) => (it.categoria === 'Vacunas' ? 'vacuna' : it.categoria === 'Antiparasitarios' ? 'antiparasitario' : it.categoria === 'Peluquería' ? 'peluqueria' : 'control');
  /* ¿El tutor ya sacó turno para esto? (un turno activo del servicio que corresponde, desde hoy hasta 30 días después de la fecha) */
  function yaAgendado(it, ctx) {
    const tipo = TIPO_ITEM(it), hasta = new Date(it.fecha + 'T23:59:59').getTime() + 30 * DIA;
    const desdeHoy = new Date(new Date(ctx.ahora).setHours(0, 0, 0, 0)).getTime(); // un turno de días anteriores no cuenta
    const SERV = { vacuna: ['vacunacion'], antiparasitario: ['desparasitacion', 'vacunacion'], control: ['control', 'consulta', 'control_cardiologico'] };
    const lista = tipo === 'peluqueria' ? (ctx.pelTurnos || []).filter((t) => t.servicioId === it.servicioId) : (ctx.turnos || []).filter((t) => (SERV[tipo] || []).includes(t.servicioId));
    return lista.some((t) => t.pacienteId === it.pacienteId && ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.fecha).getTime() >= desdeHoy && new Date(t.fecha).getTime() <= hasta);
  }

  /* Avisos que tienen que existir hoy. ctx = { pacientes, tutores, calendario, turnos, pelTurnos, config, ahora }.
     Cada aviso: { clave, tipo, pacienteId, tutorId, refId, objetivo, envioEn, canales, item }. */
  function planificar(ctx) {
    const c = config(ctx.config), ahora = new Date(ctx.ahora).getTime();
    const pac = (id) => (ctx.pacientes || []).find((p) => p.id === id), tut = (id) => (ctx.tutores || []).find((t) => t.id === id);
    const avisos = [];
    const agregar = (base, offsetsMs, objetivo, etiqueta) => {
      const p = pac(base.pacienteId);
      if (!p || p.activo === false || p.fallecido) return;
      const t = tut(p.tutorId);
      if (!t || t.activo === false) return;
      const ch = canales(t, c);
      if (!ch.length) return;
      // de los avisos que ya debieron salir, solo se manda el más cercano a la fecha (no se acumulan)
      const cands = offsetsMs.map((o) => ({ o, en: objetivo - o })).sort((a, b) => a.en - b.en);
      const vencidos = cands.filter((x) => x.en <= ahora && objetivo > ahora);
      const ultimoVencido = vencidos.length ? vencidos[vencidos.length - 1] : null;
      cands.forEach((x) => {
        if (objetivo <= ahora) return;
        if (x.en <= ahora && x !== ultimoVencido) return;
        avisos.push(Object.assign({}, base, { clave: base.refTipo + ':' + base.refId + ':' + new Date(objetivo).toISOString().slice(0, 16) + ':' + etiqueta(x.o), tutorId: t.id, objetivo: new Date(objetivo).toISOString(), envioEn: enHorario(Math.max(x.en, ahora), c).toISOString(), canales: ch, anticipacion: etiqueta(x.o) }));
      });
    };
    (ctx.calendario || []).filter((it) => it.estado === 'pendiente' && !yaAgendado(it, ctx)).forEach((it) => {
      const objetivo = new Date(it.fecha + 'T10:00:00').getTime();
      agregar({ tipo: TIPO_ITEM(it), refTipo: 'cs', refId: it.id, pacienteId: it.pacienteId, item: it.nombre }, c.anticipacionDias.map((d) => d * DIA), objetivo, (o) => Math.round(o / DIA) + 'd');
    });
    (ctx.turnos || []).concat((ctx.pelTurnos || []).map((t) => Object.assign({ peluqueria: true }, t))).filter((t) => t.estado === 'confirmado').forEach((t) => {
      agregar({ tipo: 'turno', refTipo: t.peluqueria ? 'pt' : 'tu', refId: t.id, pacienteId: t.pacienteId, item: (t.peluqueria ? 'peluquería: ' : '') + t.tipo }, c.turnoHoras.map((h) => h * HORA), new Date(t.fecha).getTime(), (o) => Math.round(o / HORA) + 'h');
    });
    return avisos;
  }

  /* Sincroniza la cola con lo planificado: agrega lo nuevo (sin duplicar claves) y cancela lo programado que ya no
     corresponde (se aplicó antes, sacó turno, se dio de baja, el paciente está inactivo, el turno cambió). */
  function sincronizar(cola, planificados, ahora) {
    const claves = new Set(planificados.map((a) => a.clave));
    const existentes = new Set((cola || []).map((r) => r.clave));
    const nueva = (cola || []).map((r) => (r.estado === 'programado' && !claves.has(r.clave) ? Object.assign({}, r, { estado: 'cancelado', cancelado: ahora, motivo: 'Ya no corresponde (se aplicó, sacó turno, se dio de baja o cambió la fecha)' }) : r));
    planificados.filter((a) => !existentes.has(a.clave)).forEach((a) => nueva.push(Object.assign({}, a, { id: 'rc-' + a.clave, estado: 'programado', intentos: 0, creado: ahora, historial: [] })));
    return nueva;
  }

  /* Procesa la cola: envía lo que está en fecha y en horario, con reintentos espaciados. Tolerante a fallos: un error
     en un aviso no frena al resto. enviar(aviso, canal) devuelve { ok, entregado, error }. */
  function procesar(cola, ahora, cfg, enviar) {
    const c = config(cfg), t = new Date(ahora).getTime();
    return (cola || []).map((r) => {
      if (r.estado !== 'programado') return r;
      const cuando = new Date(r.proximoIntento || r.envioEn).getTime();
      if (cuando > t || !dentroDeHorario(ahora, c)) return r;
      if (new Date(r.objetivo).getTime() <= t) return Object.assign({}, r, { estado: 'omitido', motivo: 'Llegó la fecha antes de poder enviarlo' });
      const canal = r.canales[0];
      let res;
      try { res = enviar(r, canal) || { ok: false, error: 'Sin respuesta del canal' }; } catch (e) { res = { ok: false, error: e.message }; }
      // sin canal configurado no es un intento fallido: queda en cola con el motivo, sin sumar historial en cada pasada
      if (res.sinCanal) return r.error === res.error ? r : Object.assign({}, r, { error: res.error });
      const intentos = (r.intentos || 0) + 1;
      const hist = (r.historial || []).concat([{ fecha: new Date(ahora).toISOString(), canal, ok: !!res.ok, error: res.error || null }]);
      if (res.ok) return Object.assign({}, r, { estado: res.entregado ? 'entregado' : 'enviado', enviado: new Date(ahora).toISOString(), canal, intentos, historial: hist, proximoIntento: null });
      if (intentos > c.reintentos.max) return Object.assign({}, r, { estado: 'fallo', intentos, historial: hist, error: res.error });
      // otro canal autorizado, si lo hay; si no, se reintenta más tarde con espera creciente
      const otros = r.canales.slice(1).concat([canal]);
      return Object.assign({}, r, { intentos, historial: hist, error: res.error, canales: otros, proximoIntento: new Date(t + c.reintentos.esperaMin * MIN * Math.pow(2, intentos - 1)).toISOString() });
    });
  }

  const fmtFecha = (iso) => { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
  const fmtHora = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  /* Mensaje con los datos de la clínica, el enlace al portal y la forma de darse de baja. */
  function mensaje(r, ctx) {
    const c = config(ctx.config);
    const enlace = c.urlPortal + (r.tipo === 'turno' ? '/turno/' + r.refId : '/pedir-turno?mascota=' + r.pacienteId);
    const txt = c.plantillas[r.tipo].replace(/\{tutor\}/g, ctx.tutor.nombre).replace(/\{mascota\}/g, ctx.paciente.nombre).replace(/\{item\}/g, r.item).replace(/\{fecha\}/g, fmtFecha(r.objetivo)).replace(/\{hora\}/g, fmtHora(r.objetivo)).replace(/\{enlace\}/g, enlace);
    return txt + '\n' + [ctx.clinica.nombre, ctx.clinica.telefono, ctx.clinica.domicilio].filter(Boolean).join(' · ') + '\nPara no recibir más avisos: ' + c.urlPortal + '/baja?tutor=' + ctx.tutor.id;
  }

  /* Seguimiento: estados de la cola y tasa de turnos concretados después de un aviso de vacuna, antiparasitario,
     control o peluquería (un turno de ese paciente creado después del aviso y antes de 30 días de la fecha). */
  function seguimiento(cola, turnos, pelTurnos, r) {
    const en = (f) => !r || ((!r.desde || new Date(f) >= r.desde) && new Date(f) < r.hasta);
    const lista = (cola || []).filter((x) => en(x.creado));
    const porEstado = {};
    lista.forEach((x) => { porEstado[x.estado] = (porEstado[x.estado] || 0) + 1; });
    const salud = lista.filter((x) => x.tipo !== 'turno' && ['enviado', 'entregado'].includes(x.estado));
    const todos = (turnos || []).concat(pelTurnos || []);
    const conc = salud.filter((x) => todos.some((t) => t.pacienteId === x.pacienteId && t.creado && new Date(t.creado) >= new Date(x.enviado) && new Date(t.fecha).getTime() <= new Date(x.objetivo).getTime() + 30 * DIA));
    return { total: lista.length, porEstado, avisosSalud: salud.length, concretados: conc.length, tasa: salud.length ? Math.round(conc.length / salud.length * 100) : 0 };
  }

  /* Próxima dosis según el esquema: en cachorros y gatitos (menos de 4 meses) la serie inicial de vacunas se repite a los 21 días. */
  function intervaloDosis(producto, paciente, fecha) {
    if (!producto.intervaloDias) return null;
    if (producto.categoria === 'Vacunas' && paciente && paciente.nacimiento && (new Date(fecha) - new Date(paciente.nacimiento)) < 120 * DIA) return 21;
    return producto.intervaloDias;
  }

  return { CANALES, ESTADOS, TIPOS, DEFECTO, config, validarConfig, canales, enHorario, dentroDeHorario, yaAgendado, planificar, sincronizar, procesar, mensaje, seguimiento, intervaloDosis };
});

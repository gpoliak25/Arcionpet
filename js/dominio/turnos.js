/* Turnos: agenda por recurso (profesional, sala, equipo), servicios con duración y detección de conflictos. Funciones puras.
   La misma lógica sirve para cualquier agenda con recursos (la de peluquería usa peluqueros como recurso). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { turnos: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  class ErrorTurno extends Error {}
  const MIN = 60000;
  const TIPOS_RECURSO = { profesional: 'Profesional', sala: 'Sala', equipo: 'Equipo' };
  const ESTADOS = { pendiente: 'Pedido del portal', confirmado: 'Confirmado', atendido: 'Atendido', no_vino: 'No vino', cancelado: 'Cancelado' };
  // estados que ocupan la agenda
  const OCUPA = ['pendiente', 'confirmado'];
  const TRANSICIONES = { pendiente: ['confirmado', 'cancelado'], confirmado: ['atendido', 'no_vino', 'cancelado'], atendido: [], no_vino: [], cancelado: [] };
  const AGENDA_DEFECTO = { inicio: '09:00', fin: '19:00', intervalo: 15 };

  const inicio = (t) => new Date(t.fecha).getTime();
  const fin = (t) => inicio(t) + (t.duracion || 30) * MIN;
  const seSuperponen = (a, b) => inicio(a) < fin(b) && inicio(b) < fin(a);
  const minutos = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

  /* Turnos activos que comparten algún recurso con el turno y se superponen en el tiempo. */
  function conflictos(turno, turnos) {
    const rs = turno.recursos || [];
    return (turnos || []).filter((o) => o.id !== turno.id && OCUPA.includes(o.estado) && (o.recursos || []).some((r) => rs.includes(r)) && seSuperponen(turno, o));
  }

  /* El paciente no puede tener dos turnos al mismo tiempo, aunque sean con recursos distintos. */
  const solapaPaciente = (turno, turnos) => (turnos || []).find((o) => o.id !== turno.id && OCUPA.includes(o.estado) && o.pacienteId === turno.pacienteId && seSuperponen(turno, o)) || null;

  /* Valida un turno. ctx = { turnos, recursos, servicios, pacientes, agenda, ahora }. */
  function validar(turno, ctx) {
    const e = [];
    const pac = (ctx.pacientes || []).find((p) => p.id === turno.pacienteId);
    if (!pac) e.push('Elegí el paciente');
    else if (pac.activo === false) e.push('El paciente está dado de baja');
    const sv = (ctx.servicios || []).find((s) => s.id === turno.servicioId);
    if (!sv) e.push('Elegí el servicio');
    const t0 = new Date(turno.fecha);
    if (isNaN(t0)) { e.push('Fecha u hora inválida'); return e; }
    if (ctx.ahora && t0 < new Date(ctx.ahora) && !turno.id) e.push('El turno no puede quedar en el pasado');
    if (!(Number.isInteger(turno.duracion) && turno.duracion >= 5 && turno.duracion <= 480)) e.push('La duración debe ser de 5 a 480 minutos');
    const ag = ctx.agenda || AGENDA_DEFECTO;
    const ini = t0.getHours() * 60 + t0.getMinutes();
    if (ini < minutos(ag.inicio) || ini + (turno.duracion || 0) > minutos(ag.fin)) e.push('El turno queda fuera del horario de atención (' + ag.inicio + ' a ' + ag.fin + ')');
    const recs = (turno.recursos || []).map((id) => (ctx.recursos || []).find((r) => r.id === id));
    if (recs.some((r) => !r)) e.push('Recurso inexistente');
    if (recs.some((r) => r && r.activo === false)) e.push('Hay un recurso dado de baja');
    if (sv) (sv.requiere || []).forEach((tipo) => { if (!recs.some((r) => r && r.tipo === tipo)) e.push(sv.nombre + ' necesita ' + ({ profesional: 'un profesional', sala: 'una sala', equipo: 'un equipo' })[tipo] || tipo); });
    if (e.length) return e;
    const c = conflictos(turno, ctx.turnos);
    if (c.length) {
      const comp = recs.filter((r) => c.some((o) => o.recursos.includes(r.id)));
      e.push('Conflicto de agenda: ' + comp.map((r) => r.nombre).join(', ') + ' ya ' + (comp.length > 1 ? 'tienen' : 'tiene') + ' un turno a esa hora');
    }
    const sp = solapaPaciente(turno, ctx.turnos);
    if (sp) e.push('El paciente ya tiene un turno a esa hora');
    return e;
  }

  function cambiarEstado(turno, estado, extra) {
    if (!(TRANSICIONES[turno.estado] || []).includes(estado)) throw new ErrorTurno('Un turno ' + (ESTADOS[turno.estado] || turno.estado).toLowerCase() + ' no puede pasar a ' + (ESTADOS[estado] || estado).toLowerCase());
    return Object.assign({}, turno, { estado }, extra || {});
  }

  /* Reprograma: valida el nuevo horario y deja el anterior en el historial. */
  function reprogramar(turno, nuevaFecha, ctx, quien) {
    if (!OCUPA.includes(turno.estado)) throw new ErrorTurno('Solo se reprograman turnos pendientes o confirmados');
    const nuevo = Object.assign({}, turno, { fecha: nuevaFecha, historial: (turno.historial || []).concat([{ fecha: ctx.ahora, accion: 'reprogramado', desde: turno.fecha, hacia: nuevaFecha, por: quien || null }]) });
    const e = validar(Object.assign({}, nuevo, { id: turno.id }), Object.assign({}, ctx, { ahora: null }));
    if (new Date(nuevaFecha) < new Date(ctx.ahora)) e.unshift('El turno no puede quedar en el pasado');
    if (e.length) throw new ErrorTurno(e[0]);
    return nuevo;
  }

  /* Horarios libres de un día para un servicio con los recursos elegidos (para el portal y las sugerencias). */
  function horariosLibres(dia, base, ctx, cantidad) {
    const ag = ctx.agenda || AGENDA_DEFECTO;
    const d = new Date(dia); d.setHours(0, 0, 0, 0);
    const libres = [];
    for (let m = minutos(ag.inicio); m + base.duracion <= minutos(ag.fin); m += ag.intervalo) {
      const f = new Date(d.getTime() + m * MIN);
      if (ctx.ahora && f < new Date(ctx.ahora)) continue;
      const t = Object.assign({}, base, { fecha: f.toISOString() });
      if (!conflictos(t, ctx.turnos).length && !solapaPaciente(t, ctx.turnos)) libres.push(t.fecha);
      if (cantidad && libres.length >= cantidad) break;
    }
    return libres;
  }

  /* Al cargar un estudio, el turno de ese paciente para ese día con un servicio de imágenes se cierra solo. */
  function turnoDelEstudio(turnos, servicios, estudio) {
    const dia = new Date(estudio.fecha).toDateString();
    const conEstudio = (servicios || []).filter((s) => s.estudio).map((s) => s.id);
    return (turnos || []).filter((t) => t.pacienteId === estudio.pacienteId && t.estado === 'confirmado' && conEstudio.includes(t.servicioId) && new Date(t.fecha).toDateString() === dia)
      .sort((a, b) => Math.abs(inicio(a) - new Date(estudio.fecha)) - Math.abs(inicio(b) - new Date(estudio.fecha)))[0] || null;
  }

  /* Ocupación de cada recurso en un día: minutos con turnos activos sobre los minutos de atención. */
  function ocupacion(turnos, recursos, dia, agenda) {
    const ag = agenda || AGENDA_DEFECTO, total = minutos(ag.fin) - minutos(ag.inicio);
    const ds = new Date(dia).toDateString();
    const r = {};
    (recursos || []).forEach((rc) => {
      const min = (turnos || []).filter((t) => OCUPA.concat(['atendido']).includes(t.estado) && (t.recursos || []).includes(rc.id) && new Date(t.fecha).toDateString() === ds).reduce((s, t) => s + (t.duracion || 30), 0);
      r[rc.id] = Math.round(min / total * 100);
    });
    return r;
  }

  return { ErrorTurno, TIPOS_RECURSO, ESTADOS, OCUPA, TRANSICIONES, AGENDA_DEFECTO, inicio, fin, seSuperponen, conflictos, validar, cambiarEstado, reprogramar, horariosLibres, turnoDelEstudio, ocupacion };
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/dominio/turnos.js');
const M = require('../js/dominio/migraciones.js');
const V = require('../js/dominio/ventas.js');
global.window = global;
require('../js/data.js');

const hora = (h, m, dia) => { const d = new Date(2026, 9, dia || 20, h, m || 0); return d.toISOString(); };
const RECURSOS = [
  { id: 'r-vet', tipo: 'profesional', nombre: 'Dra. A' }, { id: 'r-vet2', tipo: 'profesional', nombre: 'Dr. B' },
  { id: 'r-cons1', tipo: 'sala', nombre: 'Consultorio 1' }, { id: 'r-rx', tipo: 'equipo', nombre: 'Rayos X' },
];
const SERVICIOS = [
  { id: 'consulta', nombre: 'Consulta general', duracion: 30, precio: 25000, requiere: ['profesional', 'sala'] },
  { id: 'radiografia', nombre: 'Radiografía', duracion: 30, precio: 45000, requiere: ['profesional', 'equipo'], estudio: true },
];
const PACIENTES = [{ id: 'p1', tutorId: 't1' }, { id: 'p2', tutorId: 't1' }, { id: 'p3', tutorId: 't2', activo: false }];
const turno = (x) => Object.assign({ pacienteId: 'p1', servicioId: 'consulta', duracion: 30, recursos: ['r-vet', 'r-cons1'], fecha: hora(10), estado: 'confirmado' }, x);
const ctx = (turnos) => ({ turnos: turnos || [], recursos: RECURSOS, servicios: SERVICIOS, pacientes: PACIENTES, ahora: hora(8, 0, 1) });

test('turno válido sin conflictos', () => {
  assert.deepEqual(T.validar(turno(), ctx()), []);
});

test('detecta conflicto por recurso compartido y superposición', () => {
  const otro = turno({ id: 'x', pacienteId: 'p2', fecha: hora(10, 15) });
  const e = T.validar(turno(), ctx([otro]));
  assert.ok(e[0].startsWith('Conflicto de agenda') && e[0].includes('Dra. A') && e[0].includes('Consultorio 1'), e[0]);
  // consecutivo (10:30) no es conflicto
  assert.deepEqual(T.validar(turno(), ctx([turno({ id: 'x', pacienteId: 'p2', fecha: hora(10, 30) })])), []);
  // otros recursos a la misma hora tampoco
  assert.deepEqual(T.validar(turno(), ctx([turno({ id: 'x', pacienteId: 'p2', recursos: ['r-vet2', 'r-rx'], servicioId: 'radiografia' })])), []);
  // los cancelados no ocupan la agenda
  assert.deepEqual(T.validar(turno(), ctx([turno({ id: 'x', pacienteId: 'p2', estado: 'cancelado' })])), []);
});

test('el paciente no puede tener dos turnos superpuestos', () => {
  const e = T.validar(turno(), ctx([turno({ id: 'x', recursos: ['r-vet2', 'r-rx'], servicioId: 'radiografia' })]));
  assert.ok(e.some((x) => x.includes('paciente ya tiene')));
});

test('servicio exige los tipos de recurso, horario de atención, duración y paciente activo', () => {
  assert.ok(T.validar(turno({ recursos: ['r-vet'] }), ctx()).some((x) => x.includes('necesita una sala')));
  assert.ok(T.validar(turno({ servicioId: 'radiografia', recursos: ['r-vet', 'r-cons1'] }), ctx()).some((x) => x.includes('necesita un equipo')));
  assert.ok(T.validar(turno({ fecha: hora(18, 45) }), ctx()).some((x) => x.includes('horario de atención')));
  assert.ok(T.validar(turno({ duracion: 2 }), ctx()).some((x) => x.includes('duración')));
  assert.ok(T.validar(turno({ pacienteId: 'p3' }), ctx()).some((x) => x.includes('baja')));
  assert.ok(T.validar(turno({ fecha: hora(10, 0, 1) }), Object.assign(ctx(), { ahora: hora(12, 0, 1) })).some((x) => x.includes('pasado')));
});

test('transiciones de estado', () => {
  assert.equal(T.cambiarEstado(turno(), 'atendido').estado, 'atendido');
  assert.equal(T.cambiarEstado(turno({ estado: 'pendiente' }), 'confirmado').estado, 'confirmado');
  assert.throws(() => T.cambiarEstado(turno({ estado: 'cancelado' }), 'atendido'), T.ErrorTurno);
  assert.throws(() => T.cambiarEstado(turno({ estado: 'pendiente' }), 'atendido'), T.ErrorTurno);
});

test('reprogramar valida el nuevo horario y guarda el historial', () => {
  const a = turno({ id: 'a' }), b = turno({ id: 'b', pacienteId: 'p2', fecha: hora(11) });
  const r = T.reprogramar(a, hora(12), ctx([a, b]), 'tutor');
  assert.equal(r.fecha, hora(12));
  assert.equal(r.historial[0].desde, hora(10));
  assert.throws(() => T.reprogramar(a, hora(11), ctx([a, b])), /Conflicto/);
  assert.throws(() => T.reprogramar(turno({ id: 'c', estado: 'atendido' }), hora(12), ctx()), T.ErrorTurno);
});

test('horarios libres respetan la agenda y los turnos tomados', () => {
  const ocupado = turno({ id: 'x', pacienteId: 'p2', fecha: hora(9) });
  const libres = T.horariosLibres(hora(0, 0), { pacienteId: 'p1', duracion: 30, recursos: ['r-vet', 'r-cons1'] }, Object.assign(ctx([ocupado]), { agenda: { inicio: '09:00', fin: '11:00', intervalo: 30 } }));
  assert.deepEqual(libres, [hora(9, 30), hora(10), hora(10, 30)]);
});

test('al cargar un estudio se encuentra el turno de imágenes del día', () => {
  const rx = turno({ id: 'rx', servicioId: 'radiografia', recursos: ['r-vet', 'r-rx'], fecha: hora(15) });
  const cons = turno({ id: 'c', fecha: hora(10) });
  assert.equal(T.turnoDelEstudio([cons, rx], SERVICIOS, { pacienteId: 'p1', fecha: hora(15, 10) }).id, 'rx');
  assert.equal(T.turnoDelEstudio([cons, rx], SERVICIOS, { pacienteId: 'p2', fecha: hora(15, 10) }), null);
  assert.equal(T.turnoDelEstudio([cons, rx], SERVICIOS, { pacienteId: 'p1', fecha: hora(15, 10, 21) }), null);
});

test('venta con líneas de servicio: no mueve stock y suma al total', () => {
  const estado = { tutores: [{ id: 't1', nombre: 'A', apellido: 'B', doc: '1' }], pacientes: [{ id: 'p1', tutorId: 't1' }], productos: [], lotes: [], movimientos: [], declaraciones: [], ventas: [], recetas: [], servicios: SERVICIOS };
  let n = 0;
  const r = V.registrar(estado, { tutorId: 't1', pacienteId: 'p1', medioPago: 'efectivo', items: [], servicios: [{ servicioId: 'consulta', turnoId: 'tu1' }, { servicioId: 'radiografia', precio: 50000, descripcion: 'Radiografía de tórax' }] }, { fecha: hora(10), usuario: 'u', id: (p) => p + ++n });
  assert.equal(r.venta.total, 75000);
  assert.equal(r.venta.items[0].turnoId, 'tu1');
  assert.equal(r.venta.items[1].nombre, 'Radiografía de tórax');
  assert.equal(r.estado.movimientos.length, 0);
  assert.throws(() => V.registrar(estado, { tutorId: 't1', medioPago: 'efectivo', items: [], servicios: [{ servicioId: 'nada' }] }, { fecha: hora(10), usuario: 'u', id: (p) => p + ++n }), /Servicio inexistente/);
});

test('v16: servicios, recursos y turnos sin conflictos; vuelve exacta', () => {
  const v15 = M.migrar(global.SEED, 15), v16 = M.migrar(v15, 16);
  assert.ok(v16.turnos.every((t) => t.servicioId && t.duracion && t.recursos.length));
  assert.ok(v16.turnos.every((t) => !T.conflictos(t, v16.turnos).length), 'la agenda de ejemplo no tiene conflictos');
  assert.ok(v16.servicios.every((s) => s.requiere.every((tipo) => s.recursosDefecto.some((r) => v16.recursos.find((x) => x.id === r).tipo === tipo))), 'los recursos por defecto cubren lo que pide cada servicio');
  assert.deepEqual(M.revertir(v16, 15), v15);
});

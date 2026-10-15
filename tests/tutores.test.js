const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/dominio/tutores.js');

const base = { nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '30.456.789' };
const existentes = [{ id: 't1', nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '30456789' }];

test('un tutor completo es válido', () => {
  assert.deepEqual(T.validar(Object.assign({}, base, { doc: '28.111.222' }), existentes), []);
});

test('exige nombre, apellido y documento', () => {
  const e = T.validar({ tipoDoc: 'DNI' }, []);
  assert.ok(e.includes('Ingresá el nombre') && e.includes('Ingresá el apellido') && e.includes('Ingresá el documento'));
});

test('detecta documento duplicado aunque tenga puntos', () => {
  assert.ok(T.validar(base, existentes).includes('Ya existe un tutor con ese documento'));
});

test('editar al mismo tutor no cuenta como duplicado', () => {
  assert.deepEqual(T.validar(Object.assign({ id: 't1' }, base), existentes), []);
});

test('valida largo de DNI, CUIT y pasaporte', () => {
  assert.ok(T.validar(Object.assign({}, base, { doc: '123' }), []).some((x) => x.includes('DNI')));
  assert.ok(T.validar(Object.assign({}, base, { tipoDoc: 'CUIT', doc: '20-3045678-9' }), []).some((x) => x.includes('CUIT')));
  assert.deepEqual(T.validar(Object.assign({}, base, { tipoDoc: 'CUIT', doc: '20-30456789-1' }), []), []);
  assert.deepEqual(T.validar(Object.assign({}, base, { tipoDoc: 'PAS', doc: 'aa 123456' }), []), []);
});

test('valida email y CUIT opcional', () => {
  assert.ok(T.validar(Object.assign({}, base, { doc: '11222333', email: 'mal@' }), []).includes('El email no es válido'));
  assert.ok(T.validar(Object.assign({}, base, { doc: '11222333', cuit: '123' }), []).includes('El CUIT debe tener 11 dígitos'));
});

const pacientes = [{ id: 'p1', tutorId: 't1', nombre: 'Luna' }, { id: 'p2', tutorId: 't1', nombre: 'Milo' }, { id: 'p3', tutorId: 't2', nombre: 'Rocky' }];
const turnos = [
  { id: 'a', pacienteId: 'p1', fecha: '2026-10-01T10:00:00.000Z', estado: 'atendido' },
  { id: 'b', pacienteId: 'p2', fecha: '2026-10-20T10:00:00.000Z', estado: 'confirmado' },
  { id: 'c', pacienteId: 'p3', fecha: '2026-10-21T10:00:00.000Z', estado: 'confirmado' },
  { id: 'd', pacienteId: 'p1', fecha: '2026-10-25T10:00:00.000Z', estado: 'cancelado' },
];

test('el historial incluye los turnos de todas sus mascotas, del más reciente al más antiguo', () => {
  assert.deepEqual(T.historialTurnos('t1', pacientes, turnos).map((t) => t.id), ['d', 'b', 'a']);
});

test('resumen: próximo turno activo y última visita atendida', () => {
  const r = T.resumen('t1', pacientes, turnos, new Date('2026-10-15T00:00:00.000Z'));
  assert.equal(r.proximo.id, 'b'); // el cancelado no cuenta
  assert.equal(r.ultima.id, 'a');
  assert.equal(r.mascotas, 2);
});

test('compras: total sin anuladas', () => {
  const ventas = [{ tutorId: 't1', fecha: '2026-10-01', total: 1000 }, { tutorId: 't1', fecha: '2026-10-02', total: 500, estado: 'anulada' }, { tutorId: 't2', fecha: '2026-10-03', total: 9 }];
  const c = T.compras('t1', ventas);
  assert.equal(c.lista.length, 2);
  assert.equal(c.total, 1000);
  assert.deepEqual(T.compras('t1', undefined), { lista: [], total: 0 });
});

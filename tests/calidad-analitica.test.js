const { test } = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../js/dominio/calidad.js');
const AN = require('../js/dominio/analitica.js');
const M = require('../js/dominio/migraciones.js');
global.window = global;
require('../js/data.js');

const ev = (ia, veredicto, claseReal, extra) => Object.assign({ ia, veredicto, claseReal, fecha: '2026-10-01T12:00:00Z' }, extra);

test('concordancia, falsos negativos y positivos, sensibilidad y especificidad', () => {
  const lista = [
    ev('normal', 'coincide'), ev('normal', 'coincide'), ev('patologico', 'coincide'),
    ev('normal', 'corrige', 'patologico'), // falso negativo
    ev('patologico', 'corrige', 'normal'), // falso positivo
    ev('incierto', 'corrige', 'patologico'),
  ];
  const m = Q.metricas(lista);
  assert.equal(m.total, 6);
  assert.equal(m.pct, 50);
  assert.deepEqual([m.confusion.vp, m.confusion.vn, m.confusion.fp, m.confusion.fn, m.confusion.inciertos], [1, 2, 1, 1, 1]);
  assert.equal(m.sensibilidad, 0.5);
  assert.equal(Math.round(m.especificidad * 100), 67);
  assert.equal(m.falsosNegativos.length, 1);
  assert.equal(m.muestraChica, true);
  assert.ok(m.ic[0] < 0.5 && m.ic[1] > 0.5, 'el IC contiene la proporción');
});

test('muestra chica: aviso por debajo de 30 evaluaciones', () => {
  const muchas = Array.from({ length: 30 }, () => ev('normal', 'coincide'));
  assert.equal(Q.metricas(muchas).muestraChica, false);
  assert.equal(Q.metricas(muchas.slice(1)).muestraChica, true);
  assert.equal(Q.metricas([]).pct, 0);
});

test('exportación anonimizada: sin nombres ni texto libre, fechas por mes, seudónimos estables', () => {
  const filas = Q.anonimizar([
    { fecha: '2026-09-14T10:00:00Z', estudioId: 'e1', pacienteId: 'p1', especie: 'Canino', vet: 'Dra. Laura Giménez', vetId: 'u-vet', ia: 'normal', veredicto: 'corrige', claseReal: 'patologico', hallazgos: ['TX-CAR-01'], motivo: 'Luna, tos', nombre: 'Luna' },
    { fecha: '2026-09-20T10:00:00Z', estudioId: 'e2', pacienteId: 'p1', especie: 'Canino', vet: 'Dra. Laura Giménez', vetId: 'u-vet', ia: 'normal', veredicto: 'coincide' },
  ]);
  const txt = JSON.stringify(filas);
  assert.ok(!/Luna|Giménez|tos/.test(txt));
  assert.equal(filas[0].periodo, '2026-09');
  assert.equal(filas[0].paciente, filas[1].paciente, 'el mismo paciente tiene el mismo seudónimo');
  assert.notEqual(filas[0].estudio, filas[1].estudio);
  assert.equal(filas[0].hallazgos, 'TX-CAR-01');
  assert.ok(Q.csv(filas).startsWith('periodo,estudio,paciente'));
});

test('v18: clase real y hallazgos codificados en las evaluaciones de ejemplo; vuelve exacta', () => {
  const v17 = M.migrar(global.SEED, 17), v18 = M.migrar(v17, 18);
  const q2 = v18.evaluaciones.find((q) => q.id === 'q2');
  assert.equal(q2.claseReal, 'patologico');
  assert.deepEqual(q2.hallazgos, ['TX-CAR-01']);
  assert.equal(Q.metricas(v18.evaluaciones).confusion.fn, 1, 'el falso negativo de Rocky queda registrado');
  assert.ok(v18.evaluaciones.every((q) => q.hallazgos.every((c) => Q.hallazgo(c))));
  assert.deepEqual(M.revertir(v18, 17), v17);
});

test('analítica por período: turnos, ventas y hemocomponentes', () => {
  const ahora = new Date('2026-10-15T12:00:00');
  const r = AN.rango('30', ahora);
  const turnos = [
    { fecha: '2026-10-10T10:00:00', estado: 'atendido', tipo: 'Consulta', duracion: 30, origen: 'portal' },
    { fecha: '2026-10-11T10:00:00', estado: 'no_vino', tipo: 'Consulta', duracion: 30 },
    { fecha: '2026-10-12T10:00:00', estado: 'atendido', tipo: 'Vacunación', duracion: 20 },
    { fecha: '2026-08-01T10:00:00', estado: 'no_vino', tipo: 'Consulta' }, // fuera del período
    { fecha: '2026-10-20T10:00:00', estado: 'confirmado', tipo: 'Consulta' }, // futuro
  ];
  const t = AN.turnos(turnos, r, ahora);
  assert.equal(t.total, 3);
  assert.equal(t.ausentismo, 33);
  assert.equal(t.desdePortal, 33);
  assert.equal(t.minutosAtendidos, 50);
  const ventas = [
    { fecha: '2026-10-10T10:00:00', estado: 'confirmada', total: 10000, medioPago: 'efectivo', items: [{ nombre: 'A', catalogo: 'petshop', cantidad: 2, subtotal: 10000 }] },
    { fecha: '2026-10-11T10:00:00', estado: 'devolucion_parcial', total: 6000, medioPago: 'qr', devoluciones: [{ importe: 2000 }], items: [{ nombre: 'Consulta', servicio: true, cantidad: 1, subtotal: 6000 }] },
    { fecha: '2026-10-12T10:00:00', estado: 'anulada', total: 99999, medioPago: 'qr', items: [] },
  ];
  const v = AN.ventas(ventas, r);
  assert.equal(v.total, 14000);
  assert.equal(v.cantidad, 2);
  assert.equal(v.devoluciones, 2000);
  assert.deepEqual(v.porCatalogo, { petshop: 10000, servicios: 6000 });
  const h = AN.hemocomponentes([
    { estado: 'transfundida', comp: 'GR', eventos: [{ fecha: '2026-10-05T10:00:00', tipo: 'transfusion' }] },
    { estado: 'vencida', comp: 'PL', eventos: [{ fecha: '2026-10-06T10:00:00', tipo: 'vencimiento' }] },
    { estado: 'disponible', comp: 'GR', eventos: [] },
  ], r);
  assert.equal(h.descarte, 50);
  assert.deepEqual(h.disponiblesPorComp, { GR: 1 });
});

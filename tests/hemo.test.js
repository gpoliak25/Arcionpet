const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/dominio/hemo.js');
const M = require('../js/dominio/migraciones.js');
global.window = global;
require('../js/data.js');

const ahora = new Date('2026-10-15T12:00:00');
const U = (comp, especie, grupo, extra) => Object.assign({ id: 'u', comp, especie, grupo, volumen: 250, ubicacion: 'Esta clínica', estado: 'disponible', vence: '2026-11-01T10:00:00' }, extra);
const P = (especie, grupoSanguineo, id) => ({ id: id || 'p', especie, grupoSanguineo });

test('gatos: tipificar al receptor y no mezclar grupos A y B', () => {
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Felino', 'Tipo A'), P('Felino', null)).nivel, 'bloqueo');
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Felino', 'Tipo B'), P('Felino', 'Tipo A')).nivel, 'bloqueo');
  assert.equal(H.compatibilidad(U('Plasma fresco congelado', 'Felino', 'Tipo A'), P('Felino', 'Tipo B')).nivel, 'bloqueo', 'también con plasma');
  const ok = H.compatibilidad(U('Glóbulos rojos', 'Felino', 'Tipo A'), P('Felino', 'Tipo A'));
  assert.equal(ok.nivel, 'precaucion');
  assert.ok(ok.motivos.some((m) => m.includes('prueba cruzada')), 'en gatos siempre se pide prueba cruzada');
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Felino', 'Tipo B'), P('Felino', 'Tipo AB')).nivel, 'bloqueo');
});

test('perros: DEA 1.1 y sensibilización', () => {
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Canino', 'DEA 1.1 −'), P('Canino', null)).nivel, 'ok', 'DEA 1.1 − sirve como donante universal');
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Canino', 'DEA 1.1 +'), P('Canino', 'DEA 1.1 −')).nivel, 'precaucion');
  assert.equal(H.compatibilidad(U('Plasma fresco congelado', 'Canino', 'DEA 1.1 +'), P('Canino', 'DEA 1.1 −')).nivel, 'ok', 'el plasma no lleva glóbulos');
  const previas = [{ pacienteId: 'p', fecha: '2026-09-01T10:00:00', grupoUnidad: 'DEA 1.1 +' }];
  const c = H.compatibilidad(U('Glóbulos rojos', 'Canino', 'DEA 1.1 +'), P('Canino', 'DEA 1.1 −'), previas, ahora);
  assert.equal(c.nivel, 'bloqueo', 'ya sensibilizado');
  const c2 = H.compatibilidad(U('Glóbulos rojos', 'Canino', 'DEA 1.1 −'), P('Canino', 'DEA 1.1 −'), previas, ahora);
  assert.equal(c2.nivel, 'precaucion');
  assert.ok(c2.motivos[0].includes('prueba cruzada'));
});

test('otra especie: bloqueo', () => {
  assert.equal(H.compatibilidad(U('Glóbulos rojos', 'Canino', 'DEA 1.1 −'), P('Felino', 'Tipo A')).nivel, 'bloqueo');
});

test('registro de transfusión: volumen, prueba cruzada, reacción y justificación si no es compatible', () => {
  const base = { pacienteId: 'p', volumen: 200, volumenUnidad: 250, pruebaCruzada: 'compatible', reaccion: 'ninguna', compatibilidad: 'ok' };
  assert.deepEqual(H.validarTransfusion(base), []);
  assert.ok(H.validarTransfusion(Object.assign({}, base, { volumen: 300 })).some((e) => e.includes('superar')));
  assert.ok(H.validarTransfusion(Object.assign({}, base, { reaccion: 'leve' })).some((e) => e.includes('Describí')));
  assert.ok(H.validarTransfusion(Object.assign({}, base, { compatibilidad: 'bloqueo' })).some((e) => e.includes('justificá')));
  assert.deepEqual(H.validarTransfusion(Object.assign({}, base, { compatibilidad: 'bloqueo', justificacion: 'Emergencia' })), []);
});

test('solicitudes a la red: validación y unidades candidatas de otras sedes', () => {
  assert.ok(H.validarSolicitud({ comp: 'Plaquetas', especie: 'Canino', cantidad: 0, motivo: 'x' }).length);
  assert.ok(H.validarSolicitud({ comp: 'Plaquetas', especie: 'Canino', grupo: 'Tipo A', cantidad: 1, motivo: 'x' }).some((e) => e.includes('Grupo')));
  const unidades = [
    U('Glóbulos rojos', 'Canino', 'DEA 1.1 −', { id: 'a', ubicacion: 'Clínica Norte' }),
    U('Glóbulos rojos', 'Canino', 'DEA 1.1 −', { id: 'b' }), // ya está en esta clínica
    U('Glóbulos rojos', 'Canino', 'DEA 1.1 +', { id: 'c', ubicacion: 'Clínica Norte' }),
    U('Glóbulos rojos', 'Canino', 'DEA 1.1 −', { id: 'd', ubicacion: 'Banco', vence: '2026-10-01T10:00:00' }), // vencida
  ];
  assert.deepEqual(H.candidatas(unidades, { comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 −' }, ahora).map((u) => u.id), ['a']);
  assert.deepEqual(H.candidatas(unidades, { comp: 'Glóbulos rojos', especie: 'Canino', grupo: null }, ahora).map((u) => u.id).sort(), ['a', 'c']);
});

test('reservas por vencer', () => {
  const us = [U('Sangre entera', 'Felino', 'Tipo A', { id: 'r', estado: 'reservada', vence: '2026-10-18T10:00:00' }), U('Sangre entera', 'Felino', 'Tipo A', { id: 'd', vence: '2026-10-18T10:00:00' })];
  assert.deepEqual(H.reservasPorVencer(us, 7, ahora).map((u) => u.id), ['r']);
});

test('v20: grupo sanguíneo, transfusiones históricas y vuelta exacta', () => {
  const v19 = M.migrar(global.SEED, 19), v20 = M.migrar(v19, 20);
  assert.equal(v20.pacientes.find((p) => p.id === 'p2').grupoSanguineo, 'Tipo A');
  assert.ok(v20.hemoTransfusiones.some((t) => t.unidadId === 'HC-0350' && t.pacienteId === 'p4'));
  assert.deepEqual(v20.hemoSolicitudes, []);
  assert.deepEqual(M.revertir(v20, 19), v19);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const PE = require('../js/dominio/peluqueria.js');
const T = require('../js/dominio/turnos.js');
const M = require('../js/dominio/migraciones.js');
const Inv = require('../js/dominio/inventario.js');
global.window = global;
require('../js/data.js');

const v17 = () => M.migrar(global.SEED, 17);
const sv = (id) => v17().pelServicios.find((x) => x.id === id);

test('tamaño: el de la ficha manda; si no, por peso', () => {
  assert.equal(PE.tamano({ peso: 4 }), 'chico');
  assert.equal(PE.tamano({ peso: 18 }), 'mediano');
  assert.equal(PE.tamano({ peso: 34 }), 'grande');
  assert.equal(PE.tamano({ peso: 60 }), 'gigante');
  assert.equal(PE.tamano({}), 'mediano');
  assert.equal(PE.tamano({ peso: 34 }, { tamano: 'gigante' }), 'gigante');
});

test('cotizar: precio y duración por tamaño, con recargo por pelo largo', () => {
  const bano = sv('pel-bano');
  assert.deepEqual(PE.cotizar(bano, { peso: 8, raza: 'Mestizo' }), { tamano: 'chico', peloLargo: false, precio: 14000, duracion: 45 });
  const largo = PE.cotizar(bano, { peso: 34, raza: 'Ovejero Alemán' });
  assert.equal(largo.peloLargo, true);
  assert.equal(largo.precio, 28800); // 24000 + 20 %
  assert.equal(largo.duracion, 95); // 75 + 25 %, redondeado a 5
  // las uñas no tienen recargo por pelaje
  assert.equal(PE.cotizar(sv('pel-unas'), { peso: 34, raza: 'Ovejero Alemán' }).precio, 6000);
});

test('validar servicio y ficha', () => {
  assert.deepEqual(PE.validarServicio(sv('pel-corte')), []);
  const malo = JSON.parse(JSON.stringify(sv('pel-corte'))); malo.porTamano.chico.precio = 0;
  assert.ok(PE.validarServicio(malo).some((e) => e.includes('chico')));
  assert.ok(PE.validarFicha({ tamano: 'enorme' }).length);
  assert.ok(PE.validarFicha({ fotos: new Array(PE.MAX_FOTOS + 1).fill({}) }).some((e) => e.includes('fotos')));
});

test('próxima visita según la frecuencia del servicio', () => {
  assert.equal(PE.proximaVisita({ frecuenciaDias: 30 }, '2026-10-01T12:00:00'), '2026-10-31');
  assert.equal(PE.proximaVisita({}, '2026-10-01T12:00:00'), null);
});

test('la agenda de peluquería usa la lógica de turnos con peluqueros como recurso', () => {
  const s = v17();
  const ctx = { turnos: s.pelTurnos, recursos: s.pelRecursos, servicios: s.pelServicios, pacientes: s.pacientes, ahora: null };
  const t1 = s.pelTurnos.find((t) => t.id === 'pt1');
  const choca = Object.assign({}, t1, { id: undefined, pacienteId: 'p3', fecha: new Date(new Date(t1.fecha).getTime() + 15 * 60000).toISOString() });
  assert.ok(T.validar(choca, ctx).some((e) => e.startsWith('Conflicto')));
  assert.deepEqual(T.validar(Object.assign({}, choca, { recursos: ['rp-2'], fecha: new Date(new Date(t1.fecha).getTime() + 180 * 60000).toISOString() }), ctx), []);
});

test('v17: servicios, peluqueros, insumos válidos y vuelta exacta', () => {
  const v16 = M.migrar(global.SEED, 16), s = M.migrar(v16, 17);
  assert.equal(s.pelServicios.length, 6);
  assert.ok(s.pelServicios.every((x) => PE.validarServicio(x).length === 0));
  assert.ok(s.pelServicios.every((x) => x.insumos.every((i) => s.productos.some((p) => p.id === i.productoId))), 'los insumos existen');
  assert.ok(s.productos.filter((p) => p.categoria === 'Higiene y peluquería').every((p) => Inv.validarProducto(p, s.productos).length === 0));
  assert.ok(s.pelTurnos.every((t) => !T.conflictos(t, s.pelTurnos).length));
  assert.deepEqual(M.revertir(s, 16), v16);
});

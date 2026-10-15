const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/dominio/permisos.js');

test('solo el veterinario puede firmar informes', () => {
  assert.equal(P.puedeAccion('veterinario', 'firmarInforme'), true);
  ['recepcion', 'peluqueria', 'administracion'].forEach((r) => assert.equal(P.puedeAccion(r, 'firmarInforme'), false));
});

test('peluquería no accede a diagnóstico ni hemocomponentes', () => {
  ['imagenes', 'triage', 'informes', 'derivaciones', 'hemocomponentes'].forEach((m) => assert.equal(P.puede('peluqueria', m), false, m));
  assert.equal(P.puede('peluqueria', 'peluqueria', 'editar'), true);
});

test('recepción gestiona turnos y peluquería, y solo ve informes', () => {
  assert.equal(P.puede('recepcion', 'turnos', 'todo'), true);
  assert.equal(P.puede('recepcion', 'peluqueria', 'todo'), true);
  assert.equal(P.puede('recepcion', 'informes', 'ver'), true);
  assert.equal(P.puede('recepcion', 'informes', 'editar'), false);
});

test('solo administración anula ventas y edita precios', () => {
  assert.equal(P.puedeAccion('administracion', 'anularVenta'), true);
  assert.equal(P.puedeAccion('recepcion', 'anularVenta'), false);
  assert.equal(P.puedeAccion('administracion', 'editarPrecios'), true);
  assert.equal(P.puedeAccion('veterinario', 'editarPrecios'), false);
});

test('ajustes de stock: administración en todo, veterinario solo en farmacia', () => {
  assert.equal(P.puedeAjustarStock('administracion', 'petshop'), true);
  assert.equal(P.puedeAjustarStock('veterinario', 'farmacia'), true);
  assert.equal(P.puedeAjustarStock('veterinario', 'petshop'), false);
  assert.equal(P.puedeAjustarStock('recepcion', 'farmacia'), false);
});

test('solo administración cambia el modelo de IA', () => {
  assert.equal(P.puedeAccion('administracion', 'cambiarModelo'), true);
  ['veterinario', 'recepcion', 'peluqueria'].forEach((r) => assert.equal(P.puedeAccion(r, 'cambiarModelo'), false));
});

test('todos los roles ven Inicio y ARCION', () => {
  Object.keys(P.ROLES).forEach((r) => { assert.ok(P.puede(r, 'inicio')); assert.ok(P.puede(r, 'arcion')); });
});

test('rol o módulo desconocido no tiene acceso', () => {
  assert.equal(P.puede('invitado', 'pacientes'), false);
  assert.equal(P.puede('veterinario', 'modulo-inexistente'), false);
});

test('la matriz define los cuatro roles en cada módulo', () => {
  Object.entries(P.MATRIZ).forEach(([m, fila]) => {
    assert.equal(fila.length, 4, m);
    fila.forEach((n) => assert.ok(n in P.NIVELES, m + ': ' + n));
  });
});

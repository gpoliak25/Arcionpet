const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/dominio/migraciones.js');

// data.js asigna window.SEED: lo cargamos con un window mínimo
global.window = global;
require('../js/data.js');
const SEED = global.SEED;

test('los datos de ejemplo están en la versión base', () => {
  assert.equal(SEED.version, M.VERSION_BASE);
});

test('migrar lleva el estado a la versión actual', () => {
  const s = M.migrar(SEED);
  assert.equal(s.version, M.VERSION_ACTUAL);
  assert.ok(Array.isArray(s.usuarios) && ['veterinario', 'recepcion', 'peluqueria', 'administracion'].every((r) => s.usuarios.some((u) => u.rol === r)));
  assert.equal(s.usuarioActivo, 'u-vet');
});

test('migrar no modifica el estado recibido', () => {
  const antes = JSON.stringify(SEED);
  M.migrar(SEED);
  assert.equal(JSON.stringify(SEED), antes);
});

test('ida y vuelta: revertir después de migrar devuelve exactamente los datos originales', () => {
  const vuelta = M.revertir(M.migrar(SEED), M.VERSION_BASE);
  assert.deepEqual(vuelta, JSON.parse(JSON.stringify(SEED)));
});

test('los datos que cargó el usuario sobreviven a la migración', () => {
  const s = JSON.parse(JSON.stringify(SEED));
  s.pacientes.push({ id: 'p-nuevo', nombre: 'Coco', especie: 'Canino', raza: 'Caniche', tutorId: 't1' });
  const migrado = M.migrar(s);
  assert.ok(migrado.pacientes.some((p) => p.id === 'p-nuevo'));
  assert.deepEqual(M.revertir(migrado, M.VERSION_BASE), s);
});

test('v13: confianza pasa a probPatologia y vuelve exacta, con datos ficticios reversibles', () => {
  const s = M.migrar(SEED, 12);
  s.estudios[0].confianza = 37;
  s.estudios[0].modelo = { clave: 'ensamble', nombre: 'Ensamble' };
  s.tutores[0].email = 'propio@example.com'; // un email que ya era example.com no se toca al revertir
  const v13 = M.migrar(s, 13);
  assert.equal(v13.estudios[0].probPatologia, 37);
  assert.ok(!('confianza' in v13.estudios[0]));
  assert.equal(v13.estudios[0].modelo.version, 'ensamble-tta@1.0');
  assert.ok(v13.tutores.every((t) => /^99\.100\.\d{3}$/.test(t.doc)), 'DNI ficticios');
  assert.ok(v13.tutores.filter((t) => t.email).every((t) => /@example\.com$/.test(t.email)), 'emails en example.com');
  assert.equal(v13.config.demoMode, false);
  assert.deepEqual(M.revertir(v13, 12), JSON.parse(JSON.stringify(s)));
});

test('cada paso tiene up y down y las versiones son consecutivas', () => {
  M.PASOS.forEach((p, i) => {
    assert.equal(typeof p.up, 'function');
    assert.equal(typeof p.down, 'function');
    assert.equal(p.a, p.de + 1);
    if (i > 0) assert.equal(p.de, M.PASOS[i - 1].a);
  });
});

test('rechaza versiones fuera de rango', () => {
  assert.throws(() => M.migrar({ version: M.VERSION_BASE - 1 }));
  assert.throws(() => M.migrar({ version: M.VERSION_ACTUAL + 1 }));
  assert.throws(() => M.revertir({ version: M.VERSION_ACTUAL }, M.VERSION_BASE - 1));
});

test('v15: productos con costo, proveedor y EAN-13 interno válido; colecciones de facturación y caja; vuelve exacta', () => {
  const Inv = require('../js/dominio/inventario.js');
  const v14 = M.migrar(SEED, 14);
  const v15 = M.migrar(v14, 15);
  assert.ok(v15.productos.every((p) => p.costo > 0 && p.proveedor && Inv.ean13Valido(p.codigoBarras) && p.codigoBarras.startsWith('200')));
  assert.equal(new Set(v15.productos.map((p) => p.codigoBarras)).size, v15.productos.length, 'códigos únicos');
  assert.ok(v15.productos.filter((p) => p.intervaloDias).every((p) => p.catalogo === 'farmacia'));
  assert.ok(v15.tutores.every((t) => t.condicionIva === 'Consumidor final'));
  assert.deepEqual([v15.comprobantes, v15.cajas, v15.fichaClinica, v15.calendarioSalud], [[], [], [], []]);
  assert.equal(v15.config.facturacion.modo, 'homologacion');
  assert.ok(v15.productos.every((p) => Inv.validarProducto(p, v15.productos).length === 0), 'los productos migrados son válidos');
  assert.deepEqual(M.revertir(v15, 14), v14);
});

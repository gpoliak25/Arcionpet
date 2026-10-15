const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/dominio/inventario.js');

const HOY = new Date('2026-10-15T12:00:00');
const dias = (n) => { const d = new Date(HOY); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
let n = 0;
const ctx = (extra) => Object.assign({ fecha: HOY.toISOString(), usuario: 'u-adm', id: (p) => p + '-' + (++n) }, extra);

function base() {
  return {
    productos: [
      { id: 'amox', catalogo: 'farmacia', categoria: 'Medicamentos', nombre: 'Amoxicilina', precio: 9000, stockMinimo: 5, requiereReceta: true, sigtrazavet: true },
      { id: 'pipeta', catalogo: 'farmacia', categoria: 'Antiparasitarios', nombre: 'Pipeta', precio: 7000, stockMinimo: 2 },
      { id: 'correa', catalogo: 'petshop', categoria: 'Correas y accesorios', nombre: 'Correa', precio: 5000, stockMinimo: 3 },
    ],
    lotes: [
      { id: 'a1', productoId: 'amox', lote: 'A1', vence: dias(40), cantidad: 4, ingreso: '2026-09-01' },
      { id: 'a2', productoId: 'amox', lote: 'A2', vence: dias(10), cantidad: 3, ingreso: '2026-09-10' },
      { id: 'a0', productoId: 'amox', lote: 'A0', vence: dias(-2), cantidad: 2, ingreso: '2026-08-01' },
      { id: 'p1', productoId: 'pipeta', lote: 'P1', vence: dias(200), cantidad: 1, ingreso: '2026-09-01' },
      { id: 'c1', productoId: 'correa', lote: '', vence: null, cantidad: 6, ingreso: '2026-09-01' },
    ],
    movimientos: [],
    declaraciones: [],
  };
}

test('stock: suma de lotes; lo vencido no es vendible', () => {
  const e = I.estado(base().productos[0], base().lotes, HOY);
  assert.equal(e.total, 9);
  assert.equal(e.vencidos, 2);
  assert.equal(e.vendible, 7);
});

test('alerta de stock mínimo: vendible menor o igual al mínimo', () => {
  const b = base();
  assert.equal(I.estado(b.productos[1], b.lotes, HOY).bajoMinimo, true); // 1 <= 2
  assert.equal(I.estado(b.productos[2], b.lotes, HOY).bajoMinimo, false); // 6 > 3
});

test('farmacia: aviso de vencimiento a 30 días; próximo vencimiento ignora lo vencido', () => {
  const b = base();
  const e = I.estado(b.productos[0], b.lotes, HOY);
  assert.equal(e.proximoVence, dias(10));
  assert.equal(e.porVencer, true);
  assert.equal(I.estado(b.productos[1], b.lotes, HOY).porVencer, false); // vence en 200 días
  const v = I.vencimientos(b.productos, b.lotes, HOY);
  assert.deepEqual(v.vencidos.map((l) => l.id), ['a0']);
  assert.deepEqual(v.porVencer.map((l) => l.id), ['a2']);
});

test('el pet shop no genera avisos de vencimiento', () => {
  const b = base();
  b.lotes.push({ id: 'c2', productoId: 'correa', lote: 'X', vence: dias(3), cantidad: 1 });
  assert.equal(I.estado(b.productos[2], b.lotes, HOY).porVencer, false);
  assert.ok(!I.vencimientos(b.productos, b.lotes, HOY).porVencer.some((l) => l.productoId === 'correa'));
});

test('ingreso: suma al mismo lote o crea uno nuevo, y registra el movimiento', () => {
  const r1 = I.ingresar(base(), { productoId: 'amox', lote: 'A1', vence: dias(40), cantidad: 5 }, ctx());
  assert.equal(r1.inv.lotes.find((l) => l.id === 'a1').cantidad, 9);
  const r2 = I.ingresar(r1.inv, { productoId: 'amox', lote: 'A3', vence: dias(90), cantidad: 2 }, ctx());
  assert.equal(r2.inv.lotes.length, 6);
  assert.equal(r2.inv.movimientos.length, 2);
  assert.equal(r2.inv.movimientos[1].tipo, 'ingreso');
});

test('ingreso: farmacia exige lote y vencimiento; no se ingresa mercadería vencida ni cantidades inválidas', () => {
  assert.throws(() => I.ingresar(base(), { productoId: 'amox', vence: dias(10), cantidad: 1 }, ctx()), /lote es obligatorio/);
  assert.throws(() => I.ingresar(base(), { productoId: 'amox', lote: 'Z', cantidad: 1 }, ctx()), /vencimiento es obligatorio/);
  assert.throws(() => I.ingresar(base(), { productoId: 'amox', lote: 'Z', vence: dias(-1), cantidad: 1 }, ctx()), /vencida/);
  assert.throws(() => I.ingresar(base(), { productoId: 'correa', cantidad: 0 }, ctx()), /mayor a cero/);
  assert.throws(() => I.ingresar(base(), { productoId: 'correa', cantidad: 1.5 }, ctx()), /entero/);
  assert.doesNotThrow(() => I.ingresar(base(), { productoId: 'correa', cantidad: 3 }, ctx())); // pet shop sin lote
});

test('ajuste: no permite stock negativo', () => {
  assert.throws(() => I.ajustar(base(), { loteId: 'c1', cantidad: 7, motivo: 'rotura' }, ctx()), /No hay stock suficiente/);
  const r = I.ajustar(base(), { loteId: 'c1', cantidad: 6, motivo: 'rotura' }, ctx());
  assert.equal(r.inv.lotes.find((l) => l.id === 'c1').cantidad, 0);
});

test('ajuste en producto alcanzado por SIGTRAZAVET genera declaración a 10 días; uno no alcanzado, no', () => {
  const r = I.ajustar(base(), { loteId: 'a1', cantidad: 1, motivo: 'rotura' }, ctx());
  assert.equal(r.declaracion.estado, 'pendiente');
  assert.equal(I.diasHasta(r.declaracion.limite, HOY), 10);
  assert.equal(I.ajustar(base(), { loteId: 'p1', cantidad: 1, motivo: 'rotura' }, ctx()).declaracion, null);
  assert.equal(I.ajustar(base(), { loteId: 'a1', cantidad: 1, motivo: 'conteo' }, ctx()).declaracion, null); // conteo no es contingencia
});

test('baja por vencimiento: solo lotes vencidos, da de baja todo el saldo y declara', () => {
  assert.throws(() => I.bajaVencido(base(), 'a1', ctx()), /todavía no venció/);
  const r = I.bajaVencido(base(), 'a0', ctx());
  assert.equal(r.inv.lotes.find((l) => l.id === 'a0').cantidad, 0);
  assert.equal(r.inv.movimientos[0].cantidad, -2);
  assert.equal(r.declaracion.tipo, 'vencimiento');
});

test('FEFO: descuenta primero el lote que vence antes y nunca uno vencido', () => {
  const plan = I.planDescuento('amox', 5, base().lotes, HOY);
  assert.deepEqual(plan.map((x) => [x.loteId, x.cantidad]), [['a2', 3], ['a1', 2]]);
});

test('venta con stock insuficiente: error y el inventario queda igual (todo o nada)', () => {
  const b = base();
  const antes = JSON.stringify(b);
  assert.throws(() => I.descontar(b, [{ productoId: 'correa', cantidad: 2 }, { productoId: 'amox', cantidad: 8 }], ctx()), /Stock insuficiente \(disponible: 7\)/);
  assert.equal(JSON.stringify(b), antes);
});

test('el mismo producto dos veces en una venta suma el pedido', () => {
  assert.throws(() => I.descontar(base(), [{ productoId: 'correa', cantidad: 4 }, { productoId: 'correa', cantidad: 3 }], ctx()), /insuficiente/);
  const r = I.descontar(base(), [{ productoId: 'correa', cantidad: 4 }, { productoId: 'correa', cantidad: 2 }], ctx());
  assert.equal(r.inv.lotes.find((l) => l.id === 'c1').cantidad, 0);
});

test('anular devuelve exactamente lo descontado a cada lote', () => {
  const b = base();
  const d = I.descontar(b, [{ productoId: 'amox', cantidad: 5 }], ctx({ ref: 'v1' }));
  const r = I.reponer(d.inv, d.asignaciones, ctx({ ref: 'v1' }));
  assert.deepEqual(r.inv.lotes, b.lotes);
  assert.deepEqual(r.inv.movimientos.map((m) => m.tipo), ['venta', 'venta', 'anulacion', 'anulacion']);
});

test('valor del stock vendible a precio de venta', () => {
  const b = base();
  assert.equal(I.valorStock(b.productos, b.lotes, HOY), 7 * 9000 + 1 * 7000 + 6 * 5000);
});

test('validación de producto', () => {
  const ok = { catalogo: 'petshop', categoria: 'Juguetes', nombre: 'Pelota', precio: 3000, stockMinimo: 2 };
  assert.deepEqual(I.validarProducto(ok, []), []);
  assert.ok(I.validarProducto(Object.assign({}, ok, { categoria: 'Vacunas' }), []).includes('La categoría no corresponde al catálogo'));
  assert.ok(I.validarProducto(Object.assign({}, ok, { requiereReceta: true }), []).some((e) => e.includes('farmacia')));
  assert.ok(I.validarProducto(Object.assign({}, ok, { precio: 0 }), []).length);
});

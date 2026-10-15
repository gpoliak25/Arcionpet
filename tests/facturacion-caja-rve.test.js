const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/dominio/facturacion.js');
const K = require('../js/dominio/caja.js');
const R = require('../js/dominio/rve.js');
const I = require('../js/dominio/inventario.js');
const V = require('../js/dominio/ventas.js');

const HOY = new Date(2026, 9, 15, 12);
const fecha = HOY.toISOString();

// ---------- facturación
test('tipo de comprobante según condición frente al IVA', () => {
  assert.equal(F.tipoComprobante('Responsable inscripto', 'Responsable inscripto'), 'A');
  assert.equal(F.tipoComprobante('Responsable inscripto', 'Consumidor final'), 'B');
  assert.equal(F.tipoComprobante('Responsable inscripto', 'Monotributo'), 'B');
  assert.equal(F.tipoComprobante('Monotributo', 'Responsable inscripto'), 'C');
});

test('importes: la factura A/B discrimina neto e IVA 21 %; la C no', () => {
  assert.deepEqual(F.importes(12100, 'A'), { neto: 10000, iva: 2100, total: 12100 });
  assert.deepEqual(F.importes(12100, 'C'), { neto: 12100, iva: 0, total: 12100 });
});

test('factura B a consumidor final con CAE y numeración por punto de venta', () => {
  const emisor = { condicionIva: 'Responsable inscripto' };
  const f1 = F.emitir({ clase: 'factura', emisor, cliente: { condicionIva: 'Consumidor final' }, puntoVenta: 1, totalConIva: 12100, fecha }, []);
  const f2 = F.emitir({ clase: 'factura', emisor, cliente: { condicionIva: 'Consumidor final' }, puntoVenta: 1, totalConIva: 500, fecha }, [f1]);
  const otroPV = F.emitir({ clase: 'factura', emisor, cliente: { condicionIva: 'Consumidor final' }, puntoVenta: 2, totalConIva: 500, fecha }, [f1, f2]);
  assert.equal(f1.tipo, 'B'); assert.equal(f1.codigo, 6);
  assert.equal(f1.numero, 1); assert.equal(f2.numero, 2); assert.equal(otroPV.numero, 1);
  assert.match(f1.cae, /^\d{14}$/);
  assert.equal(F.numeroFormateado(f2), '00001-00000002');
  assert.equal(f1.modo, 'homologacion');
});

test('factura A exige CUIT del cliente', () => {
  assert.throws(() => F.emitir({ clase: 'factura', emisor: { condicionIva: 'Responsable inscripto' }, cliente: { condicionIva: 'Responsable inscripto' }, puntoVenta: 1, totalConIva: 100, fecha }, []), /CUIT/);
});

test('nota de crédito asociada: mismo tipo, código de NC y su propia numeración', () => {
  const emisor = { condicionIva: 'Responsable inscripto' };
  const f = F.emitir({ clase: 'factura', emisor, cliente: { condicionIva: 'Consumidor final' }, puntoVenta: 1, totalConIva: 1000, fecha }, []);
  const nc = F.emitir({ clase: 'nc', emisor, cliente: { condicionIva: 'Consumidor final' }, puntoVenta: 1, totalConIva: 400, fecha, asociado: f }, [f]);
  assert.equal(nc.tipo, 'B'); assert.equal(nc.codigo, 8); assert.equal(nc.numero, 1);
  assert.equal(nc.asociado.numero, 1);
  assert.match(F.etiqueta(nc), /^Nota de crédito B 00001-00000001$/);
});

// ---------- caja
test('caja: apertura, ventas y devoluciones en efectivo, cierre con arqueo', () => {
  let c = K.abrir([], { montoInicial: 10000, usuario: 'u', fecha, id: 'c1' }).cajas;
  assert.throws(() => K.abrir(c, { montoInicial: 0, usuario: 'u', fecha, id: 'c2' }), /Ya hay una caja abierta/);
  c = K.movimiento(c, { tipo: 'venta', medio: 'efectivo', monto: 5000, usuario: 'u', fecha });
  c = K.movimiento(c, { tipo: 'venta', medio: 'qr', monto: 8000, usuario: 'u', fecha });
  c = K.movimiento(c, { tipo: 'devolucion', medio: 'efectivo', monto: 1000, usuario: 'u', fecha });
  assert.equal(K.efectivoEsperado(K.abierta(c)), 14000);
  assert.throws(() => K.movimiento(c, { tipo: 'retiro', medio: 'efectivo', monto: 99999, usuario: 'u', fecha }), /suficiente efectivo/);
  const r = K.cerrar(c, { efectivoContado: 13900, usuario: 'u', fecha });
  assert.equal(r.caja.diferencia, -100);
  assert.deepEqual(r.caja.resumen, { efectivo: 4000, qr: 8000 });
  assert.equal(K.abierta(r.cajas), null);
  assert.throws(() => K.movimiento(r.cajas, { tipo: 'venta', medio: 'qr', monto: 1, usuario: 'u', fecha }), /caja está cerrada/);
});

// ---------- RVE emitida por ArcionPet
const vet = { id: 'u-vet', rol: 'veterinario', nombre: 'Dra. Laura Giménez', matricula: 'MP 4821' };
const receta = () => ({
  emision: '2026-10-15', titular: { nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '99100001' },
  animal: { pacienteId: 'p1', nombre: 'Luna', especie: 'Canino', raza: 'Bulldog', edad: '4 años' },
  items: [{ productoId: 'amox', descripcion: 'Amoxicilina', cantidad: 1, dosis: '1 comp', frecuencia: '12 h', duracion: '7 días', via: 'Oral' }],
});
const productos = [{ id: 'amox', requiereReceta: true }];

test('RVE: con DEMO_MODE se emite con número único simulado', () => {
  const r1 = R.emitir(receta(), { prescriptor: vet, productos, emitidas: [], demo: true, fecha, id: 'r1' });
  const r2 = R.emitir(receta(), { prescriptor: vet, productos, emitidas: [r1], demo: true, fecha, id: 'r2' });
  assert.equal(r1.estado, 'vigente'); assert.equal(r1.origen, 'emitida');
  assert.equal(r1.cuve, 'SIM-2026-00000001'); assert.equal(r2.cuve, 'SIM-2026-00000002');
  assert.equal(r1.veterinario.matricula, 'MP 4821');
  assert.ok(r1.emisionRegistro.adapter.includes('Simulación'));
});

test('RVE: sin DEMO_MODE queda pendiente de integración, sin número, y no habilita la venta', () => {
  const r = R.emitir(receta(), { prescriptor: vet, productos, emitidas: [], demo: false, fecha, id: 'r1' });
  assert.equal(r.estado, 'pendiente_integracion'); assert.equal(r.cuve, '');
  const e = V.validarVenta({ tutores: [{ id: 't1', tipoDoc: 'DNI', doc: '99100001' }], pacientes: [{ id: 'p1', tutorId: 't1' }], productos: [{ id: 'amox', nombre: 'Amoxicilina', requiereReceta: true }], lotes: [] }, { tutorId: 't1', pacienteId: 'p1', medioPago: 'qr', items: [{ productoId: 'amox', cantidad: 1 }], receta: r }, HOY, 'recepcion');
  assert.ok(e.some((x) => x.includes('pendiente de integración')));
  const ok = R.asignarCuve(r, 'RVE-2026-00000777', []);
  assert.equal(ok.estado, 'vigente');
  assert.throws(() => R.asignarCuve(r, '123', []), /8 caracteres/);
});

test('RVE: solo un veterinario con matrícula emite, con los datos del art. 18 d', () => {
  assert.throws(() => R.emitir(receta(), { prescriptor: { rol: 'recepcion' }, productos, demo: true, fecha, id: 'x' }), /Solo un veterinario/);
  assert.throws(() => R.emitir(receta(), { prescriptor: Object.assign({}, vet, { matricula: '' }), productos, demo: true, fecha, id: 'x' }), /matrícula/);
  const sinDosis = receta(); delete sinDosis.items[0].dosis;
  assert.throws(() => R.emitir(sinDosis, { prescriptor: vet, productos, demo: true, fecha, id: 'x' }), /dosis/);
});

// ---------- inventario: margen, códigos de barras, reposición, ingreso con costo
test('margen sobre el precio neto de IVA', () => {
  assert.deepEqual(I.margen({ precio: 12100, costo: 6000 }), { neto: 10000, costo: 6000, ganancia: 4000, pct: 40 });
  assert.equal(I.margen({ precio: 12100 }), null);
});

test('códigos de barras EAN-13', () => {
  assert.equal(I.ean13('200000000001'), '2000000000015');
  assert.equal(I.ean13Valido('2000000000015'), true);
  assert.equal(I.ean13Valido('2000000000016'), false);
  assert.ok(I.validarProducto({ catalogo: 'petshop', categoria: 'Juguetes', nombre: 'X', precio: 1, stockMinimo: 0, codigoBarras: '123' }, []).some((e) => e.includes('EAN-13')));
  assert.equal(I.porCodigo([{ id: 'a', codigoBarras: '2000000000015' }], '2000000000015').id, 'a');
});

test('reponer: sugiere completar hasta el doble del mínimo', () => {
  assert.equal(I.sugerenciaReposicion({ stockMinimo: 5 }, { bajoMinimo: true, vendible: 2 }), 8);
  assert.equal(I.sugerenciaReposicion({ stockMinimo: 5 }, { bajoMinimo: false, vendible: 9 }), 0);
});

test('ingreso con costo unitario y proveedor actualiza el producto', () => {
  const inv = { productos: [{ id: 'c', catalogo: 'petshop', precio: 5000, stockMinimo: 1 }], lotes: [], movimientos: [], declaraciones: [] };
  let n = 0;
  const r = I.ingresar(inv, { productoId: 'c', cantidad: 3, costoUnitario: 2500, proveedor: 'Distribuidora Sur' }, { fecha, usuario: 'u', id: (p) => p + (++n) });
  assert.equal(r.inv.productos[0].costo, 2500);
  assert.equal(r.inv.productos[0].proveedor, 'Distribuidora Sur');
  assert.equal(r.inv.movimientos[0].costoUnitario, 2500);
});

test('intervalo de repetición: solo en farmacia y en rango', () => {
  const base = { catalogo: 'farmacia', categoria: 'Antiparasitarios', nombre: 'X', precio: 1, stockMinimo: 0 };
  assert.deepEqual(I.validarProducto(Object.assign({}, base, { intervaloDias: 30 }), []), []);
  assert.ok(I.validarProducto(Object.assign({}, base, { intervaloDias: 0 }), []).length);
  assert.ok(I.validarProducto({ catalogo: 'petshop', categoria: 'Juguetes', nombre: 'X', precio: 1, stockMinimo: 0, intervaloDias: 30 }, []).length);
});

// ---------- devoluciones
function estadoVenta() {
  return {
    tutores: [{ id: 't1', nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '99100001', activo: true }], pacientes: [],
    productos: [{ id: 'cor', catalogo: 'petshop', categoria: 'Correas y accesorios', nombre: 'Correa', presentacion: '1 u', precio: 1000, stockMinimo: 0 }],
    lotes: [{ id: 'l1', productoId: 'cor', lote: 'A', vence: null, cantidad: 2, ingreso: '2026-01-01' }, { id: 'l2', productoId: 'cor', lote: 'B', vence: null, cantidad: 5, ingreso: '2026-02-01' }],
    movimientos: [], declaraciones: [], ventas: [], recetas: [],
  };
}
test('devolución parcial y total: repone a los lotes de origen y cambia el estado', () => {
  let n = 0; const ctx = { fecha, usuario: 'u-adm', rol: 'administracion', id: (p) => p + (++n) };
  const v = V.registrar(estadoVenta(), { medioPago: 'efectivo', items: [{ productoId: 'cor', cantidad: 4 }] }, ctx); // 2 del lote A y 2 del B
  assert.throws(() => V.devolver(v.estado, v.venta.id, [{ productoId: 'cor', cantidad: 5 }], 'x', ctx), /más unidades/);
  const d1 = V.devolver(v.estado, v.venta.id, [{ productoId: 'cor', cantidad: 1 }], 'Talle equivocado', ctx);
  assert.equal(d1.venta.estado, 'devolucion_parcial');
  assert.equal(d1.estado.lotes.find((l) => l.id === 'l2').cantidad, 4); // vuelve primero al último lote usado
  assert.equal(d1.devolucion.importe, 1000);
  const d2 = V.devolver(d1.estado, v.venta.id, [{ productoId: 'cor', cantidad: 3 }], 'Devolución total', ctx);
  assert.equal(d2.venta.estado, 'devuelta');
  assert.deepEqual(d2.estado.lotes.map((l) => l.cantidad), [2, 5]);
  assert.throws(() => V.devolver(d2.estado, v.venta.id, [{ productoId: 'cor', cantidad: 1 }], 'x', ctx), /devuelta por completo/);
  assert.equal(V.resumen(d1.estado.ventas).total, 3000); // la devolución parcial se descuenta del total
});

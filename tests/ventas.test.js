const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/dominio/ventas.js');

const HOY = new Date(2026, 9, 15, 12, 0);
const dia = (n) => { const d = new Date(2026, 9, 15 + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let n = 0;
const ctx = (extra) => Object.assign({ fecha: HOY.toISOString(), usuario: 'u-rec', rol: 'recepcion', id: (p) => p + '-' + (++n) }, extra);

function base() {
  return {
    tutores: [{ id: 't1', nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '30.456.789', activo: true }, { id: 't2', nombre: 'Juan', apellido: 'Paz', tipoDoc: 'DNI', doc: '20111222', activo: false }],
    pacientes: [{ id: 'p1', nombre: 'Luna', especie: 'Canino', raza: 'Bulldog Francés', tutorId: 't1' }, { id: 'p9', nombre: 'Otro', tutorId: 't9' }],
    productos: [
      { id: 'amox', catalogo: 'farmacia', categoria: 'Medicamentos', nombre: 'Amoxicilina', presentacion: 'x 10', precio: 15400, stockMinimo: 2, requiereReceta: true, sigtrazavet: true },
      { id: 'pipeta', catalogo: 'farmacia', categoria: 'Antiparasitarios', nombre: 'Pipeta', presentacion: '1 u', precio: 11900, stockMinimo: 1 },
      { id: 'correa', catalogo: 'petshop', categoria: 'Correas y accesorios', nombre: 'Correa', presentacion: '1,2 m', precio: 8500, stockMinimo: 1 },
    ],
    lotes: [
      { id: 'a1', productoId: 'amox', lote: 'AX1', vence: dia(10), cantidad: 1, ingreso: '2026-09-01' },
      { id: 'a2', productoId: 'amox', lote: 'AX2', vence: dia(100), cantidad: 5, ingreso: '2026-09-02' },
      { id: 'pp', productoId: 'pipeta', lote: 'P1', vence: dia(200), cantidad: 4, ingreso: '2026-09-01' },
      { id: 'cc', productoId: 'correa', lote: '', vence: null, cantidad: 3, ingreso: '2026-09-01' },
    ],
    movimientos: [], declaraciones: [], ventas: [], recetas: [],
  };
}
const rve = (extra) => Object.assign({
  tipo: 'mascotas', cuve: 'RVE-2026-00012345', emision: dia(-3),
  veterinario: { nombre: 'Dra. Laura Giménez', matricula: 'MP 4821' },
  titular: { nombre: 'Ana', apellido: 'López', tipoDoc: 'DNI', doc: '30456789' },
  animal: { pacienteId: 'p1', nombre: 'Luna', especie: 'Canino', raza: 'Bulldog Francés', edad: '4 años' },
  items: [{ productoId: 'amox', descripcion: 'Amoxicilina + ácido clavulánico', presentacion: 'x 10', cantidad: 2, dosis: '1 comprimido', frecuencia: 'cada 12 h', duracion: '7 días', via: 'Oral' }],
}, extra || {});
const ventaReceta = (extra) => Object.assign({ tutorId: 't1', pacienteId: 'p1', medioPago: 'qr', items: [{ productoId: 'amox', cantidad: 2 }], receta: rve() }, extra || {});

test('total con IVA incluido e IVA contenido informativo (21 %)', () => {
  const t = V.totales([{ precioUnit: 12100, cantidad: 2 }]);
  assert.equal(t.total, 24200);
  assert.equal(t.ivaContenido, 4200);
});

test('venta de pet shop: descuenta stock, numera y queda asociada al tutor', () => {
  const r = V.registrar(base(), { tutorId: 't1', medioPago: 'efectivo', items: [{ productoId: 'correa', cantidad: 2 }] }, ctx());
  assert.equal(r.estado.lotes.find((l) => l.id === 'cc').cantidad, 1);
  assert.equal(r.venta.numero, 1);
  assert.equal(r.venta.tutorId, 't1');
  assert.equal(r.venta.total, 17000);
  assert.equal(r.estado.movimientos[0].ref, r.venta.id);
});

test('consumidor final: se permite sin tutor, salvo productos bajo receta; el tutor, si se indica, debe estar activo', () => {
  assert.doesNotThrow(() => V.registrar(base(), { medioPago: 'qr', items: [{ productoId: 'correa', cantidad: 1 }] }, ctx()));
  assert.throws(() => V.registrar(base(), { medioPago: 'qr', items: [{ productoId: 'amox', cantidad: 1 }], receta: rve() }, ctx()), /consumidor final/);
  assert.throws(() => V.registrar(base(), { tutorId: 't2', medioPago: 'qr', items: [{ productoId: 'correa', cantidad: 1 }] }, ctx()), /dado de baja/);
  assert.throws(() => V.registrar(base(), { tutorId: 't1', medioPago: 'cheque', items: [{ productoId: 'correa', cantidad: 1 }] }, ctx()), /medio de pago/);
  assert.throws(() => V.registrar(base(), { tutorId: 't1', pacienteId: 'p9', medioPago: 'qr', items: [{ productoId: 'correa', cantidad: 1 }] }, ctx()), /no pertenece/);
});

test('stock insuficiente: rechaza la venta y no cambia nada', () => {
  const b = base(), antes = JSON.stringify(b);
  assert.throws(() => V.registrar(b, { tutorId: 't1', medioPago: 'qr', items: [{ productoId: 'correa', cantidad: 1 }, { productoId: 'pipeta', cantidad: 9 }] }, ctx()), /Stock insuficiente/);
  assert.equal(JSON.stringify(b), antes);
});

test('peluquería no vende productos de farmacia', () => {
  assert.throws(() => V.registrar(base(), { tutorId: 't1', medioPago: 'qr', items: [{ productoId: 'pipeta', cantidad: 1 }] }, ctx({ rol: 'peluqueria' })), /no puede vender productos de farmacia/);
});

test('producto bajo receta: sin RVE no se vende; uno de venta libre de farmacia sí', () => {
  assert.throws(() => V.registrar(base(), ventaReceta({ receta: null }), ctx()), /registrá la receta veterinaria electrónica/);
  assert.doesNotThrow(() => V.registrar(base(), { tutorId: 't1', medioPago: 'debito', items: [{ productoId: 'pipeta', cantidad: 1 }] }, ctx()));
});

test('con RVE válida: vende (FEFO), marca la receta dispensada y deja la declaración en tiempo real', () => {
  const r = V.registrar(base(), ventaReceta(), ctx());
  assert.deepEqual(r.venta.items[0].lotes.map((l) => [l.loteId, l.cantidad]), [['a1', 1], ['a2', 1]]);
  const rec = r.estado.recetas[0];
  assert.equal(rec.estado, 'dispensada');
  assert.equal(rec.ventaId, r.venta.id);
  const d = r.estado.declaraciones[0];
  assert.equal(d.tipo, 'venta_rve');
  assert.equal(d.cuve, 'RVE-2026-00012345');
  assert.equal(d.limite, d.fecha); // tiempo real
});

test('RVE: datos obligatorios del art. 18 d', () => {
  const e = V.validarReceta(rve({ cuve: '12', titular: { nombre: 'Ana' }, animal: { nombre: 'Luna' }, items: [{ productoId: 'amox', descripcion: 'Amoxicilina', cantidad: 1 }] }), HOY);
  ['CUVE', 'apellido del titular', 'documento del titular', 'especie del animal', 'raza del animal', 'edad del animal', 'dosis', 'frecuencia', 'duración', 'vía'].forEach((k) => assert.ok(e.some((x) => x.includes(k)), 'falta validar: ' + k));
});

test('RVE: vigencia de 30 días corridos desde la emisión', () => {
  assert.deepEqual(V.validarReceta(rve({ emision: dia(-30) }), HOY), []);
  assert.ok(V.validarReceta(rve({ emision: dia(-31) }), HOY).some((x) => x.includes('vencida')));
  assert.ok(V.validarReceta(rve({ emision: dia(1) }), HOY).some((x) => x.includes('futura')));
});

test('RVE: el titular debe ser el tutor y el animal la mascota de la venta', () => {
  assert.throws(() => V.registrar(base(), ventaReceta({ receta: rve({ titular: { nombre: 'X', apellido: 'Y', tipoDoc: 'DNI', doc: '99888777' } }) }), ctx()), /titular de la receta no coincide/);
  assert.throws(() => V.registrar(base(), ventaReceta({ receta: rve({ animal: { pacienteId: 'p2', nombre: 'Milo', especie: 'Felino', raza: 'Siamés', edad: '1 año' } }) }), ctx()), /otro animal/);
  assert.throws(() => V.registrar(base(), ventaReceta({ pacienteId: null }), ctx()), /Elegí la mascota/);
});

test('RVE: producto fuera de la receta o cantidad mayor a la recetada', () => {
  assert.throws(() => V.registrar(base(), ventaReceta({ items: [{ productoId: 'amox', cantidad: 3 }] }), ctx()), /supera lo recetado \(2\)/);
  assert.throws(() => V.registrar(base(), ventaReceta({ receta: rve({ items: [{ productoId: 'otro', descripcion: 'X', cantidad: 1, dosis: '1', frecuencia: '1', duracion: '1', via: 'Oral' }] }) }), ctx()), /no está en la receta/);
});

test('RVE: una sola dispensa (no se puede reutilizar)', () => {
  const r1 = V.registrar(base(), ventaReceta({ items: [{ productoId: 'amox', cantidad: 1 }] }), ctx());
  const usada = r1.estado.recetas[0];
  assert.throws(() => V.registrar(r1.estado, ventaReceta({ items: [{ productoId: 'amox', cantidad: 1 }], receta: usada }), ctx()), /una sola dispensa/);
});

test('botiquín profesional (art. 20): solo veterinario; sin CUVE; declara autoconsumo', () => {
  const bot = rve({ tipo: 'botiquin', cuve: '', emision: null });
  assert.throws(() => V.registrar(base(), ventaReceta({ receta: bot }), ctx()), /Solo un veterinario/);
  const r = V.registrar(base(), ventaReceta({ receta: bot }), ctx({ rol: 'veterinario', usuario: 'u-vet' }));
  assert.equal(r.estado.declaraciones[0].tipo, 'autoconsumo');
  assert.ok(V.validarReceta(rve({ tipo: 'botiquin', items: [{ productoId: 'amox', descripcion: 'A', cantidad: 1 }] }), HOY).some((x) => x.includes('dosis')), 'el botiquín también exige los datos clínicos');
});

test('anular: repone los lotes, libera la receta vigente y la declaración pendiente queda sin efecto', () => {
  const r = V.registrar(base(), ventaReceta(), ctx());
  const a = V.anular(r.estado, r.venta.id, 'Error de carga', ctx({ usuario: 'u-adm' }));
  assert.deepEqual(a.estado.lotes, base().lotes);
  assert.equal(a.venta.estado, 'anulada');
  assert.equal(a.estado.recetas[0].estado, 'vigente');
  assert.equal(a.estado.declaraciones[0].estado, 'sin_efecto');
  assert.throws(() => V.anular(a.estado, r.venta.id, 'otra vez', ctx()), /ya está anulada/);
  assert.throws(() => V.anular(r.estado, r.venta.id, '  ', ctx()), /motivo/);
});

test('anular una venta ya declarada en SIGTRAZAVET deja pendiente su anulación (20 días)', () => {
  const r = V.registrar(base(), ventaReceta(), ctx());
  r.estado.declaraciones[0].estado = 'declarada';
  r.estado.declaraciones[0].nroOperacion = 'OP-1';
  const a = V.anular(r.estado, r.venta.id, 'Devolución', ctx());
  const d = a.estado.declaraciones.find((x) => x.tipo === 'anulacion');
  assert.equal(d.estado, 'pendiente');
  assert.equal(d.nroOriginal, 'OP-1');
  assert.equal(Math.round((new Date(d.limite) - new Date(2026, 9, 15)) / 86400000), 20);
});

test('recetas disponibles para un tutor y su mascota', () => {
  const recetas = [Object.assign(rve(), { id: 'r1', estado: 'vigente' }), Object.assign(rve({ emision: dia(-40) }), { id: 'r2', estado: 'vigente' }), Object.assign(rve(), { id: 'r3', estado: 'dispensada' })];
  assert.deepEqual(V.recetasDisponibles(recetas, base().tutores[0], 'p1', HOY).map((r) => r.id), ['r1']);
});

test('resumen de ventas (excluye anuladas)', () => {
  const ventas = [{ total: 100, medioPago: 'qr', fecha: '2026-10-15T10:00' }, { total: 50, medioPago: 'qr', fecha: '2026-10-15T11:00' }, { total: 70, medioPago: 'efectivo', fecha: '2026-10-15T12:00', estado: 'anulada' }];
  assert.deepEqual(V.resumen(ventas), { cantidad: 2, total: 150, promedio: 75, porMedio: { qr: 150 } });
});

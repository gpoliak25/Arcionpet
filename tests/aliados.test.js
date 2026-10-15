const { test } = require('node:test');
const assert = require('node:assert/strict');
const AL = require('../js/dominio/aliados.js');
const P = require('../js/dominio/permisos.js');
const M = require('../js/dominio/migraciones.js');
global.window = global;
require('../js/data.js');

const ahora = '2026-10-15T12:00:00.000Z';
const base = (x) => Object.assign({ nombre: 'Paseos (ejemplo)', tipo: 'paseador', zona: 'Palermo', telefono: '11 5555-0101', especies: ['Canino'], tamanos: ['chico'], condiciones: ['senior'], documentos: {} }, x);

test('validación del alta', () => {
  assert.deepEqual(AL.validar(base()), []);
  assert.ok(AL.validar(base({ telefono: '', email: '' })).some((e) => e.includes('contacto')));
  assert.ok(AL.validar(base({ especies: [] })).some((e) => e.includes('especie')));
  assert.ok(AL.validar(base({ email: 'no-es-mail' })).some((e) => e.includes('email')));
});

test('verificación: exige la documentación vigente según el tipo de servicio', () => {
  assert.throws(() => AL.verificar(base(), ahora, 'u-adm'), /seguro de responsabilidad civil, referencias/);
  const conVencido = base({ documentos: { seguro: { detalle: 'Póliza', vence: '2026-01-01' }, referencias: { detalle: '3 refs' } } });
  assert.deepEqual(AL.faltantes(conVencido, ahora), ['seguro']);
  const ok = AL.verificar(base({ documentos: { seguro: { detalle: 'Póliza', vence: '2027-01-01' }, referencias: { detalle: '3 refs' } } }), ahora, 'u-adm');
  assert.equal(ok.estado, 'verificado');
  assert.deepEqual(AL.faltantes(base({ tipo: 'hotel', documentos: { seguro: { detalle: 'x' } } }), ahora), ['habilitacion']);
});

test('filtros por especie, tamaño, zona y condición del paciente', () => {
  const lista = [base({ id: 'a', estado: 'verificado' }), base({ id: 'b', especies: ['Felino'], estado: 'verificado' }), base({ id: 'c', zona: 'Belgrano', condiciones: [], estado: 'pendiente' })];
  assert.deepEqual(AL.filtrar(lista, { especie: 'Canino', condiciones: ['senior'] }).map((a) => a.id), ['a']);
  assert.deepEqual(AL.filtrar(lista, { zona: 'belg' }).map((a) => a.id), ['c']);
  assert.deepEqual(AL.filtrar(lista, { soloVerificados: true }).map((a) => a.id), ['a', 'b']);
  const senior = AL.condicionesPaciente({ especie: 'Canino', nacimiento: '2016-01-01' }, { ahora, recetasVigentes: 1 });
  assert.deepEqual(senior, ['senior', 'medicacion']);
  assert.deepEqual(AL.condicionesPaciente({ especie: 'Felino', nacimiento: '2017-01-01' }, { ahora }), [], 'un gato de 9 años todavía no es senior');
});

test('mensaje al tutor: aviso de tercero fijo y acuerdo comercial informado', () => {
  const ctx = { paciente: { nombre: 'Rocky' }, tutor: { nombre: 'Ana' }, motivo: 'Paseos cortos', clinica: { nombre: 'Clínica (ejemplo)' } };
  const sin = AL.mensaje(Object.assign({ aliado: base() }, ctx));
  assert.ok(sin.includes(AL.AVISO_TERCERO));
  assert.ok(!sin.includes('acuerdo comercial'));
  assert.ok(sin.includes('No compartimos datos'));
  const con = AL.mensaje(Object.assign({ aliado: base({ acuerdoComercial: '10 % de descuento' }) }, ctx));
  assert.ok(con.includes('acuerdo comercial con este proveedor: 10 % de descuento'));
});

test('valoración y seguimiento', () => {
  assert.ok(AL.validarValoracion(6).length);
  assert.deepEqual(AL.validarValoracion(4, 'Bien'), []);
  const recs = [{ aliadoId: 'a', fecha: ahora, concretada: true, valoracion: { puntaje: 5 } }, { aliadoId: 'a', fecha: ahora, concretada: true, valoracion: { puntaje: 4 } }, { aliadoId: 'b', fecha: ahora, concretada: false }];
  assert.deepEqual(AL.promedio('a', recs), { promedio: 4.5, n: 2 });
  const sg = AL.seguimiento(recs, [{ id: 'a', tipo: 'paseador' }, { id: 'b', tipo: 'hotel' }]);
  assert.equal(sg.tasa, 67);
  assert.deepEqual(sg.porTipo.paseador, { enviadas: 2, concretadas: 2 });
});

test('permisos: administración verifica; peluquería solo ve', () => {
  assert.equal(P.puedeAccion('administracion', 'verificarAliado'), true);
  assert.equal(P.puedeAccion('veterinario', 'verificarAliado'), false);
  assert.equal(P.puede('veterinario', 'aliados', 'editar'), true);
  assert.equal(P.puede('peluqueria', 'aliados', 'editar'), false);
});

test('v21: directorio de ejemplo ficticio, sin datos reales; vuelve exacta', () => {
  const v20 = M.migrar(global.SEED, 20), v21 = M.migrar(v20, 21);
  assert.ok(v21.aliados.every((a) => /\(ejemplo\)/.test(a.nombre) && /@example\.com$/.test(a.email)));
  assert.ok(v21.aliados.filter((a) => a.estado === 'verificado').every((a) => AL.faltantes(a, new Date().toISOString()).length === 0), 'los verificados tienen la documentación');
  assert.equal(v21.config.compartirAliadosRed, false, 'compartir con la red: apagado por defecto');
  assert.deepEqual(M.revertir(v21, 20), v20);
});

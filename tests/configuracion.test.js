const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/dominio/configuracion.js');
const copia = (extra) => Object.assign(JSON.parse(JSON.stringify(C.DEFECTO)), extra);

test('la configuración por defecto es válida', () => {
  assert.deepEqual(C.validar(C.DEFECTO), []);
});

test('umbrales de la IA: entre 0 y 1 e incierto menor que patológico', () => {
  assert.ok(C.validar(copia({ umbrales: Object.assign({}, C.DEFECTO.umbrales, { incierto: 0.4, patologico: 0.3 }) })).some((e) => e.includes('menor')));
  assert.ok(C.validar(copia({ umbrales: Object.assign({}, C.DEFECTO.umbrales, { patologico: 1.2 }) })).some((e) => e.includes('entre 0 y 1')));
});

test('SLA y avisos de vencimiento: enteros en rango', () => {
  assert.ok(C.validar(copia({ sla: { triage: 0, derivaciones: 72, interconsultas: 48 } })).some((e) => e.includes('triage')));
  assert.ok(C.validar(copia({ umbrales: Object.assign({}, C.DEFECTO.umbrales, { avisoFarmacia: 2.5 }) })).some((e) => e.includes('farmacia')));
});

test('datos de la clínica: nombre, CUIT, condición de IVA y email', () => {
  const e = C.validar(copia({ clinica: { nombre: '', cuit: '123', condicionIva: 'Otro', email: 'mal' } }));
  ['nombre', 'CUIT', 'IVA', 'email'].forEach((k) => assert.ok(e.some((x) => x.includes(k)), k));
});

test('usuarios: siempre queda un administrador activo y los veterinarios tienen matrícula', () => {
  assert.deepEqual(C.validarUsuarios([{ nombre: 'A', rol: 'administracion' }, { nombre: 'V', rol: 'veterinario', matricula: 'MP 1' }]), []);
  assert.ok(C.validarUsuarios([{ nombre: 'A', rol: 'administracion', activo: false }]).some((e) => e.includes('administración')));
  assert.ok(C.validarUsuarios([{ nombre: 'A', rol: 'administracion' }, { nombre: 'V', rol: 'veterinario' }]).some((e) => e.includes('matrícula')));
});

test('módulos habilitados', () => {
  assert.equal(C.habilitado({ modulos: { peluqueria: false } }, 'peluqueria'), false);
  assert.equal(C.habilitado({ modulos: { peluqueria: false } }, 'aliados'), true);
  assert.equal(C.habilitado({ modulos: {} }, null), true);
});

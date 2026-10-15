const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/dominio/recordatorios.js');
const M = require('../js/dominio/migraciones.js');
global.window = global;
require('../js/data.js');

const local = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h || 0, mi || 0).toISOString();
const AHORA = local(2026, 10, 15, 11, 0);
const tutor = (x) => Object.assign({ id: 't1', nombre: 'Ana', email: 'ana@example.com', tel: '11 5555-0001', recordatorios: { consentimiento: true, canales: ['email'] } }, x);
const ctx = (x) => Object.assign({ pacientes: [{ id: 'p1', nombre: 'Luna', tutorId: 't1', especie: 'Canino' }], tutores: [tutor()], calendario: [], turnos: [], pelTurnos: [], config: {}, ahora: AHORA }, x);
const item = (x) => Object.assign({ id: 'c1', pacienteId: 'p1', nombre: 'Vacuna antirrábica', categoria: 'Vacunas', fecha: '2026-11-15', estado: 'pendiente' }, x);

test('planifica 15, 7 y 1 día antes, en horario permitido', () => {
  const a = R.planificar(ctx({ calendario: [item()] }));
  assert.deepEqual(a.map((x) => x.anticipacion), ['15d', '7d', '1d']);
  assert.ok(a.every((x) => x.tipo === 'vacuna' && x.canales[0] === 'email'));
  assert.ok(a.every((x) => R.dentroDeHorario(x.envioEn, {})));
});

test('si ya pasaron varias anticipaciones, manda solo la más cercana (no se acumulan)', () => {
  const a = R.planificar(ctx({ calendario: [item({ fecha: '2026-10-19' })] }));
  assert.deepEqual(a.map((x) => x.anticipacion), ['7d', '1d']);
  assert.equal(a[0].envioEn, AHORA, 'el aviso atrasado sale ahora');
});

test('sin consentimiento, con baja, paciente inactivo o fallecido: no se avisa', () => {
  assert.equal(R.planificar(ctx({ calendario: [item()], tutores: [tutor({ recordatorios: { consentimiento: false } })] })).length, 0);
  assert.equal(R.planificar(ctx({ calendario: [item()], tutores: [tutor({ recordatorios: { consentimiento: true, canales: ['email'], baja: AHORA } })] })).length, 0);
  assert.equal(R.planificar(ctx({ calendario: [item()], pacientes: [{ id: 'p1', nombre: 'Luna', tutorId: 't1', activo: false }] })).length, 0);
  assert.equal(R.planificar(ctx({ calendario: [item()], pacientes: [{ id: 'p1', nombre: 'Luna', tutorId: 't1', fallecido: true }] })).length, 0);
});

test('WhatsApp solo con plantillas aprobadas y si el tutor lo autorizó', () => {
  const t = tutor({ recordatorios: { consentimiento: true, canales: ['whatsapp'] } });
  assert.deepEqual(R.canales(t, { canales: { email: true, whatsapp: true } }), []);
  assert.deepEqual(R.canales(t, { canales: { email: true, whatsapp: true }, whatsappPlantillasAprobadas: true }), ['whatsapp']);
});

test('si el tutor ya sacó turno para esa vacuna, se cancela el pendiente', () => {
  let cola = R.sincronizar([], R.planificar(ctx({ calendario: [item()] })), AHORA);
  assert.equal(cola.filter((r) => r.estado === 'programado').length, 3);
  const turnos = [{ id: 'tu1', pacienteId: 'p1', servicioId: 'vacunacion', estado: 'confirmado', fecha: local(2026, 11, 10, 10) }];
  cola = R.sincronizar(cola, R.planificar(ctx({ calendario: [item()], turnos })).filter((a) => a.refTipo === 'cs'), AHORA);
  assert.equal(cola.filter((r) => r.refTipo === 'cs' && r.estado === 'cancelado').length, 3);
});

test('si se aplicó antes de tiempo, la fecha nueva genera avisos nuevos y los viejos se cancelan', () => {
  let cola = R.sincronizar([], R.planificar(ctx({ calendario: [item()] })), AHORA);
  const nuevo = item({ id: 'c2', fecha: '2027-10-20' });
  cola = R.sincronizar(cola, R.planificar(ctx({ calendario: [item({ estado: 'reemplazada' }), nuevo] })), AHORA);
  assert.equal(cola.filter((r) => r.refId === 'c1' && r.estado === 'cancelado').length, 3);
  assert.equal(cola.filter((r) => r.refId === 'c2' && r.estado === 'programado').length, 3);
});

test('idempotencia: sincronizar dos veces no duplica y un aviso enviado no se reenvía', () => {
  const p = R.planificar(ctx({ calendario: [item({ fecha: '2026-10-16' })] }));
  let cola = R.sincronizar([], p, AHORA);
  cola = R.sincronizar(cola, p, AHORA);
  assert.equal(cola.length, 1);
  let envios = 0;
  const enviar = () => { envios++; return { ok: true, entregado: true }; };
  cola = R.procesar(cola, AHORA, {}, enviar);
  cola = R.procesar(R.sincronizar(cola, p, AHORA), AHORA, {}, enviar);
  assert.equal(envios, 1);
  assert.equal(cola[0].estado, 'entregado');
});

test('fuera del horario permitido no se envía; los turnos avisan 48 h y 2 h antes', () => {
  const turnos = [{ id: 'tu1', pacienteId: 'p1', tipo: 'Consulta general', estado: 'confirmado', fecha: local(2026, 10, 18, 10) }];
  const a = R.planificar(ctx({ turnos }));
  assert.deepEqual(a.map((x) => x.anticipacion), ['48h', '2h']);
  const noche = local(2026, 10, 16, 22, 0);
  let n = 0;
  R.procesar(R.sincronizar([], a, AHORA), noche, {}, () => { n++; return { ok: true }; });
  assert.equal(n, 0);
  assert.equal(R.enHorario(noche, {}).getHours(), 9, 'pasa a la mañana siguiente');
});

test('reintentos con espera creciente y falla definitiva', () => {
  let cola = R.sincronizar([], R.planificar(ctx({ calendario: [item({ fecha: '2026-10-16' })] })), AHORA);
  const falla = () => ({ ok: false, error: 'Servidor caído' });
  cola = R.procesar(cola, AHORA, { reintentos: { max: 2, esperaMin: 30 } }, falla);
  assert.equal(cola[0].estado, 'programado');
  assert.equal(cola[0].intentos, 1);
  assert.equal(new Date(cola[0].proximoIntento) - new Date(AHORA), 30 * 60000);
  cola = R.procesar(cola, cola[0].proximoIntento, { reintentos: { max: 2, esperaMin: 30 } }, falla);
  assert.equal(new Date(cola[0].proximoIntento) - new Date(cola[0].historial[1].fecha), 60 * 60000, 'la espera se duplica');
  cola = R.procesar(cola, cola[0].proximoIntento, { reintentos: { max: 2, esperaMin: 30 } }, falla);
  assert.equal(cola[0].estado, 'fallo');
  // un error inesperado del canal no frena la cola
  const c2 = R.procesar(R.sincronizar([], R.planificar(ctx({ calendario: [item({ fecha: '2026-10-16' })] })), AHORA), AHORA, {}, () => { throw new Error('boom'); });
  assert.equal(c2[0].historial[0].error, 'boom');
});

test('mensaje en voseo con mascota, fecha, datos de la clínica, enlace para pedir turno y baja', () => {
  const r = R.planificar(ctx({ calendario: [item()] }))[0];
  const m = R.mensaje(r, { config: {}, tutor: tutor(), paciente: { nombre: 'Luna' }, clinica: { nombre: 'Clínica (ejemplo)', telefono: '11 5555-0000' } });
  assert.ok(m.startsWith('Hola, Ana. A Luna le toca Vacuna antirrábica el 15/11/2026. ¿Le sacamos turno? Pedilo acá: https://portal.example.com/arcionpet/pedir-turno?mascota=p1'));
  assert.ok(m.includes('Clínica (ejemplo) · 11 5555-0000'));
  assert.ok(m.includes('Para no recibir más avisos: https://portal.example.com/arcionpet/baja?tutor=t1'));
});

test('configuración: validación', () => {
  assert.deepEqual(R.validarConfig({}), []);
  assert.ok(R.validarConfig({ horario: { desde: '20:00', hasta: '09:00' } }).length);
  assert.ok(R.validarConfig({ canales: { email: false, whatsapp: false, sms: false } }).length);
  assert.ok(R.validarConfig({ plantillas: { vacuna: 'Hola' } }).some((e) => e.includes('{mascota}')));
});

test('esquema de vacunas: la serie inicial de cachorros se repite a los 21 días', () => {
  const vac = { categoria: 'Vacunas', intervaloDias: 365 };
  assert.equal(R.intervaloDosis(vac, { nacimiento: '2026-08-01' }, '2026-10-15'), 21);
  assert.equal(R.intervaloDosis(vac, { nacimiento: '2020-08-01' }, '2026-10-15'), 365);
  assert.equal(R.intervaloDosis({ categoria: 'Antiparasitarios', intervaloDias: 90 }, { nacimiento: '2026-08-01' }, '2026-10-15'), 90);
});

test('seguimiento: tasa de turnos concretados después del aviso', () => {
  const cola = [{ tipo: 'vacuna', estado: 'entregado', pacienteId: 'p1', enviado: local(2026, 10, 1, 10), objetivo: local(2026, 10, 16, 10), creado: local(2026, 10, 1, 10) }, { tipo: 'control', estado: 'enviado', pacienteId: 'p2', enviado: local(2026, 10, 1, 10), objetivo: local(2026, 10, 16, 10), creado: local(2026, 10, 1, 10) }];
  const turnos = [{ pacienteId: 'p1', creado: local(2026, 10, 2, 10), fecha: local(2026, 10, 16, 10) }];
  assert.deepEqual(R.seguimiento(cola, turnos, []).tasa, 50);
});

test('v22: consentimiento de los tutores, reglas por defecto y vuelta exacta', () => {
  const v21 = M.migrar(global.SEED, 21), v22 = M.migrar(v21, 22);
  assert.equal(v22.tutores.find((t) => t.id === 't1').recordatorios.consentimiento, true);
  assert.equal(v22.tutores.find((t) => t.id === 't3').recordatorios.consentimiento, false);
  assert.deepEqual(R.validarConfig(v22.config.recordatorios), []);
  assert.deepEqual(M.revertir(v22, 21), v21);
});

test('sin canal configurado: queda en cola con el motivo y no crece el historial', () => {
  let cola = R.sincronizar([], R.planificar(ctx({ calendario: [item({ fecha: '2026-10-16' })] })), AHORA);
  const sinCanal = () => ({ ok: false, sinCanal: true, error: 'Sin proveedor' });
  cola = R.procesar(cola, AHORA, {}, sinCanal);
  cola = R.procesar(cola, AHORA, {}, sinCanal);
  assert.equal(cola[0].estado, 'programado');
  assert.equal(cola[0].error, 'Sin proveedor');
  assert.equal((cola[0].historial || []).length, 0);
  assert.equal(cola[0].intentos, 0);
});

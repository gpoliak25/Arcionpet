const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/dominio/seguridad.js');

const AHORA = new Date(2026, 9, 15, 12, 0);
const hace = (h) => new Date(AHORA.getTime() - h * 3600000).toISOString();

test('contradicción: mismo paciente y mismo día, uno Normal y otro Patológico', () => {
  const est = [
    { id: 'a', pacienteId: 'p1', fecha: new Date(2026, 9, 15, 9).toISOString(), resultado: 'normal' },
    { id: 'b', pacienteId: 'p1', fecha: new Date(2026, 9, 15, 17).toISOString(), resultado: 'patologico' },
    { id: 'c', pacienteId: 'p1', fecha: new Date(2026, 9, 14, 9).toISOString(), resultado: 'patologico' }, // otro día
    { id: 'd', pacienteId: 'p2', fecha: new Date(2026, 9, 15, 9).toISOString(), resultado: 'normal' },
    { id: 'e', pacienteId: 'p2', fecha: new Date(2026, 9, 15, 10).toISOString(), resultado: 'incierto' }, // incierto no contradice
  ];
  const c = G.contradicciones(est);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].estudios, ['a', 'b']);
  assert.equal(G.contradiccionDe('c', est), null);
  assert.ok(G.contradiccionDe('a', est));
});

test('un estudio dado de baja no genera contradicción', () => {
  const est = [
    { id: 'a', pacienteId: 'p1', fecha: AHORA.toISOString(), resultado: 'normal' },
    { id: 'b', pacienteId: 'p1', fecha: AHORA.toISOString(), resultado: 'patologico', activo: false },
  ];
  assert.equal(G.contradicciones(est).length, 0);
});

test('SLA: triage urgente sin informe firmado más allá del límite', () => {
  const estado = {
    estudios: [{ id: 'e1', resultado: 'patologico', fecha: hace(30), asignadoA: 'u-vet' }, { id: 'e2', resultado: 'patologico', fecha: hace(5) }, { id: 'e3', resultado: 'normal', fecha: hace(100) }, { id: 'e4', resultado: 'incierto', fecha: hace(50) }],
    informes: [{ estudioId: 'e4', estado: 'firmado' }],
  };
  const d = G.demoras(estado, {}, AHORA);
  assert.deepEqual(d.map((x) => x.id), ['e1']);
  assert.equal(d[0].asignadoA, 'u-vet');
  assert.equal(G.demoras(estado, { triage: 48 }, AHORA).length, 0); // SLA configurable
});

test('SLA: derivaciones pendientes e interconsultas esperando respuesta del soporte', () => {
  const estado = {
    derivaciones: [{ id: 'd1', estado: 'pendiente', fecha: hace(80) }, { id: 'd2', estado: 'respondida', fecha: hace(200) }],
    interconsultas: [
      { id: 'i1', estado: 'cola', mensajes: [{ rol: 'me', fecha: hace(60) }] },
      { id: 'i2', estado: 'curso', mensajes: [{ rol: 'me', fecha: hace(60) }, { rol: 'support', fecha: hace(1) }] }, // ya respondió
      { id: 'i3', estado: 'cerrada', mensajes: [{ rol: 'me', fecha: hace(90) }] },
    ],
  };
  assert.deepEqual(G.demoras(estado, {}, AHORA).map((x) => x.tipo + ':' + x.id), ['derivaciones:d1', 'interconsultas:i1']);
});

test('baja de estudio bloqueada con informe firmado o derivación', () => {
  assert.equal(G.motivoNoBaja('e1', [{ estudioId: 'e1', estado: 'firmado' }], []), 'El estudio tiene un informe firmado');
  assert.equal(G.motivoNoBaja('e1', [], [{ estudioId: 'e1' }]), 'El estudio tiene una derivación');
  assert.equal(G.motivoNoBaja('e1', [{ estudioId: 'e1', estado: 'borrador' }], []), null);
});

test('con informe firmado no se reanaliza y la copia congelada no cambia aunque cambie el estudio', () => {
  const e = { resultado: 'patologico', probPatologia: 80, probs: { ok: 0.2, patologica: 0.8 }, modelo: { clave: 'ensamble', version: 'ensamble-tta@1.0' } };
  const copia = G.congelarIA(e, AHORA.toISOString());
  e.resultado = 'normal'; e.probPatologia = 10; e.modelo.version = 'otro@2.0'; e.probs.ok = 0.9;
  assert.equal(copia.resultado, 'patologico');
  assert.equal(copia.probPatologia, 80);
  assert.equal(copia.modelo.version, 'ensamble-tta@1.0');
  assert.equal(copia.probs.ok, 0.2);
  assert.equal(G.puedeReanalizar('x', [{ estudioId: 'x', estado: 'firmado' }]), false);
  assert.equal(G.puedeReanalizar('x', [{ estudioId: 'x', estado: 'borrador' }]), true);
});

test('alcance del modelo: solo tórax de perro o gato', () => {
  assert.equal(G.fueraDeAlcance('Tórax', 'Canino'), null);
  assert.equal(G.fueraDeAlcance('Tórax', 'Felino'), null);
  assert.ok(/especie/.test(G.fueraDeAlcance('Tórax', 'Otro')));
  assert.ok(/región/.test(G.fueraDeAlcance('Extremidad', 'Canino')));
});

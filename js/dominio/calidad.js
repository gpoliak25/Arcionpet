/* Control de calidad de la IA: concordancia IA–veterinario (un solo cálculo para Control de calidad y Analítica),
   falsos negativos y positivos, hallazgos codificados y exportación anonimizada. Funciones puras. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { calidad: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const N_MINIMO = 30; // con menos evaluaciones, los porcentajes son poco confiables

  /* Catálogo de hallazgos radiológicos de tórax (el alcance del modelo). */
  const HALLAZGOS = [
    { codigo: 'TX-00', nombre: 'Sin hallazgos significativos' },
    { codigo: 'TX-CAR-01', nombre: 'Cardiomegalia' },
    { codigo: 'TX-CAR-02', nombre: 'Agrandamiento auricular izquierdo' },
    { codigo: 'TX-PUL-01', nombre: 'Patrón intersticial' },
    { codigo: 'TX-PUL-02', nombre: 'Patrón alveolar' },
    { codigo: 'TX-PUL-03', nombre: 'Patrón bronquial' },
    { codigo: 'TX-PUL-04', nombre: 'Nódulo o masa pulmonar' },
    { codigo: 'TX-PUL-05', nombre: 'Edema pulmonar' },
    { codigo: 'TX-PLE-01', nombre: 'Efusión pleural' },
    { codigo: 'TX-PLE-02', nombre: 'Neumotórax' },
    { codigo: 'TX-MED-01', nombre: 'Masa mediastínica' },
    { codigo: 'TX-MED-02', nombre: 'Megaesófago' },
    { codigo: 'TX-VIA-01', nombre: 'Colapso traqueal' },
    { codigo: 'TX-OSE-01', nombre: 'Fractura o lesión costal / vertebral' },
    { codigo: 'TX-DIA-01', nombre: 'Hernia diafragmática' },
    { codigo: 'TX-OTR', nombre: 'Otro (detallar en la corrección)' },
  ];
  const hallazgo = (codigo) => HALLAZGOS.find((h) => h.codigo === codigo) || null;

  /* Clase real (verdad clínica) de una evaluación: la que confirma el veterinario. */
  function claseReal(q) {
    if (q.claseReal) return q.claseReal;
    if (q.veredicto === 'coincide' && q.ia !== 'incierto') return q.ia;
    return null;
  }

  /* Intervalo de confianza de Wilson al 95 % para una proporción. */
  function wilson(k, n) {
    if (!n) return null;
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - m), Math.min(1, c + m)];
  }

  /* Métricas: concordancia = coincidencias / evaluaciones (descarta y corrige cuentan como discrepancia). */
  function metricas(evaluaciones) {
    const ev = evaluaciones || [];
    const coinciden = ev.filter((q) => q.veredicto === 'coincide').length;
    const m = { vp: 0, vn: 0, fp: 0, fn: 0, inciertos: 0, sinClase: 0 };
    const fnLista = [], fpLista = [];
    ev.forEach((q) => {
      const real = claseReal(q);
      if (q.ia === 'incierto') { m.inciertos++; return; }
      if (!real) { m.sinClase++; return; }
      if (q.ia === 'patologico' && real === 'patologico') m.vp++;
      else if (q.ia === 'normal' && real === 'normal') m.vn++;
      else if (q.ia === 'patologico' && real === 'normal') { m.fp++; fpLista.push(q); }
      else if (q.ia === 'normal' && real === 'patologico') { m.fn++; fnLista.push(q); }
    });
    const tasa = (a, b) => (a + b ? a / (a + b) : null);
    return {
      total: ev.length, coinciden, discrepancias: ev.length - coinciden,
      pct: ev.length ? Math.round(coinciden / ev.length * 100) : 0,
      ic: wilson(coinciden, ev.length),
      muestraChica: ev.length < N_MINIMO,
      confusion: m, sensibilidad: tasa(m.vp, m.fn), especificidad: tasa(m.vn, m.fp),
      falsosNegativos: fnLista, falsosPositivos: fpLista,
      porVeredicto: { coincide: coinciden, corrige: ev.filter((q) => q.veredicto === 'corrige').length, descarta: ev.filter((q) => q.veredicto === 'descarta').length },
    };
  }

  /* Frecuencia de hallazgos codificados en las evaluaciones. */
  function frecuenciaHallazgos(evaluaciones) {
    const r = {};
    (evaluaciones || []).forEach((q) => (q.hallazgos || []).forEach((c) => { r[c] = (r[c] || 0) + 1; }));
    return Object.entries(r).map(([codigo, n]) => ({ codigo, nombre: (hallazgo(codigo) || { nombre: codigo }).nombre, n })).sort((a, b) => b.n - a.n);
  }

  /* Exportación anonimizada: sin nombres de pacientes, tutores ni veterinarios, sin texto libre y con fechas por mes.
     Los identificadores se reemplazan por seudónimos estables dentro de la exportación. */
  function anonimizar(filas) {
    const seud = (pref) => { const m = new Map(); return (v) => { if (v == null || v === '') return ''; if (!m.has(v)) m.set(v, pref + String(m.size + 1).padStart(4, '0')); return m.get(v); }; };
    const est = seud('E-'), pac = seud('P-'), vet = seud('V-');
    return filas.map((f) => ({
      periodo: String(f.fecha || '').slice(0, 7), estudio: est(f.estudioId), paciente: pac(f.pacienteId), especie: f.especie || '', edad_anios: f.edadAnios == null ? '' : f.edadAnios,
      region: f.tipo || '', proyeccion: f.proyeccion || '', ia_modelo_version: f.modeloVersion || '', ia_resultado: f.ia || '', ia_probabilidad_patologia: f.probPatologia == null ? '' : f.probPatologia,
      veredicto: f.veredicto || '', clase_real: f.claseReal || '', hallazgos: (f.hallazgos || []).join('|'), veterinario: vet(f.vetId || f.vet),
      imagen_dataset: f.imagenRef || '', etiqueta_dataset: f.etiquetaDataset || '',
    }));
  }

  function csv(filas) {
    if (!filas.length) return '';
    const cols = Object.keys(filas[0]);
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return [cols.join(',')].concat(filas.map((r) => cols.map((c) => q(r[c])).join(','))).join('\n');
  }

  return { N_MINIMO, HALLAZGOS, hallazgo, claseReal, wilson, metricas, frecuenciaHallazgos, anonimizar, csv };
});

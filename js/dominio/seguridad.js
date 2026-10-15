/* Seguridad clínica: estudios contradictorios, demoras (SLA), bajas lógicas y congelamiento del resultado de IA al firmar.
   Funciones puras. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { seguridad: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const SLA_DEFECTO = { triage: 24, derivaciones: 72, interconsultas: 48 }; // horas
  const HORA = 3600000;
  const mismoDia = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
  const activo = (e) => e.activo !== false;

  /* Estudios del mismo paciente y el mismo día con resultados opuestos (Normal y Patológico). */
  function contradicciones(estudios) {
    const grupos = {};
    estudios.filter((e) => activo(e) && e.resultado).forEach((e) => {
      const d = new Date(e.fecha);
      const k = e.pacienteId + '|' + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      (grupos[k] = grupos[k] || []).push(e);
    });
    return Object.values(grupos).filter((g) => g.some((e) => e.resultado === 'normal') && g.some((e) => e.resultado === 'patologico'))
      .map((g) => ({ pacienteId: g[0].pacienteId, fecha: g[0].fecha, estudios: g.map((e) => e.id) }));
  }
  const contradiccionDe = (estudioId, estudios) => contradicciones(estudios).find((c) => c.estudios.includes(estudioId)) || null;

  /* Demoras respecto del SLA (en horas). estado = { estudios, informes, derivaciones, interconsultas } */
  function demoras(estado, sla, ahora) {
    const L = Object.assign({}, SLA_DEFECTO, sla || {});
    const t = (ahora || new Date()).getTime();
    const horas = (desde) => (t - new Date(desde).getTime()) / HORA;
    const out = [];
    const firmado = (eid) => (estado.informes || []).some((i) => i.estudioId === eid && i.estado === 'firmado');
    (estado.estudios || []).filter((e) => activo(e) && (e.resultado === 'patologico' || e.resultado === 'incierto') && !firmado(e.id)).forEach((e) => {
      const h = horas(e.fecha);
      if (h > L.triage) out.push({ tipo: 'triage', id: e.id, horas: h, limite: L.triage, asignadoA: e.asignadoA || null });
    });
    (estado.derivaciones || []).filter((d) => d.estado === 'pendiente').forEach((d) => {
      const h = horas(d.fecha);
      if (h > L.derivaciones) out.push({ tipo: 'derivaciones', id: d.id, horas: h, limite: L.derivaciones, asignadoA: d.asignadoA || null });
    });
    (estado.interconsultas || []).filter((i) => i.estado !== 'cerrada').forEach((i) => {
      // sin respuesta del soporte desde el último mensaje de la clínica
      const ultimo = (i.mensajes || [])[i.mensajes.length - 1];
      if (!ultimo || ultimo.rol !== 'me') return;
      const h = horas(ultimo.fecha);
      if (h > L.interconsultas) out.push({ tipo: 'interconsultas', id: i.id, horas: h, limite: L.interconsultas, asignadoA: i.asignadoA || null });
    });
    return out;
  }

  /* Un estudio se puede dar de baja solo si no tiene informe firmado ni derivación. */
  function motivoNoBaja(estudioId, informes, derivaciones) {
    if ((informes || []).some((i) => i.estudioId === estudioId && i.estado === 'firmado')) return 'El estudio tiene un informe firmado';
    if ((derivaciones || []).some((d) => d.estudioId === estudioId)) return 'El estudio tiene una derivación';
    return null;
  }

  /* Con el informe firmado, el resultado de la IA queda congelado y no se puede volver a analizar. */
  const puedeReanalizar = (estudioId, informes) => !(informes || []).some((i) => i.estudioId === estudioId && i.estado === 'firmado');

  /* Copia del resultado de la IA que se guarda en el informe al firmarlo. */
  function congelarIA(estudio, fecha) {
    return {
      resultado: estudio.resultado, probPatologia: estudio.probPatologia,
      probs: estudio.probs ? Object.assign({}, estudio.probs) : null,
      modelo: estudio.modelo ? Object.assign({}, estudio.modelo) : null,
      analizadoEn: estudio.analizadoEn || null, congeladoEn: fecha,
    };
  }

  /* Alcance del modelo: solo tórax de perro o gato. Devuelve la advertencia o null. */
  function fueraDeAlcance(tipo, especie) {
    const avisos = [];
    if (tipo !== 'Tórax') avisos.push('la región no es tórax');
    if (!['Canino', 'Felino'].includes(especie)) avisos.push('la especie no es perro ni gato');
    return avisos.length ? 'Fuera del alcance del modelo (solo tórax de perro o gato): ' + avisos.join(' y ') + '. El resultado puede no ser válido.' : null;
  }

  return { SLA_DEFECTO, mismoDia, contradicciones, contradiccionDe, demoras, motivoNoBaja, puedeReanalizar, congelarIA, fueraDeAlcance };
});

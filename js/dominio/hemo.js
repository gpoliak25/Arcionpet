/* Banco de sangre: compatibilidad donante–receptor, registro de transfusiones, solicitudes a la red y alertas.
   Funciones puras. Las reglas son de apoyo: la decisión y la prueba cruzada son del veterinario. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { hemo: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  class ErrorHemo extends Error {}
  const GRUPOS = { Canino: ['DEA 1.1 −', 'DEA 1.1 +'], Felino: ['Tipo A', 'Tipo B', 'Tipo AB'] };
  const COMPONENTES = ['Glóbulos rojos', 'Plasma fresco congelado', 'Sangre entera', 'Plaquetas'];
  const CON_GLOBULOS = ['Glóbulos rojos', 'Sangre entera'];
  const REACCIONES = { ninguna: 'Sin reacciones', leve: 'Reacción leve (fiebre, urticaria, vómito)', grave: 'Reacción grave (hemólisis, anafilaxia)' };
  const DIA = 86400000;
  const dias = (a, b) => Math.floor((new Date(b) - new Date(a)) / DIA);

  /* Compatibilidad de una unidad con un receptor.
     Devuelve { nivel: 'ok' | 'precaucion' | 'bloqueo', motivos: [] }. transfusiones: las previas del receptor. */
  function compatibilidad(unidad, receptor, transfusiones, ahora) {
    const bloqueos = [], precauciones = [];
    let nivel = 'ok';
    // los motivos de bloqueo van primero
    const sube = (n, m) => { (n === 'bloqueo' ? bloqueos : precauciones).push(m); if (n === 'bloqueo' || (n === 'precaucion' && nivel === 'ok')) nivel = n; };
    if (!receptor) return { nivel: 'bloqueo', motivos: ['Elegí el paciente receptor'] };
    if (unidad.especie !== receptor.especie) return { nivel: 'bloqueo', motivos: ['La unidad es de otra especie (' + unidad.especie + ')'] };
    const g = receptor.grupoSanguineo || null, d = unidad.grupo;
    const globulos = CON_GLOBULOS.includes(unidad.comp);
    if (receptor.especie === 'Felino') {
      // en gatos hay aloanticuerpos naturales: una sola transfusión incompatible puede ser fatal, también con plasma
      if (!g) sube('bloqueo', 'Tipificá al receptor antes de transfundir: los gatos tienen anticuerpos naturales contra el grupo que no tienen');
      else if (g === 'Tipo AB') { if (d === 'Tipo B') sube('bloqueo', 'Receptor AB: no usar sangre tipo B'); else if (d === 'Tipo A') sube('precaucion', 'Receptor AB: lo ideal es tipo AB; tipo A solo si no hay AB'); }
      else if (g !== d) sube('bloqueo', 'Incompatible: receptor ' + g + ' y unidad ' + d + ' (riesgo de hemólisis aguda)');
      sube('precaucion', 'En gatos hacé siempre prueba cruzada');
    } else {
      if (globulos && d === 'DEA 1.1 +' && g === 'DEA 1.1 −') sube('precaucion', 'Receptor DEA 1.1 − con unidad DEA 1.1 +: lo sensibiliza; una segunda transfusión así puede causar hemólisis');
      if (globulos && !g && d === 'DEA 1.1 +') sube('precaucion', 'Receptor sin tipificar: preferí DEA 1.1 − o tipificalo');
    }
    const previas = (transfusiones || []).filter((t) => t.pacienteId === receptor.id);
    if (previas.length) {
      const ult = previas.map((t) => t.fecha).sort().pop();
      const hace = dias(ult, ahora || new Date());
      if (receptor.especie === 'Canino' && globulos && d === 'DEA 1.1 +' && g === 'DEA 1.1 −' && previas.some((t) => t.grupoUnidad === 'DEA 1.1 +')) sube('bloqueo', 'Ya recibió DEA 1.1 + y es DEA 1.1 −: riesgo de hemólisis aguda');
      if (hace > 4) sube('precaucion', 'Recibió una transfusión hace ' + hace + ' días: hacé prueba cruzada (puede tener anticuerpos)');
    }
    return { nivel, motivos: bloqueos.concat(precauciones) };
  }

  /* Valida el registro de una transfusión. */
  function validarTransfusion(t) {
    const e = [];
    if (!t.pacienteId) e.push('Elegí el paciente');
    if (!(t.volumen > 0)) e.push('Indicá el volumen administrado');
    if (t.volumenUnidad && t.volumen > t.volumenUnidad) e.push('El volumen no puede superar el de la unidad (' + t.volumenUnidad + ' ml)');
    if (!['compatible', 'no_realizada'].includes(t.pruebaCruzada)) e.push('Indicá el resultado de la prueba cruzada');
    if (!REACCIONES[t.reaccion]) e.push('Indicá si hubo reacciones');
    if (t.reaccion !== 'ninguna' && !String(t.reaccionDetalle || '').trim()) e.push('Describí la reacción');
    if (t.compatibilidad === 'bloqueo' && !String(t.justificacion || '').trim()) e.push('La unidad no es compatible: justificá la decisión para continuar');
    return e;
  }

  /* Unidades de la red (otras sedes) que cubren una solicitud. */
  function candidatas(unidades, sol, ahora) {
    return (unidades || []).filter((u) => u.ubicacion !== 'Esta clínica' && u.estado === 'disponible' && new Date(u.vence) >= new Date(ahora) && u.comp === sol.comp && u.especie === sol.especie && (!sol.grupo || u.grupo === sol.grupo))
      .sort((a, b) => a.vence.localeCompare(b.vence));
  }
  function validarSolicitud(s) {
    const e = [];
    if (!COMPONENTES.includes(s.comp)) e.push('Elegí el componente');
    if (!GRUPOS[s.especie]) e.push('Elegí la especie');
    if (s.grupo && !GRUPOS[s.especie].includes(s.grupo)) e.push('Grupo inválido para la especie');
    if (!(Number.isInteger(s.cantidad) && s.cantidad >= 1 && s.cantidad <= 10)) e.push('La cantidad debe ser de 1 a 10 unidades');
    if (!String(s.motivo || '').trim()) e.push('Indicá el motivo');
    return e;
  }

  /* Reservas que vencen antes de usarse: hay que transfundir o liberar. */
  const reservasPorVencer = (unidades, diasAviso, ahora) => (unidades || []).filter((u) => u.estado === 'reservada' && dias(ahora, u.vence) >= 0 && dias(ahora, u.vence) <= diasAviso);

  return { ErrorHemo, GRUPOS, COMPONENTES, REACCIONES, compatibilidad, validarTransfusion, candidatas, validarSolicitud, reservasPorVencer };
});

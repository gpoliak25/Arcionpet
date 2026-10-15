/* Aliados: servicios de terceros que la clínica recomienda (paseadores, guarderías, hoteles, transporte, adiestradores,
   cuidadores). Directorio, verificación con documentación, recomendación al tutor, consentimiento, valoración y
   seguimiento. Funciones puras. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { aliados: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  class ErrorAliado extends Error {}
  const TIPOS = { paseador: 'Paseador', guarderia: 'Guardería', hotel: 'Hotel canino', transporte: 'Transporte de mascotas', adiestrador: 'Adiestrador', cuidador: 'Cuidador a domicilio' };
  const ESTADOS = { pendiente: 'Pendiente', verificado: 'Verificado', suspendido: 'Suspendido' };
  const TAMANOS = ['chico', 'mediano', 'grande', 'gigante'];
  const CONDICIONES = { senior: 'Senior', medicacion: 'Con medicación', post_quirurgico: 'Post quirúrgico', cachorro: 'Cachorro', reactivo: 'Reactivo o miedoso' };
  const DOCUMENTOS = { habilitacion: 'Habilitación', seguro: 'Seguro de responsabilidad civil', referencias: 'Referencias' };
  // documentación necesaria para verificar, según el tipo de servicio
  const REQUERIDOS = { paseador: ['seguro', 'referencias'], cuidador: ['seguro', 'referencias'], adiestrador: ['seguro', 'referencias'], guarderia: ['habilitacion', 'seguro'], hotel: ['habilitacion', 'seguro'], transporte: ['habilitacion', 'seguro'] };
  const AVISO_TERCERO = 'Servicio de un tercero, ajeno a la clínica.';
  const CANALES = { whatsapp: 'WhatsApp', email: 'Email' };
  const DIA = 86400000;

  function validar(a) {
    const e = [];
    if (!String(a.nombre || '').trim()) e.push('Ingresá el nombre');
    if (!TIPOS[a.tipo]) e.push('Elegí el tipo de servicio');
    if (!String(a.zona || '').trim()) e.push('Indicá la zona');
    if (!String(a.telefono || '').trim() && !String(a.email || '').trim()) e.push('Indicá un teléfono o un email de contacto');
    if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) e.push('El email no es válido');
    if (!(a.especies || []).length) e.push('Elegí al menos una especie');
    if (!(a.tamanos || []).length) e.push('Elegí al menos un tamaño');
    if (a.precioDesde != null && a.precioDesde !== '' && !(a.precioDesde >= 0)) e.push('El precio de referencia debe ser un número');
    if ((a.fotos || []).length > 6) e.push('Hasta 6 fotos por aliado');
    return e;
  }

  /* Documentos faltantes o vencidos para verificar al aliado. */
  function faltantes(a, ahora) {
    const docs = a.documentos || {};
    return (REQUERIDOS[a.tipo] || []).filter((k) => { const d = docs[k]; return !d || !String(d.detalle || '').trim() || (d.vence && new Date(d.vence) < new Date(ahora)); });
  }
  function verificar(a, ahora, quien) {
    const f = faltantes(a, ahora);
    if (f.length) throw new ErrorAliado('Falta documentación vigente: ' + f.map((k) => DOCUMENTOS[k].toLowerCase()).join(', '));
    return Object.assign({}, a, { estado: 'verificado', verificacion: { fecha: ahora, por: quien } });
  }

  /* Condiciones del paciente que importan para elegir el servicio. */
  function condicionesPaciente(p, ctx) {
    const c = [];
    const anios = p.nacimiento ? (new Date(ctx.ahora) - new Date(p.nacimiento)) / (365.25 * DIA) : null;
    if (anios != null && anios >= (p.especie === 'Felino' ? 10 : 8)) c.push('senior');
    if (anios != null && anios < 1) c.push('cachorro');
    if ((ctx.recetasVigentes || 0) > 0) c.push('medicacion');
    if (ctx.cirugiaReciente) c.push('post_quirurgico');
    return c;
  }
  /* Filtra el directorio. f = { tipo, especie, tamano, zona, condiciones: [], soloVerificados } */
  function filtrar(aliados, f) {
    return (aliados || []).filter((a) => (!f.tipo || a.tipo === f.tipo) && (!f.especie || (a.especies || []).includes(f.especie)) && (!f.tamano || (a.tamanos || []).includes(f.tamano)) &&
      (!f.zona || String(a.zona).toLowerCase().includes(String(f.zona).toLowerCase())) && (f.condiciones || []).every((c) => (a.condiciones || []).includes(c)) && (!f.soloVerificados || a.estado === 'verificado'));
  }

  /* Mensaje para el tutor: siempre aclara que es un tercero e informa el acuerdo comercial si existe. */
  function mensaje({ aliado, paciente, tutor, motivo, clinica }) {
    const l = ['Hola, ' + tutor.nombre + '. Desde ' + (clinica.nombre || 'la clínica') + ' te recomendamos a ' + aliado.nombre + ' (' + TIPOS[aliado.tipo].toLowerCase() + ') para ' + paciente.nombre + '.'];
    if (String(motivo || '').trim()) l.push('Motivo: ' + motivo.trim());
    l.push('Contacto: ' + [aliado.telefono, aliado.email].filter(Boolean).join(' · ') + (aliado.zona ? ' · zona ' + aliado.zona : ''));
    l.push(AVISO_TERCERO + ' La contratación y el pago son directamente con el proveedor.');
    if (String(aliado.acuerdoComercial || '').trim()) l.push('Te informamos que la clínica tiene un acuerdo comercial con este proveedor: ' + aliado.acuerdoComercial.trim() + '.');
    l.push('No compartimos datos tuyos ni de ' + paciente.nombre + ' con el proveedor sin tu autorización.');
    return l.join('\n');
  }

  function validarValoracion(puntaje, comentario) {
    const e = [];
    if (!(Number.isInteger(puntaje) && puntaje >= 1 && puntaje <= 5)) e.push('La valoración va de 1 a 5');
    if (String(comentario || '').length > 500) e.push('El comentario es demasiado largo');
    return e;
  }
  function promedio(aliadoId, recs) {
    const v = (recs || []).filter((r) => r.aliadoId === aliadoId && r.valoracion).map((r) => r.valoracion.puntaje);
    return v.length ? { promedio: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10, n: v.length } : { promedio: null, n: 0 };
  }

  /* Seguimiento: recomendaciones enviadas y concretadas (opcionalmente, en un rango de fechas). */
  function seguimiento(recs, aliados, r) {
    const en = (f) => !r || ((!r.desde || new Date(f) >= r.desde) && new Date(f) < r.hasta);
    const lista = (recs || []).filter((x) => en(x.fecha));
    const conc = lista.filter((x) => x.concretada);
    const porTipo = {};
    lista.forEach((x) => { const a = (aliados || []).find((y) => y.id === x.aliadoId) || {}; const k = a.tipo || 'otro'; porTipo[k] = porTipo[k] || { enviadas: 0, concretadas: 0 }; porTipo[k].enviadas++; if (x.concretada) porTipo[k].concretadas++; });
    const val = lista.filter((x) => x.valoracion).map((x) => x.valoracion.puntaje);
    return { enviadas: lista.length, concretadas: conc.length, tasa: lista.length ? Math.round(conc.length / lista.length * 100) : 0, valoracion: val.length ? Math.round(val.reduce((a, b) => a + b, 0) / val.length * 10) / 10 : null, porTipo };
  }

  return { ErrorAliado, TIPOS, ESTADOS, TAMANOS, CONDICIONES, DOCUMENTOS, REQUERIDOS, AVISO_TERCERO, CANALES, validar, faltantes, verificar, condicionesPaciente, filtrar, mensaje, validarValoracion, promedio, seguimiento };
});

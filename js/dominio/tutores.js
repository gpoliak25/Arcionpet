/* Tutores: validación de la ficha e historial (mascotas, turnos y compras). Funciones puras. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { tutores: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  // La RVE "Prescripción en mascotas" (Res. SENASA 654/2026, art. 18 d) pide DNI, CUIT o pasaporte del titular.
  const TIPOS_DOC = { DNI: 'DNI', CUIT: 'CUIT', PAS: 'Pasaporte' };

  const soloDigitos = (s) => String(s || '').replace(/\D/g, '');
  /* Normaliza el documento para compararlo: DNI y CUIT sin puntos ni guiones; pasaporte en mayúsculas sin espacios. */
  function normalizarDoc(tipo, doc) {
    return tipo === 'PAS' ? String(doc || '').toUpperCase().replace(/\s/g, '') : soloDigitos(doc);
  }

  function validar(t, todos) {
    const errores = [];
    if (!String(t.nombre || '').trim()) errores.push('Ingresá el nombre');
    if (!String(t.apellido || '').trim()) errores.push('Ingresá el apellido');
    const tipo = t.tipoDoc || 'DNI';
    if (!TIPOS_DOC[tipo]) errores.push('Tipo de documento inválido');
    const doc = normalizarDoc(tipo, t.doc);
    if (!doc) errores.push('Ingresá el documento');
    else if (tipo === 'DNI' && (doc.length < 7 || doc.length > 8)) errores.push('El DNI debe tener 7 u 8 dígitos');
    else if (tipo === 'CUIT' && doc.length !== 11) errores.push('El CUIT debe tener 11 dígitos');
    else if (tipo === 'PAS' && doc.length < 5) errores.push('El pasaporte parece incompleto');
    if (doc && (todos || []).some((o) => o.id !== t.id && (o.tipoDoc || 'DNI') === tipo && normalizarDoc(tipo, o.doc) === doc)) errores.push('Ya existe un tutor con ese documento');
    if (t.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) errores.push('El email no es válido');
    if (t.cuit && soloDigitos(t.cuit).length !== 11) errores.push('El CUIT debe tener 11 dígitos');
    return errores;
  }

  const mascotasDe = (tutorId, pacientes) => pacientes.filter((p) => p.tutorId === tutorId);

  /* Turnos de todas las mascotas del tutor, del más reciente al más antiguo. */
  function historialTurnos(tutorId, pacientes, turnos) {
    const ids = new Set(mascotasDe(tutorId, pacientes).map((p) => p.id));
    return turnos.filter((t) => ids.has(t.pacienteId)).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  /* Compras del tutor (módulo Ventas). Se excluyen anuladas del total. */
  function compras(tutorId, ventas) {
    const lista = (ventas || []).filter((v) => v.tutorId === tutorId).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = lista.filter((v) => v.estado !== 'anulada').reduce((s, v) => s + (v.total || 0), 0);
    return { lista, total };
  }

  /* Próximo turno activo y última visita atendida. */
  function resumen(tutorId, pacientes, turnos, ahora) {
    const h = historialTurnos(tutorId, pacientes, turnos);
    const ref = (ahora || new Date()).toISOString();
    const proximo = h.filter((t) => t.fecha >= ref && ['confirmado', 'pendiente'].includes(t.estado)).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
    const ultima = h.find((t) => t.estado === 'atendido') || null;
    return { proximo, ultima, mascotas: mascotasDe(tutorId, pacientes).length };
  }

  return { TIPOS_DOC, normalizarDoc, validar, mascotasDe, historialTurnos, compras, resumen };
});

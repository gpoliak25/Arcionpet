/* Emisión de la Receta Veterinaria Electrónica (RVE) desde ArcionPet (Res. SENASA 654/2026, art. 17 y 18 d).
   La integración con SENASA/SIGTRAZAVET depende de la especificación técnica que publique la DNSA. Por eso la emisión
   pasa por un adapter:
   - adapterSimulado (solo con DEMO_MODE): asigna un número único con prefijo SIM.
   - adapterPendiente (sin DEMO_MODE): registra la emisión como "pendiente de integración", sin número: no habilita
     ventas hasta cargar el CUVE que devuelva SIGTRAZAVET o SIGTrámites.
   Cada emisión queda registrada. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./ventas.js'));
  else root.Dominio = Object.assign(root.Dominio || {}, { rve: factory(root.Dominio.ventas) });
})(typeof self !== 'undefined' ? self : this, function (V) {
  class ErrorRVE extends Error {}

  const adapterSimulado = {
    nombre: 'Simulación (DEMO_MODE)',
    emitir(receta, emitidas) {
      const n = (emitidas || []).filter((r) => r.cuve && /^SIM-/.test(r.cuve)).length + 1;
      return { cuve: 'SIM-' + String(receta.emision).slice(0, 4) + '-' + String(n).padStart(8, '0'), estado: 'vigente' };
    },
  };
  const adapterPendiente = {
    nombre: 'SIGTRAZAVET (pendiente de especificación técnica)',
    emitir() { return { cuve: '', estado: 'pendiente_integracion' }; },
  };

  /* Valida la emisión: prescriptor veterinario con matrícula y datos del art. 18 d (sin exigir el CUVE, que lo asigna el sistema). */
  function validarEmision(receta, prescriptor, productos, hoy) {
    const e = [];
    if (!prescriptor || prescriptor.rol !== 'veterinario') e.push('Solo un veterinario puede emitir recetas');
    else if (!String(prescriptor.matricula || '').trim()) e.push('El veterinario necesita matrícula para emitir recetas');
    (receta.items || []).forEach((it) => {
      const p = (productos || []).find((x) => x.id === it.productoId);
      if (it.productoId && !p) e.push('Producto inexistente en la receta');
    });
    // el CUVE lo asigna la emisión y el prescriptor es el veterinario que emite
    const vet = { nombre: (prescriptor || {}).nombre, matricula: (prescriptor || {}).matricula };
    V.validarReceta(Object.assign({}, receta, { cuve: 'XXXXXXXX', veterinario: vet }), hoy).forEach((x) => { if (!e.includes(x)) e.push(x); });
    return e;
  }

  function emitir(receta, { prescriptor, productos, emitidas, demo, fecha, id }) {
    const hoy = new Date(fecha);
    const errores = validarEmision(receta, prescriptor, productos, hoy);
    if (errores.length) throw new ErrorRVE(errores[0]);
    const adapter = demo ? adapterSimulado : adapterPendiente;
    const r = adapter.emitir(receta, emitidas);
    return Object.assign({}, receta, {
      id, tipo: 'mascotas', origen: 'emitida', cuve: r.cuve, estado: r.estado, emision: receta.emision,
      veterinario: { nombre: prescriptor.nombre, matricula: prescriptor.matricula, usuarioId: prescriptor.id },
      emisionRegistro: { fecha, adapter: adapter.nombre },
    });
  }

  /* Cargar el CUVE devuelto por SIGTRAZAVET o SIGTrámites a una emisión pendiente. */
  function asignarCuve(receta, cuve, existentes) {
    if (receta.estado !== 'pendiente_integracion') throw new ErrorRVE('La receta no está pendiente de integración');
    if (!/^[A-Za-z0-9-]{8,}$/.test(String(cuve || '').trim())) throw new ErrorRVE('El CUVE debe tener al menos 8 caracteres (letras, números o guiones)');
    if ((existentes || []).some((r) => r.id !== receta.id && r.cuve && r.cuve.toUpperCase() === cuve.trim().toUpperCase())) throw new ErrorRVE('Ese CUVE ya está registrado');
    return Object.assign({}, receta, { cuve: cuve.trim(), estado: 'vigente' });
  }

  return { ErrorRVE, adapterSimulado, adapterPendiente, validarEmision, emitir, asignarCuve };
});

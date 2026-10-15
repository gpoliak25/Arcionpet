/* Permisos por rol. Niveles: ninguno < ver < editar < todo.
   Es control de interfaz para la demo: sin backend no hay seguridad real. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { permisos: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const NIVELES = { ninguno: 0, ver: 1, editar: 2, todo: 3 };

  const ROLES = {
    veterinario: 'Veterinario/a',
    recepcion: 'Recepción',
    peluqueria: 'Peluquería',
    administracion: 'Administración',
  };

  //                     veterinario  recepcion  peluqueria  administracion
  const MATRIZ = {
    inicio:          ['ver',      'ver',      'ver',      'ver'],
    pacientes:       ['editar',   'editar',   'ver',      'ver'],
    tutores:         ['editar',   'editar',   'ver',      'ver'],
    hemocomponentes: ['todo',     'ver',      'ninguno',  'ver'],
    imagenes:        ['todo',     'editar',   'ninguno',  'ver'],
    triage:          ['todo',     'ver',      'ninguno',  'ver'],
    informes:        ['todo',     'ver',      'ninguno',  'ver'],
    derivaciones:    ['todo',     'ver',      'ninguno',  'ver'],
    inventario:      ['editar',   'editar',   'ver',      'todo'],
    ventas:          ['editar',   'editar',   'editar',   'todo'],
    turnos:          ['editar',   'todo',     'ninguno',  'ver'],
    peluqueria:      ['ninguno',  'todo',     'editar',   'ver'],
    interconsultas:  ['todo',     'ninguno',  'ninguno',  'ver'],
    arcion:          ['ver',      'ver',      'ver',      'ver'],
    calidad:         ['ver',      'ninguno',  'ninguno',  'ver'],
    analitica:       ['ver',      'ninguno',  'ninguno',  'ver'],
    modelo:          ['todo',     'ninguno',  'ninguno',  'ver'],
  };
  const ORDEN = ['veterinario', 'recepcion', 'peluqueria', 'administracion'];

  /* Acciones puntuales que no se deducen del nivel del módulo. */
  const ACCIONES = {
    firmarInforme: ['veterinario'], // la firma del informe es exclusiva del veterinario
    anularVenta: ['administracion'],
    venderFarmacia: ['veterinario', 'recepcion', 'administracion'],
    editarPrecios: ['administracion'],
  };

  function nivel(rol, modulo) {
    const fila = MATRIZ[modulo];
    const i = ORDEN.indexOf(rol);
    if (!fila || i < 0) return 0;
    return NIVELES[fila[i]];
  }
  /* puede(rol, 'pacientes', 'editar') — el nivel por defecto es 'ver' */
  function puede(rol, modulo, requerido) {
    return nivel(rol, modulo) >= NIVELES[requerido || 'ver'];
  }
  function puedeAccion(rol, accion) {
    return (ACCIONES[accion] || []).includes(rol);
  }

  /* Ajustes y bajas de stock: administración en todo el inventario; el veterinario solo en farmacia. */
  function puedeAjustarStock(rol, catalogo) {
    return rol === 'administracion' || (rol === 'veterinario' && catalogo === 'farmacia');
  }

  return { ROLES, MATRIZ, ACCIONES, NIVELES, nivel, puede, puedeAccion, puedeAjustarStock };
});

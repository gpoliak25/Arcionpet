/* Configuración de la clínica: datos, módulos habilitados, umbrales y SLA. Funciones puras con validación. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { configuracion: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  /* Módulos opcionales: cada uno muestra u oculta su grupo en el menú. */
  const MODULOS = {
    inventario: 'Inventario y ventas (pet shop, farmacia, ventas y recetas)',
    servicios: 'Servicios (turnos)',
    peluqueria: 'Peluquería',
    aliados: 'Aliados (servicios de terceros recomendados)',
  };
  const CONDICIONES_IVA = ['Responsable inscripto', 'Monotributo', 'Exento'];
  const DEFECTO = {
    demoMode: false,
    modulos: { inventario: true, servicios: true, peluqueria: true, aliados: true },
    compartirAliadosRed: false,
    sla: { triage: 24, derivaciones: 72, interconsultas: 48 },
    umbrales: { incierto: 0.20, patologico: 0.30, avisoFarmacia: 30, avisoHemo: 7 },
    clinica: { nombre: 'Veterinaria ArcionPet (ejemplo)', razonSocial: 'ArcionPet Demo S.A. (ficticia)', cuit: '30-99999999-7', condicionIva: 'Responsable inscripto', domicilio: 'Av. Siempreviva 742, CABA', telefono: '11 5555-0000', email: 'contacto@example.com', habilitacion: '' },
  };

  const esEntero = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

  function validar(c) {
    const e = [];
    const u = c.umbrales || {};
    if (!(u.incierto > 0 && u.incierto < 1 && u.patologico > 0 && u.patologico < 1)) e.push('Los umbrales de la IA deben estar entre 0 y 1 (por ejemplo 0,20 y 0,30)');
    else if (!(u.incierto < u.patologico)) e.push('El umbral de "incierto" tiene que ser menor que el de "patológico"');
    if (!esEntero(u.avisoFarmacia, 1, 365)) e.push('El aviso de vencimiento de farmacia debe ser de 1 a 365 días');
    if (!esEntero(u.avisoHemo, 1, 60)) e.push('El aviso de vencimiento de hemocomponentes debe ser de 1 a 60 días');
    const s = c.sla || {};
    ['triage', 'derivaciones', 'interconsultas'].forEach((k) => { if (!esEntero(s[k], 1, 720)) e.push('El SLA de ' + k + ' debe ser de 1 a 720 horas'); });
    const cl = c.clinica || {};
    if (!String(cl.nombre || '').trim()) e.push('Ingresá el nombre de la clínica');
    if (cl.cuit && String(cl.cuit).replace(/\D/g, '').length !== 11) e.push('El CUIT de la clínica debe tener 11 dígitos');
    if (cl.condicionIva && !CONDICIONES_IVA.includes(cl.condicionIva)) e.push('Condición frente al IVA inválida');
    if (cl.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cl.email)) e.push('El email de la clínica no es válido');
    const f = c.facturacion;
    if (f) {
      const pv = f.puntosVenta || [];
      if (!pv.length) e.push('Configurá al menos un punto de venta');
      if (pv.some((p) => !esEntero(p.numero, 1, 99999) || !String(p.nombre || '').trim())) e.push('Cada punto de venta necesita un número de 1 a 99999 y un nombre');
      if (new Set(pv.map((p) => p.numero)).size !== pv.length) e.push('Hay puntos de venta con el mismo número');
      if (!pv.some((p) => p.numero === f.puntoVenta)) e.push('El punto de venta por defecto no existe');
      if (f.modo !== 'homologacion') e.push('Sin credenciales del proveedor de facturación electrónica solo se puede operar en homologación');
    }
    return e;
  }

  /* Un usuario debe quedar como administrador activo (si no, nadie podría configurar el sistema). */
  function validarUsuarios(usuarios) {
    const e = [];
    if (!usuarios.some((u) => u.rol === 'administracion' && u.activo !== false)) e.push('Tiene que quedar al menos un usuario de administración activo');
    usuarios.forEach((u) => {
      if (!String(u.nombre || '').trim()) e.push('Hay un usuario sin nombre');
      if (u.rol === 'veterinario' && u.activo !== false && !String(u.matricula || '').trim()) e.push(u.nombre + ': los veterinarios necesitan matrícula (firman informes y recetas)');
    });
    return e;
  }

  const habilitado = (config, modulo) => !modulo || !config || !config.modulos || config.modulos[modulo] !== false;

  return { MODULOS, CONDICIONES_IVA, DEFECTO, validar, validarUsuarios, habilitado };
});

/* Migraciones del esquema de datos guardado en el navegador.
   Cada paso tiene up (sube una versión) y down (la revierte sin perder los datos originales).
   Funciones puras: reciben un estado y devuelven uno nuevo. Se usan en el navegador y en los tests de Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { migraciones: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const clonar = (o) => JSON.parse(JSON.stringify(o));

  const USUARIOS_DEMO = [
    { id: 'u-vet', nombre: 'Dra. Laura Giménez', iniciales: 'LG', rol: 'veterinario' },
    { id: 'u-rec', nombre: 'Martina Ruiz', iniciales: 'MR', rol: 'recepcion' },
    { id: 'u-pel', nombre: 'Lucas Benítez', iniciales: 'LB', rol: 'peluqueria' },
    { id: 'u-adm', nombre: 'Sofía Herrera', iniciales: 'SH', rol: 'administracion' },
  ];

  const PASOS = [
    {
      de: 8, a: 9, descripcion: 'Usuarios de la demo y rol activo (selector de roles)',
      up(s) {
        s.usuarios = clonar(USUARIOS_DEMO);
        s.usuarioActivo = 'u-vet';
        return s;
      },
      down(s) {
        delete s.usuarios;
        delete s.usuarioActivo;
        return s;
      },
    },
    {
      de: 9, a: 10, descripcion: 'Ficha de tutor: tipo de documento, CUIT, domicilio, notas y baja lógica',
      up(s) {
        s.tutores = s.tutores.map((t) => Object.assign({ tipoDoc: 'DNI', cuit: '', domicilio: '', notas: '', activo: true }, t));
        return s;
      },
      down(s) {
        s.tutores = s.tutores.map((t) => { const c = Object.assign({}, t); ['tipoDoc', 'cuit', 'domicilio', 'notas', 'activo', 'fechaBaja'].forEach((k) => delete c[k]); return c; });
        return s;
      },
    },
  ];

  const VERSION_BASE = PASOS[0].de;
  const VERSION_ACTUAL = PASOS[PASOS.length - 1].a;

  /* Sube el estado hasta la versión pedida (por defecto, la actual). */
  function migrar(estado, hasta) {
    const destino = hasta == null ? VERSION_ACTUAL : hasta;
    let s = clonar(estado);
    if (s.version < VERSION_BASE) throw new Error('Versión ' + s.version + ' anterior al sistema de migraciones');
    if (s.version > destino) throw new Error('Versión ' + s.version + ' más nueva que la destino ' + destino);
    while (s.version < destino) {
      const paso = PASOS.find((p) => p.de === s.version);
      if (!paso) throw new Error('No hay migración desde la versión ' + s.version);
      s = paso.up(s);
      s.version = paso.a;
    }
    return s;
  }

  /* Baja el estado hasta la versión pedida aplicando los down en orden inverso. */
  function revertir(estado, hasta) {
    let s = clonar(estado);
    if (hasta < VERSION_BASE) throw new Error('No se puede revertir antes de la versión ' + VERSION_BASE);
    while (s.version > hasta) {
      const paso = PASOS.find((p) => p.a === s.version);
      if (!paso) throw new Error('No hay reversión desde la versión ' + s.version);
      s = paso.down(s);
      s.version = paso.de;
    }
    return s;
  }

  return { migrar, revertir, PASOS, VERSION_BASE, VERSION_ACTUAL, USUARIOS_DEMO };
});

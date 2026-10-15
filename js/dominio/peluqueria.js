/* Peluquería: servicios con precio y duración por tamaño (y recargo por pelaje largo), ficha por mascota e insumos.
   Funciones puras. La agenda usa la lógica de turnos (Dominio.turnos) con peluqueros como recurso. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { peluqueria: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  class ErrorPeluqueria extends Error {}
  const TAMANOS = { chico: 'Chico (hasta 10 kg)', mediano: 'Mediano (10 a 25 kg)', grande: 'Grande (25 a 45 kg)', gigante: 'Gigante (más de 45 kg)' };
  // razas de pelo largo o doble manto: llevan más tiempo de baño y corte
  const PELO_LARGO = /caniche|poodle|bich[oó]n|shih ?tzu|maltés|maltes|yorkshire|lhasa|schnauzer|golden|collie|ovejero|pastor|chow|samoyedo|husky|akita|persa|maine coon|angora|cocker|spitz|pomerania|terranova|san bernardo|bobtail/i;
  const MAX_FOTOS = 12;

  /* Tamaño de la mascota: el de la ficha si está cargado; si no, por peso. */
  function tamano(paciente, ficha) {
    if (ficha && TAMANOS[ficha.tamano]) return ficha.tamano;
    const kg = Number(paciente && paciente.peso);
    if (!(kg > 0)) return 'mediano';
    return kg <= 10 ? 'chico' : kg <= 25 ? 'mediano' : kg <= 45 ? 'grande' : 'gigante';
  }
  const peloLargo = (paciente) => PELO_LARGO.test(String((paciente && paciente.raza) || ''));

  /* Precio (IVA incluido) y duración del servicio para una mascota. */
  function cotizar(servicio, paciente, ficha) {
    const tam = tamano(paciente, ficha);
    const base = (servicio.porTamano || {})[tam];
    if (!base) throw new ErrorPeluqueria(servicio.nombre + ': no tiene precio para tamaño ' + tam);
    const largo = servicio.recargoPeloLargo && peloLargo(paciente);
    const r5 = (n) => Math.round(n / 5) * 5;
    return { tamano: tam, peloLargo: !!largo, precio: Math.round(base.precio * (largo ? 1.2 : 1) / 100) * 100, duracion: r5(base.duracion * (largo ? 1.25 : 1)) };
  }

  function validarServicio(sv) {
    const e = [];
    if (!String(sv.nombre || '').trim()) e.push('Ingresá el nombre del servicio');
    Object.keys(TAMANOS).forEach((t) => {
      const x = (sv.porTamano || {})[t];
      if (!x || !(x.precio > 0)) e.push('Precio inválido para tamaño ' + t);
      else if (!(Number.isInteger(x.duracion) && x.duracion >= 5 && x.duracion <= 480)) e.push('Duración inválida para tamaño ' + t + ' (5 a 480 min)');
    });
    if (sv.frecuenciaDias != null && sv.frecuenciaDias !== '' && !(Number.isInteger(sv.frecuenciaDias) && sv.frecuenciaDias >= 7 && sv.frecuenciaDias <= 365)) e.push('La frecuencia sugerida debe ser de 7 a 365 días');
    (sv.insumos || []).forEach((i) => { if (!i.productoId || !(Number.isInteger(i.cantidad) && i.cantidad > 0)) e.push('Insumo inválido'); });
    return e;
  }

  function validarFicha(f) {
    const e = [];
    if (f.tamano && !TAMANOS[f.tamano]) e.push('Tamaño inválido');
    ['preferencias', 'temperamento', 'piel', 'observaciones'].forEach((k) => { if (String(f[k] || '').length > 1000) e.push('El texto de ' + k + ' es demasiado largo'); });
    if ((f.fotos || []).length > MAX_FOTOS) e.push('La ficha admite hasta ' + MAX_FOTOS + ' fotos: quitá alguna antes de agregar otra');
    return e;
  }

  /* Próxima visita sugerida según la frecuencia del servicio. */
  function proximaVisita(servicio, fecha) {
    if (!servicio.frecuenciaDias) return null;
    const d = new Date(fecha); d.setDate(d.getDate() + servicio.frecuenciaDias);
    return d.toISOString().slice(0, 10);
  }

  return { ErrorPeluqueria, TAMANOS, MAX_FOTOS, tamano, peloLargo, cotizar, validarServicio, validarFicha, proximaVisita };
});

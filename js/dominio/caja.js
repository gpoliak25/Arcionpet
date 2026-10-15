/* Caja: apertura, movimientos de efectivo, cierre con arqueo. Funciones puras.
   Solo el efectivo pasa por la caja; los demás medios se informan en el resumen del turno. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { caja: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  class ErrorCaja extends Error {}
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const r2 = (n) => Math.round(n * 100) / 100;

  const abierta = (cajas) => (cajas || []).find((c) => c.estado === 'abierta') || null;

  function abrir(cajas, { montoInicial, usuario, fecha, id }) {
    if (abierta(cajas)) throw new ErrorCaja('Ya hay una caja abierta: cerrala antes de abrir otra');
    if (!(typeof montoInicial === 'number' && montoInicial >= 0)) throw new ErrorCaja('El monto inicial debe ser un número mayor o igual a cero');
    const c = { id, estado: 'abierta', apertura: fecha, usuarioApertura: usuario, montoInicial: r2(montoInicial), movimientos: [] };
    return { cajas: (cajas || []).concat([c]), caja: c };
  }

  /* tipo: venta | devolucion | ingreso | retiro. monto con signo según el tipo (venta e ingreso suman). */
  function movimiento(cajas, { tipo, medio, monto, ref, nota, usuario, fecha }) {
    const s = clonar(cajas || []);
    const c = abierta(s);
    if (!c) throw new ErrorCaja('La caja está cerrada: abrila para registrar ventas');
    if (!(monto > 0)) throw new ErrorCaja('El monto debe ser mayor a cero');
    const signo = tipo === 'venta' || tipo === 'ingreso' ? 1 : -1;
    c.movimientos.push({ tipo, medio, monto: r2(signo * monto), ref: ref || null, nota: nota || '', usuario, fecha });
    if (medio === 'efectivo' && efectivoEsperado(c) < 0) throw new ErrorCaja('No hay suficiente efectivo en la caja');
    return s;
  }

  const efectivoEsperado = (c) => r2(c.montoInicial + c.movimientos.filter((m) => m.medio === 'efectivo').reduce((t, m) => t + m.monto, 0));
  function porMedio(c) {
    const r = {};
    c.movimientos.filter((m) => m.tipo === 'venta' || m.tipo === 'devolucion').forEach((m) => { r[m.medio] = r2((r[m.medio] || 0) + m.monto); });
    return r;
  }

  function cerrar(cajas, { efectivoContado, usuario, fecha, nota }) {
    const s = clonar(cajas || []);
    const c = abierta(s);
    if (!c) throw new ErrorCaja('No hay una caja abierta');
    if (!(typeof efectivoContado === 'number' && efectivoContado >= 0)) throw new ErrorCaja('Ingresá el efectivo contado');
    const esperado = efectivoEsperado(c);
    Object.assign(c, { estado: 'cerrada', cierre: fecha, usuarioCierre: usuario, efectivoEsperado: esperado, efectivoContado: r2(efectivoContado), diferencia: r2(efectivoContado - esperado), notaCierre: nota || '', resumen: porMedio(c) });
    return { cajas: s, caja: c };
  }

  return { ErrorCaja, abierta, abrir, movimiento, efectivoEsperado, porMedio, cerrar };
});

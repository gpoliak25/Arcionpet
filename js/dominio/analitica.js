/* Analítica por período: turnos (clínica y peluquería), ventas y hemocomponentes. Funciones puras. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { analitica: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const PERIODOS = { 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días', 365: 'Último año', todo: 'Todo' };

  /* Rango [desde, hasta) para un período contado hacia atrás desde hoy (incluye el día de hoy). */
  function rango(periodo, ahora) {
    const hasta = new Date(ahora); hasta.setHours(24, 0, 0, 0);
    if (periodo === 'todo') return { desde: null, hasta };
    const desde = new Date(hasta); desde.setDate(desde.getDate() - Number(periodo));
    return { desde, hasta };
  }
  const en = (fecha, r) => { const d = new Date(fecha); return (!r.desde || d >= r.desde) && d < r.hasta; };
  const contar = (lista, clave) => lista.reduce((o, x) => { const k = typeof clave === 'function' ? clave(x) : x[clave]; o[k] = (o[k] || 0) + 1; return o; }, {});
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

  /* Turnos del período (no cuenta los futuros). Ausentismo = no vino / (atendidos + no vino). */
  function turnos(lista, r, ahora) {
    const t = (lista || []).filter((x) => en(x.fecha, r) && new Date(x.fecha) <= new Date(ahora));
    const est = contar(t, 'estado');
    const cerrados = (est.atendido || 0) + (est.no_vino || 0);
    return {
      total: t.length, porEstado: est, ausentismo: pct(est.no_vino || 0, cerrados), cancelados: pct(est.cancelado || 0, t.length),
      porServicio: Object.entries(contar(t, 'tipo')).sort((a, b) => b[1] - a[1]),
      desdePortal: pct(t.filter((x) => x.origen === 'portal').length, t.length),
      minutosAtendidos: t.filter((x) => x.estado === 'atendido').reduce((s, x) => s + (x.duracion || 0), 0),
    };
  }

  /* Ventas del período: facturación neta de devoluciones, por medio, por catálogo y productos más vendidos. */
  function ventas(lista, r) {
    const v = (lista || []).filter((x) => en(x.fecha, r) && x.estado !== 'anulada');
    const devuelto = (x) => (x.devoluciones || []).reduce((s, d) => s + d.importe, 0);
    const neto = v.reduce((s, x) => s + x.total - devuelto(x), 0);
    const porMedio = {}, porCatalogo = {}, prod = {};
    v.forEach((x) => {
      porMedio[x.medioPago] = (porMedio[x.medioPago] || 0) + x.total - devuelto(x);
      x.items.forEach((i) => {
        const cat = i.servicio ? 'servicios' : i.catalogo;
        porCatalogo[cat] = (porCatalogo[cat] || 0) + i.subtotal;
        const k = i.nombre; prod[k] = prod[k] || { nombre: k, unidades: 0, importe: 0 }; prod[k].unidades += i.cantidad; prod[k].importe += i.subtotal;
      });
    });
    const cobradas = v.filter((x) => x.estado !== 'devuelta');
    return {
      cantidad: cobradas.length, total: neto, ticket: cobradas.length ? Math.round(neto / cobradas.length) : 0,
      devoluciones: v.reduce((s, x) => s + devuelto(x), 0), porMedio, porCatalogo,
      top: Object.values(prod).sort((a, b) => b.importe - a.importe).slice(0, 8),
    };
  }

  /* Hemocomponentes: inventario actual y eventos del período (transfusiones y vencimientos). */
  function hemocomponentes(lista, r) {
    const u = lista || [];
    const eventos = u.flatMap((x) => (x.eventos || []).map((e) => Object.assign({ unidad: x.id, comp: x.comp }, e))).filter((e) => en(e.fecha, r));
    const transf = eventos.filter((e) => e.tipo === 'transfusion').length, venc = eventos.filter((e) => e.tipo === 'vencimiento').length;
    return {
      porEstado: contar(u, 'estado'),
      disponiblesPorComp: contar(u.filter((x) => x.estado === 'disponible'), 'comp'),
      transfusiones: transf, vencidas: venc, descarte: pct(venc, transf + venc),
      porTipoEvento: contar(eventos, 'tipo'),
    };
  }

  return { PERIODOS, rango, en, turnos, ventas, hemocomponentes };
});

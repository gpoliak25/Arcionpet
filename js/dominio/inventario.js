/* Inventario unificado (pet shop y farmacia veterinaria). Funciones puras.
   El stock de un producto es la suma de sus lotes. Cada cambio de stock genera un movimiento (auditoría: nada se borra).
   Reglas: no se permite stock negativo; en farmacia, lote y vencimiento son obligatorios y lo vencido no se vende.
   Productos alcanzados por SIGTRAZAVET: las contingencias (vencimiento, merma, rotura, robo) se declaran dentro de
   los 10 días corridos (Res. SENASA 654/2026, art. 12). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { inventario: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const CATALOGOS = { petshop: 'Pet shop', farmacia: 'Farmacia veterinaria' };
  const CATEGORIAS = {
    petshop: ['Alimentos', 'Correas y accesorios', 'Ropa', 'Juguetes'],
    farmacia: ['Antiparasitarios', 'Medicamentos', 'Vacunas', 'Insumos sanitarios'],
  };
  const DIAS_AVISO_FARMACIA = 30;
  const DIAS_DECLARACION = 10;
  const MOTIVOS_AJUSTE = { merma: 'Merma', rotura: 'Rotura', robo: 'Robo o hurto', conteo: 'Diferencia de conteo', devolucion: 'Devolución a proveedor' };
  // motivos que, en productos alcanzados, son contingencias a declarar (art. 12)
  const CONTINGENCIAS = ['vencimiento', 'merma', 'rotura', 'robo'];

  const DIA = 86400000;
  const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const diasHasta = (fecha, hoy) => Math.round((inicioDia(fecha) - inicioDia(hoy)) / DIA);
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const entero = (n) => Number.isInteger(n) ? n : NaN;

  class ErrorStock extends Error {}

  const lotesDe = (productoId, lotes) => lotes.filter((l) => l.productoId === productoId);
  const vencido = (l, hoy) => !!l.vence && diasHasta(l.vence, hoy) < 0;

  /* Stock total, vendible (sin vencidos), próximo vencimiento y alertas de un producto. */
  function estado(producto, lotes, hoy) {
    const h = hoy || new Date();
    const ls = lotesDe(producto.id, lotes).filter((l) => l.cantidad > 0);
    const total = ls.reduce((s, l) => s + l.cantidad, 0);
    const vencidos = ls.filter((l) => vencido(l, h));
    const vendible = total - vencidos.reduce((s, l) => s + l.cantidad, 0);
    const conVence = ls.filter((l) => l.vence && !vencido(l, h)).sort((a, b) => a.vence.localeCompare(b.vence));
    const proximo = conVence[0] || null;
    const diasProximo = proximo ? diasHasta(proximo.vence, h) : null;
    const porVencer = producto.catalogo === 'farmacia' && proximo && diasProximo <= DIAS_AVISO_FARMACIA;
    return {
      total, vendible, vencidos: vencidos.reduce((s, l) => s + l.cantidad, 0),
      sinStock: vendible <= 0, bajoMinimo: vendible <= (producto.stockMinimo || 0),
      proximoVence: proximo ? proximo.vence : null, diasProximo, porVencer: !!porVencer,
    };
  }

  /* Lotes de farmacia con stock que vencen en los próximos N días o ya vencieron. */
  function vencimientos(productos, lotes, hoy, dias) {
    const h = hoy || new Date(), lim = dias == null ? DIAS_AVISO_FARMACIA : dias;
    const farmacia = new Set(productos.filter((p) => p.catalogo === 'farmacia' && p.activo !== false).map((p) => p.id));
    const conStock = lotes.filter((l) => farmacia.has(l.productoId) && l.cantidad > 0 && l.vence);
    return {
      vencidos: conStock.filter((l) => vencido(l, h)).sort((a, b) => a.vence.localeCompare(b.vence)),
      porVencer: conStock.filter((l) => !vencido(l, h) && diasHasta(l.vence, h) <= lim).sort((a, b) => a.vence.localeCompare(b.vence)),
    };
  }

  /* Ingreso de mercadería. Si ya existe el mismo lote con el mismo vencimiento, se suma a ese lote. */
  function ingresar(inv, { productoId, lote, vence, cantidad, nota }, ctx) {
    const s = clonar(inv);
    const p = s.productos.find((x) => x.id === productoId);
    if (!p) throw new ErrorStock('Producto inexistente');
    if (!(entero(cantidad) > 0)) throw new ErrorStock('La cantidad debe ser un número entero mayor a cero');
    if (p.catalogo === 'farmacia') {
      if (!String(lote || '').trim()) throw new ErrorStock('En farmacia el lote es obligatorio');
      if (!vence) throw new ErrorStock('En farmacia el vencimiento es obligatorio');
    }
    if (vence && diasHasta(vence, ctx.fecha) < 0) throw new ErrorStock('No se puede ingresar mercadería vencida');
    let l = s.lotes.find((x) => x.productoId === productoId && (x.lote || '') === (lote || '') && (x.vence || '') === (vence || ''));
    if (l) l.cantidad += cantidad;
    else { l = { id: ctx.id('lt'), productoId, lote: lote || '', vence: vence || null, cantidad, ingreso: ctx.fecha }; s.lotes.push(l); }
    s.movimientos.push({ id: ctx.id('mv'), productoId, loteId: l.id, tipo: 'ingreso', cantidad, fecha: ctx.fecha, usuario: ctx.usuario, nota: nota || '' });
    return { inv: s, lote: l };
  }

  function registrarContingencia(s, p, l, tipo, cantidad, ctx) {
    if (!p.sigtrazavet || !CONTINGENCIAS.includes(tipo)) return null;
    const limite = new Date(inicioDia(ctx.fecha).getTime() + DIAS_DECLARACION * DIA).toISOString();
    const d = { id: ctx.id('dc'), tipo, productoId: p.id, loteId: l.id, lote: l.lote, cantidad, fecha: ctx.fecha, limite, estado: 'pendiente', usuario: ctx.usuario };
    s.declaraciones.push(d);
    return d;
  }

  /* Ajuste negativo de un lote (merma, rotura, robo, conteo, devolución). Nunca deja stock negativo. */
  function ajustar(inv, { loteId, cantidad, motivo, nota }, ctx) {
    const s = clonar(inv);
    const l = s.lotes.find((x) => x.id === loteId);
    if (!l) throw new ErrorStock('Lote inexistente');
    if (!(entero(cantidad) > 0)) throw new ErrorStock('La cantidad debe ser un número entero mayor a cero');
    if (!MOTIVOS_AJUSTE[motivo]) throw new ErrorStock('Motivo de ajuste inválido');
    if (cantidad > l.cantidad) throw new ErrorStock('No hay stock suficiente en el lote (disponible: ' + l.cantidad + ')');
    l.cantidad -= cantidad;
    const p = s.productos.find((x) => x.id === l.productoId);
    s.movimientos.push({ id: ctx.id('mv'), productoId: l.productoId, loteId, tipo: 'ajuste', motivo, cantidad: -cantidad, fecha: ctx.fecha, usuario: ctx.usuario, nota: nota || '' });
    const declaracion = registrarContingencia(s, p, l, motivo, cantidad, ctx);
    return { inv: s, declaracion };
  }

  /* Baja de todo el saldo de un lote vencido. */
  function bajaVencido(inv, loteId, ctx) {
    const s = clonar(inv);
    const l = s.lotes.find((x) => x.id === loteId);
    if (!l) throw new ErrorStock('Lote inexistente');
    if (!vencido(l, ctx.fecha)) throw new ErrorStock('El lote todavía no venció');
    if (l.cantidad <= 0) throw new ErrorStock('El lote no tiene stock');
    const cant = l.cantidad;
    l.cantidad = 0;
    const p = s.productos.find((x) => x.id === l.productoId);
    s.movimientos.push({ id: ctx.id('mv'), productoId: l.productoId, loteId, tipo: 'baja_vencimiento', cantidad: -cant, fecha: ctx.fecha, usuario: ctx.usuario, nota: '' });
    const declaracion = registrarContingencia(s, p, l, 'vencimiento', cant, ctx);
    return { inv: s, declaracion };
  }

  /* Plan de descuento FEFO (primero vence, primero sale; sin vencimiento: por orden de ingreso). No modifica nada.
     Lanza ErrorStock si no alcanza el stock vendible. */
  function planDescuento(productoId, cantidad, lotes, hoy) {
    if (!(entero(cantidad) > 0)) throw new ErrorStock('La cantidad debe ser un número entero mayor a cero');
    const disponibles = lotesDe(productoId, lotes).filter((l) => l.cantidad > 0 && !vencido(l, hoy))
      .sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999') || (a.ingreso || '').localeCompare(b.ingreso || ''));
    const total = disponibles.reduce((t, l) => t + l.cantidad, 0);
    if (total < cantidad) throw new ErrorStock('Stock insuficiente (disponible: ' + total + ')');
    const plan = [];
    let resta = cantidad;
    for (const l of disponibles) {
      if (!resta) break;
      const c = Math.min(resta, l.cantidad);
      plan.push({ loteId: l.id, lote: l.lote, vence: l.vence, cantidad: c });
      resta -= c;
    }
    return plan;
  }

  /* Aplica un descuento (por ejemplo, una venta). Todo o nada: si un ítem no alcanza, no se descuenta ninguno. */
  function descontar(inv, items, ctx) {
    const s = clonar(inv); // se trabaja sobre una copia: si un ítem falla, el inventario original no cambia
    const asignaciones = items.map((it) => {
      const plan = planDescuento(it.productoId, it.cantidad, s.lotes, ctx.fecha);
      plan.forEach((x) => {
        s.lotes.find((y) => y.id === x.loteId).cantidad -= x.cantidad;
        s.movimientos.push({ id: ctx.id('mv'), productoId: it.productoId, loteId: x.loteId, tipo: ctx.tipo || 'venta', cantidad: -x.cantidad, fecha: ctx.fecha, usuario: ctx.usuario, ref: ctx.ref || null, nota: '' });
      });
      return { productoId: it.productoId, plan };
    });
    return { inv: s, asignaciones };
  }

  /* Revierte un descuento (por ejemplo, la anulación de una venta) devolviendo cada cantidad a su lote. */
  function reponer(inv, asignaciones, ctx) {
    const s = clonar(inv);
    asignaciones.forEach((a) => a.plan.forEach((x) => {
      const l = s.lotes.find((y) => y.id === x.loteId);
      if (!l) throw new ErrorStock('Lote inexistente');
      l.cantidad += x.cantidad;
      s.movimientos.push({ id: ctx.id('mv'), productoId: a.productoId, loteId: x.loteId, tipo: ctx.tipo || 'anulacion', cantidad: x.cantidad, fecha: ctx.fecha, usuario: ctx.usuario, ref: ctx.ref || null, nota: '' });
    }));
    return { inv: s };
  }

  /* Valor del stock vendible a precio de venta (IVA incluido). */
  const valorStock = (productos, lotes, hoy) => productos.reduce((t, p) => t + estado(p, lotes, hoy).vendible * (p.precio || 0), 0);

  function validarProducto(p, todos) {
    const e = [];
    if (!CATALOGOS[p.catalogo]) e.push('Elegí el catálogo');
    else if (!CATEGORIAS[p.catalogo].includes(p.categoria)) e.push('La categoría no corresponde al catálogo');
    if (!String(p.nombre || '').trim()) e.push('Ingresá el nombre');
    if (!(typeof p.precio === 'number' && p.precio > 0)) e.push('El precio debe ser mayor a cero');
    if (!(Number.isInteger(p.stockMinimo) && p.stockMinimo >= 0)) e.push('El stock mínimo debe ser un entero mayor o igual a cero');
    if (p.sku && (todos || []).some((o) => o.id !== p.id && o.sku && o.sku.toLowerCase() === p.sku.toLowerCase())) e.push('Ya existe un producto con ese código');
    if (p.catalogo !== 'farmacia' && (p.requiereReceta || p.sigtrazavet)) e.push('Solo los productos de farmacia pueden requerir receta o estar alcanzados por SIGTRAZAVET');
    return e;
  }

  return {
    CATALOGOS, CATEGORIAS, DIAS_AVISO_FARMACIA, DIAS_DECLARACION, MOTIVOS_AJUSTE, ErrorStock,
    diasHasta, estado, vencimientos, ingresar, ajustar, bajaVencido, planDescuento, descontar, reponer, valorStock, validarProducto,
  };
});

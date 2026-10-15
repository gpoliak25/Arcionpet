/* Ventas y receta veterinaria electrónica (RVE). Funciones puras.
   Res. SENASA 654/2026:
   - art. 11: los productos sujetos a prescripción solo se venden contra una RVE vigente; el número de la RVE se ingresa en
     SIGTRAZAVET, que registra la operación (declaración en tiempo real).
   - art. 18 d: RVE "Prescripción en mascotas": titular (nombre, apellido, DNI/CUIT/pasaporte), animal (especie, raza, edad,
     nombre) y por producto: presentación, dosis, frecuencia, duración y vía. Vigencia: 30 días corridos desde la emisión.
   - art. 18 e: toda RVE tiene un CUVE (Código Único de Verificación Electrónica).
   - art. 20: excepción del botiquín profesional: el veterinario entrega sin RVE, registrando la atención en la ficha clínica
     con los datos de la RVE de mascotas y el autoconsumo en SIGTRAZAVET.
   - art. 8 c: una operación informada que no se concreta se anula dentro de los 20 días corridos.
   ArcionPet no se conecta con SIGTRAZAVET: registra las recetas y deja pendientes las declaraciones para hacerlas allá. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./inventario.js'), require('./tutores.js'));
  else root.Dominio = Object.assign(root.Dominio || {}, { ventas: factory(root.Dominio.inventario, root.Dominio.tutores) });
})(typeof self !== 'undefined' ? self : this, function (I, T) {
  const MEDIOS = { qr: 'QR', transferencia: 'Transferencia', efectivo: 'Efectivo', credito: 'Crédito', debito: 'Débito' };
  const IVA = 0.21; // alícuota general, solo informativa: los precios ya incluyen IVA
  const VIGENCIA_RVE = 30;
  const PLAZO_ANULACION = 20;
  const VIAS = ['Oral', 'Tópica', 'Subcutánea', 'Intramuscular', 'Intravenosa', 'Ótica', 'Oftálmica', 'Otra'];

  class ErrorVenta extends Error {}
  const DIA = 86400000;
  const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const masDias = (fecha, n) => new Date(inicioDia(fecha).getTime() + n * DIA).toISOString();
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const txt = (s) => String(s == null ? '' : s).trim();

  function totales(items) {
    const total = items.reduce((t, i) => t + i.precioUnit * i.cantidad, 0);
    return { total, ivaContenido: Math.round((total - total / (1 + IVA)) * 100) / 100 };
  }

  /* Días de vigencia que le quedan a una RVE: 30 menos los días transcurridos desde la emisión
     (0 = último día válido; negativo = vencida). */
  const diasVigencia = (receta, hoy) => VIGENCIA_RVE + I.diasHasta(receta.emision, hoy);

  /* Valida los datos obligatorios de una RVE de mascotas (art. 18 d y e) o de una entrega desde botiquín (art. 20). */
  function validarReceta(r, hoy) {
    const e = [];
    const botiquin = r.tipo === 'botiquin';
    if (!botiquin) {
      if (!/^[A-Za-z0-9-]{8,}$/.test(txt(r.cuve))) e.push('Ingresá el CUVE de la receta (mínimo 8 caracteres, letras, números o guiones)');
      if (!r.emision) e.push('Ingresá la fecha de emisión');
      else if (I.diasHasta(r.emision, hoy) > 0) e.push('La fecha de emisión no puede ser futura');
      else if (diasVigencia(r, hoy) < 0) e.push('La receta está vencida (vigencia de ' + VIGENCIA_RVE + ' días corridos desde la emisión)');
    }
    const v = r.veterinario || {};
    if (!txt(v.nombre)) e.push('Ingresá el nombre del veterinario prescriptor');
    if (!txt(v.matricula)) e.push('Ingresá la matrícula del veterinario');
    const t = r.titular || {};
    if (!txt(t.nombre) || !txt(t.apellido)) e.push('Faltan nombre y apellido del titular del animal');
    if (!txt(t.doc)) e.push('Falta el documento del titular (DNI, CUIT o pasaporte)');
    const a = r.animal || {};
    ['nombre', 'especie', 'raza', 'edad'].forEach((k) => { if (!txt(a[k])) e.push('Falta ' + (k === 'edad' ? 'la edad' : k === 'nombre' ? 'el nombre' : 'la ' + k) + ' del animal'); });
    if (!(r.items || []).length) e.push('La receta no tiene productos');
    (r.items || []).forEach((it, i) => {
      const n = 'Ítem ' + (i + 1) + ': ';
      if (!txt(it.descripcion)) e.push(n + 'falta el producto o principio activo');
      if (!(Number.isInteger(it.cantidad) && it.cantidad > 0)) e.push(n + 'la cantidad debe ser un entero mayor a cero');
      ['dosis', 'frecuencia', 'duracion', 'via'].forEach((k) => { if (!txt(it[k])) e.push(n + 'falta ' + ({ dosis: 'la dosis', frecuencia: 'la frecuencia', duracion: 'la duración del tratamiento', via: 'la vía de administración' })[k]); });
    });
    return e;
  }

  /* Valida una venta antes de registrarla. estado = { tutores, pacientes, productos, lotes, recetas }. */
  function validarVenta(estado, venta, hoy, rol) {
    const e = [];
    const tutor = estado.tutores.find((t) => t.id === venta.tutorId);
    if (!tutor) e.push('Elegí el tutor: toda venta queda asociada a un tutor');
    else if (tutor.activo === false) e.push('El tutor está dado de baja');
    const pac = venta.pacienteId ? estado.pacientes.find((p) => p.id === venta.pacienteId) : null;
    if (venta.pacienteId && (!pac || (tutor && pac.tutorId !== tutor.id))) e.push('La mascota no pertenece al tutor');
    if (!MEDIOS[venta.medioPago]) e.push('Elegí el medio de pago');
    if (!(venta.items || []).length) e.push('Agregá al menos un producto');
    const conReceta = [];
    (venta.items || []).forEach((it) => {
      const p = estado.productos.find((x) => x.id === it.productoId);
      if (!p || p.activo === false) { e.push('Producto inexistente o inactivo'); return; }
      if (!(Number.isInteger(it.cantidad) && it.cantidad > 0)) e.push(p.nombre + ': cantidad inválida');
      if (p.catalogo === 'farmacia' && rol === 'peluqueria') e.push('Tu rol no puede vender productos de farmacia');
      if (p.requiereReceta) conReceta.push({ p, it });
    });
    if (conReceta.length) {
      if (!venta.receta) e.push('Hay productos de venta bajo receta: registrá la receta veterinaria electrónica' + (rol === 'veterinario' ? ' o la entrega desde botiquín' : ''));
      else {
        const r = venta.receta;
        if (r.tipo === 'botiquin' && rol !== 'veterinario') e.push('Solo un veterinario puede entregar desde su botiquín profesional (art. 20)');
        if (r.estado && r.estado !== 'vigente') e.push('La receta ya fue ' + (r.estado === 'dispensada' ? 'dispensada en otra venta' : r.estado) + ': cada RVE admite una sola dispensa');
        validarReceta(r, hoy).forEach((x) => e.push(x));
        if (tutor && r.titular && T.normalizarDoc(r.titular.tipoDoc || 'DNI', r.titular.doc) !== T.normalizarDoc(tutor.tipoDoc || 'DNI', tutor.doc)) e.push('El titular de la receta no coincide con el tutor (documento distinto)');
        if (!pac) e.push('Elegí la mascota: la receta es para un animal determinado');
        else if (r.animal && r.animal.pacienteId && r.animal.pacienteId !== pac.id) e.push('La receta es para otro animal');
        conReceta.forEach(({ p, it }) => {
          const pres = (r.items || []).filter((x) => x.productoId === p.id).reduce((t, x) => t + (x.cantidad || 0), 0);
          if (!pres) e.push(p.nombre + ' no está en la receta');
          else if (it.cantidad > pres) e.push(p.nombre + ': la cantidad supera lo recetado (' + pres + ')');
        });
      }
    }
    return e;
  }

  /* Registra la venta: valida, descuenta stock (FEFO, todo o nada), marca la receta como dispensada y genera las
     declaraciones de SIGTRAZAVET que correspondan. estado incluye las colecciones de inventario, ventas y recetas. */
  function registrar(estado, venta, ctx) {
    const errores = validarVenta(estado, venta, new Date(ctx.fecha), ctx.rol);
    if (errores.length) throw new ErrorVenta(errores[0]);
    const s = clonar(estado);
    const id = ctx.id('vt');
    let d;
    try { d = I.descontar(s, venta.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })), Object.assign({}, ctx, { ref: id, tipo: 'venta' })); }
    catch (err) { if (err instanceof I.ErrorStock) throw new ErrorVenta(err.message); throw err; }
    ['productos', 'lotes', 'movimientos'].forEach((k) => { s[k] = d.inv[k]; });
    const items = venta.items.map((i, k) => {
      const p = s.productos.find((x) => x.id === i.productoId);
      return { productoId: p.id, nombre: p.nombre, presentacion: p.presentacion, catalogo: p.catalogo, requiereReceta: !!p.requiereReceta, sigtrazavet: !!p.sigtrazavet, cantidad: i.cantidad, precioUnit: p.precio, subtotal: p.precio * i.cantidad, lotes: d.asignaciones[k].plan };
    });
    const tot = totales(items);
    s.ventas = s.ventas || []; s.recetas = s.recetas || []; s.declaraciones = s.declaraciones || [];
    let recetaId = null;
    if (venta.receta && items.some((i) => i.requiereReceta)) {
      const r = clonar(venta.receta);
      if (r.id) {
        const ex = s.recetas.find((x) => x.id === r.id);
        Object.assign(ex, { estado: 'dispensada', ventaId: id, fechaDispensa: ctx.fecha });
        recetaId = ex.id;
      } else {
        recetaId = ctx.id('rv');
        s.recetas.push(Object.assign(r, { id: recetaId, estado: 'dispensada', ventaId: id, fechaDispensa: ctx.fecha, registradaPor: ctx.usuario, fechaRegistro: ctx.fecha }));
      }
      const rec = s.recetas.find((x) => x.id === recetaId);
      items.filter((i) => i.requiereReceta && i.sigtrazavet).forEach((i) => {
        s.declaraciones.push({ id: ctx.id('dc'), tipo: rec.tipo === 'botiquin' ? 'autoconsumo' : 'venta_rve', productoId: i.productoId, loteId: i.lotes[0].loteId, lote: i.lotes.map((l) => l.lote).join(', '), cantidad: i.cantidad, ref: id, cuve: rec.cuve || null, fecha: ctx.fecha, limite: ctx.fecha, estado: 'pendiente', usuario: ctx.usuario });
      });
    }
    const numero = (s.ventas.reduce((m, v) => Math.max(m, v.numero || 0), 0)) + 1;
    const nueva = { id, numero, fecha: ctx.fecha, tutorId: venta.tutorId, pacienteId: venta.pacienteId || null, items, total: tot.total, ivaContenido: tot.ivaContenido, medioPago: venta.medioPago, cuotas: venta.medioPago === 'credito' ? (venta.cuotas || 1) : null, estado: 'confirmada', recetaId, usuario: ctx.usuario };
    s.ventas.push(nueva);
    return { estado: s, venta: nueva };
  }

  /* Anula una venta: repone cada lote, libera la receta si sigue vigente y, si había declaraciones en SIGTRAZAVET, deja
     pendiente su anulación (art. 8 c, 20 días). */
  function anular(estado, ventaId, motivo, ctx) {
    const s = clonar(estado);
    const v = (s.ventas || []).find((x) => x.id === ventaId);
    if (!v) throw new ErrorVenta('Venta inexistente');
    if (v.estado === 'anulada') throw new ErrorVenta('La venta ya está anulada');
    if (!txt(motivo)) throw new ErrorVenta('Indicá el motivo de la anulación');
    const r = I.reponer(s, v.items.map((i) => ({ productoId: i.productoId, plan: i.lotes })), Object.assign({}, ctx, { ref: v.id, tipo: 'anulacion' }));
    ['productos', 'lotes', 'movimientos'].forEach((k) => { s[k] = r.inv[k]; });
    Object.assign(v, { estado: 'anulada', anulacion: { fecha: ctx.fecha, usuario: ctx.usuario, motivo: txt(motivo) } });
    if (v.recetaId) {
      const rec = s.recetas.find((x) => x.id === v.recetaId);
      if (rec) {
        const sigueVigente = rec.tipo === 'botiquin' || diasVigencia(rec, new Date(ctx.fecha)) >= 0;
        Object.assign(rec, { estado: sigueVigente && rec.tipo !== 'botiquin' ? 'vigente' : 'anulada', ventaId: null, fechaDispensa: null });
      }
    }
    (s.declaraciones || []).filter((d) => d.ref === v.id && ['venta_rve', 'autoconsumo'].includes(d.tipo)).forEach((d) => {
      if (d.estado === 'pendiente') d.estado = 'sin_efecto'; // nunca se declaró: no hay nada que anular allá
      else s.declaraciones.push({ id: ctx.id('dc'), tipo: 'anulacion', productoId: d.productoId, loteId: d.loteId, lote: d.lote, cantidad: d.cantidad, ref: v.id, cuve: d.cuve, nroOriginal: d.nroOperacion || null, fecha: ctx.fecha, limite: masDias(ctx.fecha, PLAZO_ANULACION), estado: 'pendiente', usuario: ctx.usuario });
    });
    return { estado: s, venta: v };
  }

  /* Recetas registradas que se pueden usar para un tutor y una mascota. */
  function recetasDisponibles(recetas, tutor, pacienteId, hoy) {
    return (recetas || []).filter((r) => r.tipo !== 'botiquin' && r.estado === 'vigente' && diasVigencia(r, hoy) >= 0 &&
      tutor && T.normalizarDoc(r.titular.tipoDoc || 'DNI', r.titular.doc) === T.normalizarDoc(tutor.tipoDoc || 'DNI', tutor.doc) &&
      (!pacienteId || !r.animal.pacienteId || r.animal.pacienteId === pacienteId));
  }

  function resumen(ventas, desde, hasta) {
    const lista = (ventas || []).filter((v) => v.estado !== 'anulada' && (!desde || v.fecha >= desde) && (!hasta || v.fecha < hasta));
    const porMedio = {};
    lista.forEach((v) => { porMedio[v.medioPago] = (porMedio[v.medioPago] || 0) + v.total; });
    const total = lista.reduce((t, v) => t + v.total, 0);
    return { cantidad: lista.length, total, promedio: lista.length ? total / lista.length : 0, porMedio };
  }

  return { MEDIOS, IVA, VIGENCIA_RVE, PLAZO_ANULACION, VIAS, ErrorVenta, totales, diasVigencia, validarReceta, validarVenta, registrar, anular, recetasDisponibles, resumen };
});

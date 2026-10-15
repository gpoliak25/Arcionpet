/* Estado de la demo: persistido en localStorage, con migraciones de esquema y métricas derivadas. */
(function () {
  const KEY = 'arcionpet-demo';
  let S;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  const M = Dominio.migraciones;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  let soloLectura = false; // datos de una versión más nueva: no se sobrescriben

  /* Carga el estado guardado y lo migra a la versión actual.
     Antes de migrar se guarda una copia intacta en arcionpet-demo:backup:v<versión>. */
  function load() {
    const raw = lsGet(KEY);
    if (raw) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { lsSet(KEY + ':backup:ilegible', raw); }
      if (parsed && parsed.version === M.VERSION_ACTUAL) return parsed;
      if (parsed && parsed.version > M.VERSION_ACTUAL) {
        soloLectura = true;
        console.warn('Datos de una versión más nueva (' + parsed.version + '): se abren sin guardar cambios.');
        return M.revertir(parsed, M.VERSION_ACTUAL);
      }
      if (parsed && parsed.version >= M.VERSION_BASE) {
        lsSet(KEY + ':backup:v' + parsed.version, raw);
        try { return M.migrar(parsed); } catch (e) {
          soloLectura = true; // no pisamos los datos originales si la migración falla
          console.error('Falló la migración; los datos originales quedan en el backup.', e);
        }
      }
    }
    return M.migrar(clone(SEED));
  }
  let guardadoOk = true; // false si el navegador no tuvo espacio para guardar
  /* Guarda sin redibujar la pantalla (para el chat, que se actualiza solo). */
  function guardarSilencioso() { if (!soloLectura) guardadoOk = lsSet(KEY, JSON.stringify(S)); }
  function save() {
    if (!soloLectura) guardadoOk = lsSet(KEY, JSON.stringify(S));
    listeners.forEach((fn) => fn());
  }
  const listeners = [];
  S = load();

  let seq = Date.now() % 100000;
  const uid = (p) => p + (++seq).toString(36);

  /* ---------- Fechas ---------- */
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
  const isToday = (iso) => daysBetween(iso, new Date()) === 0;

  /* ---------- Lookups ---------- */
  const byId = (list, id) => S[list].find((x) => x.id === id);
  const paciente = (id) => byId('pacientes', id);
  const tutor = (id) => byId('tutores', id);
  const estudio = (id) => byId('estudios', id);
  // los borradores descartados no cuentan (baja lógica)
  const informeDeEstudio = (eid) => S.informes.find((i) => i.estudioId === eid && i.estado !== 'descartado');
  const estudiosActivos = () => S.estudios.filter((e) => e.activo !== false);
  const G = () => Dominio.seguridad;

  function edad(nac) {
    const n = new Date(nac), h = new Date();
    let m = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
    if (h.getDate() < n.getDate()) m--;
    const y = Math.floor(m / 12), r = m % 12;
    if (y === 0) return r + (r === 1 ? ' mes' : ' meses');
    if (r === 0) return y + (y === 1 ? ' año' : ' años');
    return y + (y === 1 ? ' año' : ' años') + ' y ' + r + (r === 1 ? ' mes' : ' meses');
  }

  /* ---------- Resultado de la CNN ----------
     probPatologia = probabilidad de la clase patológica según la red, en % (no es la certeza del modelo).
     Los umbrales están en CNN.interpretar. */
  function nivelConfianza(e) {
    const d = Math.abs(e.probPatologia - 50); // distancia al punto de máxima duda
    return d >= 35 ? 'alta' : d >= 20 ? 'media' : 'baja';
  }

  const RES_LABEL = { normal: 'Normal', incierto: 'Incierto', patologico: 'Patológico' };

  function borradorInforme(e) {
    const p = paciente(e.pacienteId) || {};
    const hall = e.hallazgos && e.hallazgos.length ? e.hallazgos : [];
    const zona = e.tipo === 'Tórax' ? 'tórax' : 'miembro';
    let descripcion, conclusion, sugerencia;
    if (e.resultado === 'normal') {
      descripcion = e.tipo === 'Tórax'
        ? 'Silueta cardíaca de tamaño y forma conservados. Campos pulmonares con patrón y radiolucidez dentro de parámetros normales. Tráquea de diámetro y trayecto normales. Sin evidencia de efusión pleural.'
        : 'Estructuras óseas con densidad y corticales conservadas. Superficies articulares congruentes. Sin evidencia de líneas de fractura ni reacción perióstica.';
      conclusion = 'Estudio radiológico de ' + zona + ' sin hallazgos significativos.';
      sugerencia = 'Correlacionar con la clínica. Control según evolución.';
    } else {
      descripcion = 'Se observa: ' + hall.map((h) => h.toLowerCase()).join('; ') + '. ' +
        (e.tipo === 'Tórax'
          ? 'Resto de las estructuras torácicas evaluables sin particularidades.'
          : 'Resto de las estructuras óseas evaluables sin particularidades.');
      conclusion = (e.resultado === 'incierto' ? 'Hallazgo de significado incierto compatible con: ' : 'Hallazgos compatibles con: ') + hall.join(', ') + '.';
      sugerencia = e.resultado === 'incierto'
        ? 'Se sugiere segunda lectura por especialista (derivación) y/o proyecciones complementarias.'
        : 'Se sugiere correlación clínica y estudios complementarios según criterio del profesional.';
    }
    return [
      'INFORME RADIOLÓGICO — ' + e.tipo.toUpperCase() + (e.proyeccion ? ' (' + e.proyeccion + ')' : ''),
      '',
      'Paciente: ' + p.nombre + ' · ' + p.especie + ' · ' + p.raza + ' · ' + edad(p.nacimiento),
      'Motivo de consulta: ' + e.motivo,
      '',
      'DESCRIPCIÓN',
      descripcion,
      '',
      'CONCLUSIÓN',
      conclusion,
      '',
      'SUGERENCIAS',
      sugerencia,
      '',
      'Resultado IA: ' + RES_LABEL[e.resultado] + ' (' + e.probPatologia + '% probabilidad de patología). Borrador generado automáticamente: requiere revisión y firma del médico veterinario.',
    ].join('\n');
  }

  /* ---------- Derivados ---------- */
  function triage() {
    const rows = estudiosActivos()
      .filter((e) => e.resultado)
      .map((e) => {
        const inf = informeDeEstudio(e.id);
        return { e, inf, espera: daysBetween(e.fecha, new Date()), prioridad: e.resultado === 'normal' ? 'revisar' : 'urgente' };
      })
      .filter((r) => !(r.inf && r.inf.estado === 'firmado'));
    rows.sort((a, b) => (a.prioridad === b.prioridad ? 0 : a.prioridad === 'urgente' ? -1 : 1) ||
      (b.e.resultado === 'patologico') - (a.e.resultado === 'patologico') || b.espera - a.espera || b.e.probPatologia - a.e.probPatologia);
    return rows;
  }

  function hemoAlertas() {
    const dias = ((S.config || {}).umbrales || {}).avisoHemo || 7;
    return S.hemo.filter((u) => (u.estado === 'disponible' || u.estado === 'reservada') && daysBetween(new Date(), u.vence) <= dias && daysBetween(new Date(), u.vence) >= 0);
  }

  /* Alertas de seguridad clínica: estudios contradictorios y demoras respecto del SLA configurado. */
  const contradicciones = () => G().contradicciones(S.estudios);
  const demoras = () => G().demoras({ estudios: S.estudios, informes: S.informes, derivaciones: S.derivaciones, interconsultas: S.interconsultas }, (S.config || {}).sla);
  const demoraDe = (tipo, id) => demoras().find((d) => d.tipo === tipo && d.id === id) || null;

  function notificaciones() {
    const n = [];
    contradicciones().forEach((c) => {
      const p = paciente(c.pacienteId) || {};
      n.push({ id: 'n-ctr-' + c.estudios.join('-'), ic: 'alert', t: 'Estudios contradictorios del mismo día', s: (p.nombre || '') + ': uno Normal y otro Patológico', go: '#/estudios/' + c.estudios[0] });
    });
    const TXT = { triage: 'Urgente sin informe firmado', derivaciones: 'Derivación sin respuesta', interconsultas: 'Interconsulta sin respuesta' };
    demoras().forEach((d) => n.push({ id: 'n-sla-' + d.id, ic: 'clock', t: TXT[d.tipo] + ' (SLA ' + d.limite + ' h)', s: 'Demora de ' + Math.round(d.horas) + ' h' + (d.asignadoA ? ' · ' + ((S.usuarios.find((u) => u.id === d.asignadoA) || {}).nombre || '') : ' · sin asignar'), go: d.tipo === 'triage' ? '#/triage' : '#/' + d.tipo }));
    S.turnos.filter((t) => t.estado === 'pendiente').forEach((t) => {
      const p = paciente(t.pacienteId);
      n.push({ id: 'n-' + t.id, ic: 'globe', t: 'Pedido de turno desde el Portal Cliente', s: p.nombre + ' · ' + t.tipo, go: '#/turnos' });
    });
    S.derivaciones.filter((d) => d.estado === 'respondida' && !d.vista).forEach((d) => {
      const e = estudio(d.estudioId), p = paciente(e.pacienteId);
      n.push({ id: 'n-' + d.id, ic: 'stetho', t: 'Derivación respondida', s: p.nombre + ' · ' + (d.a || 'Especialista'), go: '#/derivaciones' });
    });
    S.interconsultas.filter((i) => i.noLeida).forEach((i) => {
      n.push({ id: 'n-' + i.id, ic: 'chat', t: 'Nueva respuesta en interconsulta', s: i.asunto, go: '#/interconsultas/' + i.id });
    });
    if (S.productos) {
      const ia = inventarioAlertas();
      if (ia.vencidos.length) n.push({ id: 'n-inv-venc', ic: 'alert', t: ia.vencidos.length + (ia.vencidos.length === 1 ? ' lote vencido' : ' lotes vencidos') + ' en farmacia', s: 'Dar de baja en Farmacia', go: '#/farmacia' });
      ia.declaraciones.forEach((d) => { const p = producto(d.productoId) || {}; const r = Dominio.inventario.diasHasta(d.limite, new Date()); n.push({ id: 'n-' + d.id, ic: 'clipboard', t: 'Declarar en SIGTRAZAVET', s: (p.nombre || '') + ' · ' + (['venta_rve', 'autoconsumo'].includes(d.tipo) ? 'en tiempo real' : r < 0 ? 'plazo vencido' : 'quedan ' + r + ' días'), go: '#/farmacia' }); });
    }
    hemoAlertas().forEach((u) => {
      const d = daysBetween(new Date(), u.vence);
      n.push({ id: 'n-' + u.id, ic: 'drop', t: 'Hemocomponente por vencer', s: u.id + ' · ' + u.comp + ' · ' + (d === 0 ? 'vence hoy' : 'vence en ' + d + ' d'), go: '#/hemocomponentes' });
    });
    return n;
  }

  /* Un solo cálculo de concordancia para Control de calidad y Analítica (opcionalmente, solo las evaluaciones de un período). */
  const qaStats = (filtro) => Dominio.calidad.metricas(filtro ? S.evaluaciones.filter(filtro) : S.evaluaciones);
  /* Filas del dataset de control de calidad (se anonimizan al exportar). */
  function filasCalidad() {
    return S.evaluaciones.map((q) => {
      const e = estudio(q.estudioId) || {}, p = paciente(e.pacienteId) || {};
      return { fecha: q.fecha, estudioId: q.estudioId, pacienteId: e.pacienteId, especie: p.especie, edadAnios: p.nacimiento ? Math.floor(daysBetween(p.nacimiento, q.fecha) / 365.25) : null, tipo: e.tipo, proyeccion: e.proyeccion,
        modeloVersion: e.modelo ? e.modelo.version : '', ia: q.ia, probPatologia: e.probPatologia, veredicto: q.veredicto, claseReal: Dominio.calidad.claseReal(q), hallazgos: q.hallazgos || [], vetId: q.vetId, vet: q.vet,
        imagenRef: e.imagenRef, etiquetaDataset: e.imagenRef && window.UI && UI.refTest ? (UI.refTest(e) || {}).clase || '' : '' };
    });
  }

  /* ---------- Inventario ---------- */
  const I = () => Dominio.inventario;
  const inv = () => ({ productos: S.productos, lotes: S.lotes, movimientos: S.movimientos, declaraciones: S.declaraciones });
  const ctxInv = (extra) => Object.assign({ fecha: new Date().toISOString(), usuario: S.usuarioActivo, id: uid }, extra);
  function aplicarInv(r) { ['productos', 'lotes', 'movimientos', 'declaraciones'].forEach((k) => { S[k] = r.inv[k]; }); save(); return r; }
  const producto = (id) => byId('productos', id);
  /* Catálogos que puede ver el rol activo (peluquería solo ve pet shop). */
  const catalogosVisibles = () => (rol() === 'peluqueria' ? ['petshop'] : ['petshop', 'farmacia']);
  /* Alertas de inventario de los catálogos visibles. */
  function inventarioAlertas() {
    const cats = catalogosVisibles(), hoy = new Date();
    const prods = S.productos.filter((p) => p.activo !== false && cats.includes(p.catalogo));
    const dias = ((S.config || {}).umbrales || {}).avisoFarmacia;
    const v = I().vencimientos(prods, S.lotes, hoy, dias);
    return {
      bajoMinimo: prods.filter((p) => I().estado(p, S.lotes, hoy, dias).bajoMinimo),
      porVencer: v.porVencer, vencidos: v.vencidos,
      declaraciones: cats.includes('farmacia') ? S.declaraciones.filter((d) => d.estado === 'pendiente') : [],
    };
  }

  /* ---------- Ventas ---------- */
  const CLAVES_VENTA = ['productos', 'lotes', 'movimientos', 'declaraciones', 'ventas', 'recetas'];
  const facturacionCfg = () => (S.config || {}).facturacion || { puntosVenta: [{ numero: 1, nombre: 'Mostrador' }], puntoVenta: 1 };
  /* Cliente de la factura: el tutor (con su condición frente al IVA) o un consumidor final. */
  function clienteFactura(venta) {
    const t = venta.tutorId ? tutor(venta.tutorId) : null;
    if (t) return { nombre: t.nombre + ' ' + t.apellido, condicionIva: t.condicionIva || 'Consumidor final', cuit: t.cuit || (t.tipoDoc === 'CUIT' ? t.doc : ''), doc: t.doc };
    const c = venta.cliente || {};
    return { nombre: c.nombre || 'Consumidor final', condicionIva: c.condicionIva || 'Consumidor final', cuit: c.cuit || '', doc: c.doc || '' };
  }
  /* Próximas dosis: productos con intervalo de repetición vendidos o aplicados a una mascota (alimenta los recordatorios). */
  function agendarDosis(pacienteId, items, origen, fecha) {
    if (!pacienteId) return;
    S.calendarioSalud = S.calendarioSalud || [];
    items.forEach((it) => {
      const p = producto(it.productoId);
      if (!p || !p.intervaloDias) return;
      const d = new Date(fecha); d.setDate(d.getDate() + p.intervaloDias);
      // una aplicación nueva reemplaza la próxima dosis pendiente del mismo producto
      S.calendarioSalud.filter((c) => c.pacienteId === pacienteId && c.productoId === p.id && c.estado === 'pendiente').forEach((c) => { c.estado = 'reemplazada'; });
      S.calendarioSalud.push({ id: uid('cs'), pacienteId, productoId: p.id, nombre: p.nombre, categoria: p.categoria, fecha: d.toISOString().slice(0, 10), origen, estado: 'pendiente', creado: fecha });
    });
  }
  /* ---------- Turnos ---------- */
  const TU = () => Dominio.turnos;
  const ctxTurnos = () => ({ turnos: S.turnos, recursos: S.recursos || [], servicios: S.servicios || [], pacientes: S.pacientes, agenda: (S.config || {}).agenda, ahora: new Date().toISOString() });
  /* Peluquería: misma lógica de agenda con sus propios turnos, servicios y peluqueros. */
  const PE = () => Dominio.peluqueria;
  const ctxPel = () => ({ turnos: S.pelTurnos || [], recursos: S.pelRecursos || [], servicios: S.pelServicios || [], pacientes: S.pacientes, agenda: (S.config || {}).agenda, ahora: new Date().toISOString() });
  const pelFicha = (pacienteId) => (S.pelFichas || []).find((f) => f.pacienteId === pacienteId) || null;
  const pelServicio = (id) => (S.pelServicios || []).find((x) => x.id === id) || null;
  const estadoVentas = () => { const e = { tutores: S.tutores, pacientes: S.pacientes, servicios: (S.servicios || []).concat(S.pelServicios || []) }; CLAVES_VENTA.forEach((k) => { e[k] = S[k]; }); return e; };
  function aplicarVentas(e) { CLAVES_VENTA.forEach((k) => { S[k] = e[k]; }); save(); }

  /* ---------- Mutaciones ---------- */
  const A = {
    reset() { S = M.migrar(clone(SEED)); soloLectura = false; save(); },
    /* Revierte el esquema a una versión anterior (para deshacer una migración). Se usa desde la consola. */
    revertirA(version) { const backup = JSON.stringify(S); lsSet(KEY + ':backup:v' + S.version, backup); S = M.revertir(S, version); soloLectura = true; lsSet(KEY, JSON.stringify(S)); return S.version; },
    /* Restaura una copia guardada antes de una migración. */
    restaurarBackup(clave) { const raw = lsGet(KEY + ':backup:' + clave); if (!raw) return false; lsSet(KEY, raw); return true; },
    /* Inventario: si una regla no se cumple, la lógica de dominio lanza ErrorStock y no se modifica nada. */
    ingresarStock(datos) { return aplicarInv(I().ingresar(inv(), datos, ctxInv())).lote; },
    ajustarStock(datos) { return aplicarInv(I().ajustar(inv(), datos, ctxInv())).declaracion; },
    bajaLoteVencido(loteId) { return aplicarInv(I().bajaVencido(inv(), loteId, ctxInv())).declaracion; },
    /* La información que se ingresa en SIGTRAZAVET reviste carácter de declaración jurada (Res. SENASA 654/2026, art. 14). */
    marcarDeclarada(id, nroOperacion, declaracionJurada) {
      if (!declaracionJurada) throw new (I().ErrorStock)('Confirmá la declaración jurada');
      Object.assign(byId('declaraciones', id), { estado: 'declarada', nroOperacion, fechaDeclaracion: new Date().toISOString(), declaradaPor: S.usuarioActivo, declaracionJurada: true });
      save();
    },
    guardarProducto(datos) {
      const errores = I().validarProducto(datos, S.productos);
      if (errores.length) throw new (I().ErrorStock)(errores[0]);
      if (datos.id) { Object.assign(producto(datos.id), datos); save(); return producto(datos.id); }
      const p = Object.assign({ activo: true, requiereReceta: false, sigtrazavet: false, principioActivo: '' }, datos, { id: uid('pr') });
      S.productos.push(p); save(); return p;
    },
    /* Venta: caja abierta → venta (stock, receta) → factura electrónica → movimiento de caja. Todo o nada. */
    registrarVenta(venta) {
      const K = Dominio.caja, Fx = Dominio.facturacion;
      if (!K.abierta(S.cajas)) throw new Dominio.ventas.ErrorVenta('La caja está cerrada: abrila para vender');
      const cliente = clienteFactura(venta);
      const pv = venta.puntoVenta || facturacionCfg().puntoVenta;
      Fx.validarCliente(Fx.tipoComprobante(Store.clinica.condicionIva, cliente.condicionIva), cliente);
      const ctx = ctxInv({ rol: rol() });
      const r = Dominio.ventas.registrar(estadoVentas(), venta, ctx);
      const f = Fx.emitir({ clase: 'factura', emisor: Store.clinica, cliente, puntoVenta: pv, totalConIva: r.venta.total, items: r.venta.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUnit: i.precioUnit })), fecha: ctx.fecha, ventaId: r.venta.id }, S.comprobantes);
      f.id = uid('cb');
      const cajas = K.movimiento(S.cajas, { tipo: 'venta', medio: venta.medioPago, monto: r.venta.total, ref: r.venta.id, usuario: S.usuarioActivo, fecha: ctx.fecha });
      Object.assign(r.venta, { comprobanteId: f.id, puntoVenta: pv, cliente: venta.tutorId ? null : cliente });
      S.comprobantes = (S.comprobantes || []).concat([f]); S.cajas = cajas;
      agendarDosis(venta.pacienteId, r.venta.items.filter((i) => !i.servicio), r.venta.id, ctx.fecha);
      r.venta.items.filter((i) => i.turnoId).forEach((i) => { const t = byId('turnos', i.turnoId) || (S.pelTurnos || []).find((x) => x.id === i.turnoId); if (t) t.ventaId = r.venta.id; });
      aplicarVentas(r.estado); return r.venta;
    },
    /* Devolución parcial o total (solo administración): repone stock, emite nota de crédito y registra el reintegro en la caja. */
    devolverVenta(ventaId, items, motivo) {
      if (!Dominio.permisos.puedeAccion(rol(), 'anularVenta')) throw new Dominio.ventas.ErrorVenta('Solo administración puede registrar devoluciones');
      const K = Dominio.caja, Fx = Dominio.facturacion;
      if (!K.abierta(S.cajas)) throw new Dominio.ventas.ErrorVenta('La caja está cerrada: abrila para registrar la devolución');
      const ctx = ctxInv({ rol: rol() });
      const r = Dominio.ventas.devolver(estadoVentas(), ventaId, items, motivo, ctx);
      const fac = (S.comprobantes || []).find((c) => c.id === r.venta.comprobanteId);
      let ncId = null, comps = S.comprobantes || [];
      if (fac) {
        const nc = Fx.emitir({ clase: 'nc', emisor: Store.clinica, cliente: fac.cliente, puntoVenta: fac.puntoVenta, totalConIva: r.devolucion.importe, items: r.devolucion.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUnit: i.importe / i.cantidad })), fecha: ctx.fecha, ventaId, asociado: fac }, comps);
        nc.id = ncId = uid('cb'); comps = comps.concat([nc]);
      }
      const cajas = K.movimiento(S.cajas, { tipo: 'devolucion', medio: r.venta.medioPago, monto: r.devolucion.importe, ref: ventaId, usuario: S.usuarioActivo, fecha: ctx.fecha });
      r.devolucion.comprobanteId = ncId;
      S.comprobantes = comps; S.cajas = cajas;
      aplicarVentas(r.estado); return r.devolucion;
    },
    abrirCaja(montoInicial) { S.cajas = Dominio.caja.abrir(S.cajas, { montoInicial, usuario: S.usuarioActivo, fecha: new Date().toISOString(), id: uid('cj') }).cajas; save(); },
    movimientoCaja(tipo, monto, nota) { S.cajas = Dominio.caja.movimiento(S.cajas, { tipo, medio: 'efectivo', monto, nota, usuario: S.usuarioActivo, fecha: new Date().toISOString() }); save(); },
    cerrarCaja(efectivoContado, nota) { const r = Dominio.caja.cerrar(S.cajas, { efectivoContado, nota, usuario: S.usuarioActivo, fecha: new Date().toISOString() }); S.cajas = r.cajas; save(); return r.caja; },
    /* RVE emitida por ArcionPet (veterinario). Con DEMO_MODE, número simulado; sin él, pendiente de integración. */
    emitirRVE(receta) {
      const r = Dominio.rve.emitir(receta, { prescriptor: usuario(), productos: S.productos, emitidas: S.recetas, demo: !!S.config.demoMode, fecha: new Date().toISOString(), id: uid('rv') });
      S.recetas = (S.recetas || []).concat([Object.assign(r, { registradaPor: S.usuarioActivo, fechaRegistro: r.emisionRegistro.fecha })]);
      save(); return r;
    },
    asignarCuveRVE(id, cuve) { const i = S.recetas.findIndex((r) => r.id === id); S.recetas[i] = Dominio.rve.asignarCuve(S.recetas[i], cuve, S.recetas); save(); return S.recetas[i]; },
    /* Botiquín de autoconsumo (art. 20): el veterinario usa o entrega un producto de su botiquín sin RVE, con registro en la ficha clínica. */
    autoconsumo({ pacienteId, productoId, cantidad, dosis, frecuencia, duracion, via, motivo }) {
      const u = usuario();
      if (u.rol !== 'veterinario') throw new Dominio.ventas.ErrorVenta('Solo un veterinario puede registrar autoconsumo de botiquín');
      const pac = paciente(pacienteId), t = tutor(pac.tutorId), p = producto(productoId);
      const ficha = { tipo: 'botiquin', veterinario: { nombre: u.nombre, matricula: u.matricula }, titular: { nombre: t.nombre, apellido: t.apellido, tipoDoc: t.tipoDoc || 'DNI', doc: t.doc }, animal: { pacienteId, nombre: pac.nombre, especie: pac.especie, raza: pac.raza, edad: edad(pac.nacimiento) }, items: [{ productoId, descripcion: p.principioActivo || p.nombre, presentacion: p.presentacion, cantidad, dosis, frecuencia, duracion, via }] };
      const err = Dominio.ventas.validarReceta(ficha, new Date());
      if (err.length) throw new Dominio.ventas.ErrorVenta(err[0]);
      const ctx = ctxInv({ tipo: 'autoconsumo' });
      const id = uid('fc');
      const d = I().descontar(inv(), [{ productoId, cantidad }], Object.assign({}, ctx, { ref: id }));
      const reg = Object.assign(ficha, { id, fecha: ctx.fecha, motivo: motivo || '', lotes: d.asignaciones[0].plan, usuario: u.id });
      S.fichaClinica = (S.fichaClinica || []).concat([reg]);
      if (p.sigtrazavet) d.inv.declaraciones.push({ id: uid('dc'), tipo: 'autoconsumo', productoId, loteId: reg.lotes[0].loteId, lote: reg.lotes.map((l) => l.lote).join(', '), cantidad, ref: id, cuve: null, fecha: ctx.fecha, limite: ctx.fecha, estado: 'pendiente', usuario: u.id });
      agendarDosis(pacienteId, [{ productoId }], id, ctx.fecha);
      aplicarInv(d); return reg;
    },
    anularVenta(ventaId, motivo) {
      if (!Dominio.permisos.puedeAccion(rol(), 'anularVenta')) throw new Dominio.ventas.ErrorVenta('Solo administración puede anular ventas');
      const r = Dominio.ventas.anular(estadoVentas(), ventaId, motivo, ctxInv({ rol: rol() }));
      aplicarVentas(r.estado); return r.venta;
    },
    cambiarUsuario(id) { if (S.usuarios.some((u) => u.id === id)) { S.usuarioActivo = id; save(); } },
    addPaciente(p, t) {
      if (t) { t = Object.assign({ tipoDoc: 'DNI', cuit: '', domicilio: '', notas: '', activo: true }, t, { id: uid('t') }); S.tutores.push(t); p.tutorId = t.id; }
      p.id = uid('p'); p.activo = true; S.pacientes.push(p); save(); return p;
    },
    updatePaciente(id, data) { Object.assign(paciente(id), data); save(); },
    /* Baja lógica: el paciente y toda su historia clínica se conservan. */
    bajaPaciente(id, motivo) { Object.assign(paciente(id), { activo: false, fechaBaja: new Date().toISOString(), motivoBaja: motivo || '' }); save(); },
    reactivarPaciente(id) { const p = paciente(id); p.activo = true; delete p.fechaBaja; delete p.motivoBaja; save(); },
    importarDeRed(rid) {
      const r = S.redPacientes.find((x) => x.id === rid);
      let t = S.tutores.find((x) => x.doc === r.tutor.doc);
      if (!t) { t = Object.assign({ id: uid('t'), tel: '', email: '' }, { tipoDoc: 'DNI', cuit: '', domicilio: '', notas: '', activo: true }, r.tutor); S.tutores.push(t); }
      const p = { id: uid('p'), nombre: r.nombre, especie: r.especie, raza: r.raza, nacimiento: r.nacimiento, sexo: r.sexo, peso: r.peso, tutorId: t.id, origen: 'red', activo: true };
      S.pacientes.push(p);
      S.redPacientes = S.redPacientes.filter((x) => x.id !== rid);
      save(); return p;
    },
    addTutor(t) { t = Object.assign({ tipoDoc: 'DNI', cuit: '', condicionIva: 'Consumidor final', domicilio: '', notas: '', activo: true }, t, { id: uid('t') }); S.tutores.push(t); save(); return t; },
    updateTutor(id, data) { Object.assign(byId('tutores', id), data); save(); },
    /* Baja lógica: el tutor y su historial se conservan; deja de ofrecerse para nuevas altas. */
    bajaTutor(id) { Object.assign(byId('tutores', id), { activo: false, fechaBaja: new Date().toISOString() }); save(); },
    reactivarTutor(id) { const t = byId('tutores', id); t.activo = true; delete t.fechaBaja; save(); },
    /* Turnos: la lógica de dominio valida servicio, recursos, horario y conflictos; si algo falla no se guarda nada. */
    addTurno(datos) {
      const sv = (S.servicios || []).find((x) => x.id === datos.servicioId) || {};
      const t = Object.assign({ estado: 'confirmado', origen: 'clinica', historial: [] }, datos, { tipo: sv.nombre || datos.tipo, duracion: datos.duracion || sv.duracion, recursos: datos.recursos || (sv.recursosDefecto || []).slice() });
      const e = TU().validar(t, ctxTurnos());
      if (e.length) throw new (TU().ErrorTurno)(e[0]);
      t.id = uid('tu'); t.creado = new Date().toISOString(); t.creadoPor = S.usuarioActivo;
      S.turnos.push(t); save(); return t;
    },
    setTurno(id, estado, extra) {
      const i = S.turnos.findIndex((t) => t.id === id);
      const sello = estado === 'cancelado' ? { cancelacion: Object.assign({ fecha: new Date().toISOString(), por: S.usuarioActivo }, extra || {}) } : {};
      S.turnos[i] = TU().cambiarEstado(S.turnos[i], estado, sello); save(); return S.turnos[i];
    },
    /* Reprogramar. Desde el portal, el turno vuelve a quedar como pedido a confirmar. */
    reprogramarTurno(id, fecha, opciones) {
      const i = S.turnos.findIndex((t) => t.id === id);
      let t = TU().reprogramar(S.turnos[i], fecha, ctxTurnos(), (opciones && opciones.portal) ? 'tutor' : S.usuarioActivo);
      if (opciones && opciones.portal) t = Object.assign(t, { estado: 'pendiente', origen: 'portal' });
      S.turnos[i] = t; save(); return t;
    },
    /* ARCION Pet: guarda la conversación del usuario (se conservan sus 50 más recientes). */
    guardarConversacion(c) {
      const copia = JSON.parse(JSON.stringify(c));
      const otras = (S.arcionConversaciones || []).filter((x) => x.id !== c.id);
      const mias = otras.filter((x) => x.usuarioId === c.usuarioId).sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 49).map((x) => x.id);
      S.arcionConversaciones = otras.filter((x) => x.usuarioId !== c.usuarioId || mias.includes(x.id)).concat([copia]);
      guardarSilencioso();
    },
    /* ---------- Peluquería ---------- */
    addPelTurno(datos) {
      const sv = pelServicio(datos.servicioId);
      if (!sv) throw new (TU().ErrorTurno)('Elegí el servicio');
      const pac = paciente(datos.pacienteId);
      const cot = pac ? PE().cotizar(sv, pac, pelFicha(pac.id)) : { duracion: sv.duracion, precio: sv.precio };
      const t = Object.assign({ estado: 'confirmado', origen: 'clinica', historial: [] }, datos, { tipo: sv.nombre, duracion: datos.duracion || cot.duracion, precio: cot.precio, recursos: datos.recursos || sv.recursosDefecto.slice() });
      const e = TU().validar(t, ctxPel());
      if (e.length) throw new (TU().ErrorTurno)(e[0]);
      t.id = uid('pt'); t.creado = new Date().toISOString(); t.creadoPor = S.usuarioActivo;
      S.pelTurnos = (S.pelTurnos || []).concat([t]); save(); return t;
    },
    setPelTurno(id, estado, extra) {
      const i = S.pelTurnos.findIndex((t) => t.id === id);
      const sello = estado === 'cancelado' ? { cancelacion: Object.assign({ fecha: new Date().toISOString(), por: S.usuarioActivo }, extra || {}) } : {};
      S.pelTurnos[i] = TU().cambiarEstado(S.pelTurnos[i], estado, sello); save(); return S.pelTurnos[i];
    },
    reprogramarPelTurno(id, fecha) {
      const i = S.pelTurnos.findIndex((t) => t.id === id);
      S.pelTurnos[i] = TU().reprogramar(S.pelTurnos[i], fecha, ctxPel(), S.usuarioActivo); save(); return S.pelTurnos[i];
    },
    /* Atendido: descuenta los insumos del servicio (todo o nada), guarda las fotos y la nota de la visita en la ficha
       y agenda la próxima visita sugerida para los recordatorios. */
    atenderPelTurno(id, { insumos, nota, fotos }) {
      const i = S.pelTurnos.findIndex((t) => t.id === id);
      const t = TU().cambiarEstado(S.pelTurnos[i], 'atendido');
      const sv = pelServicio(t.servicioId), ahora = new Date().toISOString();
      let d = null;
      const usar = insumos ? (sv.insumos || []) : [];
      if (usar.length) d = I().descontar(inv(), usar, Object.assign(ctxInv({ tipo: 'consumo_interno' }), { ref: id }));
      const ficha = Object.assign({ pacienteId: t.pacienteId, tamano: '', preferencias: '', temperamento: '', piel: '', observaciones: '', fotos: [], visitas: [] }, pelFicha(t.pacienteId));
      const nuevas = (fotos || []).map((f) => ({ id: uid('ft'), fecha: ahora, turnoId: id, tipo: f.tipo, src: f.src }));
      const err = PE().validarFicha(Object.assign({}, ficha, { fotos: ficha.fotos.concat(nuevas) }));
      if (err.length) throw new (PE().ErrorPeluqueria)(err[0]);
      ficha.fotos = ficha.fotos.concat(nuevas);
      ficha.visitas = (ficha.visitas || []).concat([{ fecha: ahora, turnoId: id, servicio: sv.nombre, nota: nota || '', usuario: S.usuarioActivo, insumos: usar.length ? usar : [] }]);
      ficha.actualizado = ahora;
      S.pelFichas = (S.pelFichas || []).filter((f) => f.pacienteId !== t.pacienteId).concat([ficha]);
      S.pelTurnos[i] = Object.assign(t, { atendido: ahora, atendidoPor: S.usuarioActivo, insumosDescontados: usar.length > 0 });
      const prox = PE().proximaVisita(sv, ahora);
      if (prox) {
        S.calendarioSalud = (S.calendarioSalud || []).map((c) => (c.pacienteId === t.pacienteId && c.servicioId === sv.id && c.estado === 'pendiente' ? Object.assign({}, c, { estado: 'reemplazada' }) : c));
        S.calendarioSalud.push({ id: uid('cs'), pacienteId: t.pacienteId, servicioId: sv.id, productoId: null, nombre: sv.nombre, categoria: 'Peluquería', fecha: prox, origen: id, estado: 'pendiente', creado: ahora });
      }
      if (d) aplicarInv(d); else save();
      return S.pelTurnos[i];
    },
    guardarPelFicha(pacienteId, datos) {
      const actual = pelFicha(pacienteId) || { pacienteId, fotos: [], visitas: [] };
      const f = Object.assign({}, actual, datos, { pacienteId, actualizado: new Date().toISOString() });
      const e = PE().validarFicha(f);
      if (e.length) throw new (PE().ErrorPeluqueria)(e[0]);
      S.pelFichas = (S.pelFichas || []).filter((x) => x.pacienteId !== pacienteId).concat([f]); save(); return f;
    },
    agregarFotoPel(pacienteId, tipo, src) { const f = pelFicha(pacienteId) || { fotos: [] }; return A.guardarPelFicha(pacienteId, { fotos: (f.fotos || []).concat([{ id: uid('ft'), fecha: new Date().toISOString(), turnoId: null, tipo, src }]) }); },
    quitarFotoPel(pacienteId, fotoId) { const f = pelFicha(pacienteId); return A.guardarPelFicha(pacienteId, { fotos: f.fotos.filter((x) => x.id !== fotoId) }); },
    guardarPelServicio(datos) {
      if (!Dominio.permisos.puedeAccion(rol(), 'editarPrecios')) throw new (PE().ErrorPeluqueria)('Solo administración puede cambiar precios');
      const e = PE().validarServicio(datos);
      if (e.length) throw new (PE().ErrorPeluqueria)(e[0]);
      const sv = Object.assign({}, pelServicio(datos.id), datos);
      sv.precio = sv.porTamano.mediano.precio; sv.duracion = sv.porTamano.mediano.duracion;
      S.pelServicios = S.pelServicios.map((x) => (x.id === sv.id ? sv : x)); save(); return sv;
    },
    /* Atendido: si el servicio aplica una vacuna o un antiparasitario, el veterinario registra la aplicación (botiquín, art. 20). */
    atenderTurno(id, aplicacion) {
      const t = byId('turnos', id);
      TU().cambiarEstado(t, 'atendido');
      let reg = null;
      if (aplicacion) reg = A.autoconsumo(Object.assign({ pacienteId: t.pacienteId, motivo: t.tipo + ' (turno)' }, aplicacion));
      const i = S.turnos.findIndex((x) => x.id === id);
      S.turnos[i] = TU().cambiarEstado(S.turnos[i], 'atendido', { atendido: new Date().toISOString(), atendidoPor: S.usuarioActivo, aplicacionId: reg ? reg.id : null });
      save(); return { turno: S.turnos[i], aplicacion: reg };
    },
    addEstudio(e) {
      const p = paciente(e.pacienteId) || {};
      Object.assign(e, { id: uid('e'), resultado: null, probPatologia: null, hallazgos: [], derivado: false, activo: true, asignadoA: null, fueraDeAlcance: G().fueraDeAlcance(e.tipo, p.especie) });
      S.estudios.push(e);
      // el turno de imágenes de ese paciente para ese día se cierra solo
      const t = TU().turnoDelEstudio(S.turnos, S.servicios, e);
      if (t) Object.assign(t, { estado: 'atendido', estudioId: e.id, atendido: new Date().toISOString(), atendidoPor: S.usuarioActivo });
      save(); return e;
    },
    /* res = { resultado, probPatologia, hallazgos, probs, modelo } calculado por la CNN.
       Con el informe firmado, el resultado queda congelado: no se vuelve a analizar. */
    aplicarAnalisis(id, res) {
      const e = estudio(id);
      if (!e) return null;
      if (!G().puedeReanalizar(id, S.informes)) return e;
      Object.assign(e, res, { analizadoEn: new Date().toISOString() });
      const inf = informeDeEstudio(id);
      if (inf && inf.estado === 'borrador' && !inf.texto) inf.nivel = nivelConfianza(e);
      save(); return e;
    },
    /* Baja lógica del estudio. Bloqueada si tiene informe firmado o derivación. */
    bajaEstudio(id, motivo) {
      const no = G().motivoNoBaja(id, S.informes, S.derivaciones);
      if (no) throw new Error(no + ': no se puede dar de baja');
      Object.assign(estudio(id), { activo: false, fechaBaja: new Date().toISOString(), motivoBaja: motivo || '', usuarioBaja: S.usuarioActivo });
      save();
    },
    asignar(coleccion, id, usuarioId) { byId(coleccion, id).asignadoA = usuarioId || null; save(); },
    setDemo(on) { S.config.demoMode = !!on; save(); },
    setConfig(datos) {
      const nueva = Object.assign({}, S.config, datos);
      const errores = Dominio.configuracion.validar(nueva);
      if (errores.length) throw new Error(errores[0]);
      S.config = nueva; save();
    },
    guardarUsuario(datos) {
      const lista = S.usuarios.map((u) => (u.id === datos.id ? Object.assign({}, u, datos) : u));
      if (!datos.id) lista.push(Object.assign({ activo: true }, datos, { id: uid('u'), iniciales: (datos.nombre || '?').replace(/^(Dra?\.|Lic\.)\s+/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), creadoV14: true }));
      const errores = Dominio.configuracion.validarUsuarios(lista);
      if (errores.length) throw new Error(errores[0]);
      S.usuarios = lista;
      if (!lista.find((u) => u.id === S.usuarioActivo && u.activo !== false)) S.usuarioActivo = lista.find((u) => u.rol === 'administracion' && u.activo !== false).id;
      save();
    },
    auditar(accion, detalle) { S.auditoria.push(Object.assign({ id: uid('au'), fecha: new Date().toISOString(), usuario: S.usuarioActivo, accion }, detalle)); save(); },
    generarInforme(eid) {
      const e = estudio(eid);
      let inf = informeDeEstudio(eid) || S.informes.find((i) => i.estudioId === eid && i.estado === 'descartado');
      if (inf && inf.estado === 'firmado') return inf;
      if (!inf) { inf = { id: uid('i'), estudioId: eid }; S.informes.push(inf); }
      Object.assign(inf, { fecha: new Date().toISOString(), estado: 'borrador', nivel: nivelConfianza(e), texto: borradorInforme(e) });
      save(); return inf;
    },
    guardarTexto(iid, texto) { byId('informes', iid).texto = texto; save(); },
    firmarInforme(iid, { texto, veredicto, correccion, claseReal, hallazgos }) {
      const inf = byId('informes', iid), e = estudio(inf.estudioId);
      const u = usuario(), ahora = new Date().toISOString();
      // se congela el resultado y la versión del modelo: no cambian aunque después se cambie el modelo activo
      Object.assign(inf, { texto, estado: 'firmado', firmadoPor: u.nombre, firmadoPorId: u.id, matricula: u.matricula || '', fechaFirma: ahora, iaFirmada: G().congelarIA(e, ahora) });
      const real = veredicto === 'coincide' && e.resultado !== 'incierto' ? e.resultado : (claseReal || null);
      S.evaluaciones.push({ id: uid('q'), estudioId: e.id, fecha: ahora, ia: e.resultado, veredicto, correccion: correccion || null, claseReal: real, hallazgos: hallazgos || [], vet: u.nombre, vetId: u.id });
      save(); return inf;
    },
    /* Descartar un borrador es una baja lógica: queda registrado y se puede volver a generar. */
    descartarInforme(id) { Object.assign(byId('informes', id), { estado: 'descartado', fechaDescarte: new Date().toISOString(), usuarioDescarte: S.usuarioActivo }); save(); },
    derivar(eid, motivo) {
      const e = estudio(eid); e.derivado = true;
      const d = { id: uid('d'), estudioId: eid, fecha: new Date().toISOString(), motivo, de: S.usuario.completo, a: null, estado: 'pendiente', respuesta: null };
      S.derivaciones.push(d); save(); return d;
    },
    responderDerivacion(id, a, respuesta) { Object.assign(byId('derivaciones', id), { a, respuesta, estado: 'respondida', fechaRespuesta: new Date().toISOString(), vista: false }); save(); },
    verDerivacion(id) { const d = byId('derivaciones', id); if (d && !d.vista) { d.vista = true; save(); } },
    nuevaInterconsulta({ asunto, pacienteId, urgente, texto }) {
      if (S.pack.usadas >= S.pack.total) return null;
      S.pack.usadas++;
      const now = new Date().toISOString();
      const ic = { id: uid('ic'), asunto, pacienteId, urgente, estado: 'cola', soporte: null, actualizada: now, mensajes: [{ de: S.usuario.completo, rol: 'me', fecha: now, texto }] };
      S.interconsultas.unshift(ic); save(); return ic;
    },
    mensajeInterconsulta(id, texto, rol, de) {
      const ic = byId('interconsultas', id), now = new Date().toISOString();
      ic.mensajes.push({ de: de || S.usuario.completo, rol: rol || 'me', fecha: now, texto });
      ic.actualizada = now;
      if (rol === 'support') { ic.estado = 'curso'; ic.soporte = de; ic.noLeida = true; }
      save();
    },
    leerInterconsulta(id) { const ic = byId('interconsultas', id); if (ic && ic.noLeida) { ic.noLeida = false; save(); } },
    cerrarInterconsulta(id) { byId('interconsultas', id).estado = 'cerrada'; save(); },
    hemoEvento(id, tipo, texto, cambios) {
      const u = byId('hemo', id);
      Object.assign(u, cambios || {});
      u.eventos.push({ fecha: new Date().toISOString(), tipo, texto, lugar: u.ubicacion });
      save(); return u;
    },
  };

  const usuario = () => S.usuarios.find((u) => u.id === S.usuarioActivo) || S.usuarios[0];
  const rol = () => usuario().rol;
  const puede = (modulo, nivel) => Dominio.permisos.puede(rol(), modulo, nivel);
  const puedeAccion = (accion) => Dominio.permisos.puedeAccion(rol(), accion);

  window.Store = {
    get s() { return S; }, save, on: (fn) => listeners.push(fn), uid, usuario, rol, puede, puedeAccion,
    estudiosActivos, contradicciones, demoras, demoraDe, get demo() { return !!(S.config && S.config.demoMode); },
    moduloHabilitado: (m) => Dominio.configuracion.habilitado(S.config, m),
    cajaAbierta: () => Dominio.caja.abierta(S.cajas), facturacionCfg, clienteFactura, ctxTurnos,
    servicio: (id) => (S.servicios || []).find((x) => x.id === id) || null,
    get guardadoOk() { return guardadoOk; },
    pelServicio, pelFicha, ctxPel, pelRecurso: (id) => (S.pelRecursos || []).find((x) => x.id === id) || null,
    recurso: (id) => (S.recursos || []).find((x) => x.id === id) || null,
    get agenda() { return Object.assign({}, Dominio.turnos.AGENDA_DEFECTO, (S.config || {}).agenda); },
    comprobante: (id) => (S.comprobantes || []).find((c) => c.id === id) || null,
    get umbrales() { return Object.assign({}, Dominio.configuracion.DEFECTO.umbrales, (S.config || {}).umbrales); },
    get clinica() { return Object.assign({}, Dominio.configuracion.DEFECTO.clinica, (S.config || {}).clinica); },
    veterinarios: () => S.usuarios.filter((u) => u.rol === 'veterinario' && u.activo !== false), nombreUsuario: (id) => (S.usuarios.find((u) => u.id === id) || {}).nombre || '', producto, catalogosVisibles, inventarioAlertas,
    puedeAjustarStock: (catalogo) => Dominio.permisos.puedeAjustarStock(rol(), catalogo),
    paciente, tutor, estudio, informeDeEstudio, edad, daysBetween, isToday, nivelConfianza, borradorInforme,
    triage, notificaciones, qaStats, filasCalidad, hemoAlertas, RES_LABEL, A,
  };
})();

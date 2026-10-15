/* Vistas · Inventario y ventas (ventas y recetas veterinarias electrónicas). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fShort, openModal, closeModal, confirmModal, toast, formData } = UI;
  const { S, go, pageHead, searchBox, empty, match, bindSearch, on, kpi, tutorName, ui } = VC;
  const V = () => Dominio.ventas;
  const I = () => Dominio.inventario;
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const hoy = () => new Date();
  const hoyISO = () => { const d = hoy(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const usuarioNombre = (id) => ((S().usuarios || []).find((u) => u.id === id) || {}).nombre || '';
  const nro = (v) => 'N.º ' + String(v.numero).padStart(5, '0');
  const ESTADO_RVE = { vigente: ['Vigente', 'b-normal'], dispensada: ['Dispensada', 'b-blue'], anulada: ['Anulada', 'b-gray'], vencida: ['Vencida', 'b-patologico'] };

  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof V().ErrorVenta || e instanceof I().ErrorStock) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }
  const estadoReceta = (r) => (r.estado === 'vigente' && r.tipo !== 'botiquin' && V().diasVigencia(r, hoy()) < 0 ? 'vencida' : r.estado);

  /* =========================================================== VENTAS (listado y recetas) */
  function ventas(modo) {
    const tab = modo === 'recetas' ? 'recetas' : 'ventas';
    const vender = Store.puede('ventas', 'editar');
    const ini = new Date(); ini.setHours(0, 0, 0, 0);
    const desde = ui.vtRango === 'todas' ? null : ui.vtRango === '30' ? new Date(ini.getTime() - 29 * 86400000) : ui.vtRango === '7' ? new Date(ini.getTime() - 6 * 86400000) : ini;
    const enRango = (v) => !desde || new Date(v.fecha) >= desde;
    const r = V().resumen((S().ventas || []).filter(enRango));
    const lista = (S().ventas || []).filter(enRango).filter((v) => (!ui.vtMedio || v.medioPago === ui.vtMedio)).filter((v) => {
      const t = Store.tutor(v.tutorId) || {};
      return match(ui.qVt, t.nombre, t.apellido, t.doc, v.numero, v.items.map((i) => i.nombre).join(' '));
    }).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const rangos = [['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['todas', 'Todas']];
    const recetas = (S().recetas || []).slice().sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
    const html = (tab === 'recetas'
      ? pageHead('file', 'Recetas (RVE)', 'Recetas veterinarias electrónicas registradas y entregas desde botiquín (Res. SENASA 654/2026).', '', 'violet')
      : pageHead('cart', 'Ventas', 'Pet shop y farmacia veterinaria. Cada venta descuenta stock y queda asociada al tutor.', vender ? '<button class="btn primary" id="btn-venta">' + icon('plus') + 'Nueva venta</button>' : '')) +
      (tab === 'ventas'
        ? '<div class="grid kpis">' + kpi('cart', '', 'Ventas', r.cantidad, rangos.find((x) => x[0] === (ui.vtRango || 'hoy'))[1].toLowerCase()) + kpi('file', 'violet', 'Facturación', pesos(r.total), 'IVA incluido') + kpi('chart', '', 'Ticket promedio', pesos(r.promedio), '') +
          kpi('globe', 'amber', 'Por medio de pago', Object.keys(r.porMedio).length ? Object.entries(r.porMedio).sort((a, b) => b[1] - a[1]).map(([m, t]) => V().MEDIOS[m] + ' ' + pesos(t)).slice(0, 1)[0] : '—', Object.entries(r.porMedio).sort((a, b) => b[1] - a[1]).slice(1).map(([m, t]) => V().MEDIOS[m] + ' ' + pesos(t)).join(' · ')) + '</div>' +
          '<div class="toolbar">' + searchBox('q-vt', 'Buscar por tutor, documento, número o producto…', ui.qVt || '') +
          '<div class="seg">' + rangos.map(([k, l]) => '<button data-rango="' + k + '" class="' + ((ui.vtRango || 'hoy') === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
          '<select class="filter" id="f-medio"><option value="">Todos los medios</option>' + Object.entries(V().MEDIOS).map(([k, l]) => '<option value="' + k + '"' + (ui.vtMedio === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
          '<div class="table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Tutor</th><th>Detalle</th><th>Pago</th><th style="text-align:right">Total</th><th></th></tr></thead><tbody>' +
          (lista.map((v) => { const t = Store.tutor(v.tutorId); return '<tr class="clickable" data-v="' + v.id + '"' + (v.estado === 'anulada' ? ' style="opacity:.55"' : '') + '><td class="strong nowrap">' + nro(v) + '</td><td class="nowrap">' + fShort(v.fecha) + '</td><td>' + tutorName(t) + '</td><td><div class="truncate">' + esc(v.items.map((i) => i.cantidad + '× ' + i.nombre).join(', ')) + '</div>' + (v.recetaId ? '<span class="badge b-violet">RVE</span>' : '') + '</td><td>' + esc(V().MEDIOS[v.medioPago]) + (v.cuotas > 1 ? ' · ' + v.cuotas + ' cuotas' : '') + '</td><td class="strong nowrap" style="text-align:right">' + pesos(v.total) + '</td><td>' + (v.estado === 'anulada' ? '<span class="badge b-gray">Anulada</span>' : '') + '</td></tr>'; }).join('') ||
            '<tr><td colspan="7">' + empty('cart', 'Sin ventas en el período', vender ? '<span class="small">Registrá una con “Nueva venta”.</span>' : '') + '</td></tr>') + '</tbody></table></div>'
        : '<p class="small muted" style="margin-top:0">Recetas veterinarias electrónicas (RVE) registradas al vender. La RVE se emite en SIGTRAZAVET o SIGTrámites (Res. SENASA 654/2026, art. 25); acá queda su registro con el CUVE. Vigencia: ' + V().VIGENCIA_RVE + ' días corridos; una sola dispensa.</p>' +
          '<div class="table-wrap"><table><thead><tr><th>CUVE</th><th>Emisión</th><th>Vigencia</th><th>Titular</th><th>Animal</th><th>Prescriptor</th><th>Estado</th></tr></thead><tbody>' +
          (recetas.map((rv) => { const est = estadoReceta(rv); const d = rv.tipo === 'botiquin' ? null : V().diasVigencia(rv, hoy()); return '<tr' + (rv.ventaId ? ' class="clickable" data-v="' + rv.ventaId + '"' : '') + '><td class="strong">' + (rv.tipo === 'botiquin' ? '<span class="badge b-gray">Botiquín (art. 20)</span>' : esc(rv.cuve)) + '</td><td class="nowrap">' + (rv.emision ? fDate(rv.emision) : fDate(rv.fechaRegistro)) + '</td><td class="nowrap">' + (d == null ? '—' : d < 0 ? 'vencida' : d === 0 ? 'último día' : d + ' días') + '</td><td>' + esc(rv.titular.apellido + ', ' + rv.titular.nombre) + '<div class="sp">' + esc((Dominio.tutores.TIPOS_DOC[rv.titular.tipoDoc] || 'DNI') + ' ' + rv.titular.doc) + '</div></td><td>' + esc(rv.animal.nombre) + ' <span class="sp">(' + esc(rv.animal.especie) + ')</span></td><td>' + esc(rv.veterinario.nombre) + '<div class="sp">' + esc(rv.veterinario.matricula) + '</div></td><td><span class="badge ' + ESTADO_RVE[est][1] + '">' + ESTADO_RVE[est][0] + '</span></td></tr>'; }).join('') ||
            '<tr><td colspan="7">' + empty('file', 'Todavía no hay recetas registradas', '') + '</td></tr>') + '</tbody></table></div>');
    return {
      html, mount(root) {
        bindSearch(root, 'q-vt', 'qVt', () => App.render(true));
        on(root, '[data-tab]', 'click', (el) => { ui.vtTab = el.dataset.tab; App.render(); });
        on(root, '[data-rango]', 'click', (el) => { ui.vtRango = el.dataset.rango; App.render(); });
        const fm = root.querySelector('#f-medio'); if (fm) fm.onchange = (e) => { ui.vtMedio = e.target.value; App.render(); };
        on(root, '[data-v]', 'click', (el) => ventaDetalle(el.dataset.v));
        const bv = root.querySelector('#btn-venta'); if (bv) bv.onclick = () => go('#/ventas/nueva');
      },
    };
  }

  /* =========================================================== PUNTO DE VENTA */
  const pos = () => (ui.pos = ui.pos || { tutorId: '', pacienteId: '', items: [], medioPago: 'efectivo', cuotas: 1, receta: null, cat: null, q: '' });
  function ventaNueva() {
    const P = pos();
    if (!Store.puede('ventas', 'editar')) return { html: empty('cart', 'Tu rol no puede registrar ventas', ''), mount() {} };
    const cats = Store.catalogosVisibles().filter((c) => c === 'petshop' || Store.puedeAccion('venderFarmacia'));
    if (!cats.includes(P.cat)) P.cat = cats[0];
    const tutores = S().tutores.filter((t) => t.activo !== false).sort((a, b) => (a.apellido + a.nombre).localeCompare(b.apellido + b.nombre));
    const tutor = Store.tutor(P.tutorId);
    const mascotas = tutor ? S().pacientes.filter((p) => p.tutorId === tutor.id) : [];
    if (P.pacienteId && !mascotas.some((p) => p.id === P.pacienteId)) P.pacienteId = '';
    const prods = S().productos.filter((p) => p.activo !== false && p.catalogo === P.cat && match(P.q, p.nombre, p.marca, p.presentacion, p.sku, p.categoria, p.principioActivo))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
    const items = P.items.map((it) => Object.assign({ p: Store.producto(it.productoId) }, it)).filter((x) => x.p);
    const tot = V().totales(items.map((x) => ({ precioUnit: x.p.precio, cantidad: x.cantidad })));
    const necesitaReceta = items.some((x) => x.p.requiereReceta);
    if (!necesitaReceta) P.receta = null;
    const disponibles = necesitaReceta && tutor ? V().recetasDisponibles(S().recetas, tutor, P.pacienteId, hoy()) : [];

    let recetaHtml = '';
    if (necesitaReceta) {
      const rv = P.receta;
      recetaHtml = '<div class="card card-pad" style="margin-top:14px;border-color:#DDD0FB"><div class="section-title" style="margin-top:0;color:#6D28D9">Receta veterinaria electrónica</div>' +
        '<p class="small muted" style="margin-top:0">' + items.filter((x) => x.p.requiereReceta).map((x) => esc(x.p.nombre)).join(', ') + ' se ' + (items.filter((x) => x.p.requiereReceta).length > 1 ? 'venden' : 'vende') + ' solo contra una RVE vigente (Res. SENASA 654/2026, art. 11).</p>' +
        (!tutor || !P.pacienteId ? '<div class="callout amber">' + icon('alert') + '<span>Elegí el tutor y la mascota para asociar la receta.</span></div>'
          : rv ? '<div class="callout green" style="display:block"><b>' + (rv.tipo === 'botiquin' ? 'Entrega desde botiquín profesional (art. 20)' : 'RVE ' + esc(rv.cuve)) + '</b><div class="small">' + esc(rv.veterinario.nombre + ' · ' + rv.veterinario.matricula) + (rv.tipo === 'botiquin' ? '' : ' · emitida el ' + fDate(rv.emision) + ' · ' + V().diasVigencia(rv, hoy()) + ' días de vigencia') + '</div>' +
              '<div class="small">' + rv.items.map((it) => esc(it.descripcion + ': ' + it.cantidad + ' · ' + it.dosis + ' ' + it.frecuencia + ' · ' + it.duracion + ' · vía ' + it.via)).join('<br>') + '</div>' +
              '<div style="margin-top:8px;display:flex;gap:8px"><button class="btn sm" id="rv-edit">Editar</button><button class="btn sm ghost" id="rv-quitar">Quitar</button></div></div>'
            : (disponibles.length ? '<div class="field"><label>Recetas vigentes de ' + esc(tutor.nombre) + '</label><select id="rv-sel"><option value="">— Elegí una receta registrada —</option>' + disponibles.map((r) => '<option value="' + r.id + '">' + esc(r.cuve + ' · ' + fDate(r.emision) + ' · ' + r.items.map((i) => i.descripcion).join(', ')) + '</option>').join('') + '</select></div>' : '') +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn violet sm" id="rv-nueva">' + icon('file') + 'Registrar RVE</button>' + (Store.rol() === 'veterinario' ? '<button class="btn sm" id="rv-botiquin">Entregar desde botiquín (art. 20)</button>' : '') + '</div>') + '</div>';
    }

    const html = '<a href="#/ventas" class="btn ghost sm" style="margin-bottom:12px">← Ventas</a>' + pageHead('cart', 'Nueva venta', 'Precios con IVA incluido. El stock se descuenta al confirmar (primero el lote que vence antes).') +
      '<div class="pos">' +
      '<div><div class="card card-pad">' +
      (cats.length > 1 ? '<div class="tabs" style="margin-top:-6px">' + cats.map((c) => '<button data-pcat="' + c + '" class="' + (c === P.cat ? 'on' : '') + '">' + I().CATALOGOS[c] + '</button>').join('') + '</div>' : '') +
      searchBox('q-pos', 'Buscar producto, marca o principio activo…', P.q) +
      '<div class="pos-prods">' + (prods.map((p) => {
        const e = I().estado(p, S().lotes, hoy());
        const enCarrito = (P.items.find((x) => x.productoId === p.id) || {}).cantidad || 0;
        const sin = e.vendible - enCarrito <= 0;
        return '<button class="pos-prod' + (sin ? ' sin' : '') + '" data-add="' + p.id + '"' + (sin ? ' disabled' : '') + '><div class="t">' + esc(p.nombre) + '</div><div class="s">' + esc(p.presentacion) + (p.requiereReceta ? ' · <span style="color:#6D28D9">Receta</span>' : '') + '</div><div class="pp"><span>' + pesos(p.precio) + '</span><span class="sp">' + (sin ? 'sin stock' : (e.vendible - enCarrito) + ' disp.') + '</span></div></button>';
      }).join('') || empty('search', 'Sin productos', '')) + '</div></div></div>' +
      '<div><div class="card card-pad">' +
      '<div class="form-grid" style="grid-template-columns:1fr 1fr"><div class="field"><label>Tutor *</label><select id="pos-tutor"><option value="">— Elegí el tutor —</option>' + tutores.map((t) => '<option value="' + t.id + '"' + (t.id === P.tutorId ? ' selected' : '') + '>' + tutorName(t) + ' · ' + esc(t.doc) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Mascota' + (necesitaReceta ? ' *' : ' (opcional)') + '</label><select id="pos-pac"' + (tutor ? '' : ' disabled') + '><option value="">— Sin mascota —</option>' + mascotas.map((p) => '<option value="' + p.id + '"' + (p.id === P.pacienteId ? ' selected' : '') + '>' + esc(p.nombre + ' (' + p.especie + ')') + '</option>').join('') + '</select></div></div>' +
      '<div class="section-title">Carrito</div>' +
      (items.length ? items.map((x) => '<div class="pos-item"><div class="grow"><div class="t">' + esc(x.p.nombre) + (x.p.requiereReceta ? ' <span class="badge b-violet">Receta</span>' : '') + '</div><div class="s">' + esc(x.p.presentacion) + ' · ' + pesos(x.p.precio) + ' c/u</div></div>' +
        '<div class="qty"><button data-menos="' + x.productoId + '" aria-label="Menos">−</button><span>' + x.cantidad + '</span><button data-mas="' + x.productoId + '" aria-label="Más">+</button></div><div class="strong nowrap" style="width:96px;text-align:right">' + pesos(x.p.precio * x.cantidad) + '</div><button class="icon-btn danger" data-quitar="' + x.productoId + '" aria-label="Quitar">' + icon('x') + '</button></div>').join('')
        : '<p class="muted small">Agregá productos desde la izquierda.</p>') +
      recetaHtml +
      '<div class="section-title">Medio de pago</div><div class="seg pos-medios">' + Object.entries(V().MEDIOS).map(([k, l]) => '<button data-medio="' + k + '" class="' + (P.medioPago === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      (P.medioPago === 'credito' ? '<div class="field" style="margin-top:10px;max-width:200px"><label>Cuotas</label><select id="pos-cuotas">' + [1, 3, 6, 12].map((c) => '<option' + (P.cuotas === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' : '') +
      '<div class="pos-total"><div><div class="small muted">IVA contenido (21 %): ' + pesos(tot.ivaContenido) + '</div><div class="small muted">' + items.reduce((t, x) => t + x.cantidad, 0) + ' unidades</div></div><div class="n">' + pesos(tot.total) + '</div></div>' +
      '<div style="display:flex;gap:10px;margin-top:14px"><button class="btn" id="pos-limpiar">Vaciar</button><button class="btn primary" id="pos-ok" style="flex:1;justify-content:center"' + (items.length ? '' : ' disabled') + '>' + icon('check') + 'Confirmar venta</button></div>' +
      '</div></div></div>';

    return {
      html, mount(root) {
        bindSearch(root, 'q-pos', 'q', () => { P.q = ui.q; App.render(true); });
        on(root, '[data-pcat]', 'click', (el) => { P.cat = el.dataset.pcat; App.render(); });
        on(root, '[data-add]', 'click', (el) => { const it = P.items.find((x) => x.productoId === el.dataset.add); if (it) it.cantidad++; else P.items.push({ productoId: el.dataset.add, cantidad: 1 }); App.render(); });
        on(root, '[data-mas]', 'click', (el) => { const it = P.items.find((x) => x.productoId === el.dataset.mas); const e = I().estado(Store.producto(it.productoId), S().lotes, hoy()); if (it.cantidad >= e.vendible) return toast('No hay más stock vendible de este producto', 'warn'); it.cantidad++; App.render(); });
        on(root, '[data-menos]', 'click', (el) => { const it = P.items.find((x) => x.productoId === el.dataset.menos); it.cantidad--; if (!it.cantidad) P.items = P.items.filter((x) => x !== it); App.render(); });
        on(root, '[data-quitar]', 'click', (el) => { P.items = P.items.filter((x) => x.productoId !== el.dataset.quitar); App.render(); });
        on(root, '[data-medio]', 'click', (el) => { P.medioPago = el.dataset.medio; App.render(); });
        root.querySelector('#pos-tutor').onchange = (e) => { P.tutorId = e.target.value; P.pacienteId = ''; P.receta = null; const ms = S().pacientes.filter((p) => p.tutorId === P.tutorId); if (ms.length === 1) P.pacienteId = ms[0].id; App.render(); };
        root.querySelector('#pos-pac').onchange = (e) => { P.pacienteId = e.target.value; P.receta = null; App.render(); };
        const cu = root.querySelector('#pos-cuotas'); if (cu) cu.onchange = (e) => { P.cuotas = Number(e.target.value); };
        root.querySelector('#pos-limpiar').onclick = () => { ui.pos = null; App.render(); };
        const b = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
        b('#rv-nueva', () => recetaForm('mascotas'));
        b('#rv-botiquin', () => recetaForm('botiquin'));
        b('#rv-edit', () => recetaForm(P.receta.tipo, P.receta));
        b('#rv-quitar', () => { P.receta = null; App.render(); });
        const sel = root.querySelector('#rv-sel'); if (sel) sel.onchange = (e) => { P.receta = (S().recetas || []).find((r) => r.id === e.target.value) || null; App.render(); };
        root.querySelector('#pos-ok').onclick = () => {
          const venta = { tutorId: P.tutorId, pacienteId: P.pacienteId || null, medioPago: P.medioPago, cuotas: P.cuotas, items: P.items.map((x) => ({ productoId: x.productoId, cantidad: x.cantidad })), receta: P.receta };
          intentar(() => Store.A.registrarVenta(venta), (v) => { ui.pos = null; go('#/ventas'); setTimeout(() => comprobante(v.id), 50); toast('Venta ' + nro(v) + ' registrada'); });
        };
      },
    };
  }

  /* Formulario de RVE "Prescripción en mascotas" (art. 18 d) o de entrega desde botiquín (art. 20). */
  function recetaForm(tipo, previa) {
    const P = pos(), t = Store.tutor(P.tutorId), pac = Store.paciente(P.pacienteId), u = Store.usuario();
    const botiquin = tipo === 'botiquin';
    const conReceta = P.items.map((x) => Store.producto(x.productoId)).filter((p) => p && p.requiereReceta);
    const prev = (pid) => (previa && previa.items.find((i) => i.productoId === pid)) || {};
    const vet = previa ? previa.veterinario : (u.rol === 'veterinario' ? { nombre: u.nombre, matricula: u.matricula || '' } : { nombre: '', matricula: '' });
    const fila = (p) => { const pv = prev(p.id); const cant = (P.items.find((x) => x.productoId === p.id) || {}).cantidad; return '<div class="rv-item" data-pid="' + p.id + '"><div class="strong" style="grid-column:1/-1">' + esc(p.nombre) + ' <span class="sp">' + esc(p.presentacion) + '</span></div>' +
      '<div class="field"><label>Producto o principio activo</label><input data-k="descripcion" value="' + esc(pv.descripcion || p.principioActivo || p.nombre) + '"></div>' +
      '<div class="field"><label>Cantidad recetada</label><input data-k="cantidad" type="number" min="1" step="1" value="' + esc(pv.cantidad || cant) + '"></div>' +
      '<div class="field"><label>Dosis</label><input data-k="dosis" value="' + esc(pv.dosis || '') + '" placeholder="Ej.: 1 comprimido"></div>' +
      '<div class="field"><label>Frecuencia</label><input data-k="frecuencia" value="' + esc(pv.frecuencia || '') + '" placeholder="Ej.: cada 12 h"></div>' +
      '<div class="field"><label>Duración</label><input data-k="duracion" value="' + esc(pv.duracion || '') + '" placeholder="Ej.: 7 días"></div>' +
      '<div class="field"><label>Vía</label><select data-k="via">' + V().VIAS.map((v) => '<option' + ((pv.via || 'Oral') === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div></div>'; };
    openModal({
      title: botiquin ? 'Entrega desde botiquín profesional' : 'Registrar receta veterinaria electrónica', wide: true,
      body: '<p class="small muted" style="margin-top:0">' + (botiquin
        ? 'Res. SENASA 654/2026, art. 20: el veterinario entrega desde su botiquín sin emitir RVE, registrando la atención en la ficha clínica con los datos de la RVE de mascotas y dando de baja el producto como autoconsumo en SIGTRAZAVET.'
        : 'Tipo “Prescripción en mascotas” (Res. SENASA 654/2026, art. 18 d). La receta se emite en SIGTRAZAVET o SIGTrámites; copiá acá su CUVE y los datos. Vigencia: 30 días corridos desde la emisión.') + '</p>' +
        '<div class="form-grid">' +
        (botiquin ? '' : '<div class="field"><label>CUVE *</label><input name="cuve" value="' + esc(previa ? previa.cuve : '') + '" placeholder="Código Único de Verificación Electrónica"></div><div class="field"><label>Fecha de emisión *</label><input type="date" name="emision" value="' + esc(previa ? previa.emision : hoyISO()) + '" max="' + hoyISO() + '"></div>') +
        '<div class="field"><label>Veterinario/a prescriptor *</label><input name="vetNombre" value="' + esc(vet.nombre) + '"' + (botiquin ? ' readonly' : '') + '></div><div class="field"><label>Matrícula *</label><input name="vetMatricula" value="' + esc(vet.matricula) + '"' + (botiquin ? ' readonly' : '') + '></div>' +
        '</div><div class="grid halves" style="margin:14px 0"><div class="callout green" style="display:block"><b>Titular</b><div class="small">' + esc(t.nombre + ' ' + t.apellido) + ' · ' + esc((Dominio.tutores.TIPOS_DOC[t.tipoDoc] || 'DNI') + ' ' + t.doc) + '</div></div>' +
        '<div class="callout green" style="display:block"><b>Animal</b><div class="small">' + esc(pac.nombre + ' · ' + pac.especie + ' · ' + pac.raza + ' · ' + Store.edad(pac.nacimiento)) + '</div></div></div>' +
        '<div class="section-title">Productos prescriptos</div>' + conReceta.map(fila).join(''),
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn violet" id="rv-ok">' + (botiquin ? 'Registrar entrega' : 'Asociar receta a la venta') + '</button>',
      onMount(m) {
        m.querySelector('#rv-ok').onclick = () => {
          const f = formData(m);
          const r = {
            tipo, cuve: botiquin ? '' : f.cuve, emision: botiquin ? null : f.emision,
            veterinario: { nombre: f.vetNombre, matricula: f.vetMatricula },
            titular: { nombre: t.nombre, apellido: t.apellido, tipoDoc: t.tipoDoc || 'DNI', doc: t.doc },
            animal: { pacienteId: pac.id, nombre: pac.nombre, especie: pac.especie, raza: pac.raza, edad: Store.edad(pac.nacimiento) },
            items: [...m.querySelectorAll('.rv-item')].map((row) => { const o = { productoId: row.dataset.pid }; row.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = el.dataset.k === 'cantidad' ? Number(el.value) : el.value.trim(); }); return o; }),
          };
          const err = V().validarReceta(r, hoy());
          if (err.length) return toast(err[0], 'warn');
          if (!botiquin && (S().recetas || []).some((x) => x.cuve && x.cuve.toUpperCase() === r.cuve.toUpperCase())) return toast('Ese CUVE ya está registrado: cada RVE admite una sola dispensa', 'warn');
          P.receta = r; closeModal(); App.render();
        };
      },
    });
  }

  /* =========================================================== DETALLE, COMPROBANTE Y ANULACIÓN */
  function ventaDetalle(id) {
    const v = (S().ventas || []).find((x) => x.id === id);
    if (!v) return;
    const t = Store.tutor(v.tutorId) || {}, pac = v.pacienteId ? Store.paciente(v.pacienteId) : null;
    const rv = v.recetaId ? (S().recetas || []).find((r) => r.id === v.recetaId) : null;
    const anular = Store.puedeAccion('anularVenta') && v.estado !== 'anulada';
    openModal({
      title: 'Venta ' + nro(v) + (v.estado === 'anulada' ? ' <span class="badge b-gray">Anulada</span>' : ''), wide: true,
      body: '<dl class="dl"><dt>Fecha</dt><dd>' + fShort(v.fecha) + '</dd><dt>Tutor</dt><dd><a href="#/tutores/' + t.id + '">' + tutorName(t) + '</a> · ' + esc(t.doc) + '</dd>' + (pac ? '<dt>Mascota</dt><dd>' + esc(pac.nombre) + '</dd>' : '') +
        '<dt>Medio de pago</dt><dd>' + esc(V().MEDIOS[v.medioPago]) + (v.cuotas > 1 ? ' · ' + v.cuotas + ' cuotas' : '') + '</dd><dt>Vendió</dt><dd>' + esc(usuarioNombre(v.usuario)) + '</dd>' +
        (rv ? '<dt>Receta</dt><dd>' + (rv.tipo === 'botiquin' ? 'Botiquín profesional (art. 20)' : 'RVE ' + esc(rv.cuve)) + ' · ' + esc(rv.veterinario.nombre + ' · ' + rv.veterinario.matricula) + '</dd>' : '') +
        (v.anulacion ? '<dt>Anulación</dt><dd>' + fShort(v.anulacion.fecha) + ' · ' + esc(usuarioNombre(v.anulacion.usuario)) + ' · ' + esc(v.anulacion.motivo) + '</dd>' : '') + '</dl>' +
        '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Producto</th><th>Lotes</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>' +
        v.items.map((i) => '<tr><td>' + esc(i.nombre) + '<div class="sp">' + esc(i.presentacion) + '</div></td><td class="sp">' + esc(i.lotes.map((l) => (l.lote || 's/lote') + (l.vence ? ' (vto ' + fDate(l.vence) + ')' : '') + ' ×' + l.cantidad).join(', ')) + '</td><td style="text-align:right">' + i.cantidad + '</td><td style="text-align:right" class="nowrap">' + pesos(i.precioUnit) + '</td><td style="text-align:right" class="nowrap">' + pesos(i.subtotal) + '</td></tr>').join('') +
        '<tr><td colspan="4" style="text-align:right" class="strong">Total (IVA incluido)</td><td style="text-align:right" class="strong nowrap">' + pesos(v.total) + '</td></tr></tbody></table></div>',
      foot: '<button class="btn" data-close>Cerrar</button><button class="btn" id="vd-comp">' + icon('file') + 'Comprobante</button>' + (anular ? '<button class="btn danger" id="vd-anular">Anular venta</button>' : ''),
      onMount(m) {
        m.querySelector('#vd-comp').onclick = () => comprobante(id);
        const ba = m.querySelector('#vd-anular');
        if (ba) ba.onclick = () => openModal({
          title: 'Anular venta ' + nro(v),
          body: '<p class="muted" style="margin-top:0">Se repone el stock en cada lote' + (rv && rv.tipo !== 'botiquin' ? ', la receta vuelve a estar disponible si sigue vigente' : '') + ' y, si la operación ya se había declarado en SIGTRAZAVET, queda pendiente su anulación (art. 8 c, 20 días).</p><div class="field"><label>Motivo *</label><input name="motivo" placeholder="Ej.: devolución, error de carga"></div>',
          foot: '<button class="btn" data-close>Cancelar</button><button class="btn danger" id="an-ok">Anular</button>',
          onMount(m2) { m2.querySelector('#an-ok').onclick = () => intentar(() => Store.A.anularVenta(id, formData(m2).motivo), () => { closeModal(); toast('Venta anulada y stock repuesto'); }); },
        });
      },
    });
  }

  function comprobante(id) {
    const v = (S().ventas || []).find((x) => x.id === id), t = Store.tutor(v.tutorId) || {}, pac = v.pacienteId ? Store.paciente(v.pacienteId) : null;
    const rv = v.recetaId ? (S().recetas || []).find((r) => r.id === v.recetaId) : null;
    const cuerpo = '<div class="ticket"><div style="text-align:center"><img src="assets/logo-texto.png" alt="ArcionPet" style="height:26px"><div class="small muted">' + esc(Store.clinica.razonSocial || Store.clinica.nombre) + (Store.clinica.cuit ? ' · CUIT ' + esc(Store.clinica.cuit) : '') + '<br>' + esc(Store.clinica.domicilio) + '</div><div class="strong" style="margin-top:8px">Comprobante de venta ' + nro(v) + '</div><div class="small muted">' + fShort(v.fecha) + ' · no válido como factura</div></div>' +
      '<div class="small" style="margin:10px 0">Cliente: ' + esc(t.nombre + ' ' + t.apellido) + ' · ' + esc(t.doc) + (pac ? '<br>Mascota: ' + esc(pac.nombre) : '') + '</div>' +
      v.items.map((i) => '<div class="tk-row"><span>' + i.cantidad + ' × ' + esc(i.nombre) + '</span><span>' + pesos(i.subtotal) + '</span></div>').join('') +
      '<div class="tk-row tk-total"><span>Total</span><span>' + pesos(v.total) + '</span></div><div class="tk-row small muted"><span>IVA contenido (21 %)</span><span>' + pesos(v.ivaContenido) + '</span></div>' +
      '<div class="small" style="margin-top:8px">Pago: ' + esc(V().MEDIOS[v.medioPago]) + (v.cuotas > 1 ? ' en ' + v.cuotas + ' cuotas' : '') + '</div>' +
      (rv ? '<div class="small" style="margin-top:4px">' + (rv.tipo === 'botiquin' ? 'Entrega desde botiquín profesional' : 'RVE CUVE ' + esc(rv.cuve)) + ' · ' + esc(rv.veterinario.nombre + ' ' + rv.veterinario.matricula) + '</div>' : '') +
      (v.estado === 'anulada' ? '<div class="strong" style="color:var(--red);margin-top:8px">VENTA ANULADA</div>' : '') + '</div>';
    openModal({
      title: 'Comprobante', body: cuerpo,
      foot: '<button class="btn" data-close>Cerrar</button><button class="btn primary" id="tk-print">' + icon('file') + 'Imprimir</button>',
      onMount(m) {
        m.querySelector('#tk-print').onclick = () => {
          const w = window.open('', '_blank', 'width=420,height=640');
          if (!w) return toast('Permití las ventanas emergentes para imprimir', 'warn');
          w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Comprobante ' + nro(v) + '</title><base href="' + location.href.split('#')[0] + '"><link rel="stylesheet" href="css/styles.css"></head><body style="background:#fff;padding:16px">' + cuerpo + '<script>window.onload=function(){window.print()}<\/script></body></html>');
          w.document.close();
        };
      },
    });
  }

  Object.assign(window.Views, { ventas, ventaNueva, ventaDetalle, comprobante, recetaForm });
})();

/* Vistas · Inventario y ventas (inventario unificado de pet shop y farmacia). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fShort, openModal, closeModal, confirmModal, toast, formData } = UI;
  const { S, go, pageHead, searchBox, empty, match, bindSearch, on, kpi, ui } = VC;
  const I = () => Dominio.inventario;
  const pesos = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const hoy = () => new Date();
  const usuarioNombre = (id) => ((S().usuarios || []).find((u) => u.id === id) || {}).nombre || id || '';
  const TIPO_MOV = { ingreso: 'Ingreso', venta: 'Venta', anulacion: 'Anulación de venta', ajuste: 'Ajuste', baja_vencimiento: 'Baja por vencimiento' };

  function catalogoActual() {
    const vis = Store.catalogosVisibles();
    if (!vis.includes(ui.invCat)) ui.invCat = vis[0];
    return ui.invCat;
  }
  function venceBadge(fecha) {
    if (!fecha) return '<span class="muted">—</span>';
    const d = I().diasHasta(fecha, hoy());
    if (d < 0) return fDate(fecha) + ' <span class="badge b-patologico">vencido</span>';
    if (d <= I().DIAS_AVISO_FARMACIA) return fDate(fecha) + ' <span class="badge b-incierto">' + (d === 0 ? 'hoy' : d + ' d') + '</span>';
    return fDate(fecha);
  }
  function stockBadge(e, p) {
    if (e.sinStock) return '<span class="badge b-patologico">Sin stock</span>';
    if (e.bajoMinimo) return '<span class="badge b-incierto">Bajo mínimo</span>';
    return '';
  }
  const etiquetas = (p) => (p.requiereReceta ? ' <span class="badge b-violet" title="Venta bajo receta veterinaria electrónica">Receta</span>' : '') + (p.sigtrazavet ? ' <span class="badge b-blue" title="Alcanzado por SIGTRAZAVET (Res. SENASA 654/2026)">SIGTRAZAVET</span>' : '');

  /* =========================================================== INVENTARIO */
  function inventario() {
    const cat = catalogoActual();
    const editar = Store.puede('inventario', 'editar');
    const admin = Store.puedeAccion('editarPrecios');
    const ajustar = Store.puedeAjustarStock(cat);
    const prods = S().productos.filter((p) => p.catalogo === cat && p.activo !== false);
    const est = {};
    prods.forEach((p) => { est[p.id] = I().estado(p, S().lotes, hoy()); });
    const al = Store.inventarioAlertas();
    const conAlerta = (p) => est[p.id].bajoMinimo || est[p.id].porVencer || est[p.id].vencidos > 0;
    const lista = prods.filter((p) => (!ui.invCateg || p.categoria === ui.invCateg) && (!ui.invAlertas || conAlerta(p)) && match(ui.qInv, p.nombre, p.marca, p.presentacion, p.sku, p.categoria, p.principioActivo))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
    const vencidos = al.vencidos.filter((l) => (Store.producto(l.productoId) || {}).catalogo === cat);
    const porVencer = al.porVencer.filter((l) => (Store.producto(l.productoId) || {}).catalogo === cat);
    const bajo = prods.filter((p) => est[p.id].bajoMinimo);
    const decl = cat === 'farmacia' ? al.declaraciones : [];

    const tabs = Store.catalogosVisibles().length > 1
      ? '<div class="tabs">' + Store.catalogosVisibles().map((c) => '<button data-cat="' + c + '" class="' + (c === cat ? 'on' : '') + '">' + I().CATALOGOS[c] + '</button>').join('') + '</div>' : '';
    const rows = lista.map((p) => {
      const e = est[p.id];
      return '<tr class="clickable" data-p="' + p.id + '"><td><div class="strong">' + esc(p.nombre) + etiquetas(p) + '</div><div class="sp">' + esc([p.marca, p.presentacion].filter(Boolean).join(' · ')) + ' · ' + esc(p.sku || '') + '</div></td>' +
        '<td>' + esc(p.categoria) + '</td><td class="nowrap">' + pesos(p.precio) + '</td>' +
        '<td class="nowrap"><span class="strong">' + e.vendible + '</span> <span class="sp">/ mín ' + p.stockMinimo + '</span> ' + stockBadge(e, p) + (e.vencidos ? '<div class="sp" style="color:var(--red)">+' + e.vencidos + ' vencido' + (e.vencidos > 1 ? 's' : '') + '</div>' : '') + '</td>' +
        (cat === 'farmacia' ? '<td class="nowrap">' + venceBadge(e.proximoVence) + '</td>' : '') +
        '<td class="actions">' + (editar ? '<button class="icon-btn" data-ing="' + p.id + '" title="Ingresar mercadería">' + icon('plus') + '</button>' : '') + '<button class="icon-btn" title="Ver detalle">' + icon('eye') + '</button></td></tr>';
    }).join('');

    const html = pageHead('package', 'Inventario', 'Stock unificado de pet shop y farmacia veterinaria. Precios con IVA incluido.',
      (editar ? '<button class="btn" id="btn-ing">' + icon('plus') + 'Ingresar mercadería</button>' : '') + (admin ? '<button class="btn primary" id="btn-prod">' + icon('plus') + 'Nuevo producto</button>' : '')) +
      tabs +
      '<div class="grid kpis">' +
      kpi('package', '', 'Productos', prods.length, I().CATEGORIAS[cat].length + ' categorías') +
      kpi('file', 'violet', 'Valor del stock', pesos(I().valorStock(prods, S().lotes, hoy())), 'a precio de venta') +
      kpi('alert', 'amber', 'Bajo stock mínimo', bajo.length, bajo.length ? 'reponer' : 'todo en orden') +
      (cat === 'farmacia' ? kpi('clock', 'red', 'Por vencer (30 días)', porVencer.length, vencidos.length ? vencidos.length + ' lote' + (vencidos.length > 1 ? 's' : '') + ' vencido' + (vencidos.length > 1 ? 's' : '') : 'sin vencidos') : '') +
      '</div>' +
      (vencidos.length ? '<div class="callout red" style="margin-bottom:14px;display:block">' + icon('alert') + ' <b>' + vencidos.length + ' lote' + (vencidos.length > 1 ? 's' : '') + ' vencido' + (vencidos.length > 1 ? 's' : '') + ':</b> no se pueden vender. Dalos de baja para registrarlo en el inventario.' +
        vencidos.map((l) => { const p = Store.producto(l.productoId); return '<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><span class="grow">' + esc(p.nombre) + ' · lote ' + esc(l.lote) + ' · venció el ' + fDate(l.vence) + ' · ' + l.cantidad + ' u.</span>' + (ajustar ? '<button class="btn sm" data-baja="' + l.id + '">Dar de baja</button>' : '') + '</div>'; }).join('') + '</div>' : '') +
      (decl.length ? '<div class="callout violet" style="margin-bottom:14px;display:block">' + icon('clipboard') + ' <b>Pendiente de declarar en SIGTRAZAVET</b> (contingencias, Res. SENASA 654/2026, art. 12: 10 días corridos).' +
        decl.map((d) => { const p = Store.producto(d.productoId) || {}; const r = I().diasHasta(d.limite, hoy()); return '<div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap"><span class="grow">' + esc(I().MOTIVOS_AJUSTE[d.tipo] || 'Vencimiento') + ' · ' + esc(p.nombre) + ' · lote ' + esc(d.lote) + ' · ' + d.cantidad + ' u. · <b>' + (r < 0 ? 'plazo vencido' : r === 0 ? 'vence hoy' : 'quedan ' + r + ' días') + '</b></span>' + (ajustar ? '<button class="btn sm" data-decl="' + d.id + '">Marcar como declarada</button>' : '') + '</div>'; }).join('') + '</div>' : '') +
      '<div class="toolbar">' + searchBox('q-inv', 'Buscar por producto, marca, código o principio activo…', ui.qInv || '') +
      '<select class="filter" id="f-categ"><option value="">Todas las categorías</option>' + I().CATEGORIAS[cat].map((c) => '<option' + (ui.invCateg === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
      '<div class="seg"><button data-al="0" class="' + (ui.invAlertas ? '' : 'on') + '">Todos</button><button data-al="1" class="' + (ui.invAlertas ? 'on' : '') + '">Con alertas</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th>' + (cat === 'farmacia' ? '<th>Próximo vencimiento</th>' : '') + '<th class="actions"></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">' + empty('package', 'Sin productos', '<span class="small">Probá con otro filtro.</span>') + '</td></tr>') + '</tbody></table></div>';

    return {
      html, mount(root) {
        bindSearch(root, 'q-inv', 'qInv', () => App.render(true));
        on(root, '[data-cat]', 'click', (el) => { ui.invCat = el.dataset.cat; ui.invCateg = ''; App.render(); });
        on(root, '[data-al]', 'click', (el) => { ui.invAlertas = el.dataset.al === '1'; App.render(); });
        root.querySelector('#f-categ').onchange = (e) => { ui.invCateg = e.target.value; App.render(); };
        on(root, '[data-p]', 'click', (el) => productoDetalle(el.dataset.p));
        on(root, '[data-ing]', 'click', (el, e) => { e.stopPropagation(); ingresoForm(el.dataset.ing); });
        on(root, '[data-baja]', 'click', (el) => bajaVencidoConfirm(el.dataset.baja));
        on(root, '[data-decl]', 'click', (el) => declararForm(el.dataset.decl));
        const bi = root.querySelector('#btn-ing'); if (bi) bi.onclick = () => ingresoForm();
        const bp = root.querySelector('#btn-prod'); if (bp) bp.onclick = () => productoForm();
      },
    };
  }

  /* Ejecuta una operación de stock y muestra el error de regla de negocio si lo hay. */
  function intentar(fn, ok) {
    try { const r = fn(); if (ok) ok(r); return true; } catch (e) {
      if (e instanceof I().ErrorStock) { toast(e.message, 'warn'); return false; }
      throw e;
    }
  }
  const avisoDeclaracion = (d) => { if (d) toast('Generada declaración SIGTRAZAVET pendiente (plazo: 10 días)', 'warn'); };

  function bajaVencidoConfirm(loteId) {
    const l = S().lotes.find((x) => x.id === loteId), p = Store.producto(l.productoId);
    confirmModal('Dar de baja lote vencido', 'Se da de baja todo el saldo del lote <b>' + esc(l.lote) + '</b> de ' + esc(p.nombre) + ' (' + l.cantidad + ' u.).' + (p.sigtrazavet ? ' Al estar alcanzado por SIGTRAZAVET, queda pendiente declararlo dentro de los 10 días.' : ''), 'Dar de baja',
      () => intentar(() => Store.A.bajaLoteVencido(loteId), (d) => { toast('Lote dado de baja'); avisoDeclaracion(d); }));
  }

  function declararForm(id) {
    const d = S().declaraciones.find((x) => x.id === id), p = Store.producto(d.productoId);
    openModal({
      title: 'Declaración en SIGTRAZAVET',
      body: '<p class="muted" style="margin-top:0">' + esc(I().MOTIVOS_AJUSTE[d.tipo] || 'Vencimiento') + ' de ' + d.cantidad + ' u. de ' + esc(p.nombre) + ' (lote ' + esc(d.lote) + '). Registrá acá el número de operación que te dio SIGTRAZAVET.</p>' +
        '<div class="field"><label>N.º de operación SIGTRAZAVET</label><input name="nro" placeholder="Ej.: 2026-0001234"></div>' +
        '<p class="small muted">ArcionPet no se conecta con SIGTRAZAVET: la declaración se hace en el sistema del SENASA y acá queda el registro.</p>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="dc-ok">Marcar como declarada</button>',
      onMount(m) { m.querySelector('#dc-ok').onclick = () => { const f = formData(m); if (!f.nro) return toast('Ingresá el número de operación', 'warn'); Store.A.marcarDeclarada(id, f.nro); closeModal(); toast('Declaración registrada'); }; },
    });
  }

  function ingresoForm(productoId) {
    const cat = productoId ? Store.producto(productoId).catalogo : catalogoActual();
    const prods = S().productos.filter((p) => p.catalogo === cat && p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
    openModal({
      title: 'Ingresar mercadería · ' + I().CATALOGOS[cat],
      body: '<div class="form-grid">' +
        '<div class="field full"><label>Producto</label><select name="productoId" id="ig-p">' + prods.map((p) => '<option value="' + p.id + '"' + (p.id === productoId ? ' selected' : '') + '>' + esc(p.nombre + ' · ' + p.presentacion) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Lote' + (cat === 'farmacia' ? ' *' : ' (opcional)') + '</label><input name="lote"></div>' +
        '<div class="field"><label>Vencimiento' + (cat === 'farmacia' ? ' *' : ' (opcional)') + '</label><input type="date" name="vence"></div>' +
        '<div class="field"><label>Cantidad</label><input type="number" name="cantidad" min="1" step="1" value="1"></div>' +
        '<div class="field"><label>Remito / proveedor</label><input name="nota" placeholder="Opcional"></div>' +
        '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ig-ok">Ingresar</button>',
      onMount(m) {
        m.querySelector('#ig-ok').onclick = () => {
          const f = formData(m);
          const datos = { productoId: f.productoId, lote: f.lote, vence: f.vence || null, cantidad: Number(f.cantidad), nota: f.nota };
          intentar(() => Store.A.ingresarStock(datos), () => { closeModal(); toast('Ingresaron ' + datos.cantidad + ' u. de ' + esc(Store.producto(datos.productoId).nombre)); });
        };
      },
    });
  }

  function ajusteForm(loteId) {
    const l = S().lotes.find((x) => x.id === loteId), p = Store.producto(l.productoId);
    openModal({
      title: 'Ajuste de stock',
      body: '<p class="muted" style="margin-top:0">' + esc(p.nombre) + (l.lote ? ' · lote ' + esc(l.lote) : '') + ' · disponible: <b>' + l.cantidad + '</b></p><div class="form-grid">' +
        '<div class="field"><label>Motivo</label><select name="motivo">' + Object.entries(I().MOTIVOS_AJUSTE).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Cantidad a descontar</label><input type="number" name="cantidad" min="1" max="' + l.cantidad + '" step="1" value="1"></div>' +
        '<div class="field full"><label>Detalle</label><input name="nota" placeholder="Opcional"></div></div>' +
        (p.sigtrazavet ? '<p class="small muted">Producto alcanzado por SIGTRAZAVET: merma, rotura o robo generan una declaración pendiente (10 días).</p>' : ''),
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="aj-ok">Registrar ajuste</button>',
      onMount(m) {
        m.querySelector('#aj-ok').onclick = () => {
          const f = formData(m);
          intentar(() => Store.A.ajustarStock({ loteId, cantidad: Number(f.cantidad), motivo: f.motivo, nota: f.nota }), (d) => { closeModal(); toast('Ajuste registrado'); avisoDeclaracion(d); });
        };
      },
    });
  }

  function productoDetalle(id) {
    const p = Store.producto(id), e = I().estado(p, S().lotes, hoy());
    const lotes = S().lotes.filter((l) => l.productoId === id && (l.cantidad > 0)).sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999'));
    const movs = S().movimientos.filter((mv) => mv.productoId === id).slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 15);
    const ajustar = Store.puedeAjustarStock(p.catalogo);
    const dato = (k, v) => '<dt>' + k + '</dt><dd>' + (v || '<span class="muted">—</span>') + '</dd>';
    openModal({
      title: esc(p.nombre) + etiquetas(p), wide: true,
      body: '<div class="grid halves" style="margin:0 0 16px"><dl class="dl">' + dato('Catálogo', I().CATALOGOS[p.catalogo]) + dato('Categoría', esc(p.categoria)) + dato('Marca', esc(p.marca)) + dato('Presentación', esc(p.presentacion)) + dato('Código', esc(p.sku)) +
        (p.catalogo === 'farmacia' ? dato('Principio activo', esc(p.principioActivo)) : '') + '</dl>' +
        '<dl class="dl">' + dato('Precio (IVA incl.)', pesos(p.precio)) + dato('Stock vendible', '<b>' + e.vendible + '</b> ' + stockBadge(e, p)) + dato('Stock mínimo', String(p.stockMinimo)) +
        (p.catalogo === 'farmacia' ? dato('Próximo vencimiento', venceBadge(e.proximoVence)) + dato('Venta', p.requiereReceta ? 'Bajo receta veterinaria electrónica' : 'Libre') : '') + '</dl></div>' +
        '<div class="section-title">Lotes con stock</div>' +
        (lotes.length ? '<div class="table-wrap"><table><thead><tr><th>Lote</th><th>Vencimiento</th><th>Cantidad</th><th>Ingreso</th><th class="actions"></th></tr></thead><tbody>' +
          lotes.map((l) => { const venc = l.vence && I().diasHasta(l.vence, hoy()) < 0; return '<tr><td>' + esc(l.lote || '—') + '</td><td class="nowrap">' + venceBadge(l.vence) + '</td><td>' + l.cantidad + '</td><td class="nowrap">' + (l.ingreso ? fDate(l.ingreso) : '—') + '</td><td class="actions">' + (ajustar ? (venc ? '<button class="btn sm" data-baja="' + l.id + '">Dar de baja</button>' : '<button class="btn sm ghost" data-aj="' + l.id + '">Ajustar</button>') : '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted">Sin stock.</p>') +
        '<div class="section-title">Últimos movimientos</div>' +
        (movs.length ? '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Lote</th><th style="text-align:right">Cantidad</th><th>Usuario</th><th>Detalle</th></tr></thead><tbody>' +
          movs.map((mv) => { const l = S().lotes.find((x) => x.id === mv.loteId) || {}; return '<tr><td class="nowrap">' + fShort(mv.fecha) + '</td><td>' + (TIPO_MOV[mv.tipo] || mv.tipo) + (mv.motivo ? ' · ' + esc(I().MOTIVOS_AJUSTE[mv.motivo]) : '') + '</td><td>' + esc(l.lote || '—') + '</td><td class="strong" style="text-align:right;color:' + (mv.cantidad < 0 ? 'var(--red)' : 'var(--emerald)') + '">' + (mv.cantidad > 0 ? '+' : '') + mv.cantidad + '</td><td>' + esc(usuarioNombre(mv.usuario)) + '</td><td class="sp">' + esc(mv.nota || mv.ref || '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted">Sin movimientos.</p>'),
      foot: '<button class="btn" data-close>Cerrar</button>' + (Store.puedeAccion('editarPrecios') ? '<button class="btn" id="pd-edit">' + icon('edit') + 'Editar producto</button>' : '') + (Store.puede('inventario', 'editar') ? '<button class="btn primary" id="pd-ing">' + icon('plus') + 'Ingresar mercadería</button>' : ''),
      onMount(m) {
        m.querySelectorAll('[data-aj]').forEach((b) => b.onclick = () => ajusteForm(b.dataset.aj));
        m.querySelectorAll('[data-baja]').forEach((b) => b.onclick = () => bajaVencidoConfirm(b.dataset.baja));
        const be = m.querySelector('#pd-edit'); if (be) be.onclick = () => productoForm(id);
        const bi = m.querySelector('#pd-ing'); if (bi) bi.onclick = () => ingresoForm(id);
      },
    });
  }

  function productoForm(id) {
    const p = id ? Store.producto(id) : { catalogo: catalogoActual(), categoria: I().CATEGORIAS[catalogoActual()][0], stockMinimo: 1, activo: true };
    const opt = (lista, sel) => lista.map((x) => '<option' + (x === sel ? ' selected' : '') + '>' + x + '</option>').join('');
    openModal({
      title: id ? 'Editar producto' : 'Nuevo producto',
      body: '<div class="form-grid">' +
        '<div class="field"><label>Catálogo</label><select name="catalogo" id="pf-cat"' + (id ? ' disabled' : '') + '>' + Object.entries(I().CATALOGOS).map(([k, v]) => '<option value="' + k + '"' + (k === p.catalogo ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Categoría</label><select name="categoria" id="pf-categ">' + opt(I().CATEGORIAS[p.catalogo], p.categoria) + '</select></div>' +
        '<div class="field full"><label>Nombre</label><input name="nombre" value="' + esc(p.nombre || '') + '"></div>' +
        '<div class="field"><label>Marca</label><input name="marca" value="' + esc(p.marca || '') + '"></div>' +
        '<div class="field"><label>Presentación</label><input name="presentacion" value="' + esc(p.presentacion || '') + '"></div>' +
        '<div class="field"><label>Código (SKU)</label><input name="sku" value="' + esc(p.sku || '') + '"></div>' +
        '<div class="field"><label>Precio con IVA ($)</label><input type="number" name="precio" min="1" step="1" value="' + esc(p.precio || '') + '"></div>' +
        '<div class="field"><label>Stock mínimo</label><input type="number" name="stockMinimo" min="0" step="1" value="' + esc(p.stockMinimo) + '"></div>' +
        '<div class="field" data-farm><label>Principio activo</label><input name="principioActivo" value="' + esc(p.principioActivo || '') + '"></div>' +
        '<label class="full" data-farm style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="requiereReceta"' + (p.requiereReceta ? ' checked' : '') + '> Venta bajo receta veterinaria electrónica (RVE)</label>' +
        '<label class="full" data-farm style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sigtrazavet"' + (p.sigtrazavet ? ' checked' : '') + '> Alcanzado por SIGTRAZAVET (según disposiciones de la Dirección Nacional de Sanidad Animal)</label>' +
        (id ? '<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="activo"' + (p.activo !== false ? ' checked' : '') + '> Activo (los inactivos no se ofrecen para la venta)</label>' : '') +
        '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="pf-ok">' + (id ? 'Guardar' : 'Crear producto') + '</button>',
      onMount(m) {
        const cat = m.querySelector('#pf-cat'), categ = m.querySelector('#pf-categ');
        const sync = () => { m.querySelectorAll('[data-farm]').forEach((el) => { el.style.display = cat.value === 'farmacia' ? '' : 'none'; }); };
        cat.onchange = () => { categ.innerHTML = opt(I().CATEGORIAS[cat.value]); sync(); };
        sync();
        m.querySelector('#pf-ok').onclick = () => {
          const f = formData(m);
          const farm = (id ? p.catalogo : f.catalogo) === 'farmacia';
          const datos = { catalogo: id ? p.catalogo : f.catalogo, categoria: f.categoria, nombre: f.nombre, marca: f.marca, presentacion: f.presentacion, sku: f.sku, precio: Number(f.precio), stockMinimo: Number(f.stockMinimo),
            principioActivo: farm ? f.principioActivo : '', requiereReceta: farm && f.requiereReceta, sigtrazavet: farm && f.sigtrazavet };
          if (id) { datos.id = id; datos.activo = f.activo; }
          intentar(() => Store.A.guardarProducto(datos), () => { closeModal(); toast(id ? 'Producto actualizado' : 'Producto creado'); });
        };
      },
    });
  }

  Object.assign(window.Views, { inventario, productoDetalle, ingresoForm, ajusteForm, productoForm });
})();

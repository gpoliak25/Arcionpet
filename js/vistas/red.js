/* Vistas · Red y gestión (interconsultas, calidad, analítica, modelo CNN). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const { S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;

  /* =========================================================== INTERCONSULTAS */
  const IC_ESTADO = { cola: ['En cola', 'b-blue'], curso: ['En curso', 'b-violet'], cerrada: ['Cerrada', 'b-gray'] };
  function interconsultas() {
    const pk = S().pack, list = S().interconsultas.slice().sort((a, b) => b.actualizada.localeCompare(a.actualizada));
    const mes = new Date().toISOString().slice(0, 7);
    const html = pageHead('headset', 'Interconsultas EISPLUS', 'Consultá casos con el equipo central de veterinarios de soporte de la red.', '<button class="btn violet" id="btn-nueva">' + icon('headset') + 'Nueva interconsulta</button>', 'violet') +
      '<div class="card card-pad" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px"><span>' + esc(pk.nombre) + ' · ' + mes + ' (se renueva el 1° de cada mes)</span><span class="muted">' + pk.usadas + ' / ' + pk.total + ' · quedan ' + (pk.total - pk.usadas) + '</span></div><div class="progress violet"><div style="width:' + (pk.usadas / pk.total * 100) + '%"></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Asunto</th><th>Paciente</th><th>Estado</th><th>Soporte</th><th>Asignado a</th><th>Actualizada</th></tr></thead><tbody>' +
      list.map((i) => { const p = Store.paciente(i.pacienteId); const n = i.mensajes.length; return '<tr class="clickable" data-go="#/interconsultas/' + i.id + '"><td><div class="' + (i.noLeida ? 'strong' : '') + '">' + esc(i.asunto) + (i.noLeida ? ' <span class="badge b-violet">nuevo</span>' : '') + '</div><div class="small muted">' + (i.urgente ? '<span class="badge b-patologico" style="margin-right:6px">Urgente</span>' : '') + esc(i.mensajes[0].de) + ' · ' + n + (n === 1 ? ' mensaje' : ' mensajes') + '</div></td><td>' + (p ? esc(p.nombre) : '—') + '</td><td><span class="badge ' + IC_ESTADO[i.estado][1] + '">' + IC_ESTADO[i.estado][0] + '</span></td><td>' + (i.soporte ? '<span style="color:var(--violet)">' + icon('headset') + '</span> ' + esc(i.soporte) : '<span class="muted">Sin asignar</span>') + '</td><td>' + VC.asignadoSelect('interconsultas', i.id, i.asignadoA) + '</td><td class="nowrap">' + fShort(i.actualizada) + VC.demoraBadge('interconsultas', i.id) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    return { html, mount(root) { VC.bindAsignados(root); on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); root.querySelector('#btn-nueva').onclick = () => interconsultaForm(); } };
  }
  function interconsultaForm(pid, asunto) {
    const pk = S().pack;
    if (pk.usadas >= pk.total) return toast('Se agotó el cupo mensual de interconsultas', 'warn');
    openModal({
      title: 'Nueva interconsulta',
      body: '<div class="callout violet" style="margin-bottom:14px">' + icon('headset') + '<span>Consume 1 consulta del ' + esc(pk.nombre) + ' · quedan ' + (pk.total - pk.usadas) + ' este mes.</span></div><div class="form-grid">' +
        '<div class="field full"><label>Asunto</label><input name="asunto" value="' + esc(asunto || '') + '" placeholder="Ej.: Michi: ¿conviene PAAF del nódulo?"></div>' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field full"><label>Consulta</label><textarea name="texto" placeholder="Describí el caso y qué necesitás del equipo de soporte"></textarea></div>' +
        '<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="urgente"> Marcar como urgente</label></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn violet" id="ic-ok">' + icon('send') + 'Enviar</button>',
      onMount(m) {
        m.querySelector('#ic-ok').onclick = () => {
          const f = formData(m);
          if (!f.asunto || !f.texto) return toast('Completá asunto y consulta', 'warn');
          const ic = A.nuevaInterconsulta(f); closeModal(); toast('Interconsulta enviada al equipo EISPLUS'); go('#/interconsultas/' + ic.id);
          simularSoporte(ic.id);
        };
      },
    });
  }
  const SOPORTE = ['Dra. Paula Ferrari', 'Dr. Andrés Molina'];
  /* Respuesta simulada del soporte: solo en modo demo. */
  function simularSoporte(id) {
    if (!Store.demo) return;
    setTimeout(() => {
      const ic = S().interconsultas.find((x) => x.id === id);
      if (!ic || ic.estado === 'cerrada') return;
      const quien = ic.soporte || SOPORTE[S().interconsultas.indexOf(ic) % 2];
      const txt = ic.mensajes.length <= 1
        ? 'Hola, tomo el caso. Revisé los estudios cargados en la plataforma. Te sugiero ' + (ic.urgente ? 'estabilizar primero y ' : '') + 'sumar una proyección complementaria; con eso confirmamos. ¿Me pasás la evolución de las últimas 48 h?'
        : 'Perfecto, gracias. Con esa información coincido con tu plan. Si en 7 días no mejora, lo volvemos a revisar.';
      A.mensajeInterconsulta(id, txt, 'support', quien);
      if (!location.hash.startsWith('#/interconsultas/' + id)) toast('Nueva respuesta de ' + quien);
    }, 3500);
  }
  function interconsultaDetalle(id) {
    setTimeout(() => VC.bindAsignados(document.getElementById('view')), 0);
    const ic = S().interconsultas.find((x) => x.id === id);
    if (!ic) return { html: empty('chat', 'Interconsulta no encontrada', ''), mount() {} };
    const p = Store.paciente(ic.pacienteId);
    const html = '<a href="#/interconsultas" class="btn ghost sm" style="margin-bottom:12px">← Interconsultas</a>' +
      pageHead('headset', esc(ic.asunto), (p ? esc(p.nombre) + ' · ' : '') + '<span class="badge ' + IC_ESTADO[ic.estado][1] + '">' + IC_ESTADO[ic.estado][0] + '</span>' + (ic.urgente ? ' <span class="badge b-patologico">Urgente</span>' : '') + (ic.soporte ? ' · Soporte: ' + esc(ic.soporte) : '') + (ic.estado !== 'cerrada' ? ' · Asignado a: ' + VC.asignadoSelect('interconsultas', ic.id, ic.asignadoA) + VC.demoraBadge('interconsultas', ic.id) : ''),
        ic.estado !== 'cerrada' ? '<button class="btn" id="btn-close">' + icon('check') + 'Cerrar consulta</button>' : '', 'violet') +
      '<div class="card card-pad"><div class="thread">' + ic.mensajes.map((m) => '<div class="msg ' + m.rol + '"><div class="meta">' + esc(m.de) + ' · ' + fShort(m.fecha) + '</div>' + esc(m.texto) + '</div>').join('') +
      (ic.estado === 'cola' ? '<div class="small muted" style="text-align:center">Esperando que un veterinario de soporte tome el caso…</div>' : '') + '</div>' +
      (ic.estado !== 'cerrada' ? '<div class="arcion-form" style="padding:16px 0 0"><input id="ic-msg" placeholder="Escribí un mensaje…"><button id="ic-send" aria-label="Enviar">' + icon('send') + '</button></div>' : '<p class="small muted" style="margin:16px 0 0">Consulta cerrada.</p>') + '</div>';
    return {
      html, mount(root) {
        A.leerInterconsulta(id);
        const send = root.querySelector('#ic-send');
        if (send) {
          const inp = root.querySelector('#ic-msg');
          const fire = () => { if (!inp.value.trim()) return; A.mensajeInterconsulta(id, inp.value.trim()); simularSoporte(id); };
          send.onclick = fire; inp.onkeydown = (e) => { if (e.key === 'Enter') fire(); };
        }
        const bc = root.querySelector('#btn-close'); if (bc) bc.onclick = () => { A.cerrarInterconsulta(id); toast('Interconsulta cerrada'); };
      },
    };
  }

  /* =========================================================== CONTROL DE CALIDAD */
  const CQ = () => Dominio.calidad, AN = () => Dominio.analitica;
  const pctTxt = (v) => (v == null ? '—' : Math.round(v * 100) + '%');
  /* Aviso de muestra chica: con pocas evaluaciones los porcentajes son orientativos. */
  const avisoMuestra = (st) => (st.muestraChica ? '<div class="callout amber" style="margin-bottom:14px">' + icon('alert') + '<span><b>Muestra chica (n = ' + st.total + ', menos de ' + CQ().N_MINIMO + ').</b> Los porcentajes son orientativos' + (st.ic ? ': la concordancia real podría estar entre ' + pctTxt(st.ic[0]) + ' y ' + pctTxt(st.ic[1]) + ' (IC 95 %)' : '') + '.</span></div>' : '');
  function calidad() {
    const st = Store.qaStats();
    const list = S().evaluaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((q) => { const e = Store.estudio(q.estudioId) || {}, p = Store.paciente(e.pacienteId) || {}; return match(ui.qQa, p.nombre, q.vet, q.correccion || '', q.veredicto, Store.RES_LABEL[q.ia], (q.hallazgos || []).map((c) => (CQ().hallazgo(c) || {}).nombre).join(' ')); });
    const VB = { coincide: ['Coincide', 'b-solid-green'], corrige: ['Corrige', 'b-solid-orange'], descarta: ['Descarta', 'b-solid-red'] };
    const REAL = { normal: 'Normal', patologico: 'Patológico' };
    const c = st.confusion, freq = CQ().frecuenciaHallazgos(S().evaluaciones);
    const caso = (q, tipo) => { const e = Store.estudio(q.estudioId) || {}; return '<div class="list-row clickable" data-go="#/estudios/' + q.estudioId + '"><div class="grow"><span class="t">' + pacLabel(Store.paciente(e.pacienteId)) + '</span> <span class="muted">· ' + fDate(q.fecha) + ' · IA: ' + Store.RES_LABEL[q.ia] + (e.probPatologia != null ? ' (' + e.probPatologia + ' %)' : '') + '</span><div class="s">' + esc(q.correccion || '') + ((q.hallazgos || []).length ? ' · ' + esc(q.hallazgos.map((x) => (CQ().hallazgo(x) || {}).nombre).join(', ')) : '') + '</div></div><span class="badge ' + (tipo === 'fn' ? 'b-patologico' : 'b-incierto') + '">' + (tipo === 'fn' ? 'Falso negativo' : 'Falso positivo') + '</span></div>'; };
    const html = pageHead('clipboard', 'Control de calidad (QA)', 'Concordancia IA–veterinario, errores de la IA y dataset etiquetado para reentrenamiento.', '<button class="btn" id="btn-csv">' + icon('download') + 'CSV anonimizado</button><button class="btn" id="btn-json">' + icon('download') + 'JSON anonimizado</button>') +
      avisoMuestra(st) +
      '<div class="grid kpis">' +
      '<div class="card big-kpi"><div class="kl">Concordancia IA–vet</div><div class="kv" style="color:var(--green)">' + st.pct + '%</div><div class="ks">' + st.coinciden + ' de ' + st.total + (st.ic ? ' · IC 95 %: ' + pctTxt(st.ic[0]) + '–' + pctTxt(st.ic[1]) : '') + '</div></div>' +
      '<div class="card big-kpi"><div class="kl">Falsos negativos</div><div class="kv" style="color:var(--red)">' + c.fn + '</div><div class="ks">la IA dijo normal y era patológico</div></div>' +
      '<div class="card big-kpi"><div class="kl">Falsos positivos</div><div class="kv" style="color:#EA580C">' + c.fp + '</div><div class="ks">la IA dijo patológico y era normal</div></div>' +
      '<div class="card big-kpi"><div class="kl">Sensibilidad · especificidad</div><div class="kv">' + pctTxt(st.sensibilidad) + ' · ' + pctTxt(st.especificidad) + '</div><div class="ks">' + c.inciertos + ' incierto' + (c.inciertos === 1 ? '' : 's') + ' fuera del cálculo</div></div></div>' +
      '<div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>Matriz de confusión</h3></div><div class="card-pad"><table class="mini"><thead><tr><th></th><th>Real normal</th><th>Real patológico</th></tr></thead><tbody>' +
        '<tr><th>IA normal</th><td>' + c.vn + '</td><td style="color:var(--red);font-weight:700">' + c.fn + ' FN</td></tr><tr><th>IA patológico</th><td style="color:#EA580C;font-weight:700">' + c.fp + ' FP</td><td>' + c.vp + '</td></tr></tbody></table>' +
        '<p class="small muted">Inciertos: ' + c.inciertos + ' · sin clase confirmada: ' + c.sinClase + '. Veredictos: ' + st.porVeredicto.coincide + ' coinciden, ' + st.porVeredicto.corrige + ' corrigen, ' + st.porVeredicto.descarta + ' descartan.</p></div></div>' +
      '<div class="card"><div class="card-head"><h3>Hallazgos codificados</h3></div><div class="card-pad" style="padding-top:8px">' + (freq.length ? freq.map((h) => '<div class="bar-row"><div class="bl"><span>' + esc(h.nombre) + ' <span class="sp">' + esc(h.codigo) + '</span></span><span>' + h.n + '</span></div><div class="progress"><div style="width:' + (h.n / freq[0].n * 100) + '%"></div></div></div>').join('') : '<p class="muted">Sin hallazgos codificados todavía.</p>') +
        '<details style="margin-top:10px"><summary class="small">Ver el catálogo (' + CQ().HALLAZGOS.length + ')</summary><div class="small" style="margin-top:6px">' + CQ().HALLAZGOS.map((h) => '<div><b>' + esc(h.codigo) + '</b> · ' + esc(h.nombre) + '</div>').join('') + '</div></details></div></div></div>' +
      (st.falsosNegativos.length || st.falsosPositivos.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:var(--red)">' + icon('alert') + '</span><h3>Errores de la IA para revisar</h3></div>' + st.falsosNegativos.map((q) => caso(q, 'fn')).join('') + st.falsosPositivos.map((q) => caso(q, 'fp')).join('') + '</div>' : '') +
      '<div class="toolbar">' + searchBox('q-qa', 'Buscar por paciente, veterinario, hallazgo o veredicto…', ui.qQa) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>IA</th><th>Veredicto</th><th>Clase real</th><th>Hallazgos</th><th>Veterinario/a</th></tr></thead><tbody>' +
      (list.map((q) => { const e = Store.estudio(q.estudioId) || {}, real = CQ().claseReal(q); return '<tr class="clickable" data-go="#/estudios/' + q.estudioId + '"><td class="strong">' + fDate(q.fecha) + '</td><td>' + pacLabel(Store.paciente(e.pacienteId)) + '</td><td>' + Store.RES_LABEL[q.ia] + '</td><td><span class="badge ' + VB[q.veredicto][1] + '">' + VB[q.veredicto][0] + '</span>' + (q.correccion ? '<div class="sp">' + esc(q.correccion) + '</div>' : '') + '</td><td>' + (real ? REAL[real] : '—') + '</td><td class="sp">' + esc((q.hallazgos || []).map((x) => (CQ().hallazgo(x) || { nombre: x }).nombre).join(', ') || '—') + '</td><td>' + esc(q.vet) + '</td></tr>'; }).join('') ||
        '<tr><td colspan="7">' + empty('clipboard', 'Sin evaluaciones', '<span class="small">Se registran al firmar informes.</span>') + '</td></tr>') + '</tbody></table></div>' +
      '<p class="small muted">La exportación es anonimizada: sin nombres de pacientes, tutores ni veterinarios, sin texto libre, con fechas por mes y seudónimos estables dentro de cada archivo.</p>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-qa', 'qQa', () => App.render(true));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        const stamp = new Date().toISOString().slice(0, 10);
        const filas = () => CQ().anonimizar(Store.filasCalidad());
        root.querySelector('#btn-json').onclick = () => { const f = filas(); if (!f.length) return toast('No hay datos para exportar', 'warn'); download('arcionpet-calidad-anonimizado-' + stamp + '.json', JSON.stringify(f, null, 2), 'application/json'); toast('Dataset anonimizado exportado en JSON'); };
        root.querySelector('#btn-csv').onclick = () => { const f = filas(); if (!f.length) return toast('No hay datos para exportar', 'warn'); download('arcionpet-calidad-anonimizado-' + stamp + '.csv', '﻿' + CQ().csv(f), 'text/csv;charset=utf-8'); toast('Dataset anonimizado exportado en CSV'); };
      },
    };
  }

  /* =========================================================== ANALÍTICA */
  const pesosA = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
  const barras = (pares, total, fmt) => (pares.length ? pares.map(([l, n, c]) => '<div class="bar-row"><div class="bl"><span>' + esc(l) + '</span><span>' + (fmt ? fmt(n) : n) + (total ? ' (' + Math.round(n / total * 100) + '%)' : '') + '</span></div><div class="progress"><div style="width:' + (n / (total || Math.max(...pares.map((p) => p[1])) || 1) * 100) + '%' + (c ? ';background:' + c : '') + '"></div></div></div>').join('') : '<p class="muted">Sin datos en el período.</p>');
  function analitica() {
    const s = S(), now = new Date();
    const periodo = ui.anPeriodo || '30', r = AN().rango(periodo, now);
    const TABS = [['diagnostico', 'Diagnóstico', 'imagenes'], ['turnos', 'Turnos', 'turnos'], ['ventas', 'Ventas', 'ventas'], ['hemo', 'Hemocomponentes', 'hemocomponentes'], ['aliados', 'Aliados', 'aliados']].filter((t) => Store.puede(t[2]) && (t[0] !== 'aliados' || Store.moduloHabilitado('aliados')));
    const tab = TABS.some((t) => t[0] === ui.anTab) ? ui.anTab : TABS[0][0];
    let cuerpo = '';
    if (tab === 'diagnostico') {
      const est = Store.estudiosActivos().filter((e) => AN().en(e.fecha, r));
      const st = Store.qaStats((q) => AN().en(q.fecha, r));
      const cnt = (x) => est.filter((e) => e.resultado === x).length, total = est.length;
      const analizados = est.filter((e) => e.resultado);
      const firm = analizados.filter((e) => (Store.informeDeEstudio(e.id) || {}).estado === 'firmado').length;
      const borr = analizados.filter((e) => (Store.informeDeEstudio(e.id) || {}).estado === 'borrador').length;
      const hall = {}; est.forEach((e) => e.hallazgos.forEach((h) => { hall[h] = (hall[h] || 0) + 1; }));
      cuerpo = avisoMuestra(st) + '<div class="grid kpis">' + kpi('scan', '', 'Estudios', total, AN().PERIODOS[periodo].toLowerCase()) + kpi('check', '', 'Concordancia IA–vet', st.total ? st.pct + '%' : '—', st.total + ' evaluados' + (st.ic ? ' · IC 95 % ' + pctTxt(st.ic[0]) + '–' + pctTxt(st.ic[1]) : '')) +
        kpi('alert', 'red', 'Falsos negativos', st.confusion.fn, 'en el período') + kpi('stetho', '', 'Derivaciones pendientes', s.derivaciones.filter((d) => d.estado === 'pendiente').length, '') + '</div>' +
        '<div class="grid halves"><div class="card"><div class="card-head"><h3>Resultados de la IA</h3></div><div class="card-pad" style="padding-top:8px">' + barras([['Patológico', cnt('patologico'), 'var(--red)'], ['Incierto', cnt('incierto'), 'var(--amber)'], ['Normal', cnt('normal'), 'var(--emerald)'], ['Sin análisis', est.filter((e) => !e.resultado).length, '#94A3B8']], total || 1) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Estado de informes</h3></div><div class="trio"><div><div class="n" style="color:var(--emerald)">' + firm + '</div><div class="l">Firmados</div></div><div><div class="n" style="color:#EA580C">' + borr + '</div><div class="l">En borrador</div></div><div><div class="n" style="color:#64748B">' + (analizados.length - firm - borr) + '</div><div class="l">Sin informe</div></div></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Hallazgos más frecuentes</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(hall).sort((a, b) => b[1] - a[1]).slice(0, 6)) + '</div></div>';
    }
    if (tab === 'turnos') {
      const cl = AN().turnos(s.turnos, r, now), pe = AN().turnos(s.pelTurnos || [], r, now);
      const ESTADO = Dominio.turnos.ESTADOS;
      const bloque = (t, titulo) => '<div class="card"><div class="card-head"><h3>' + titulo + '</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(t.porEstado).map(([k, n]) => [ESTADO[k] || k, n]), t.total) +
        '<div class="section-title">Por servicio</div>' + barras(t.porServicio.slice(0, 6)) + '</div></div>';
      cuerpo = '<div class="grid kpis">' + kpi('calendar', '', 'Turnos de la clínica', cl.total, AN().PERIODOS[periodo].toLowerCase()) + kpi('userx', 'amber', 'Ausentismo', cl.ausentismo + '%', 'no vino sobre turnos cerrados') + kpi('globe', '', 'Pedidos desde el portal', cl.desdePortal + '%', 'del total') +
        (Store.moduloHabilitado('peluqueria') ? kpi('scissors', 'violet', 'Turnos de peluquería', pe.total, 'ausentismo ' + pe.ausentismo + '%') : '') + '</div>' +
        '<div class="grid halves">' + bloque(cl, 'Clínica') + (Store.moduloHabilitado('peluqueria') ? bloque(pe, 'Peluquería') : '') + '</div>';
    }
    if (tab === 'ventas') {
      const v = AN().ventas(s.ventas, r);
      const CAT = { petshop: 'Pet shop', farmacia: 'Farmacia', servicios: 'Servicios' };
      cuerpo = '<div class="grid kpis">' + kpi('cart', '', 'Ventas', v.cantidad, AN().PERIODOS[periodo].toLowerCase()) + kpi('file', 'violet', 'Facturación neta', pesosA(v.total), 'IVA incluido, sin devoluciones') + kpi('chart', '', 'Ticket promedio', pesosA(v.ticket), '') + kpi('history', 'amber', 'Devoluciones', pesosA(v.devoluciones), '') + '</div>' +
        '<div class="grid halves"><div class="card"><div class="card-head"><h3>Por medio de pago</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(v.porMedio).sort((a, b) => b[1] - a[1]).map(([k, n]) => [Dominio.ventas.MEDIOS[k] || k, n]), v.total, pesosA) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Por rubro</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(v.porCatalogo).sort((a, b) => b[1] - a[1]).map(([k, n]) => [CAT[k] || k, n]), Object.values(v.porCatalogo).reduce((a, b) => a + b, 0), pesosA) + '</div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Más vendidos</h3></div><div class="card-pad" style="padding-top:8px">' + barras(v.top.map((x) => [x.nombre + ' · ' + x.unidades + ' u.', x.importe]), 0, pesosA) + '</div></div>';
    }
    if (tab === 'hemo') {
      const h = AN().hemocomponentes(s.hemo, r);
      const EST = { disponible: 'Disponible', reservada: 'Reservada', transfundida: 'Transfundida', vencida: 'Vencida', en_transito: 'En tránsito' };
      cuerpo = '<div class="grid kpis">' + kpi('drop', 'red', 'Transfusiones', h.transfusiones, AN().PERIODOS[periodo].toLowerCase()) + kpi('clock', 'amber', 'Unidades vencidas', h.vencidas, 'sin uso en el período') + kpi('chart', '', 'Descarte', h.descarte + '%', 'vencidas sobre usadas + vencidas') + kpi('drop', '', 'Disponibles hoy', h.porEstado.disponible || 0, 'en la red') + '</div>' +
        '<div class="grid halves"><div class="card"><div class="card-head"><h3>Unidades por estado (hoy)</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(h.porEstado).map(([k, n]) => [EST[k] || k, n]), s.hemo.length) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Disponibles por componente</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(h.disponiblesPorComp).sort((a, b) => b[1] - a[1])) + '</div></div></div>';
    }
    if (tab === 'aliados') {
      const sg = Dominio.aliados.seguimiento(s.aliadoRecomendaciones || [], s.aliados || [], r);
      const T = Dominio.aliados.TIPOS;
      cuerpo = '<div class="grid kpis">' + kpi('send', '', 'Recomendaciones enviadas', sg.enviadas, AN().PERIODOS[periodo].toLowerCase()) + kpi('check', '', 'Concretadas', sg.concretadas, sg.tasa + '% de las enviadas') + kpi('chart', 'amber', 'Valoración de los tutores', sg.valoracion == null ? '—' : String(sg.valoracion).replace('.', ',') + ' / 5', '') +
        kpi('users', '', 'Aliados verificados', (s.aliados || []).filter((a) => a.estado === 'verificado' && a.origen !== 'red').length, (s.aliados || []).filter((a) => a.estado === 'pendiente').length + ' pendientes') + '</div>' +
        '<div class="card"><div class="card-head"><h3>Por tipo de servicio</h3></div><div class="card-pad" style="padding-top:8px">' + barras(Object.entries(sg.porTipo).map(([k, x]) => [(T[k] || k) + ' · ' + x.concretadas + ' de ' + x.enviadas + ' concretadas', x.enviadas])) + '</div></div>';
    }
    const html = pageHead('chart', 'Analítica', 'Indicadores de la clínica por período. La concordancia de la IA se calcula igual que en Control de calidad.') +
      '<div class="toolbar"><div class="seg">' + Object.entries(AN().PERIODOS).map(([k, l]) => '<button data-per="' + k + '" class="' + (String(periodo) === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="tabs">' + TABS.map(([k, l]) => '<button data-an="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' + cuerpo;
    return {
      html, mount(root) {
        on(root, '[data-per]', 'click', (el) => { ui.anPeriodo = el.dataset.per; App.render(); });
        on(root, '[data-an]', 'click', (el) => { ui.anTab = el.dataset.an; App.render(); });
      },
    };
  }

  /* =========================================================== MODELO CNN */
  const evals = {}; // clave -> resultado de CNN.evaluar
  const evalEnCurso = {};
  const reent = { estado: 'idle', msg: '', prog: 0, historia: [], res: null, test: null, base: null };
  const pct = (v, d) => (v == null ? '—' : (v * 100).toFixed(d == null ? 0 : d) + '%');
  const num = (v) => (v == null ? '—' : v.toFixed(3).replace('.', ','));
  function rocSvg(r) {
    const y = r.porImagen.map(([id]) => (TEST_SET.find((t) => t.id === id).clase === 'patologica' ? 1 : 0));
    const p = r.porImagen.map(([, v]) => v);
    const P = y.filter(Boolean).length, N = y.length - P;
    const pts = [[0, 0]];
    const ord = p.map((v, i) => [v, y[i]]).sort((a, b) => b[0] - a[0]);
    let tp = 0, fp = 0;
    ord.forEach(([, yy]) => { if (yy) tp++; else fp++; pts.push([fp / N, tp / P]); });
    const W = 260, H = 220, M = 30;
    const X = (v) => M + v * (W - M - 10), Y = (v) => H - M + 10 - v * (H - M - 10);
    const op = r.m30, punto = [1 - op.especificidad, op.recall];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg" style="height:220px">' +
      '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(1) + '" stroke="#CBD5E1" stroke-dasharray="4 4"/>' +
      '<line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(0) + '" stroke="#94A3B8"/><line x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(0) + '" y2="' + Y(1) + '" stroke="#94A3B8"/>' +
      '<polyline fill="none" stroke="#2E8B22" stroke-width="2.5" points="' + pts.map(([a, b]) => X(a).toFixed(1) + ',' + Y(b).toFixed(1)).join(' ') + '"/>' +
      '<circle cx="' + X(punto[0]) + '" cy="' + Y(punto[1]) + '" r="5" fill="#F59E0B" stroke="#fff" stroke-width="1.5"/>' +
      '<text x="' + (X(punto[0]) + 8) + '" y="' + (Y(punto[1]) + 14) + '">umbral 0,30</text>' +
      '<text x="' + X(0.55) + '" y="' + Y(0.12) + '" style="font-weight:600;fill:#1F5F17">AUC ' + num(r.auc) + '</text>' +
      '<text x="' + X(0.3) + '" y="' + (H - 4) + '">falsos positivos (1 − especificidad)</text>' +
      '<text x="4" y="' + (Y(1) - 2) + '">recall</text></svg>';
  }
  function matriz(m, titulo) {
    return '<div><div class="small strong" style="margin-bottom:6px">' + titulo + '</div><table class="confusion" style="border:1px solid var(--line);border-radius:10px"><thead><tr><th style="text-align:left">Real ↓ / CNN →</th><th>OK</th><th>Patológica</th></tr></thead><tbody>' +
      '<tr><th style="text-align:left;text-transform:none;letter-spacing:0">OK</th><td class="diag">' + m.tn + '</td><td class="' + (m.fp ? 'off' : '') + '">' + m.fp + '</td></tr>' +
      '<tr><th style="text-align:left;text-transform:none;letter-spacing:0">Patológica</th><td class="' + (m.fn ? 'off' : '') + '">' + m.fn + '</td><td class="diag">' + m.tp + '</td></tr></tbody></table>' +
      '<div class="small muted" style="margin-top:6px">Exactitud ' + pct(m.accuracy) + ' · Precisión ' + pct(m.precision) + ' · Recall ' + pct(m.recall) + ' · Especificidad ' + pct(m.especificidad) + '</div></div>';
  }
  function modelo() {
    const act = CNN.activo, C = CNN.CATALOGO;
    const filas = Object.keys(C).map((k) => {
      const c = C[k], r = evals[k], mi = CNN.info(k);
      return '<tr><td><div class="strong">' + esc(c.nombre) + '</div><div class="small muted">' + (c.miembros ? 'promedio de ' + c.miembros.join(' + ') : esc(k) + '.keras') + '</div></td>' +
        '<td>' + (c.tp.auc != null ? num(c.tp.auc) : k === 'ensamble' ? '<span class="small muted">nuevo</span>' : '—') + '</td>' +
        '<td class="strong">' + (r ? num(r.auc) : evalEnCurso[k] ? '<span class="small muted" id="ev-' + k + '">evaluando…</span>' : '<span class="small muted">pendiente</span>') + '</td>' +
        '<td>' + (r ? pct(r.m50.accuracy) : '—') + '</td><td>' + (r ? pct(r.m30.recall) : '—') + '</td><td>' + (r ? pct(r.m30.precision) : '—') + '</td>' +
        '<td class="actions">' + (k === act ? '<span class="badge b-normal">En uso</span>' : Store.puedeAccion('cambiarModelo') ? '<button class="btn sm" data-usar="' + k + '">Usar</button>' : '') + '</td></tr>';
    }).join('');
    const r = evals[act], mi = CNN.info(act);
    const pasos = act === 'ensamble'
      ? ['Radiografía', 'Se generan 2 entradas: la imagen y su espejo horizontal (TTA)', 'Cada una pasa por los 2 MobileNetV2 (fine-tuning y fase 1): 4 predicciones', 'Promedio de las 4 probabilidades de “patológica”', 'Patológico desde 0,30; incierto entre 0,20 y 0,30', 'Grad-CAM calculado sobre el MobileNetV2 con fine-tuning']
      : act === 'cnn_desde_cero'
      ? ['Radiografía', 'RGB 224×224 · escala a [0, 1]', '5 × (Conv 3×3 + BatchNorm + MaxPool): 32 → 64 → 128 → 128 → 128 filtros', 'Pooling global promedio', 'Dense 256 + Dropout 0,5', 'Softmax: OK / Patológica']
      : ['Radiografía', 'RGB 224×224 · escala a [−1, 1] (preprocess_input de MobileNetV2)', 'MobileNetV2 (ImageNet): 17 bloques residuales invertidos con convoluciones depthwise', 'Última capa convolucional out_relu (7×7×1280) → Grad-CAM', 'Pooling global promedio + Dropout 0,3', 'Softmax: OK / Patológica → patológico desde 0,30; incierto entre 0,20 y 0,30'];
    const errores = r ? r.porImagen.filter(([id, v]) => (TEST_SET.find((t) => t.id === id).clase === 'patologica') !== (v >= CNN.UMBRAL_PATOLOGICO)).length : 0;
    const html = pageHead('brain', 'Modelo CNN', 'Redes neuronales convolucionales de clasificación de radiografías de tórax (OK / patológica), ejecutadas en el navegador con TensorFlow.js.') +
      '<div class="callout green" style="margin-bottom:20px">' + icon('info') + '<span>Alcance: <b>solo tórax de perro y gato</b>. Las métricas “en el navegador” se calculan acá mismo sobre <b>67 radiografías de prueba</b> que ningún modelo vio al entrenar. Modelo en uso: <b>' + esc(C[act].nombre) + '</b> · versión ' + esc(CNN.info(act).version) + '.</span></div>' +
      datosEntrenamiento() + auditoriaModelo() +
      '<div class="table-wrap" style="margin-bottom:20px"><table><thead><tr><th>Modelo</th><th>AUC de referencia</th><th>AUC en el navegador</th><th>Exactitud @0,5</th><th>Recall @0,30</th><th>Precisión @0,30</th><th class="actions"></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
      '<div class="grid halves">' +
      '<div class="card"><div class="card-head"><h3>' + esc(C[act].nombre) + '</h3>' + (mi.parametros ? '<span class="small muted">' + mi.parametros.toLocaleString('es-AR') + ' parámetros · ' + mi.capas + ' capas</span>' : '') + '</div><div class="card-pad" style="padding-top:6px"><p class="small muted" style="margin-top:0">' + esc(C[act].descripcion) + '</p><ul class="timeline">' + pasos.map((p) => '<li><div class="tt" style="font-weight:500">' + p + '</div></li>').join('') + '</ul>' +
      (mi.reentrenado ? '<div class="callout violet" style="margin-top:14px">' + icon('brain') + '<span>Capa final reentrenada en esta clínica el ' + fDate(mi.reentrenado.fecha) + ' con ' + mi.reentrenado.imagenes + ' radiografías.</span></div>' : '') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Curva ROC (test)</h3></div><div class="card-pad" style="padding-top:6px">' + (r ? rocSvg(r) : '<div class="analyzing"><div class="spinner"></div><span class="small">Evaluando sobre el conjunto de test…</span></div>') + '</div></div>' +
      '</div>' +
      (r ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Matrices de confusión (test, 67 imágenes)</h3></div><div class="card-pad" style="padding-top:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">' +
        matriz(r.m30, 'Umbral 0,30 (el que usa la app: desde acá, Patológico)') + matriz(r.m50, 'Umbral 0,50') + '</div></div>' +
        '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Predicciones sobre el test</h3><div class="seg"><button data-gal="todas" class="' + (ui.gal !== 'errores' ? 'on' : '') + '">Todas</button><button data-gal="errores" class="' + (ui.gal === 'errores' ? 'on' : '') + '">Errores (' + errores + ')</button></div></div><div class="card-pad" style="padding-top:6px"><div class="sample-grid">' +
        r.porImagen.filter(([id, v]) => ui.gal !== 'errores' || (TEST_SET.find((t) => t.id === id).clase === 'patologica') !== (v >= CNN.UMBRAL_PATOLOGICO)).map(([id, v]) => {
          const t = TEST_SET.find((x) => x.id === id), real = t.clase === 'patologica', ok = real === (v >= CNN.UMBRAL_PATOLOGICO);
          return '<div><img src="' + t.src + '" alt="" loading="lazy" style="width:100%;border-radius:8px;display:block;aspect-ratio:1;object-fit:cover"><div class="small" style="margin-top:4px">' + (ok ? '✅' : '❌') + ' <b>' + pct(v) + '</b> pat.<br><span class="muted">Real: ' + (real ? esc(t.dx || 'Patológica') : 'OK') + '</span></div></div>';
        }).join('') + '</div></div></div>' : '') +
      (C[act].reentrenable && Store.puedeAccion('cambiarModelo') ? reentrenoHtml(mi) : !Store.puedeAccion('cambiarModelo') ? '' : '<div class="callout violet">' + icon('info') + '<span>Para reentrenar con radiografías de la clínica, elegí uno de los modelos MobileNetV2 individuales.</span></div>');
    return {
      html, mount(root) {
        on(root, '[data-usar]', 'click', (el) => confirmModal('Cambiar el modelo activo', 'Los estudios nuevos se van a analizar con <b>' + esc(C[el.dataset.usar].nombre) + '</b>. Los estudios ya analizados conservan su resultado y la versión del modelo con que se analizaron; los informes firmados no cambian. El cambio queda registrado en la auditoría.', 'Cambiar', async () => {
          const de = { clave: CNN.activo, version: CNN.info().version };
          await CNN.usar(el.dataset.usar);
          A.auditar('cambio_modelo', { de, a: { clave: CNN.activo, version: CNN.info().version } });
          toast('Modelo en uso: ' + C[el.dataset.usar].nombre);
        }));
        const bd = root.querySelector('#btn-datos'); if (bd) bd.onclick = datosForm;
        on(root, '[data-gal]', 'click', (el) => { ui.gal = el.dataset.gal; App.render(); });
        bindReentreno(root);
        evaluarPendientes();
      },
    };
  }
  async function evaluarPendientes() {
    const orden = [CNN.activo].concat(Object.keys(CNN.CATALOGO).filter((k) => k !== CNN.activo));
    for (const k of orden) {
      if (evals[k] || evalEnCurso[k]) continue;
      evalEnCurso[k] = true;
      try {
        evals[k] = await CNN.evaluar(k, (n, t) => { const el = document.getElementById('ev-' + k); if (el) el.textContent = 'evaluando… ' + n + '/' + t; });
      } catch (e) { console.error(e); }
      delete evalEnCurso[k];
      if (location.hash.startsWith('#/modelo')) App.render();
    }
  }
  function reentrenoHtml(mi) {
    const e = reent;
    let estado = '';
    if (e.estado === 'running') estado = '<div class="small strong" id="re-msg">' + esc(e.msg) + '</div><div class="progress" style="margin:8px 0"><div id="re-bar" style="width:' + Math.round(e.prog * 100) + '%"></div></div>';
    if (e.estado === 'error') estado = '<div class="callout red">' + icon('alert') + '<span>' + esc(e.msg) + '</span></div>';
    if (e.estado === 'done') {
      const a = e.base, b = e.test, mejor = b.auc >= a.auc;
      estado = '<div class="callout ' + (mejor ? 'green' : 'amber') + '" style="margin-bottom:14px">' + icon(mejor ? 'check' : 'alert') + '<span>Capa final reentrenada con ' + e.res.meta.imagenes + ' radiografías (' + e.res.meta.ok + ' OK, ' + e.res.meta.patologica + ' patológicas). En el test: AUC <b>' + num(a.auc) + ' → ' + num(b.auc) + '</b>, recall @0,30 ' + pct(a.m30.recall) + ' → ' + pct(b.m30.recall) + ', precisión @0,30 ' + pct(a.m30.precision) + ' → ' + pct(b.m30.precision) + '.' + (mejor ? '' : ' El nuevo modelo rinde peor en el test: conviene descartarlo o sumar más imágenes.') + '</span></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="re-adopt">' + icon('check') + 'Usar el modelo reentrenado</button><button class="btn" id="re-discard">Descartar</button></div>';
    }
    return '<div class="card"><div class="card-head"><h3>Reentrenar con radiografías de la clínica</h3>' + (mi.reentrenado ? '<button class="btn sm" id="re-restore">' + icon('history') + 'Volver a la capa original</button>' : '') + '</div><div class="card-pad" style="padding-top:6px">' +
      '<p class="small muted" style="margin-top:0">Transfer learning: la base MobileNetV2 queda congelada y se reentrena solo la capa de clasificación con imágenes nuevas, ya diagnosticadas por un veterinario (con espejo horizontal y class_weight balanceado). El resultado se valida contra el mismo conjunto de test antes de adoptarlo.</p>' +
      '<div class="file-row"><label>Radiografías OK</label><input type="file" accept="image/*" multiple id="re-ok"' + (e.estado === 'running' ? ' disabled' : '') + '></div>' +
      '<div class="file-row"><label>Radiografías patológicas</label><input type="file" accept="image/*" multiple id="re-pat"' + (e.estado === 'running' ? ' disabled' : '') + '></div>' +
      '<div class="form-grid" style="max-width:260px;margin-top:10px"><div class="field"><label>Épocas</label><input type="number" id="re-ep" value="20" min="2" max="100"></div></div>' +
      '<button class="btn primary" id="re-go" style="margin:14px 0"' + (e.estado === 'running' ? ' disabled' : '') + '>' + icon('brain') + 'Reentrenar</button>' +
      '<div id="re-status">' + estado + '</div></div></div>';
  }
  function bindReentreno(root) {
    const go_ = root.querySelector('#re-go'); if (!go_) return;
    go_.onclick = async () => {
      const archivos = { ok: root.querySelector('#re-ok').files, patologica: root.querySelector('#re-pat').files };
      Object.assign(reent, { estado: 'running', msg: 'Preparando…', prog: 0, res: null });
      App.render();
      const pintar = () => { const m = document.getElementById('re-msg'), b = document.getElementById('re-bar'); if (m) { m.textContent = reent.msg; b.style.width = Math.round(reent.prog * 100) + '%'; } };
      try {
        const res = await CNN.reentrenar({ archivos, epochs: Math.max(2, +root.querySelector('#re-ep').value || 20),
          onStage: (msg, p) => { reent.msg = msg; reent.prog = p * 0.4; pintar(); },
          onEpoch: (ep, tot, logs) => { reent.msg = 'Época ' + ep + '/' + tot + ' · pérdida ' + logs.loss.toFixed(3) + ' · exactitud ' + Math.round(logs.acc * 100) + '%'; reent.prog = 0.4 + 0.4 * ep / tot; pintar(); } });
        reent.msg = 'Validando contra el conjunto de test…'; pintar();
        reent.base = evals[CNN.activo] || await CNN.evaluar(CNN.activo);
        reent.test = await CNN.evaluarCabeza(res.pesos, (n, t) => { reent.prog = 0.8 + 0.2 * n / t; pintar(); });
        Object.assign(reent, { estado: 'done', res });
      } catch (err) { console.error(err); Object.assign(reent, { estado: 'error', msg: err.message }); }
      App.render();
    };
    const a = root.querySelector('#re-adopt'); if (a) a.onclick = async () => { const de = { clave: CNN.activo, version: CNN.info().version }; await CNN.adoptarCabeza(reent.res); A.auditar('reentrenamiento', { de, a: { clave: CNN.activo, version: CNN.info().version }, imagenes: reent.res.meta.imagenes }); reent.estado = 'idle'; delete evals[CNN.activo]; toast('Modelo reentrenado en uso (los estudios anteriores no se reanalizan)'); };
    const d = root.querySelector('#re-discard'); if (d) d.onclick = () => { reent.estado = 'idle'; App.render(); };
    const rs = root.querySelector('#re-restore'); if (rs) rs.onclick = () => confirmModal('Volver a la capa original', 'Se descarta la capa reentrenada en la clínica. Los estudios anteriores no se reanalizan.', 'Restaurar', async () => { const de = { clave: CNN.activo, version: CNN.info().version }; await CNN.restaurarCabeza(); A.auditar('restaurar_modelo', { de, a: { clave: CNN.activo, version: CNN.info().version } }); delete evals[CNN.activo]; toast('Capa original restaurada'); });
  }
  /* Datos de entrenamiento: origen, fecha, alcance y autorización de uso (decisión confirmada 4). */
  function datosEntrenamiento() {
    const d = (S().config || {}).modeloDatos || {};
    const fila = (k, v) => '<dt>' + k + '</dt><dd>' + (v ? esc(v) : '<span class="muted">Pendiente de documentar</span>') + '</dd>';
    return '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Datos de entrenamiento</h3>' + (Store.puedeAccion('cambiarModelo') ? '<button class="btn sm" id="btn-datos">' + icon('edit') + 'Editar</button>' : '') + '</div><div class="card-pad" style="padding-top:6px"><dl class="dl">' +
      fila('Origen', d.origen) + fila('Fecha', d.fecha) + fila('Alcance', d.alcance) + fila('Imágenes', d.imagenes) + fila('Autorización de uso', d.autorizacion) + '</dl></div></div>';
  }
  function datosForm() {
    const d = (S().config || {}).modeloDatos || {};
    const campo = (k, l, ph) => '<div class="field full"><label>' + l + '</label><input name="' + k + '" value="' + esc(d[k] || '') + '" placeholder="' + (ph || '') + '"></div>';
    openModal({
      title: 'Datos de entrenamiento del modelo',
      body: '<div class="form-grid">' + campo('origen', 'Origen') + campo('fecha', 'Fecha', 'Ej.: septiembre de 2026') + campo('alcance', 'Alcance') + campo('imagenes', 'Imágenes') + campo('autorizacion', 'Autorización de uso', 'Referencia al documento firmado (se documenta fuera del sistema)') + '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="dt-ok">Guardar</button>',
      onMount(m) { m.querySelector('#dt-ok').onclick = () => { A.setConfig({ modeloDatos: formData(m) }); A.auditar('datos_entrenamiento', {}); closeModal(); toast('Datos de entrenamiento actualizados'); }; },
    });
  }
  /* Historial de cambios del modelo (auditoría). */
  function auditoriaModelo() {
    const TXT = { cambio_modelo: 'Cambio de modelo activo', reentrenamiento: 'Reentrenamiento de la capa final', restaurar_modelo: 'Restauración de la capa original', datos_entrenamiento: 'Edición de datos de entrenamiento' };
    const lista = (S().auditoria || []).filter((a) => TXT[a.accion]).slice().reverse();
    if (!lista.length) return '';
    return '<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Auditoría del modelo</h3></div><div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>De</th><th>A</th></tr></thead><tbody>' +
      lista.map((a) => '<tr><td class="nowrap">' + fShort(a.fecha) + '</td><td>' + esc(Store.nombreUsuario(a.usuario)) + '</td><td>' + TXT[a.accion] + '</td><td class="sp">' + esc(a.de ? a.de.version : '') + '</td><td class="sp">' + esc(a.a ? a.a.version : '') + '</td></tr>').join('') + '</tbody></table></div></div>';
  }

  Object.assign(window.Views, { interconsultas, interconsultaForm, simularSoporte, interconsultaDetalle, datasetRows: () => Dominio.calidad.anonimizar(Store.filasCalidad()), calidad, analitica, rocSvg, matriz, modelo, evaluarPendientes, reentrenoHtml, bindReentreno, datosEntrenamiento, auditoriaModelo });
})();

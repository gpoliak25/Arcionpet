/* Vistas · Diagnóstico con IA (imágenes, triage, informes, derivaciones). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const { S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;

  /* =========================================================== ESTUDIOS */
  function estudios() {
    const verBajas = ui.estBajas === true;
    const ctr = new Set(Store.contradicciones().flatMap((c) => c.estudios));
    const list = S().estudios.filter((e) => (verBajas ? e.activo === false : e.activo !== false)).slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((e) => {
      const p = Store.paciente(e.pacienteId) || {};
      return match(ui.qEst, p.nombre, e.tipo, e.motivo, e.resultado ? Store.RES_LABEL[e.resultado] : 'sin análisis');
    });
    const rows = list.map((e) => '<tr class="clickable" data-ver="' + e.id + '"><td class="strong nowrap">' + fDate(e.fecha) + '</td><td class="nowrap">' + pacLabel(Store.paciente(e.pacienteId)) + '</td><td>' + esc(e.tipo) + '</td><td><div class="truncate">' + esc(e.motivo) + '</div></td><td>' + resBadge(e.resultado) + (e.derivado ? ' <span class="small" style="color:var(--amber-d)">derivado</span>' : '') + (ctr.has(e.id) ? ' <span class="badge b-patologico" title="Otro estudio del mismo paciente y día tiene el resultado opuesto">' + icon('alert') + ' Contradictorio</span>' : '') + (e.activo === false ? ' <span class="badge b-gray">Dado de baja</span>' : '') + '</td><td>' + (e.probPatologia != null ? e.probPatologia + '%' : '—') + '</td>' +
      '<td class="actions"><button class="icon-btn" title="Ver">' + icon('eye') + '</button>' + (e.activo !== false && Store.puede('imagenes', 'editar') ? '<button class="icon-btn danger" data-del="' + e.id + '" title="Dar de baja">' + icon('trash') + '</button>' : '') + '</td></tr>').join('');
    const bajas = S().estudios.filter((e) => e.activo === false).length;
    const html = pageHead('scan', 'Imágenes', 'Radiografías evaluadas con redes neuronales convolucionales.', '<button class="btn primary" id="btn-nuevo">' + icon('plus') + 'Nuevo estudio</button>') +
      '<div class="toolbar">' + searchBox('q-est', 'Buscar por paciente, tipo, motivo o resultado…', ui.qEst) +
      '<div class="seg"><button data-bajas="0" class="' + (verBajas ? '' : 'on') + '">Activos</button><button data-bajas="1" class="' + (verBajas ? 'on' : '') + '">Dados de baja (' + bajas + ')</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Motivo</th><th>Resultado</th><th title="Probabilidad de la clase patológica según la red (no es la certeza del modelo)">Prob. de patología</th><th class="actions">Acciones</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">' + empty('search', 'Sin resultados', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-est', 'qEst', () => App.render(true));
        root.querySelector('#btn-nuevo').onclick = () => estudioForm();
        on(root, '[data-ver]', 'click', (el) => go('#/estudios/' + el.dataset.ver));
        on(root, '[data-bajas]', 'click', (el) => { ui.estBajas = el.dataset.bajas === '1'; App.render(); });
        on(root, '[data-del]', 'click', (el, e) => { e.stopPropagation(); bajaEstudio(el.dataset.del); });
      },
    };
  }
  /* Baja lógica del estudio (no se borra). Bloqueada con informe firmado o derivación. */
  function bajaEstudio(id) {
    const no = Dominio.seguridad.motivoNoBaja(id, S().informes, S().derivaciones);
    if (no) return toast(no + ': no se puede dar de baja', 'warn');
    openModal({
      title: 'Dar de baja el estudio',
      body: '<p class="muted" style="margin-top:0">El estudio no se borra: queda registrado como dado de baja, con el motivo y el usuario, y deja de aparecer en Imágenes, Triage y los indicadores.</p><div class="field"><label>Motivo *</label><input name="motivo" placeholder="Ej.: imagen equivocada, estudio duplicado"></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn danger" id="be-ok">Dar de baja</button>',
      onMount(m) {
        m.querySelector('#be-ok').onclick = () => {
          const f = formData(m);
          if (!f.motivo) return toast('Indicá el motivo', 'warn');
          try { A.bajaEstudio(id, f.motivo); closeModal(); toast('Estudio dado de baja'); } catch (err) { toast(err.message, 'warn'); }
        };
      },
    });
  }
  function estudioForm(pid) {
    let imagen = null, aspect = null, fuente = Store.demo ? 'test' : 'subir', ref = null;
    const usados = new Set(S().estudios.map((e) => e.imagenRef).filter(Boolean));
    const galeria = (window.TEST_SET || []).map((t) => '<button type="button" class="thumb' + (usados.has(t.id) ? ' used' : '') + '" data-ref="' + t.id + '" title="' + t.id + '"><img src="' + t.src + '" alt="" loading="lazy"></button>').join('');
    openModal({
      title: 'Nuevo estudio', wide: true,
      body: '<div class="grid halves" style="margin:0"><div class="form-grid" style="align-content:start">' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field"><label>Tipo</label><select name="tipo"><option>Tórax</option></select><div class="hint">Alcance del modelo: solo tórax de perro o gato.</div></div>' +
        '<div class="field"><label>Proyección</label><select name="proyeccion"><option>LL derecha</option><option>LL izquierda</option><option>VD</option><option>DV</option></select></div>' +
        '<div class="field full"><label>Motivo de consulta</label><textarea name="motivo" style="min-height:70px" placeholder="Ej.: Tos crónica y pérdida de peso"></textarea></div>' +
        '<div class="field full" id="f-alcance"></div>' +
        '<div class="field full"><label>Imagen seleccionada</label><img id="f-prev" class="preview" alt="" hidden><div id="f-prev-none" class="small muted">Elegí una radiografía a la derecha.</div></div>' +
        '</div><div>' +
        (Store.demo ? '<div class="tabs" style="margin-bottom:12px"><button type="button" data-src="test" class="on">Imágenes de validación</button><button type="button" data-src="subir">Subir radiografía</button></div>' +
        '<div id="src-test"><p class="small muted" style="margin-top:0">Radiografías de tórax que el modelo <b>no vio</b> al entrenar (modo demo). La etiqueta de referencia se muestra después del análisis.</p><div class="thumbs">' + galeria + '</div></div>' : '') +
        '<div id="src-subir"' + (Store.demo ? ' hidden' : '') + '><label class="drop">' + icon('upload') + '<div id="drop-t">Elegí una radiografía de tórax (JPG o PNG)</div><input type="file" accept="image/*" hidden id="f-img"></label></div>' +
        '</div></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="e-ok">' + icon('spark') + 'Cargar y analizar con la CNN</button>',
      onMount(m) {
        // alcance del modelo: advertir si la especie de la mascota no es perro ni gato
        const selPac = m.querySelector('[name=pacienteId]'), alc = m.querySelector('#f-alcance');
        const avisoAlcance = () => { const p = Store.paciente(selPac.value) || {}; const a = Dominio.seguridad.fueraDeAlcance('Tórax', p.especie); alc.innerHTML = a ? '<div class="callout amber">' + icon('alert') + '<span>' + esc(a) + '</span></div>' : ''; };
        selPac.addEventListener('change', avisoAlcance); avisoAlcance();
        const prev = m.querySelector('#f-prev'), none = m.querySelector('#f-prev-none');
        const mostrar = (src) => { prev.src = src; prev.hidden = !src; none.hidden = !!src; };
        m.querySelectorAll('[data-ref]').forEach((b) => b.onclick = () => {
          ref = b.dataset.ref; m.querySelectorAll('[data-ref]').forEach((x) => x.classList.toggle('on', x === b));
          mostrar(TEST_SET.find((t) => t.id === ref).src);
        });
        m.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => {
          fuente = b.dataset.src;
          m.querySelectorAll('[data-src]').forEach((x) => x.classList.toggle('on', x === b));
          m.querySelector('#src-test').hidden = fuente !== 'test'; m.querySelector('#src-subir').hidden = fuente !== 'subir';
          mostrar(fuente === 'test' ? (ref ? TEST_SET.find((t) => t.id === ref).src : '') : imagen);
        });
        m.querySelector('#f-img').onchange = (ev) => {
          const file = ev.target.files[0]; if (!file) return;
          const rd = new FileReader();
          rd.onload = () => { // reducimos para no exceder el almacenamiento local
            const img = new Image(); img.onload = () => {
              const c = document.createElement('canvas'), k = Math.min(1, 900 / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k;
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); imagen = c.toDataURL('image/jpeg', 0.88); aspect = (img.width / img.height).toFixed(4);
              m.querySelector('#drop-t').textContent = '✓ ' + file.name; mostrar(imagen);
            }; img.src = rd.result;
          };
          rd.readAsDataURL(file);
        };
        m.querySelector('#e-ok').onclick = () => {
          const f = formData(m);
          if (!f.pacienteId) return toast('Primero creá un paciente', 'warn');
          if (!f.motivo) return toast('Indicá el motivo de consulta', 'warn');
          if (fuente === 'test' && !ref) return toast('Elegí una radiografía', 'warn');
          if (fuente === 'subir' && !imagen) return toast('Elegí una imagen para subir', 'warn');
          const datos = { pacienteId: f.pacienteId, tipo: f.tipo, proyeccion: f.proyeccion, motivo: f.motivo, fecha: new Date().toISOString() };
          if (fuente === 'subir') Object.assign(datos, { imagen, imgAspect: aspect }); else datos.imagenRef = ref;
          let e;
          try { e = A.addEstudio(datos); } catch (err) { return toast('La imagen es demasiado grande para la demo', 'warn'); }
          ui.analizando[e.id] = Date.now();
          closeModal(); go('#/estudios/' + e.id);
        };
      },
    });
  }

  /* Corre la CNN sobre la imagen del estudio y guarda el resultado. */
  const enCurso = {};
  function analizarEstudio(id, minMs) {
    if (enCurso[id]) return enCurso[id];
    const t0 = Date.now();
    enCurso[id] = (async () => {
      try {
        const e = Store.estudio(id); if (!e) return null;
        const src = await UI.fuenteEstudio(e);
        const { probs, modelo } = await CNN.predict(src);
        const r = CNN.interpretar(probs);
        const espera = (minMs || 0) - (Date.now() - t0);
        if (espera > 0) await new Promise((res) => setTimeout(res, espera));
        const mi = CNN.info(modelo);
        r.probs = { ok: +probs.ok.toFixed(4), patologica: +probs.patologica.toFixed(4) };
        r.modelo = { clave: modelo, nombre: mi.catalogo.nombre, version: mi.version, reentrenado: !!mi.reentrenado };
        return A.aplicarAnalisis(id, r);
      } finally { delete enCurso[id]; delete ui.analizando[id]; }
    })();
    return enCurso[id];
  }
  function estudioDetalle(id) {
    const e = Store.estudio(id);
    if (!e) return { html: empty('scan', 'Estudio no encontrado', ''), mount() {} };
    const p = Store.paciente(e.pacienteId), inf = Store.informeDeEstudio(id), der = S().derivaciones.find((d) => d.estudioId === id);
    const congelado = !Dominio.seguridad.puedeReanalizar(id, S().informes);
    const analizando = !congelado && (!!ui.analizando[id] || !e.resultado);
    const ref = Store.demo ? UI.refTest(e) : null;
    const ctr = Dominio.seguridad.contradiccionDe(id, S().estudios);
    let panel;
    if (analizando) {
      panel = '<div class="card card-pad"><div class="analyzing"><div class="spinner"></div><strong style="color:var(--text)">La red neuronal convolucional está analizando la radiografía…</strong><span class="small">' + esc(CNN.CATALOGO[CNN.activo].nombre) + ' · entrada RGB 224×224</span></div></div>';
    } else {
      const col = { normal: 'var(--emerald)', incierto: 'var(--amber)', patologico: 'var(--red)' }[e.resultado];
      const pr = e.probs || null;
      let refHtml = '';
      if (ref) {
        const real = ref.clase === 'patologica', predPos = e.resultado !== 'normal';
        refHtml = '<div class="callout ' + (real === predPos ? 'green' : 'red') + '" style="margin-top:16px">' + icon(real === predPos ? 'check' : 'alert') + '<span><b>Etiqueta de referencia (imagen de validación):</b> ' + (real ? 'Patológica' + (ref.dx ? ' · ' + esc(ref.dx) : '') : 'OK (sin patología)') + '. ' +
          (real === predPos ? 'La CNN acertó.' : (real ? '<b>Falso negativo</b> de la CNN: por esto el veterinario revisa cada estudio.' : '<b>Falso positivo</b> de la CNN.')) + '</span></div>';
      }
      panel = '<div class="card card-pad">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="section-title" style="margin:0;flex:1">Resultado de la IA</div><span class="cnn-badge" title="Versión del modelo con que se analizó el estudio">' + icon('brain') + esc(e.modelo ? e.modelo.nombre : 'CNN') + (e.modelo && e.modelo.version ? ' · ' + esc(e.modelo.version) : '') + '</span></div>' +
        (congelado ? '<div class="callout green" style="margin-top:10px">' + icon('pen') + '<span>Informe firmado: el resultado y la versión del modelo quedaron congelados.</span></div>' : '') +
        (ctr ? '<div class="callout red" style="margin-top:10px;display:block">' + icon('alert') + ' <b>Estudios contradictorios del mismo día:</b> ' + ctr.estudios.filter((x) => x !== id).map((x) => { const o = Store.estudio(x); return '<a href="#/estudios/' + x + '">' + esc(Store.RES_LABEL[o.resultado]) + ' (' + o.probPatologia + '%) · ' + fTime(o.fecha) + '</a>'; }).join(', ') + '. Revisá ambos antes de informar.</div>' : '') +
        (e.fueraDeAlcance ? '<div class="callout amber" style="margin-top:10px">' + icon('alert') + '<span>' + esc(e.fueraDeAlcance) + '</span></div>' : '') +
        '<div class="conf-big" style="margin-top:8px"><span class="n" style="color:' + col + '">' + Store.RES_LABEL[e.resultado] + '</span></div>' +
        '<div style="margin:14px 0 6px;display:flex;justify-content:space-between" class="small"><span>Probabilidad de patología (salida softmax de la red)</span><span class="strong">' + e.probPatologia + '%</span></div>' +
        '<div class="progress" style="position:relative"><div style="width:' + e.probPatologia + '%;background:' + col + '"></div></div>' +
        '<div class="small muted" style="margin-top:6px">Normal &lt; ' + CNN.UMBRAL_INCIERTO * 100 + '% · Incierto ' + CNN.UMBRAL_INCIERTO * 100 + '–' + (CNN.UMBRAL_PATOLOGICO * 100 - 1) + '% · Patológico ≥ ' + CNN.UMBRAL_PATOLOGICO * 100 + '%. El umbral de ' + CNN.UMBRAL_PATOLOGICO * 100 + '% prioriza la sensibilidad: no dejar pasar patologías. Es la probabilidad de la clase patológica, no la certeza del modelo.' +
        (pr ? '<div class="section-title">Salida de la red por clase</div>' +
          [['ok', 'OK (sin patología)', 'var(--emerald)'], ['patologica', 'Patológica', 'var(--red)']].map(([k, l, c]) => '<div class="prob-row' + (pr[k] >= 0.5 ? ' top' : '') + '"><span>' + l + '</span><div class="progress"><div style="width:' + (pr[k] * 100).toFixed(1) + '%;background:' + c + '"></div></div><span class="pv">' + (pr[k] * 100).toFixed(1) + '%</span></div>').join('') : '') +
        refHtml +
        (e.resultado === 'incierto' && !der ? '<div class="callout amber" style="margin-top:16px">' + icon('alert') + '<span>Resultado incierto: se recomienda <b>derivar</b> a un especialista de la red para una segunda lectura.</span></div>' : '') +
        (der ? '<div class="callout ' + (der.estado === 'respondida' ? 'green' : 'violet') + '" style="margin-top:16px">' + icon('stetho') + '<span>' + (der.estado === 'respondida' ? '<b>Segunda lectura de ' + esc(der.a) + ':</b> ' + esc(der.respuesta) : 'Derivado a la red EISPLUS el ' + fDate(der.fecha) + ' · pendiente de respuesta.') + '</span></div>' : '') +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
        (inf ? '<button class="btn primary" data-go="#/informes/' + inf.id + '">' + icon('file') + (inf.estado === 'firmado' ? 'Ver informe firmado' : 'Revisar borrador') + '</button>' : '<button class="btn primary" id="btn-inf">' + icon('spark') + 'Generar borrador con IA</button>') +
        (!der ? '<button class="btn" id="btn-der">' + icon('stetho') + 'Derivar a especialista</button>' : '') +
        '<button class="btn" id="btn-ic">' + icon('headset') + 'Interconsulta</button>' +
        '</div>' +
        '<p class="small muted" style="margin:16px 0 0">' + icon('info') + ' Modelo entrenado con radiografías de tórax de perro y gato. Es una herramienta de apoyo' + (Store.puede('modelo') ? ': <a href="#/modelo">ver desempeño del modelo</a>' : '') + '.</p>' +
        '</div>';
    }
    const camDisp = !analizando && CNN.CATALOGO[(e.modelo && e.modelo.clave) || CNN.activo].camLayer;
    const html = '<a href="#/estudios" class="btn ghost sm" style="margin-bottom:12px">← Imágenes</a>' +
      pageHead('scan', esc(p.nombre) + ' · ' + esc(e.tipo), esc(p.especie + ' · ' + p.raza + ' · ' + Store.edad(p.nacimiento)) + ' · ' + fDate(e.fecha) + ' · ' + esc(e.motivo)) +
      '<div class="study-layout"><div>' + xrayHtml(e) +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">' +
      (camDisp ? '<button class="btn sm" id="btn-cam">' + icon('eye') + (ui.cam === id ? 'Ocultar' : 'Ver') + ' Grad-CAM</button>' : '') +
      (!analizando && !congelado && e.activo !== false ? '<button class="btn sm ghost" id="btn-re" title="Analiza de nuevo con el modelo activo">' + icon('history') + 'Volver a analizar</button>' : '') +
      '<span class="small muted" style="margin-left:auto">Proyección: ' + esc(e.proyeccion || '—') + (e.imagen ? ' · imagen subida' : ref ? ' · imagen de validación' : '') + '</span></div>' +
      '<div class="cam-legend" id="cam-legend" hidden><span>Menor</span><span class="grad"></span><span>Mayor peso hacia "patológica" · Grad-CAM promedio del ensamble, limitado al área del paciente (se excluyen fondo y bordes)</span></div>' +
      '</div><div>' + panel + '</div></div>';
    return {
      html, mount(root) {
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        if (analizando) {
          const pend = ui.analizando[id];
          analizarEstudio(id, pend ? 1300 - (Date.now() - pend) : 0)
            .then((r) => { if (r && pend && ui.avisado !== pend) { ui.avisado = pend; toast('CNN: ' + Store.RES_LABEL[r.resultado] + ' (' + r.probPatologia + '% probabilidad de patología)'); } })
            .catch((err) => { console.error(err); delete ui.analizando[id]; toast('No se pudo analizar la imagen: ' + err.message, 'warn'); });
          return;
        }
        const camBtn = root.querySelector('#btn-cam');
        if (camBtn) camBtn.onclick = () => { ui.cam = ui.cam === id ? null : id; App.render(); };
        if (ui.cam === id && camDisp) (async () => {
          const layer = root.querySelector('[data-cam]');
          const data = await CNN.cam(await UI.fuenteEstudio(e), 'patologica');
          if (!data || !document.body.contains(layer)) return;
          CNN.paintCam(layer, data); layer.hidden = false; root.querySelector('#cam-legend').hidden = false;
        })();
        const bre = root.querySelector('#btn-re'); if (bre) bre.onclick = () => { ui.analizando[id] = Date.now(); App.render(); };
        const bi = root.querySelector('#btn-inf'); if (bi) bi.onclick = () => { const i = A.generarInforme(id); toast('Borrador generado con IA'); go('#/informes/' + i.id); };
        const bd = root.querySelector('#btn-der'); if (bd) bd.onclick = () => derivarForm(id);
        root.querySelector('#btn-ic').onclick = () => Views.interconsultaForm(e.pacienteId, Store.paciente(e.pacienteId).nombre + ': ' + (e.hallazgos[0] || e.motivo));
      },
    };
  }
  function derivarForm(eid) {
    const e = Store.estudio(eid);
    openModal({
      title: 'Derivar a especialista',
      body: '<p class="muted" style="margin-top:0">El estudio se envía a un especialista de la red EISPLUS para una segunda lectura.</p><div class="field"><label>Motivo de la derivación</label><textarea name="motivo">Resultado ' + esc(Store.RES_LABEL[e.resultado].toLowerCase()) + ': ' + esc(e.hallazgos.join(', ') || e.motivo) + '. Solicito segunda lectura.</textarea></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="d-ok">' + icon('send') + 'Derivar</button>',
      onMount(m) { m.querySelector('#d-ok').onclick = () => { A.derivar(eid, formData(m).motivo); closeModal(); toast('Estudio derivado a la red EISPLUS'); }; },
    });
  }

  /* =========================================================== TRIAGE */
  function triage() {
    const all = Store.triage();
    const urg = all.filter((r) => r.prioridad === 'urgente').length;
    const rows = all.filter((r) => ui.triage === 'todos' || r.prioridad === ui.triage);
    const html = pageHead('triage', 'Triage', 'Estudios que requieren atención, priorizados. · ' + urg + ' urgente' + (urg === 1 ? '' : 's') + '.', '<div class="seg">' + [['todos', 'Todos'], ['urgente', 'Urgentes'], ['revisar', 'A revisar']].map(([k, l]) => '<button data-f="' + k + '" class="' + (ui.triage === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>', 'amber') +
      '<div class="table-wrap"><table><thead><tr><th>Prioridad</th><th>Paciente</th><th>Resultado IA</th><th>Informe</th><th>Estudio</th><th>Espera</th><th>Asignado a</th></tr></thead><tbody>' +
      (rows.map((r) => '<tr class="clickable" data-go="#/estudios/' + r.e.id + '"><td>' + (r.prioridad === 'urgente' ? '<span class="badge b-solid-red">Urgente</span>' : '<span class="badge b-solid-orange">A revisar</span>') + '</td><td>' + pacLabel(Store.paciente(r.e.pacienteId)) + '</td><td>' + resBadge(r.e.resultado, true) + (r.e.derivado ? ' <span class="small" style="color:var(--amber-d)">derivado</span>' : '') + '</td><td class="muted">' + (r.inf ? 'Borrador' : 'Sin informe') + '</td><td class="muted">' + esc(r.e.tipo) + ' · ' + fDate(r.e.fecha) + '</td><td class="strong nowrap" style="color:' + (r.espera >= 3 ? '#EA580C' : 'var(--text)') + '">' + (r.espera === 0 ? 'hoy' : r.espera + ' d') + VC.demoraBadge('triage', r.e.id) + '</td><td>' + VC.asignadoSelect('estudios', r.e.id, r.e.asignadoA) + '</td></tr>').join('') ||
        '<tr><td colspan="7">' + empty('check', 'Nada para priorizar', '<span class="small">Todos los estudios tienen su informe firmado.</span>') + '</td></tr>') +
      '</tbody></table></div><p class="small muted" style="margin-top:12px">' + icon('info') + ' Urgente: resultado patológico o incierto. A revisar: resultado normal sin informe firmado. Dentro de cada grupo se ordena por resultado y días de espera. SLA de urgentes: ' + ((S().config || {}).sla || {}).triage + ' h.</p>';
    return { html, mount(root) { VC.bindAsignados(root); on(root, '[data-go]', 'click', (el) => go(el.dataset.go)); on(root, '[data-f]', 'click', (el) => { ui.triage = el.dataset.f; App.render(); }); } };
  }

  /* =========================================================== INFORMES */
  function informes() {
    const list = S().informes.filter((i) => i.estado !== 'descartado').slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).filter((i) => {
      const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId);
      return match(ui.qInf, p.nombre, i.estado, i.firmadoPor || '', i.estado === 'firmado' ? 'firmado' : 'borrador');
    });
    const rows = list.map((i) => {
      const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId);
      return '<tr class="clickable" data-go="#/informes/' + i.id + '"><td class="strong">' + fDate(i.fecha) + '</td><td>' + esc(p.nombre) + '</td><td class="muted">' + esc(e.tipo) + ' · ' + fDate(e.fecha) + '</td><td>' + (i.estado === 'firmado' ? '<span class="badge b-normal">Firmado</span>' : '<span class="badge b-incierto">Borrador</span>') + '</td><td>' + ((i.iaFirmada || e).probPatologia != null ? (i.iaFirmada || e).probPatologia + '%' : '—') + '</td><td>' + (i.firmadoPor ? esc(i.firmadoPor) : '—') + '</td>' +
        '<td class="actions"><button class="icon-btn" title="Ver">' + icon('eye') + '</button>' + (i.estado === 'borrador' ? '<button class="icon-btn danger" data-del="' + i.id + '" title="Descartar borrador">' + icon('trash') + '</button>' : '') + '</td></tr>';
    }).join('');
    const html = pageHead('file', 'Informes', 'Borradores y firmados.', '<button class="btn primary" id="btn-gen">' + icon('spark') + 'Generar informe</button>') +
      '<div class="toolbar">' + searchBox('q-inf', 'Buscar por paciente, estado o firmante…', ui.qInf) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Paciente</th><th>Estudio</th><th>Estado</th><th title="Probabilidad de la clase patológica según la red">Prob. de patología</th><th>Firmado por</th><th class="actions">Acciones</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7">' + empty('file', 'Sin informes', '') + '</td></tr>') + '</tbody></table></div>';
    return {
      html, mount(root) {
        bindSearch(root, 'q-inf', 'qInf', () => App.render(true));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        on(root, '[data-del]', 'click', (el, ev) => { ev.stopPropagation(); confirmModal('Descartar borrador', '¿Descartar este borrador? Queda registrado como descartado y podés volver a generarlo desde el estudio.', 'Descartar', () => { A.descartarInforme(el.dataset.del); toast('Borrador descartado'); }); });
        root.querySelector('#btn-gen').onclick = () => {
          const sin = S().estudios.filter((e) => e.resultado && !Store.informeDeEstudio(e.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
          if (!sin.length) return toast('Todos los estudios analizados ya tienen informe', 'warn');
          openModal({
            title: 'Generar informe con IA',
            body: '<div class="field"><label>Estudio</label><select name="eid">' + sin.map((e) => { const p = Store.paciente(e.pacienteId); return '<option value="' + e.id + '">' + esc(p.nombre) + ' · ' + esc(e.tipo) + ' · ' + fDate(e.fecha) + ' · ' + Store.RES_LABEL[e.resultado] + '</option>'; }).join('') + '</select></div>',
            foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="g-ok">' + icon('spark') + 'Generar borrador</button>',
            onMount(m) { m.querySelector('#g-ok').onclick = () => { const i = A.generarInforme(formData(m).eid); closeModal(); toast('Borrador generado con IA'); go('#/informes/' + i.id); }; },
          });
        };
      },
    };
  }
  /* Hoja de informe firmado: mismo diseño en pantalla y al imprimir (una página A4). */
  function cuerpoInforme(texto) {
    const out = [];
    let parrafo = [];
    const cerrar = () => { if (parrafo.length) { out.push('<p>' + esc(parrafo.join(' ')) + '</p>'); parrafo = []; } };
    texto.split(/\r?\n/).forEach((linea, i) => {
      const l = linea.trim();
      if (!l) { cerrar(); return; }
      if (i === 0 && /^INFORME\b/i.test(l)) return; // el título ya está en el encabezado
      if (/^(Paciente|Motivo de consulta|Resultado IA):/i.test(l)) return; // se muestran en la ficha y en el recuadro de IA
      if (l.length >= 4 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[.:;]$/.test(l)) { cerrar(); out.push('<h3>' + esc(l.charAt(0) + l.slice(1).toLowerCase()) + '</h3>'); return; }
      parrafo.push(l);
    });
    cerrar();
    return out.join('');
  }
  function hojaInforme(inf, e, p) {
    const t = Store.tutor(p.tutorId) || {};
    const ev = S().evaluaciones.find((q) => q.estudioId === e.id);
    const VER = { coincide: 'Coincide con la IA', corrige: 'Corrige el resultado de la IA', descarta: 'Descarta el resultado de la IA' };
    const ia = inf.iaFirmada || e; // el informe firmado muestra el resultado congelado al firmar
    const col = { normal: '#059669', incierto: '#D97706', patologico: '#DC2626' }[ia.resultado] || '#64748B';
    const dato = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
    return '<article class="report-sheet">' +
      '<header class="rs-head"><div class="rs-brand"><img class="rs-logo" src="assets/logo-icono.png" alt=""><div><img class="rs-wordmark" src="assets/logo-texto.png" alt="ArcionPet"><span>Veterinaria · red EISPLUS</span></div></div>' +
      '<div class="rs-title"><h2>Informe radiológico</h2><span>N.º ' + esc(inf.id.toUpperCase()) + ' · ' + fDate(inf.fechaFirma || inf.fecha) + '</span></div></header>' +
      '<dl class="rs-ficha">' +
      dato('Paciente', '<b>' + esc(p.nombre) + '</b>') + dato('Especie / raza', esc(p.especie + ' · ' + p.raza)) + dato('Edad / sexo', esc(Store.edad(p.nacimiento) + ' · ' + p.sexo) + (p.peso ? ' · ' + p.peso + ' kg' : '')) + dato('Tutor', esc((t.nombre || '') + ' ' + (t.apellido || ''))) +
      dato('Estudio', esc(e.tipo + (e.proyeccion ? ' · ' + e.proyeccion : ''))) + dato('Fecha del estudio', fDate(e.fecha)) + dato('Motivo de consulta', esc(e.motivo)) +
      '</dl>' +
      '<section class="rs-media"><figure><img src="' + UI.srcEstudio(e) + '" alt="Radiografía"><figcaption>' + esc(e.tipo + (e.proyeccion ? ' · ' + e.proyeccion : '') + ' · ' + fDate(e.fecha)) + '</figcaption></figure>' +
      '<aside class="rs-ia"><div class="rs-ia-k">Análisis asistido por IA</div>' +
      '<div class="rs-ia-res" style="color:' + col + '">' + (Store.RES_LABEL[ia.resultado] || '—') + '</div>' +
      '<div class="rs-ia-bar"><div style="width:' + (ia.probPatologia || 0) + '%;background:' + col + '"></div></div>' +
      '<div class="rs-ia-p">' + (ia.probPatologia != null ? ia.probPatologia + '% probabilidad de patología' : '') + '</div>' +
      (ia.modelo ? '<div class="rs-ia-m">' + esc(ia.modelo.nombre) + (ia.modelo.version ? ' · versión ' + esc(ia.modelo.version) : '') + '</div>' : '') +
      (ev ? '<div class="rs-ia-v"><b>Veredicto profesional:</b> ' + VER[ev.veredicto] + (ev.correccion ? ' — ' + esc(ev.correccion) : '') + '</div>' : '') +
      '<p class="rs-ia-n">Resultado orientativo. El diagnóstico es el que firma el médico veterinario.</p></aside></section>' +
      '<section class="rs-body">' + cuerpoInforme(inf.texto || '') + '</section>' +
      '<footer class="rs-foot"><div class="rs-firma"><div class="rs-firma-line"></div><b>' + esc(inf.firmadoPor) + '</b><span>Médico/a veterinario/a' + (inf.matricula ? ' · ' + esc(inf.matricula) : '') + '</span><span class="rs-firma-d">' + icon('pen') + ' Firmado digitalmente el ' + fDate(inf.fechaFirma) + ' a las ' + fTime(inf.fechaFirma) + '</span></div>' +
      '<p class="rs-legal">Informe emitido con ArcionPet. La herramienta de IA es de apoyo al diagnóstico y no sustituye el criterio del médico veterinario.</p></footer>' +
      '</article>';
  }
  function informeDetalle(id) {
    const inf = S().informes.find((i) => i.id === id);
    if (!inf) return { html: empty('file', 'Informe no encontrado', ''), mount() {} };
    const e = Store.estudio(inf.estudioId), p = Store.paciente(e.pacienteId);
    const texto = inf.texto || Store.borradorInforme(e);
    const firmado = inf.estado === 'firmado';
    if (firmado) return {
      html: '<a href="#/informes" class="btn ghost sm" style="margin-bottom:12px">← Informes</a>' +
        pageHead('file', 'Informe de ' + esc(p.nombre), esc(e.tipo) + ' · ' + fDate(e.fecha) + ' · Firmado',
          '<button class="btn" id="btn-dl">' + icon('download') + 'Descargar texto</button><button class="btn primary" id="btn-print">' + icon('file') + 'Imprimir / guardar PDF</button>') +
        hojaInforme(inf, e, p),
      mount(root) {
        root.querySelector('#btn-dl').onclick = () => download('informe-' + p.nombre.toLowerCase() + '-' + fDate(e.fecha).replace(/\//g, '-') + '.txt', inf.texto + '\n\nFirmado por ' + inf.firmadoPor + ' · ' + fDate(inf.fechaFirma), 'text/plain');
        root.querySelector('#btn-print').onclick = () => {
          const prev = document.title; // el título se usa como nombre sugerido del PDF
          document.title = 'Informe ' + p.nombre + ' ' + fDate(e.fecha).replace(/\//g, '-');
          window.print();
          setTimeout(() => { document.title = prev; }, 500);
        };
      },
    };
    const html = '<a href="#/informes" class="btn ghost sm" style="margin-bottom:12px">← Informes</a>' +
      pageHead('file', 'Informe de ' + esc(p.nombre), esc(e.tipo) + ' · ' + fDate(e.fecha) + ' · Borrador generado con IA · probabilidad de patología ' + e.probPatologia + '%') +
      '<div class="study-layout"><div>' + xrayHtml(e) + '<div style="margin-top:12px;display:flex;gap:10px;align-items:center">' + resBadge(e.resultado) + '<span class="small muted">' + e.probPatologia + '% probabilidad de patología</span><a class="small" href="#/estudios/' + e.id + '" style="margin-left:auto">Ver estudio →</a></div></div>' +
      '<div class="card card-pad">' +
      ('<div class="callout amber" style="margin-bottom:14px">' + icon('alert') + '<span>Borrador generado por IA. Sigue en borrador hasta que lo revises y lo firmes.</span></div>' +
          '<div class="field"><label>Texto del informe' + (Store.puede('informes', 'editar') ? ' (editable)' : ' (solo lectura con tu rol)') + '</label><textarea id="inf-txt"' + (Store.puede('informes', 'editar') ? '' : ' readonly') + ' style="min-height:380px;font-size:14px;line-height:1.55">' + esc(texto) + '</textarea></div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">' + (Store.puede('informes', 'editar') ? '<button class="btn" id="btn-save">Guardar borrador</button><button class="btn" id="btn-regen">' + icon('spark') + 'Regenerar</button>' : '') + (Store.puedeAccion('firmarInforme') ? '<button class="btn primary" id="btn-sign" style="margin-left:auto">' + icon('pen') + 'Revisar y firmar</button>' : '<span class="small muted" style="margin-left:auto;align-self:center">' + icon('pen') + ' Solo un veterinario puede firmar el informe</span>') + '</div>') +
      '</div></div>';
    return {
      html, mount(root) {
        mountXrays(root);
        const ta = root.querySelector('#inf-txt');
        if (root.querySelector('#btn-save')) root.querySelector('#btn-save').onclick = () => { A.guardarTexto(id, ta.value); toast('Borrador guardado'); };
        if (root.querySelector('#btn-regen')) root.querySelector('#btn-regen').onclick = () => confirmModal('Regenerar borrador', 'Se reemplazará el texto actual por un nuevo borrador de la IA.', 'Regenerar', () => { A.generarInforme(e.id); toast('Borrador regenerado'); });
        const bs = root.querySelector('#btn-sign'); if (bs) bs.onclick = () => firmaModal(id, ta.value, e);
      },
    };
  }
  function firmaModal(iid, texto, e) {
    openModal({
      title: 'Firmar informe',
      body: '<p class="muted" style="margin-top:0">Tu veredicto alimenta el <b>control de calidad</b> de la IA y el dataset de reentrenamiento.</p>' +
        '<div class="field"><label>La IA clasificó el estudio como <b>' + Store.RES_LABEL[e.resultado] + '</b>. Tu veredicto:</label>' +
        '<select name="veredicto" id="f-ver"><option value="coincide">Coincido con la IA</option><option value="corrige">Corrijo el resultado</option><option value="descarta">Descarto el resultado de la IA</option></select></div>' +
        '<div class="field" id="f-cor" style="margin-top:12px;display:none"><label>Diagnóstico / corrección</label><input name="correccion" placeholder="Ej.: Patrón intersticial"></div>' +
        '<label style="display:flex;gap:8px;margin-top:16px;align-items:flex-start"><input type="checkbox" name="ok" style="margin-top:4px"><span>Revisé el estudio y el contenido del informe, y lo firmo bajo mi responsabilidad profesional.</span></label>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="s-ok">' + icon('pen') + 'Firmar como ' + esc(Store.usuario().nombre) + '</button>',
      onMount(m) {
        const v = m.querySelector('#f-ver'); v.onchange = () => { m.querySelector('#f-cor').style.display = v.value === 'coincide' ? 'none' : ''; };
        m.querySelector('#s-ok').onclick = () => {
          const f = formData(m);
          if (!f.ok) return toast('Confirmá que revisaste el informe', 'warn');
          if (f.veredicto !== 'coincide' && !f.correccion) return toast('Indicá la corrección', 'warn');
          A.firmarInforme(iid, { texto, veredicto: f.veredicto, correccion: f.veredicto === 'coincide' ? null : f.correccion });
          closeModal(); toast('Informe firmado. Se registró en control de calidad.');
        };
      },
    });
  }

  /* =========================================================== DERIVACIONES */
  function derivaciones() {
    const list = S().derivaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const pend = list.filter((d) => d.estado === 'pendiente').length;
    const html = pageHead('stetho', 'Derivaciones', 'Estudios escalados a un especialista para segunda opinión. · ' + pend + ' sin responder.') +
      (list.length ? list.map((d) => {
        const e = Store.estudio(d.estudioId), p = Store.paciente(e.pacienteId);
        return '<div class="card card-pad" style="margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:260px">' +
          '<div><span class="strong">' + esc(p.nombre) + '</span> <span class="sp">(' + esc(p.especie) + ') · ' + esc(e.tipo) + ' · ' + fDate(e.fecha) + '</span></div>' +
          '<div class="muted" style="margin:4px 0">' + esc(d.motivo) + '</div>' +
          '<div class="small muted">De ' + esc(d.de) + ' → ' + (d.a ? esc(d.a) : 'especialista sin asignar') + ' · ' + fDate(d.fecha) + '</div>' +
          (d.estado === 'pendiente' ? '<div class="small" style="margin-top:6px;display:flex;gap:8px;align-items:center">Seguimiento: ' + VC.asignadoSelect('derivaciones', d.id, d.asignadoA) + VC.demoraBadge('derivaciones', d.id) + '</div>' : '') +
          (d.respuesta ? '<div class="callout green" style="margin-top:10px">' + icon('stetho') + '<span><b>Respuesta:</b> ' + esc(d.respuesta) + '</span></div>' : '') +
          '</div><div style="display:flex;gap:8px;align-items:center">' + (d.estado === 'pendiente' ? '<span class="badge b-incierto">Pendiente</span>' + (Store.demo ? '<button class="btn sm" data-sim="' + d.id + '" title="Solo en modo demo">Simular respuesta</button>' : '') : '<span class="badge b-normal">Respondida</span>') +
          '<button class="icon-btn" data-go="#/estudios/' + e.id + '" title="Abrir estudio">' + icon('arrowUp') + '</button></div></div>';
      }).join('') : '<div class="card">' + empty('stetho', 'Sin derivaciones', '<span class="small">Derivá un estudio incierto desde su detalle.</span>') + '</div>');
    return {
      html, mount(root) {
        VC.bindAsignados(root);
        list.filter((d) => d.estado === 'respondida').forEach((d) => A.verDerivacion(d.id));
        on(root, '[data-go]', 'click', (el) => go(el.dataset.go));
        on(root, '[data-sim]', 'click', (el) => {
          const d = S().derivaciones.find((x) => x.id === el.dataset.sim), e = Store.estudio(d.estudioId);
          const resp = /intersticial|dudoso|craneal/i.test(d.motivo + e.motivo)
            ? 'Revisadas ambas proyecciones: compatible con patrón intersticial crónico, sin evidencia de masa. Sugiero control radiográfico en 30 días.'
            : 'Coincido con la lectura inicial. Recomiendo completar con ecografía y control clínico en 15 días.';
          A.responderDerivacion(d.id, 'Dr. Martín Acosta · Diagnóstico por imágenes', resp); toast('El especialista respondió la derivación');
        });
      },
    };
  }

  Object.assign(window.Views, { estudios, bajaEstudio, estudioForm, analizarEstudio, estudioDetalle, derivarForm, triage, informes, cuerpoInforme, hojaInforme, informeDetalle, firmaModal, derivaciones });
})();

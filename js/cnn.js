/* Modelos CNN del TP de Aprendizaje Automático, convertidos de Keras a TensorFlow.js.
   Clasificación binaria de radiografías de tórax: ok / patologica (salida softmax de 2 clases).
   - transfer_mobilenetv2: MobileNetV2 (ImageNet) + fine-tuning desde la capa 140. Mejor AUC del TP.
   - transfer_fase1: MobileNetV2 con la base congelada (solo se entrenó la cabeza).
   - cnn_desde_cero: 5 bloques Conv+BN+Pool entrenados desde cero.
   Preprocesamiento idéntico a los notebooks: RGB 224×224; MobileNetV2 escala a [-1, 1], la CNN a [0, 1]. */
(function () {
  const SIZE = 224;
  const CATALOGO = {
    ensamble: {
      nombre: 'Ensamble MobileNetV2 (fine-tuning + fase 1) con TTA', miembros: ['transfer_mobilenetv2', 'transfer_fase1'], camLayer: 'out_relu', reentrenable: false,
      tp: {},
      descripcion: 'Promedia la salida de los dos MobileNetV2 del TP, cada uno sobre la radiografía y su espejo horizontal (test-time augmentation). Elegido por validación: en el test detecta 27 de 30 patológicas con el umbral 0,30, contra 24 del modelo original.',
    },
    transfer_mobilenetv2: {
      nombre: 'MobileNetV2 · transfer learning + fine-tuning', archivo: 'js/model/transfer_mobilenetv2.js', camLayer: 'out_relu', reentrenable: true,
      tp: { auc: 0.747, accuracy: 0.701, precision: 0.75, recall: 0.5, umbralAjustado: { umbral: 0.3, accuracy: 0.672, precision: 0.6, recall: 0.8 } },
      descripcion: 'Base MobileNetV2 preentrenada en ImageNet; cabeza GAP → Dropout(0.3) → Dense(2). Fase 1 con la base congelada y fase 2 con fine-tuning desde la capa 140 (Adam 1e-5).',
    },
    transfer_fase1: {
      nombre: 'MobileNetV2 · solo fase 1 (base congelada)', archivo: 'js/model/transfer_fase1.js', camLayer: 'out_relu', reentrenable: true,
      tp: { accuracy: 0.672, valAccuracy: 0.742 },
      descripcion: 'Misma arquitectura, entrenando solo la cabeza de clasificación (2.562 parámetros entrenables).',
    },
    cnn_desde_cero: {
      nombre: 'CNN desde cero', archivo: 'js/model/cnn_desde_cero.js', camLayer: null, reentrenable: false,
      tp: { auc: 0.446, accuracy: 0.448, precision: 0.448, recall: 1.0 },
      descripcion: '5 bloques Conv2D + BatchNorm + MaxPool (32-64-128-128-128) → GAP → Dense(256) → Dropout(0.5) → Dense(2). Con 308 imágenes de entrenamiento no logra generalizar.',
    },
  };
  /* Umbrales sobre P(patológica). 0.30 es el punto de operación que eligió el TP (recall 0.80 en test):
     desde ahí el estudio se considera patológico. La franja 0.20–0.30 queda como "incierto" (cerca del umbral). */
  const UMBRAL_INCIERTO = 0.20, UMBRAL_PATOLOGICO = 0.30;
  const ACTIVO_KEY = 'arcionpet-cnn-activo-v2', CABEZA_KEY = 'arcionpet-cnn-cabeza', EVAL_KEY = 'arcionpet-cnn-eval-v2';

  const cargados = {}; // clave -> { model, camModel, featModel }
  let activo = lsGet(ACTIVO_KEY) || 'ensamble';
  if (!CATALOGO[activo]) activo = 'ensamble';
  let backendListo = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin storage */ } }

  function backend() {
    if (!backendListo) backendListo = (async () => {
      for (const b of ['webgl', 'cpu']) { try { if (await tf.setBackend(b)) { await tf.ready(); return b; } } catch (e) { /* siguiente */ } }
      return tf.getBackend();
    })();
    return backendListo;
  }
  function cargarScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  }
  function b64ToBuf(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

  async function cargar(clave) {
    if (cargados[clave]) return cargados[clave];
    await backend();
    if (CATALOGO[clave].miembros) {
      const miembros = [];
      for (const k of CATALOGO[clave].miembros) miembros.push(await cargar(k));
      cargados[clave] = { clave, ensamble: true, miembros, meta: miembros[0].meta, model: miembros[0].model, camModel: miembros[0].camModel };
      return cargados[clave];
    }
    if (!(window.CNN_MODELOS && window.CNN_MODELOS[clave])) await cargarScript(CATALOGO[clave].archivo);
    const P = window.CNN_MODELOS[clave];
    const model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: P.modelTopology, weightSpecs: P.weightSpecs, weightData: b64ToBuf(P.weightData) }));
    const c = CATALOGO[clave];
    const ent = { model, meta: P.meta, clave };
    if (c.camLayer) {
      ent.camModel = tf.model({ inputs: model.inputs, outputs: model.getLayer(c.camLayer).output });
      ent.featModel = tf.model({ inputs: model.inputs, outputs: model.getLayer('global_average_pooling2d').output });
      ent.cabezaOriginal = model.getLayer('dense').getWeights().map((w) => w.clone());
      if (clave === activo) aplicarCabezaGuardada(ent);
    }
    // calentamiento: la primera inferencia compila los shaders
    tf.tidy(() => model.predict(tf.zeros([1, SIZE, SIZE, 3])));
    cargados[clave] = ent;
    return ent;
  }
  function aplicarCabezaGuardada(ent) {
    const raw = lsGet(CABEZA_KEY + ':' + ent.clave);
    if (!raw) return;
    try {
      const h = JSON.parse(raw);
      ent.model.getLayer('dense').setWeights([tf.tensor(h.kernel, [h.kernel.length / 2, 2]), tf.tensor(h.bias, [2])]);
      ent.reentrenado = h.meta;
    } catch (e) { console.error(e); }
  }
  const ensure = () => cargar(activo).then(() => true, (e) => { console.error(e); return false; });

  /* ---------- Preprocesamiento (igual que image_dataset_from_directory: redimensiona a 224×224 sin conservar proporción) ---------- */
  const work = document.createElement('canvas');
  work.width = work.height = SIZE;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  function entrada(source, meta, flip) {
    wctx.save();
    wctx.imageSmoothingEnabled = true; wctx.imageSmoothingQuality = 'high';
    wctx.clearRect(0, 0, SIZE, SIZE);
    if (flip) { wctx.translate(SIZE, 0); wctx.scale(-1, 1); }
    wctx.drawImage(source, 0, 0, SIZE, SIZE);
    wctx.restore();
    const d = wctx.getImageData(0, 0, SIZE, SIZE).data, px = new Float32Array(SIZE * SIZE * 3);
    const pre = meta.preproceso;
    const esc = pre === 'mobilenet' ? 1 / 127.5 : pre.scale, off = pre === 'mobilenet' ? -1 : pre.offset;
    for (let i = 0, j = 0; i < d.length; i += 4) { px[j++] = d[i] * esc + off; px[j++] = d[i + 1] * esc + off; px[j++] = d[i + 2] * esc + off; }
    return tf.tensor4d(px, [1, SIZE, SIZE, 3]);
  }

  /* ---------- Inferencia ---------- */
  async function predictCon(ent, source) {
    if (ent.ensamble) { // promedio de los miembros, cada uno sobre la imagen y su espejo
      let s = 0, n = 0;
      for (const m of ent.miembros) for (const flip of [false, true]) {
        const x = entrada(source, m.meta, flip), out = m.model.predict(x);
        s += (await out.data())[1]; n++; x.dispose(); out.dispose();
      }
      return { ok: 1 - s / n, patologica: s / n };
    }
    const x = entrada(source, ent.meta);
    const out = ent.model.predict(x);
    const p = await out.data(); x.dispose(); out.dispose();
    return { ok: p[0], patologica: p[1] };
  }
  async function predict(source) {
    const ent = await cargar(activo);
    return { probs: await predictCon(ent, source), modelo: activo };
  }
  function interpretar(probs) {
    const p = probs.patologica;
    const resultado = p >= UMBRAL_PATOLOGICO ? 'patologico' : p >= UMBRAL_INCIERTO ? 'incierto' : 'normal';
    return {
      resultado, confianza: Math.round(p * 100),
      hallazgos: resultado === 'normal' ? [] : [resultado === 'patologico' ? 'Patrón radiológico torácico compatible con patología' : 'Hallazgo torácico de significado incierto'],
    };
  }

  /* Grad-CAM sobre out_relu. Con la cabeza GAP → Dropout → Dense, el gradiente de la clase respecto de cada
     mapa A_k es constante (w_k,c / HW), por lo que Grad-CAM = Σ_k w_k,c · A_k (sin necesidad de retropropagar). */
  /* Máscara del área del paciente: excluye el fondo negro, los bordes del detector y las letras de marcado.
     Umbral de intensidad + suavizado por vecindad (los objetos chicos, como "LLD", desaparecen). */
  const CAM_RES = 56;
  const mcv = document.createElement('canvas'); mcv.width = mcv.height = CAM_RES;
  const mctx = mcv.getContext('2d', { willReadFrequently: true });
  function mascara(source) {
    const R = CAM_RES;
    mctx.clearRect(0, 0, R, R); mctx.drawImage(source, 0, 0, R, R);
    const d = mctx.getImageData(0, 0, R, R).data, bin = new Float32Array(R * R);
    for (let i = 0; i < bin.length; i++) bin[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) > 28 ? 1 : 0;
    const m = new Float32Array(R * R), r = 3;
    let total = 0;
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      let s = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= R || xx >= R) { n++; continue; } // fuera de la imagen cuenta como fondo
        s += bin[yy * R + xx]; n++;
      }
      const a = s / n, v = a >= 0.7 ? 1 : a <= 0.45 ? 0 : (a - 0.45) / 0.25;
      m[y * R + x] = v; total += v;
    }
    if (total / m.length < 0.15) m.fill(1); // imagen sin fondo negro: no se enmascara
    return m;
  }
  /* Grad-CAM promedio: mismos modelos y espejo que la predicción (para el ensamble, los 2 MobileNetV2 × 2 orientaciones),
     reescalado a 56×56 y restringido al área del paciente. */
  async function cam(source, clase) {
    const ent = await cargar(activo);
    const miembros = ent.ensamble ? ent.miembros : [ent];
    if (!miembros[0].camModel) return null;
    const ci = clase === 'ok' ? 0 : 1;
    const mask = mascara(source);
    const res = tf.tidy(() => {
      let acc = null;
      for (const m of miembros) for (const flip of (ent.ensamble ? [false, true] : [false])) {
        const A = m.camModel.predict(entrada(source, m.meta, flip)).squeeze([0]);
        const W = m.model.getLayer('dense').getWeights()[0];
        const Wc = W.slice([0, ci], [-1, 1]).sub(W.slice([0, 1 - ci], [-1, 1])); // contraste entre clases: resalta lo que empuja a "patológica"
        const [h, w, k] = A.shape;
        let c = A.reshape([h * w, k]).matMul(Wc).reshape([h, w]).relu();
        c = c.div(c.max().add(1e-6));
        if (flip) c = c.reverse(1); // devolver el mapa del espejo a la orientación original
        acc = acc ? acc.add(c) : c;
      }
      const up = tf.image.resizeBilinear(acc.expandDims(-1), [CAM_RES, CAM_RES], true).squeeze([-1]).mul(tf.tensor2d(mask, [CAM_RES, CAM_RES]));
      return up.div(up.max().add(1e-6));
    });
    const data = await res.array(); res.dispose();
    return data;
  }
  function paintCam(canvas, data) {
    const h = data.length, w = data[0].length;
    const small = document.createElement('canvas'); small.width = w; small.height = h;
    const sc = small.getContext('2d'), img = sc.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = data[y][x], i = (y * w + x) * 4;
      img.data[i] = Math.min(255, 510 * v); img.data[i + 1] = Math.min(255, 510 * (v < 0.5 ? v : 1 - v) + 60 * v); img.data[i + 2] = Math.max(0, 255 * (1 - 2.2 * v));
      img.data[i + 3] = Math.round(190 * Math.pow(v, 1.2));
    }
    sc.putImageData(img, 0, 0);
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(small, 0, 0, canvas.width, canvas.height);
  }

  /* ---------- Evaluación sobre el conjunto de test ---------- */
  const cargarImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  function auc(y, p) {
    const pos = [], neg = [];
    y.forEach((v, i) => (v ? pos : neg).push(p[i]));
    let s = 0;
    pos.forEach((a) => neg.forEach((b) => { s += a > b ? 1 : a === b ? 0.5 : 0; }));
    return s / (pos.length * neg.length || 1);
  }
  function metricas(y, p, umbral) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    y.forEach((v, i) => { const pr = p[i] >= umbral; if (v && pr) tp++; else if (v) fn++; else if (pr) fp++; else tn++; });
    return { umbral, tp, fp, tn, fn, accuracy: (tp + tn) / y.length, precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1), especificidad: tn / (tn + fp || 1), f1: 2 * tp / (2 * tp + fp + fn || 1) };
  }
  async function evaluar(clave, onProgress, forzar) {
    const cache = JSON.parse(lsGet(EVAL_KEY) || '{}');
    const ent = await cargar(clave);
    const firma = clave + (clave === activo && ent.reentrenado ? ':' + ent.reentrenado.fecha : '');
    if (!forzar && cache[firma]) return cache[firma];
    const y = [], p = [], porImagen = [];
    for (let i = 0; i < TEST_SET.length; i++) {
      const t = TEST_SET[i];
      const pr = await predictCon(ent, await cargarImg(t.src));
      y.push(t.clase === 'patologica' ? 1 : 0); p.push(pr.patologica); porImagen.push([t.id, +pr.patologica.toFixed(4)]);
      onProgress && onProgress(i + 1, TEST_SET.length);
    }
    const r = { clave, n: y.length, positivos: y.filter(Boolean).length, auc: auc(y, p), m50: metricas(y, p, 0.5), m30: metricas(y, p, UMBRAL_PATOLOGICO), porImagen, fecha: new Date().toISOString() };
    cache[firma] = r; lsSet(EVAL_KEY, JSON.stringify(cache));
    return r;
  }

  /* ---------- Reentrenamiento de la cabeza (fase 1 de transfer learning) con radiografías de la clínica ---------- */
  async function reentrenar({ archivos, epochs, onStage, onEpoch }) {
    const ent = await cargar(activo);
    if (ent.ensamble) throw new Error('Elegí un modelo MobileNetV2 individual para reentrenar');
    if (!ent.featModel) throw new Error('El reentrenamiento está disponible para los modelos MobileNetV2');
    const X = [], Y = [];
    const lista = [];
    ['ok', 'patologica'].forEach((c) => Array.from((archivos && archivos[c]) || []).forEach((f) => lista.push([c, f])));
    if (lista.filter((x) => x[0] === 'ok').length < 2 || lista.filter((x) => x[0] === 'patologica').length < 2) throw new Error('Subí al menos 2 imágenes de cada clase');
    let n = 0;
    for (const [c, f] of lista) {
      const url = URL.createObjectURL(f); const im = await cargarImg(url); URL.revokeObjectURL(url);
      for (const flip of [false, true]) { // aumento con espejo horizontal, como en el TP
        const x = entrada(im, ent.meta, flip); const e = ent.featModel.predict(x); X.push(Array.from(await e.data())); x.dispose(); e.dispose();
        Y.push(c === 'ok' ? 0 : 1);
      }
      onStage('Extrayendo características con MobileNetV2… ' + (++n) + '/' + lista.length, n / lista.length);
    }
    // cabeza nueva inicializada con los pesos actuales: ajuste fino con LR bajo
    const head = tf.sequential();
    head.add(tf.layers.dropout({ inputShape: [X[0].length], rate: 0.3 }));
    head.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
    head.layers[1].setWeights(ent.model.getLayer('dense').getWeights());
    head.compile({ optimizer: tf.train.adam(1e-3), loss: 'sparseCategoricalCrossentropy', metrics: ['accuracy'] });
    const nOk = Y.filter((v) => v === 0).length, nPat = Y.length - nOk;
    const xs = tf.tensor2d(X), ys = tf.tensor1d(Y, 'float32');
    const historia = [];
    onStage('Entrenando la cabeza de clasificación…', 1);
    await head.fit(xs, ys, {
      epochs, batchSize: 16, shuffle: true,
      classWeight: { 0: Y.length / (2 * nOk), 1: Y.length / (2 * nPat) }, // class_weight 'balanced', como en el TP
      callbacks: { onEpochEnd: async (ep, logs) => { historia.push({ ep: ep + 1, loss: logs.loss, acc: logs.acc }); onEpoch(ep + 1, epochs, logs, historia); await tf.nextFrame(); } },
    });
    xs.dispose(); ys.dispose();
    const [k, b] = head.layers[1].getWeights();
    const pesos = { kernel: Array.from(await k.data()), bias: Array.from(await b.data()) };
    head.dispose();
    return { pesos, meta: { fecha: new Date().toISOString(), imagenes: lista.length, ok: lista.filter((x) => x[0] === 'ok').length, patologica: lista.filter((x) => x[0] === 'patologica').length, epochs, historia } };
  }
  /* Prueba una cabeza nueva sobre el test sin adoptarla. */
  async function evaluarCabeza(pesos, onProgress) {
    const ent = await cargar(activo);
    const dense = ent.model.getLayer('dense'), prev = dense.getWeights().map((w) => w.clone());
    dense.setWeights([tf.tensor(pesos.kernel, [pesos.kernel.length / 2, 2]), tf.tensor(pesos.bias, [2])]);
    try {
      const y = [], p = [];
      for (let i = 0; i < TEST_SET.length; i++) {
        const pr = await predictCon(ent, await cargarImg(TEST_SET[i].src));
        y.push(TEST_SET[i].clase === 'patologica' ? 1 : 0); p.push(pr.patologica); onProgress && onProgress(i + 1, TEST_SET.length);
      }
      return { auc: auc(y, p), m50: metricas(y, p, 0.5), m30: metricas(y, p, UMBRAL_PATOLOGICO), n: y.length };
    } finally { dense.setWeights(prev); }
  }
  async function adoptarCabeza(res) {
    const ent = await cargar(activo);
    ent.model.getLayer('dense').setWeights([tf.tensor(res.pesos.kernel, [res.pesos.kernel.length / 2, 2]), tf.tensor(res.pesos.bias, [2])]);
    ent.reentrenado = res.meta;
    lsSet(CABEZA_KEY + ':' + activo, JSON.stringify(Object.assign({ meta: res.meta }, res.pesos)));
  }
  async function restaurarCabeza() {
    const ent = await cargar(activo);
    ent.model.getLayer('dense').setWeights(ent.cabezaOriginal);
    ent.reentrenado = null;
    lsSet(CABEZA_KEY + ':' + activo, null);
  }

  async function usar(clave) {
    if (!CATALOGO[clave]) return;
    await cargar(clave);
    activo = clave; lsSet(ACTIVO_KEY, clave);
    const ent = cargados[clave]; if (ent.camModel && !ent.reentrenado) aplicarCabezaGuardada(ent);
  }
  function info(clave) {
    const k = clave || activo, ent = cargados[k];
    return {
      clave: k, catalogo: CATALOGO[k], activo: k === activo, cargado: !!ent, backend: tf.getBackend(),
      parametros: ent ? (ent.ensamble ? ent.miembros.reduce((a, m) => a + m.model.countParams(), 0) : ent.model.countParams()) : null, capas: ent ? ent.model.layers.length : null,
      reentrenado: ent ? ent.reentrenado || null : null, meta: ent ? ent.meta : null,
    };
  }

  window.CNN = {
    ensure, cargar, predict, interpretar, cam, paintCam, evaluar, reentrenar, evaluarCabeza, adoptarCabeza, restaurarCabeza, usar, info,
    CATALOGO, SIZE, UMBRAL_INCIERTO, UMBRAL_PATOLOGICO,
    get activo() { return activo; }, get listo() { return !!cargados[activo]; },
  };
})();

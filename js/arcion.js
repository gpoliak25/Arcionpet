/* ARCION aplicado a la veterinaria: asistente que responde dudas de uso y consulta los datos de la clínica.
   Funciona 100% local con reconocimiento de intenciones, para que la demo no dependa de conexión. */
(function () {
  const { icon, esc, fDate, fTime, fShort } = UI;
  const S = () => Store.s;
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ');
  const has = (t, ...words) => words.some((w) => t.includes(w));
  const link = (href, label) => '<a class="btn sm go" href="' + href + '">' + label + ' →</a>';
  const list = (items) => '<ul>' + items.map((i) => '<li>' + i + '</li>').join('') + '</ul>';

  const NOMBRE_MODULO = { hemocomponentes: 'hemocomponentes', turnos: 'turnos', informes: 'informes', triage: 'triage', derivaciones: 'derivaciones', interconsultas: 'interconsultas', calidad: 'control de calidad', pacientes: 'pacientes', tutores: 'tutores' };
  const history = [];
  const mounts = new Set();

  const SUGERENCIAS = ['¿Qué turnos tengo hoy?', '¿Qué informes faltan firmar?', 'Stock de glóbulos rojos', '¿Cómo firmo un informe?', 'Datos de Rocky', '¿Qué vence esta semana?'];

  const HOWTO = [
    { k: ['firm'], r: 'Para <b>firmar un informe</b>:' + list(['Entrá a <b>Informes</b> y abrí el borrador.', 'Revisá y editá el texto generado por la IA.', 'Tocá <b>Revisar y firmar</b>, indicá si coincidís con la IA o la corregís, y confirmá.']) + 'Tu veredicto queda registrado en Control de calidad.', go: ['#/informes', 'Ir a Informes'] },
    { k: ['deriv', 'segunda opinion', 'segunda lectura', 'especialista'], r: 'Para <b>derivar un estudio</b>, abrilo desde Estudios o Triage y tocá <b>Derivar a especialista</b>. Es lo recomendado cuando el resultado de la IA es <i>Incierto</i>. Las respuestas llegan a <b>Derivaciones</b>.', go: ['#/derivaciones', 'Ver derivaciones'] },
    { k: ['cargar estudio', 'nuevo estudio', 'subir', 'radiograf', 'analizar'], r: 'En <b>Estudios → Nuevo estudio</b> elegís paciente, tipo (tórax o extremidad), proyección y motivo, y subís la imagen. La IA la clasifica como Normal, Incierto o Patológico con su porcentaje.', go: ['#/estudios', 'Ir a Estudios'] },
    { k: ['nuevo paciente', 'alta de paciente', 'agregar paciente', 'cargar paciente'], r: 'En <b>Pacientes → Nuevo paciente</b> cargás la mascota y su tutor. Si ya se atendió en otra clínica de la red, usá <b>Buscar en la red</b> para incorporarla con su historia.', go: ['#/pacientes', 'Ir a Pacientes'] },
    { k: ['dar turno', 'nuevo turno', 'agendar', 'sacar turno', 'portal'], r: 'Desde <b>Turnos → Nuevo turno</b> agendás en la clínica. Los pedidos del <b>Portal Cliente</b> aparecen arriba para confirmar o rechazar, y los turnos pasados se cierran con Atendido / No vino.', go: ['#/turnos', 'Ir a Turnos'] },
    { k: ['interconsult', 'soporte', 'cupo', 'pack'], r: null },
    { k: ['export', 'csv', 'json', 'dataset', 'reentren'], r: 'En <b>Control de calidad</b> podés descargar el dataset etiquetado en <b>CSV</b> o <b>JSON</b>: incluye el resultado de la IA, tu veredicto y la etiqueta final para reentrenar el modelo.', go: ['#/calidad', 'Ir a Control de calidad'] },
    { k: ['triage', 'priori'], r: null },
    { k: ['reserv', 'transfund', 'traslad'], r: 'En <b>Hemocomponentes</b> abrí una unidad para ver su trazabilidad. Desde ahí podés <b>reservarla</b> para un paciente, <b>registrar la transfusión</b> o pedir el <b>traslado</b> si está en otra sede de la red.', go: ['#/hemocomponentes', 'Ir a Hemocomponentes'] },
  ];

  function pacienteEn(t) {
    return S().pacientes.find((p) => new RegExp('\\b' + norm(p.nombre) + '\\b').test(t));
  }
  function tutorEn(t) {
    return S().tutores.find((x) => t.includes(norm(x.apellido)) || new RegExp('\\b' + norm(x.nombre) + '\\b').test(t));
  }

  function turnosEntre(desde, dias) {
    const a = new Date(); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() + desde);
    const b = new Date(a); b.setDate(b.getDate() + dias);
    return S().turnos.filter((x) => ['confirmado', 'pendiente'].includes(x.estado) && new Date(x.fecha) >= a && new Date(x.fecha) < b).sort((x, y) => x.fecha.localeCompare(y.fecha));
  }
  const turnoLi = (x) => { const p = Store.paciente(x.pacienteId); return '<b>' + fShort(x.fecha) + '</b> · ' + esc(p.nombre) + ' — ' + esc(x.tipo) + (x.estado === 'pendiente' ? ' <i>(pedido del portal, a confirmar)</i>' : ''); };

  function responder(q) {
    const t = norm(q);
    if (!t.trim()) return 'Escribí tu consulta 🙂';
    // cada consulta de datos respeta los permisos del rol activo
    const sinPermiso = (m) => 'Con tu rol (' + esc(Dominio.permisos.ROLES[Store.rol()]) + ') no tenés acceso a la información de <b>' + esc(NOMBRE_MODULO[m] || m) + '</b>.';

    // Saludo / ayuda
    if (/^(hola|buen(as|os)|hey|que tal)/.test(t.trim()) && t.trim().split(/\s+/).length <= 3)
      return '¡Hola, ' + esc(S().usuario.nombre) + '! Soy <b>ARCION</b>. Puedo responder dudas de uso del sistema y encontrar datos de pacientes, turnos, estudios y stock. ¿En qué te ayudo?';
    if (has(t, 'que podes', 'que puedes', 'ayuda', 'que sabes', 'como funcionas'))
      return 'Puedo ayudarte con:' + list(['<b>Dudas de uso</b>: cómo firmar un informe, derivar, cargar un estudio, dar un turno…', '<b>Pacientes</b>: “datos de Luna”, “mascotas de Pérez”', '<b>Agenda</b>: “turnos de hoy”, “turnos de mañana”, “turnos de la semana”', '<b>Diagnóstico</b>: “informes sin firmar”, “estudios urgentes”, “derivaciones pendientes”', '<b>Stock</b>: “stock de plasma”, “qué vence esta semana”', '<b>Indicadores</b>: “concordancia de la IA”, “cupo de interconsultas”']);

    // Hemocomponentes
    if (has(t, 'hemo', 'stock', 'sangre', 'plasma', 'globulos', 'plaqueta', 'unidad', 'dea', 'vence', 'vencim')) { if (!Store.puede('hemocomponentes')) return sinPermiso('hemocomponentes');
      const activas = S().hemo.filter((u) => ['disponible', 'reservada'].includes(u.estado) && Store.daysBetween(new Date(), u.vence) >= 0);
      if (has(t, 'vence', 'vencim', 'por vencer')) {
        const al = Store.hemoAlertas();
        if (!al.length) return 'No hay unidades que venzan en los próximos 7 días. ✅';
        return 'Estas unidades vencen en los próximos 7 días:' + list(al.map((u) => '<b>' + esc(u.id) + '</b> · ' + esc(u.comp) + ' ' + esc(u.especie) + ' ' + esc(u.grupo) + ' — vence ' + fDate(u.vence) + ' (' + esc(u.ubicacion) + ')')) + link('#/hemocomponentes', 'Ver consolidado');
      }
      let filtro = activas, nombre = 'hemocomponentes';
      const comp = [['globulos', 'Glóbulos rojos'], ['plasma', 'Plasma fresco congelado'], ['sangre entera', 'Sangre entera'], ['plaqueta', 'Plaquetas']].find(([k]) => t.includes(k));
      if (comp) { filtro = filtro.filter((u) => u.comp === comp[1]); nombre = comp[1].toLowerCase(); }
      if (has(t, 'felin', 'gato')) filtro = filtro.filter((u) => u.especie === 'Felino');
      if (has(t, 'canin', 'perro')) filtro = filtro.filter((u) => u.especie === 'Canino');
      const disp = filtro.filter((u) => u.estado === 'disponible');
      const aca = disp.filter((u) => u.ubicacion === 'Esta clínica');
      if (!filtro.length) return 'No hay stock de ' + nombre + ' en este momento.' + link('#/hemocomponentes', 'Ver consolidado');
      return 'Stock de <b>' + nombre + '</b>: <b>' + disp.length + '</b> disponible' + (disp.length === 1 ? '' : 's') + ' en la red, <b>' + aca.length + '</b> en esta clínica.' +
        list(filtro.map((u) => '<b>' + esc(u.id) + '</b> · ' + esc(u.comp) + ' ' + esc(u.especie) + ' ' + esc(u.grupo) + ' · ' + u.volumen + ' ml · ' + (u.estado === 'reservada' ? '<i>reservada</i>' : 'disponible') + ' · ' + esc(u.ubicacion))) + link('#/hemocomponentes', 'Ver consolidado');
    }

    // Cómo hacer...
    if (has(t, 'como ', 'donde ', 'pasos', 'puedo ')) {
      const h = HOWTO.find((x) => x.r && x.k.some((k) => t.includes(k)));
      if (h) return h.r + link(h.go[0], h.go[1]);
    }

    // Turnos
    if (has(t, 'turno', 'agenda', 'citas')) { if (!Store.puede('turnos')) return sinPermiso('turnos');
      if (has(t, 'pedido', 'portal', 'confirmar')) {
        const p = S().turnos.filter((x) => x.estado === 'pendiente');
        return p.length ? 'Hay ' + p.length + ' pedido' + (p.length > 1 ? 's' : '') + ' del Portal Cliente para confirmar:' + list(p.map(turnoLi)) + link('#/turnos', 'Ir a Turnos') : 'No hay pedidos del portal pendientes.';
      }
      let r, lbl;
      if (has(t, 'manana')) { r = turnosEntre(1, 1); lbl = 'mañana'; }
      else if (has(t, 'semana', 'proxim')) { r = turnosEntre(0, 7); lbl = 'los próximos 7 días'; }
      else { r = turnosEntre(0, 1); lbl = 'hoy'; }
      const pac = pacienteEn(t);
      if (pac) { if (!Store.puede('pacientes')) return sinPermiso('pacientes'); r = S().turnos.filter((x) => x.pacienteId === pac.id && new Date(x.fecha) >= new Date() && ['confirmado', 'pendiente'].includes(x.estado)); lbl = 'próximos de ' + esc(pac.nombre); }
      return r.length ? 'Turnos ' + lbl + ' (' + r.length + '):' + list(r.map(turnoLi)) + link('#/turnos', 'Ver agenda') : 'No hay turnos ' + lbl + '.' + link('#/turnos', 'Ver agenda');
    }

    // Informes pendientes
    if (has(t, 'informe') && has(t, 'firmar', 'pendiente', 'falta', 'borrador', 'sin firmar')) { if (!Store.puede('informes')) return sinPermiso('informes');
      const b = S().informes.filter((i) => i.estado === 'borrador');
      return b.length ? 'Tenés <b>' + b.length + '</b> informe' + (b.length > 1 ? 's' : '') + ' en borrador para revisar y firmar:' + list(b.map((i) => { const e = Store.estudio(i.estudioId), p = Store.paciente(e.pacienteId); return '<a href="#/informes/' + i.id + '">' + esc(p.nombre) + ' · ' + esc(e.tipo) + '</a> — confianza ' + UI.NIVEL[i.nivel].toLowerCase(); })) : 'No tenés informes pendientes de firma. ✅';
    }

    // Urgentes / triage
    if (has(t, 'urgente', 'triage', 'priorid', 'atender primero', 'patologic')) { if (!Store.puede('triage')) return sinPermiso('triage');
      const tr = Store.triage().filter((r) => r.prioridad === 'urgente');
      return tr.length ? 'Hay <b>' + tr.length + '</b> estudio' + (tr.length > 1 ? 's' : '') + ' urgentes. Los primeros:' + list(tr.slice(0, 5).map((r) => { const p = Store.paciente(r.e.pacienteId); return '<a href="#/estudios/' + r.e.id + '">' + esc(p.nombre) + ' · ' + esc(r.e.tipo) + '</a> — ' + Store.RES_LABEL[r.e.resultado] + ' ' + r.e.confianza + '% · ' + (r.espera === 0 ? 'hoy' : r.espera + ' d de espera'); })) + link('#/triage', 'Ir a Triage') : 'No hay estudios urgentes. ✅';
    }

    // Derivaciones
    if (has(t, 'derivac', 'derivad')) { if (!Store.puede('derivaciones')) return sinPermiso('derivaciones');
      const d = S().derivaciones.filter((x) => x.estado === 'pendiente');
      return (d.length ? '<b>' + d.length + '</b> derivación' + (d.length > 1 ? 'es' : '') + ' esperando respuesta:' + list(d.map((x) => { const e = Store.estudio(x.estudioId), p = Store.paciente(e.pacienteId); return esc(p.nombre) + ' · ' + esc(e.tipo) + ' — desde ' + fDate(x.fecha); })) : 'No hay derivaciones pendientes.') + link('#/derivaciones', 'Ver derivaciones');
    }

    // Interconsultas / cupo
    if (has(t, 'interconsult', 'cupo', 'pack', 'soporte')) { if (!Store.puede('interconsultas')) return sinPermiso('interconsultas');
      const pk = S().pack, act = S().interconsultas.filter((i) => i.estado !== 'cerrada');
      return 'Usaste <b>' + pk.usadas + ' de ' + pk.total + '</b> interconsultas del ' + esc(pk.nombre) + ' este mes (quedan ' + (pk.total - pk.usadas) + '). Activas: ' + act.length + '.' + (act.length ? list(act.map((i) => '<a href="#/interconsultas/' + i.id + '">' + esc(i.asunto) + '</a>')) : '') + link('#/interconsultas', 'Ir a Interconsultas');
    }

    // Calidad
    if (has(t, 'concordancia', 'calidad', 'precision', 'acierta', 'discrepan')) { if (!Store.puede('calidad')) return sinPermiso('calidad');
      const st = Store.qaStats();
      return 'La concordancia IA–veterinario es de <b>' + st.pct + '%</b> sobre ' + st.total + ' estudios evaluados, con ' + st.discrepancias + ' discrepancia' + (st.discrepancias === 1 ? '' : 's') + '.' + link('#/calidad', 'Ver control de calidad');
    }

    // Paciente puntual
    const pac = pacienteEn(t);
    if (pac) {
      const tu = Store.tutor(pac.tutorId) || {};
      const est = S().estudios.filter((e) => e.pacienteId === pac.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
      const prox = S().turnos.filter((x) => x.pacienteId === pac.id && new Date(x.fecha) >= new Date() && x.estado === 'confirmado').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      const ult = est[0];
      return '<b>' + esc(pac.nombre) + '</b> · ' + esc(pac.especie) + ' ' + esc(pac.raza) + ', ' + Store.edad(pac.nacimiento) + (pac.peso ? ', ' + pac.peso + ' kg' : '') + '.' +
        list(['Tutor: ' + esc(tu.nombre + ' ' + tu.apellido) + ' · ' + esc(tu.tel || 's/teléfono'),
          'Estudios: ' + est.length + (ult ? ' · último ' + fDate(ult.fecha) + ' (' + esc(ult.tipo) + ', ' + (ult.resultado ? Store.RES_LABEL[ult.resultado] : 'sin análisis') + ')' : ''),
          'Próximo turno: ' + (prox ? fShort(prox.fecha) + ' · ' + esc(prox.tipo) : 'sin turnos')]) +
        (ult ? link('#/estudios/' + ult.id, 'Ver último estudio') : '');
    }

    // Mascotas de un tutor
    if (has(t, 'tutor', 'dueno', 'mascotas de', 'pacientes de')) { if (!Store.puede('tutores')) return sinPermiso('tutores');
      const tu = tutorEn(t);
      if (tu) { const ps = S().pacientes.filter((p) => p.tutorId === tu.id); return '<b>' + esc(tu.nombre + ' ' + tu.apellido) + '</b> (DNI ' + esc(tu.doc) + ', ' + esc(tu.tel) + ') tiene ' + ps.length + ' mascota' + (ps.length === 1 ? '' : 's') + ':' + list(ps.map((p) => esc(p.nombre) + ' · ' + esc(p.especie) + ' ' + esc(p.raza))); }
    }
    if (has(t, 'cuantos pacientes', 'pacientes tengo', 'cantidad de pacientes')) { if (!Store.puede('pacientes')) return sinPermiso('pacientes');
      const ps = S().pacientes; return 'La clínica tiene <b>' + ps.length + '</b> pacientes (' + ps.filter((p) => p.origen === 'red').length + ' incorporados desde la red EISPLUS).' + link('#/pacientes', 'Ver pacientes');
    }

    // Último intento: how-to sin "cómo"
    const h = HOWTO.find((x) => x.r && x.k.some((k) => t.includes(k)));
    if (h) return h.r + link(h.go[0], h.go[1]);

    return 'No estoy seguro de haber entendido. Probá con algo como: ' + list(['“¿Qué turnos tengo mañana?”', '“Datos de Michi”', '“¿Cómo derivo un estudio?”', '“Stock de plasma felino”']);
  }

  /* ---------- Render ---------- */
  function msgHtml(m) { return '<div class="amsg ' + m.who + (m.typing ? ' typing' : '') + '">' + m.html + '</div>'; }
  function paintAll() {
    mounts.forEach((root) => {
      if (!document.body.contains(root)) { mounts.delete(root); return; }
      const body = root.querySelector('.arcion-body');
      body.innerHTML = history.map(msgHtml).join('');
      body.scrollTop = body.scrollHeight;
      body.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { if (root.id === 'arcion-drawer' && window.innerWidth < 860) close(); }));
    });
  }
  function ask(q) {
    if (!q.trim()) return;
    history.push({ who: 'user', html: esc(q) });
    const typing = { who: 'bot', html: 'ARCION está escribiendo…', typing: true };
    history.push(typing); paintAll();
    setTimeout(() => {
      let r; try { r = responder(q); } catch (e) { r = 'Tuve un problema al buscar esa información. Probá de nuevo.'; }
      history.splice(history.indexOf(typing), 1, { who: 'bot', html: r }); paintAll();
    }, 550 + Math.random() * 400);
  }
  function chatShell() {
    return '<div class="arcion-body"></div>' +
      '<div class="arcion-sugs">' + SUGERENCIAS.map((s) => '<button>' + esc(s) + '</button>').join('') + '</div>' +
      '<form class="arcion-form"><input placeholder="Preguntale a ARCION…" aria-label="Mensaje para ARCION"><button aria-label="Enviar">' + icon('send') + '</button></form>';
  }
  function wire(root) {
    const inp = root.querySelector('.arcion-form input');
    root.querySelector('.arcion-form').addEventListener('submit', (e) => { e.preventDefault(); ask(inp.value); inp.value = ''; });
    root.querySelectorAll('.arcion-sugs button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
    mounts.add(root); paintAll();
    return inp;
  }
  if (!history.length) history.push({ who: 'bot', html: '¡Hola! Soy <b>ARCION</b>, el asistente inteligente de EISPLUS aplicado a la veterinaria. Preguntame cómo usar el sistema o pedime datos de pacientes, turnos y stock.' });

  /* Drawer flotante */
  const drawer = document.getElementById('arcion-drawer');
  drawer.innerHTML = '<div class="arcion-head"><div class="ai">' + icon('spark') + '</div><div class="grow"><strong>ARCION</strong><span>Asistente inteligente · siempre disponible</span></div><a class="icon-btn" href="#/arcion" title="Abrir en pantalla completa">' + icon('arrowUp') + '</a><button class="icon-btn" id="arcion-close" aria-label="Cerrar">' + icon('x') + '</button></div>' + chatShell();
  const drawerInput = wire(drawer);
  function open() { drawer.hidden = false; paintAll(); setTimeout(() => drawerInput.focus(), 30); }
  function close() { drawer.hidden = true; }
  document.getElementById('arcion-fab').addEventListener('click', () => (drawer.hidden ? open() : close()));
  drawer.querySelector('#arcion-close').addEventListener('click', close);
  drawer.querySelector('a[href="#/arcion"]').addEventListener('click', close);

  /* Vista de página completa */
  function view() {
    const html = '<div class="page-head"><div class="page-icon" style="background:#E0F2F1;color:#17796F">' + icon('spark') + '</div><div class="page-title"><h1>ARCION, aplicado a la veterinaria</h1><p>La experiencia del asistente inteligente de EISPLUS, ahora al servicio de la clínica.</p></div></div>' +
      '<div class="arcion-page"><div class="card chat-card" id="arcion-page-chat">' + chatShell() + '</div>' +
      '<div><div class="card card-pad" style="margin-bottom:16px"><div class="list-row" style="padding:0 0 14px"><div class="att-ic green">' + icon('chat') + '</div><div class="grow"><div class="t">Consultas del día a día</div><div class="s">Responde dudas de uso del sistema a recepción y veterinarios.</div></div></div>' +
      '<div class="list-row" style="padding:14px 0"><div class="att-ic green">' + icon('search') + '</div><div class="grow"><div class="t">Acceso rápido a la información</div><div class="s">Encuentra datos de pacientes, turnos y stock con una pregunta.</div></div></div>' +
      '<div class="list-row" style="padding:14px 0 0"><div class="att-ic green">' + icon('clock') + '</div><div class="grow"><div class="t">Siempre disponible</div><div class="s">Atiende consultas en cualquier momento, sin esperar al soporte.</div></div></div></div>' +
      '<div class="callout green">' + icon('info') + '<span>También podés abrir ARCION desde cualquier pantalla con el botón flotante.</span></div></div></div>';
    return { html, mount(root) { const inp = wire(root.querySelector('#arcion-page-chat')); inp.focus(); } };
  }

  window.Arcion = { view, ask, open, responder };
})();

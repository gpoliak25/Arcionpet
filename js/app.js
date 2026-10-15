/* Router, navegación lateral y notificaciones. */
(function () {
  const { icon, esc, toast, confirmModal } = UI;
  const S = () => Store.s;

  const NAV = [
    { h: '#/inicio', l: 'Inicio', m: 'inicio', i: 'home' },
    { g: 'Clínica' },
    { h: '#/pacientes', l: 'Pacientes', m: 'pacientes', i: 'paw' },
    { h: '#/turnos', l: 'Turnos', m: 'turnos', i: 'calendar', c: () => S().turnos.filter((t) => t.estado === 'pendiente').length },
    { g: 'Diagnóstico' },
    { h: '#/estudios', l: 'Estudios', m: 'imagenes', i: 'scan' },
    { h: '#/triage', l: 'Triage', m: 'triage', i: 'triage', c: () => Store.triage().filter((r) => r.prioridad === 'urgente').length, hot: true },
    { h: '#/informes', l: 'Informes', m: 'informes', i: 'file', c: () => S().informes.filter((i) => i.estado === 'borrador').length },
    { h: '#/derivaciones', l: 'Derivaciones', m: 'derivaciones', i: 'stetho', c: () => S().derivaciones.filter((d) => d.estado === 'pendiente').length },
    { g: 'Red EISPLUS' },
    { h: '#/interconsultas', l: 'Interconsultas', m: 'interconsultas', i: 'chat', c: () => S().interconsultas.filter((i) => i.noLeida).length },
    { h: '#/hemocomponentes', l: 'Hemocomponentes', m: 'hemocomponentes', i: 'drop', c: () => Store.hemoAlertas().length, hot: true },
    { g: 'Gestión' },
    { h: '#/calidad', l: 'Control de calidad', m: 'calidad', i: 'clipboard' },
    { h: '#/analitica', l: 'Analítica', m: 'analitica', i: 'chart' },
    { h: '#/modelo', l: 'Modelo CNN', m: 'modelo', i: 'brain' },
    { g: 'Asistente' },
    { h: '#/arcion', l: 'ARCION', m: 'arcion', i: 'spark' },
  ];

  const ROUTES = {
    inicio: () => Views.inicio(),
    pacientes: () => Views.pacientes(),
    turnos: () => Views.turnos(),
    estudios: (id) => (id ? Views.estudioDetalle(id) : Views.estudios()),
    triage: () => Views.triage(),
    informes: (id) => (id ? Views.informeDetalle(id) : Views.informes()),
    derivaciones: () => Views.derivaciones(),
    interconsultas: (id) => (id ? Views.interconsultaDetalle(id) : Views.interconsultas()),
    hemocomponentes: () => Views.hemocomponentes(),
    calidad: () => Views.calidad(),
    analitica: () => Views.analitica(),
    modelo: () => Views.modelo(),
    arcion: () => Arcion.view(),
  };

  /* Módulo de permisos de cada ruta */
  const MODULO = { inicio: 'inicio', pacientes: 'pacientes', turnos: 'turnos', estudios: 'imagenes', triage: 'triage', informes: 'informes', derivaciones: 'derivaciones', interconsultas: 'interconsultas', hemocomponentes: 'hemocomponentes', calidad: 'calidad', analitica: 'analitica', modelo: 'modelo', arcion: 'arcion' };
  const moduloDeHash = (h) => MODULO[(h || '').replace(/^#\//, '').split('/')[0]];
  function sinAcceso() {
    const u = Store.usuario();
    return { html: '<div class="card" style="max-width:560px;margin:40px auto"><div class="empty"><div class="eic">' + icon('alert') + '</div><strong>Sin acceso con tu rol</strong><span class="small">' + esc(u.nombre) + ' (' + esc(Dominio.permisos.ROLES[u.rol]) + ') no tiene permiso para ver este módulo.</span><div style="margin-top:14px"><a class="btn" href="#/inicio">Ir al inicio</a></div></div></div>', mount() {} };
  }

  function parse() {
    const parts = (location.hash || '#/inicio').replace(/^#\//, '').split('/');
    return { name: ROUTES[parts[0]] ? parts[0] : 'inicio', id: parts[1] };
  }

  function renderNav() {
    const cur = '#/' + parse().name;
    // se ocultan los ítems sin permiso y los títulos de grupo que quedan vacíos
    const visibles = NAV.filter((n) => n.g || Store.puede(n.m));
    const items = visibles.filter((n, i) => !n.g || (visibles[i + 1] && !visibles[i + 1].g));
    document.getElementById('nav').innerHTML = items.map((n) => {
      if (n.g) return '<div class="nav-group">' + n.g + '</div>';
      const c = n.c ? n.c() : 0;
      return '<a class="nav-item' + (cur === n.h ? ' active' : '') + '" href="' + n.h + '">' + icon(n.i) + '<span>' + n.l + '</span>' + (c ? '<span class="count' + (n.hot ? ' hot' : '') + '">' + c + '</span>' : '') + '</a>';
    }).join('');
    const nn = notificaciones().length, b = document.getElementById('bell-badge');
    b.textContent = nn; b.classList.toggle('zero', !nn);
    renderUsuario();
  }
  const notificaciones = () => Store.notificaciones().filter((n) => Store.puede(moduloDeHash(n.go)));

  /* Usuario activo y selector de rol (demo) */
  function renderUsuario() {
    const u = Store.usuario();
    document.getElementById('user-avatar').textContent = u.iniciales;
    document.getElementById('user-avatar').dataset.rol = u.rol;
    document.getElementById('user-nombre').textContent = u.nombre;
    document.getElementById('user-rol').textContent = Dominio.permisos.ROLES[u.rol];
  }
  const DESC_ROL = {
    veterinario: 'Diagnóstico, informes y firma, hemocomponentes, interconsultas.',
    recepcion: 'Pacientes, tutores, turnos, peluquería y ventas.',
    peluqueria: 'Agenda de peluquería y ventas de pet shop.',
    administracion: 'Inventario, precios, ventas y anulaciones, indicadores.',
  };
  function elegirRol() {
    const act = Store.usuario().id;
    UI.openModal({
      title: 'Cambiar de rol',
      body: '<p class="muted" style="margin-top:0">Selector de la demo para ver el sistema con los permisos de cada rol.</p>' +
        S().usuarios.map((u) => '<div class="list-row clickable" data-u="' + u.id + '" style="border-radius:10px' + (u.id === act ? ';background:var(--green-soft)' : '') + '"><div class="avatar" data-rol="' + u.rol + '">' + esc(u.iniciales) + '</div><div class="grow"><div class="t">' + esc(u.nombre) + ' · ' + esc(Dominio.permisos.ROLES[u.rol]) + '</div><div class="s">' + esc(DESC_ROL[u.rol]) + '</div></div>' + (u.id === act ? '<span class="badge b-normal">Activo</span>' : '') + '</div>').join(''),
      onMount(m) {
        m.querySelectorAll('[data-u]').forEach((r) => r.onclick = () => {
          UI.closeModal();
          Store.A.cambiarUsuario(r.dataset.u);
          if (!Store.puede(moduloDeHash(location.hash))) location.hash = '#/inicio';
          toast('Ahora estás como ' + Store.usuario().nombre + ' (' + Dominio.permisos.ROLES[Store.usuario().rol] + ')');
        });
      },
    });
  }
  document.getElementById('user-switch').addEventListener('click', elegirRol);

  let lastRoute = '';
  function render(keepFocus) {
    const view = document.getElementById('view');
    const active = document.activeElement;
    const focusId = keepFocus && active && active.id && view.contains(active) ? active.id : null;
    const caret = focusId ? active.selectionStart : null;
    const { name, id } = parse();
    const routeKey = name + '/' + (id || '');
    const scroll = routeKey === lastRoute ? window.scrollY : 0;
    let v;
    try { v = Store.puede(MODULO[name]) ? ROUTES[name](id) : sinAcceso(); } catch (e) { console.error(e); v = { html: '<div class="callout red">Ocurrió un error al mostrar esta pantalla.</div>', mount() {} }; }
    view.innerHTML = v.html;
    v.mount(view);
    renderNav();
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* no-op */ } } }
    window.scrollTo(0, scroll);
    lastRoute = routeKey;
    const h1 = view.querySelector('.page-title h1');
    document.title = 'ArcionPet · ' + (name === 'inicio' ? 'Inicio' : h1 ? h1.textContent : 'Demo');
  }
  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; render(true); }, 0);
  }

  /* Notificaciones */
  const panel = document.getElementById('notif-panel');
  document.getElementById('bell').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!panel.hidden) { panel.hidden = true; return; }
    const n = notificaciones();
    panel.innerHTML = '<h4>Notificaciones</h4>' + (n.length ? n.map((x) => '<div class="list-row clickable" data-go="' + x.go + '"><div class="att-ic">' + icon(x.ic) + '</div><div class="grow"><div class="t">' + esc(x.t) + '</div><div class="s">' + esc(x.s) + '</div></div></div>').join('') : '<div class="empty small">Sin notificaciones nuevas</div>');
    panel.querySelectorAll('[data-go]').forEach((r) => r.addEventListener('click', () => { panel.hidden = true; location.hash = r.dataset.go; }));
    panel.hidden = false;
  });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target)) panel.hidden = true; });

  document.getElementById('reset-demo').addEventListener('click', () => confirmModal('Reiniciar demo', 'Se restauran los datos de ejemplo y se pierden los cambios hechos durante la demo.', 'Reiniciar', () => { Store.A.reset(); location.hash = '#/inicio'; toast('Demo reiniciada'); }));

  const sidebar = document.getElementById('sidebar');
  document.getElementById('menu-toggle').addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) sidebar.classList.remove('open'); });

  window.addEventListener('hashchange', () => { sidebar.classList.remove('open'); UI.closeModal(); render(); });
  Store.on(scheduleRender);

  window.App = { render };
  if (!location.hash) location.hash = '#/inicio'; else render();

  /* Al iniciar, la CNN analiza los estudios que todavía no tienen resultado. */
  CNN.ensure().then(async (ok) => {
    if (!ok) { toast('No se pudo cargar el modelo CNN', 'warn'); return; }
    for (const e of S().estudios.filter((x) => !x.resultado)) {
      try { await Views.analizarEstudio(e.id); } catch (err) { console.error(err); }
    }
  });
})();

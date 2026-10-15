/* Router, navegación lateral y notificaciones. */
(function () {
  const { icon, esc, toast, confirmModal } = UI;
  const S = () => Store.s;

  /* Navegación en 5 áreas. Cada ítem indica su módulo de permisos (m) y las rutas que lo activan. */
  const AREAS = [
    { items: [{ h: '#/inicio', l: 'Inicio', i: 'home', m: 'inicio' }] },
    { id: 'clinica', g: 'Clínica', items: [
      { h: '#/pacientes', l: 'Pacientes', i: 'paw', m: 'pacientes' },
      { h: '#/tutores', l: 'Tutores', i: 'users', m: 'tutores' },
      { h: '#/hemocomponentes', l: 'Hemocomponentes', i: 'drop', m: 'hemocomponentes', c: () => Store.hemoAlertas().length, hot: true },
    ] },
    { id: 'diagnostico', g: 'Diagnóstico con IA', items: [
      { h: '#/estudios', l: 'Imágenes', i: 'scan', m: 'imagenes', rutas: ['estudios', 'imagenes'] },
      { h: '#/triage', l: 'Triage', i: 'triage', m: 'triage', c: () => Store.triage().filter((r) => r.prioridad === 'urgente').length, hot: true },
      { h: '#/informes', l: 'Informes', i: 'file', m: 'informes', c: () => S().informes.filter((i) => i.estado === 'borrador').length },
      { h: '#/derivaciones', l: 'Derivaciones', i: 'stetho', m: 'derivaciones', c: () => S().derivaciones.filter((d) => d.estado === 'pendiente').length },
    ] },
    { id: 'inventario', g: 'Inventario y ventas', items: [
      { h: '#/ventas', l: 'Ventas', i: 'cart', m: 'ventas' },
      { h: '#/inventario', l: 'Inventario', i: 'package', m: 'inventario', c: () => { const a = Store.inventarioAlertas(); return a.bajoMinimo.length + a.porVencer.length + a.vencidos.length + a.declaraciones.length; }, hot: true },
    ] },
    { id: 'servicios', g: 'Servicios', items: [
      { h: '#/turnos', l: 'Turnos', i: 'calendar', m: 'turnos', c: () => S().turnos.filter((t) => t.estado === 'pendiente').length },
    ] },
    { id: 'red', g: 'Red y gestión', items: [
      { h: '#/interconsultas', l: 'Interconsultas', i: 'chat', m: 'interconsultas', c: () => S().interconsultas.filter((i) => i.noLeida).length },
      { h: '#/arcion', l: 'ARCION Pet', i: 'spark', m: 'arcion' },
      { h: '#/calidad', l: 'Control de calidad', i: 'clipboard', m: 'calidad' },
      { h: '#/analitica', l: 'Analítica', i: 'chart', m: 'analitica' },
      { h: '#/modelo', l: 'Modelo CNN', i: 'brain', m: 'modelo' },
    ] },
  ];
  const PLEGADAS_KEY = 'arcionpet-nav-plegadas';
  let plegadas = [];
  try { plegadas = JSON.parse(localStorage.getItem(PLEGADAS_KEY) || '[]'); } catch (e) { /* sin storage */ }

  const ROUTES = {
    inicio: () => Views.inicio(),
    pacientes: () => Views.pacientes(),
    inventario: () => Views.inventario(),
    ventas: (id) => (id === 'nueva' ? Views.ventaNueva() : Views.ventas()),
    tutores: (id) => (id ? Views.tutorDetalle(id) : Views.tutores()),
    turnos: () => Views.turnos(),
    estudios: (id) => (id ? Views.estudioDetalle(id) : Views.estudios()),
    imagenes: (id) => (id ? Views.estudioDetalle(id) : Views.estudios()), // alias del nombre nuevo del módulo
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
  const MODULO = { inicio: 'inicio', pacientes: 'pacientes', tutores: 'tutores', inventario: 'inventario', ventas: 'ventas', turnos: 'turnos', estudios: 'imagenes', imagenes: 'imagenes', triage: 'triage', informes: 'informes', derivaciones: 'derivaciones', interconsultas: 'interconsultas', hemocomponentes: 'hemocomponentes', calidad: 'calidad', analitica: 'analitica', modelo: 'modelo', arcion: 'arcion' };
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
    const actual = parse().name;
    const html = AREAS.map((area) => {
      const items = area.items.filter((n) => Store.puede(n.m));
      if (!items.length) return '';
      const activa = items.some((n) => (n.rutas || [n.h.slice(2)]).includes(actual));
      const cerrada = area.id && plegadas.includes(area.id) && !activa;
      const links = items.map((n) => {
        const c = n.c ? n.c() : 0;
        const on = (n.rutas || [n.h.slice(2)]).includes(actual);
        return '<a class="nav-item' + (on ? ' active' : '') + '" href="' + n.h + '">' + icon(n.i) + '<span>' + n.l + '</span>' + (c ? '<span class="count' + (n.hot ? ' hot' : '') + '">' + c + '</span>' : '') + '</a>';
      }).join('');
      if (!area.id) return links;
      const total = cerrada ? items.reduce((t, n) => t + (n.c ? n.c() : 0), 0) : 0;
      return '<div class="nav-area' + (cerrada ? ' cerrada' : '') + '"><button class="nav-group" data-area="' + area.id + '" aria-expanded="' + !cerrada + '">' +
        '<span>' + area.g + '</span>' + (total ? '<span class="count">' + total + '</span>' : '') + '<svg viewBox="0 0 24 24" class="chev"><path d="m6 9 6 6 6-6"/></svg></button>' +
        '<div class="nav-items">' + links + '</div></div>';
    }).join('');
    const nav = document.getElementById('nav');
    nav.innerHTML = html;
    nav.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.area;
      plegadas = plegadas.includes(id) ? plegadas.filter((x) => x !== id) : plegadas.concat(id);
      try { localStorage.setItem(PLEGADAS_KEY, JSON.stringify(plegadas)); } catch (e) { /* sin storage */ }
      renderNav();
    }));
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

  /* DEMO_MODE (apagado por defecto): ?demo=1 lo prende y ?demo=0 lo apaga; queda guardado. */
  const demoParam = new URLSearchParams(location.search).get('demo');
  if (demoParam === '1' || demoParam === '0') Store.A.setDemo(demoParam === '1');
  document.getElementById('reset-demo').hidden = !Store.demo;

  window.App = { render };
  if (!location.hash) location.hash = '#/inicio'; else render();

  /* Al iniciar, la CNN analiza los estudios que todavía no tienen resultado. */
  CNN.ensure().then(async (ok) => {
    if (!ok) { toast('No se pudo cargar el modelo CNN', 'warn'); return; }
    for (const e of S().estudios.filter((x) => !x.resultado && x.activo !== false)) {
      try { await Views.analizarEstudio(e.id); } catch (err) { console.error(err); }
    }
  });
})();

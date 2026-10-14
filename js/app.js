/* Router, navegación lateral y notificaciones. */
(function () {
  const { icon, esc, toast, confirmModal } = UI;
  const S = () => Store.s;

  const NAV = [
    { h: '#/inicio', l: 'Inicio', i: 'home' },
    { g: 'Clínica' },
    { h: '#/pacientes', l: 'Pacientes', i: 'paw' },
    { h: '#/turnos', l: 'Turnos', i: 'calendar', c: () => S().turnos.filter((t) => t.estado === 'pendiente').length },
    { g: 'Diagnóstico' },
    { h: '#/estudios', l: 'Estudios', i: 'scan' },
    { h: '#/triage', l: 'Triage', i: 'triage', c: () => Store.triage().filter((r) => r.prioridad === 'urgente').length, hot: true },
    { h: '#/informes', l: 'Informes', i: 'file', c: () => S().informes.filter((i) => i.estado === 'borrador').length },
    { h: '#/derivaciones', l: 'Derivaciones', i: 'stetho', c: () => S().derivaciones.filter((d) => d.estado === 'pendiente').length },
    { g: 'Red EISPLUS' },
    { h: '#/interconsultas', l: 'Interconsultas', i: 'chat', c: () => S().interconsultas.filter((i) => i.noLeida).length },
    { h: '#/hemocomponentes', l: 'Hemocomponentes', i: 'drop', c: () => Store.hemoAlertas().length, hot: true },
    { g: 'Gestión' },
    { h: '#/calidad', l: 'Control de calidad', i: 'clipboard' },
    { h: '#/analitica', l: 'Analítica', i: 'chart' },
    { h: '#/modelo', l: 'Modelo CNN', i: 'brain' },
    { g: 'Asistente' },
    { h: '#/arcion', l: 'ARCION', i: 'spark' },
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

  function parse() {
    const parts = (location.hash || '#/inicio').replace(/^#\//, '').split('/');
    return { name: ROUTES[parts[0]] ? parts[0] : 'inicio', id: parts[1] };
  }

  function renderNav() {
    const cur = '#/' + parse().name;
    document.getElementById('nav').innerHTML = NAV.map((n) => {
      if (n.g) return '<div class="nav-group">' + n.g + '</div>';
      const c = n.c ? n.c() : 0;
      return '<a class="nav-item' + (cur === n.h ? ' active' : '') + '" href="' + n.h + '">' + icon(n.i) + '<span>' + n.l + '</span>' + (c ? '<span class="count' + (n.hot ? ' hot' : '') + '">' + c + '</span>' : '') + '</a>';
    }).join('');
    const nn = Store.notificaciones().length, b = document.getElementById('bell-badge');
    b.textContent = nn; b.classList.toggle('zero', !nn);
  }

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
    try { v = ROUTES[name](id); } catch (e) { console.error(e); v = { html: '<div class="callout red">Ocurrió un error al mostrar esta pantalla.</div>', mount() {} }; }
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
    const n = Store.notificaciones();
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

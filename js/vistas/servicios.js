/* Vistas · Servicios (turnos). Cada vista devuelve { html, mount(root) }. */
(function () {
  const { icon, esc, fDate, fTime, fShort, fLong, resBadge, NIVEL, openModal, closeModal, confirmModal, toast, formData, download, xrayHtml, mountXrays } = UI;
  const { S, A, go, pageHead, searchBox, empty, pacLabel, tutorName, match, bindSearch, on, pacienteOptions, kpi, turnoEstadoBadge, ui } = VC;
  function turnos() {
    const s = S(), now = new Date();
    const hoy = s.turnos.filter((t) => Store.isToday(t.fecha) && t.estado === 'confirmado');
    const porAtender = hoy.filter((t) => new Date(t.fecha) > now);
    const pedidos = s.turnos.filter((t) => t.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasados = s.turnos.filter((t) => t.estado === 'confirmado' && new Date(t.fecha) < now && !Store.isToday(t.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const limite = new Date(); limite.setDate(limite.getDate() + ui.agenda);
    const agenda = s.turnos.filter((t) => t.estado === 'confirmado' && new Date(t.fecha) >= new Date(new Date().setHours(0, 0, 0, 0)) && new Date(t.fecha) <= limite).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porDia = {};
    agenda.forEach((t) => { const k = t.fecha.slice(0, 10); (porDia[k] = porDia[k] || []).push(t); });
    const fila = (t, acciones) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="grow"><span class="t">' + esc(p.nombre) + ' · ' + esc(t.tipo) + '</span> <span class="muted">· ' + fShort(t.fecha) + '</span>' + (t.nota ? '<div class="s">' + esc(t.nota) + '</div>' : '') + '</div>' + acciones + '</div>'; };

    const html = pageHead('calendar', 'Turnos', 'Agenda de la clínica y pedidos de turno desde el Portal Cliente.',
      '<button class="btn" id="btn-portal">' + icon('globe') + 'Simular pedido del portal</button><button class="btn primary" id="btn-turno">' + icon('plus') + 'Nuevo turno</button>') +
      '<div class="grid kpis">' +
      kpi('clock', '', 'Turnos de hoy', hoy.length, porAtender.length + ' por atender') +
      kpi('globe', '', 'Pedidos a confirmar', pedidos.length, pedidos.length ? 'desde el Portal Cliente' : '') +
      kpi('history', 'amber', 'Pasados sin cerrar', pasados.length, pasados.length ? 'marcá atendido o no vino' : 'todo cerrado') + '</div>' +
      (pedidos.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic">' + icon('globe') + '</span><h3>Pedidos del Portal Cliente</h3></div>' +
        pedidos.map((t) => fila(t, '<button class="btn sm primary" data-st="confirmado" data-id="' + t.id + '">' + icon('check') + 'Confirmar</button><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Rechazar</button>')).join('') + '</div>' : '') +
      (pasados.length ? '<div class="card" style="margin-bottom:20px"><div class="card-head"><span class="ic" style="color:var(--muted)">' + icon('history') + '</span><h3>Turnos pasados sin cerrar</h3></div>' +
        pasados.map((t) => fila(t, '<button class="btn sm" data-st="atendido" data-id="' + t.id + '">' + icon('check') + 'Atendido</button><button class="btn sm ghost" data-st="no_vino" data-id="' + t.id + '">' + icon('userx') + 'No vino</button><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Cancelar</button>')).join('') + '</div>' : '') +
      '<div class="card"><div class="card-head"><span class="ic">' + icon('calendar') + '</span><h3>Agenda</h3><div class="seg">' + [7, 14, 21].map((n) => '<button data-ag="' + n + '" class="' + (ui.agenda === n ? 'on' : '') + '">' + n + ' días</button>').join('') + '</div></div>' +
      (agenda.length ? Object.keys(porDia).map((k) => '<div class="section-title" style="margin:14px 22px 4px">' + fLong(new Date(k + 'T12:00:00')) + '</div>' +
        porDia[k].map((t) => { const p = Store.paciente(t.pacienteId); return '<div class="list-row"><div class="strong" style="width:54px">' + fTime(t.fecha) + '</div><div class="grow"><div class="t">' + esc(p.nombre) + ' <span class="sp">(' + esc(p.especie) + ')</span></div><div class="s">' + esc(t.tipo) + (t.origen === 'portal' ? ' · reservado desde el portal' : '') + '</div></div><button class="btn sm ghost" data-st="cancelado" data-id="' + t.id + '">Cancelar</button></div>'; }).join('')).join('')
        : empty('calendar', 'Sin turnos confirmados', '<span class="small">No hay turnos en los próximos ' + ui.agenda + ' días.</span>')) + '</div>';
    return {
      html, mount(root) {
        root.querySelector('#btn-turno').onclick = () => turnoForm();
        root.querySelector('#btn-portal').onclick = portalForm;
        on(root, '[data-ag]', 'click', (el) => { ui.agenda = +el.dataset.ag; App.render(); });
        on(root, '[data-st]', 'click', (el) => {
          const msg = { confirmado: 'Turno confirmado. Se notificó al tutor.', cancelado: 'Turno cancelado', atendido: 'Turno marcado como atendido', no_vino: 'Turno marcado como ausente' }[el.dataset.st];
          A.setTurno(el.dataset.id, el.dataset.st); toast(msg);
        });
      },
    };
  }
  function turnoForm(pid, extra) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    openModal({
      title: (extra && extra.title) || 'Nuevo turno',
      body: (extra && extra.intro || '') + '<div class="form-grid">' +
        '<div class="field full"><label>Paciente</label><select name="pacienteId">' + pacienteOptions(pid) + '</select></div>' +
        '<div class="field"><label>Fecha</label><input type="date" name="dia" value="' + d.toISOString().slice(0, 10) + '"></div>' +
        '<div class="field"><label>Hora</label><input type="time" name="hora" value="10:00" step="900"></div>' +
        '<div class="field full"><label>Tipo</label><select name="tipo">' + ['Consulta general', 'Vacunación', 'Radiografía', 'Control', 'Cirugía', 'Castración', 'Control cardiológico'].map((x) => '<option>' + x + '</option>').join('') + '</select></div>' +
        ((extra && extra.nota) ? '<div class="field full"><label>Mensaje del tutor</label><textarea name="nota" style="min-height:60px">¿Tienen lugar ese día? Gracias.</textarea></div>' : '') +
        '</div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="t-ok">' + ((extra && extra.ok) || 'Agendar') + '</button>',
      onMount(m) {
        m.querySelector('#t-ok').onclick = () => {
          const f = formData(m);
          const fecha = new Date(f.dia + 'T' + (f.hora || '10:00') + ':00').toISOString();
          if (extra && extra.portal) { A.addTurno({ pacienteId: f.pacienteId, fecha, tipo: f.tipo, estado: 'pendiente', origen: 'portal', nota: 'Pedido desde el Portal Cliente: "' + (f.nota || '') + '"' }); toast('Llegó un pedido de turno desde el Portal Cliente', 'warn'); }
          else { A.addTurno({ pacienteId: f.pacienteId, fecha, tipo: f.tipo, estado: 'confirmado', origen: 'clinica' }); toast('Turno agendado'); }
          closeModal();
        };
      },
    });
  }
  function portalForm() {
    turnoForm(null, { title: 'Portal Cliente · pedir turno', ok: 'Enviar pedido', portal: true, nota: true,
      intro: '<div class="callout green" style="margin-bottom:14px">' + icon('globe') + '<span>Simulación de lo que ve el <b>tutor</b> en el Portal Cliente. El pedido llega a la clínica para que lo confirme.</span></div>' });
  }

  Object.assign(window.Views, { turnos, turnoForm, portalForm });
})();

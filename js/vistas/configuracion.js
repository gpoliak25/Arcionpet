/* Vistas · Configuración (solo administración): datos de la clínica, usuarios y roles, umbrales, SLA y módulos. */
(function () {
  const { icon, esc, fShort, openModal, closeModal, toast, formData } = UI;
  const { S, pageHead, ui } = VC;
  const C = () => Dominio.configuracion;
  const ROLES = () => Dominio.permisos.ROLES;
  const TABS = [['clinica', 'Datos de la clínica'], ['usuarios', 'Usuarios y roles'], ['umbrales', 'Umbrales'], ['sla', 'SLA'], ['modulos', 'Módulos y flags']];

  /* Guarda una parte de la configuración, la valida y la registra en la auditoría. */
  function guardar(seccion, datos) {
    try { Store.A.setConfig(datos); Store.A.auditar('configuracion', { seccion }); toast('Configuración guardada'); return true; } catch (e) { toast(e.message, 'warn'); return false; }
  }
  const campo = (name, label, val, extra) => '<div class="field' + (extra && extra.full ? ' full' : '') + '"><label>' + label + '</label><input name="' + name + '" value="' + esc(val == null ? '' : val) + '"' + (extra && extra.type ? ' type="' + extra.type + '"' : '') + (extra && extra.step ? ' step="' + extra.step + '"' : '') + (extra && extra.ph ? ' placeholder="' + esc(extra.ph) + '"' : '') + '></div>';
  const ayuda = (t) => '<p class="small muted" style="margin:0 0 14px">' + t + '</p>';
  const pie = (id) => '<div style="margin-top:16px"><button class="btn primary" id="' + id + '">Guardar</button></div>';

  function configuracion() {
    const tab = ui.cfgTab || 'clinica';
    const cfg = S().config;
    let cuerpo = '';
    if (tab === 'clinica') {
      const c = Store.clinica;
      cuerpo = ayuda('Se usan en el encabezado de los informes, en los comprobantes y en la facturación.') + '<div class="form-grid">' +
        campo('nombre', 'Nombre de fantasía *', c.nombre) + campo('razonSocial', 'Razón social', c.razonSocial) +
        campo('cuit', 'CUIT', c.cuit, { ph: '30-00000000-0' }) +
        '<div class="field"><label>Condición frente al IVA</label><select name="condicionIva">' + C().CONDICIONES_IVA.map((x) => '<option' + (x === c.condicionIva ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
        campo('domicilio', 'Domicilio', c.domicilio, { full: true }) + campo('telefono', 'Teléfono', c.telefono) + campo('email', 'Email', c.email, { type: 'email' }) +
        campo('habilitacion', 'N.º de habilitación del establecimiento', c.habilitacion, { full: true }) + '</div>' + pie('cf-clinica');
    }
    if (tab === 'usuarios') {
      cuerpo = ayuda('Los veterinarios necesitan matrícula: firman informes y recetas. Los usuarios no se borran: se dan de baja y dejan de poder ingresar.') +
        '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Matrícula</th><th>Estado</th><th class="actions"></th></tr></thead><tbody>' +
        S().usuarios.map((u) => '<tr><td><div style="display:flex;gap:10px;align-items:center"><div class="avatar" data-rol="' + u.rol + '">' + esc(u.iniciales) + '</div><span class="strong">' + esc(u.nombre) + '</span>' + (u.id === S().usuarioActivo ? ' <span class="badge b-blue">Vos</span>' : '') + '</div></td><td>' + esc(ROLES()[u.rol]) + '</td><td>' + esc(u.matricula || '—') + '</td><td>' + (u.activo === false ? '<span class="badge b-gray">De baja</span>' : '<span class="badge b-normal">Activo</span>') + '</td><td class="actions"><button class="icon-btn" data-edit-u="' + u.id + '" title="Editar">' + icon('edit') + '</button></td></tr>').join('') +
        '</tbody></table></div><div style="margin-top:14px"><button class="btn primary" id="cf-nuevo-u">' + icon('plus') + 'Nuevo usuario</button></div>' +
        '<div class="section-title">Permisos por rol</div>' + matrizPermisos();
    }
    if (tab === 'umbrales') {
      const u = Store.umbrales;
      cuerpo = ayuda('Umbrales sobre la probabilidad de patología que informa la IA. Los cambios se aplican a los análisis nuevos: los estudios ya analizados y los informes firmados no se reevalúan.') + '<div class="form-grid">' +
        campo('incierto', 'Desde esta probabilidad, el resultado es "Incierto"', u.incierto, { type: 'number', step: '0.01' }) +
        campo('patologico', 'Desde esta probabilidad, el resultado es "Patológico"', u.patologico, { type: 'number', step: '0.01' }) +
        campo('avisoFarmacia', 'Aviso de vencimiento en farmacia (días)', u.avisoFarmacia, { type: 'number' }) +
        campo('avisoHemo', 'Aviso de vencimiento de hemocomponentes (días)', u.avisoHemo, { type: 'number' }) + '</div>' + pie('cf-umbrales');
    }
    if (tab === 'sla') {
      const s = cfg.sla;
      cuerpo = ayuda('Horas máximas antes de marcar una demora. Generan avisos en el Inicio, las notificaciones y cada pantalla.') + '<div class="form-grid">' +
        campo('triage', 'Triage: urgentes sin informe firmado (h)', s.triage, { type: 'number' }) +
        campo('derivaciones', 'Derivaciones sin respuesta (h)', s.derivaciones, { type: 'number' }) +
        campo('interconsultas', 'Interconsultas sin respuesta del soporte (h)', s.interconsultas, { type: 'number' }) + '</div>' + pie('cf-sla');
    }
    if (tab === 'modulos') {
      cuerpo = ayuda('Los módulos deshabilitados desaparecen del menú y sus pantallas dejan de estar disponibles. Sus datos se conservan.') +
        Object.entries(C().MODULOS).map(([k, l]) => '<label class="cfg-switch"><input type="checkbox" name="mod_' + k + '"' + (cfg.modulos[k] !== false ? ' checked' : '') + '><span>' + l + '</span></label>').join('') +
        '<div class="section-title">Flags</div>' +
        '<label class="cfg-switch"><input type="checkbox" name="demoMode"' + (cfg.demoMode ? ' checked' : '') + '><span><b>DEMO_MODE</b>: muestra los controles de demostración (portal y respuestas simuladas, imágenes de validación, reinicio de datos)</span></label>' +
        '<label class="cfg-switch"><input type="checkbox" name="compartirAliadosRed"' + (cfg.compartirAliadosRed ? ' checked' : '') + '><span>Compartir los aliados verificados con la red EISPLUS</span></label>' + pie('cf-modulos');
    }
    const html = pageHead('settings', 'Configuración', 'Datos de la clínica, usuarios, umbrales, SLA y módulos. Los cambios quedan en la auditoría.') +
      '<div class="tabs">' + TABS.map(([k, l]) => '<button data-cfg="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
      '<div class="card card-pad" id="cfg-form">' + cuerpo + '</div>' + historial();
    return {
      html, mount(root) {
        root.querySelectorAll('[data-cfg]').forEach((b) => b.onclick = () => { ui.cfgTab = b.dataset.cfg; App.render(); });
        const form = root.querySelector('#cfg-form');
        const num = (v) => Number(String(v).replace(',', '.'));
        const b = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
        b('#cf-clinica', () => guardar('clinica', { clinica: formData(form) }));
        b('#cf-umbrales', () => { const f = formData(form); guardar('umbrales', { umbrales: { incierto: num(f.incierto), patologico: num(f.patologico), avisoFarmacia: num(f.avisoFarmacia), avisoHemo: num(f.avisoHemo) } }); });
        b('#cf-sla', () => { const f = formData(form); guardar('sla', { sla: { triage: num(f.triage), derivaciones: num(f.derivaciones), interconsultas: num(f.interconsultas) } }); });
        b('#cf-modulos', () => {
          const f = formData(form), modulos = {};
          Object.keys(C().MODULOS).forEach((k) => { modulos[k] = !!f['mod_' + k]; });
          if (guardar('modulos', { modulos, demoMode: !!f.demoMode, compartirAliadosRed: !!f.compartirAliadosRed })) document.getElementById('reset-demo').hidden = !f.demoMode;
        });
        b('#cf-nuevo-u', () => usuarioForm());
        root.querySelectorAll('[data-edit-u]').forEach((x) => x.onclick = () => usuarioForm(x.dataset.editU));
      },
    };
  }

  function usuarioForm(id) {
    const u = id ? S().usuarios.find((x) => x.id === id) : { rol: 'recepcion', activo: true };
    openModal({
      title: id ? 'Editar usuario' : 'Nuevo usuario',
      body: '<div class="form-grid">' + campo('nombre', 'Nombre y apellido *', u.nombre, { full: true }) +
        '<div class="field"><label>Rol</label><select name="rol">' + Object.entries(ROLES()).map(([k, l]) => '<option value="' + k + '"' + (k === u.rol ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        campo('matricula', 'Matrícula (veterinarios)', u.matricula, { ph: 'MP 0000' }) +
        '<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="activo"' + (u.activo !== false ? ' checked' : '') + '> Activo</label></div>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="uf-ok">' + (id ? 'Guardar' : 'Crear usuario') + '</button>',
      onMount(m) {
        m.querySelector('#uf-ok').onclick = () => {
          const f = formData(m);
          try {
            Store.A.guardarUsuario({ id, nombre: f.nombre, rol: f.rol, matricula: f.matricula, activo: !!f.activo });
            Store.A.auditar('usuario', { usuarioAfectado: id || f.nombre, rol: f.rol, activo: !!f.activo });
            closeModal(); toast(id ? 'Usuario actualizado' : 'Usuario creado');
          } catch (e) { toast(e.message, 'warn'); }
        };
      },
    });
  }

  function matrizPermisos() {
    const P = Dominio.permisos, roles = Object.keys(P.ROLES);
    const NOMBRE = { inicio: 'Inicio', pacientes: 'Pacientes', tutores: 'Tutores', hemocomponentes: 'Hemocomponentes', imagenes: 'Imágenes', triage: 'Triage', informes: 'Informes', derivaciones: 'Derivaciones', inventario: 'Inventario (alertas)', petshop: 'Pet shop', farmacia: 'Farmacia', ventas: 'Ventas', recetas: 'Recetas (RVE)', turnos: 'Turnos', peluqueria: 'Peluquería', interconsultas: 'Interconsultas', arcion: 'ARCION Pet', calidad: 'Control de calidad', analitica: 'Analítica', modelo: 'Modelo CNN', configuracion: 'Configuración' };
    const NIV = { ninguno: '—', ver: 'Ver', editar: 'Editar', todo: 'Todo' };
    return '<div class="table-wrap"><table class="arch"><thead><tr><th>Módulo</th>' + roles.map((r) => '<th>' + P.ROLES[r] + '</th>').join('') + '</tr></thead><tbody>' +
      Object.keys(P.MATRIZ).map((m) => '<tr><td>' + (NOMBRE[m] || m) + '</td>' + P.MATRIZ[m].map((n) => '<td class="' + (n === 'ninguno' ? 'muted' : '') + '">' + NIV[n] + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div><p class="small muted" style="margin-top:8px">La firma de informes es exclusiva de los veterinarios; anular ventas, editar precios, cambiar el modelo de IA y configurar el sistema, de administración.</p>';
  }

  function historial() {
    const TXT = { configuracion: 'Configuración', usuario: 'Usuarios', cambio_modelo: 'Cambio de modelo', reentrenamiento: 'Reentrenamiento', restaurar_modelo: 'Restauración del modelo', datos_entrenamiento: 'Datos de entrenamiento' };
    const SEC = { clinica: 'datos de la clínica', umbrales: 'umbrales', sla: 'SLA', modulos: 'módulos y flags' };
    const lista = (S().auditoria || []).slice().reverse().slice(0, 15);
    if (!lista.length) return '';
    return '<div class="card" style="margin-top:20px"><div class="card-head"><h3>Auditoría reciente</h3></div><div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' +
      lista.map((a) => '<tr><td class="nowrap">' + fShort(a.fecha) + '</td><td>' + esc(Store.nombreUsuario(a.usuario)) + '</td><td>' + (TXT[a.accion] || a.accion) + '</td><td class="sp">' + esc(a.seccion ? SEC[a.seccion] || a.seccion : a.de ? (a.de.version + ' → ' + a.a.version) : a.usuarioAfectado ? Store.nombreUsuario(a.usuarioAfectado) || a.usuarioAfectado : '') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  Object.assign(window.Views, { configuracion, usuarioForm });
})();

/* Migraciones del esquema de datos guardado en el navegador.
   Cada paso tiene up (sube una versión) y down (la revierte sin perder los datos originales).
   Funciones puras: reciben un estado y devuelven uno nuevo. Se usan en el navegador y en los tests de Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { migraciones: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const clonar = (o) => JSON.parse(JSON.stringify(o));

  const USUARIOS_DEMO = [
    { id: 'u-vet', nombre: 'Dra. Laura Giménez', iniciales: 'LG', rol: 'veterinario' },
    { id: 'u-rec', nombre: 'Martina Ruiz', iniciales: 'MR', rol: 'recepcion' },
    { id: 'u-pel', nombre: 'Lucas Benítez', iniciales: 'LB', rol: 'peluqueria' },
    { id: 'u-adm', nombre: 'Sofía Herrera', iniciales: 'SH', rol: 'administracion' },
  ];

  /* Catálogo inicial de la demo. Precios en pesos con IVA incluido. Fechas relativas al momento de migrar. */
  function catalogoInicial(hoy) {
    const f = (d) => { const x = new Date(hoy); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    const P = (id, catalogo, categoria, nombre, marca, presentacion, precio, stockMinimo, extra) =>
      Object.assign({ id, catalogo, categoria, nombre, marca, presentacion, sku: id.toUpperCase(), precio, stockMinimo, activo: true, requiereReceta: false, sigtrazavet: false, principioActivo: '' }, extra || {});
    const productos = [
      P('ps-alim-01', 'petshop', 'Alimentos', 'Alimento perro adulto raza mediana', 'NutriPet', 'Bolsa 15 kg', 58900, 4),
      P('ps-alim-02', 'petshop', 'Alimentos', 'Alimento gato castrado', 'NutriPet', 'Bolsa 7,5 kg', 41500, 3),
      P('ps-alim-03', 'petshop', 'Alimentos', 'Snack dental para perros', 'DentaBites', 'Pack x 7', 6900, 6),
      P('ps-acc-01', 'petshop', 'Correas y accesorios', 'Correa de nylon 1,2 m', 'Paseo', 'Unidad', 8500, 3),
      P('ps-acc-02', 'petshop', 'Correas y accesorios', 'Arnés pechera', 'Paseo', 'Talle M', 14900, 2),
      P('ps-acc-03', 'petshop', 'Correas y accesorios', 'Comedero de acero inoxidable', 'Casa Pet', '750 ml', 7200, 3),
      P('ps-ropa-01', 'petshop', 'Ropa', 'Abrigo polar', 'Abriguito', 'Talle S', 16500, 2),
      P('ps-ropa-02', 'petshop', 'Ropa', 'Impermeable con capucha', 'Abriguito', 'Talle M', 19800, 2),
      P('ps-jug-01', 'petshop', 'Juguetes', 'Pelota de goma maciza', 'Juguetón', 'Unidad', 4900, 5),
      P('ps-jug-02', 'petshop', 'Juguetes', 'Rascador para gatos', 'Juguetón', '60 cm', 32500, 1),
      P('ps-jug-03', 'petshop', 'Juguetes', 'Hueso de nylon', 'Juguetón', 'Talle M', 5600, 4),
      P('fa-anti-01', 'farmacia', 'Antiparasitarios', 'Antiparasitario interno', 'VetLab', 'Comprimidos x 4', 9800, 6, { principioActivo: 'Praziquantel + pamoato de pirantel' }),
      P('fa-anti-02', 'farmacia', 'Antiparasitarios', 'Pipeta antipulgas perro 10–20 kg', 'VetLab', 'Pipeta 1,34 ml', 11900, 5, { principioActivo: 'Fipronil' }),
      P('fa-anti-03', 'farmacia', 'Antiparasitarios', 'Comprimido masticable antipulgas 10–20 kg', 'VetLab', 'Comprimido x 1', 42500, 3, { principioActivo: 'Fluralaner', requiereReceta: true, sigtrazavet: true }),
      P('fa-med-01', 'farmacia', 'Medicamentos', 'Amoxicilina + ácido clavulánico 250 mg', 'Farmavet', 'Comprimidos x 10', 15400, 4, { principioActivo: 'Amoxicilina + ácido clavulánico', requiereReceta: true, sigtrazavet: true }),
      P('fa-med-02', 'farmacia', 'Medicamentos', 'Meloxicam 1,5 mg/ml suspensión oral', 'Farmavet', 'Frasco 10 ml', 12300, 3, { principioActivo: 'Meloxicam', requiereReceta: true, sigtrazavet: true }),
      P('fa-med-03', 'farmacia', 'Medicamentos', 'Furosemida 40 mg', 'Farmavet', 'Comprimidos x 20', 8900, 3, { principioActivo: 'Furosemida', requiereReceta: true, sigtrazavet: true }),
      P('fa-med-04', 'farmacia', 'Medicamentos', 'Prednisolona 5 mg', 'Farmavet', 'Comprimidos x 20', 7600, 3, { principioActivo: 'Prednisolona', requiereReceta: true, sigtrazavet: true }),
      P('fa-vac-01', 'farmacia', 'Vacunas', 'Vacuna séxtuple canina', 'BioVet', 'Dosis x 1', 21500, 5, { principioActivo: 'Vacuna polivalente canina', requiereReceta: true }),
      P('fa-vac-02', 'farmacia', 'Vacunas', 'Vacuna antirrábica', 'BioVet', 'Dosis x 1', 14800, 5, { principioActivo: 'Virus rábico inactivado', requiereReceta: true }),
      P('fa-vac-03', 'farmacia', 'Vacunas', 'Vacuna triple felina', 'BioVet', 'Dosis x 1', 19900, 3, { principioActivo: 'Vacuna polivalente felina', requiereReceta: true }),
      P('fa-ins-01', 'farmacia', 'Insumos sanitarios', 'Jeringa descartable 5 ml', 'MedPlast', 'Caja x 100', 18900, 2),
      P('fa-ins-02', 'farmacia', 'Insumos sanitarios', 'Gasa estéril 10 x 10 cm', 'MedPlast', 'Paquete x 10', 3900, 10),
      P('fa-ins-03', 'farmacia', 'Insumos sanitarios', 'Guantes de látex', 'MedPlast', 'Caja x 100, talle M', 16500, 2),
      P('fa-ins-04', 'farmacia', 'Insumos sanitarios', 'Solución fisiológica', 'MedPlast', 'Sachet 500 ml', 4200, 6),
    ];
    // [productoId, lote, vence (días desde hoy, null = sin vencimiento), cantidad, ingreso (días)]
    const L = [
      ['ps-alim-01', '', 120, 9, -20], ['ps-alim-02', '', 150, 2, -20], ['ps-alim-03', '', 200, 14, -10],
      ['ps-acc-01', '', null, 7, -40], ['ps-acc-02', '', null, 1, -40], ['ps-acc-03', '', null, 6, -40],
      ['ps-ropa-01', '', null, 5, -30], ['ps-ropa-02', '', null, 3, -30],
      ['ps-jug-01', '', null, 12, -15], ['ps-jug-02', '', null, 2, -15], ['ps-jug-03', '', null, 3, -15],
      ['fa-anti-01', 'AP2405', 210, 18, -25], ['fa-anti-02', 'PF2611', 18, 4, -60], ['fa-anti-02', 'PF2702', 240, 8, -5],
      ['fa-anti-03', 'FL2612', 160, 6, -12],
      ['fa-med-01', 'AX2511', 12, 3, -70], ['fa-med-01', 'AX2604', 190, 10, -8],
      ['fa-med-02', 'MX2509', -5, 2, -120], ['fa-med-02', 'MX2603', 140, 5, -15],
      ['fa-med-03', 'FU2602', 95, 2, -30], ['fa-med-04', 'PR2607', 260, 8, -30],
      ['fa-vac-01', 'SX2601', 26, 7, -20], ['fa-vac-02', 'RB2605', 150, 12, -20], ['fa-vac-03', 'TF2604', 120, 4, -20],
      ['fa-ins-01', 'JG2701', 700, 3, -50], ['fa-ins-02', 'GZ2612', 400, 25, -50], ['fa-ins-03', 'GL2706', 600, 1, -50], ['fa-ins-04', 'SF2610', 330, 14, -50],
    ];
    const lotes = L.map(([productoId, lote, vence, cantidad, ingreso], i) => ({ id: 'lt' + (i + 1), productoId, lote, vence: vence == null ? null : f(vence), cantidad, ingreso: f(ingreso) }));
    const movimientos = lotes.map((l, i) => ({ id: 'mv' + (i + 1), productoId: l.productoId, loteId: l.id, tipo: 'ingreso', cantidad: l.cantidad, fecha: l.ingreso + 'T10:00:00.000Z', usuario: 'u-adm', nota: 'Inventario inicial' }));
    return { productos, lotes, movimientos };
  }

  /* Versión de cada modelo de IA (se guarda en cada estudio analizado). */
  const VERSIONES_MODELO = { ensamble: 'ensamble-tta@1.0', transfer_mobilenetv2: 'mobilenetv2-finetune@1.0', transfer_fase1: 'mobilenetv2-fase1@1.0', cnn_desde_cero: 'cnn-cero@1.0' };

  const PASOS = [
    {
      de: 8, a: 9, descripcion: 'Usuarios de la demo y rol activo (selector de roles)',
      up(s) {
        s.usuarios = clonar(USUARIOS_DEMO);
        s.usuarioActivo = 'u-vet';
        return s;
      },
      down(s) {
        delete s.usuarios;
        delete s.usuarioActivo;
        return s;
      },
    },
    {
      de: 9, a: 10, descripcion: 'Ficha de tutor: tipo de documento, CUIT, domicilio, notas y baja lógica',
      up(s) {
        s.tutores = s.tutores.map((t) => Object.assign({ tipoDoc: 'DNI', cuit: '', domicilio: '', notas: '', activo: true }, t));
        return s;
      },
      down(s) {
        s.tutores = s.tutores.map((t) => { const c = Object.assign({}, t); ['tipoDoc', 'cuit', 'domicilio', 'notas', 'activo', 'fechaBaja'].forEach((k) => delete c[k]); return c; });
        return s;
      },
    },
    {
      de: 10, a: 11, descripcion: 'Inventario unificado: productos (pet shop y farmacia), lotes, movimientos y declaraciones SIGTRAZAVET',
      up(s) {
        const c = catalogoInicial(new Date());
        s.productos = c.productos;
        s.lotes = c.lotes;
        s.movimientos = c.movimientos;
        s.declaraciones = [];
        return s;
      },
      down(s) {
        delete s.productos; delete s.lotes; delete s.movimientos; delete s.declaraciones;
        return s;
      },
    },
    {
      de: 11, a: 12, descripcion: 'Ventas, recetas veterinarias electrónicas registradas y matrícula del veterinario',
      up(s) {
        s.ventas = [];
        s.recetas = [];
        s.usuarios = s.usuarios.map((u) => (u.rol === 'veterinario' && !u.matricula ? Object.assign({}, u, { matricula: 'MP 4821' }) : u));
        return s;
      },
      down(s) {
        delete s.ventas; delete s.recetas;
        s.usuarios = s.usuarios.map((u) => { const c = Object.assign({}, u); delete c.matricula; return c; });
        return s;
      },
    },
    {
      de: 12, a: 13, descripcion: 'Seguridad clínica: probabilidad de patología, versión de modelo, bajas lógicas, asignación, SLA, DEMO_MODE, auditoría y datos ficticios',
      up(s) {
        const deshacer = { dni: {}, email: {} }; // lo necesario para revertir exactamente
        s.estudios = s.estudios.map((e) => {
          const c = Object.assign({}, e, { probPatologia: e.confianza == null ? null : e.confianza, activo: true, asignadoA: null });
          delete c.confianza;
          if (c.modelo && !c.modelo.version) c.modelo = Object.assign({}, c.modelo, { version: VERSIONES_MODELO[c.modelo.clave] || c.modelo.clave + '@1.0' });
          return c;
        });
        s.informes = s.informes.map((i) => {
          if (i.estado !== 'firmado' || i.iaFirmada) return i;
          const e = s.estudios.find((x) => x.id === i.estudioId) || {};
          return Object.assign({}, i, { iaFirmada: { resultado: e.resultado, probPatologia: e.probPatologia, probs: e.probs || null, modelo: e.modelo || null, analizadoEn: e.analizadoEn || null, congeladoEn: i.fechaFirma } });
        });
        s.pacientes = s.pacientes.map((p) => Object.assign({ activo: true }, p));
        s.derivaciones = s.derivaciones.map((d) => Object.assign({ asignadoA: d.id === 'd1' ? 'u-vet' : null }, d));
        s.interconsultas = s.interconsultas.map((i) => Object.assign({ asignadoA: null }, i));
        s.usuarios = s.usuarios.concat([{ id: 'u-vet2', nombre: 'Dr. Tomás Ferreyra', iniciales: 'TF', rol: 'veterinario', matricula: 'MP 5170' }]);
        s.config = { demoMode: false, sla: { triage: 24, derivaciones: 72, interconsultas: 48 }, modeloDatos: { origen: 'Radiografías aportadas por una veterinaria colaboradora', fecha: '', alcance: 'Tórax de perro y gato (proyecciones laterolaterales y ventrodorsales)', imagenes: '441 (308 de entrenamiento, 66 de validación y 67 de prueba)', autorizacion: '' } };
        s.auditoria = [];
        // datos de ejemplo ficticios: DNI en un rango que no se asigna y emails en el dominio reservado example.com
        const nuevoDni = (doc) => {
          if (!deshacer.dni[doc]) { const n = Object.keys(deshacer.dni).length + 1; deshacer.dni[doc] = '99.100.' + String(n).padStart(3, '0'); }
          return deshacer.dni[doc];
        };
        const SEMILLA = ['30.456.789', '28.111.222', '25.987.654', '33.222.111', '35.789.012', '22.345.678'];
        SEMILLA.forEach(nuevoDni);
        s.tutores = s.tutores.map((t) => {
          const c = Object.assign({}, t);
          if (deshacer.dni[c.doc]) c.doc = deshacer.dni[c.doc];
          if (/@mail\.com$/.test(c.email || '')) { deshacer.email[c.id] = c.email; c.email = c.email.replace(/@mail\.com$/, '@example.com'); }
          return c;
        });
        s.redPacientes = s.redPacientes.map((r) => (deshacer.dni[r.tutor.doc] ? Object.assign({}, r, { tutor: Object.assign({}, r.tutor, { doc: deshacer.dni[r.tutor.doc] }) }) : r));
        s.recetas = (s.recetas || []).map((r) => (deshacer.dni[r.titular.doc] ? Object.assign({}, r, { titular: Object.assign({}, r.titular, { doc: deshacer.dni[r.titular.doc] }) }) : r));
        s._deshacerV13 = deshacer;
        return s;
      },
      down(s) {
        const deshacer = s._deshacerV13 || { dni: {}, email: {} };
        const viejoDni = {}; Object.entries(deshacer.dni).forEach(([viejo, nuevo]) => { viejoDni[nuevo] = viejo; });
        s.estudios = s.estudios.map((e) => {
          const c = Object.assign({}, e, { confianza: e.probPatologia });
          ['probPatologia', 'activo', 'asignadoA', 'fechaBaja', 'motivoBaja', 'usuarioBaja', 'fueraDeAlcance'].forEach((k) => delete c[k]);
          if (c.modelo) { c.modelo = Object.assign({}, c.modelo); delete c.modelo.version; }
          return c;
        });
        s.informes = s.informes.map((i) => { const c = Object.assign({}, i); delete c.iaFirmada; if (c.estado === 'descartado') c.estado = 'borrador'; return c; });
        s.pacientes = s.pacientes.map((p) => { const c = Object.assign({}, p); ['activo', 'fechaBaja', 'motivoBaja'].forEach((k) => delete c[k]); return c; });
        s.derivaciones = s.derivaciones.map((d) => { const c = Object.assign({}, d); delete c.asignadoA; return c; });
        s.interconsultas = s.interconsultas.map((i) => { const c = Object.assign({}, i); delete c.asignadoA; return c; });
        s.usuarios = s.usuarios.filter((u) => u.id !== 'u-vet2');
        if (s.usuarioActivo === 'u-vet2') s.usuarioActivo = 'u-vet';
        s.tutores = s.tutores.map((t) => {
          const c = Object.assign({}, t);
          if (viejoDni[c.doc]) c.doc = viejoDni[c.doc];
          if (deshacer.email[c.id]) c.email = deshacer.email[c.id];
          return c;
        });
        s.redPacientes = s.redPacientes.map((r) => (viejoDni[r.tutor.doc] ? Object.assign({}, r, { tutor: Object.assign({}, r.tutor, { doc: viejoDni[r.tutor.doc] }) }) : r));
        s.recetas = (s.recetas || []).map((r) => (viejoDni[r.titular.doc] ? Object.assign({}, r, { titular: Object.assign({}, r.titular, { doc: viejoDni[r.titular.doc] }) }) : r));
        delete s.config; delete s.auditoria; delete s._deshacerV13;
        return s;
      },
    },
    {
      de: 13, a: 14, descripcion: 'Configuración: módulos habilitados, umbrales, datos de la clínica y usuarios activos',
      up(s) {
        s.config = Object.assign({}, s.config, {
          modulos: { inventario: true, servicios: true, peluqueria: true, aliados: true },
          compartirAliadosRed: false,
          umbrales: { incierto: 0.20, patologico: 0.30, avisoFarmacia: 30, avisoHemo: 7 },
          clinica: { nombre: 'Veterinaria ArcionPet (ejemplo)', razonSocial: 'ArcionPet Demo S.A. (ficticia)', cuit: '30-99999999-7', condicionIva: 'Responsable inscripto', domicilio: 'Av. Siempreviva 742, CABA', telefono: '11 5555-0000', email: 'contacto@example.com', habilitacion: '' },
        });
        s.usuarios = s.usuarios.map((u) => Object.assign({ activo: true }, u));
        return s;
      },
      down(s) {
        ['modulos', 'compartirAliadosRed', 'umbrales', 'clinica'].forEach((k) => delete s.config[k]);
        s.usuarios = s.usuarios.filter((u) => !u.creadoV14).map((u) => { const c = Object.assign({}, u); delete c.activo; return c; });
        return s;
      },
    },
    {
      de: 14, a: 15, descripcion: 'Inventario y ventas: costo, proveedor, código de barras e intervalo; facturación, caja, botiquín y calendario de salud',
      up(s) {
        const PROV = { petshop: 'Distribuidora Mascotas Sur (ejemplo)', farmacia: 'Droguería Veterinaria Norte (ejemplo)' };
        const INTERVALO = { 'fa-anti-01': 90, 'fa-anti-02': 30, 'fa-anti-03': 90, 'fa-vac-01': 365, 'fa-vac-02': 365, 'fa-vac-03': 365 };
        const ean = (doce) => { let t = 0; for (let i = 0; i < 12; i++) t += +doce[i] * (i % 2 ? 3 : 1); return doce + ((10 - (t % 10)) % 10); };
        s.productos = (s.productos || []).map((p, i) => Object.assign({
          costo: Math.round(p.precio / 1.21 * 0.62), proveedor: PROV[p.catalogo] || '',
          codigoBarras: ean('2000' + String(i + 1).padStart(8, '0')), // rango de uso interno (200-299): no son códigos reales
          intervaloDias: INTERVALO[p.id] || null,
        }, p));
        s.tutores = s.tutores.map((t) => Object.assign({ condicionIva: 'Consumidor final' }, t));
        s.recetas = (s.recetas || []).map((r) => Object.assign({ origen: r.tipo === 'botiquin' ? 'botiquin' : 'registrada' }, r));
        s.config = Object.assign({}, s.config, { facturacion: { proveedor: '', modo: 'homologacion', puntosVenta: [{ numero: 1, nombre: 'Mostrador' }, { numero: 2, nombre: 'Peluquería' }], puntoVenta: 1 } });
        s.comprobantes = []; s.cajas = []; s.fichaClinica = []; s.calendarioSalud = [];
        return s;
      },
      down(s) {
        s.productos = (s.productos || []).map((p) => { const c = Object.assign({}, p); ['costo', 'proveedor', 'codigoBarras', 'intervaloDias'].forEach((k) => delete c[k]); return c; });
        s.tutores = s.tutores.map((t) => { const c = Object.assign({}, t); delete c.condicionIva; return c; });
        s.recetas = (s.recetas || []).filter((r) => r.origen !== 'emitida').map((r) => { const c = Object.assign({}, r); delete c.origen; return c; });
        s.ventas = (s.ventas || []).map((v) => { const c = Object.assign({}, v); ['comprobanteId', 'devoluciones', 'cliente', 'puntoVenta'].forEach((k) => delete c[k]); if (c.estado === 'devuelta') c.estado = 'anulada'; if (c.estado === 'devolucion_parcial') c.estado = 'confirmada'; return c; });
        delete s.config.facturacion;
        ['comprobantes', 'cajas', 'fichaClinica', 'calendarioSalud'].forEach((k) => delete s[k]);
        return s;
      },
    },
    {
      de: 15, a: 16, descripcion: 'Turnos: servicios con duración y precio, recursos (profesionales, salas, equipos) y horario de atención',
      up(s) {
        const SV = (id, nombre, duracion, precio, requiere, recursosDefecto, extra) => Object.assign({ id, nombre, duracion, precio, requiere, recursosDefecto, portal: true, activo: true }, extra || {});
        s.servicios = [
          SV('consulta', 'Consulta general', 30, 25000, ['profesional', 'sala'], ['r-vet', 'r-cons1']),
          SV('vacunacion', 'Vacunación', 20, 12000, ['profesional', 'sala'], ['r-vet', 'r-cons1'], { aplicaCategoria: 'Vacunas' }),
          SV('desparasitacion', 'Desparasitación', 15, 8000, ['profesional', 'sala'], ['r-vet', 'r-cons1'], { aplicaCategoria: 'Antiparasitarios' }),
          SV('radiografia', 'Radiografía', 30, 45000, ['profesional', 'equipo'], ['r-vet', 'r-rx'], { estudio: true }),
          SV('control', 'Control', 20, 15000, ['profesional', 'sala'], ['r-vet', 'r-cons1']),
          SV('control_cardiologico', 'Control cardiológico', 40, 35000, ['profesional', 'sala'], ['r-vet2', 'r-cons2']),
          SV('castracion', 'Castración', 90, 180000, ['profesional', 'sala'], ['r-vet2', 'r-quir'], { portal: false }),
          SV('cirugia', 'Cirugía', 120, 250000, ['profesional', 'sala'], ['r-vet2', 'r-quir'], { portal: false }),
        ];
        const vet = (id) => (s.usuarios || []).find((u) => u.id === id) || {};
        s.recursos = [
          { id: 'r-vet', tipo: 'profesional', nombre: vet('u-vet').nombre || 'Veterinario/a 1', usuarioId: 'u-vet', activo: true },
          { id: 'r-vet2', tipo: 'profesional', nombre: vet('u-vet2').nombre || 'Veterinario/a 2', usuarioId: 'u-vet2', activo: true },
          { id: 'r-cons1', tipo: 'sala', nombre: 'Consultorio 1', activo: true },
          { id: 'r-cons2', tipo: 'sala', nombre: 'Consultorio 2', activo: true },
          { id: 'r-quir', tipo: 'sala', nombre: 'Quirófano', activo: true },
          { id: 'r-rx', tipo: 'equipo', nombre: 'Equipo de rayos X', activo: true },
        ];
        const MAPA = { 'Consulta general': 'consulta', 'Vacunación': 'vacunacion', 'Radiografía': 'radiografia', 'Control cardiológico': 'control_cardiologico', 'Castración': 'castracion', 'Cirugía': 'cirugia', 'Consulta traumatológica': 'consulta' };
        s.turnos = s.turnos.map((t) => {
          const sv = s.servicios.find((x) => x.id === (MAPA[t.tipo] || (/^Control/.test(t.tipo) ? 'control' : 'consulta')));
          return Object.assign({ servicioId: sv.id, duracion: sv.duracion, recursos: sv.recursosDefecto.slice(), historial: [] }, t);
        });
        s.config = Object.assign({}, s.config, { agenda: { inicio: '09:00', fin: '19:00', intervalo: 15 } });
        return s;
      },
      down(s) {
        s.turnos = s.turnos.map((t) => { const c = Object.assign({}, t); ['servicioId', 'duracion', 'recursos', 'historial', 'estudioId', 'ventaId', 'aplicacionId', 'cancelacion'].forEach((k) => delete c[k]); return c; });
        delete s.servicios; delete s.recursos; delete s.config.agenda;
        return s;
      },
    },
    {
      de: 16, a: 17, descripcion: 'Peluquería: servicios por tamaño, peluqueros, agenda propia, fichas por mascota e insumos',
      up(s) {
        const T = (chico, mediano, grande, gigante) => ({ chico: { precio: chico[0], duracion: chico[1] }, mediano: { precio: mediano[0], duracion: mediano[1] }, grande: { precio: grande[0], duracion: grande[1] }, gigante: { precio: gigante[0], duracion: gigante[1] } });
        const SV = (id, nombre, porTamano, extra) => Object.assign({ id, nombre, porTamano, requiere: ['profesional'], recursosDefecto: ['rp-1'], recargoPeloLargo: false, insumos: [], frecuenciaDias: null, portal: true, activo: true, peluqueria: true }, extra || {});
        s.pelServicios = [
          SV('pel-bano', 'Baño común', T([14000, 45], [18000, 60], [24000, 75], [30000, 90]), { recargoPeloLargo: true, insumos: [{ productoId: 'ps-hig-02', cantidad: 1 }], frecuenciaDias: 30 }),
          SV('pel-bano-hipo', 'Baño hipoalergénico', T([17000, 50], [21000, 65], [28000, 80], [35000, 95]), { recargoPeloLargo: true, insumos: [{ productoId: 'ps-hig-01', cantidad: 1 }], frecuenciaDias: 30 }),
          SV('pel-corte', 'Corte', T([16000, 45], [21000, 60], [27000, 75], [33000, 90]), { recargoPeloLargo: true, frecuenciaDias: 45 }),
          SV('pel-bano-corte', 'Baño y corte', T([26000, 75], [33000, 90], [42000, 120], [52000, 150]), { recargoPeloLargo: true, insumos: [{ productoId: 'ps-hig-02', cantidad: 1 }], frecuenciaDias: 45 }),
          SV('pel-peinado', 'Peinado y cepillado', T([9000, 30], [11000, 40], [14000, 50], [17000, 60]), { recargoPeloLargo: true }),
          SV('pel-unas', 'Corte de uñas', T([5000, 15], [5500, 15], [6000, 20], [7000, 20]), { frecuenciaDias: 30 }),
        ];
        // precio de referencia (tamaño mediano) para validar líneas de venta
        s.pelServicios.forEach((x) => { x.precio = x.porTamano.mediano.precio; x.duracion = x.porTamano.mediano.duracion; });
        const pel = (s.usuarios || []).find((u) => u.id === 'u-pel') || {};
        s.pelRecursos = [
          { id: 'rp-1', tipo: 'profesional', nombre: pel.nombre || 'Peluquero/a 1', usuarioId: 'u-pel', activo: true },
          { id: 'rp-2', tipo: 'profesional', nombre: 'Camila Ortiz (ejemplo)', usuarioId: null, activo: true },
        ];
        const dia = (n, h, m) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, m || 0, 0, 0); return d.toISOString(); };
        const pacs = s.pacientes || [];
        const tu = (id, pacienteId, servicioId, recurso, fecha, estado) => {
          const sv = s.pelServicios.find((x) => x.id === servicioId);
          return pacs.some((p) => p.id === pacienteId) ? { id, pacienteId, servicioId, tipo: sv.nombre, duracion: sv.porTamano.mediano.duracion, precio: sv.porTamano.mediano.precio, recursos: [recurso], fecha, estado, origen: 'clinica', historial: [] } : null;
        };
        s.pelTurnos = [tu('pt1', 'p1', 'pel-bano', 'rp-1', dia(0, 10), 'confirmado'), tu('pt2', 'p6', 'pel-bano-corte', 'rp-2', dia(0, 11), 'confirmado'), tu('pt3', 'p4', 'pel-unas', 'rp-1', dia(1, 9, 30), 'confirmado'), tu('pt4', 'p2', 'pel-peinado', 'rp-2', dia(-7, 15), 'atendido')].filter(Boolean);
        s.pelFichas = pacs.some((p) => p.id === 'p6') ? [{ pacienteId: 'p6', tamano: 'grande', preferencias: 'Corte prolijo, sin rapar el lomo.', temperamento: 'Tranquilo, se pone nervioso con el secador.', piel: 'Sin alergias conocidas.', observaciones: '', fotos: [], actualizado: dia(-7, 15) }] : [];
        // insumos de peluquería (también se venden en el pet shop)
        const ean = (doce) => { let t = 0; for (let i = 0; i < 12; i++) t += +doce[i] * (i % 2 ? 3 : 1); return doce + ((10 - (t % 10)) % 10); };
        const hoy = new Date().toISOString().slice(0, 10);
        const P = (id, nombre, precio, costo, cod) => ({ id, catalogo: 'petshop', categoria: 'Higiene y peluquería', nombre, marca: 'PeluPet', presentacion: 'Monodosis 50 ml', sku: id.toUpperCase(), precio, stockMinimo: 10, activo: true, requiereReceta: false, sigtrazavet: false, principioActivo: '', costo, proveedor: 'Distribuidora Mascotas Sur (ejemplo)', codigoBarras: ean(cod), intervaloDias: null, v17: true });
        s.productos = (s.productos || []).concat([P('ps-hig-01', 'Shampoo hipoalergénico', 3500, 1700, '200000000901'), P('ps-hig-02', 'Shampoo neutro', 1800, 800, '200000000902')]);
        s.lotes = (s.lotes || []).concat([{ id: 'lt-v17-1', productoId: 'ps-hig-01', lote: 'SH2610', vence: null, cantidad: 30, ingreso: hoy }, { id: 'lt-v17-2', productoId: 'ps-hig-02', lote: 'SN2610', vence: null, cantidad: 40, ingreso: hoy }]);
        s.movimientos = (s.movimientos || []).concat(s.lotes.filter((l) => l.id.startsWith('lt-v17')).map((l) => ({ id: 'mv-' + l.id, productoId: l.productoId, loteId: l.id, tipo: 'ingreso', cantidad: l.cantidad, fecha: hoy + 'T10:00:00.000Z', usuario: 'u-adm', nota: 'Inventario inicial de peluquería' })));
        return s;
      },
      down(s) {
        ['pelServicios', 'pelRecursos', 'pelTurnos', 'pelFichas'].forEach((k) => delete s[k]);
        const ids = (s.productos || []).filter((p) => p.v17).map((p) => p.id);
        s.productos = (s.productos || []).filter((p) => !p.v17);
        s.lotes = (s.lotes || []).filter((l) => !ids.includes(l.productoId));
        s.movimientos = (s.movimientos || []).filter((m) => !ids.includes(m.productoId));
        return s;
      },
    },
    {
      de: 17, a: 18, descripcion: 'Control de calidad: clase real confirmada, hallazgos codificados y veterinario por id en cada evaluación',
      up(s) {
        const CODIGOS = [[/cardio/i, 'TX-CAR-01'], [/intersticial/i, 'TX-PUL-01'], [/alveolar/i, 'TX-PUL-02'], [/bronquial/i, 'TX-PUL-03'], [/efusi|derrame/i, 'TX-PLE-01'], [/neumot/i, 'TX-PLE-02'], [/masa|n[oó]dulo/i, 'TX-PUL-04'], [/edema/i, 'TX-PUL-05'], [/megaes/i, 'TX-MED-02'], [/traque/i, 'TX-VIA-01']];
        const vets = s.usuarios || [];
        s.evaluaciones = (s.evaluaciones || []).map((q) => {
          const cod = CODIGOS.filter(([re]) => re.test(q.correccion || '')).map(([, c]) => c);
          const real = q.veredicto === 'coincide' && q.ia !== 'incierto' ? q.ia : q.veredicto === 'corrige' ? 'patologico' : null;
          const hall = cod.length ? cod : real === 'normal' ? ['TX-00'] : [];
          return Object.assign({ claseReal: real, hallazgos: hall, vetId: (vets.find((u) => u.nombre === q.vet) || {}).id || null }, q);
        });
        return s;
      },
      down(s) {
        s.evaluaciones = (s.evaluaciones || []).map((q) => { const c = Object.assign({}, q); delete c.claseReal; delete c.hallazgos; delete c.vetId; return c; });
        return s;
      },
    },
    {
      de: 18, a: 19, descripcion: 'ARCION Pet: historial de conversaciones por usuario',
      up(s) { s.arcionConversaciones = []; return s; },
      down(s) { delete s.arcionConversaciones; return s; },
    },
    {
      de: 19, a: 20, descripcion: 'Banco de sangre: grupo sanguíneo de los pacientes, registro de transfusiones y solicitudes a la red',
      up(s) {
        const GRUPO = { p2: 'Tipo A', p4: 'DEA 1.1 −' };
        s.pacientes = s.pacientes.map((p) => Object.assign({ grupoSanguineo: GRUPO[p.id] || null }, p));
        // las transfusiones ya registradas como evento pasan a tener su ficha
        s.hemoTransfusiones = [];
        (s.hemo || []).filter((u) => u.estado === 'transfundida' && u.pacienteId).forEach((u, i) => {
          const ev = (u.eventos || []).find((e) => e.tipo === 'transfusion') || {};
          s.hemoTransfusiones.push({ id: 'tx' + (i + 1), unidadId: u.id, pacienteId: u.pacienteId, fecha: ev.fecha || u.vence, comp: u.comp, especie: u.especie, grupoUnidad: u.grupo, volumen: u.volumen, pruebaCruzada: 'compatible', compatibilidad: 'ok', reaccion: 'ninguna', reaccionDetalle: '', premedicacion: '', veterinario: '', nota: ev.texto || '', origen: 'historico' });
        });
        s.hemoSolicitudes = [];
        return s;
      },
      down(s) {
        s.pacientes = s.pacientes.map((p) => { const c = Object.assign({}, p); delete c.grupoSanguineo; return c; });
        delete s.hemoTransfusiones; delete s.hemoSolicitudes;
        return s;
      },
    },
    {
      de: 20, a: 21, descripcion: 'Aliados: directorio de servicios de terceros, verificación, recomendaciones al tutor y valoraciones',
      up(s) {
        const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d.toISOString(); };
        const doc = (detalle, venceDias) => ({ detalle, vence: venceDias == null ? null : dia(venceDias).slice(0, 10) });
        const AL = (id, nombre, tipo, zona, n, extra) => Object.assign({ id, nombre, tipo, zona, telefono: '11 5555-01' + n, email: 'contacto' + n + '@example.com', horarios: 'Lunes a viernes de 8 a 18', especies: ['Canino'], tamanos: ['chico', 'mediano', 'grande'], condiciones: [], precioDesde: null, precioDetalle: '', acuerdoComercial: '', fotos: [], documentos: {}, estado: 'pendiente', origen: 'clinica', creado: dia(-90) }, extra);
        s.aliados = [
          AL('al1', 'Paseos Palermo (ejemplo)', 'paseador', 'Palermo', '01', { condiciones: ['senior', 'reactivo'], precioDesde: 6000, precioDetalle: 'por paseo de una hora', documentos: { seguro: doc('Póliza RC 0001 (ejemplo)', 200), referencias: doc('3 referencias de tutores verificadas') }, estado: 'verificado', verificacion: { fecha: dia(-60), por: 'u-adm' } }),
          AL('al2', 'Guardería Patitas (ejemplo)', 'guarderia', 'Belgrano', '02', { tamanos: ['chico', 'mediano'], condiciones: ['cachorro', 'medicacion'], precioDesde: 15000, precioDetalle: 'por día', acuerdoComercial: '10 % de descuento para pacientes de la clínica', documentos: { habilitacion: doc('Habilitación municipal 123/2025 (ejemplo)', 300), seguro: doc('Póliza RC 0002 (ejemplo)', 120) }, estado: 'verificado', verificacion: { fecha: dia(-45), por: 'u-adm' } }),
          AL('al3', 'Hotel Michi Feliz (ejemplo)', 'hotel', 'Caballito', '03', { especies: ['Felino', 'Canino'], tamanos: ['chico'], condiciones: ['senior', 'medicacion'], precioDesde: 18000, precioDetalle: 'por noche', horarios: 'Todos los días, ingresos de 9 a 20', documentos: { habilitacion: doc('Habilitación municipal 456/2024 (ejemplo)', 150), seguro: doc('Póliza RC 0003 (ejemplo)', 90) }, estado: 'verificado', verificacion: { fecha: dia(-30), por: 'u-adm' } }),
          AL('al4', 'Traslados Mascota Segura (ejemplo)', 'transporte', 'CABA y zona norte', '04', { especies: ['Canino', 'Felino'], tamanos: ['chico', 'mediano', 'grande', 'gigante'], condiciones: ['post_quirurgico', 'senior'], precioDesde: 9000, precioDetalle: 'por viaje dentro de CABA', documentos: { habilitacion: doc('Habilitación de transporte (ejemplo)', 400) } }),
          AL('al5', 'Adiestramiento Positivo (ejemplo)', 'adiestrador', 'Núñez', '05', { condiciones: ['reactivo', 'cachorro'], precioDesde: 20000, precioDetalle: 'por clase', documentos: { seguro: doc('Póliza RC 0005 (ejemplo)', 100), referencias: doc('Referencias de 2 clínicas') }, estado: 'suspendido', suspension: { fecha: dia(-10), por: 'u-adm', motivo: 'Dos quejas de tutores en revisión' } }),
          AL('alr1', 'Cuidadores Norte (ejemplo)', 'cuidador', 'Vicente López', '06', { especies: ['Canino', 'Felino'], condiciones: ['senior', 'medicacion', 'post_quirurgico'], precioDesde: 12000, precioDetalle: 'por visita', documentos: { seguro: doc('Póliza RC 0006 (ejemplo)', 250), referencias: doc('Referencias verificadas por la sede') }, estado: 'verificado', origen: 'red', sede: 'Clínica Norte (EISPLUS)' }),
        ];
        const pac = (id) => (s.pacientes || []).find((p) => p.id === id);
        s.aliadoRecomendaciones = [];
        if (pac('p5')) s.aliadoRecomendaciones.push({ id: 'ar1', fecha: dia(-20), pacienteId: 'p5', tutorId: pac('p5').tutorId, aliadoId: 'al1', motivo: 'Paseos tranquilos y cortos por su cardiopatía.', canal: 'whatsapp', texto: '', por: 'u-vet', concretada: true, fechaConcretada: dia(-15), valoracion: { puntaje: 5, comentario: 'Muy atento con Rocky.', fecha: dia(-8) }, consentimiento: { otorgado: true, fecha: dia(-20), medio: 'verbal', alcance: 'Nombre de la mascota y que necesita paseos cortos', registradoPor: 'u-vet' }, compartidos: [] });
        if (pac('p4')) s.aliadoRecomendaciones.push({ id: 'ar2', fecha: dia(-5), pacienteId: 'p4', tutorId: pac('p4').tutorId, aliadoId: 'al2', motivo: 'Guardería durante la recuperación, con seguimiento.', canal: 'email', texto: '', por: 'u-vet', concretada: false, valoracion: null, consentimiento: null, compartidos: [] });
        return s;
      },
      down(s) { delete s.aliados; delete s.aliadoRecomendaciones; return s; },
    },
    {
      de: 21, a: 22, descripcion: 'Recordatorios a tutores: consentimiento (Ley 25.326), reglas de la clínica, cola de envíos y calendario de salud de ejemplo',
      up(s) {
        const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
        const CONS = { t1: { consentimiento: true, fecha: hace(120), medio: 'escrito', canales: ['email', 'whatsapp'], baja: null }, t2: { consentimiento: true, fecha: hace(60), medio: 'verbal', canales: ['email'], baja: null } };
        s.tutores = s.tutores.map((t) => Object.assign({ recordatorios: CONS[t.id] || { consentimiento: false, fecha: null, medio: null, canales: ['email'], baja: null } }, t));
        s.config = Object.assign({}, s.config, { recordatorios: {
          anticipacionDias: [15, 7, 1], turnoHoras: [48, 2], canales: { email: true, whatsapp: false, sms: false }, whatsappPlantillasAprobadas: false,
          horario: { desde: '09:00', hasta: '20:00' }, reintentos: { max: 3, esperaMin: 30 }, urlPortal: 'https://portal.example.com/arcionpet', proveedorEmail: '',
        } });
        s.recordatorios = [];
        const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
        const pac = (id) => (s.pacientes || []).some((p) => p.id === id);
        const items = [
          ['cs-v22-1', 'p1', 'fa-vac-02', 'Vacuna antirrábica', 'Vacunas', 6],
          ['cs-v22-2', 'p3', 'fa-anti-01', 'Antiparasitario interno', 'Antiparasitarios', 2],
          ['cs-v22-3', 'p5', null, 'Control cardiológico', 'Control', 12],
        ].filter((x) => pac(x[1])).map(([id, pacienteId, productoId, nombre, categoria, d]) => ({ id, pacienteId, productoId, nombre, categoria, fecha: dia(d), origen: 'ejemplo', estado: 'pendiente', creado: hace(1) }));
        s.calendarioSalud = (s.calendarioSalud || []).concat(items);
        return s;
      },
      down(s) {
        s.tutores = s.tutores.map((t) => { const c = Object.assign({}, t); delete c.recordatorios; return c; });
        s.config = Object.assign({}, s.config); delete s.config.recordatorios;
        delete s.recordatorios;
        s.calendarioSalud = (s.calendarioSalud || []).filter((c) => !String(c.id).startsWith('cs-v22-'));
        return s;
      },
    },
  ];

  const VERSION_BASE = PASOS[0].de;
  const VERSION_ACTUAL = PASOS[PASOS.length - 1].a;

  /* Sube el estado hasta la versión pedida (por defecto, la actual). */
  function migrar(estado, hasta) {
    const destino = hasta == null ? VERSION_ACTUAL : hasta;
    let s = clonar(estado);
    if (s.version < VERSION_BASE) throw new Error('Versión ' + s.version + ' anterior al sistema de migraciones');
    if (s.version > destino) throw new Error('Versión ' + s.version + ' más nueva que la destino ' + destino);
    while (s.version < destino) {
      const paso = PASOS.find((p) => p.de === s.version);
      if (!paso) throw new Error('No hay migración desde la versión ' + s.version);
      s = paso.up(s);
      s.version = paso.a;
    }
    return s;
  }

  /* Baja el estado hasta la versión pedida aplicando los down en orden inverso. */
  function revertir(estado, hasta) {
    let s = clonar(estado);
    if (hasta < VERSION_BASE) throw new Error('No se puede revertir antes de la versión ' + VERSION_BASE);
    while (s.version > hasta) {
      const paso = PASOS.find((p) => p.a === s.version);
      if (!paso) throw new Error('No hay reversión desde la versión ' + s.version);
      s = paso.down(s);
      s.version = paso.de;
    }
    return s;
  }

  return { migrar, revertir, PASOS, VERSION_BASE, VERSION_ACTUAL, USUARIOS_DEMO, VERSIONES_MODELO };
});

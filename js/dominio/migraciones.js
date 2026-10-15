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

  return { migrar, revertir, PASOS, VERSION_BASE, VERSION_ACTUAL, USUARIOS_DEMO };
});

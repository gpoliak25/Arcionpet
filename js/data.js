/* Datos semilla de la demo. Las fechas son relativas a "hoy" para que la demo siempre se vea vigente. */
(function () {
  const pad = (n) => String(n).padStart(2, '0');
  function D(offsetDays, hh, mm) {
    const d = new Date();
    d.setHours(hh == null ? 10 : hh, mm == null ? 0 : mm, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  }
  function birth(years, months) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setMonth(d.getMonth() - (months || 0));
    return d.toISOString().slice(0, 10);
  }

  const VET = 'Dra. Laura Giménez';

  const tutores = [
    { id: 't1', nombre: 'Ana', apellido: 'López', doc: '30.456.789', tel: '11 5555-1234', email: 'ana.lopez@mail.com' },
    { id: 't2', nombre: 'Sofía', apellido: 'Martínez', doc: '28.111.222', tel: '11 4444-9876', email: 'sofia.martinez@mail.com' },
    { id: 't3', nombre: 'Carlos', apellido: 'Pérez', doc: '25.987.654', tel: '11 6666-4321', email: 'carlos.perez@mail.com' },
    { id: 't4', nombre: 'Julián', apellido: 'Romero', doc: '33.222.111', tel: '11 3333-1122', email: 'julian.romero@mail.com' },
  ];

  const pacientes = [
    { id: 'p1', nombre: 'Luna', especie: 'Canino', raza: 'Bulldog Francés', nacimiento: birth(4), sexo: 'Hembra', peso: 11.2, tutorId: 't1', origen: 'clinica' },
    { id: 'p2', nombre: 'Michi', especie: 'Felino', raza: 'Persa', nacimiento: birth(6), sexo: 'Hembra', peso: 4.1, tutorId: 't2', origen: 'clinica' },
    { id: 'p3', nombre: 'Milo', especie: 'Felino', raza: 'Siamés', nacimiento: birth(1, 2), sexo: 'Macho', peso: 3.8, tutorId: 't1', origen: 'clinica' },
    { id: 'p4', nombre: 'Pelusa', especie: 'Canino', raza: 'Mestizo', nacimiento: birth(0, 10), sexo: 'Hembra', peso: 7.5, tutorId: 't3', origen: 'clinica' },
    { id: 'p5', nombre: 'Rocky', especie: 'Canino', raza: 'Doberman', nacimiento: birth(8), sexo: 'Macho', peso: 38, tutorId: 't3', origen: 'red' },
    { id: 'p6', nombre: 'Toby', especie: 'Canino', raza: 'Ovejero Alemán', nacimiento: birth(12), sexo: 'Macho', peso: 34, tutorId: 't2', origen: 'clinica' },
  ];

  /* Pacientes disponibles en la red EISPLUS (otras clínicas) que se pueden incorporar */
  const redPacientes = [
    { id: 'r1', nombre: 'Kira', especie: 'Canino', raza: 'Labrador', nacimiento: birth(5), sexo: 'Hembra', peso: 29, tutor: { nombre: 'Julián', apellido: 'Romero', doc: '33.222.111' }, clinica: 'Vet. San Roque (EISPLUS)' },
    { id: 'r2', nombre: 'Simba', especie: 'Felino', raza: 'Mestizo', nacimiento: birth(3), sexo: 'Macho', peso: 5.2, tutor: { nombre: 'Lucía', apellido: 'Fernández', doc: '35.789.012' }, clinica: 'Clínica Norte (EISPLUS)' },
    { id: 'r3', nombre: 'Bruno', especie: 'Canino', raza: 'Golden Retriever', nacimiento: birth(9), sexo: 'Macho', peso: 32, tutor: { nombre: 'Martín', apellido: 'Sosa', doc: '22.345.678' }, clinica: 'Hospital Veterinario Central (EISPLUS)' },
  ];

  const turnos = [
    { id: 'tu1', pacienteId: 'p1', fecha: D(-1, 14, 0), tipo: 'Consulta general', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu2', pacienteId: 'p3', fecha: D(-1, 11, 0), tipo: 'Vacunación', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu3', pacienteId: 'p1', fecha: D(-4, 10, 0), tipo: 'Radiografía', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu4', pacienteId: 'p6', fecha: D(0, 16, 30), tipo: 'Control post-estudio', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu5', pacienteId: 'p2', fecha: D(0, 18, 0), tipo: 'Radiografía', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu6', pacienteId: 'p5', fecha: D(2, 9, 30), tipo: 'Control cardiológico', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu7', pacienteId: 'p4', fecha: D(3, 12, 0), tipo: 'Control de fractura', estado: 'pendiente', origen: 'portal', nota: 'Pedido desde el Portal Cliente: "¿Pueden ver a Pelusa a la mañana?"' },
    { id: 'tu8', pacienteId: 'p3', fecha: D(9, 17, 0), tipo: 'Castración', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu9', pacienteId: 'p1', fecha: D(15, 10, 0), tipo: 'Control respiratorio', estado: 'confirmado', origen: 'clinica' },
    { id: 'tu10', pacienteId: 'p6', fecha: D(-20, 10, 0), tipo: 'Consulta traumatológica', estado: 'atendido', origen: 'clinica' },
  ];

  const estudios = [
    { id: 'e1', pacienteId: 'p1', fecha: D(0, 9, 15), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Dolor abdominal; control de tórax.', imagenRef: 'ok-07', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e2', pacienteId: 'p1', fecha: D(-5, 11, 0), tipo: 'Tórax', proyeccion: 'VD', motivo: 'Dolor abdominal y tos ocasional.', imagenRef: 'ok-13', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e3', pacienteId: 'p4', fecha: D(-6, 10, 30), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Disnea aguda tras caída de altura.', imagenRef: 'patologica-23', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e4', pacienteId: 'p2', fecha: D(-6, 12, 0), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Tos crónica y pérdida de peso en gata adulta.', imagenRef: 'patologica-01', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e5', pacienteId: 'p6', fecha: D(-6, 15, 0), tipo: 'Tórax', proyeccion: 'LL izquierda', motivo: 'Tos y respiración ruidosa en perro geriátrico.', imagenRef: 'patologica-14', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e6', pacienteId: 'p3', fecha: D(-36, 9, 0), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Chequeo prequirúrgico (castración); sin signos respiratorios.', imagenRef: 'ok-23', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e7', pacienteId: 'p6', fecha: D(-36, 11, 0), tipo: 'Tórax', proyeccion: 'VD', motivo: 'Control geriátrico; hallazgo dudoso en lóbulo craneal.', imagenRef: 'patologica-04', resultado: null, confianza: null, hallazgos: [], derivado: true },
    { id: 'e8', pacienteId: 'p5', fecha: D(-37, 16, 0), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Tos y disnea de esfuerzo en paciente con cardiopatía conocida.', imagenRef: 'patologica-08', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e9', pacienteId: 'p1', fecha: D(-67, 10, 0), tipo: 'Tórax', proyeccion: 'VD', motivo: 'Respiración ruidosa; descartar compromiso de vías bajas.', imagenRef: 'ok-18', resultado: null, confianza: null, hallazgos: [], derivado: false },
    { id: 'e10', pacienteId: 'p5', fecha: D(-128, 10, 0), tipo: 'Tórax', proyeccion: 'LL derecha', motivo: 'Control inicial de cardiopatía; disnea leve.', imagenRef: 'patologica-16', resultado: null, confianza: null, hallazgos: [], derivado: false },
  ];

  const informes = [
    { id: 'i1', estudioId: 'e2', fecha: D(0, 9, 40), estado: 'borrador', nivel: 'baja', texto: null },
    { id: 'i2', estudioId: 'e4', fecha: D(-5, 13, 0), estado: 'borrador', nivel: 'media', texto: null },
    { id: 'i3', estudioId: 'e8', fecha: D(-6, 8, 30), estado: 'borrador', nivel: 'alta', texto: null },
  ];

  const derivaciones = [
    { id: 'd1', estudioId: 'e7', fecha: D(-6, 9, 0), motivo: 'Resultado incierto: ¿masa/nódulo vs. patrón intersticial crónico? Solicito segunda lectura.', de: VET, a: null, estado: 'pendiente', respuesta: null },
  ];

  const interconsultas = [
    { id: 'ic1', asunto: 'Luna: manejo de síndrome braquicefálico', pacienteId: 'p1', estado: 'cerrada', urgente: false, soporte: 'Dr. Andrés Molina', actualizada: D(-6, 13, 30),
      mensajes: [
        { de: VET, rol: 'me', fecha: D(-7, 10, 0), texto: 'Luna presenta ronquidos y episodios de intolerancia al ejercicio. ¿Recomiendan evaluación quirúrgica?' },
        { de: 'Dr. Andrés Molina', rol: 'support', fecha: D(-6, 13, 30), texto: 'Sugiero evaluar narinas estenóticas y paladar elongado. Si se confirma, la corrección quirúrgica temprana mejora el pronóstico. Cierro la consulta; cualquier novedad abrí una nueva.' },
      ] },
    { id: 'ic2', asunto: 'Rocky: ajuste de furosemida', pacienteId: 'p5', estado: 'curso', urgente: false, soporte: 'Dra. Paula Ferrari', actualizada: D(-6, 13, 30),
      mensajes: [
        { de: VET, rol: 'me', fecha: D(-6, 11, 0), texto: 'Rocky persiste con disnea de esfuerzo con 2 mg/kg c/12h. ¿Subo dosis o agrego otro diurético?' },
        { de: 'Dra. Paula Ferrari', rol: 'support', fecha: D(-6, 13, 30), texto: 'Antes de subir, controlá función renal y electrolitos. Si están bien, podés pasar a c/8h. Mandame los valores cuando los tengas.' },
      ] },
    { id: 'ic3', asunto: 'Toby: ¿masa mediastínica o superposición?', pacienteId: 'p6', estado: 'cola', urgente: true, soporte: null, actualizada: D(-6, 13, 30), mensajes: [
        { de: VET, rol: 'me', fecha: D(-6, 13, 30), texto: 'En la LL izquierda veo una opacidad craneal que podría ser superposición. ¿Pueden revisar las imágenes?' },
      ] },
  ];

  const pack = { nombre: 'Pack 100', total: 100, usadas: 36 };

  /* Evaluaciones de concordancia IA–veterinario (control de calidad) */
  const evaluaciones = [
    { id: 'q1', estudioId: 'e9', fecha: D(-66, 12, 0), ia: 'normal', veredicto: 'coincide', correccion: null, vet: VET },
    { id: 'q2', estudioId: 'e10', fecha: D(-127, 12, 0), ia: 'normal', veredicto: 'corrige', correccion: 'Cardiopatía (falso negativo de la IA)', vet: VET },
    { id: 'q3', estudioId: 'e7', fecha: D(-35, 12, 0), ia: 'incierto', veredicto: 'corrige', correccion: 'Patrón intersticial', vet: VET },
  ];

  /* Consolidado de hemocomponentes de la red */
  function ev(off, tipo, texto, lugar) { return { fecha: D(off, 10, 0), tipo, texto, lugar }; }
  const BANCO = 'Banco de sangre EISPLUS';
  const hemo = [
    { id: 'HC-0412', comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 250, donante: 'Thor (Canino)', ubicacion: 'Esta clínica', extraccion: D(-12), vence: D(23), estado: 'disponible', pacienteId: null,
      eventos: [ev(-12, 'extraccion', 'Extracción a donante Thor', BANCO), ev(-12, 'proceso', 'Fraccionado y etiquetado', BANCO), ev(-10, 'traslado', 'Recepción en heladera 2–6 °C', 'Esta clínica')] },
    { id: 'HC-0413', comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 +', volumen: 250, donante: 'Nala (Canino)', ubicacion: 'Esta clínica', extraccion: D(-38), vence: D(4), estado: 'disponible', pacienteId: null,
      eventos: [ev(-38, 'extraccion', 'Extracción a donante Nala', BANCO), ev(-38, 'proceso', 'Fraccionado y etiquetado', BANCO), ev(-35, 'traslado', 'Recepción en heladera 2–6 °C', 'Esta clínica')] },
    { id: 'HC-0420', comp: 'Plasma fresco congelado', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 200, donante: 'Thor (Canino)', ubicacion: 'Esta clínica', extraccion: D(-12), vence: D(353), estado: 'disponible', pacienteId: null,
      eventos: [ev(-12, 'extraccion', 'Extracción a donante Thor', BANCO), ev(-12, 'proceso', 'Separación y congelado a −18 °C', BANCO), ev(-10, 'traslado', 'Recepción en freezer', 'Esta clínica')] },
    { id: 'HC-0398', comp: 'Sangre entera', especie: 'Felino', grupo: 'Tipo A', volumen: 50, donante: 'Garfield (Felino)', ubicacion: 'Esta clínica', extraccion: D(-30), vence: D(5), estado: 'reservada', pacienteId: 'p2',
      eventos: [ev(-30, 'extraccion', 'Extracción a donante Garfield', BANCO), ev(-28, 'traslado', 'Recepción en heladera 2–6 °C', 'Esta clínica'), ev(-2, 'reserva', 'Reservada para Michi (prueba cruzada compatible)', 'Esta clínica')] },
    { id: 'HC-0377', comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 250, donante: 'Rex (Canino)', ubicacion: 'Esta clínica', extraccion: D(-40), vence: D(2), estado: 'disponible', pacienteId: null,
      eventos: [ev(-40, 'extraccion', 'Extracción a donante Rex', BANCO), ev(-40, 'proceso', 'Fraccionado y etiquetado', BANCO), ev(-37, 'traslado', 'Recepción en heladera 2–6 °C', 'Esta clínica')] },
    { id: 'HC-0350', comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 250, donante: 'Kaiser (Canino)', ubicacion: 'Esta clínica', extraccion: D(-21), vence: D(14), estado: 'transfundida', pacienteId: 'p4',
      eventos: [ev(-21, 'extraccion', 'Extracción a donante Kaiser', BANCO), ev(-19, 'traslado', 'Recepción en heladera 2–6 °C', 'Esta clínica'), ev(-7, 'reserva', 'Reservada para Pelusa', 'Esta clínica'), ev(-6, 'transfusion', 'Transfundida a Pelusa (cirugía por ruptura diafragmática)', 'Esta clínica')] },
    { id: 'HC-0341', comp: 'Plaquetas', especie: 'Canino', grupo: 'DEA 1.1 +', volumen: 60, donante: 'Lola (Canino)', ubicacion: 'Esta clínica', extraccion: D(-9), vence: D(-4), estado: 'vencida', pacienteId: null,
      eventos: [ev(-9, 'extraccion', 'Extracción a donante Lola', BANCO), ev(-9, 'traslado', 'Recepción a 22 °C en agitación', 'Esta clínica'), ev(-4, 'vencimiento', 'Unidad vencida sin uso', 'Esta clínica')] },
    { id: 'HC-0431', comp: 'Glóbulos rojos', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 250, donante: 'Bobby (Canino)', ubicacion: 'Clínica Norte (EISPLUS)', extraccion: D(-5), vence: D(30), estado: 'disponible', pacienteId: null,
      eventos: [ev(-5, 'extraccion', 'Extracción a donante Bobby', BANCO), ev(-5, 'proceso', 'Fraccionado y etiquetado', BANCO), ev(-4, 'traslado', 'Recepción en heladera 2–6 °C', 'Clínica Norte (EISPLUS)')] },
    { id: 'HC-0433', comp: 'Plasma fresco congelado', especie: 'Felino', grupo: 'Tipo A', volumen: 40, donante: 'Tom (Felino)', ubicacion: 'Hospital Veterinario Central (EISPLUS)', extraccion: D(-60), vence: D(305), estado: 'disponible', pacienteId: null,
      eventos: [ev(-60, 'extraccion', 'Extracción a donante Tom', BANCO), ev(-60, 'proceso', 'Separación y congelado a −18 °C', BANCO), ev(-58, 'traslado', 'Recepción en freezer', 'Hospital Veterinario Central (EISPLUS)')] },
    { id: 'HC-0440', comp: 'Sangre entera', especie: 'Felino', grupo: 'Tipo B', volumen: 50, donante: 'Luz (Felino)', ubicacion: BANCO, extraccion: D(-3), vence: D(32), estado: 'disponible', pacienteId: null,
      eventos: [ev(-3, 'extraccion', 'Extracción a donante Luz', BANCO), ev(-3, 'proceso', 'Etiquetado y almacenamiento', BANCO)] },
    { id: 'HC-0445', comp: 'Plaquetas', especie: 'Canino', grupo: 'DEA 1.1 −', volumen: 60, donante: 'Thor (Canino)', ubicacion: BANCO, extraccion: D(-1), vence: D(4), estado: 'disponible', pacienteId: null,
      eventos: [ev(-1, 'extraccion', 'Extracción a donante Thor', BANCO), ev(-1, 'proceso', 'Concentrado plaquetario a 22 °C', BANCO)] },
  ];

  window.SEED = {
    version: 8,
    usuario: { nombre: 'Laura', completo: VET, rol: 'Veterinario/a' },
    tutores, pacientes, redPacientes, turnos, estudios, informes, derivaciones, interconsultas, pack, evaluaciones, hemo,
    leidas: [],
  };
})();

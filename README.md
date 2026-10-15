# ArcionPet · Demo

Demo navegable de **ArcionPet: Datos e IA para la nueva Veterinaria**, construida a partir de la presentación `ArcionPet.pptx`.

## Cómo abrirla

Abrí `index.html` con doble clic (Chrome o Edge). No necesita instalación, servidor ni internet.

Los cambios que hagas durante la demo se guardan en el navegador. Para volver a los datos de ejemplo, tocá el ícono ⟲ junto a "Dra. Laura Giménez", abajo a la izquierda.

## Qué incluye (según la presentación)

| Diapositiva | Módulo en la demo |
|---|---|
| 4 · Inicio | Prioridades del día, agenda de hoy, estudios recientes, cupo de soporte |
| 6 · Pacientes y turnos | Alta/edición, búsqueda por mascota, raza, tutor o documento, **Buscar en la red** EISPLUS, tutores · **Calendario por recurso** (profesionales, salas, equipos) con servicios de duración y precio, horarios libres y detección de conflictos; al cargar un estudio, el turno de imágenes del día se cierra solo; "Atendido" registra la vacuna o el antiparasitario aplicado (stock, ficha clínica y próximo refuerzo) y pasa a cobrar; **Portal Cliente**: elegir servicio y horario, ver el estado, cancelar y reprogramar |
| — · Tutores | Ficha con contacto, mascotas a cargo, historial de turnos y compras; alta con validación de DNI/CUIT/pasaporte; baja lógica |
| — · Inventario | Pet shop (alimentos, correas y accesorios, ropa, juguetes) y farmacia (antiparasitarios, medicamentos, vacunas, insumos): stock por lotes, mínimo con alerta, vencimientos a 30 días, ingreso de mercadería, ajustes sin stock negativo y declaraciones SIGTRAZAVET pendientes (Res. SENASA 654/2026, art. 12) con declaración jurada. Costo, proveedor y margen; código de barras EAN-13; sugerencia de reposición; historial de movimientos; botiquín de autoconsumo del veterinario (art. 20) con registro en la ficha clínica |
| — · Ventas | Punto de venta con lector de código de barras, tutor o consumidor final (los productos bajo receta exigen tutor y mascota), medios de pago QR, transferencia, efectivo, crédito y débito, descuento de stock FEFO y comprobante. Productos bajo receta solo contra una **RVE** vigente (Res. SENASA 654/2026: CUVE, datos del art. 18 d, 30 días, una sola dispensa) o entrega desde botiquín del veterinario (art. 20). Caja con apertura, ingresos y retiros y cierre con arqueo. Factura electrónica A, B o C con CAE y punto de venta (en **homologación**: sin validez fiscal). Devoluciones parciales o totales con nota de crédito, reintegro en caja y reposición al lote (solo administración). Las vacunas y antiparasitarios vendidos o aplicados agendan la próxima dosis |
| 7 · Imágenes | Carga de radiografía (subida o del conjunto de test del TP) → la **CNN** la clasifica Normal / Incierto / Patológico con su probabilidad, y muestra el Grad-CAM |
| 8 · Triage | Urgente / A revisar, estado del informe y días de espera |
| 9 · Informes | Borrador generado por IA, editable, que solo pasa a firmado cuando el veterinario lo revisa y lo firma |
| 10 · Red EISPLUS | Derivaciones para segunda lectura · Interconsultas con cupo mensual (Pack 100) y conversación con soporte |
| 11 · Control de calidad | Concordancia IA–vet, correcciones, exportación del dataset en CSV/JSON |
| 12 · Analítica | Actividad, resultados de la IA, estudios por mes, hallazgos frecuentes |
| — · Modelo CNN | Los 3 modelos del TP evaluados en vivo sobre el test (AUC, ROC, matrices de confusión, aciertos y errores por imagen) y reentrenamiento de la capa final con radiografías de la clínica |
| 13 · ARCION | Asistente (botón flotante y página propia): dudas de uso y consultas de pacientes, turnos y stock |
| 14 · Hemocomponentes | Vista unificada de la red, disponibilidad por tipo y grupo, alertas de vencimiento, trazabilidad de cada unidad del donante al paciente |

## Guion sugerido (≈ 8 minutos)

1. **Inicio**: "Tenés N cosas que necesitan tu atención". Mostrar las prioridades del día.
2. **Estudios → Nuevo estudio**: elegir una radiografía del conjunto de test. La CNN la analiza y devuelve su probabilidad de patología; tocar **Ver Grad-CAM** y comparar con la etiqueta real.
3. **Generar borrador con IA** → editar una línea → **Revisar y firmar** → elegir "Corrijo el resultado".
4. **Control de calidad**: aparece la nueva evaluación; descargar el **CSV**.
5. **Triage**: ordenado por prioridad; abrir un estudio *Incierto* y **Derivar a especialista**. En **Derivaciones**, tocar *Simular respuesta*.
6. **Interconsultas → Nueva interconsulta**: baja el cupo, y a los pocos segundos responde el soporte.
7. **Turnos → Portal Cliente**: el tutor elige servicio y horario, cancela o reprograma; el pedido llega a la clínica, que lo confirma.
8. **Hemocomponentes**: ver las alertas de vencimiento, abrir una unidad (trazabilidad) y **reservarla** para un paciente.
9. **ARCION**: "¿Qué turnos tengo hoy?", "Datos de Rocky", "Stock de plasma felino", "¿Cómo firmo un informe?".
10. **Modelo CNN**: comparar los tres modelos del TP evaluados en vivo y ver los errores imagen por imagen.
11. **Analítica**: los indicadores reflejan lo que se hizo durante la demo.

## Notas

- El diagnóstico lo hace una **red neuronal convolucional real** sobre los píxeles de la radiografía: los modelos Keras del TP (`transfer_mobilenetv2`, `transfer_fase1`, `cnn_desde_cero`) convertidos a TensorFlow.js y ejecutados en el navegador, con el mismo preprocesamiento de los notebooks (RGB 224×224). Por defecto se usa un **ensamble** de los dos MobileNetV2 del TP (fine-tuning + fase 1) con TTA de espejo, elegido por validación: en el test detecta 27 de 30 patológicas con el umbral 0,30 (el modelo original, 24).
- Umbrales sobre P(patológica): Normal < 20 % · Incierto 20–29 % · Patológico ≥ 30 %. El 30 % es el punto de operación que eligió el TP (recall 0,80).
- Los estudios de ejemplo usan radiografías del **conjunto de test** del TP (que los modelos no vieron), y muestran la etiqueta real para comparar. Hay aciertos, casos dudosos y un falso negativo (la cardiopatía de Rocky).
- Las respuestas de especialistas, del soporte y los pedidos del portal siguen simulados con botones.
- ARCION responde con datos reales de la demo, usando reconocimiento de intenciones local.
- Las fechas de los datos de ejemplo se calculan a partir del día de hoy, así la demo siempre se ve vigente.

## Modo demo (DEMO_MODE)

Está **apagado por defecto**. Con el modo apagado no se ven los controles de demostración (portal simulado, respuestas simuladas de especialistas y soporte, imágenes de validación con su etiqueta de referencia, "Reiniciar demo"). Para prenderlo, abrí `http://localhost:5173/?demo=1`; para apagarlo, `?demo=0`. Queda guardado en el navegador.

## Menú y Configuración

El menú se organiza en: Inicio · Clínica (Pacientes, Tutores) · Banco de sangre (Hemocomponentes) · Diagnóstico con IA (Imágenes, Triage, Informes, Derivaciones) · Inventario y ventas (Pet shop, Farmacia, Ventas, Recetas) · Servicios (Turnos) · Peluquería · Aliados · Red y gestión (Interconsultas, ARCION Pet, Control de calidad, Analítica, Modelo CNN) · Configuración.

**Configuración** (solo administración): datos de la clínica, usuarios y roles, umbrales de la IA y de avisos de vencimiento, SLA, módulos habilitados y flags (DEMO_MODE, compartir aliados con la red). Los módulos deshabilitados desaparecen del menú. Modelo CNN también es solo para administración. Todo cambio queda en la auditoría.

## Seguridad clínica

- La IA informa la **probabilidad de patología** (probabilidad de la clase patológica), no una "confianza" del modelo.
- Cada estudio guarda la **versión del modelo** con que se analizó. Cambiar el modelo activo no reanaliza estudios anteriores; solo administración puede hacerlo y queda en la **auditoría** (pantalla Modelo CNN).
- Al firmar un informe se **congelan** el resultado y la versión del modelo: no cambian aunque cambie el modelo activo, y el estudio ya no se puede volver a analizar.
- Alertas por **estudios contradictorios** (mismo paciente y día, uno Normal y otro Patológico) y por **demoras** respecto del SLA (Triage 24 h, Derivaciones 72 h, Interconsultas 48 h), con campo **Asignado a**.
- **Bajas lógicas**: pacientes, estudios y borradores no se borran; un estudio con informe firmado o derivación no se puede dar de baja.
- Alcance del modelo: **solo tórax de perro o gato**; se advierte al cargar un estudio de otra especie.

## Roles (demo)

Tocá el usuario abajo a la izquierda para cambiar de rol: **Veterinario/a**, **Recepción**, **Peluquería** o **Administración**. El menú, las rutas, el Inicio, las notificaciones y ARCION se adaptan a los permisos de cada rol (matriz en `js/dominio/permisos.js`). La firma de informes es exclusiva del veterinario. Son permisos de interfaz: sin backend no hay seguridad real.

## Receta veterinaria electrónica (Res. SENASA 654/2026)

El veterinario **emite** la RVE desde ArcionPet (firma con su matrícula). La conexión con SIGTRAZAVET depende de la especificación técnica de la DNSA, así que pasa por un adapter: con DEMO_MODE asigna un número simulado (`SIM-…`, sin validez); sin DEMO_MODE la receta queda **pendiente de integración** y no habilita la venta hasta cargar el CUVE que devuelva el sistema oficial. También se pueden **registrar** RVE emitidas en SIGTRAZAVET o SIGTrámites copiando su CUVE. Las operaciones que hay que declarar (ventas con RVE en tiempo real, contingencias a 10 días, anulaciones a 20 días) quedan como pendientes en Inventario hasta cargar el número de operación.

## Facturación electrónica

El tipo de comprobante sale de la condición frente al IVA de la clínica y del cliente (responsable inscripto: A a responsables inscriptos, B al resto; monotributo o exento: C). Hasta definir el proveedor (ARCA directo o un intermediario) y cargar sus credenciales, la emisión usa un **adapter de homologación**: CAE simulado y la leyenda "HOMOLOGACIÓN · sin validez fiscal" en cada comprobante. Los puntos de venta se configuran en Configuración → Facturación.

## Datos y migraciones

Los datos viven en el navegador (`localStorage`, clave `arcionpet-demo`) con un número de versión de esquema. Al abrir una versión nueva de la app, los datos se **migran** (`js/dominio/migraciones.js`) y antes se guarda una copia intacta en `arcionpet-demo:backup:v<versión>`. Cada migración tiene vuelta atrás. Desde la consola del navegador:

- `Store.A.revertirA(8)`: revierte el esquema a la versión 8.
- `Store.A.restaurarBackup('v8')`: restaura la copia guardada antes de migrar.

## Tests

```
npm test
```

Usa el runner de Node (sin dependencias). Cubre migraciones (ida y vuelta sin pérdida de datos), permisos, tutores, stock y vencimientos (lotes, mínimos, FEFO, sin stock negativo, todo o nada, fechas locales) y ventas con receta electrónica (vigencia, titular y animal, cantidades, una sola dispensa, botiquín, anulación, devoluciones y declaraciones SIGTRAZAVET), facturación (tipos A/B/C, numeración, notas de crédito), caja (arqueo), emisión de RVE y turnos (conflictos por recurso, horario, transiciones, reprogramación, horarios libres, vínculo con estudios y cobro de servicios).

## Estructura

```
tests/            tests de la lógica de negocio
index.html        estructura (el menú en 5 áreas plegables se arma en js/app.js)
css/styles.css    estilos (mismo look que las capturas de la presentación)
js/data.js        datos de ejemplo
js/dominio/       lógica de negocio pura (migraciones, permisos, tutores, inventario, ventas), testeada con node --test
js/store.js       estado, persistencia, migraciones y métricas
js/cnn.js         carga de los modelos, inferencia, Grad-CAM, evaluación y reentrenamiento
js/model/         modelos del TP convertidos a TensorFlow.js + conjunto de test (incrustados para funcionar sin servidor)
js/vendor/        TensorFlow.js 4.22
js/ui.js          íconos, modales, avisos y visor de radiografías
js/vistas/        pantallas, un archivo por área (comun, inicio, clinica, diagnostico, inventario, ventas, servicios, red)
js/arcion.js      asistente ARCION
js/app.js         navegación y notificaciones
```

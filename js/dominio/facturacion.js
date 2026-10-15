/* Facturación electrónica (ARCA, ex AFIP). Funciones puras y un adapter intercambiable.
   - Tipo de comprobante según la condición frente al IVA de la clínica (emisor) y del cliente:
       emisor Responsable inscripto → A a Responsable inscripto; B al resto.
       emisor Monotributo o Exento → C.
   - Los precios de venta incluyen IVA (21 %). La factura A discrimina neto e IVA.
   - Adapter: hoy hay una implementación de HOMOLOGACIÓN SIMULADA (sin validez fiscal). El proveedor real se integra
     implementando la misma interfaz { nombre, modo, emitir(datos) → { cae, caeVto, numero } }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dominio = Object.assign(root.Dominio || {}, { facturacion: factory() });
})(typeof self !== 'undefined' ? self : this, function () {
  const IVA = 0.21;
  const CONDICIONES_CLIENTE = ['Consumidor final', 'Responsable inscripto', 'Monotributo', 'Exento'];
  const CODIGOS = { A: { factura: 1, nc: 3 }, B: { factura: 6, nc: 8 }, C: { factura: 11, nc: 13 } }; // códigos ARCA

  class ErrorFactura extends Error {}

  function tipoComprobante(condicionEmisor, condicionCliente) {
    if (condicionEmisor === 'Responsable inscripto') return condicionCliente === 'Responsable inscripto' ? 'A' : 'B';
    return 'C';
  }
  const redondear = (n) => Math.round(n * 100) / 100;

  /* Neto, IVA y total a partir de importes con IVA incluido. */
  function importes(totalConIva, tipo) {
    if (tipo === 'C') return { neto: redondear(totalConIva), iva: 0, total: redondear(totalConIva) };
    const neto = redondear(totalConIva / (1 + IVA));
    return { neto, iva: redondear(totalConIva - neto), total: redondear(totalConIva) };
  }

  function validarCliente(tipo, cliente) {
    if (tipo === 'A' && String(cliente.cuit || '').replace(/\D/g, '').length !== 11) throw new ErrorFactura('La factura A requiere el CUIT del cliente (11 dígitos)');
    if (cliente.condicionIva && !CONDICIONES_CLIENTE.includes(cliente.condicionIva)) throw new ErrorFactura('Condición frente al IVA del cliente inválida');
  }

  /* Próximo número para un punto de venta y un código de comprobante. */
  const proximoNumero = (comprobantes, puntoVenta, codigo) => (comprobantes || []).filter((c) => c.puntoVenta === puntoVenta && c.codigo === codigo).reduce((m, c) => Math.max(m, c.numero), 0) + 1;
  const numeroFormateado = (c) => String(c.puntoVenta).padStart(5, '0') + '-' + String(c.numero).padStart(8, '0');

  /* Adapter de homologación simulada: devuelve un CAE de 14 dígitos con vencimiento a 10 días. */
  const adapterHomologacion = {
    nombre: 'Homologación simulada', modo: 'homologacion',
    emitir(datos) {
      let h = 0; const sem = datos.puntoVenta + '|' + datos.codigo + '|' + datos.numero + '|' + datos.total;
      for (const ch of sem) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const cae = '7' + String(h).padStart(10, '0').slice(0, 10) + String(datos.numero).padStart(3, '0').slice(-3);
      const vto = new Date(datos.fecha); vto.setDate(vto.getDate() + 10);
      return { cae, caeVto: vto.toISOString().slice(0, 10), numero: datos.numero };
    },
  };

  /* Arma y emite un comprobante (factura o nota de crédito). comprobantes: los ya emitidos (para la numeración). */
  function emitir({ clase, emisor, cliente, puntoVenta, totalConIva, items, fecha, ventaId, asociado }, comprobantes, adapter) {
    const tipo = asociado ? asociado.tipo : tipoComprobante(emisor.condicionIva, cliente.condicionIva || 'Consumidor final');
    validarCliente(tipo, cliente);
    if (!(totalConIva > 0)) throw new ErrorFactura('El importe debe ser mayor a cero');
    const codigo = CODIGOS[tipo][clase === 'nc' ? 'nc' : 'factura'];
    const numero = proximoNumero(comprobantes, puntoVenta, codigo);
    const imp = importes(totalConIva, tipo);
    const r = (adapter || adapterHomologacion).emitir({ puntoVenta, codigo, numero, total: imp.total, fecha });
    return {
      clase: clase === 'nc' ? 'nc' : 'factura', tipo, codigo, puntoVenta, numero: r.numero, cae: r.cae, caeVto: r.caeVto,
      fecha, ventaId, cliente: { nombre: cliente.nombre || 'Consumidor final', condicionIva: cliente.condicionIva || 'Consumidor final', cuit: cliente.cuit || '', doc: cliente.doc || '' },
      neto: imp.neto, iva: imp.iva, total: imp.total, items: items || [], asociado: asociado ? { tipo: asociado.tipo, puntoVenta: asociado.puntoVenta, numero: asociado.numero, codigo: asociado.codigo } : null,
      modo: (adapter || adapterHomologacion).modo,
    };
  }

  const etiqueta = (c) => (c.clase === 'nc' ? 'Nota de crédito ' : 'Factura ') + c.tipo + ' ' + numeroFormateado(c);

  return { IVA, CONDICIONES_CLIENTE, CODIGOS, ErrorFactura, tipoComprobante, importes, validarCliente, proximoNumero, numeroFormateado, adapterHomologacion, emitir, etiqueta };
});

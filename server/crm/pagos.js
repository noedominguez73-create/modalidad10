/**
 * Módulo de Gestión de Pagos
 * Match de pagos recibidos con clientes
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { obtenerClientes, obtenerClientePorId, registrarPagoCliente } from './clientes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', '..', 'database', 'clientes-prospectos.json');

// Cargar base de datos
function cargarDB() {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error cargando DB:', e.message);
  }
  return { prospectos: [], clientes: [], pagosRecibidos: [], pagosIMSS: [], verificacionesVigencia: [] };
}

// Guardar base de datos
function guardarDB(db) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error guardando DB:', e.message);
    return false;
  }
}

/**
 * Registrar pago recibido (antes de hacer match)
 */
export function registrarPagoRecibido(datosPago) {
  const {
    metodo,
    monto,
    moneda = 'USD',
    referencia = '',
    comprobante = null,
    nombreRemitente = '',
    emailRemitente = '',
    telefonoRemitente = '',
    notaRemitente = '',
    fechaPago = null
  } = datosPago;

  if (!metodo || !monto) {
    throw new Error('Método y monto son requeridos');
  }

  const db = cargarDB();

  const nuevoPago = {
    id: uuidv4(),
    fecha: fechaPago || new Date().toISOString(),
    fechaRegistro: new Date().toISOString(),

    // Datos del pago
    metodo,
    monto: parseFloat(monto),
    moneda,
    referencia,
    comprobante,

    // Identificación del remitente
    nombreRemitente: nombreRemitente.toUpperCase(),
    emailRemitente: emailRemitente.toLowerCase(),
    telefonoRemitente,
    notaRemitente,

    // Match
    clienteId: null,
    matched: false,
    matchedPor: null,
    fechaMatch: null,
    matchConfidencia: 0,
    candidatosMatch: [],

    // Procesamiento
    estatusProcesamiento: 'recibido',
    fechaPagoIMSS: null,
    referenciaIMSS: null,
    capturaComprobanteIMSS: null
  };

  // Intentar match automático
  const resultadoMatch = intentarMatchAutomatico(nuevoPago, db.clientes);

  if (resultadoMatch.matched) {
    nuevoPago.clienteId = resultadoMatch.clienteId;
    nuevoPago.matched = true;
    nuevoPago.matchedPor = 'automatico';
    nuevoPago.fechaMatch = new Date().toISOString();
    nuevoPago.matchConfidencia = resultadoMatch.confidencia;
    nuevoPago.estatusProcesamiento = 'matched_pendiente_confirmacion';
  } else {
    nuevoPago.candidatosMatch = resultadoMatch.candidatos;
  }

  db.pagosRecibidos.push(nuevoPago);
  guardarDB(db);

  return {
    pago: nuevoPago,
    matchAutomatico: resultadoMatch.matched,
    candidatos: resultadoMatch.candidatos
  };
}

/**
 * Intentar match automático
 */
function intentarMatchAutomatico(pago, clientes) {
  const candidatos = [];

  for (const cliente of clientes) {
    if (cliente.estatusServicio !== 'activo') continue;

    let puntuacion = 0;
    const razones = [];

    // 1. Match por monto exacto
    if (Math.abs(pago.monto - cliente.totalMensual) < 1) {
      puntuacion += 30;
      razones.push('Monto coincide');
    }

    // 2. Match por NSS en nota
    if (pago.notaRemitente && cliente.nss) {
      const nssCorto = cliente.nss.slice(-4);
      if (pago.notaRemitente.includes(cliente.nss) || pago.notaRemitente.includes(nssCorto)) {
        puntuacion += 40;
        razones.push('NSS en nota');
      }
    }

    // 3. Match por nombre
    if (pago.nombreRemitente && cliente.nombreCompleto) {
      const nombrePago = pago.nombreRemitente.toUpperCase();
      const nombreCliente = cliente.nombreCompleto.toUpperCase();

      // Nombre completo
      if (nombrePago === nombreCliente) {
        puntuacion += 35;
        razones.push('Nombre exacto');
      }
      // Nombre parcial (primer nombre y apellido)
      else {
        const partesPago = nombrePago.split(' ');
        const partesCliente = nombreCliente.split(' ');

        const coincidencias = partesPago.filter(p => partesCliente.includes(p));
        if (coincidencias.length >= 2) {
          puntuacion += 25;
          razones.push('Nombre parcial');
        }
      }
    }

    // 4. Match por email
    if (pago.emailRemitente && cliente.email) {
      if (pago.emailRemitente.toLowerCase() === cliente.email.toLowerCase()) {
        puntuacion += 35;
        razones.push('Email coincide');
      }
    }

    // 5. Match por teléfono
    if (pago.telefonoRemitente) {
      const telPago = pago.telefonoRemitente.replace(/\D/g, '');
      const telCliente = (cliente.whatsapp || cliente.telefonoUSA || '').replace(/\D/g, '');

      if (telPago && telCliente && (telPago.includes(telCliente.slice(-10)) || telCliente.includes(telPago.slice(-10)))) {
        puntuacion += 30;
        razones.push('Teléfono coincide');
      }
    }

    // 6. Match por método de pago preferido
    if (pago.metodo === cliente.metodoPagoPreferido) {
      puntuacion += 10;
      razones.push('Método preferido');
    }

    // 7. Match por datos de pago específicos
    if (pago.metodo === 'paypal' && pago.emailRemitente && cliente.datosPago.paypalEmail) {
      if (pago.emailRemitente.toLowerCase() === cliente.datosPago.paypalEmail.toLowerCase()) {
        puntuacion += 40;
        razones.push('Email PayPal registrado');
      }
    }

    if (pago.metodo === 'zelle') {
      if (pago.emailRemitente && cliente.datosPago.zelleEmail &&
        pago.emailRemitente.toLowerCase() === cliente.datosPago.zelleEmail.toLowerCase()) {
        puntuacion += 40;
        razones.push('Email Zelle registrado');
      }
      if (pago.telefonoRemitente && cliente.datosPago.zellePhone) {
        const telPago = pago.telefonoRemitente.replace(/\D/g, '');
        const telZelle = cliente.datosPago.zellePhone.replace(/\D/g, '');
        if (telPago.slice(-10) === telZelle.slice(-10)) {
          puntuacion += 40;
          razones.push('Teléfono Zelle registrado');
        }
      }
    }

    if (puntuacion > 0) {
      candidatos.push({
        clienteId: cliente.id,
        nombreCompleto: cliente.nombreCompleto,
        nss: cliente.nss,
        totalMensual: cliente.totalMensual,
        confidencia: Math.min(puntuacion, 100),
        razones
      });
    }
  }

  // Ordenar por puntuación
  candidatos.sort((a, b) => b.confidencia - a.confidencia);

  // Si hay un candidato con alta confidencia (>80%), es match automático
  if (candidatos.length > 0 && candidatos[0].confidencia >= 80) {
    return {
      matched: true,
      clienteId: candidatos[0].clienteId,
      confidencia: candidatos[0].confidencia,
      candidatos: candidatos.slice(0, 5)
    };
  }

  return {
    matched: false,
    candidatos: candidatos.slice(0, 5)
  };
}

/**
 * Match manual de pago con cliente
 */
export function matchManual(pagoId, clienteId) {
  const db = cargarDB();

  const pagoIndex = db.pagosRecibidos.findIndex(p => p.id === pagoId);
  if (pagoIndex === -1) {
    throw new Error('Pago no encontrado');
  }

  const cliente = db.clientes.find(c => c.id === clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const pago = db.pagosRecibidos[pagoIndex];

  pago.clienteId = clienteId;
  pago.matched = true;
  pago.matchedPor = 'manual';
  pago.fechaMatch = new Date().toISOString();
  pago.matchConfidencia = 100;
  pago.estatusProcesamiento = 'matched';

  guardarDB(db);

  return { pago, cliente };
}

/**
 * Confirmar match y proceder
 */
export function confirmarMatch(pagoId) {
  const db = cargarDB();

  const pagoIndex = db.pagosRecibidos.findIndex(p => p.id === pagoId);
  if (pagoIndex === -1) {
    throw new Error('Pago no encontrado');
  }

  const pago = db.pagosRecibidos[pagoIndex];

  if (!pago.matched || !pago.clienteId) {
    throw new Error('El pago no tiene un cliente asignado');
  }

  pago.estatusProcesamiento = 'matched';
  pago.fechaConfirmacion = new Date().toISOString();

  // Registrar pago en el cliente
  registrarPagoCliente(pago.clienteId, {
    monto: pago.monto,
    moneda: pago.moneda,
    metodo: pago.metodo,
    referencia: pago.referencia,
    fechaPago: pago.fecha,
    comprobante: pago.comprobante
  });

  guardarDB(db);

  return pago;
}

/**
 * Marcar pago como procesado en IMSS
 */
export function marcarPagadoIMSS(pagoId, datosIMSS) {
  const {
    referenciaIMSS,
    fechaPagoIMSS,
    capturaComprobante = null,
    lineaCaptura = '',
    banco = ''
  } = datosIMSS;

  const db = cargarDB();

  const pagoIndex = db.pagosRecibidos.findIndex(p => p.id === pagoId);
  if (pagoIndex === -1) {
    throw new Error('Pago no encontrado');
  }

  const pago = db.pagosRecibidos[pagoIndex];

  pago.estatusProcesamiento = 'pagado_imss';
  pago.fechaPagoIMSS = fechaPagoIMSS || new Date().toISOString();
  pago.referenciaIMSS = referenciaIMSS;
  pago.capturaComprobanteIMSS = capturaComprobante;
  pago.lineaCaptura = lineaCaptura;
  pago.bancoIMSS = banco;

  // Registrar en pagos IMSS
  db.pagosIMSS.push({
    id: uuidv4(),
    pagoRecibidoId: pagoId,
    clienteId: pago.clienteId,
    fecha: pago.fechaPagoIMSS,
    periodo: obtenerPeriodoActual(),
    referenciaIMSS,
    lineaCaptura,
    banco,
    comprobante: capturaComprobante
  });

  guardarDB(db);

  return pago;
}

/**
 * Obtener pagos pendientes de match
 */
export function obtenerPagosPendientesMatch() {
  const db = cargarDB();
  return db.pagosRecibidos.filter(p => !p.matched || p.estatusProcesamiento === 'matched_pendiente_confirmacion');
}

/**
 * Obtener pagos matched pendientes de pago IMSS
 */
export function obtenerPagosPendientesIMSS() {
  const db = cargarDB();
  return db.pagosRecibidos.filter(p =>
    p.matched &&
    p.estatusProcesamiento === 'matched' &&
    !p.fechaPagoIMSS
  );
}

/**
 * Obtener historial de pagos
 */
export function obtenerHistorialPagos(filtros = {}) {
  const db = cargarDB();
  let pagos = [...db.pagosRecibidos];

  if (filtros.clienteId) {
    pagos = pagos.filter(p => p.clienteId === filtros.clienteId);
  }

  if (filtros.metodo) {
    pagos = pagos.filter(p => p.metodo === filtros.metodo);
  }

  if (filtros.estatus) {
    pagos = pagos.filter(p => p.estatusProcesamiento === filtros.estatus);
  }

  if (filtros.fechaDesde) {
    const desde = new Date(filtros.fechaDesde);
    pagos = pagos.filter(p => new Date(p.fecha) >= desde);
  }

  if (filtros.fechaHasta) {
    const hasta = new Date(filtros.fechaHasta);
    pagos = pagos.filter(p => new Date(p.fecha) <= hasta);
  }

  // Ordenar por fecha (más recientes primero)
  pagos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return pagos;
}

/**
 * Estadísticas de pagos
 */
export function obtenerEstadisticasPagos() {
  const db = cargarDB();
  const pagos = db.pagosRecibidos;

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const esteMes = pagos.filter(p => new Date(p.fecha) >= inicioMes);

  const porMetodo = {};
  const porEstatus = {};
  let totalRecibidoMes = 0;
  let totalPagadoIMSSMes = 0;

  esteMes.forEach(p => {
    porMetodo[p.metodo] = (porMetodo[p.metodo] || 0) + 1;
    porEstatus[p.estatusProcesamiento] = (porEstatus[p.estatusProcesamiento] || 0) + 1;
    totalRecibidoMes += p.monto;

    if (p.estatusProcesamiento === 'pagado_imss') {
      totalPagadoIMSSMes += p.monto;
    }
  });

  return {
    totalPagos: pagos.length,
    pagosMes: esteMes.length,
    pendientesMatch: obtenerPagosPendientesMatch().length,
    pendientesIMSS: obtenerPagosPendientesIMSS().length,
    totalRecibidoMes,
    totalPagadoIMSSMes,
    porMetodo,
    porEstatus
  };
}

// Función auxiliar para obtener periodo actual (YYYYMM)
function obtenerPeriodoActual() {
  const hoy = new Date();
  const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
  return `${hoy.getFullYear()}${mes}`;
}

export default {
  registrarPagoRecibido,
  matchManual,
  confirmarMatch,
  marcarPagadoIMSS,
  obtenerPagosPendientesMatch,
  obtenerPagosPendientesIMSS,
  obtenerHistorialPagos,
  obtenerEstadisticasPagos
};

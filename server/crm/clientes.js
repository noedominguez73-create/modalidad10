/**
 * Módulo de Gestión de Clientes
 * Sistema CRM para clientes IMSS en Estados Unidos
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { obtenerProspectoPorId, actualizarProspecto } from './prospectos.js';

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
 * Convertir prospecto a cliente
 */
export function convertirProspectoACliente(prospectoId, datosServicio) {
  const {
    modalidad,
    salarioRegistrado,
    incluirInfonavit = false,
    zona = 'general',
    metodoPagoPreferido,
    datosPago = {},
    cuotaMensual,
    cuotaServicio = 15,
    fechaCorte = 15
  } = datosServicio;

  // Obtener prospecto
  const prospecto = obtenerProspectoPorId(prospectoId);
  if (!prospecto) {
    throw new Error('Prospecto no encontrado');
  }

  // Validar datos requeridos
  if (!prospecto.nss) {
    throw new Error('El prospecto debe tener NSS para convertirse en cliente');
  }

  if (!prospecto.curp) {
    throw new Error('El prospecto debe tener CURP para convertirse en cliente');
  }

  if (!modalidad) {
    throw new Error('Debe especificar la modalidad del servicio');
  }

  if (!metodoPagoPreferido) {
    throw new Error('Debe especificar el método de pago preferido');
  }

  const db = cargarDB();

  // Verificar que no exista ya como cliente
  const clienteExistente = db.clientes.find(c => c.nss === prospecto.nss);
  if (clienteExistente) {
    throw new Error(`Ya existe un cliente con NSS ${prospecto.nss}`);
  }

  // Calcular cuota total
  const totalMensual = (cuotaMensual || 0) + cuotaServicio;

  // Calcular fechas del ciclo
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();

  // Próxima fecha de corte
  let proximoCorte = new Date(anioActual, mesActual, fechaCorte);
  if (proximoCorte <= hoy) {
    proximoCorte.setMonth(proximoCorte.getMonth() + 1);
  }

  const nuevoCliente = {
    id: uuidv4(),
    prospectoId,
    fechaAlta: new Date().toISOString(),

    // Datos del prospecto
    nombreCompleto: prospecto.nombreCompleto,
    curp: prospecto.curp,
    nss: prospecto.nss,
    fechaNacimiento: prospecto.fechaNacimiento,
    telefonoUSA: prospecto.telefonoUSA,
    telefonoMexico: prospecto.telefonoMexico,
    whatsapp: prospecto.whatsapp,
    email: prospecto.email,
    direccionUSA: prospecto.direccionUSA,
    contactoMexico: prospecto.contactoMexico,

    // Servicio contratado
    modalidad,
    salarioRegistrado: salarioRegistrado || 0,
    incluirInfonavit,
    zona,

    // Cuotas
    cuotaIMSS: cuotaMensual || 0,
    cuotaServicio,
    totalMensual,
    moneda: 'USD',

    // Fechas de ciclo
    fechaCorte,
    fechaLimitePagoCliente: fechaCorte - 5,
    fechaPagoIMSS: fechaCorte + 2,
    proximoCorte: proximoCorte.toISOString(),

    // Pagos
    metodoPagoPreferido,
    datosPago: {
      paypalEmail: datosPago.paypalEmail || '',
      zellePhone: datosPago.zellePhone || '',
      zelleEmail: datosPago.zelleEmail || '',
      venmoUser: datosPago.venmoUser || '',
      cuentaMexico: datosPago.cuentaMexico || ''
    },

    // Estatus
    estatusServicio: 'activo',
    estatusPagoActual: 'pendiente',
    mesActualPagado: false,

    // Vigencia IMSS
    vigenciaIMSS: {
      ultimaVerificacion: null,
      vigente: false,
      fechaVigenciaHasta: null,
      clinicaAsignada: null,
      capturaVigencia: null
    },

    // Historial
    historialPagos: [],
    historialRenovaciones: [],
    historialVigencias: [],
    notas: []
  };

  db.clientes.push(nuevoCliente);

  // Actualizar estatus del prospecto
  const prospectoIndex = db.prospectos.findIndex(p => p.id === prospectoId);
  if (prospectoIndex !== -1) {
    db.prospectos[prospectoIndex].estatus = 'convertido';
    db.prospectos[prospectoIndex].fechaConversion = new Date().toISOString();
  }

  guardarDB(db);

  return nuevoCliente;
}

/**
 * Crear cliente directo (sin prospecto previo)
 */
export function crearCliente(datos) {
  const {
    nombreCompleto,
    curp,
    nss,
    fechaNacimiento,
    telefonoUSA,
    whatsapp,
    email,
    modalidad,
    salarioRegistrado,
    incluirInfonavit = false,
    zona = 'general',
    metodoPagoPreferido,
    datosPago = {},
    cuotaMensual,
    cuotaServicio = 15
  } = datos;

  // Validaciones
  if (!nombreCompleto || !curp || !nss) {
    throw new Error('Nombre, CURP y NSS son requeridos');
  }

  if (!modalidad || !metodoPagoPreferido) {
    throw new Error('Modalidad y método de pago son requeridos');
  }

  const db = cargarDB();

  // Verificar que no exista
  if (db.clientes.find(c => c.nss === nss)) {
    throw new Error(`Ya existe un cliente con NSS ${nss}`);
  }

  const totalMensual = (cuotaMensual || 0) + cuotaServicio;
  const hoy = new Date();
  const fechaCorte = 15;

  let proximoCorte = new Date(hoy.getFullYear(), hoy.getMonth(), fechaCorte);
  if (proximoCorte <= hoy) {
    proximoCorte.setMonth(proximoCorte.getMonth() + 1);
  }

  const nuevoCliente = {
    id: uuidv4(),
    prospectoId: null,
    fechaAlta: new Date().toISOString(),

    nombreCompleto: nombreCompleto.toUpperCase(),
    curp: curp.toUpperCase(),
    nss,
    fechaNacimiento,
    telefonoUSA,
    telefonoMexico: null,
    whatsapp: whatsapp || telefonoUSA,
    email: email ? email.toLowerCase() : null,
    direccionUSA: { calle: '', ciudad: '', estado: '', zipCode: '' },
    contactoMexico: { nombre: '', telefono: '', parentesco: '' },

    modalidad,
    salarioRegistrado: salarioRegistrado || 0,
    incluirInfonavit,
    zona,

    cuotaIMSS: cuotaMensual || 0,
    cuotaServicio,
    totalMensual,
    moneda: 'USD',

    fechaCorte,
    fechaLimitePagoCliente: fechaCorte - 5,
    fechaPagoIMSS: fechaCorte + 2,
    proximoCorte: proximoCorte.toISOString(),

    metodoPagoPreferido,
    datosPago,

    estatusServicio: 'activo',
    estatusPagoActual: 'pendiente',
    mesActualPagado: false,

    vigenciaIMSS: {
      ultimaVerificacion: null,
      vigente: false,
      fechaVigenciaHasta: null,
      clinicaAsignada: null,
      capturaVigencia: null
    },

    historialPagos: [],
    historialRenovaciones: [],
    historialVigencias: [],
    notas: []
  };

  db.clientes.push(nuevoCliente);
  guardarDB(db);

  return nuevoCliente;
}

/**
 * Obtener todos los clientes
 */
export function obtenerClientes(filtros = {}) {
  const db = cargarDB();
  let clientes = [...db.clientes];

  if (filtros.estatus) {
    clientes = clientes.filter(c => c.estatusServicio === filtros.estatus);
  }

  if (filtros.modalidad) {
    clientes = clientes.filter(c => c.modalidad === filtros.modalidad);
  }

  if (filtros.estatusPago) {
    clientes = clientes.filter(c => c.estatusPagoActual === filtros.estatusPago);
  }

  // Ordenar por próximo corte
  clientes.sort((a, b) => new Date(a.proximoCorte) - new Date(b.proximoCorte));

  return clientes;
}

/**
 * Obtener cliente por ID
 */
export function obtenerClientePorId(id) {
  const db = cargarDB();
  return db.clientes.find(c => c.id === id) || null;
}

/**
 * Buscar cliente por NSS, teléfono o nombre
 */
export function buscarCliente(termino) {
  const db = cargarDB();
  const terminoLimpio = termino.replace(/\D/g, '');
  const terminoUpper = termino.toUpperCase();

  return db.clientes.filter(c =>
    (c.nss && c.nss.includes(terminoLimpio)) ||
    (c.telefonoUSA && c.telefonoUSA.includes(terminoLimpio)) ||
    (c.whatsapp && c.whatsapp.includes(terminoLimpio)) ||
    (c.nombreCompleto && c.nombreCompleto.includes(terminoUpper)) ||
    (c.email && c.email.toLowerCase().includes(termino.toLowerCase()))
  );
}

/**
 * Actualizar cliente
 */
export function actualizarCliente(id, datos) {
  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === id);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  db.clientes[index] = {
    ...db.clientes[index],
    ...datos,
    fechaActualizacion: new Date().toISOString()
  };

  guardarDB(db);
  return db.clientes[index];
}

/**
 * Obtener clientes con pago pendiente
 */
export function obtenerClientesPagoPendiente() {
  const db = cargarDB();
  const hoy = new Date();

  return db.clientes.filter(c => {
    if (c.estatusServicio !== 'activo') return false;
    if (c.mesActualPagado) return false;

    const proximoCorte = new Date(c.proximoCorte);
    const diasParaCorte = Math.ceil((proximoCorte - hoy) / (1000 * 60 * 60 * 24));

    // Incluir si faltan 10 días o menos para el corte
    return diasParaCorte <= 10;
  }).sort((a, b) => new Date(a.proximoCorte) - new Date(b.proximoCorte));
}

/**
 * Obtener clientes que necesitan verificación de vigencia
 */
export function obtenerClientesPendientesVerificacion() {
  const db = cargarDB();
  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  return db.clientes.filter(c => {
    if (c.estatusServicio !== 'activo') return false;

    // Si nunca se ha verificado
    if (!c.vigenciaIMSS.ultimaVerificacion) return true;

    // Si la última verificación fue hace más de 30 días
    const ultimaVerificacion = new Date(c.vigenciaIMSS.ultimaVerificacion);
    return ultimaVerificacion < hace30Dias;
  });
}

/**
 * Registrar pago del cliente
 */
export function registrarPagoCliente(clienteId, datosPago) {
  const {
    monto,
    moneda = 'USD',
    metodo,
    referencia,
    fechaPago,
    comprobante = null
  } = datosPago;

  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === clienteId);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  const cliente = db.clientes[index];
  const periodo = obtenerPeriodoActual();

  const pago = {
    id: uuidv4(),
    fecha: fechaPago || new Date().toISOString(),
    periodo,
    monto,
    moneda,
    metodo,
    referencia,
    comprobante,
    estatus: 'recibido',
    fechaRegistro: new Date().toISOString()
  };

  cliente.historialPagos.push(pago);
  cliente.estatusPagoActual = 'recibido';
  cliente.mesActualPagado = true;

  guardarDB(db);

  return { cliente, pago };
}

/**
 * Actualizar vigencia IMSS del cliente
 */
export function actualizarVigencia(clienteId, datosVigencia) {
  const {
    vigente,
    fechaVigenciaHasta,
    clinicaAsignada,
    capturaVigencia,
    detalles = {}
  } = datosVigencia;

  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === clienteId);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  const cliente = db.clientes[index];

  // Actualizar vigencia actual
  cliente.vigenciaIMSS = {
    ultimaVerificacion: new Date().toISOString(),
    vigente,
    fechaVigenciaHasta,
    clinicaAsignada,
    capturaVigencia
  };

  // Agregar al historial
  cliente.historialVigencias.push({
    fecha: new Date().toISOString(),
    vigente,
    fechaVigenciaHasta,
    clinicaAsignada,
    detalles
  });

  guardarDB(db);

  return cliente;
}

/**
 * Avanzar ciclo mensual del cliente
 */
export function avanzarCicloMensual(clienteId) {
  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === clienteId);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  const cliente = db.clientes[index];

  // Calcular nuevo ciclo
  const proximoCorteActual = new Date(cliente.proximoCorte);
  proximoCorteActual.setMonth(proximoCorteActual.getMonth() + 1);

  // Registrar renovación
  cliente.historialRenovaciones.push({
    fecha: new Date().toISOString(),
    periodoAnterior: cliente.proximoCorte,
    periodoPago: cliente.mesActualPagado ? 'pagado' : 'no_pagado'
  });

  // Actualizar ciclo
  cliente.proximoCorte = proximoCorteActual.toISOString();
  cliente.mesActualPagado = false;
  cliente.estatusPagoActual = 'pendiente';

  guardarDB(db);

  return cliente;
}

/**
 * Suspender servicio de cliente
 */
export function suspenderServicio(clienteId, motivo = '') {
  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === clienteId);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  db.clientes[index].estatusServicio = 'suspendido';
  db.clientes[index].fechaSuspension = new Date().toISOString();
  db.clientes[index].motivoSuspension = motivo;

  guardarDB(db);

  return db.clientes[index];
}

/**
 * Reactivar servicio de cliente
 */
export function reactivarServicio(clienteId) {
  const db = cargarDB();
  const index = db.clientes.findIndex(c => c.id === clienteId);

  if (index === -1) {
    throw new Error('Cliente no encontrado');
  }

  db.clientes[index].estatusServicio = 'activo';
  db.clientes[index].fechaReactivacion = new Date().toISOString();

  guardarDB(db);

  return db.clientes[index];
}

/**
 * Estadísticas de clientes
 */
export function obtenerEstadisticasClientes() {
  const db = cargarDB();
  const clientes = db.clientes;

  const activos = clientes.filter(c => c.estatusServicio === 'activo').length;
  const suspendidos = clientes.filter(c => c.estatusServicio === 'suspendido').length;
  const pagoPendiente = obtenerClientesPagoPendiente().length;
  const verificacionPendiente = obtenerClientesPendientesVerificacion().length;

  const porModalidad = {};
  const ingresosMensuales = { USD: 0 };

  clientes.filter(c => c.estatusServicio === 'activo').forEach(c => {
    porModalidad[c.modalidad] = (porModalidad[c.modalidad] || 0) + 1;
    ingresosMensuales.USD += c.totalMensual;
  });

  return {
    total: clientes.length,
    activos,
    suspendidos,
    pagoPendiente,
    verificacionPendiente,
    porModalidad,
    ingresosMensuales
  };
}

// Función auxiliar para obtener periodo actual (YYYYMM)
function obtenerPeriodoActual() {
  const hoy = new Date();
  const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
  return `${hoy.getFullYear()}${mes}`;
}

export default {
  convertirProspectoACliente,
  crearCliente,
  obtenerClientes,
  obtenerClientePorId,
  buscarCliente,
  actualizarCliente,
  obtenerClientesPagoPendiente,
  obtenerClientesPendientesVerificacion,
  registrarPagoCliente,
  actualizarVigencia,
  avanzarCicloMensual,
  suspenderServicio,
  reactivarServicio,
  obtenerEstadisticasClientes
};

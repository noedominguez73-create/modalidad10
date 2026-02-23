/**
 * Módulo de Notificaciones
 * Mensajes de WhatsApp y plantillas para clientes
 */

import { obtenerClientesPagoPendiente, obtenerClientePorId } from './clientes.js';

/**
 * Plantillas de mensajes
 */
export const PLANTILLAS = {
  // Recordatorio de pago
  recordatorioPago: (cliente, diasRestantes) => {
    const emoji = diasRestantes <= 3 ? '⚠️' : '📅';
    return `${emoji} ¡Hola ${cliente.nombreCompleto.split(' ')[0]}!

Se acerca la fecha de tu pago mensual de IMSS.

💰 Monto: $${cliente.totalMensual} USD
📅 Fecha límite: ${formatearFecha(cliente.proximoCorte)}
${diasRestantes <= 3 ? `⏰ Faltan solo ${diasRestantes} días` : ''}

Métodos de pago:
• PayPal: pagos@empresa.com
• Zelle: +1 XXX XXX XXXX

📝 Incluye tu nombre en la nota del pago.

¿Alguna duda? Responde este mensaje 👍`;
  },

  // Pago vencido
  pagoVencido: (cliente) => {
    return `🔴 ${cliente.nombreCompleto.split(' ')[0]}, tu pago de IMSS está vencido.

Tu servicio puede suspenderse si no recibimos el pago.

💰 Monto pendiente: $${cliente.totalMensual} USD

¿Necesitas ayuda con el pago? Responde:
1️⃣ Ya pagué (envía comprobante)
2️⃣ Pagaré hoy
3️⃣ Necesito pausar el servicio
4️⃣ Hablar con un asesor`;
  },

  // Confirmación de pago recibido
  pagoRecibido: (cliente, pago) => {
    return `✅ ¡Pago recibido!

Hola ${cliente.nombreCompleto.split(' ')[0]}, confirmamos tu pago:

💰 Monto: $${pago.monto} ${pago.moneda}
📅 Fecha: ${formatearFecha(pago.fecha)}
📱 Método: ${pago.metodo}

Procederemos a pagar tus cuotas IMSS y te notificaremos cuando tu seguro esté vigente.

¡Gracias por tu confianza! 🙏`;
  },

  // Pago IMSS procesado
  pagoIMSSProcesado: (cliente) => {
    return `✅ ¡Cuotas IMSS pagadas!

${cliente.nombreCompleto.split(' ')[0]}, tus cuotas del mes fueron pagadas correctamente.

Verificaremos tu vigencia y te enviaremos la confirmación.

📋 Modalidad: ${cliente.modalidad}
📅 Periodo: ${obtenerMesActual()}`;
  },

  // Vigencia confirmada
  vigenciaConfirmada: (cliente, vigencia) => {
    return `🎉 ¡${cliente.nombreCompleto.split(' ')[0]}, tu seguro IMSS está VIGENTE!

✅ NSS: ${cliente.nss}
✅ Modalidad: Modalidad ${cliente.modalidad}
✅ Vigente hasta: ${vigencia.fechaVigenciaHasta}
✅ Clínica: ${vigencia.clinicaAsignada || 'Por asignar'}

📋 Servicios disponibles:
• Consulta médica
• Hospitalización
• Medicamentos
• Urgencias

📎 Adjunto: Comprobante de vigencia

Próximo pago: ${formatearFecha(cliente.proximoCorte)}

¿Tienes alguna duda? Estoy para ayudarte 🤝`;
  },

  // Bienvenida nuevo cliente
  bienvenidaCliente: (cliente) => {
    return `🎉 ¡Bienvenido/a ${cliente.nombreCompleto.split(' ')[0]}!

Te has registrado exitosamente en nuestro servicio de pago de cuotas IMSS.

📋 Tu servicio:
• Modalidad: ${cliente.modalidad}
• Cuota mensual: $${cliente.totalMensual} USD
• Método de pago: ${cliente.metodoPagoPreferido}

📅 Calendario de pagos:
• Tu fecha de pago: día ${cliente.fechaLimitePagoCliente} de cada mes
• Nosotros pagamos al IMSS: día ${cliente.fechaPagoIMSS}

Para tu primer pago, envía $${cliente.totalMensual} USD a:
${obtenerInstruccionesPago(cliente.metodoPagoPreferido)}

¿Alguna duda? Estoy aquí para ayudarte 💪`;
  },

  // Solicitud de datos
  solicitudDatos: (datosRequeridos) => {
    let mensaje = `📝 Para completar tu registro, necesito los siguientes datos:\n\n`;

    if (datosRequeridos.includes('curp')) {
      mensaje += `• CURP (18 caracteres)\n`;
    }
    if (datosRequeridos.includes('nss')) {
      mensaje += `• NSS - Número de Seguro Social (11 dígitos)\n`;
    }
    if (datosRequeridos.includes('fechaNacimiento')) {
      mensaje += `• Fecha de nacimiento (DD/MM/AAAA)\n`;
    }

    mensaje += `\n¿No tienes tu NSS? Puedes consultarlo en:\n`;
    mensaje += `🔗 https://serviciosdigitales.imss.gob.mx/\n`;
    mensaje += `📱 App IMSS Digital\n`;

    return mensaje;
  },

  // Error en pago
  errorPago: (cliente, error) => {
    return `⚠️ ${cliente.nombreCompleto.split(' ')[0]}, hubo un problema con tu pago.

${error}

Por favor, verifica tu información de pago o contacta a tu banco.

¿Necesitas ayuda? Responde este mensaje.`;
  },

  // Confirmación de match
  confirmarMatch: (cliente, pago) => {
    return `💰 ¡Hola ${cliente.nombreCompleto.split(' ')[0]}!

Recibimos un pago por $${pago.monto} ${pago.moneda} vía ${pago.metodo}.

📋 Detalles:
• Referencia: ${pago.referencia || 'N/A'}
• Fecha: ${formatearFecha(pago.fecha)}

¿Confirmas que este pago es tuyo para el servicio IMSS de ${obtenerMesActual()}?

Responde:
✅ SÍ - Para proceder con el pago
❌ NO - Si no reconoces este pago`;
  }
};

/**
 * Obtener instrucciones de pago según método
 */
function obtenerInstruccionesPago(metodo) {
  const instrucciones = {
    paypal: `📧 PayPal: pagos@empresa.com
   (Enviar como "Amigos y familia")`,

    zelle: `📱 Zelle: +1 XXX XXX XXXX
   o email: pagos@empresa.com`,

    venmo: `📱 Venmo: @empresa-imss`,

    westernUnion: `💵 Western Union:
   Beneficiario: NOMBRE EMPRESA
   Ciudad: Ciudad, México
   Tel: +52 XXX XXX XXXX`,

    transferenciaMX: `🏦 Transferencia México:
   Banco: BBVA
   CLABE: XXXXXXXXXXXX`
  };

  return instrucciones[metodo] || instrucciones.paypal;
}

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
  const d = new Date(fecha);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Obtener mes actual en español
 */
function obtenerMesActual() {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[new Date().getMonth()];
}

/**
 * Generar recordatorios de pago pendiente
 */
export function generarRecordatoriosPago() {
  const clientesPendientes = obtenerClientesPagoPendiente();
  const recordatorios = [];

  const hoy = new Date();

  for (const cliente of clientesPendientes) {
    const proximoCorte = new Date(cliente.proximoCorte);
    const diasRestantes = Math.ceil((proximoCorte - hoy) / (1000 * 60 * 60 * 24));

    let mensaje;
    let prioridad;

    if (diasRestantes < 0) {
      mensaje = PLANTILLAS.pagoVencido(cliente);
      prioridad = 'urgente';
    } else if (diasRestantes <= 3) {
      mensaje = PLANTILLAS.recordatorioPago(cliente, diasRestantes);
      prioridad = 'alta';
    } else {
      mensaje = PLANTILLAS.recordatorioPago(cliente, diasRestantes);
      prioridad = 'normal';
    }

    recordatorios.push({
      clienteId: cliente.id,
      nombreCliente: cliente.nombreCompleto,
      whatsapp: cliente.whatsapp,
      mensaje,
      prioridad,
      diasRestantes,
      tipo: 'recordatorio_pago'
    });
  }

  // Ordenar por prioridad
  recordatorios.sort((a, b) => {
    const prioridadOrden = { urgente: 0, alta: 1, normal: 2 };
    return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
  });

  return recordatorios;
}

/**
 * Generar mensaje de bienvenida
 */
export function generarMensajeBienvenida(clienteId) {
  const cliente = obtenerClientePorId(clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  return {
    clienteId: cliente.id,
    whatsapp: cliente.whatsapp,
    mensaje: PLANTILLAS.bienvenidaCliente(cliente),
    tipo: 'bienvenida'
  };
}

/**
 * Generar mensaje de pago recibido
 */
export function generarMensajePagoRecibido(clienteId, pago) {
  const cliente = obtenerClientePorId(clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  return {
    clienteId: cliente.id,
    whatsapp: cliente.whatsapp,
    mensaje: PLANTILLAS.pagoRecibido(cliente, pago),
    tipo: 'pago_recibido'
  };
}

/**
 * Generar mensaje de vigencia confirmada
 */
export function generarMensajeVigencia(clienteId, vigencia) {
  const cliente = obtenerClientePorId(clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  return {
    clienteId: cliente.id,
    whatsapp: cliente.whatsapp,
    mensaje: PLANTILLAS.vigenciaConfirmada(cliente, vigencia),
    tipo: 'vigencia_confirmada',
    adjuntos: vigencia.capturaVigencia ? [vigencia.capturaVigencia] : []
  };
}

/**
 * Generar mensaje de confirmación de match
 */
export function generarMensajeConfirmarMatch(clienteId, pago) {
  const cliente = obtenerClientePorId(clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  return {
    clienteId: cliente.id,
    whatsapp: cliente.whatsapp,
    mensaje: PLANTILLAS.confirmarMatch(cliente, pago),
    tipo: 'confirmar_match',
    requiereRespuesta: true
  };
}

export default {
  PLANTILLAS,
  generarRecordatoriosPago,
  generarMensajeBienvenida,
  generarMensajePagoRecibido,
  generarMensajeVigencia,
  generarMensajeConfirmarMatch
};

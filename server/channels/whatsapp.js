/**
 * WHATSAPP - Integración via Twilio WhatsApp Business API
 * Soporta: texto, imágenes, documentos, ubicación
 */

import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Sandbox

let client = null;

// Sesiones de conversación (en producción usar Redis)
const sesiones = new Map();

export function initWhatsApp() {
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('✓ WhatsApp (Twilio) inicializado');
    return true;
  }
  console.log('⚠ WhatsApp no configurado');
  return false;
}

// Obtener o crear sesión de usuario
function obtenerSesion(telefono) {
  if (!sesiones.has(telefono)) {
    sesiones.set(telefono, {
      telefono,
      paso: 'inicio',
      datos: {},
      historial: [],
      ultimaActividad: Date.now()
    });
  }
  const sesion = sesiones.get(telefono);
  sesion.ultimaActividad = Date.now();
  return sesion;
}

// Webhook: Mensaje entrante de WhatsApp
export async function handleIncomingMessage(req, res, procesarConIA, validarDocumento) {
  const {
    From: telefono,
    Body: mensaje,
    MediaUrl0: mediaUrl,
    MediaContentType0: mediaType,
    NumMedia: numMedia
  } = req.body;

  const numeroLimpio = telefono.replace('whatsapp:', '');
  const sesion = obtenerSesion(numeroLimpio);

  console.log(`[WA ${numeroLimpio}] Mensaje: "${mensaje}" | Media: ${numMedia || 0}`);

  try {
    let respuesta;

    // Si envió un documento/imagen
    if (numMedia > 0 && mediaUrl) {
      console.log(`[WA ${numeroLimpio}] Documento recibido: ${mediaType}`);

      // Validar documento con IA
      const resultadoValidacion = await validarDocumento({
        url: mediaUrl,
        tipo: mediaType,
        telefono: numeroLimpio,
        sesion
      });

      respuesta = resultadoValidacion.mensaje;
      if (resultadoValidacion.datosExtraidos) {
        sesion.datos = { ...sesion.datos, ...resultadoValidacion.datosExtraidos };
      }
    } else {
      // Procesar mensaje de texto con IA
      const resultado = await procesarConIA(mensaje, {
        canal: 'whatsapp',
        telefono: numeroLimpio,
        sesion
      });

      respuesta = resultado.mensaje;
      if (resultado.nuevosDatos) {
        sesion.datos = { ...sesion.datos, ...resultado.nuevosDatos };
      }
      if (resultado.nuevoPaso) {
        sesion.paso = resultado.nuevoPaso;
      }
    }

    // Guardar en historial
    sesion.historial.push({ rol: 'usuario', mensaje, timestamp: Date.now() });
    sesion.historial.push({ rol: 'asistente', mensaje: respuesta, timestamp: Date.now() });

    // Enviar respuesta
    await enviarMensaje(telefono, respuesta);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en WhatsApp:', error);
    await enviarMensaje(telefono, 'Disculpa, tuve un problema. ¿Podrías intentar de nuevo?');
    res.status(200).send('OK');
  }
}

// Enviar mensaje de WhatsApp
export async function enviarMensaje(telefono, mensaje, opciones = {}) {
  if (!client) {
    throw new Error('WhatsApp no está configurado');
  }

  const numeroFormateado = telefono.startsWith('whatsapp:') ? telefono : `whatsapp:${telefono}`;

  const params = {
    from: WHATSAPP_NUMBER,
    to: numeroFormateado,
    body: mensaje
  };

  // Si hay imagen adjunta
  if (opciones.mediaUrl) {
    params.mediaUrl = [opciones.mediaUrl];
  }

  const msg = await client.messages.create(params);
  return msg.sid;
}

// Enviar mensaje con botones (template)
export async function enviarMensajeConBotones(telefono, mensaje, botones) {
  // Nota: Los botones interactivos requieren WhatsApp Business API aprobada
  // Por ahora, enviamos las opciones como texto
  let textoCompleto = mensaje + '\n\n';
  botones.forEach((btn, i) => {
    textoCompleto += `${i + 1}. ${btn.texto}\n`;
  });
  textoCompleto += '\n_Responde con el número de tu opción_';

  return enviarMensaje(telefono, textoCompleto);
}

// Enviar documento
export async function enviarDocumento(telefono, urlDocumento, caption = '') {
  return enviarMensaje(telefono, caption, { mediaUrl: urlDocumento });
}

// Limpiar sesiones inactivas (llamar periódicamente)
export function limpiarSesionesInactivas(maxInactividadMs = 3600000) { // 1 hora
  const ahora = Date.now();
  for (const [telefono, sesion] of sesiones) {
    if (ahora - sesion.ultimaActividad > maxInactividadMs) {
      sesiones.delete(telefono);
      console.log(`Sesión expirada: ${telefono}`);
    }
  }
}

// Obtener todas las sesiones activas
export function obtenerSesionesActivas() {
  return Array.from(sesiones.values());
}

export default {
  initWhatsApp,
  handleIncomingMessage,
  enviarMensaje,
  enviarMensajeConBotones,
  enviarDocumento,
  obtenerSesion,
  limpiarSesionesInactivas,
  obtenerSesionesActivas
};

/**
 * TWILIO VOICE - Llamadas telefónicas con IA
 * Integración con Whisper (STT) y OpenAI TTS
 */

import twilio from 'twilio';
import settings from '../settings.js';

// Cliente Twilio
let client = null;

// Obtener configuración actual
function getConfig() {
  return settings.obtenerTwilio();
}

export function initTwilio() {
  const config = getConfig();

  if (config.accountSid && config.authToken) {
    client = twilio(config.accountSid, config.authToken);
    console.log('✓ Twilio Voice inicializado');
    return true;
  }
  console.log('⚠ Twilio Voice no configurado (faltan credenciales)');
  return false;
}

// Generar TwiML para respuesta de voz
export function generarRespuestaVoz(mensaje, opciones = {}) {
  const config = getConfig();
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Configurar voz (español México)
  const sayOptions = {
    voice: opciones.voz || 'Polly.Mia', // Voz femenina española
    language: 'es-MX'
  };

  // Mensaje de bienvenida o respuesta
  response.say(sayOptions, mensaje);

  // Si necesita capturar entrada de voz
  if (opciones.esperarRespuesta) {
    response.gather({
      input: 'speech',
      language: 'es-MX',
      speechTimeout: 'auto',
      action: `${config.webhookBaseUrl}/api/twilio/procesar-voz`,
      method: 'POST'
    });
  }

  // Si necesita capturar dígitos (DTMF)
  if (opciones.esperarDigitos) {
    response.gather({
      input: 'dtmf',
      numDigits: opciones.numDigitos || 1,
      action: `${config.webhookBaseUrl}/api/twilio/procesar-digitos`,
      method: 'POST'
    });
  }

  return response.toString();
}

// Webhook: Llamada entrante
export function handleIncomingCall(req, res) {
  const twiml = generarRespuestaVoz(
    'Bienvenido al asesor de pensiones del IMSS. ' +
    'Soy una inteligencia artificial y te ayudaré a calcular tu Modalidad 40 o Modalidad 10. ' +
    '¿En qué puedo ayudarte hoy?',
    { esperarRespuesta: true }
  );

  res.type('text/xml');
  res.send(twiml);
}

// Webhook: Procesar voz del usuario
export async function handleVoiceInput(req, res, procesarConIA) {
  const speechResult = req.body.SpeechResult;
  const confidence = req.body.Confidence;
  const callSid = req.body.CallSid;

  console.log(`[CALL ${callSid}] Usuario dijo: "${speechResult}" (confianza: ${confidence})`);

  try {
    // Procesar con la IA
    const respuestaIA = await procesarConIA(speechResult, { canal: 'telefono', callSid });

    // Generar respuesta de voz
    const twiml = generarRespuestaVoz(respuestaIA.mensaje, {
      esperarRespuesta: !respuestaIA.finConversacion
    });

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error procesando voz:', error);
    const twiml = generarRespuestaVoz(
      'Disculpa, tuve un problema procesando tu solicitud. ¿Podrías repetirlo?',
      { esperarRespuesta: true }
    );
    res.type('text/xml');
    res.send(twiml);
  }
}

// Hacer llamada saliente
export async function hacerLlamada(numeroDestino, mensajeInicial) {
  if (!client) {
    throw new Error('Twilio no está configurado');
  }

  const config = getConfig();
  const call = await client.calls.create({
    twiml: generarRespuestaVoz(mensajeInicial, { esperarRespuesta: true }),
    to: numeroDestino,
    from: config.phoneNumber
  });

  return call.sid;
}

// Enviar SMS
export async function enviarSMS(numeroDestino, mensaje) {
  if (!client) {
    throw new Error('Twilio no está configurado');
  }

  const config = getConfig();
  const message = await client.messages.create({
    body: mensaje,
    to: numeroDestino,
    from: config.phoneNumber
  });

  return message.sid;
}

export default {
  initTwilio,
  generarRespuestaVoz,
  handleIncomingCall,
  handleVoiceInput,
  hacerLlamada,
  enviarSMS
};

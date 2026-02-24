/**
 * TWILIO VOICE - Llamadas telefónicas con IA
 * Integración con Whisper (STT) y OpenAI TTS
 */

import twilio from 'twilio';
import settings from '../settings.js';
import { appendFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_FILE = join(__dirname, '..', 'data', 'voice-debug.json');

// Helper para loguear a archivo
function logDebug(section, data) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      section,
      ...data
    };
    let logs = [];
    if (existsSync(LOG_FILE)) {
      try {
        logs = JSON.parse(readFileSync(LOG_FILE, 'utf8'));
      } catch (e) { logs = []; }
    }
    logs.push(entry);
    if (logs.length > 50) logs.shift(); // Mantener últimos 50
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Error escribiendo log de voz:', e);
  }
}

// Cliente Twilio
let client = null;

// Almacén de sesiones en memoria (para historial de voz)
const voiceSessions = new Map();

// Limpiar sesiones antiguas cada 30 minutos para ahorrar memoria
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of voiceSessions.entries()) {
    if (now - session.lastSeen > 1800000) { // 30 minutos
      voiceSessions.delete(sid);
    }
  }
}, 600000); // Revisar cada 10 minutos

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
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Configurar voz (español México)
  const sayOptions = {
    voice: opciones.voz || 'Polly.Mia', // Voz femenina española
    language: 'es-MX'
  };

  // Mensaje de bienvenida o respuesta
  response.say(sayOptions, mensaje);

  // Si necesita capturar entrada de voz - usar URL absoluta si está disponible
  if (opciones.esperarRespuesta) {
    const config = getConfig();
    const actionUrl = config.webhookBaseUrl
      ? (config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl.slice(0, -1) : config.webhookBaseUrl) + '/api/twilio/procesar-voz'
      : '/api/twilio/procesar-voz';

    response.gather({
      input: 'speech',
      language: 'es-MX',
      speechTimeout: 'auto',
      action: actionUrl,
      method: 'POST'
    });
    // Si no hablan, despedirse
    response.say(sayOptions, '¿Sigues ahí? Si necesitas ayuda, vuelve a llamar. Hasta luego.');
  }

  // Si necesita capturar dígitos (DTMF)
  if (opciones.esperarDigitos) {
    response.gather({
      input: 'dtmf',
      numDigits: opciones.numDigitos || 1,
      action: '/api/twilio/procesar-digitos',
      method: 'POST'
    });
  }

  return response.toString();
}

// Webhook: Llamada entrante
export function handleIncomingCall(req, res) {
  try {
    const { Called, Caller, CallSid } = req.body || {};
    console.log(`📞 [VOICE] Llamada entrante: ${Caller} -> ${Called}, SID: ${CallSid}`);

    // Inicializar sesión de voz con historial vacío
    voiceSessions.set(CallSid, {
      historial: [],
      lastSeen: Date.now(),
      caller: Caller
    });

    // Generar TwiML directamente (más confiable)
    const config = getConfig();
    const actionUrl = config.webhookBaseUrl
      ? (config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl.slice(0, -1) : config.webhookBaseUrl) + '/api/twilio/procesar-voz'
      : '/api/twilio/procesar-voz';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Bienvenido al asesor de pensiones del IMSS. Soy una inteligencia artificial y te ayudaré con tu Modalidad 40 o Modalidad 10. ¿En qué puedo ayudarte?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    <Say language="es-MX" voice="Polly.Mia">Te escucho.</Say>
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">No escuché nada. Si necesitas ayuda, vuelve a llamar. Hasta luego.</Say>
  <Hangup/>
</Response>`;

    // Loguear intento
    logDebug('incoming_call', { Caller, Called, CallSid });

    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('💥 Error crítico en handleIncomingCall:', err);
    logDebug('error_incoming', { error: err.message, stack: err.stack });
    res.status(500).send('Error interno');
  }
}

// Webhook: Procesar voz del usuario
export async function handleVoiceInput(req, res, procesarConIA) {
  const speechResult = req.body?.SpeechResult;
  const confidence = req.body?.Confidence;
  const callSid = req.body?.CallSid;

  console.log(`🎤 [VOICE] Usuario dijo: "${speechResult}" (confianza: ${confidence}, SID: ${callSid})`);

  // Recuperar o crear sesión
  let session = voiceSessions.get(callSid);
  if (!session) {
    session = { historial: [], lastSeen: Date.now() };
    voiceSessions.set(callSid, session);
  } else {
    session.lastSeen = Date.now();
  }

  // Si no se entendió nada
  if (!speechResult) {
    const config = getConfig();
    const actionUrl = config.webhookBaseUrl
      ? (config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl.slice(0, -1) : config.webhookBaseUrl) + '/api/twilio/procesar-voz'
      : '/api/twilio/procesar-voz';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">No pude entenderte. ¿Podrías repetirlo?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">Sigo sin escucharte. Hasta luego.</Say>
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  try {
    // Procesar con la IA incluyendo el historial de la sesión
    const respuestaIA = await procesarConIA(speechResult, {
      canal: 'telefono',
      callSid,
      sesion: {
        historial: session.historial
      }
    });

    // Actualizar historial en la sesión
    session.historial.push({ rol: 'usuario', mensaje: speechResult });
    session.historial.push({ rol: 'asistente', mensaje: respuestaIA.mensaje });

    // Mantener solo los últimos 10 mensajes para no saturar el prompt
    if (session.historial.length > 10) {
      session.historial = session.historial.slice(-10);
    }

    // Limpiar respuesta para voz (quitar markdown, emojis, etc.)
    let mensajeLimpio = respuestaIA.mensaje
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/[📊💰🎯📈⚠️✅❌📚📋🔍💼📞📱🤖1️⃣2️⃣3️⃣]/g, '')
      .trim();

    // Limitar longitud para voz
    if (mensajeLimpio.length > 500) {
      mensajeLimpio = mensajeLimpio.substring(0, 500) + '... ¿Te gustaría que te dé más detalles?';
    }

    console.log(`🤖 [VOICE] Respuesta IA: "${mensajeLimpio.substring(0, 100)}..."`);

    // Generar TwiML con respuesta
    const config = getConfig();
    const actionUrl = config.webhookBaseUrl
      ? (config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl.slice(0, -1) : config.webhookBaseUrl) + '/api/twilio/procesar-voz'
      : '/api/twilio/procesar-voz';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">${mensajeLimpio}</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">¿Hay algo más en lo que pueda ayudarte?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="3" action="${actionUrl}" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">Fue un placer ayudarte. Hasta luego.</Say>
  <Hangup/>
</Response>`;

    logDebug('voice_input', {
      callSid,
      userSaid: speechResult,
      aiResponded: respuestaIA.mensaje,
      canal: 'telefono'
    });

    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('❌ [VOICE] Error procesando voz:', error);
    logDebug('error_voice_input', { error: error.message, stack: error.stack });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Disculpa, tuve un problema técnico. ¿Podrías repetir tu pregunta?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="/api/twilio/procesar-voz" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">Lo siento, sigo teniendo problemas. Por favor intenta más tarde. Adiós.</Say>
  <Hangup/>
</Response>`;

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

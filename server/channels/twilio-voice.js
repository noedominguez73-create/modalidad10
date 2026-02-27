/**
 * TWILIO VOICE - Llamadas telefónicas con IA
 * Integración con Deepgram TTS para voz natural
 */

import twilio from 'twilio';
import settings from '../settings.js';
import { generarAudio } from './deepgram-tts.js';
import { appendFileSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prospectos from '../crm/prospectos.js';
import agentesVoz from '../crm/agentes-voz.js';

// Cache de audio en memoria (para evitar regenerar el mismo audio)
const audioCache = new Map();

// Limpiar cache cada 10 minutos
setInterval(() => {
  audioCache.clear();
}, 600000);

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

// Obtener URL de acción absoluta para Twilio
function obtenerActionUrl(req) {
  const config = getConfig();
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host;
  const dynamicBaseUrl = `${protocol}://${host}`;
  const baseUrl = config.webhookBaseUrl || dynamicBaseUrl;
  return (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + '/api/twilio/procesar-voz';
}


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

// Verificar si Deepgram está disponible
function tieneDeepgram() {
  const apiKeys = settings.obtenerApiKeys();
  return !!apiKeys.deepgram;
}

// Generar audio con Deepgram y guardarlo en cache
async function generarAudioDeepgram(texto, id, voz = 'Alloy') {
  const cacheKey = `${id}_${texto.substring(0, 50)}`;

  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  // Mapear voz de OpenAI/UI a modelos Aura de Deepgram
  let modeloDeepgram = 'aura-2-selena-es'; // Default (Alloy/Neutral)
  if (voz === 'Echo') {
    modeloDeepgram = 'aura-2-javier-es'; // Male
  } else if (voz === 'Fable') {
    modeloDeepgram = 'aura-2-luna-es'; // Different Female (Storyteller)
  }

  try {
    const audioBuffer = await generarAudio(texto, { modelo: modeloDeepgram });
    audioCache.set(cacheKey, audioBuffer);
    return audioBuffer;
  } catch (error) {
    console.error('❌ Error generando audio Deepgram:', error.message);
    return null;
  }
}

// Obtener audio del cache
export function obtenerAudioCache(id) {
  for (const [key, value] of audioCache.entries()) {
    if (key.startsWith(id)) {
      return value;
    }
  }
  return null;
}

// Generar TwiML con Deepgram (Play) o Polly (Say) como fallback
function generarTwimlHablar(texto, baseUrl, audioId) {
  if (tieneDeepgram()) {
    // Usar Deepgram - pre-generar el audio
    const audioUrl = `${baseUrl}/api/tts/${audioId}`;
    return `<Play>${audioUrl}</Play>`;
  } else {
    // Fallback a Polly
    return `<Say language="es-MX" voice="Polly.Mia">${texto}</Say>`;
  }
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
    // IMPORTANTE: generarRespuestaVoz ahora requiere 'req' para URLs absolutas si se espera respuesta
    let actionUrl = '/api/twilio/procesar-voz';
    if (opciones.req) {
      actionUrl = obtenerActionUrl(opciones.req);
    } else {
      const config = getConfig();
      if (config.webhookBaseUrl) {
        actionUrl = (config.webhookBaseUrl.endsWith('/') ? config.webhookBaseUrl.slice(0, -1) : config.webhookBaseUrl) + '/api/twilio/procesar-voz';
      }
    }

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
export async function handleIncomingCall(req, res) {
  try {
    const { Called, Caller, CallSid } = req.body || {};
    console.log(`📞 [VOICE] Llamada entrante: ${Caller} -> ${Called}, SID: ${CallSid}`);

    // Recuperar datos si ya existe prospecto
    const prospectosExistentes = prospectos.buscarProspecto(Caller || '');
    const prospecto = prospectosExistentes.length > 0 ? prospectosExistentes[0] : null;

    // Inicializar sesión de voz con datos de CRM si existen
    voiceSessions.set(CallSid, {
      historial: [],
      lastSeen: Date.now(),
      caller: Caller,
      datos: prospecto ? {
        nombreCompleto: prospecto.nombreCompleto,
        semanasActuales: prospecto.semanasActuales,
        nss: prospecto.nss
      } : {},
      agentId: null // Se asignará el ID del agente que responde
    });

    // Obtener agente específico para este número
    const agenteInfo = agentesVoz.obtenerAgentePorTelefono(Called || '');
    const session = voiceSessions.get(CallSid);
    if (session) {
      session.agentId = agenteInfo.id;
    }

    // Generar TwiML directamente
    const config = getConfig();

    // Detectar URL base dinámicamente
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const dynamicBaseUrl = `${protocol}://${host}`;
    const baseUrl = (config.webhookBaseUrl || dynamicBaseUrl).replace(/\/$/, '');

    const actionUrl = `${baseUrl}/api/twilio/procesar-voz`;

    // Mensajes dinámicos del agente configurado
    const msgBienvenida = agenteInfo.saludo || 'Hola, ¿en qué puedo ayudarte?';
    const msgEscucho = 'Te escucho.';
    const msgNoEscuche = 'No escuché nada. Si necesitas ayuda, vuelve a llamar. Hasta luego.';

    // Mapeo de voces AI
    let fallbackVoice = 'Polly.Mia'; // Default (Fable/Neutral Female)
    if (agenteInfo.voz === 'Alloy') {
      fallbackVoice = 'Polly.Lupe'; // Neutral Female
    } else if (agenteInfo.voz === 'Echo') {
      fallbackVoice = 'Polly.Miguel'; // Male
    }

    let twiml;

    if (tieneDeepgram()) {
      // Pre-generar audios con Deepgram
      const audioId1 = `welcome_${CallSid}`;
      const audioId2 = `listen_${CallSid}`;
      const audioId3 = `bye_${CallSid}`;

      await Promise.all([
        generarAudioDeepgram(msgBienvenida, audioId1, agenteInfo.voz),
        generarAudioDeepgram(msgEscucho, audioId2, agenteInfo.voz),
        generarAudioDeepgram(msgNoEscuche, audioId3, agenteInfo.voz)
      ]);

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/tts/${audioId1}</Play>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    <Play>${baseUrl}/api/tts/${audioId2}</Play>
  </Gather>
  <Play>${baseUrl}/api/tts/${audioId3}</Play>
  <Hangup/>
</Response>`;

      console.log('🔊 Usando Deepgram TTS para voz natural');
    } else {
      // Fallback a Polly
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="${fallbackVoice}">${msgBienvenida}</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    <Say language="es-MX" voice="${fallbackVoice}">${msgEscucho}</Say>
  </Gather>
  <Say language="es-MX" voice="${fallbackVoice}">${msgNoEscuche}</Say>
  <Hangup/>
</Response>`;

      console.log(`📢 Usando Polly TTS (Deepgram no configurado) para agente ${agenteInfo.nombre}`);
    }

    logDebug('incoming_call', { Caller, Called, CallSid, usingAgent: agenteInfo.nombre, usandoDeepgram: tieneDeepgram() });

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
    const actionUrl = obtenerActionUrl(req);

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
    // Buscar la configuración del agente correcta basada en la sesión guardada
    let systemPromptToUse = null;
    let fallbackVoice = 'Polly.Mia';

    if (session.agentId) {
      const todosLosAgentes = agentesVoz.obtenerAgentes();
      const ag = todosLosAgentes.find(a => a.id === session.agentId);
      if (ag) {
        systemPromptToUse = ag.instrucciones;
        if (ag.voz === 'Alloy') {
          fallbackVoice = 'Polly.Lupe';
        } else if (ag.voz === 'Echo') {
          fallbackVoice = 'Polly.Miguel';
        }
      }
    }

    // Procesar con la IA incluyendo el historial de la sesión
    const respuestaIA = await procesarConIA(speechResult, {
      canal: 'telefono',
      callSid,
      overridePrompt: systemPromptToUse, // Pasamos el custom prompt del agente
      sesion: {
        historial: session.historial,
        datos: session.datos || {}
      }
    });

    // Sincronizar con CRM si hay nuevos datos
    if (respuestaIA.nuevosDatos) {
      session.datos = { ...(session.datos || {}), ...respuestaIA.nuevosDatos };
      actualizarProspectoDesdeVoz(session.caller, session.datos);
    }

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
    const actionUrl = obtenerActionUrl(req);
    const config = getConfig();
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = (config.webhookBaseUrl || `${protocol}://${host}`).replace(/\/$/, '');

    let twiml;

    if (tieneDeepgram()) {
      // Generar audios con Deepgram
      const audioIdResp = `resp_${callSid}_${Date.now()}`;

      // Obtener voz del agente para Deepgram
      let deepgramVoiceType = 'Fable'; // Default
      if (session.agentId) {
        const ag = agentesVoz.obtenerAgenteStringId ? agentesVoz.obtenerAgenteStringId(session.agentId) : null;
        if (!ag) {
          const todosLosAgentes = agentesVoz.obtenerAgentes();
          const foundAg = todosLosAgentes.find(a => a.id === session.agentId);
          if (foundAg) deepgramVoiceType = foundAg.voz;
        } else {
          deepgramVoiceType = ag.voz;
        }
      }

      await generarAudioDeepgram(mensajeLimpio, audioIdResp, deepgramVoiceType);

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    <Play>${baseUrl}/api/tts/${audioIdResp}</Play>
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">¿Sigue ahí? ¿En qué más puedo ayudarle?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
  </Gather>
  <Hangup/>
</Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    <Say language="es-MX" voice="${fallbackVoice}">${mensajeLimpio}</Say>
  </Gather>
  <Say language="es-MX" voice="${fallbackVoice}">¿Sigue ahí? ¿En qué más puedo ayudarle?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
  </Gather>
  <Hangup/>
</Response>`;
    }

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

    if (!res.headersSent) {
      const actionUrl = obtenerActionUrl(req);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Disculpa, tuve un problema técnico. ¿Podrías repetir tu pregunta?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">
    </Gather>
  <Say language="es-MX" voice="Polly.Mia">Lo siento, sigo teniendo problemas. Por favor intenta más tarde. Adiós.</Say>
  <Hangup/>
</Response>`;

      res.type('text/xml');
      res.send(twiml);
    }
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

// Hacer llamada puente (Click-to-Call) sin WebRTC
export async function hacerLlamadaPuente(numeroDestino, numeroAdmin) {
  if (!client) {
    throw new Error('Twilio no está configurado');
  }

  // Usar el número de voz configurado en el panel (settings.json) o el de .env como fallback
  const config = getConfig();
  const callerIdToUse = config.phoneNumber;

  if (!callerIdToUse) {
    throw new Error('No hay número de Twilio configurado. Ve a Config > Canales de Comunicación y agrega tu número Twilio con tipo "Llamadas".');
  }

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say({ voice: 'Polly.Mia', language: 'es-MX' }, 'Conectando llamada desde el CRM. Espera por favor.');
  twiml.dial({ callerId: callerIdToUse }, numeroDestino);

  console.log(`[Twilio Bridge] From: ${callerIdToUse} → Admin: ${numeroAdmin} → Prospect: ${numeroDestino}`);

  const call = await client.calls.create({
    twiml: twiml.toString(),
    to: numeroAdmin,
    from: callerIdToUse
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

// Helper para actualizar prospecto en el CRM
function actualizarProspectoDesdeVoz(telefono, datos) {
  if (!telefono) return;
  try {
    const existentes = prospectos.buscarProspecto(telefono);
    if (existentes.length > 0) {
      prospectos.actualizarProspecto(existentes[0].id, {
        ...datos,
        origen: 'telefono'
      });
      console.log(`✅ Prospecto actualizado desde voz: ${telefono}`);
    } else if (datos.nombreCompleto) {
      prospectos.crearProspecto({
        ...datos,
        telefonoUSA: telefono,
        origen: 'telefono'
      });
      console.log(`✅ Nuevo prospecto creado desde voz: ${telefono}`);
    }
  } catch (err) {
    console.error('⚠️ Error sincronizando con CRM desde voz:', err.message);
  }
}

export default {
  initTwilio,
  handleIncomingCall,
  handleVoiceInput,
  hacerLlamada,
  hacerLlamadaPuente,
  enviarSMS,
  obtenerAudioCache
};

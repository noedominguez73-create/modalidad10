/**
 * TWILIO VOICE — Agente de Voz IA completo
 *
 * Implementa el flujo de 5 pasos:
 * 1. POST /api/twilio/voice         → handleIncomingCall  (saludo + <Gather>)
 * 2. POST /api/twilio/voice/respond → handleVoiceRespond  (STT → IA → TwiML)
 * 3. POST /api/twilio/voice/outbound→ handleOutbound      (TwiML saliente)
 * 4. POST /api/twilio/status        → handleStatus        (actualizar BD)
 * 5. POST /api/twilio/call          → hacerLlamadaSaliente (inicia llamada via API REST)
 */

import settings from '../settings.js';
import agentesVoz from '../crm/agentes-voz.js';
import callsDb from '../crm/calls-db.js';
import { generarAudio } from './deepgram-tts.js';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Cache de audio Deepgram ─────────────────────────────────────────
const audioCache = new Map();
setInterval(() => audioCache.clear(), 600_000); // limpiar cada 10 min

export function obtenerAudioCache(id) {
  for (const [key, value] of audioCache.entries()) {
    if (key.startsWith(id)) return value;
  }
  return null;
}

async function generarAudioDeepgram(texto, id, modelo = 'aura-2-selena-es') {
  const cacheKey = `${id}_${texto.substring(0, 50)}`;
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);
  try {
    const buf = await generarAudio(texto, { modelo });
    audioCache.set(cacheKey, buf);
    return buf;
  } catch (e) {
    console.error('❌ Error Deepgram TTS:', e.message);
    return null;
  }
}

// ─── Helpers de configuración ─────────────────────────────────────────

let twilioClient = null;

export function initTwilio() {
  const cfg = obtenerConfigTwilio();
  if (cfg.accountSid && cfg.authToken) {
    // Carga diferida del SDK para no bloquear el inicio
    import('twilio').then(mod => {
      twilioClient = mod.default(cfg.accountSid, cfg.authToken);
    }).catch(e => console.error('Error cargando SDK Twilio:', e.message));
    console.log('✓ Twilio Voice inicializado');
    return true;
  }
  console.log('⚠ Twilio Voice sin credenciales (configura desde Settings)');
  return false;
}

/** Lee credenciales: primero de settings.json, luego de env vars */
function obtenerConfigTwilio() {
  const s = settings.obtenerTwilioFullConfig ? settings.obtenerTwilioFullConfig() : settings.obtenerTwilio();
  return s;
}

/** Obtener BASE_URL para los webhooks */
function obtenerBaseUrl(req) {
  const cfg = obtenerConfigTwilio();
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const dynamic = `${proto}://${host}`;
  return (cfg.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || dynamic).replace(/\/$/, '');
}

/** Verificar si Deepgram está disponible */
function tieneDeepgram() {
  const keys = settings.obtenerApiKeys();
  return !!(keys.deepgram && keys.deepgram.length > 20);
}

/**
 * Obtener API keys de IA para el agente de voz.
 * Prioridad: settings.json → env vars
 * Gemini tiene prioridad sobre OpenAI (como especifica la arquitectura).
 */
function obtenerApiKeysVoz() {
  // Si existe la nueva función que lee de settings.json
  if (settings.obtenerApiKeysVoz) return settings.obtenerApiKeysVoz();
  const keys = settings.obtenerApiKeys();
  return { gemini: keys.gemini, openai: keys.openai };
}

// ─── Generador de TwiML ───────────────────────────────────────────────

function twimlSay(texto, voz = 'Polly.Mia') {
  // Escapar caracteres especiales XML
  const escaped = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<Say language="es-MX" voice="${voz}">${escaped}</Say>`;
}

function twimlGather(actionUrl, innerContent = '') {
  return `<Gather input="speech" language="es-MX" speechTimeout="auto" action="${actionUrl}" method="POST">${innerContent}</Gather>`;
}

// ─── PASO 1: LLAMADA ENTRANTE ─────────────────────────────────────────

export async function handleIncomingCall(req, res) {
  try {
    const { Called = '', Caller = '', CallSid = '' } = req.body || {};
    console.log(`📞 [VOICE] Entrante: ${Caller} → ${Called} (SID: ${CallSid})`);

    const cfg = obtenerConfigTwilio();
    const baseUrl = obtenerBaseUrl(req);

    // Resolver agente (3 prioridades)
    const agente = agentesVoz.getDefaultAgent(Called, cfg.defaultAgentId);

    // Registrar llamada en BD
    callsDb.registrarLlamada({
      call_sid: CallSid,
      from_number: Caller,
      to_number: Called,
      direction: 'inbound',
      status: 'ringing',
      agent_id: agente.id
    });

    const voz = agente.voz || 'Polly.Mia';
    const saludo = agente.greeting_message ||
      agente.saludo ||
      `Hola, soy ${agente.nombre}. ¿En qué puedo ayudarte?`;

    const actionUrl = `${baseUrl}/api/twilio/voice/respond?agent_id=${encodeURIComponent(agente.id)}&call_sid=${encodeURIComponent(CallSid)}`;

    let twiml;

    if (tieneDeepgram()) {
      const audioId1 = `welcome_${CallSid}`;
      const audioId2 = `listen_${CallSid}`;
      const audioId3 = `bye_${CallSid}`;
      await Promise.all([
        generarAudioDeepgram(saludo, audioId1),
        generarAudioDeepgram('Te escucho.', audioId2),
        generarAudioDeepgram('No escuché nada. Hasta luego.', audioId3)
      ]);
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${baseUrl}/api/tts/${audioId1}</Play>
  ${twimlGather(actionUrl, `<Play>${baseUrl}/api/tts/${audioId2}</Play>`)}
  <Play>${baseUrl}/api/tts/${audioId3}</Play>
  <Hangup/>
</Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay(saludo, voz)}
  ${twimlGather(actionUrl, twimlSay('Te escucho.', voz))}
  ${twimlSay('No escuché nada. Hasta luego.', voz)}
  <Hangup/>
</Response>`;
    }

    res.type('text/xml').send(twiml);

  } catch (err) {
    console.error('💥 [VOICE] Error en handleIncomingCall:', err);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Lo sentimos, el sistema no está disponible en este momento. Intente más tarde.</Say>
  <Hangup/>
</Response>`);
  }
}

// ─── PASO 2: CICLO DE CONVERSACIÓN ───────────────────────────────────

export async function handleVoiceRespond(req, res) {
  const { SpeechResult = '', CallSid = '', Confidence = '' } = req.body || {};
  const { agent_id, call_sid: qCallSid } = req.query;
  const callSid = CallSid || qCallSid || '';
  const agentId = agent_id || '';

  console.log(`🎤 [VOICE] SpeechResult="${SpeechResult}" Confianza=${Confidence} SID=${callSid}`);

  const baseUrl = obtenerBaseUrl(req);
  const actionUrl = `${baseUrl}/api/twilio/voice/respond?agent_id=${encodeURIComponent(agentId)}&call_sid=${encodeURIComponent(callSid)}`;

  // Si no se entendió nada
  if (!SpeechResult.trim()) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('No pude entenderte. ¿Podrías repetirlo?')}
  ${twimlGather(actionUrl)}
  ${twimlSay('Sigo sin escucharte. Hasta luego.')}
  <Hangup/>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  try {
    // Recuperar agente
    const agentes = agentesVoz.obtenerAgentes();
    const agente = agentes.find(a => a.id === agentId) || agentes[0];
    const voz = agente?.voz || 'Polly.Mia';
    const systemPrompt = agente?.prompt_sistema || agente?.instrucciones || '';
    const greeting = agente?.greeting_message || agente?.saludo || `Hola, soy ${agente?.nombre}.`;

    // Recuperar historial de transcript
    const transcript = callsDb.obtenerTranscript(callSid);

    // Construir historial multi-turno desde el transcript
    const turnosAnteriores = parsearTranscript(transcript);

    // Llamar a la IA (Gemini primero, luego OpenAI)
    const apiKeys = obtenerApiKeysVoz();
    let respuestaIA = '';

    if (apiKeys.gemini) {
      respuestaIA = await llamarGemini(SpeechResult, systemPrompt, greeting, turnosAnteriores, apiKeys.gemini);
    } else if (apiKeys.openai) {
      respuestaIA = await llamarOpenAI(SpeechResult, systemPrompt, greeting, turnosAnteriores, apiKeys.openai);
    } else {
      // Fallback: usar el router multi-proveedor del proyecto (si está disponible)
      try {
        const { routeLLM } = await import('../providers/llm-router.js');
        const mensajes = construirMensajesOpenAI(SpeechResult, systemPrompt, greeting, turnosAnteriores);
        const result = await routeLLM(mensajes, { channel: 'voice', maxTokens: 200 });
        respuestaIA = result.content;
      } catch (e) {
        console.error('❌ LLM Router no disponible:', e.message);
        respuestaIA = 'Disculpa, el servicio de inteligencia artificial no está configurado en este momento.';
      }
    }

    // Limpiar respuesta para voz (sin markdown)
    const respuestaLimpia = limpiarParaVoz(respuestaIA);

    // Guardar en historial
    callsDb.agregarTranscript(callSid, SpeechResult, respuestaLimpia);

    // Generar TwiML de respuesta
    let twiml;
    if (tieneDeepgram()) {
      const audioId = `resp_${callSid}_${Date.now()}`;
      await generarAudioDeepgram(respuestaLimpia, audioId);
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlGather(actionUrl, `<Play>${baseUrl}/api/tts/${audioId}</Play>`)}
  ${twimlSay('¿En qué más puedo ayudarte?', voz)}
  ${twimlGather(actionUrl)}
  ${twimlSay('Fue un placer atenderte. Hasta luego.', voz)}
  <Hangup/>
</Response>`;
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlGather(actionUrl, twimlSay(respuestaLimpia, voz))}
  ${twimlSay('¿En qué más puedo ayudarte?', voz)}
  ${twimlGather(actionUrl)}
  ${twimlSay('Fue un placer atenderte. Hasta luego.', voz)}
  <Hangup/>
</Response>`;
    }

    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('❌ [VOICE] Error en handleVoiceRespond:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('Disculpa, tuve un problema técnico. ¿Podrías repetir tu pregunta?')}
  ${twimlGather(actionUrl)}
  ${twimlSay('Lo siento, sigo con problemas. Intenta más tarde. Adiós.')}
  <Hangup/>
</Response>`;
    res.type('text/xml').send(twiml);
  }
}

// ─── PASO 3: LLAMADAS SALIENTES ───────────────────────────────────────

export async function handleOutbound(req, res) {
  try {
    const { agent_id } = req.query;
    const baseUrl = obtenerBaseUrl(req);

    const agentes = agentesVoz.obtenerAgentes();
    const agente = (agent_id && agentes.find(a => a.id === agent_id)) || agentes[0];

    const voz = agente?.voz || 'Polly.Mia';
    const saludo = agente?.greeting_message ||
      agente?.saludo ||
      `Hola, te llama el asesor de pensiones del IMSS. ¿En qué puedo ayudarte?`;

    // CallSid vendrá en el body si Twilio lo incluye
    const { CallSid = '' } = req.body || {};
    const actionUrl = `${baseUrl}/api/twilio/voice/respond?agent_id=${encodeURIComponent(agente?.id || '')}&call_sid=${encodeURIComponent(CallSid)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay(saludo, voz)}
  ${twimlGather(actionUrl, twimlSay('Te escucho.', voz))}
  ${twimlSay('No escuché nada. Hasta luego.', voz)}
  <Hangup/>
</Response>`;

    res.type('text/xml').send(twiml);
  } catch (err) {
    console.error('❌ [VOICE] Error en handleOutbound:', err);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  }
}

// ─── PASO 4: STATUS CALLBACK ──────────────────────────────────────────

export async function handleStatus(req, res) {
  const { CallSid, CallStatus, CallDuration } = req.body || {};
  console.log(`📊 [VOICE] Status: ${CallSid} → ${CallStatus} (${CallDuration}s)`);

  if (CallSid) {
    callsDb.actualizarLlamada(CallSid, {
      status: CallStatus,
      duration: CallDuration ? parseInt(CallDuration) : null
    });
  }

  res.sendStatus(204);
}

// ─── LLAMADA SALIENTE (API REST Twilio) ──────────────────────────────

/**
 * Iniciar una llamada saliente via API REST de Twilio
 * @param {{ to, agentId?, notes? }} params
 */
export async function hacerLlamadaSaliente({ to, agentId = null, baseUrl }) {
  const cfg = obtenerConfigTwilio();

  if (!cfg.accountSid || !cfg.authToken) {
    throw new Error('Twilio no está configurado. Agrega Account SID y Auth Token en Settings.');
  }

  const from = cfg.phoneNumber;
  if (!from) {
    throw new Error('No hay número de teléfono Twilio configurado. Agrega el número en Settings.');
  }

  const outboundUrl = `${baseUrl}/api/twilio/voice/outbound?agent_id=${encodeURIComponent(agentId || '')}`;
  const statusUrl = `${baseUrl}/api/twilio/status`;

  const body = new URLSearchParams({
    To: to,
    From: from,
    Url: outboundUrl,
    StatusCallback: statusUrl,
    StatusCallbackMethod: 'POST'
  });

  const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`;
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');

  const response = await fetch(twilioApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Twilio error ${response.status}: ${data.message || JSON.stringify(data)}`);
  }

  // Registrar la llamada saliente en BD
  callsDb.registrarLlamada({
    call_sid: data.sid,
    from_number: from,
    to_number: to,
    direction: 'outbound',
    status: data.status || 'initiated',
    agent_id: agentId
  });

  return data;
}

/**
 * Hacer llamada puente (Click-to-Call) — llama al admin primero, luego conecta con el prospecto
 */
export async function hacerLlamadaPuente(numeroDestino, numeroAdmin) {
  const cfg = obtenerConfigTwilio();
  if (!cfg.accountSid || !cfg.authToken) throw new Error('Twilio no configurado');

  const callerIdToUse = cfg.phoneNumber;
  if (!callerIdToUse) throw new Error('No hay número Twilio configurado en Settings');

  // Construir TwiML de puente inline
  const twimlPuente = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Conectando llamada desde el CRM. Espera por favor.</Say>
  <Dial callerId="${callerIdToUse}">${numeroDestino}</Dial>
</Response>`;

  const body = new URLSearchParams({
    To: numeroAdmin,
    From: callerIdToUse,
    Twiml: twimlPuente
  });

  const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`;
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');

  const response = await fetch(twilioApiUrl, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Twilio error: ${data.message}`);
  return data.sid;
}

// ─── HELPERS IA ──────────────────────────────────────────────────────

async function llamarGemini(userMsg, systemPrompt, greeting, historial, apiKey) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const reglaVoz = 'Solo puedes emitir UNA pregunta o respuesta por turno. Máximo 2-3 oraciones.';
  const systemContent = systemPrompt
    ? `INSTRUCCIONES DEL SISTEMA:\n${systemPrompt}\n\nREGLA IMPORTANTE: ${reglaVoz}`
    : reglaVoz;

  // Construir contents en formato Gemini (multi-turn)
  const contents = [
    { role: 'user', parts: [{ text: systemContent }] },
    { role: 'model', parts: [{ text: greeting }] }
  ];

  // Agregar historial previo
  for (const turno of historial) {
    contents.push({ role: 'user', parts: [{ text: turno.user }] });
    contents.push({ role: 'model', parts: [{ text: turno.ai }] });
  }

  // Agregar mensaje actual
  contents.push({ role: 'user', parts: [{ text: userMsg }] });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini error: ${data.error?.message || JSON.stringify(data)}`);

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function llamarOpenAI(userMsg, systemPrompt, greeting, historial, apiKey) {
  const reglaVoz = 'REGLA: Solo puedes emitir UNA pregunta o respuesta por turno. Máximo 2-3 oraciones.';
  const sysContent = systemPrompt ? `${systemPrompt}\n\n${reglaVoz}` : reglaVoz;

  const messages = construirMensajesOpenAI(userMsg, sysContent, greeting, historial);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 200,
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI error: ${data.error?.message || JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content || '';
}

function construirMensajesOpenAI(userMsg, systemPrompt, greeting, historial) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: greeting }
  ];

  for (const turno of historial) {
    messages.push({ role: 'user', content: turno.user });
    messages.push({ role: 'assistant', content: turno.ai });
  }

  messages.push({ role: 'user', content: userMsg });
  return messages;
}

/** Parsear el transcript guardado en calls.json en turnos [{user, ai}] */
function parsearTranscript(transcript) {
  if (!transcript) return [];
  const turnos = [];
  const lineas = transcript.split('\n').filter(l => l.trim());
  let i = 0;
  while (i < lineas.length) {
    const lineaUser = lineas[i] || '';
    const lineaAI = lineas[i + 1] || '';
    if (lineaUser.startsWith('User: ') && lineaAI.startsWith('AI: ')) {
      turnos.push({
        user: lineaUser.replace('User: ', ''),
        ai: lineaAI.replace('AI: ', '')
      });
      i += 2;
    } else {
      i++;
    }
  }
  // Tomar solo los últimos 5 turnos (10 mensajes) para no saturar el prompt
  return turnos.slice(-5);
}

/** Quitar markdown y caracteres que no suenan bien por teléfono */
function limpiarParaVoz(texto) {
  return texto
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, '. ')
    .replace(/[📊💰🎯📈⚠️✅❌📚📋🔍💼📞📱🤖1️⃣2️⃣3️⃣]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 500); // Máximo ~150 palabras
}

// ─── Compatibilidad con código existente ─────────────────────────────

/** @deprecated Usar handleVoiceRespond en su lugar */
export async function handleVoiceInput(req, res, procesarConIA) {
  return handleVoiceRespond(req, res);
}

export async function hacerLlamada(to, mensajeInicial) {
  const cfg = obtenerConfigTwilio();
  if (!twilioClient) {
    const twilio = await import('twilio');
    twilioClient = twilio.default(cfg.accountSid, cfg.authToken);
  }
  const call = await twilioClient.calls.create({
    twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX" voice="Polly.Mia">${mensajeInicial}</Say></Response>`,
    to,
    from: cfg.phoneNumber
  });
  return call.sid;
}

export default {
  initTwilio,
  handleIncomingCall,
  handleVoiceRespond,
  handleOutbound,
  handleStatus,
  handleVoiceInput,
  hacerLlamadaSaliente,
  hacerLlamadaPuente,
  hacerLlamada,
  obtenerAudioCache
};

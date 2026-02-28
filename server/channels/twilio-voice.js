/**
 * TWILIO VOICE — Agente de Voz IA completo
 *
 * IMPORTANTE: SIEMPRE usar Polly <Say> para TwiML.
 * NO usar Deepgram para voz telefónica — Twilio tiene timeout de 15s
 * y Deepgram requiere pre-generar audio ANTES de responder, lo que causa
 * el timeout y activa el menú de fallback en inglés de Twilio.
 *
 * Flujo:
 * 1. POST /api/twilio/voice         → handleIncomingCall  (saludo Polly + <Gather>)
 * 2. POST /api/twilio/voice/respond → handleVoiceRespond  (STT → Gemini/OpenAI → Polly)
 * 3. POST /api/twilio/voice/outbound→ handleOutbound      (TwiML saliente Polly)
 * 4. POST /api/twilio/status        → handleStatus        (actualizar BD)
 * 5. POST /api/twilio/call          → hacerLlamadaSaliente (inicia llamada via API REST)
 */

import settings from '../settings.js';
import agentesVoz from '../crm/agentes-voz.js';
import callsDb from '../crm/calls-db.js';
import { calcularModalidad10 } from '../calculadora-mod10.js';

// ─── Cache de audio Deepgram (solo para otros canales, NO para voz telefónica) ─
const audioCache = new Map();
setInterval(() => audioCache.clear(), 600_000);

export function obtenerAudioCache(id) {
  for (const [key, value] of audioCache.entries()) {
    if (key.startsWith(id)) return value;
  }
  return null;
}

// ─── Helpers de configuración ─────────────────────────────────────────

export function initTwilio() {
  const cfg = obtenerConfigTwilio();
  if (cfg.accountSid && cfg.authToken) {
    console.log('✓ Twilio Voice inicializado (Polly TTS)');
    return true;
  }
  console.log('⚠ Twilio Voice sin credenciales (configura Account SID y Auth Token en Settings)');
  return false;
}

/** Lee credenciales: primero de settings.json, luego de env vars */
function obtenerConfigTwilio() {
  if (settings.obtenerTwilioFullConfig) return settings.obtenerTwilioFullConfig();
  return settings.obtenerTwilio();
}

/** Obtener BASE_URL para los webhooks — SIEMPRE debe ser una URL absoluta válida */
function obtenerBaseUrl(req) {
  const cfg = obtenerConfigTwilio();

  // 1. Prioridad: webhookBaseUrl en settings.json o env var
  if (cfg.webhookBaseUrl && cfg.webhookBaseUrl.startsWith('http')) {
    return cfg.webhookBaseUrl.replace(/\/$/, '');
  }
  if (process.env.WEBHOOK_BASE_URL && process.env.WEBHOOK_BASE_URL.startsWith('http')) {
    return process.env.WEBHOOK_BASE_URL.replace(/\/$/, '');
  }

  // 2. Construir desde headers del request (Railway/proxy)
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'asesoriaimss.io';
  return `${proto}://${host}`;
}

/**
 * Obtener API keys de IA para el agente de voz.
 * Gemini tiene prioridad sobre OpenAI.
 */
function obtenerApiKeysVoz() {
  if (settings.obtenerApiKeysVoz) return settings.obtenerApiKeysVoz();
  const keys = settings.obtenerApiKeys();
  return { gemini: keys.gemini, openai: keys.openai };
}

// ─── Generador de TwiML ───────────────────────────────────────────────

/**
 * Mapea cualquier nombre de voz a una voz Polly válida.
 * Evita que nombres como "Alloy", "Echo", etc. lleguen al <Say> de Twilio.
 */
function sanitizeVoz(voz) {
  const POLLY_VALIDAS = ['Polly.Mia', 'Polly.Lupe', 'Polly.Miguel', 'Polly.Penelope', 'Polly.Conchita'];
  if (voz && POLLY_VALIDAS.includes(voz)) return voz;
  const mapa = {
    'Alloy': 'Polly.Mia',
    'Echo': 'Polly.Miguel',
    'Fable': 'Polly.Lupe',
    'Onyx': 'Polly.Miguel',
    'Nova': 'Polly.Mia',
    'Shimmer': 'Polly.Lupe',
  };
  return mapa[voz] || 'Polly.Mia';
}

function twimlSay(texto, voz = 'Polly.Mia') {
  voz = sanitizeVoz(voz);
  const escaped = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<Say language="es-MX" voice="${voz}">${escaped}</Say>`;
}

function twimlGather(actionUrl, innerContent = '') {
  // IMPORTANTE: En XML, el & en URLs debe ser &amp; o Twilio rechaza el TwiML
  const escapedUrl = actionUrl.replace(/&/g, '&amp;');
  return `<Gather input="speech" language="es-MX" speechTimeout="auto" action="${escapedUrl}" method="POST">${innerContent}</Gather>`;
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

    const voz = sanitizeVoz(agente.voz || 'Polly.Mia');
    const saludo = agente.greeting_message ||
      agente.saludo ||
      `Hola, soy ${agente.nombre}. ¿En qué puedo ayudarte?`;

    const actionUrl = `${baseUrl}/api/twilio/voice/respond?agent_id=${encodeURIComponent(agente.id)}&call_sid=${encodeURIComponent(CallSid)}`;

    // SIEMPRE usar Polly <Say> — respuesta inmediata sin pre-generación de audio.
    // Deepgram requiere await antes de responder → excede el timeout de 15s de Twilio.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay(saludo, voz)}
  ${twimlGather(actionUrl, twimlSay('Te escucho.', voz))}
  ${twimlSay('No escuché nada. Hasta luego.', voz)}
  <Hangup/>
</Response>`;

    console.log(`🎙️ [VOICE] Respondiendo con agente: ${agente.nombre}, voz: ${voz}`);
    res.type('text/xml').send(twiml);

  } catch (err) {
    console.error('💥 [VOICE] Error en handleIncomingCall:', err);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Lo sentimos, el sistema no está disponible. Intente más tarde.</Say>
  <Hangup/>
</Response>`);
  }
}

// ─── PASO 2: CICLO DE CONVERSACIÓN ───────────────────────────────────

// ─── HELPERS CALCULADORA MOD10 PARA VOZ ──────────────────────────────

function detectarCalculoMod10(respuestaIA) {
  const regex = /\[CALCULAR_MOD10\]\s*\{([^}]+)\}/;
  const match = respuestaIA.match(regex);
  if (!match) return null;
  try {
    const jsonStr = '{' + match[1] + '}';
    const datos = JSON.parse(jsonStr);
    console.log('🧮 [VOICE] Detectado cálculo Mod10:', datos);
    return datos;
  } catch (e) {
    console.error('❌ [VOICE] Error parseando JSON de cálculo:', e.message);
    return null;
  }
}

function formatearResultadoMod10(resultado) {
  const r = resultado;
  const totalMensual = r.totalesMensuales?.total || r.totalesMensuales?.imss || 0;
  const cuotaFija = r.desglose?.cuotaFija?.monto || 0;
  const riesgo = r.desglose?.riesgoTrabajo?.monto || 0;
  const retiro = r.desglose?.retiro?.monto || 0;
  const cesantia = (r.desglose?.cesantiaPatron?.monto || 0) + (r.desglose?.cesantiaObrero?.monto || 0);
  const infonavit = r.totalesMensuales?.infonavit || 0;

  let texto = `RESULTADO DEL CALCULO MODALIDAD 10:\n`;
  texto += `- Cuota mensual total: $${totalMensual.toFixed(2)} pesos\n`;
  texto += `- Desglose: cuota fija $${cuotaFija.toFixed(2)}, riesgo de trabajo $${riesgo.toFixed(2)}, `;
  texto += `retiro $${retiro.toFixed(2)}, cesantia y vejez $${cesantia.toFixed(2)}\n`;
  texto += `- Salario declarado: $${r.datos?.salarioMensual || 0} mensuales\n`;
  texto += `- Zona: ${r.datos?.zona || 'centro'}\n`;

  if (r.periodos?.bimestral) {
    texto += `- Pago bimestral: $${(r.periodos.bimestral.total || 0).toFixed(2)}\n`;
  }

  texto += `\nExplica estos resultados al usuario de forma clara y amigable por telefono. `;
  texto += `Menciona el total mensual primero. `;
  texto += `Usa lenguaje natural, di los montos en palabras (ejemplo: dos mil ochocientos cuarenta y siete pesos con cincuenta centavos). `;
  texto += `Maximo 3-4 oraciones.`;

  return texto;
}

async function ejecutarCalculoYResponder(datosMod10, systemPrompt, greeting, turnosAnteriores, apiKeys) {
  try {
    // Normalizar zona
    let zona = (datosMod10.zona || 'centro').toLowerCase();
    if (zona.includes('fronter')) zona = 'fronteriza';
    else if (zona.includes('centro') || zona.includes('resto') || zona.includes('pais')) zona = 'centro';

    const datosCalc = {
      salarioMensual: parseFloat(datosMod10.salarioMensual) || parseFloat(datosMod10.ingreso) || 15000,
      zona,
      claseRiesgo: datosMod10.claseRiesgo || 'I',
      periodoPago: datosMod10.periodoPago || 'mensual'
    };

    console.log('🧮 [VOICE] Calculando Mod10 con:', datosCalc);
    const resultado = calcularModalidad10(datosCalc);
    const contextoResultado = formatearResultadoMod10(resultado);

    // Segundo llamado a la IA para que verbalice el resultado
    let respuestaVerbal = '';
    if (apiKeys.gemini) {
      respuestaVerbal = await llamarGemini(
        contextoResultado,
        systemPrompt + '\nAhora debes comunicar al usuario los resultados del calculo. Se claro y amigable.',
        greeting,
        turnosAnteriores,
        apiKeys.gemini
      );
    } else if (apiKeys.openai) {
      respuestaVerbal = await llamarOpenAI(
        contextoResultado,
        systemPrompt + '\nAhora debes comunicar al usuario los resultados del calculo. Se claro y amigable.',
        greeting,
        turnosAnteriores,
        apiKeys.openai
      );
    } else {
      // Fallback: formatear directamente
      const total = resultado.periodos?.mensual?.total || resultado.totalMensual || 0;
      respuestaVerbal = `Tu cuota mensual de Modalidad 10 sería de aproximadamente ${total.toFixed(2)} pesos. ¿Te gustaría saber más detalles o tienes otra pregunta?`;
    }

    return limpiarParaVoz(respuestaVerbal);
  } catch (error) {
    console.error('❌ [VOICE] Error en cálculo Mod10:', error.message);
    return `Disculpa, hubo un error al calcular: ${error.message}. ¿Podrías verificar los datos?`;
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
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('No pude entenderte. ¿Podrías repetirlo?')}
  ${twimlGather(actionUrl)}
  ${twimlSay('Sigo sin escucharte. Hasta luego.')}
  <Hangup/>
</Response>`);
  }

  try {
    // Recuperar agente
    const agentes = agentesVoz.obtenerAgentes();
    const agente = agentes.find(a => a.id === agentId) || agentes[0];
    const voz = sanitizeVoz(agente?.voz || 'Polly.Mia');
    const basePrompt = agente?.prompt_sistema || agente?.instrucciones || '';
    const greeting = agente?.greeting_message || agente?.saludo || `Hola, soy ${agente?.nombre}.`;

    // SIEMPRE inyectar instrucciones de calculadora al prompt del agente
    const INSTRUCCIONES_CALCULADORA = `

HERRAMIENTA DE CÁLCULO - MODALIDAD 10:
Tienes acceso a una calculadora real de Modalidad 10. NUNCA intentes calcular tú mismo las cuotas.
Cuando el usuario pregunte cuánto cuesta o paga por Modalidad 10, sigue estos pasos:
1. Pregunta: "¿Cuál es tu ingreso mensual?" (obtener el monto en pesos)
2. Pregunta: "¿Vives en zona fronteriza o en el resto del país?" (obtener zona)
3. Cuando tengas al menos el salario, responde ÚNICAMENTE con este formato exacto, sin ningún otro texto:
   [CALCULAR_MOD10]{"salarioMensual": NUMERO, "zona": "centro"}

REGLAS ESTRICTAS:
- El NUMERO debe ser solo dígitos (ejemplo: 20000, no "20,000" ni "20 mil")
- zona debe ser "centro" (resto del país) o "fronteriza" (franja fronteriza del norte)
- Si el usuario dice "15 mil" o "quince mil", convierte a 15000
- Si el usuario dice "20 mil" o "veinte mil", convierte a 20000
- NUNCA inventes un monto. Si no entendiste el salario, pregunta de nuevo.
- NUNCA calcules las cuotas tú mismo. SOLO usa el tag [CALCULAR_MOD10].
- Cuando emitas el tag, NO agregues ningún texto antes ni después del tag.
`;

    const systemPrompt = basePrompt + INSTRUCCIONES_CALCULADORA;

    // Recuperar historial de transcript
    const transcript = callsDb.obtenerTranscript(callSid);
    const turnosAnteriores = parsearTranscript(transcript);

    // Llamar a la IA (Gemini primero, luego OpenAI, luego router del proyecto)
    const apiKeys = obtenerApiKeysVoz();
    let respuestaIA = '';

    if (apiKeys.gemini) {
      respuestaIA = await llamarGemini(SpeechResult, systemPrompt, greeting, turnosAnteriores, apiKeys.gemini);
    } else if (apiKeys.openai) {
      respuestaIA = await llamarOpenAI(SpeechResult, systemPrompt, greeting, turnosAnteriores, apiKeys.openai);
    } else {
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

    // ─── DETECCIÓN DE CÁLCULO MODALIDAD 10 ───────────────────────
    const datosMod10 = detectarCalculoMod10(respuestaIA);
    let respuestaLimpia;

    if (datosMod10) {
      console.log('🧮 [VOICE] Ejecutando cálculo Modalidad 10...');
      respuestaLimpia = await ejecutarCalculoYResponder(
        datosMod10, systemPrompt, greeting, turnosAnteriores, apiKeys
      );
    } else {
      // Limpiar respuesta normal para voz (sin markdown)
      respuestaLimpia = limpiarParaVoz(respuestaIA);
    }

    // Guardar en historial
    callsDb.agregarTranscript(callSid, SpeechResult, respuestaLimpia);

    console.log(`🤖 [VOICE] IA responde: "${respuestaLimpia.substring(0, 80)}..."`);

    // SIEMPRE usar Polly <Say> — la IA ya tardó su tiempo, no agregar más latencia.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlGather(actionUrl, twimlSay(respuestaLimpia, voz))}
  ${twimlSay('¿En qué más puedo ayudarte?', voz)}
  ${twimlGather(actionUrl)}
  ${twimlSay('Fue un placer atenderte. Hasta luego.', voz)}
  <Hangup/>
</Response>`;

    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('❌ [VOICE] Error en handleVoiceRespond:', error);
    if (!res.headersSent) {
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSay('Disculpa, tuve un problema técnico. ¿Podrías repetir tu pregunta?')}
  ${twimlGather(actionUrl)}
  ${twimlSay('Lo siento, sigo con problemas. Intenta más tarde. Adiós.')}
  <Hangup/>
</Response>`);
    }
  }
}

// ─── PASO 3: LLAMADAS SALIENTES ───────────────────────────────────────

export async function handleOutbound(req, res) {
  try {
    const { agent_id } = req.query;
    const baseUrl = obtenerBaseUrl(req);

    const agentes = agentesVoz.obtenerAgentes();
    const agente = (agent_id && agentes.find(a => a.id === agent_id)) || agentes[0];

    const voz = sanitizeVoz(agente?.voz || 'Polly.Mia');
    const saludo = agente?.greeting_message ||
      agente?.saludo ||
      `Hola, te llama el asesor de pensiones del IMSS. ¿En qué puedo ayudarte?`;

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

export async function hacerLlamadaPuente(numeroDestino, numeroAdmin) {
  const cfg = obtenerConfigTwilio();
  if (!cfg.accountSid || !cfg.authToken) throw new Error('Twilio no configurado');

  const callerIdToUse = cfg.phoneNumber;
  if (!callerIdToUse) throw new Error('No hay número Twilio configurado en Settings');

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

  const contents = [
    { role: 'user', parts: [{ text: systemContent }] },
    { role: 'model', parts: [{ text: greeting }] }
  ];

  for (const turno of historial) {
    contents.push({ role: 'user', parts: [{ text: turno.user }] });
    contents.push({ role: 'model', parts: [{ text: turno.ai }] });
  }
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
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 })
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

function parsearTranscript(transcript) {
  if (!transcript) return [];
  const turnos = [];
  const lineas = transcript.split('\n').filter(l => l.trim());
  let i = 0;
  while (i < lineas.length) {
    const lineaUser = lineas[i] || '';
    const lineaAI = lineas[i + 1] || '';
    if (lineaUser.startsWith('User: ') && lineaAI.startsWith('AI: ')) {
      turnos.push({ user: lineaUser.replace('User: ', ''), ai: lineaAI.replace('AI: ', '') });
      i += 2;
    } else {
      i++;
    }
  }
  return turnos.slice(-5);
}

function limpiarParaVoz(texto) {
  return texto
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n+/g, '. ')
    .replace(/[📊💰🎯📈⚠️✅❌📚📋🔍💼📞📱🤖1️⃣2️⃣3️⃣]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .substring(0, 500);
}

// ─── Compatibilidad con código existente ─────────────────────────────

export async function handleVoiceInput(req, res, procesarConIA) {
  return handleVoiceRespond(req, res);
}

export async function hacerLlamada(to, mensajeInicial) {
  const cfg = obtenerConfigTwilio();
  const body = new URLSearchParams({
    To: to,
    From: cfg.phoneNumber,
    Twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX" voice="Polly.Mia">${mensajeInicial}</Say></Response>`
  });
  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message);
  return d.sid;
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

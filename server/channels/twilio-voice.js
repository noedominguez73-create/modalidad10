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
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Configurar voz (español México)
  const sayOptions = {
    voice: opciones.voz || 'Polly.Mia', // Voz femenina española
    language: 'es-MX'
  };

  // Mensaje de bienvenida o respuesta
  response.say(sayOptions, mensaje);

  // Si necesita capturar entrada de voz - usar URL RELATIVA (como callcenteria)
  if (opciones.esperarRespuesta) {
    response.gather({
      input: 'speech',
      language: 'es-MX',
      speechTimeout: 'auto',
      action: '/api/twilio/procesar-voz',  // URL relativa - Twilio la convierte automáticamente
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
  const { Called, Caller, CallSid } = req.body || {};
  console.log(`📞 [VOICE] Llamada entrante: ${Caller} -> ${Called}, SID: ${CallSid}`);

  // Generar TwiML directamente (más confiable)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Bienvenido al asesor de pensiones del IMSS. Soy una inteligencia artificial y te ayudaré con tu Modalidad 40 o Modalidad 10. ¿En qué puedo ayudarte?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="/api/twilio/procesar-voz" method="POST">
    <Say language="es-MX" voice="Polly.Mia">Te escucho.</Say>
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">No escuché nada. Si necesitas ayuda, vuelve a llamar. Hasta luego.</Say>
  <Hangup/>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
}

// Webhook: Procesar voz del usuario
export async function handleVoiceInput(req, res, procesarConIA) {
  const speechResult = req.body?.SpeechResult;
  const confidence = req.body?.Confidence;
  const callSid = req.body?.CallSid;

  console.log(`🎤 [VOICE] Usuario dijo: "${speechResult}" (confianza: ${confidence}, SID: ${callSid})`);

  // Si no se entendió nada
  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">No pude entenderte. ¿Podrías repetirlo?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="/api/twilio/procesar-voz" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">Sigo sin escucharte. Hasta luego.</Say>
  <Hangup/>
</Response>`;
    res.type('text/xml');
    return res.send(twiml);
  }

  try {
    // Procesar con la IA
    const respuestaIA = await procesarConIA(speechResult, { canal: 'telefono', callSid });

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
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">${mensajeLimpio}</Say>
  <Gather input="speech" language="es-MX" speechTimeout="auto" action="/api/twilio/procesar-voz" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">¿Hay algo más en lo que pueda ayudarte?</Say>
  <Gather input="speech" language="es-MX" speechTimeout="3" action="/api/twilio/procesar-voz" method="POST">
  </Gather>
  <Say language="es-MX" voice="Polly.Mia">Fue un placer ayudarte. Hasta luego.</Say>
  <Hangup/>
</Response>`;

    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    console.error('❌ [VOICE] Error procesando voz:', error);

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

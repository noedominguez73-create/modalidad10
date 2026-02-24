/**
 * TTS ROUTER
 * Enruta peticiones a diferentes proveedores de Text-to-Speech
 */

import { TTS_PROVIDERS, getProviderApiKey, isProviderAvailable } from './index.js';
import settings from '../settings.js';

// Cache de audio generado
const audioCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Generar audio con Deepgram
 */
async function callDeepgram(text, options) {
  const apiKey = options.apiKey || getProviderApiKey('tts', 'deepgram');
  const voice = options.voice || 'aura-2-selena-es';

  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deepgram TTS error: ${response.status} - ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();

  return {
    audio: Buffer.from(audioBuffer),
    provider: 'deepgram',
    voice,
    format: 'mp3',
    size: audioBuffer.byteLength
  };
}

/**
 * Generar audio con ElevenLabs
 */
async function callElevenLabs(text, options) {
  const apiKey = options.apiKey || getProviderApiKey('tts', 'elevenlabs');
  const voice = options.voice || 'pMsXgVXv3BLzUgSXRplE';

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();

  return {
    audio: Buffer.from(audioBuffer),
    provider: 'elevenlabs',
    voice,
    format: 'mp3',
    size: audioBuffer.byteLength
  };
}

/**
 * Generar audio con OpenAI TTS
 */
async function callOpenAITTS(text, options) {
  const apiKey = options.apiKey || getProviderApiKey('tts', 'openai');
  const voice = options.voice || 'nova';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();

  return {
    audio: Buffer.from(audioBuffer),
    provider: 'openai',
    voice,
    format: 'mp3',
    size: audioBuffer.byteLength
  };
}

/**
 * Generar TwiML para Amazon Polly (via Twilio)
 * Nota: No genera audio directamente, devuelve configuración para TwiML
 */
function getPollyConfig(text, options) {
  const voice = options.voice || 'Polly.Mia';

  return {
    provider: 'amazon-polly',
    voice,
    twiml: true,
    sayConfig: {
      voice,
      language: 'es-MX'
    },
    text
  };
}

/**
 * Llamar a un proveedor específico
 */
async function callProvider(providerId, text, options = {}) {
  const startTime = Date.now();

  let result;
  switch (providerId) {
    case 'deepgram':
      result = await callDeepgram(text, options);
      break;
    case 'elevenlabs':
      result = await callElevenLabs(text, options);
      break;
    case 'openai':
      result = await callOpenAITTS(text, options);
      break;
    case 'amazon-polly':
      result = getPollyConfig(text, options);
      break;
    default:
      throw new Error(`Proveedor TTS desconocido: ${providerId}`);
  }

  result.latency = Date.now() - startTime;
  return result;
}

/**
 * Router principal de TTS
 */
export async function routeTTS(text, options = {}) {
  const config = settings.obtenerProviderConfig?.() || { tts: { default: 'deepgram' } };
  const { preferredProvider } = options;

  // Determinar proveedor
  let provider = preferredProvider || config.tts?.default || 'deepgram';

  // Verificar disponibilidad
  if (!isProviderAvailable('tts', provider) && provider !== 'amazon-polly') {
    console.log(`⚠️ TTS Provider ${provider} no disponible, buscando alternativa...`);
    const fallbacks = config.tts?.fallback || ['amazon-polly'];

    for (const fb of fallbacks) {
      if (isProviderAvailable('tts', fb) || fb === 'amazon-polly') {
        console.log(`✓ Usando TTS fallback: ${fb}`);
        provider = fb;
        break;
      }
    }
  }

  // Obtener voz configurada
  const voice = options.voice || config.tts?.voices?.[provider] || TTS_PROVIDERS[provider]?.defaultVoice;

  console.log(`🗣️ TTS Router: ${provider} (${voice})`);

  // Verificar cache
  const cacheKey = `${provider}:${voice}:${text}`;
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 TTS Cache hit`);
    return { ...cached.result, fromCache: true };
  }

  // Generar audio
  try {
    const result = await callProvider(provider, text, { ...options, voice });

    // Guardar en cache
    audioCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Limpiar cache antigua
    for (const [key, value] of audioCache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        audioCache.delete(key);
      }
    }

    return result;
  } catch (error) {
    console.error(`❌ Error en TTS ${provider}:`, error.message);

    // Intentar fallback
    const fallbacks = config.tts?.fallback || ['amazon-polly'];
    for (const fallback of fallbacks) {
      if (fallback === provider) continue;
      if (!isProviderAvailable('tts', fallback) && fallback !== 'amazon-polly') continue;

      try {
        console.log(`⚠️ TTS Failover: ${provider} → ${fallback}`);
        const fbVoice = config.tts?.voices?.[fallback] || TTS_PROVIDERS[fallback]?.defaultVoice;
        return await callProvider(fallback, text, { ...options, voice: fbVoice });
      } catch (e) {
        continue;
      }
    }

    throw error;
  }
}

/**
 * Probar un proveedor de TTS
 */
export async function testTTSProvider(providerId, testText = 'Hola, esta es una prueba de voz.') {
  if (!isProviderAvailable('tts', providerId) && providerId !== 'amazon-polly') {
    return {
      success: false,
      provider: providerId,
      error: 'API Key no configurada',
      available: false
    };
  }

  try {
    const startTime = Date.now();
    const result = await callProvider(providerId, testText, {});
    const latency = Date.now() - startTime;

    return {
      success: true,
      provider: providerId,
      voice: result.voice,
      format: result.format,
      size: result.size || 0,
      latency,
      available: true,
      isTwiML: result.twiml || false
    };
  } catch (error) {
    return {
      success: false,
      provider: providerId,
      error: error.message,
      available: true
    };
  }
}

/**
 * Obtener audio del cache
 */
export function getCachedAudio(cacheKey) {
  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result.audio;
  }
  return null;
}

/**
 * Guardar audio en cache y devolver ID
 */
export function cacheAudio(audio, provider, voice) {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  audioCache.set(id, {
    result: { audio, provider, voice },
    timestamp: Date.now()
  });
  return id;
}

/**
 * Obtener audio por ID
 */
export function getAudioById(id) {
  const cached = audioCache.get(id);
  if (cached) {
    return cached.result.audio;
  }
  return null;
}

export default {
  routeTTS,
  testTTSProvider,
  getCachedAudio,
  cacheAudio,
  getAudioById
};

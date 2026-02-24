/**
 * DEEPGRAM TTS - Text-to-Speech con voces naturales Aura
 */

import settings from '../settings.js';

// Voces disponibles en español
const VOCES_ESPANOL = {
  'aura-2-selena-es': 'Selena (Femenina, Recomendada)',
  'aura-2-luna-es': 'Luna (Femenina)',
  'aura-2-estrella-es': 'Estrella (Femenina)',
  'aura-2-diana-es': 'Diana (Femenina)',
  'aura-2-carina-es': 'Carina (Femenina)',
  'aura-2-aquila-es': 'Aquila (Femenina)',
  'aura-2-javier-es': 'Javier (Masculina)'
};

/**
 * Generar audio con Deepgram TTS
 * @param {string} texto - Texto a convertir en audio
 * @param {object} opciones - Opciones de configuración
 * @returns {Buffer} - Audio en formato MP3
 */
export async function generarAudio(texto, opciones = {}) {
  const apiKeys = settings.obtenerApiKeys();
  const vozConfig = settings.obtenerVozConfig();

  const apiKey = apiKeys.deepgram;
  if (!apiKey) {
    throw new Error('No hay API Key de Deepgram configurada');
  }

  const modelo = opciones.modelo || vozConfig.speakModel || 'aura-2-selena-es';

  console.log(`🔊 Deepgram TTS: Generando audio con voz ${modelo}`);

  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${modelo}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: texto })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Error Deepgram TTS:', error);
    throw new Error(`Error en Deepgram TTS: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  console.log(`✓ Audio generado: ${audioBuffer.byteLength} bytes`);

  return Buffer.from(audioBuffer);
}

/**
 * Obtener URL de audio para Twilio
 * Genera el audio y devuelve una URL que Twilio puede reproducir
 */
export async function obtenerUrlAudio(texto, baseUrl, opciones = {}) {
  // Para usar con Twilio, necesitamos servir el audio desde una URL
  // Esto requiere almacenar temporalmente el audio o usar streaming

  // Por ahora, generamos un hash del texto para cachear
  const hash = Buffer.from(texto).toString('base64').substring(0, 20);
  return `${baseUrl}/api/tts/audio/${hash}`;
}

export default {
  generarAudio,
  obtenerUrlAudio,
  VOCES_ESPANOL
};

/**
 * SETTINGS - Gestor de configuración persistente
 * Almacena credenciales de Twilio, Telegram y números de teléfono
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_PATH = join(__dirname, 'data', 'settings.json');

// Estructura por defecto
const DEFAULT_SETTINGS = {
  twilio: {
    accountSid: '',
    authToken: '',
    webhookBaseUrl: ''
  },
  telegram: {
    botToken: '',
    botUsername: ''
  },
  apiKeys: {
    vision: '',
    voz: '',
    llm: '',
    llmClaude: '',
    llmGemini: '',
    browser: ''
  },
  deepgram: {
    apiKey: '',
    listenModel: 'nova-3',
    listenLanguage: 'es',
    speakModel: 'aura-2-selena-es',
    audioEncoding: 'linear16',
    audioSampleRate: 24000
  },
  llmConfig: {
    provider: 'gemini', // openai, anthropic, gemini, groq
    temperature: 0.7
  },
  numeros: []
};

// Cache en memoria
let settingsCache = null;

/**
 * Cargar settings desde archivo JSON
 */
export function cargarSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const data = readFileSync(SETTINGS_PATH, 'utf8');
      settingsCache = JSON.parse(data);
    } else {
      settingsCache = { ...DEFAULT_SETTINGS };
      guardarSettings(settingsCache);
    }
  } catch (error) {
    console.error('Error cargando settings:', error.message);
    settingsCache = { ...DEFAULT_SETTINGS };
  }
  return settingsCache;
}

/**
 * Guardar settings en archivo JSON
 */
export function guardarSettings(settings) {
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    settingsCache = settings;
    return true;
  } catch (error) {
    console.error('Error guardando settings:', error.message);
    return false;
  }
}

/**
 * Obtener settings (con tokens enmascarados para UI)
 */
export function obtenerSettingsSeguro() {
  const settings = cargarSettings();
  const apiKeys = settings.apiKeys || { vision: '', voz: '', llm: '', llmClaude: '', llmGemini: '', browser: '' };
  const deepgram = settings.deepgram || { apiKey: '', listenModel: 'nova-3', listenLanguage: 'es', speakModel: 'aura-2-selena-es', audioEncoding: 'linear16', audioSampleRate: 24000 };
  const llmConfig = settings.llmConfig || { provider: 'gemini', temperature: 0.7 };

  return {
    twilio: {
      accountSid: settings.twilio.accountSid,
      authToken: settings.twilio.authToken ? '••••••••' + settings.twilio.authToken.slice(-4) : '',
      webhookBaseUrl: settings.twilio.webhookBaseUrl,
      configurado: !!(settings.twilio.accountSid && settings.twilio.authToken)
    },
    telegram: {
      botToken: settings.telegram.botToken ? '••••••••' + settings.telegram.botToken.slice(-4) : '',
      botUsername: settings.telegram.botUsername,
      configurado: !!settings.telegram.botToken
    },
    apiKeys: {
      vision: apiKeys.vision ? '••••••••' + apiKeys.vision.slice(-4) : '',
      voz: apiKeys.voz ? '••••••••' + apiKeys.voz.slice(-4) : '',
      llm: apiKeys.llm ? '••••••••' + apiKeys.llm.slice(-4) : '',
      llmClaude: apiKeys.llmClaude ? '••••••••' + apiKeys.llmClaude.slice(-4) : '',
      llmGemini: apiKeys.llmGemini ? '••••••••' + apiKeys.llmGemini.slice(-4) : '',
      browser: apiKeys.browser ? '••••••••' + apiKeys.browser.slice(-4) : '',
      visionConfigurado: !!apiKeys.vision,
      vozConfigurado: !!apiKeys.voz,
      llmConfigurado: !!apiKeys.llm,
      llmClaudeConfigurado: !!apiKeys.llmClaude,
      llmGeminiConfigurado: !!apiKeys.llmGemini,
      browserConfigurado: !!apiKeys.browser
    },
    deepgram: {
      apiKey: deepgram.apiKey ? '••••••••' + deepgram.apiKey.slice(-4) : '',
      listenModel: deepgram.listenModel,
      listenLanguage: deepgram.listenLanguage,
      speakModel: deepgram.speakModel,
      audioEncoding: deepgram.audioEncoding,
      audioSampleRate: deepgram.audioSampleRate,
      configurado: !!deepgram.apiKey
    },
    llmConfig: {
      provider: llmConfig.provider,
      temperature: llmConfig.temperature
    },
    numeros: settings.numeros
  };
}

/**
 * Obtener configuración de Twilio (completa, para uso interno)
 */
export function obtenerTwilio() {
  const settings = cargarSettings();
  return {
    accountSid: settings.twilio.accountSid || process.env.TWILIO_ACCOUNT_SID,
    authToken: settings.twilio.authToken || process.env.TWILIO_AUTH_TOKEN,
    webhookBaseUrl: settings.twilio.webhookBaseUrl || process.env.WEBHOOK_BASE_URL,
    phoneNumber: obtenerNumeroPorTipo('voz')?.numero || process.env.TWILIO_PHONE_NUMBER,
    whatsappNumber: obtenerNumeroPorTipo('whatsapp')?.numero || process.env.WHATSAPP_NUMBER
  };
}

/**
 * Guardar configuración de Twilio
 */
export function guardarTwilio(config) {
  const settings = cargarSettings();
  settings.twilio = {
    accountSid: config.accountSid || settings.twilio.accountSid,
    authToken: config.authToken || settings.twilio.authToken,
    webhookBaseUrl: config.webhookBaseUrl || settings.twilio.webhookBaseUrl
  };
  return guardarSettings(settings);
}

/**
 * Obtener configuración de Telegram (completa, para uso interno)
 */
export function obtenerTelegram() {
  const settings = cargarSettings();
  return {
    botToken: settings.telegram.botToken || process.env.TELEGRAM_BOT_TOKEN,
    botUsername: settings.telegram.botUsername
  };
}

/**
 * Guardar configuración de Telegram
 */
export function guardarTelegram(config) {
  const settings = cargarSettings();
  settings.telegram = {
    botToken: config.botToken || settings.telegram.botToken,
    botUsername: config.botUsername || settings.telegram.botUsername
  };
  return guardarSettings(settings);
}

/**
 * Obtener API Keys (completas, para uso interno)
 */
export function obtenerApiKeys() {
  const settings = cargarSettings();
  return settings.apiKeys || { vision: '', voz: '', llm: '', llmClaude: '', llmGemini: '', browser: '' };
}

/**
 * Guardar API Keys
 */
export function guardarApiKeys(keys) {
  const settings = cargarSettings();
  settings.apiKeys = {
    vision: keys.vision !== undefined ? keys.vision : (settings.apiKeys?.vision || ''),
    voz: keys.voz !== undefined ? keys.voz : (settings.apiKeys?.voz || ''),
    llm: keys.llm !== undefined ? keys.llm : (settings.apiKeys?.llm || ''),
    llmClaude: keys.llmClaude !== undefined ? keys.llmClaude : (settings.apiKeys?.llmClaude || ''),
    llmGemini: keys.llmGemini !== undefined ? keys.llmGemini : (settings.apiKeys?.llmGemini || ''),
    browser: keys.browser !== undefined ? keys.browser : (settings.apiKeys?.browser || '')
  };
  return guardarSettings(settings);
}

/**
 * Obtener configuración de Deepgram
 */
export function obtenerDeepgram() {
  const settings = cargarSettings();
  return settings.deepgram || {
    apiKey: '',
    listenModel: 'nova-3',
    listenLanguage: 'es',
    speakModel: 'aura-2-selena-es',
    audioEncoding: 'linear16',
    audioSampleRate: 24000
  };
}

/**
 * Guardar configuración de Deepgram
 */
export function guardarDeepgram(config) {
  const settings = cargarSettings();
  settings.deepgram = {
    apiKey: config.apiKey !== undefined ? config.apiKey : (settings.deepgram?.apiKey || ''),
    listenModel: config.listenModel || settings.deepgram?.listenModel || 'nova-3',
    listenLanguage: config.listenLanguage || settings.deepgram?.listenLanguage || 'es',
    speakModel: config.speakModel || settings.deepgram?.speakModel || 'aura-2-selena-es',
    audioEncoding: config.audioEncoding || settings.deepgram?.audioEncoding || 'linear16',
    audioSampleRate: config.audioSampleRate || settings.deepgram?.audioSampleRate || 24000
  };
  return guardarSettings(settings);
}

/**
 * Obtener configuración de LLM
 */
export function obtenerLlmConfig() {
  const settings = cargarSettings();
  return settings.llmConfig || { provider: 'gemini', temperature: 0.7 };
}

/**
 * Guardar configuración de LLM
 */
export function guardarLlmConfig(config) {
  const settings = cargarSettings();
  settings.llmConfig = {
    provider: config.provider || settings.llmConfig?.provider || 'gemini',
    temperature: config.temperature !== undefined ? config.temperature : (settings.llmConfig?.temperature || 0.7)
  };
  return guardarSettings(settings);
}

/**
 * Obtener todos los números
 */
export function obtenerNumeros() {
  const settings = cargarSettings();
  return settings.numeros || [];
}

/**
 * Obtener número por tipo (voz, whatsapp, telegram)
 */
export function obtenerNumeroPorTipo(tipo) {
  const numeros = obtenerNumeros();
  return numeros.find(n => n.tipo === tipo && n.activo);
}

/**
 * Agregar número
 */
export function agregarNumero(numero) {
  const settings = cargarSettings();
  const nuevoId = settings.numeros.length > 0
    ? Math.max(...settings.numeros.map(n => n.id)) + 1
    : 1;

  const nuevoNumero = {
    id: nuevoId,
    nombre: numero.nombre || 'Sin nombre',
    numero: numero.numero,
    tipo: numero.tipo || 'voz',
    activo: numero.activo !== undefined ? numero.activo : true
  };

  settings.numeros.push(nuevoNumero);
  guardarSettings(settings);
  return nuevoNumero;
}

/**
 * Actualizar número
 */
export function actualizarNumero(id, datos) {
  const settings = cargarSettings();
  const index = settings.numeros.findIndex(n => n.id === parseInt(id));

  if (index === -1) {
    return null;
  }

  settings.numeros[index] = {
    ...settings.numeros[index],
    ...datos,
    id: parseInt(id)
  };

  guardarSettings(settings);
  return settings.numeros[index];
}

/**
 * Eliminar número
 */
export function eliminarNumero(id) {
  const settings = cargarSettings();
  const index = settings.numeros.findIndex(n => n.id === parseInt(id));

  if (index === -1) {
    return false;
  }

  settings.numeros.splice(index, 1);
  guardarSettings(settings);
  return true;
}

// Cargar settings al iniciar
cargarSettings();

export default {
  cargarSettings,
  guardarSettings,
  obtenerSettingsSeguro,
  obtenerTwilio,
  guardarTwilio,
  obtenerTelegram,
  guardarTelegram,
  obtenerApiKeys,
  guardarApiKeys,
  obtenerDeepgram,
  guardarDeepgram,
  obtenerLlmConfig,
  guardarLlmConfig,
  obtenerNumeros,
  obtenerNumeroPorTipo,
  agregarNumero,
  actualizarNumero,
  eliminarNumero
};

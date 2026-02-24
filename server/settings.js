/**
 * SETTINGS - Gestor de configuración
 *
 * SECRETOS: Solo se leen de variables de entorno (Railway)
 * CONFIGURACIÓN: Se guarda en settings.json (opciones del cliente)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_PATH = join(__dirname, 'data', 'settings.json');

// Solo configuración del cliente (NO secretos)
const DEFAULT_SETTINGS = {
  // Configuración de voz (sin API key)
  voz: {
    speakModel: 'aura-2-selena-es',
    listenModel: 'nova-3',
    listenLanguage: 'es',
    audioEncoding: 'linear16',
    audioSampleRate: 24000
  },
  // Configuración de IA (sin API keys)
  llm: {
    provider: 'gemini',
    temperature: 0.7
  },
  // Números de teléfono (datos del cliente)
  numeros: [],
  // Valores IMSS
  imss: {
    año: 2025,
    uma: { diario: 113.14, mensual: 3439.46, anual: 41296.61 },
    salarioMinimo: { general: 278.80, frontera: 419.88 }
  }
};

let settingsCache = null;

/**
 * Cargar configuración del cliente
 */
export function cargarSettings() {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const data = readFileSync(SETTINGS_PATH, 'utf8');
      settingsCache = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
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
 * Guardar configuración del cliente
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

// ============================================
// SECRETOS - Solo de variables de entorno
// ============================================

/**
 * Obtener credenciales de Twilio (SOLO de env vars)
 */
export function obtenerTwilio() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || '',
    phoneNumber: obtenerNumeroPorTipo('voz')?.numero || process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: obtenerNumeroPorTipo('whatsapp')?.numero || process.env.WHATSAPP_NUMBER || ''
  };
}

/**
 * Obtener token de Telegram (SOLO de env vars)
 */
export function obtenerTelegram() {
  const settings = cargarSettings();
  const telegramNumero = obtenerNumeroPorTipo('telegram');
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: telegramNumero?.numero || ''
  };
}

/**
 * Obtener API Keys (SOLO de env vars)
 */
export function obtenerApiKeys() {
  return {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    gemini: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    glm5: process.env.ZHIPU_API_KEY || process.env.GLM5_API_KEY || '',
    deepgram: process.env.DEEPGRAM_API_KEY || '',
    vision: process.env.VISION_API_KEY || process.env.OPENAI_API_KEY || '',
    browser: process.env.BROWSERLESS_API_KEY || ''
  };
}

/**
 * Verificar qué servicios están configurados
 */
export function obtenerEstadoServicios() {
  const keys = obtenerApiKeys();
  const twilio = obtenerTwilio();
  const telegram = obtenerTelegram();

  return {
    twilio: !!(twilio.accountSid && twilio.authToken),
    telegram: !!telegram.botToken,
    deepgram: !!keys.deepgram,
    openai: !!keys.openai,
    anthropic: !!keys.anthropic,
    gemini: !!keys.gemini,
    groq: !!keys.groq,
    glm5: !!keys.glm5,
    llmConfigurado: !!(keys.openai || keys.anthropic || keys.gemini || keys.groq || keys.glm5)
  };
}

// ============================================
// CONFIGURACIÓN DEL CLIENTE - En settings.json
// ============================================

/**
 * Obtener configuración para el dashboard (sin secretos)
 */
export function obtenerSettingsSeguro() {
  const settings = cargarSettings();
  const estado = obtenerEstadoServicios();

  return {
    // Estado de servicios (solo lectura)
    servicios: estado,
    // Configuración de voz
    voz: settings.voz || DEFAULT_SETTINGS.voz,
    // Configuración de LLM
    llm: settings.llm || DEFAULT_SETTINGS.llm,
    // Números de teléfono
    numeros: settings.numeros || [],
    // Valores IMSS
    imss: settings.imss || DEFAULT_SETTINGS.imss
  };
}

/**
 * Obtener configuración de voz
 */
export function obtenerVozConfig() {
  const settings = cargarSettings();
  return settings.voz || DEFAULT_SETTINGS.voz;
}

/**
 * Guardar configuración de voz
 */
export function guardarVozConfig(config) {
  const settings = cargarSettings();
  settings.voz = {
    speakModel: config.speakModel || settings.voz?.speakModel || 'aura-2-selena-es',
    listenModel: config.listenModel || settings.voz?.listenModel || 'nova-3',
    listenLanguage: config.listenLanguage || settings.voz?.listenLanguage || 'es',
    audioEncoding: config.audioEncoding || settings.voz?.audioEncoding || 'linear16',
    audioSampleRate: config.audioSampleRate || settings.voz?.audioSampleRate || 24000
  };
  return guardarSettings(settings);
}

/**
 * Obtener configuración de LLM
 */
export function obtenerLlmConfig() {
  const settings = cargarSettings();
  return settings.llm || DEFAULT_SETTINGS.llm;
}

/**
 * Guardar configuración de LLM
 */
export function guardarLlmConfig(config) {
  const settings = cargarSettings();
  settings.llm = {
    provider: config.provider || settings.llm?.provider || 'gemini',
    temperature: config.temperature !== undefined ? config.temperature : (settings.llm?.temperature || 0.7)
  };
  return guardarSettings(settings);
}

/**
 * Obtener valores IMSS
 */
export function obtenerImss() {
  const settings = cargarSettings();
  return settings.imss || DEFAULT_SETTINGS.imss;
}

/**
 * Guardar valores IMSS
 */
export function guardarImss(valores) {
  const settings = cargarSettings();
  settings.imss = {
    año: valores.año || settings.imss?.año || 2025,
    uma: valores.uma || settings.imss?.uma || DEFAULT_SETTINGS.imss.uma,
    salarioMinimo: valores.salarioMinimo || settings.imss?.salarioMinimo || DEFAULT_SETTINGS.imss.salarioMinimo
  };
  return guardarSettings(settings);
}

// ============================================
// NÚMEROS DE TELÉFONO
// ============================================

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
  if (!settings.numeros) settings.numeros = [];

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

  if (index === -1) return null;

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

  if (index === -1) return false;

  settings.numeros.splice(index, 1);
  guardarSettings(settings);
  return true;
}

// Cargar al iniciar
cargarSettings();

export default {
  cargarSettings,
  guardarSettings,
  obtenerSettingsSeguro,
  obtenerEstadoServicios,
  obtenerTwilio,
  obtenerTelegram,
  obtenerApiKeys,
  obtenerVozConfig,
  guardarVozConfig,
  obtenerLlmConfig,
  guardarLlmConfig,
  obtenerImss,
  guardarImss,
  obtenerNumeros,
  obtenerNumeroPorTipo,
  agregarNumero,
  actualizarNumero,
  eliminarNumero
};

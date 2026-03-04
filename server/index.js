import express from 'express';
import cors from 'cors';
import { calcularModalidad40, validarElegibilidadMod40 } from './calculadora.js';
import { calcularModalidad10, CLASES_RIESGO, obtenerDivisiones, PERIODOS, LIMITES_SALARIO } from './calculadora-mod10.js';
import { calcularModalidad33, GRUPOS_EDAD } from './calculadora-mod33.js';
import { calcularTrabajadorasHogar, obtenerInfoTrabajadorasHogar } from './calculadora-trabajadoras-hogar.js';
import { SYSTEM_PROMPT_IMSS, FLUJO_DIAGNOSTICO, CASOS_EJEMPLO } from './rag/agent-prompt.js';
import { LEY_SEGURO_SOCIAL, PREGUNTAS_FRECUENTES, buscarEnBaseConocimiento } from './rag/knowledge-base.js';
import db from './database.js';
import feedback from './feedback.js';
import settings from './settings.js';
import crm from './crm/index.js';
import agentesVoz from './crm/agentes-voz.js';
import callsDb from './crm/calls-db.js';
import training from './training.js';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as connectivity from './utils/connectivity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3040;

// ============================================
// DIAGNÓSTICO NUCLEAR (AL INICIO)
// ============================================
const memoryLogs = [];
const addMemoryLog = (section, data) => {
  memoryLogs.push({
    timestamp: new Date().toISOString(),
    section,
    ...data
  });
  if (memoryLogs.length > 200) memoryLogs.shift();
};

// Endpoint de diagnóstico con máxima prioridad
app.get('/api/debug/logs', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    version: 'V4-NUCLEAR',
    status: 'diagnostic_active',
    count: memoryLogs.length,
    serverTime: new Date().toISOString(),
    logs: memoryLogs
  });
});

app.get('/debug-logs-now', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    version: 'V4-NUCLEAR-ALT',
    logs: memoryLogs
  });
});

// Limpiar logs
app.post('/api/debug/logs/clear', (req, res) => {
  memoryLogs.length = 0;
  res.json({ success: true, message: 'Logs limpiados' });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Requerido para webhooks de Twilio

// ─── ANTI-CACHE para rutas /api/* (Railway usa Fastly CDN que puede cachear) ───
// Esto garantiza que Fastly/Varnish nunca cachee respuestas de la API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Surrogate-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Diagnóstico Global de Peticiones
app.use((req, res, next) => {
  addMemoryLog('request', {
    method: req.method,
    url: req.url,
    body: (req.method === 'POST') ? req.body : undefined,
    headers: {
      'host': req.headers.host,
      'x-real-ip': req.headers['x-real-ip'],
      'user-agent': req.headers['user-agent']
    }
  });
  next();
});
// ─── FACEBOOK WEBHOOK — RUTA ULTRA-TEMPRANA (antes del static) ───────────────
// Meta verifica con GET /api/facebook/webhook — debe responder con hub.challenge
// Esta ruta está aquí arriba para evitar que express.static o el fallback SPA la intercepten
app.get('/api/facebook/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[FB-EARLY] Verificación recibida: mode=${mode} token=${token}`);

  // Token por defecto hardcoded como respaldo (se puede sobreescribir con env var)
  const verifyToken = (process.env.FACEBOOK_VERIFY_TOKEN || 'asesoriaimss_verify_2024').trim();

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ [FB-EARLY] Webhook verificado por Meta — respondiendo con challenge');
    return res.status(200).send(challenge);
  }

  // Token no coincide — rechazar
  console.log(`❌ [FB-EARLY] Token no coincide: esperado="${verifyToken}" recibido="${token}"`);
  return res.status(403).send('Forbidden');
});

app.use(express.static('client/dist'));

// INICIO INMEDIATO DEL SERVIDOR (Para Health Check de Railway)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  🧮 CALCULADORA IMSS MULTICANAL + CRM v3.5                        ║
║  ═══════════════════════════════════════════════════════════════  ║
║  🚀 SERVIDOR ESCUCHANDO EN EL PUERTO: ${PORT}                      ║
║  🏠 HOST: 0.0.0.0 (Apto para Railway/DOCKER)                      ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
});

// Health check para Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cargar datos operativos
let datosOperativos = {};
try {
  const dataPath = join(__dirname, '..', 'knowledge-base', 'operativa', 'cuotas-imss-2025.json');
  datosOperativos = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch (e) {
  console.log('Datos operativos no encontrados, usando valores por defecto');
}

// ============================================
// ENDPOINTS DE CÁLCULO
// ============================================

// Modalidad 40
app.post('/api/calcular', (req, res) => {
  try {
    const resultado = calcularModalidad40(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Modalidad 10
app.post('/api/calcular-mod10', (req, res) => {
  try {
    const resultado = calcularModalidad10(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener clases de riesgo
app.get('/api/clases-riesgo', (req, res) => {
  res.json(CLASES_RIESGO);
});

// Obtener divisiones ocupacionales
app.get('/api/divisiones', (req, res) => {
  const divisiones = obtenerDivisiones();
  if (divisiones) {
    res.json(divisiones);
  } else {
    res.status(500).json({ error: 'No se pudieron cargar las divisiones' });
  }
});

// Obtener grupos de una división específica
app.get('/api/divisiones/:codigo', (req, res) => {
  const { codigo } = req.params;
  const divisiones = obtenerDivisiones();

  if (!divisiones) {
    return res.status(500).json({ error: 'No se pudieron cargar las divisiones' });
  }

  const division = divisiones.divisiones.find(d => d.codigo === codigo);
  if (division) {
    res.json(division);
  } else {
    res.status(404).json({ error: 'División no encontrada' });
  }
});

// Obtener períodos de pago disponibles
app.get('/api/periodos-pago', (req, res) => {
  res.json(PERIODOS);
});

// Obtener límites de salario por zona
app.get('/api/limites-salario', (req, res) => {
  res.json(LIMITES_SALARIO);
});

// Modalidad 33 (Seguro de Salud Familiar)
app.post('/api/calcular-mod33', (req, res) => {
  try {
    const resultado = calcularModalidad33(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener grupos de edad para Modalidad 33
app.get('/api/grupos-edad-mod33', (req, res) => {
  res.json(GRUPOS_EDAD);
});

// ============================================
// TRABAJADORAS DEL HOGAR
// ============================================

// Calcular cuotas para Trabajadoras del Hogar
app.post('/api/calcular-trabajadoras-hogar', (req, res) => {
  try {
    const resultado = calcularTrabajadorasHogar(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener información del programa Trabajadoras del Hogar
app.get('/api/trabajadoras-hogar/info', (req, res) => {
  const info = obtenerInfoTrabajadorasHogar();
  res.json(info);
});

// Validar elegibilidad para Modalidad 40
app.post('/api/validar-elegibilidad-mod40', (req, res) => {
  try {
    const resultado = validarElegibilidadMod40(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// ENDPOINTS RAG (Retrieval-Augmented Generation)
// ============================================

// Buscar en la base de conocimiento legal
app.post('/api/rag/buscar', (req, res) => {
  const { consulta } = req.body;
  if (!consulta) {
    return res.status(400).json({ error: 'Se requiere una consulta' });
  }

  const resultados = buscarEnBaseConocimiento(consulta);
  res.json({
    consulta,
    resultados,
    total: resultados.length
  });
});

// Obtener artículo específico
app.get('/api/rag/articulo/:key', (req, res) => {
  const { key } = req.params;
  const articulo = LEY_SEGURO_SOCIAL[key];

  if (!articulo) {
    return res.status(404).json({ error: 'Artículo no encontrado' });
  }

  res.json(articulo);
});

// Obtener todas las FAQs
app.get('/api/rag/faqs', (req, res) => {
  res.json(PREGUNTAS_FRECUENTES);
});

// ============================================
// ENDPOINTS DEL AGENTE CONVERSACIONAL
// ============================================

// Obtener el flujo de diagnóstico
app.get('/api/agente/flujo', (req, res) => {
  res.json(FLUJO_DIAGNOSTICO);
});

// Obtener el system prompt (para depuración)
app.get('/api/agente/prompt', (req, res) => {
  res.json({
    systemPrompt: SYSTEM_PROMPT_IMSS,
    casosEjemplo: CASOS_EJEMPLO
  });
});

// Chat con el agente (simulado - para usar con LLM externo)
app.post('/api/agente/chat', async (req, res) => {
  const { mensaje, contexto = {}, historial = [] } = req.body;

  // Construir el contexto enriquecido
  const contextEnriquecido = {
    systemPrompt: SYSTEM_PROMPT_IMSS,
    datosUsuario: contexto,
    historialConversacion: historial,
    consultaActual: mensaje
  };

  // Buscar información relevante en la base de conocimiento
  const conocimientoRelevante = buscarEnBaseConocimiento(mensaje);

  // Verificar si hay datos suficientes para calcular
  let calculoDisponible = false;
  let calculo = null;

  if (contexto.fechaNacimiento && contexto.semanasActuales && contexto.salarioDeseado) {
    try {
      calculo = calcularModalidad40({
        fechaNacimiento: contexto.fechaNacimiento,
        semanasActuales: contexto.semanasActuales,
        salarioDeseado: contexto.salarioDeseado,
        edadRetiro: contexto.edadRetiro || 65
      });
      calculoDisponible = true;
    } catch (e) {
      console.error('Error en cálculo:', e.message);
    }
  }

  // Respuesta estructurada para el frontend o LLM
  res.json({
    contextoParaLLM: contextEnriquecido,
    conocimientoRelevante,
    calculoDisponible,
    calculo,
    sugerenciaSiguientePregunta: determinarSiguientePregunta(contexto)
  });
});

// ============================================
// FUNCIÓN DE DIAGNÓSTICO INTELIGENTE
// ============================================

function determinarSiguientePregunta(contexto) {
  if (!contexto.regimen) {
    return {
      paso: 'regimen',
      pregunta: FLUJO_DIAGNOSTICO.paso1_regimen.pregunta,
      tipo: 'fecha'
    };
  }

  if (!contexto.semanasActuales) {
    return {
      paso: 'semanas',
      pregunta: FLUJO_DIAGNOSTICO.paso2_semanas.pregunta,
      tipo: 'numero'
    };
  }

  if (!contexto.situacionLaboral) {
    return {
      paso: 'situacion_laboral',
      pregunta: FLUJO_DIAGNOSTICO.paso3_situacion.pregunta,
      tipo: 'opciones',
      opciones: FLUJO_DIAGNOSTICO.paso3_situacion.opciones
    };
  }

  if (!contexto.salarioDeseado) {
    return {
      paso: 'salario',
      pregunta: FLUJO_DIAGNOSTICO.paso4_salario.pregunta,
      tipo: 'moneda'
    };
  }

  if (!contexto.fechaNacimiento) {
    return {
      paso: 'nacimiento',
      pregunta: FLUJO_DIAGNOSTICO.paso5_nacimiento.pregunta,
      tipo: 'fecha'
    };
  }

  // Todos los datos recopilados
  return {
    paso: 'calculo',
    pregunta: 'Tengo todos los datos necesarios. ¿Quieres ver tu proyección de pensión?',
    tipo: 'confirmacion',
    datosCompletos: true
  };
}

// ============================================
// ENDPOINTS DE REFERENCIA
// ============================================

app.get('/api/datos-referencia', (req, res) => {
  const uma2025 = datosOperativos?.uma?.['2025']?.diario || 113.14;
  res.json({
    uma2024: datosOperativos?.uma?.['2024']?.diario || 108.57,
    uma2025,
    salarioMinimoTopado: 25 * uma2025,
    porcentajeCuota: 10.075,
    semanasMinimas: 500,
    edadMinimaPension: 60,
    factoresPorEdad: datosOperativos?.factores_edad_pension_ley73 || {
      60: 0.75, 61: 0.80, 62: 0.85, 63: 0.90, 64: 0.95, 65: 1.00
    },
    cuotasDesglose: datosOperativos?.cuotas_modalidad_40?.desglose || {},
    incrementosCesantia: datosOperativos?.incrementos_cesantia_vejez || {}
  });
});

app.get('/api/tabla-semanas', (req, res) => {
  res.json(generarTablaSemanas());
});

function generarTablaSemanas() {
  const tabla = [];
  for (let semanas = 500; semanas <= 2500; semanas += 52) {
    let porcentaje;
    if (semanas <= 500) {
      porcentaje = 0;
    } else if (semanas <= 1000) {
      porcentaje = ((semanas - 500) / 52) * 1.25;
    } else if (semanas <= 1250) {
      porcentaje = 12.019 + ((semanas - 1000) / 52) * 1.50;
    } else if (semanas <= 1500) {
      porcentaje = 19.231 + ((semanas - 1250) / 52) * 1.75;
    } else {
      porcentaje = 27.404 + ((semanas - 1500) / 52) * 2.00;
    }
    tabla.push({
      semanas,
      porcentaje: Math.min(parseFloat(porcentaje.toFixed(3)), 100),
      descripcion: getDescripcionSemanas(semanas)
    });
  }
  return tabla;
}

function getDescripcionSemanas(semanas) {
  const años = Math.floor(semanas / 52);
  if (semanas < 500) return `${años} años - No cumple mínimo`;
  if (semanas < 1000) return `${años} años - Pensión básica`;
  if (semanas < 1500) return `${años} años - Pensión media`;
  return `${años} años - Pensión alta`;
}

// Obtener artículos de ley
app.get('/api/ley', (req, res) => {
  res.json(LEY_SEGURO_SOCIAL);
});

// ============================================
// ENDPOINTS DE BASE DE DATOS (Administración)
// ============================================

// Obtener resumen de todos los datos
app.get('/api/db/resumen', (req, res) => {
  res.json(db.obtenerResumenDatos());
});

// Obtener UMA
app.get('/api/db/uma', (req, res) => {
  const año = req.query.año || null;
  res.json(db.obtenerUMA(año));
});

// Actualizar UMA
app.post('/api/db/uma', (req, res) => {
  const { año, diario, mensual, anual } = req.body;
  if (!año || !diario) {
    return res.status(400).json({ error: 'Se requiere año y valor diario' });
  }
  const datos = {
    diario: parseFloat(diario),
    mensual: mensual || parseFloat(diario) * 30.4,
    anual: anual || parseFloat(diario) * 365
  };
  const ok = db.actualizarUMA(año, datos);
  res.json({ success: ok, datos });
});

// Obtener salarios mínimos
app.get('/api/db/salarios', (req, res) => {
  const año = req.query.año || null;
  res.json({
    general: db.obtenerSalarioMinimo(año, 'general'),
    frontera: db.obtenerSalarioMinimo(año, 'frontera')
  });
});

// Actualizar salarios mínimos
app.post('/api/db/salarios', (req, res) => {
  const { año, general, frontera } = req.body;
  if (!año || !general || !frontera) {
    return res.status(400).json({ error: 'Se requiere año, general y frontera' });
  }
  const ok = db.actualizarSalarioMinimo(año, parseFloat(general), parseFloat(frontera));
  res.json({ success: ok });
});

// Obtener INPC
app.get('/api/db/inpc/:año/:mes', (req, res) => {
  const { año, mes } = req.params;
  const valor = db.obtenerINPC(año, mes);
  res.json({ año, mes, valor });
});

// Actualizar INPC
app.post('/api/db/inpc', (req, res) => {
  const { año, mes, valor } = req.body;
  if (!año || !mes || !valor) {
    return res.status(400).json({ error: 'Se requiere año, mes y valor' });
  }
  const ok = db.actualizarINPC(año, mes, parseFloat(valor));
  res.json({ success: ok });
});

// Recargar todos los datos de la base de datos
app.post('/api/db/recargar', (req, res) => {
  const datos = db.recargarTodo();
  res.json({ success: true, mensaje: 'Datos recargados', datos });
});

// ============================================
// CANALES DE COMUNICACIÓN (Twilio, WhatsApp, Telegram)
// ============================================

// Importar módulos de canales (lazy loading para evitar errores si no están configurados)
let twilioVoice, whatsapp, telegram, facebook, aiAgent, documentValidator;
let canalesActivos = {
  twilio: false,
  whatsapp: false,
  telegram: false,
  facebook: false,
  deepgram: false,
  llm: false
};

async function initChannels() {
  // Primero cargar el agente IA (necesario para todos los canales)
  try {
    aiAgent = await import('./ai-agent.js');
    console.log('✓ Agente IA cargado');

    // Verificar conectividad del LLM por defecto
    const keys = settings.obtenerApiKeys();
    const provider = settings.cargarSettings().llm?.provider || 'gemini';
    const llmOk = await connectivity.verificarLLM(provider, keys[provider]);
    canalesActivos.llm = llmOk.ok;
  } catch (e) {
    console.log('❌ Error cargando Agente IA:', e.message);
  }

  try {
    documentValidator = await import('./documents/validator.js');
    console.log('✓ Validador de documentos cargado');

    // Verificar Deepgram opcionalmente (si se usa para TTS)
    const keys = settings.obtenerApiKeys();
    const dgOk = await connectivity.verificarDeepgram(keys.deepgram);
    canalesActivos.deepgram = dgOk.ok;
  } catch (e) {
    console.log('⚠ Validador de documentos no disponible:', e.message);
  }

  // Cargar Twilio Voice
  try {
    twilioVoice = await import('./channels/twilio-voice.js');
    const initialized = twilioVoice.default.initTwilio();
    canalesActivos.twilio = !!initialized;
    if (initialized) {
      console.log('✓ Twilio Voice listo');
    }
  } catch (e) {
    console.log('⚠ Twilio Voice no disponible:', e.message);
    canalesActivos.twilio = false;
  }

  // Cargar WhatsApp
  try {
    whatsapp = await import('./channels/whatsapp.js');
    const ok = await whatsapp.default.initWhatsApp();
    canalesActivos.whatsapp = !!ok;
  } catch (e) {
    console.log('⚠ WhatsApp no disponible:', e.message);
    canalesActivos.whatsapp = false;
  }

  // Cargar Facebook Messenger
  try {
    facebook = await import('./channels/facebook.js');
    const ok = facebook.default.initFacebook();
    canalesActivos.facebook = !!ok;
  } catch (e) {
    console.log('⚠ Facebook Messenger no disponible:', e.message);
    canalesActivos.facebook = false;
  }

  // Cargar Telegram (con delay LARGO para evitar conflicto con instancia anterior en Railway)
  setTimeout(async () => {
    try {
      telegram = await import('./channels/telegram.js');
      console.log('⏳ Esperando para iniciar Telegram...');
      const ok = await telegram.default.initTelegram();
      canalesActivos.telegram = !!ok;
    } catch (e) {
      console.log('⚠ Telegram no disponible:', e.message);
      canalesActivos.telegram = false;
    }
  }, 10000); // 10 segundos — Railway necesita tiempo para cerrar la instancia anterior
}

// Manejo de señales para cierre limpio (evita que Railway mate el proceso)
const gracefulShutdownMain = (signal) => {
  console.log(`🛑 ${signal} recibido — cerrando servidor limpiamente...`);
  // Detener Telegram polling
  if (telegram && telegram.default && telegram.default.stopTelegram) {
    try { telegram.default.stopTelegram(); } catch (e) { /* ignore */ }
  }
  server.close(() => {
    console.log('✅ Servidor cerrado.');
    process.exit(0);
  });
  // Forzar cierre después de 5s si no se cierra solo
  setTimeout(() => process.exit(0), 5000);
};

process.on('SIGTERM', () => gracefulShutdownMain('SIGTERM'));
process.on('SIGINT', () => gracefulShutdownMain('SIGINT'));

// Evitar que errores no manejados maten el proceso
process.on('uncaughtException', (err) => {
  console.error('💥 Error no manejado (servidor sigue corriendo):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
});

// Inicializar canales al arrancar (en segundo plano)
setImmediate(() => {
  initChannels().then(() => {
    console.log('🚀 Todos los canales cargados y listos');
  }).catch(err => {
    console.error('💥 Error crítico inicializando canales:', err);
  });
});

import twilioToken from './channels/twilio-token.js';

// --- TWILIO VOICE (Llamadas telefónicas) ---

// Endpoint para obtener Access Token (para el SDK del navegador)
app.get('/api/twilio/token', (req, res) => {
  try {
    const identity = req.query.identity || 'asesor_' + Math.floor(Math.random() * 1000);
    const tokenData = twilioToken.generarAccessToken(identity);
    res.json({ success: true, ...tokenData });
  } catch (error) {
    console.error('❌ Error generando token Twilio:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DIAGNÓSTICO: Endpoint ultra-simple para probar que Twilio llega al servidor ───
app.all('/api/twilio/ping', (req, res) => {
  console.log('🔔 [PING] Twilio llegó al servidor!', req.method, JSON.stringify(req.body));
  const twiml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Response>\n' +
    '  <Say language="es-MX" voice="Polly.Conchita">Bienvenido al asesor de pensiones. Soy una inteligencia artificial. En que puedo ayudarte?</Say>\n' +
    '  <Pause length="2"/>\n' +
    '  <Say language="es-MX" voice="Polly.Conchita">Hasta luego.</Say>\n' +
    '  <Hangup/>\n' +
    '</Response>';
  console.log('📤 [PING] Enviando TwiML:', twiml.length, 'bytes');
  res.type('text/xml').send(twiml);
});

// Webhook: Llamada entrante
app.post('/api/twilio/voice', async (req, res) => {
  const { Called, Caller, CallSid } = req.body;
  console.log(`📞 [TWILIO] Llamada entrante: ${Caller} -> ${Called} (SID: ${CallSid})`);

  // Si twilioVoice aún no cargó, intentar cargarlo ahora
  if (!twilioVoice) {
    try {
      twilioVoice = await import('./channels/twilio-voice.js');
      twilioVoice.default.initTwilio();
      canalesActivos.twilio = true;
      console.log('✓ Twilio Voice cargado on-demand');
    } catch (e) {
      console.error('❌ No se pudo cargar Twilio Voice:', e.message);
      // Devolver TwiML válido (no plain text) para que Twilio no cuelgue en silencio
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Lo sentimos, el sistema no está listo. Por favor intente en unos momentos.</Say>
  <Hangup/>
</Response>`);
      return;
    }
  }

  try {
    await twilioVoice.default.handleIncomingCall(req, res);
  } catch (err) {
    console.error('❌ Error en handleIncomingCall:', err);
    if (!res.headersSent) {
      res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="Polly.Mia">Error interno. Por favor intente de nuevo.</Say>
  <Hangup/>
</Response>`);
    }
  }
});

// También aceptar GET para verificar que el endpoint funciona
app.get('/api/twilio/voice', (req, res) => {
  res.json({
    status: 'ok',
    twilioConfigured: !!twilioVoice,
    aiAgentConfigured: !!aiAgent,
    message: 'Endpoint de voz activo. Usa POST para llamadas de Twilio.'
  });
});

// Endpoint para servir audio de Deepgram TTS
app.get('/api/tts/:audioId', (req, res) => {
  const { audioId } = req.params;

  if (!twilioVoice) {
    return res.status(503).send('TTS no disponible');
  }

  const audioBuffer = twilioVoice.default.obtenerAudioCache(audioId);

  if (!audioBuffer) {
    console.log(`⚠️ Audio no encontrado en cache: ${audioId}`);
    return res.status(404).send('Audio no encontrado');
  }

  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': audioBuffer.length,
    'Cache-Control': 'no-cache'
  });

  res.send(audioBuffer);
});

// ─── WHATSAPP WEBHOOK (Meta Cloud API directa) ───────────────────────

// GET: Verificación del webhook (Meta lo requiere al configurar)
app.get('/api/whatsapp/webhook', (req, res) => {
  if (!whatsapp) {
    return res.status(200).send(req.query['hub.challenge'] || 'OK');
  }
  whatsapp.default.verificarWebhook(req, res);
});

// POST: Mensajes entrantes de WhatsApp (Meta Cloud API)
app.post('/api/whatsapp/webhook', async (req, res) => {
  console.log(`💬 [WHATSAPP] Webhook recibido:`, JSON.stringify(req.body).substring(0, 200));

  if (!whatsapp) {
    console.error('❌ WhatsApp no está cargado');
    return res.status(200).send('OK');
  }

  try {
    const procesarConIA = aiAgent ? (aiAgent.default?.procesarConIA || aiAgent.procesarConIA) : null;
    const validarDoc = documentValidator ? documentValidator.default?.validarDocumento : null;

    await whatsapp.default.handleIncomingMessage(req, res, procesarConIA, validarDoc);
  } catch (err) {
    console.error('❌ Error en webhook WhatsApp:', err);
    if (!res.headersSent) res.status(200).send('OK');
  }
});

// Enviar mensaje proactivo de WhatsApp desde el CRM
app.post('/api/whatsapp/enviar', async (req, res) => {
  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ success: false, error: 'Falta telefono o mensaje' });
  }

  if (!whatsapp) {
    return res.status(503).json({ success: false, error: 'WhatsApp no está configurado' });
  }

  try {
    const msgId = await whatsapp.default.enviarMensaje(telefono, mensaje);
    res.json({ success: true, messageId: msgId, message: 'Mensaje enviado' });
  } catch (err) {
    console.error('❌ Error enviando WhatsApp:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener todas las sesiones/conversaciones activas de WhatsApp
app.get('/api/whatsapp/sesiones', (req, res) => {
  if (!whatsapp) {
    return res.json({ success: true, data: [] });
  }
  try {
    const sesiones = whatsapp.default.obtenerSesionesActivas();
    res.json({ success: true, data: sesiones });
  } catch (err) {
    console.error('Error obteniendo sesiones WA:', err);
    res.json({ success: true, data: [] });
  }
});

// Obtener todas las sesiones/conversaciones activas de Telegram
app.get('/api/telegram/sesiones', (req, res) => {
  if (!telegram) {
    return res.json({ success: true, data: [] });
  }
  try {
    const sesiones = telegram.default.obtenerSesionesActivas();
    res.json({ success: true, data: sesiones });
  } catch (err) {
    console.error('Error obteniendo sesiones Telegram:', err);
    res.json({ success: true, data: [] });
  }
});

// ─── FACEBOOK MESSENGER (Meta Graph API) ─────────────────────────────

// GET: Verificación del webhook (Meta lo requiere al configurar)
app.get('/api/facebook/webhook', (req, res) => {
  if (!facebook) {
    return res.status(200).send(req.query['hub.challenge'] || 'OK');
  }
  facebook.default.verificarWebhook(req, res);
});

// POST: Mensajes entrantes de Facebook Messenger
app.post('/api/facebook/webhook', async (req, res) => {
  console.log(`💬 [FACEBOOK] Webhook recibido:`, JSON.stringify(req.body).substring(0, 200));

  if (!facebook) {
    console.error('❌ Facebook no está cargado');
    return res.status(200).send('EVENT_RECEIVED');
  }

  try {
    await facebook.default.handleIncomingMessage(req, res);
  } catch (err) {
    console.error('❌ Error en webhook Facebook:', err);
    if (!res.headersSent) res.status(200).send('EVENT_RECEIVED');
  }
});

// Enviar mensaje proactivo de Facebook desde el CRM
app.post('/api/facebook/enviar', async (req, res) => {
  const { recipientId, mensaje } = req.body;

  if (!recipientId || !mensaje) {
    return res.status(400).json({ success: false, error: 'Falta recipientId o mensaje' });
  }

  if (!facebook) {
    return res.status(503).json({ success: false, error: 'Facebook no está configurado' });
  }

  try {
    const msgId = await facebook.default.enviarMensaje(recipientId, mensaje);
    res.json({ success: true, messageId: msgId, message: 'Mensaje enviado' });
  } catch (err) {
    console.error('❌ Error enviando Facebook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener todas las sesiones/conversaciones activas de Facebook
app.get('/api/facebook/sesiones', (req, res) => {
  if (!facebook) {
    return res.json({ success: true, data: [] });
  }
  try {
    const sesiones = facebook.default.obtenerSesionesActivas();
    res.json({ success: true, data: sesiones });
  } catch (err) {
    console.error('Error obteniendo sesiones Facebook:', err);
    res.json({ success: true, data: [] });
  }
});

// Alias para compatibilidad (el usuario puede haber configurado este en Twilio)
app.post('/api/voice/incoming', (req, res) => {
  const { Called, Caller, CallSid } = req.body;
  console.log(`📞 [TWILIO-ALIAS] Llamada entrante: ${Caller} -> ${Called} (SID: ${CallSid})`);

  if (!twilioVoice) {
    console.error('❌ Twilio Voice no está cargado en el servidor (alias)');
    return res.status(503).type('text/plain').send('Servicio de voz no disponible temporalmente.');
  }

  try {
    twilioVoice.default.handleIncomingCall(req, res);
  } catch (err) {
    console.error('❌ Error en handleIncomingCall (alias):', err);
    res.status(500).send('Error interno');
  }
});

// Endpoint para iniciar llamada de puente (Click-to-Call) desde el CRM sin WebRTC
app.post('/api/twilio/llamar-puente', async (req, res) => {
  const { numeroDestino, numeroAdmin } = req.body;

  if (!numeroDestino) {
    return res.status(400).json({ success: false, error: 'Falta numeroDestino' });
  }

  if (!twilioVoice) {
    return res.status(503).json({ success: false, error: 'Servicio de voz no disponible' });
  }

  try {
    // Si no pasan numero de admin, usar el de WhatsApp/Voz de configuración
    let adminPhone = numeroAdmin;
    if (!adminPhone) {
      const settings = await import('./settings.js');
      const nVoz = settings.obtenerNumeroPorTipo('voz');
      adminPhone = nVoz ? nVoz.numero : (process.env.WHATSAPP_NUMBER || '').replace('whatsapp:', '');
    }

    if (!adminPhone) {
      return res.status(400).json({ success: false, error: 'No hay número de recepción configurado. Escribe tu teléfono en el panel.' });
    }

    console.log(`📞 Click-to-Call: Twilio llamará a Administrador (${adminPhone}) y conectará con Prospecto (${numeroDestino})`);
    const sid = await twilioVoice.default.hacerLlamadaPuente(numeroDestino, adminPhone);

    res.json({
      success: true,
      sid,
      message: `Enlazando llamada... Contesta tu teléfono ${adminPhone} para hablar con el prospecto.`
    });
  } catch (error) {
    console.error('❌ Error en puente de llamada:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook: Procesar voz del usuario
app.post('/api/twilio/procesar-voz', async (req, res) => {
  const { SpeechResult, CallSid, Confidence } = req.body;
  console.log(`🎤 [TWILIO] Procesando voz: "${SpeechResult}" (Confianza: ${Confidence}, SID: ${CallSid})`);

  if (!twilioVoice || !aiAgent) {
    console.error('❌ Dependencias de voz no cargadas:', { twilioVoice: !!twilioVoice, aiAgent: !!aiAgent });

    const twilioLib = await import('twilio');
    const VoiceResponse = twilioLib.default.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Mia', language: 'es-MX' },
      'Lo siento, el sistema no está listo. Por favor intenta en unos segundos.');
    response.hangup();
    res.type('text/xml');
    return res.send(response.toString());
  }

  try {
    if (!twilioVoice) {
      return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX" voice="Polly.Mia">Lo sentimos, el sistema no está listo. Intenta en unos segundos.</Say><Hangup/></Response>`);
    }
    await twilioVoice.default.handleVoiceInput(req, res, aiAgent?.default?.procesarConIA);
  } catch (err) {
    console.error('❌ Error en handleVoiceInput:', err);
    res.status(500).send('Error procesando voz');
  }
});

// ─── NUEVO: Ciclo de conversación (STT → IA → TwiML) ───
// Este es el webhook principal que recibe lo que dijo el usuario y devuelve la respuesta IA
app.post('/api/twilio/voice/respond', async (req, res) => {
  if (!twilioVoice) {
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX" voice="Polly.Mia">Sistema no disponible</Say><Hangup/></Response>`);
  }
  try {
    await twilioVoice.default.handleVoiceRespond(req, res);
  } catch (err) {
    console.error('❌ Error en handleVoiceRespond:', err);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX" voice="Polly.Mia">Error interno</Say><Hangup/></Response>`);
  }
});

// ─── NUEVO: TwiML para llamadas salientes ───
app.post('/api/twilio/voice/outbound', async (req, res) => {
  if (!twilioVoice) {
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  }
  try {
    await twilioVoice.default.handleOutbound(req, res);
  } catch (err) {
    console.error('❌ Error en handleOutbound:', err);
    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
  }
});

// ─── NUEVO: Status Callback de Twilio (actualiza estado/duración en BD) ───
app.post('/api/twilio/status', async (req, res) => {
  if (!twilioVoice) return res.sendStatus(204);
  try {
    await twilioVoice.default.handleStatus(req, res);
  } catch (err) {
    console.error('❌ Error en handleStatus:', err);
    res.sendStatus(204);
  }
});

// ─── NUEVO: GET /api/twilio/config — Config + webhook URLs enmascaradas ───
app.get('/api/twilio/config', (req, res) => {
  try {
    const cfg = settings.obtenerTwilioFullConfig ? settings.obtenerTwilioFullConfig() : settings.obtenerTwilio();
    const baseUrl = (cfg.webhookBaseUrl || process.env.WEBHOOK_BASE_URL || 'https://tu-dominio.com').replace(/\/$/, '');
    const numero = cfg.phoneNumber;
    // Enmascarar Account SID y Auth Token
    const accountSidMask = cfg.accountSid ? cfg.accountSid.substring(0, 4) + '...' + cfg.accountSid.slice(-4) : '';
    res.json({
      configurado: !!(cfg.accountSid && cfg.authToken),
      account_sid_mask: accountSidMask,
      phone_number: numero,
      default_agent_id: cfg.defaultAgentId || null,
      webhook_url: `${baseUrl}/api/twilio/voice`,
      status_url: `${baseUrl}/api/twilio/status`,
      outbound_url: `${baseUrl}/api/twilio/voice/outbound`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NUEVO: PUT /api/twilio/config — Cambiar agente default ───
app.put('/api/twilio/config', (req, res) => {
  try {
    const { default_agent_id } = req.body;
    if (!default_agent_id) return res.status(400).json({ error: 'Falta default_agent_id' });
    settings.guardarTwilioDefaultAgent(default_agent_id);
    res.json({ success: true, default_agent_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NUEVO: POST /api/twilio/call — Click-to-Call genérico ───
app.post('/api/twilio/call', async (req, res) => {
  const { to, agent_id } = req.body;
  if (!to) return res.status(400).json({ error: 'Falta el número destino (to)' });
  if (!twilioVoice) return res.status(503).json({ error: 'Twilio Voice no disponible' });
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = (settings.obtenerTwilioFullConfig ? settings.obtenerTwilioFullConfig().webhookBaseUrl : '') ||
      process.env.WEBHOOK_BASE_URL ||
      `${proto}://${req.headers.host}`;
    const data = await twilioVoice.default.hacerLlamadaSaliente({ to, agentId: agent_id, baseUrl });
    res.json({ success: true, call_sid: data.sid, status: data.status });
  } catch (err) {
    console.error('❌ Error en Click-to-Call:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NUEVO: GET /api/twilio/calls — Historial de llamadas ───
app.get('/api/twilio/calls', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const agent_id = req.query.agent_id || null;
    const direction = req.query.direction || null;
    const llamadas = callsDb.obtenerLlamadas({ limit, agent_id, direction });
    res.json({ success: true, count: llamadas.length, data: llamadas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NUEVO: POST /api/settings/api-keys — Guardar credenciales desde UI ───
app.put('/api/settings/api-keys', (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber, geminiKey, openaiKey, webhookBaseUrl } = req.body;
    const ok = settings.guardarApiKeysVoz({ accountSid, authToken, phoneNumber, geminiKey, openaiKey, webhookBaseUrl });
    // Re-inicializar Twilio con las nuevas credenciales
    if (twilioVoice && (accountSid || authToken)) {
      twilioVoice.default.initTwilio();
    }
    res.json({ success: ok, message: ok ? 'Credenciales guardadas. Twilio reinicializado.' : 'Error guardando credenciales' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GESTIÓN DE AGENTES DE VOZ ---
app.get('/api/agentes', (req, res) => {
  try {
    const agentes = agentesVoz.obtenerAgentes();
    res.json({ success: true, count: agentes.length, data: agentes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/agentes', (req, res) => {
  try {
    const nuevoAgente = agentesVoz.crearAgente(req.body);
    res.status(201).json({ success: true, data: nuevoAgente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/agentes/:id', (req, res) => {
  try {
    const agenteActualizado = agentesVoz.actualizarAgente(req.params.id, req.body);
    res.json({ success: true, data: agenteActualizado });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.delete('/api/agentes/:id', (req, res) => {
  try {
    agentesVoz.eliminarAgente(req.params.id);
    res.json({ success: true, message: 'Agente eliminado exitosamente' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ─── NUEVO: POST /api/agentes/:id/test-call — Llamada de prueba a agente específico
app.post('/api/agentes/:id/test-call', async (req, res) => {
  const { id } = req.params;
  const { phone_number, notes } = req.body;
  if (!phone_number) return res.status(400).json({ error: 'Falta phone_number' });
  if (!twilioVoice) return res.status(503).json({ error: 'Twilio Voice no disponible' });
  const agentes = agentesVoz.obtenerAgentes();
  const agente = agentes.find(a => a.id === id);
  if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = (settings.obtenerTwilioFullConfig ? settings.obtenerTwilioFullConfig().webhookBaseUrl : '') ||
      process.env.WEBHOOK_BASE_URL ||
      `${proto}://${req.headers.host}`;
    const data = await twilioVoice.default.hacerLlamadaSaliente({ to: phone_number, agentId: id, baseUrl });
    res.json({ success: true, call_sid: data.sid, status: data.status, agent: agente.nombre, notes });
  } catch (err) {
    console.error('❌ Error en test-call:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NUEVO: GET /api/agentes/:id/test-calls — Historial de llamadas del agente
app.get('/api/agentes/:id/test-calls', (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const llamadas = callsDb.obtenerLlamadas({ limit, agent_id: id });
    res.json({ success: true, count: llamadas.length, data: llamadas });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- WHATSAPP ---

// Webhook: Mensaje entrante de WhatsApp
app.post('/api/whatsapp/webhook', async (req, res) => {
  if (!whatsapp || !aiAgent || !documentValidator) {
    return res.status(503).send('WhatsApp no configurado');
  }
  await whatsapp.default.handleIncomingMessage(
    req, res,
    aiAgent.default.procesarConIA,
    documentValidator.default.validarDocumento
  );
});

// --- CHAT WEB ---

// Procesar mensaje del chat web
app.post('/api/chat', async (req, res) => {
  const { mensaje, sesionId, historial = [] } = req.body;

  if (!mensaje) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  try {
    if (aiAgent) {
      const resultado = await aiAgent.default.procesarConIA(mensaje, {
        canal: 'web',
        sesion: { historial, datos: req.body.datos || {} }
      });
      res.json(resultado);
    } else {
      // Fallback sin IA
      res.json({
        mensaje: 'El servicio de IA no está disponible. Por favor usa la calculadora directa.',
        error: 'IA no configurada'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- VALIDACIÓN DE DOCUMENTOS ---

// Subir y validar documento
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

app.post('/api/documentos/validar', upload.single('documento'), async (req, res) => {
  if (!documentValidator) {
    return res.status(503).json({ error: 'Validador no disponible' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  try {
    const resultado = await documentValidator.default.validarDocumento({
      url: req.file.path,
      tipo: req.file.mimetype,
      nombre: req.file.originalname
    });
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tipos de documentos válidos
app.get('/api/documentos/tipos', (req, res) => {
  if (!documentValidator) {
    return res.json({});
  }
  res.json(documentValidator.default.TIPOS_DOCUMENTO);
});

// ============================================
// SISTEMA DE FEEDBACK / RATING
// ============================================

// Registrar feedback (thumbs up/down)
app.post('/api/feedback', (req, res) => {
  try {
    const { pregunta, respuesta, rating, canal, comentario, modalidad } = req.body;

    if (!pregunta || !respuesta || rating === undefined) {
      return res.status(400).json({
        error: 'Datos requeridos: pregunta, respuesta, rating (1 o -1)'
      });
    }

    const resultado = feedback.registrarFeedback({
      pregunta,
      respuesta,
      rating: parseInt(rating),
      canal: canal || 'web',
      comentario: comentario || '',
      modalidad: modalidad || null
    });

    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener estadísticas de feedback
app.get('/api/feedback/stats', (req, res) => {
  try {
    const stats = feedback.obtenerEstadisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener patrones buenos/malos para mejorar prompts
app.get('/api/feedback/patrones', (req, res) => {
  try {
    const patrones = feedback.obtenerPatronesParaPrompt();
    res.json(patrones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener respuestas recientes para revisión
app.get('/api/feedback/recientes', (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 20;
    const soloNegativas = req.query.negativas === 'true';
    const respuestas = feedback.obtenerRespuestasRecientes(limite, soloNegativas);
    res.json(respuestas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar todos los datos de feedback (para análisis)
app.get('/api/feedback/export', (req, res) => {
  try {
    const datos = feedback.exportarDatos();
    res.json(datos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS DE CONFIGURACIÓN (SETTINGS)
// ============================================

// Obtener configuración (sin secretos - solo opciones del cliente)
app.get('/api/settings', (req, res) => {
  try {
    const config = settings.obtenerSettingsSeguro();

    // Inyectar el estado REAL de los canales inicializados
    config.servicios = {
      ...config.servicios,
      twilio: canalesActivos.twilio,
      whatsapp: canalesActivos.whatsapp,
      telegram: canalesActivos.telegram,
      deepgram: canalesActivos.deepgram,
      llmConfigurado: canalesActivos.llm
    };

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de voz (sin API key)
app.post('/api/settings/voz', (req, res) => {
  try {
    const { speakModel, listenModel, listenLanguage, audioEncoding, audioSampleRate } = req.body;
    const ok = settings.guardarVozConfig({ speakModel, listenModel, listenLanguage, audioEncoding, audioSampleRate });

    if (ok) {
      res.json({ success: true, mensaje: 'Configuración de voz guardada' });
    } else {
      res.status(500).json({ error: 'Error guardando configuración' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de LLM (sin API key)
app.post('/api/settings/llm', (req, res) => {
  try {
    const { provider, temperature } = req.body;
    const ok = settings.guardarLlmConfig({ provider, temperature });

    if (ok) {
      res.json({ success: true, mensaje: 'Configuración de IA guardada' });
    } else {
      res.status(500).json({ error: 'Error guardando configuración' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar valores IMSS
app.post('/api/settings/imss', (req, res) => {
  try {
    const { año, uma, salarioMinimo } = req.body;
    const ok = settings.guardarImss({ año, uma, salarioMinimo });

    if (ok) {
      res.json({ success: true, mensaje: 'Valores IMSS guardados' });
    } else {
      res.status(500).json({ error: 'Error guardando valores' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar estado de servicios (lee de env vars)
app.get('/api/settings/status', (req, res) => {
  try {
    const estado = settings.obtenerEstadoServicios();
    res.json(estado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Probar conexión con Twilio (lee de env vars)
app.post('/api/settings/test-twilio', async (req, res) => {
  try {
    const config = settings.obtenerTwilio();

    if (!config.accountSid || !config.authToken) {
      return res.json({ conectado: false, error: 'Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en Railway' });
    }

    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);
    const account = await client.api.accounts(config.accountSid).fetch();

    res.json({
      conectado: true,
      cuenta: {
        nombre: account.friendlyName,
        estado: account.status,
        tipo: account.type
      }
    });
  } catch (error) {
    res.json({ conectado: false, error: error.message });
  }
});

// Probar conexión con Deepgram
app.post('/api/settings/test-deepgram', async (req, res) => {
  try {
    const keys = settings.obtenerApiKeys();
    const result = await connectivity.verificarDeepgram(keys.deepgram);
    res.json({ conectado: result.ok, error: result.error });
  } catch (error) {
    res.json({ conectado: false, error: error.message });
  }
});

// Probar conexión con LLMs
app.post('/api/settings/test-llm/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const keys = settings.obtenerApiKeys();
    const result = await connectivity.verificarLLM(provider, keys[provider]);
    res.json({ conectado: result.ok, error: result.error });
  } catch (error) {
    res.json({ conectado: false, error: error.message });
  }
});

// Probar conexión con Telegram (lee de env vars)
app.post('/api/settings/test-telegram', async (req, res) => {
  try {
    const config = settings.obtenerTelegram();

    if (!config.botToken) {
      return res.json({ conectado: false, error: 'Configure TELEGRAM_BOT_TOKEN en Railway' });
    }

    // Verificar bot con API de Telegram
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      res.json({
        conectado: true,
        bot: {
          username: data.result.username,
          nombre: data.result.first_name,
          id: data.result.id
        }
      });
    } else {
      res.json({
        conectado: false,
        error: data.description || 'Token inválido'
      });
    }
  } catch (error) {
    res.json({
      conectado: false,
      error: error.message
    });
  }
});

// Listar números
app.get('/api/settings/numeros', (req, res) => {
  try {
    const numeros = settings.obtenerNumeros();
    res.json(numeros);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar número
app.post('/api/settings/numeros', (req, res) => {
  try {
    const { nombre, numero, tipo, activo } = req.body;

    if (!numero) {
      return res.status(400).json({ error: 'Número es requerido' });
    }

    const nuevoNumero = settings.agregarNumero({ nombre, numero, tipo, activo });
    res.json({ success: true, numero: nuevoNumero });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar número
app.put('/api/settings/numeros/:id', (req, res) => {
  try {
    const { id } = req.params;
    const datos = req.body;

    const numeroActualizado = settings.actualizarNumero(id, datos);

    if (!numeroActualizado) {
      return res.status(404).json({ error: 'Número no encontrado' });
    }

    res.json({ success: true, numero: numeroActualizado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar número
app.delete('/api/settings/numeros/:id', (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = settings.eliminarNumero(id);

    if (!eliminado) {
      return res.status(404).json({ error: 'Número no encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINTS DE PROVEEDORES MULTI-IA
// ============================================

// Importar routers de proveedores
let llmRouter = null;
let ttsRouter = null;
let providersRegistry = null;

async function loadProviders() {
  try {
    providersRegistry = await import('./providers/index.js');
    llmRouter = await import('./providers/llm-router.js');
    ttsRouter = await import('./providers/tts-router.js');
    console.log('✓ Provider routers cargados');
  } catch (e) {
    console.error('Error cargando providers:', e.message);
  }
}
loadProviders();

// Obtener lista de todos los proveedores disponibles
app.get('/api/providers', async (req, res) => {
  try {
    if (!providersRegistry) await loadProviders();

    res.json({
      llm: providersRegistry.LLM_PROVIDERS,
      tts: providersRegistry.TTS_PROVIDERS,
      stt: providersRegistry.STT_PROVIDERS,
      channels: providersRegistry.CHANNELS
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estado de conexión de todos los proveedores
app.get('/api/providers/status', async (req, res) => {
  try {
    if (!providersRegistry) await loadProviders();

    const status = providersRegistry.getAllProvidersStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener configuración actual de proveedores
app.get('/api/providers/config', (req, res) => {
  try {
    const config = settings.obtenerProviderConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de proveedores
app.post('/api/providers/config', (req, res) => {
  try {
    const ok = settings.guardarProviderConfig(req.body);
    if (llmRouter) llmRouter.refreshConfig();

    if (ok) {
      res.json({ success: true, mensaje: 'Configuración de proveedores guardada' });
    } else {
      res.status(500).json({ error: 'Error guardando configuración' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar proveedor LLM por defecto
app.post('/api/providers/llm/default', (req, res) => {
  try {
    const { provider } = req.body;
    const ok = settings.setDefaultLLMProvider(provider);
    if (llmRouter) llmRouter.refreshConfig();

    res.json({ success: ok, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar proveedor LLM por canal
app.post('/api/providers/llm/channel', (req, res) => {
  try {
    const { channel, provider } = req.body;
    const ok = settings.setChannelLLMProvider(channel, provider);
    if (llmRouter) llmRouter.refreshConfig();

    res.json({ success: ok, channel, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar proveedor TTS por defecto
app.post('/api/providers/tts/default', (req, res) => {
  try {
    const { provider } = req.body;
    const ok = settings.setDefaultTTSProvider(provider);

    res.json({ success: ok, provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar voz de un proveedor TTS
app.post('/api/providers/tts/voice', (req, res) => {
  try {
    const { provider, voice } = req.body;
    const ok = settings.setTTSVoice(provider, voice);

    res.json({ success: ok, provider, voice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Probar un proveedor LLM específico
app.post('/api/providers/test/llm/:provider', async (req, res) => {
  try {
    if (!llmRouter) await loadProviders();

    const { provider } = req.params;
    const { message } = req.body;

    const result = await llmRouter.testProvider(provider, message || '¿Cuánto es 2+2? Responde solo el número.');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Probar todos los proveedores LLM
app.post('/api/providers/test/llm', async (req, res) => {
  try {
    if (!llmRouter) await loadProviders();

    const { message } = req.body;
    const results = await llmRouter.testAllProviders(message || '¿Cuánto es 2+2? Responde solo el número.');
    res.json(results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Probar un proveedor TTS específico
app.post('/api/providers/test/tts/:provider', async (req, res) => {
  try {
    if (!ttsRouter) await loadProviders();

    const { provider } = req.params;
    const { text } = req.body;

    const result = await ttsRouter.testTTSProvider(provider, text || 'Hola, esta es una prueba de voz.');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generar audio de prueba
app.post('/api/providers/tts/generate', async (req, res) => {
  try {
    if (!ttsRouter) await loadProviders();

    const { text, provider, voice } = req.body;

    const result = await ttsRouter.routeTTS(text || 'Hola, esta es una prueba.', {
      preferredProvider: provider,
      voice
    });

    if (result.twiml) {
      // Es Amazon Polly via Twilio - devolver configuración
      res.json({ success: true, twiml: true, config: result });
    } else {
      // Guardar audio en cache y devolver ID
      const audioId = ttsRouter.cacheAudio(result.audio, result.provider, result.voice);
      res.json({
        success: true,
        audioId,
        provider: result.provider,
        voice: result.voice,
        latency: result.latency,
        size: result.size,
        audioUrl: `/api/tts/${audioId}`
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener configuración completa del dashboard
app.get('/api/providers/dashboard', (req, res) => {
  try {
    const config = settings.obtenerDashboardConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENTRENAMIENTO DEL AGENTE IA
// ============================================

// Obtener todo el entrenamiento
app.get('/api/training', (req, res) => {
  try {
    const data = training.obtenerTraining();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- REGLAS ---
app.post('/api/training/reglas', (req, res) => {
  try {
    const regla = training.agregarRegla(req.body);
    res.json({ success: true, data: regla });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/training/reglas/:id', (req, res) => {
  try {
    const regla = training.actualizarRegla(req.params.id, req.body);
    if (!regla) {
      return res.status(404).json({ success: false, error: 'Regla no encontrada' });
    }
    res.json({ success: true, data: regla });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/training/reglas/:id', (req, res) => {
  try {
    const eliminado = training.eliminarRegla(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Regla no encontrada' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- FAQ ---
app.post('/api/training/faq', (req, res) => {
  try {
    const faq = training.agregarFaq(req.body);
    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/training/faq/:id', (req, res) => {
  try {
    const faq = training.actualizarFaq(req.params.id, req.body);
    if (!faq) {
      return res.status(404).json({ success: false, error: 'FAQ no encontrada' });
    }
    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/training/faq/:id', (req, res) => {
  try {
    const eliminado = training.eliminarFaq(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'FAQ no encontrada' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CONOCIMIENTO ---
app.post('/api/training/conocimiento', (req, res) => {
  try {
    const conocimiento = training.agregarConocimiento(req.body);
    res.json({ success: true, data: conocimiento });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/training/conocimiento/:id', (req, res) => {
  try {
    const conocimiento = training.actualizarConocimiento(req.params.id, req.body);
    if (!conocimiento) {
      return res.status(404).json({ success: false, error: 'Conocimiento no encontrado' });
    }
    res.json({ success: true, data: conocimiento });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/training/conocimiento/:id', (req, res) => {
  try {
    const eliminado = training.eliminarConocimiento(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Conocimiento no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- EJEMPLOS ---
app.post('/api/training/ejemplos', (req, res) => {
  try {
    const ejemplo = training.agregarEjemplo(req.body);
    res.json({ success: true, data: ejemplo });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/training/ejemplos/:id', (req, res) => {
  try {
    const ejemplo = training.actualizarEjemplo(req.params.id, req.body);
    if (!ejemplo) {
      return res.status(404).json({ success: false, error: 'Ejemplo no encontrado' });
    }
    res.json({ success: true, data: ejemplo });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/training/ejemplos/:id', (req, res) => {
  try {
    const eliminado = training.eliminarEjemplo(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ success: false, error: 'Ejemplo no encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CONFIGURACION DEL AGENTE ---
app.put('/api/training/configuracion', (req, res) => {
  try {
    const config = training.actualizarConfiguracion(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener prompt generado (para debug)
app.get('/api/training/prompt', (req, res) => {
  try {
    const prompt = training.generarPromptEntrenamiento();
    res.json({ success: true, data: prompt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SISTEMA CRM - PROSPECTOS, CLIENTES, PAGOS
// ============================================

// --- PROSPECTOS ---

// Crear prospecto
app.post('/api/crm/prospectos', (req, res) => {
  try {
    const prospecto = crm.prospectos.crearProspecto(req.body);
    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener todos los prospectos
app.get('/api/crm/prospectos', (req, res) => {
  try {
    const filtros = {
      estatus: req.query.estatus,
      modalidad: req.query.modalidad,
      origen: req.query.origen
    };
    const prospectos = crm.prospectos.obtenerProspectos(filtros);
    res.json({ success: true, data: prospectos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener prospecto por ID
app.get('/api/crm/prospectos/:id', (req, res) => {
  try {
    const prospecto = crm.prospectos.obtenerProspectoPorId(req.params.id);
    if (!prospecto) {
      return res.status(404).json({ success: false, error: 'Prospecto no encontrado' });
    }
    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar prospectos
app.get('/api/crm/prospectos/buscar/:termino', (req, res) => {
  try {
    const resultados = crm.prospectos.buscarProspecto(req.params.termino);
    res.json({ success: true, data: resultados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar prospecto
app.put('/api/crm/prospectos/:id', (req, res) => {
  try {
    const prospecto = crm.prospectos.actualizarProspecto(req.params.id, req.body);
    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Registrar contacto con prospecto
app.post('/api/crm/prospectos/:id/contacto', (req, res) => {
  try {
    const prospecto = crm.prospectos.registrarContacto(req.params.id, req.body);
    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Agregar nota a prospecto
app.post('/api/crm/prospectos/:id/notas', (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) {
      return res.status(400).json({ success: false, error: 'Texto de la nota es requerido' });
    }
    const prospecto = crm.prospectos.agregarNota(req.params.id, texto);
    res.json({ success: true, data: prospecto });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener prospectos pendientes de contacto
app.get('/api/crm/prospectos-pendientes', (req, res) => {
  try {
    const pendientes = crm.prospectos.obtenerProspectosPendientes();
    res.json({ success: true, data: pendientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Estadísticas de prospectos
app.get('/api/crm/prospectos-stats', (req, res) => {
  try {
    const stats = crm.prospectos.obtenerEstadisticasProspectos();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CLIENTES ---

// Convertir prospecto a cliente
app.post('/api/crm/prospectos/:id/convertir', (req, res) => {
  try {
    const cliente = crm.clientes.convertirProspectoACliente(req.params.id, req.body);
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Crear cliente directo (sin prospecto)
app.post('/api/crm/clientes', (req, res) => {
  try {
    const cliente = crm.clientes.crearCliente(req.body);
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener todos los clientes
app.get('/api/crm/clientes', (req, res) => {
  try {
    const filtros = {
      estatus: req.query.estatus,
      modalidad: req.query.modalidad,
      pagoPendiente: req.query.pagoPendiente === 'true'
    };
    const clientes = crm.clientes.obtenerClientes(filtros);
    res.json({ success: true, data: clientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener cliente por ID
app.get('/api/crm/clientes/:id', (req, res) => {
  try {
    const cliente = crm.clientes.obtenerClientePorId(req.params.id);
    if (!cliente) {
      return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
    }
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Buscar clientes
app.get('/api/crm/clientes/buscar/:termino', (req, res) => {
  try {
    const resultados = crm.clientes.buscarCliente(req.params.termino);
    res.json({ success: true, data: resultados });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar cliente
app.put('/api/crm/clientes/:id', (req, res) => {
  try {
    const cliente = crm.clientes.actualizarCliente(req.params.id, req.body);
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Registrar pago de cliente
app.post('/api/crm/clientes/:id/pagos', (req, res) => {
  try {
    const cliente = crm.clientes.registrarPagoCliente(req.params.id, req.body);
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Actualizar vigencia del cliente
app.post('/api/crm/clientes/:id/vigencia', (req, res) => {
  try {
    const cliente = crm.clientes.actualizarVigencia(req.params.id, req.body);
    res.json({ success: true, data: cliente });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener clientes con pago pendiente
app.get('/api/crm/clientes-pago-pendiente', (req, res) => {
  try {
    const clientes = crm.clientes.obtenerClientesPagoPendiente();
    res.json({ success: true, data: clientes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Estadísticas de clientes
app.get('/api/crm/clientes-stats', (req, res) => {
  try {
    const stats = crm.clientes.obtenerEstadisticasClientes();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PAGOS ---

// Registrar pago recibido (para hacer match)
app.post('/api/crm/pagos/recibidos', (req, res) => {
  try {
    const resultado = crm.pagos.registrarPagoRecibido(req.body);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Match manual de pago con cliente
app.post('/api/crm/pagos/:pagoId/match/:clienteId', (req, res) => {
  try {
    const resultado = crm.pagos.matchManual(req.params.pagoId, req.params.clienteId);
    res.json({ success: true, data: resultado });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Confirmar match de pago
app.post('/api/crm/pagos/:pagoId/confirmar', (req, res) => {
  try {
    const pago = crm.pagos.confirmarMatch(req.params.pagoId);
    res.json({ success: true, data: pago });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Marcar pago como pagado en IMSS
app.post('/api/crm/pagos/:pagoId/pagado-imss', (req, res) => {
  try {
    const pago = crm.pagos.marcarPagadoIMSS(req.params.pagoId, req.body);
    res.json({ success: true, data: pago });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtener pagos pendientes de match
app.get('/api/crm/pagos/pendientes-match', (req, res) => {
  try {
    const pagos = crm.pagos.obtenerPagosPendientesMatch();
    res.json({ success: true, data: pagos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener pagos pendientes de pago IMSS
app.get('/api/crm/pagos/pendientes-imss', (req, res) => {
  try {
    const pagos = crm.pagos.obtenerPagosPendientesIMSS();
    res.json({ success: true, data: pagos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Historial de pagos
app.get('/api/crm/pagos/historial', (req, res) => {
  try {
    const filtros = {
      clienteId: req.query.clienteId,
      metodo: req.query.metodo,
      estatus: req.query.estatus,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta
    };
    const pagos = crm.pagos.obtenerHistorialPagos(filtros);
    res.json({ success: true, data: pagos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Estadísticas de pagos
app.get('/api/crm/pagos-stats', (req, res) => {
  try {
    const stats = crm.pagos.obtenerEstadisticasPagos();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- NOTIFICACIONES ---

// Generar recordatorios de pago
app.get('/api/crm/notificaciones/recordatorios', (req, res) => {
  try {
    const recordatorios = crm.notificaciones.generarRecordatoriosPago();
    res.json({ success: true, data: recordatorios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generar mensaje de bienvenida
app.get('/api/crm/notificaciones/bienvenida/:clienteId', (req, res) => {
  try {
    const mensaje = crm.notificaciones.generarMensajeBienvenida(req.params.clienteId);
    res.json({ success: true, data: mensaje });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Generar mensaje de pago recibido
app.post('/api/crm/notificaciones/pago-recibido/:clienteId', (req, res) => {
  try {
    const mensaje = crm.notificaciones.generarMensajePagoRecibido(req.params.clienteId, req.body);
    res.json({ success: true, data: mensaje });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Generar mensaje de vigencia confirmada
app.post('/api/crm/notificaciones/vigencia/:clienteId', (req, res) => {
  try {
    const mensaje = crm.notificaciones.generarMensajeVigencia(req.params.clienteId, req.body);
    res.json({ success: true, data: mensaje });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Generar mensaje de confirmación de match
app.post('/api/crm/notificaciones/confirmar-match/:clienteId', (req, res) => {
  try {
    const mensaje = crm.notificaciones.generarMensajeConfirmarMatch(req.params.clienteId, req.body);
    res.json({ success: true, data: mensaje });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Dashboard CRM - resumen general
app.get('/api/crm/dashboard', (req, res) => {
  try {
    const dashboard = {
      prospectos: crm.prospectos.obtenerEstadisticasProspectos(),
      clientes: crm.clientes.obtenerEstadisticasClientes(),
      pagos: crm.pagos.obtenerEstadisticasPagos(),
      pendientes: {
        prospectosPorContactar: crm.prospectos.obtenerProspectosPendientes().length,
        pagosPorMatch: crm.pagos.obtenerPagosPendientesMatch().length,
        pagosPorIMSS: crm.pagos.obtenerPagosPendientesIMSS().length,
        clientesPagoPendiente: crm.clientes.obtenerClientesPagoPendiente().length
      }
    };
    res.json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/status', (req, res) => {
  let feedbackStats = null;
  try {
    feedbackStats = feedback.obtenerEstadisticas();
  } catch (e) { }

  let crmStats = null;
  try {
    crmStats = {
      prospectos: crm.prospectos.obtenerEstadisticasProspectos().total,
      clientes: crm.clientes.obtenerEstadisticasClientes().total,
      pagosPendientes: crm.pagos.obtenerPagosPendientesMatch().length
    };
  } catch (e) { }

  res.json({
    status: 'ok',
    version: '3.5.0',
    features: [
      'calculo-mod40',
      'calculo-mod10',
      'calculo-mod33',
      'trabajadoras-hogar',
      'divisiones-ocupacionales',
      'periodos-pago-multiples',
      'validacion-elegibilidad',
      'comparativa-ley73-ley97',
      'feedback-training',
      'rag',
      'agente',
      'diagnostico',
      'crm-prospectos',
      'crm-clientes',
      'crm-pagos',
      'crm-notificaciones'
    ],
    canales: {
      web: true,
      twilio: canalesActivos.twilio,
      whatsapp: canalesActivos.whatsapp,
      telegram: canalesActivos.telegram
    },
    uma_vigente: db.obtenerUMA()?.diario || 113.14,
    feedback: feedbackStats ? {
      total: feedbackStats.general.total,
      tasaPositiva: feedbackStats.general.tasaPositiva
    } : null,
    crm: crmStats
  });
});


// Fallback SPA - servir index.html para cualquier ruta no-API
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// (Graceful shutdown consolidado arriba en gracefulShutdownMain)

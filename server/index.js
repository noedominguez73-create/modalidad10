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
import training from './training.js';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3040;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Requerido para webhooks de Twilio

// Diagnóstico Global de Peticiones
app.use((req, res, next) => {
  const logEntry = `${new Date().toISOString()} | ${req.method} | ${req.url} | Body: ${JSON.stringify(req.body)} | IP: ${req.ip}\n`;
  try {
    const logPath = join(__dirname, 'data', 'requests.log');
    appendFileSync(logPath, logEntry);
  } catch (e) {
    console.error('Error en logger global:', e.message);
  }
  next();
});
app.use(express.static('client/dist'));

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
let twilioVoice, whatsapp, telegram, aiAgent, documentValidator;

async function initChannels() {
  // Primero cargar el agente IA (necesario para todos los canales)
  try {
    aiAgent = await import('./ai-agent.js');
    console.log('✓ Agente IA cargado');
  } catch (e) {
    console.log('❌ Error cargando Agente IA:', e.message);
  }

  try {
    documentValidator = await import('./documents/validator.js');
    console.log('✓ Validador de documentos cargado');
  } catch (e) {
    console.log('⚠ Validador de documentos no disponible:', e.message);
  }

  // Cargar Twilio Voice
  try {
    twilioVoice = await import('./channels/twilio-voice.js');
    const initialized = twilioVoice.default.initTwilio();
    if (initialized) {
      console.log('✓ Twilio Voice listo');
    }
  } catch (e) { console.log('⚠ Twilio Voice no disponible:', e.message); }

  // Cargar WhatsApp
  try {
    whatsapp = await import('./channels/whatsapp.js');
    whatsapp.default.initWhatsApp();
  } catch (e) { console.log('⚠ WhatsApp no disponible:', e.message); }

  // Cargar Telegram (con delay para evitar conflicto con instancia anterior)
  try {
    telegram = await import('./channels/telegram.js');
    if (aiAgent && documentValidator) {
      // Esperar 3 segundos para que la instancia anterior cierre
      console.log('⏳ Esperando para iniciar Telegram...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      telegram.default.initTelegram(
        aiAgent.default.procesarConIA,
        documentValidator.default.validarDocumento
      );
    }
  } catch (e) { console.log('⚠ Telegram no disponible:', e.message); }
}

// Inicializar canales al arrancar
initChannels().then(() => {
  console.log('🚀 Todos los canales cargados y listos');
}).catch(err => {
  console.error('💥 Error crítico inicializando canales:', err);
});

// --- TWILIO VOICE (Llamadas telefónicas) ---

// Webhook: Llamada entrante
app.post('/api/twilio/voice', (req, res) => {
  const { Called, Caller, CallSid } = req.body;
  console.log(`📞 [TWILIO] Llamada entrante: ${Caller} -> ${Called} (SID: ${CallSid})`);

  if (!twilioVoice) {
    console.error('❌ Twilio Voice no está cargado en el servidor');
    return res.status(503).type('text/plain').send('Servicio de voz no disponible temporalmente. Reintenta en unos segundos.');
  }

  try {
    twilioVoice.default.handleIncomingCall(req, res);
  } catch (err) {
    console.error('❌ Error en handleIncomingCall:', err);
    res.status(500).send('Error interno procesando llamada');
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
    await twilioVoice.default.handleVoiceInput(req, res, aiAgent.default.procesarConIA);
  } catch (err) {
    console.error('❌ Error en handleVoiceInput:', err);
    res.status(500).send('Error procesando voz');
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
    res.json({
      conectado: false,
      error: error.message
    });
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
      twilio: !!twilioVoice,
      whatsapp: !!whatsapp,
      telegram: !!telegram
    },
    uma_vigente: db.obtenerUMA()?.diario || 113.14,
    feedback: feedbackStats ? {
      total: feedbackStats.general.total,
      tasaPositiva: feedbackStats.general.tasaPositiva
    } : null,
    crm: crmStats
  });
});

// Endpoint para ver los logs de voz (DIAGNÓSTICO)
app.get('/api/debug/voice-logs', (req, res) => {
  try {
    const logPath = join(__dirname, 'data', 'voice-debug.json');
    if (!existsSync(logPath)) {
      return res.json({ message: 'No hay logs aún o el archivo no existe.', path: logPath });
    }
    const logs = JSON.parse(readFileSync(logPath, 'utf8'));
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Limpiar logs
app.post('/api/debug/voice-logs/clear', (req, res) => {
  try {
    const logPath = join(__dirname, 'data', 'voice-debug.json');
    writeFileSync(logPath, JSON.stringify([], null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para ver TODOS los logs de peticiones
app.get('/api/debug/all-logs', (req, res) => {
  try {
    const logPath = join(__dirname, 'data', 'requests.log');
    if (!existsSync(logPath)) {
      return res.send('No hay logs de peticiones aún.');
    }
    const content = readFileSync(logPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Limpiar todos los logs
app.post('/api/debug/all-logs/clear', (req, res) => {
  try {
    const logPath = join(__dirname, 'data', 'requests.log');
    writeFileSync(logPath, '');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback SPA - servir index.html para cualquier ruta no-API
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  🧮 CALCULADORA IMSS MULTICANAL + CRM v3.5                        ║
║  ═══════════════════════════════════════════════════════════════  ║
║                                                                   ║
║  📊 Mod 40 (Pensión) | 📋 Mod 10 (Completo) | 🏥 Mod 33 (Médico)  ║
║  🏠 Trabajadoras Hogar | 🏢 Divisiones IMSS | 👍 Feedback         ║
║                                                                   ║
║  📋 CRM: Prospectos → Clientes → Pagos → IMSS → Vigencia          ║
║                                                                   ║
║  ENDPOINTS:                                                       ║
║  🌐 Dashboard:        http://localhost:${PORT}                       ║
║  📡 API:              http://localhost:${PORT}/api                   ║
║  📋 CRM Dashboard:    http://localhost:${PORT}/api/crm/dashboard     ║
║  👥 Prospectos:       http://localhost:${PORT}/api/crm/prospectos    ║
║  🧑‍💼 Clientes:         http://localhost:${PORT}/api/crm/clientes      ║
║  💰 Pagos:            http://localhost:${PORT}/api/crm/pagos         ║
║  📞 Twilio Voice:     http://localhost:${PORT}/api/twilio/voice      ║
║  📱 WhatsApp:         http://localhost:${PORT}/api/whatsapp/webhook  ║
║                                                                   ║
║  UMA 2026: $117.31 | Tope: $2,932.75 diarios                      ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
});

// Manejo de cierre limpio (Railway SIGTERM)
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} recibido. Cerrando servicios...`);

  // Detener Telegram polling
  if (telegram && telegram.default && telegram.default.stopTelegram) {
    try {
      telegram.default.stopTelegram();
    } catch (e) {
      // Ignorar errores
    }
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

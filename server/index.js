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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3040;

app.use(cors());
app.use(express.json());
app.use(express.static('client/dist'));

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
  try {
    twilioVoice = await import('./channels/twilio-voice.js');
    twilioVoice.default.initTwilio();
  } catch (e) { console.log('Twilio Voice no disponible:', e.message); }

  try {
    whatsapp = await import('./channels/whatsapp.js');
    whatsapp.default.initWhatsApp();
  } catch (e) { console.log('WhatsApp no disponible:', e.message); }

  try {
    aiAgent = await import('./ai-agent.js');
    documentValidator = await import('./documents/validator.js');

    telegram = await import('./channels/telegram.js');
    telegram.default.initTelegram(
      aiAgent.default.procesarConIA,
      documentValidator.default.validarDocumento
    );
  } catch (e) { console.log('Telegram no disponible:', e.message); }
}

// Inicializar canales al arrancar
initChannels();

// --- TWILIO VOICE (Llamadas telefónicas) ---

// Webhook: Llamada entrante
app.post('/api/twilio/voice', (req, res) => {
  if (!twilioVoice) return res.status(503).send('Twilio no configurado');
  twilioVoice.default.handleIncomingCall(req, res);
});

// Webhook: Procesar voz del usuario
app.post('/api/twilio/procesar-voz', async (req, res) => {
  if (!twilioVoice || !aiAgent) return res.status(503).send('No configurado');
  await twilioVoice.default.handleVoiceInput(req, res, aiAgent.default.procesarConIA);
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

// Obtener toda la configuración (tokens enmascarados)
app.get('/api/settings', (req, res) => {
  try {
    const config = settings.obtenerSettingsSeguro();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de Twilio
app.post('/api/settings/twilio', async (req, res) => {
  try {
    const { accountSid, authToken, webhookBaseUrl } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({ error: 'Account SID y Auth Token son requeridos' });
    }

    const ok = settings.guardarTwilio({ accountSid, authToken, webhookBaseUrl });

    if (ok) {
      // Reiniciar Twilio con nuevas credenciales
      if (twilioVoice) {
        twilioVoice.default.initTwilio();
      }
      res.json({ success: true, mensaje: 'Configuración de Twilio guardada' });
    } else {
      res.status(500).json({ error: 'Error guardando configuración' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar configuración de Telegram
app.post('/api/settings/telegram', async (req, res) => {
  try {
    const { botToken, botUsername } = req.body;

    if (!botToken) {
      return res.status(400).json({ error: 'Bot Token es requerido' });
    }

    const ok = settings.guardarTelegram({ botToken, botUsername });

    if (ok) {
      // Reiniciar Telegram con nuevas credenciales
      if (telegram && aiAgent && documentValidator) {
        telegram.default.initTelegram(
          aiAgent.default.procesarConIA,
          documentValidator.default.validarDocumento
        );
      }
      res.json({ success: true, mensaje: 'Configuración de Telegram guardada' });
    } else {
      res.status(500).json({ error: 'Error guardando configuración' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar API Keys
app.post('/api/settings/apikeys', (req, res) => {
  try {
    const { vision, voz, llm, browser } = req.body;
    const ok = settings.guardarApiKeys({ vision, voz, llm, browser });

    if (ok) {
      res.json({ success: true, mensaje: 'API Keys guardadas' });
    } else {
      res.status(500).json({ error: 'Error guardando API Keys' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Probar conexión con Twilio
app.post('/api/settings/test-twilio', async (req, res) => {
  try {
    const config = settings.obtenerTwilio();

    if (!config.accountSid || !config.authToken) {
      return res.json({ conectado: false, error: 'Credenciales no configuradas' });
    }

    // Intentar crear cliente y obtener info de la cuenta
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

// Probar conexión con Telegram
app.post('/api/settings/test-telegram', async (req, res) => {
  try {
    const config = settings.obtenerTelegram();

    if (!config.botToken) {
      return res.json({ conectado: false, error: 'Bot Token no configurado' });
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

// Health check
app.get('/api/status', (req, res) => {
  let feedbackStats = null;
  try {
    feedbackStats = feedback.obtenerEstadisticas();
  } catch (e) {}

  res.json({
    status: 'ok',
    version: '3.4.0',
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
      'diagnostico'
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
    } : null
  });
});

// Fallback SPA - servir index.html para cualquier ruta no-API
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  🧮 CALCULADORA IMSS MULTICANAL v3.4                              ║
║  ═══════════════════════════════════════════════════════════════  ║
║                                                                   ║
║  📊 Mod 40 (Pensión) | 📋 Mod 10 (Completo) | 🏥 Mod 33 (Médico)  ║
║  🏠 Trabajadoras Hogar | 🏢 Divisiones IMSS | 👍 Feedback         ║
║                                                                   ║
║  ENDPOINTS:                                                       ║
║  🌐 Dashboard:        http://localhost:${PORT}                       ║
║  📡 API:              http://localhost:${PORT}/api                   ║
║  🏢 Divisiones:       http://localhost:${PORT}/api/divisiones        ║
║  📅 Períodos:         http://localhost:${PORT}/api/periodos-pago     ║
║  💬 Chat Web:         http://localhost:${PORT}/api/chat              ║
║  👍 Feedback:         http://localhost:${PORT}/api/feedback          ║
║  📞 Twilio Voice:     http://localhost:${PORT}/api/twilio/voice      ║
║  📱 WhatsApp:         http://localhost:${PORT}/api/whatsapp/webhook  ║
║                                                                   ║
║  UMA 2025: $113.14 | Tope: $2,828.50 diarios                      ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
});

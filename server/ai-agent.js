/**
 * AGENTE DE IA MULTICANAL
 * Coordina el procesamiento de mensajes desde todos los canales
 * Usa el sistema de routing multi-proveedor
 */

import { calcularModalidad40, validarElegibilidadMod40 } from './calculadora.js';
import { calcularModalidad10 } from './calculadora-mod10.js';
import { calcularModalidad33 } from './calculadora-mod33.js';
import { buscarEnBaseConocimiento } from './rag/knowledge-base.js';
import { SYSTEM_PROMPT_IMSS, FLUJO_DIAGNOSTICO } from './rag/agent-prompt.js';
import { generarPromptEntrenamiento } from './training.js';
import settings from './settings.js';
import db from './database.js';
import feedbackService from './feedback.js';

// Importar router de LLM (carga diferida para evitar dependencias circulares)
let llmRouter = null;

async function getLLMRouter() {
  if (!llmRouter) {
    try {
      llmRouter = await import('./providers/llm-router.js');
    } catch (e) {
      console.error('Error cargando LLM router:', e.message);
    }
  }
  return llmRouter;
}

// Llamar al LLM usando el router con failover automático
async function llamarLLM(mensajes, opciones = {}) {
  const router = await getLLMRouter();

  if (router) {
    // Usar el nuevo router multi-proveedor
    const result = await router.routeLLM(mensajes, {
      channel: opciones.canal || 'web',
      preferredProvider: opciones.provider,
      temperature: opciones.temperature,
      maxTokens: opciones.maxTokens
    });

    console.log(`✓ Respuesta de ${result.provider} (${result.model}) en ${result.latency}ms`);
    return result.content;
  }

  // Fallback al método antiguo si el router no está disponible
  return await llamarLLMFallback(mensajes, opciones);
}

// Fallback temporal si el router falla cargando
async function llamarLLMFallback(mensajes, opciones = {}) {
  console.log('⚠️ Usando fallback directo de LLM (Router no disponible)');
  const providerConfig = settings.obtenerProviderConfig();
  const provider = opciones.provider || providerConfig.llm.default;
  const apiKey = settings.getApiKey('llm', provider);

  if (!apiKey) throw new Error(`API Key no configurada para ${provider}`);

  // Simplificado para el ejemplo
  return "Lo siento, el sistema de rutas está cargando. Por favor intenta en un momento.";
}

/**
 * FORMATEAR MONEDA PARA VOZ
 * Convierte $1,200.50 en "un mil doscientos pesos con cincuenta centavos"
 */
function formatearMonedaParaVoz(cantidad) {
  if (cantidad === undefined || cantidad === null) return "cero pesos";

  const num = parseFloat(cantidad);
  const pesos = Math.floor(num);
  const centavos = Math.round((num - pesos) * 100);

  let result = `${pesos.toLocaleString('es-MX')} pesos`;
  if (centavos > 0) {
    result += ` con ${centavos} centavos`;
  }
  return result;
}

/**
 * DETECTAR AÑO EN MENSAJE
 * Identifica si el usuario mencionó un año de inicio de cotización
 */
function detectarAnoEnMensaje(mensaje) {
  const years = mensaje.match(/\b(19|20)\d{2}\b/g);
  if (years) {
    const year = parseInt(years[0]);
    if (year >= 1940 && year <= 2026) {
      return {
        ano: year,
        ley: year < 1997 ? '73' : '97'
      };
    }
  }
  return null;
}

const palabrasANumeros = {
  'diez mil': 10000,
  'quince mil': 15000,
  'veinte mil': 20000,
  'veinticinco mil': 25000,
  'treinta mil': 30000,
  'cuarenta mil': 40000,
  'cincuenta mil': 50000,
  'sesenta mil': 60000,
  'setenta mil': 70000,
  'ochenta mil': 80000,
  'cien mil': 100000
};

/**
 * PROCESAR MENSAJE CON IA
 * @param {string} mensaje - El texto del usuario
 * @param {object} opciones - Opciones dinámicas (canal, sesion, provider, etc)
 */
export async function procesarConIA(mensaje, opciones = {}) {
  const canal = opciones.canal || 'web';
  const sesion = opciones.sesion || {};
  const historial = sesion.historial || [];
  let datosUsuario = sesion.datos || {};
  let pasoActual = sesion.paso || 'inicio';

  try {
    // === COMANDO ESPECIAL: Preguntar qué modelo está respondiendo ===
    const preguntaModelo = /\b(qu[eé]\s*(modelo|ia|inteligencia|llm)|qui[eé]n\s*(eres|responde)|eres\s*(gpt|gemini|claude|groq))\b/i;
    if (preguntaModelo.test(mensaje)) {
      const providerConfig = settings.obtenerProviderConfig();
      const llmDefault = providerConfig?.llm?.default || 'gemini';
      const llmCanal = providerConfig?.llm?.perChannel?.[canal] || llmDefault;

      return {
        mensaje: `🤖 **Información del Sistema**\n\n` +
          `- Proveedor LLM actual: **${llmCanal.toUpperCase()}**\n` +
          `- Canal: ${canal}\n` +
          `- Proveedor por defecto: ${llmDefault}\n\n` +
          `Puedes cambiar el proveedor en la pestaña "Config" del dashboard.`,
        datos: datosUsuario,
        paso: pasoActual
      };
    }

    // === PRE-PROCESAMIENTO: Detectar año en mensaje ===
    const anoDetectado = detectarAnoEnMensaje(mensaje);
    if (anoDetectado && !datosUsuario.anoInicioCotizacion) {
      console.log(`📅 Año detectado automáticamente: ${anoDetectado.ano} (Ley ${anoDetectado.ley})`);
      datosUsuario = {
        ...datosUsuario,
        anoInicioCotizacion: anoDetectado.ano,
        ley: anoDetectado.ley,
        tieneHistorial: true
      };
      // Avanzar al siguiente paso del flujo
      if (pasoActual === 'inicio' || pasoActual === 'identificar_regimen') {
        pasoActual = 'semanas_cotizadas';
      }
    }

    // --- RAG: Buscar información relevante en la base de conocimientos ---
    let contextoRAG = '';
    try {
      const resultadosRAG = buscarEnBaseConocimiento(mensaje);
      if (resultadosRAG.length > 0) {
        contextoRAG = '\n\nINFORMACIÓN DE REFERENCIA (RAG):\n';
        // Tomar los 2 resultados más relevantes
        resultadosRAG.slice(0, 2).forEach(r => {
          if (r.tipo === 'articulo') {
            contextoRAG += `### ${r.titulo} (${r.referencia}):\n${r.contenido}\n`;
          } else {
            contextoRAG += `P: ${r.pregunta}\nR: ${r.respuesta}\n`;
          }
        });
      }
    } catch (e) {
      console.log('⚠️ Error en RAG:', e.message);
    }

    // Obtener datos de referencia actuales
    const datosReferencia = db.obtenerResumenDatos();

    // Obtener patrones de feedback para mejorar respuestas
    let feedbackPatrones = { buenos: [], evitar: [] };
    try {
      feedbackPatrones = feedbackService.obtenerPatronesParaPrompt();
    } catch (e) {
      // Silenciar error si no hay feedback disponible
    }

    // Construir sección de aprendizaje de feedback
    let seccionFeedback = '';
    if (feedbackPatrones.buenos.length > 0) {
      seccionFeedback = `
APRENDIZAJE DE RESPUESTAS ANTERIORES:
Las siguientes respuestas fueron calificadas positivamente por usuarios:
${feedbackPatrones.buenos.slice(0, 3).map(p =>
        `- Contexto: ${p.contexto} | Modalidad: ${p.modalidad || 'general'}`
      ).join('\n')}

Patrones a EVITAR (respuestas mal calificadas):
${feedbackPatrones.evitar.slice(0, 2).map(p =>
        `- Contexto: ${p.contexto} | Problema: ${p.problema}`
      ).join('\n') || 'Ninguno registrado aún'}
`;
    }

    // Generar advertencia si ya tenemos el año
    let advertenciaAno = '';
    if (datosUsuario.anoInicioCotizacion) {
      advertenciaAno = `
⚠️ **IMPORTANTE - YA SABEMOS QUE EL USUARIO TIENE HISTORIAL:**
- Año de inicio: ${datosUsuario.anoInicioCotizacion}
- Ley aplicable: Ley ${datosUsuario.ley}
- EL USUARIO SÍ TIENE COTIZACIONES. NO preguntar si ha cotizado.
- NO preguntar de nuevo el año. Avanzar al siguiente paso.
- Siguiente pregunta: "¿Cuántas semanas cotizadas tienes?"
`;
    }

    // System prompt enriquecido
    const baseSystemPrompt = opciones.overridePrompt || SYSTEM_PROMPT_IMSS;
    const systemPrompt = `${baseSystemPrompt}
${advertenciaAno}
${contextoRAG}
DATOS DE REFERENCIA ACTUALIZADOS:
- UMA 2025: $${datosReferencia.uma.diario} diarios
- Salario Mínimo: $${datosReferencia.salarioMinimo.general} (centro), $${datosReferencia.salarioMinimo.frontera} (frontera)
- Cuota Modalidad 40: ${datosReferencia.cuotasModalidad40.total}%

DATOS DEL USUARIO RECOPILADOS:
${JSON.stringify(datosUsuario, null, 2)}

PASO ACTUAL DEL FLUJO: ${pasoActual}
CANAL DE COMUNICACIÓN: ${canal}
${seccionFeedback}
${generarPromptEntrenamiento()}

INSTRUCCIONES ESPECIALES SEGÚN CANAL:
${canal === 'telefono' ? `
- Estás en una LLAMADA TELEFÓNICA. Sé breve y directo.
- NO uses markdown (negritas, listas, asteriscos), la voz no puede leerlos.
- Usa frases cortas para que el usuario pueda interrumpirte (barge-in).
- Formatea cantidades de dinero así: "diez mil quinientos pesos" o "$10,500".
- NO des respuestas de más de 3 oraciones.
- Si el usuario dice algo que no entiendes, pide aclaración amablemente.` : ''}
${canal === 'whatsapp' ? '- Puedes usar emojis. Divide información larga en mensajes cortos.' : ''}
${canal === 'telegram' ? '- Puedes usar markdown (*negrita*, _cursiva_). Sugiere botones cuando sea apropiado.' : ''}
${canal === 'web' ? '- Puedes dar respuestas más detalladas con formato.' : ''}

Si el usuario proporciona datos nuevos, extráelos y devuelve en formato JSON al final:
{"nuevosDatos": {...}, "nuevoPaso": "nombre_paso"}`;

    // Construir mensajes
    const mensajes = [
      { role: 'system', content: systemPrompt },
      ...historial.slice(-10).map(h => ({
        role: h.rol === 'usuario' ? 'user' : 'assistant',
        content: h.mensaje
      })),
      { role: 'user', content: mensaje }
    ];

    try {
      // Llamar al LLM
      let respuesta = await llamarLLM(mensajes, { canal });

      // Extraer datos estructurados si los hay
      let nuevosDatos = null;
      let nuevoPaso = null;

      if (respuesta && typeof respuesta === 'string') {
        const jsonMatch = respuesta.match(/\{"nuevosDatos"[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            nuevosDatos = parsed.nuevosDatos;
            nuevoPaso = parsed.nuevoPaso;
            // Limpiar JSON de la respuesta visible
            respuesta = respuesta.replace(jsonMatch[0], '').trim();
          } catch (e) {
            console.log('⚠️ Error parseando JSON de LLM:', e.message);
          }
        }
      }

      // FALLBACK: Extraer salario directamente del mensaje del usuario
      const salarioExtraido = extraerSalarioDelMensaje(mensaje);
      if (salarioExtraido && !nuevosDatos?.salarioMensual) {
        nuevosDatos = nuevosDatos || {};
        nuevosDatos.salarioMensual = salarioExtraido;
        console.log(`💰 Salario extraído del mensaje: $${salarioExtraido}`);
      }

      // Detectar modalidad y realizar cálculos
      const datosCalculo = { ...datosUsuario, ...nuevosDatos };
      const modalidadDetectada = detectarModalidad(mensaje, datosCalculo);

      // Si tenemos salario pero no modalidad, asumir Mod 10 (el caso más común para independientes)
      const modalidadFinal = modalidadDetectada || (salarioExtraido ? 'mod10' : null);

      // Cálculos para Modalidad 40
      if (modalidadFinal === 'mod40' && tieneLosDatosParaCalcular(datosUsuario, nuevosDatos, 'mod40')) {
        try {
          const resultado = calcularModalidad40(datosCalculo);
          respuesta += formatearResultadoCalculo(resultado, canal, 'mod40');

          // Agregar advertencias de elegibilidad si existen
          if (resultado.elegibilidad && !resultado.elegibilidad.elegible) {
            respuesta += formatearErroresElegibilidad(resultado.elegibilidad, canal);
          }
        } catch (e) {
          console.error('Error en cálculo Mod 40:', e);
          respuesta += `\n\n⚠️ Error en el cálculo: ${e.message}`;
        }
      }

      // Cálculos para Modalidad 10
      if (modalidadFinal === 'mod10' && tieneLosDatosParaCalcular(datosUsuario, nuevosDatos, 'mod10')) {
        try {
          const resultado = calcularModalidad10(datosCalculo);
          respuesta += formatearResultadoCalculo(resultado, canal, 'mod10');
        } catch (e) {
          console.error('Error en cálculo Mod 10:', e);
          respuesta += `\n\n⚠️ Error en el cálculo: ${e.message}`;
        }
      }

      // Cálculos para Modalidad 33
      if (modalidadFinal === 'mod33' && tieneLosDatosParaCalcular(datosUsuario, nuevosDatos, 'mod33')) {
        try {
          const resultado = calcularModalidad33(datosCalculo);
          respuesta += formatearResultadoCalculo(resultado, canal, 'mod33');
        } catch (e) {
          console.error('Error en cálculo Mod 33:', e);
          respuesta += `\n\n⚠️ Error en el cálculo: ${e.message}`;
        }
      }

      return {
        mensaje: respuesta,
        nuevosDatos,
        nuevoPaso,
        modalidadDetectada: modalidadFinal,
        finConversacion: nuevoPaso === 'completado'
      };

    } catch (error) {
      console.error('Error en procesarConIA:', error);
      return {
        mensaje: 'Disculpa, tuve un problema procesando tu mensaje. ¿Podrías repetirlo?',
        error: error.message
      };
    }
  } catch (error) {
    console.error('Error crítico en procesarConIA:', error);
    return {
      mensaje: 'Disculpa, tuve un error crítico procesando tu mensaje. ¿Podrías repetirlo?',
      error: error.message
    };
  }
}

// Verificar si tenemos datos suficientes para calcular
function tieneLosDatosParaCalcular(datosActuales, datosNuevos, tipo) {
  const datos = { ...datosActuales, ...datosNuevos };

  if (tipo === 'mod40') {
    return datos.fechaNacimiento && datos.semanasActuales && datos.salarioDeseado;
  }

  if (tipo === 'mod10') {
    // Solo necesita salarioMensual - claseRiesgo tiene default 'I'
    return datos.salarioMensual || datos.ingresoMensual;
  }

  if (tipo === 'mod33') {
    return datos.integrantes && datos.integrantes.length > 0;
  }

  return false;
}

// Detectar qué modalidad calcular basado en el contexto
function detectarModalidad(mensaje, datosUsuario) {
  const msgLower = mensaje.toLowerCase();

  if (msgLower.includes('modalidad 33') || msgLower.includes('mod 33') ||
    msgLower.includes('seguro de salud') || msgLower.includes('seguro familiar') ||
    msgLower.includes('solo médico') || msgLower.includes('cobertura médica')) {
    return 'mod33';
  }

  if (msgLower.includes('modalidad 10') || msgLower.includes('mod 10') ||
    msgLower.includes('independiente') || msgLower.includes('freelance') ||
    msgLower.includes('cuotas patronales')) {
    return 'mod10';
  }

  // Por defecto, si tiene datos de pensión, es Mod 40
  if (datosUsuario.semanasActuales || datosUsuario.fechaNacimiento ||
    msgLower.includes('pensión') || msgLower.includes('modalidad 40') ||
    msgLower.includes('mod 40') || msgLower.includes('jubilación')) {
    return 'mod40';
  }

  return null;
}

// Extraer salario del mensaje del usuario
function extraerSalarioDelMensaje(mensaje) {
  const msgLower = mensaje.toLowerCase().trim();

  // Buscar patrones de palabras numéricas
  for (const [palabra, valor] of Object.entries(palabrasANumeros)) {
    if (msgLower.includes(palabra)) {
      console.log(`💰 Salario detectado por palabras: ${valor} (de "${palabra}")`);
      return valor;
    }
  }

  // Buscar números directamente (ej: "20000", "20,000", "20 000", "$20000")
  const numeroMatch = mensaje.replace(/[$,\s]/g, '').match(/(\d+)/);
  if (numeroMatch) {
    const numero = parseInt(numeroMatch[1], 10);
    if (numero >= 1000 && numero <= 200000) {
      console.log(`💰 Salario detectado por número: ${numero}`);
      return numero;
    }
  }

  return null;
}

// Formatear resultado de cálculo según canal y modalidad
function formatearResultadoCalculo(resultado, canal, modalidad = 'mod40') {
  // Modalidad 40
  if (modalidad === 'mod40') {
    if (canal === 'telefono') {
      return `\n\nImportante: La Modalidad 40 no incluye servicio médico. ` +
        `Tu cuota mensual sería de ${formatearMonedaParaVoz(resultado.cuotas.cuotaMensual)}. ` +
        `Tu pensión estimada es de ${formatearMonedaParaVoz(resultado.pension.mensualEstimada)} mensuales. ` +
        `Si necesitas atención médica, considera la Modalidad 10.`;
    }

    if (canal === 'whatsapp' || canal === 'telegram') {
      let texto = `

📊 *Resultado del Cálculo - Modalidad 40*

⚠️ *IMPORTANTE:* La Mod 40 NO incluye servicio médico.
No podrás atenderte en clínicas IMSS con esta modalidad.
(Si necesitas médico + pensión → considera Modalidad 10)

💰 *Cuota Modalidad 40:*
• Mensual: $${resultado.cuotas.cuotaMensual.toLocaleString()}
• Inversión total: $${resultado.cuotas.inversionTotal.toLocaleString()}

🎯 *Pensión Estimada (${resultado.datosPersonales.regimenLey}):*
• Mensual: $${resultado.pension.mensualEstimada.toLocaleString()}
• Anual: $${resultado.pension.pensionAnual.toLocaleString()}

📈 *Análisis:*
• Recuperas tu inversión en ${resultado.analisisInversion.recuperacionEnMeses} meses
• Rendimiento anual: ${resultado.analisisInversion.rendimientoAnual}%`;

      // Agregar comparativa de leyes si existe
      if (resultado.comparativaLeyes) {
        texto += `

⚖️ *Comparativa Ley 73 vs Ley 97:*
• Ley 73: $${resultado.comparativaLeyes.ley73.pensionMensual.toLocaleString()}/mes (vitalicia)
• Ley 97: $${resultado.comparativaLeyes.ley97.pensionMensual.toLocaleString()}/mes (AFORE)
📌 ${resultado.comparativaLeyes.recomendacion}`;
      }

      return texto;
    }

    // Web - formato completo
    return `\n\n## Resultado del Cálculo - Modalidad 40\n${JSON.stringify(resultado, null, 2)}`;
  }

  // Modalidad 10
  if (modalidad === 'mod10') {
    if (canal === 'telefono') {
      return `\n\nTu cuota total mensual sería de ${formatearMonedaParaVoz(resultado.totales.mensualSinInfonavit)}. ` +
        `Esto incluye ${formatearMonedaParaVoz(resultado.totales.patron)} como patrón y ${formatearMonedaParaVoz(resultado.totales.obrero)} como trabajador.`;
    }

    if (canal === 'whatsapp' || canal === 'telegram') {
      return `

📊 *Resultado del Cálculo - Modalidad 10*

💼 *Datos de cotización:*
• Salario mensual: $${resultado.datos.salarioMensual.toLocaleString()}
• Clase de riesgo: ${resultado.datos.claseRiesgo}
• Mes: ${resultado.datos.mes} (${resultado.datos.diasMes} días)

💰 *Cuotas Mensuales:*
• Cuota patrón: $${resultado.totales.patron.toLocaleString()}
• Cuota obrero: $${resultado.totales.obrero.toLocaleString()}
• *TOTAL: $${resultado.totales.mensualSinInfonavit.toLocaleString()}*

📅 *Costo Anual: $${resultado.totales.anualSinInfonavit.toLocaleString()}*`;
    }

    return `\n\n## Resultado del Cálculo - Modalidad 10\n${JSON.stringify(resultado, null, 2)}`;
  }

  // Modalidad 33
  if (modalidad === 'mod33') {
    if (canal === 'telefono') {
      return `\n\nEl costo anual del seguro de salud familiar sería de ${formatearMonedaParaVoz(resultado.totales.cuotaAnualFamilia)}. ` +
        `El primer año incluye inscripción por ${formatearMonedaParaVoz(resultado.cuotaInscripcion.monto)} adicionales.`;
    }

    if (canal === 'whatsapp' || canal === 'telegram') {
      let integrantes = resultado.integrantes.map(i =>
        `  • ${i.parentesco} (${i.edad} años): $${i.cuotaAnual.toLocaleString()}/año`
      ).join('\n');

      return `

📊 *Resultado del Cálculo - Modalidad 33*
🏥 *Seguro de Salud para la Familia*

👥 *Integrantes:*
${integrantes}

💰 *Costos:*
• Cuota anual familia: $${resultado.totales.cuotaAnualFamilia.toLocaleString()}
• Cuota inscripción (única): $${resultado.cuotaInscripcion.monto.toLocaleString()}
• *Total primer año: $${resultado.totales.totalPrimerAño.toLocaleString()}*
• Años siguientes: $${resultado.totales.totalAñosSiguientes.toLocaleString()}/año

⚠️ *Importante:* Esta modalidad NO suma semanas para pensión.
Solo cubre atención médica (Enfermedades y Maternidad).`;
    }

    return `\n\n## Resultado del Cálculo - Modalidad 33\n${JSON.stringify(resultado, null, 2)}`;
  }

  return `\n\n${JSON.stringify(resultado, null, 2)}`;
}

// Formatear errores de elegibilidad
function formatearErroresElegibilidad(elegibilidad, canal) {
  if (canal === 'telefono') {
    const errores = elegibilidad.errores.map(e => e.mensaje).join('. ');
    return `\n\nAtención: ${errores}`;
  }

  let texto = '\n\n⚠️ *Problemas de Elegibilidad:*\n';

  for (const error of elegibilidad.errores) {
    texto += `\n❌ ${error.mensaje}`;
    if (error.articulo) texto += ` (${error.articulo})`;
  }

  for (const adv of elegibilidad.advertencias || []) {
    texto += `\n⚡ ${adv.mensaje}`;
  }

  return texto;
}

// Búsqueda en base de conocimiento
export async function buscarConocimiento(consulta) {
  return buscarEnBaseConocimiento(consulta);
}

export default {
  procesarConIA,
  buscarConocimiento
};

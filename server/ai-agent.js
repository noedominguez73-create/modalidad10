/**
 * AGENTE DE IA MULTICANAL
 * Coordina el procesamiento de mensajes desde todos los canales
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

// Obtener API keys basado en el proveedor configurado
function getApiKeys() {
  const apiKeys = settings.obtenerApiKeys();
  const llmConfig = settings.obtenerLlmConfig();
  const provider = llmConfig.provider || process.env.LLM_PROVIDER || 'gemini';

  // Seleccionar la API key correcta según el proveedor
  let apiKey = '';
  switch (provider) {
    case 'anthropic':
      apiKey = apiKeys.anthropic;
      break;
    case 'openai':
      apiKey = apiKeys.openai;
      break;
    case 'groq':
      apiKey = apiKeys.groq;
      break;
    case 'glm5':
      apiKey = apiKeys.glm5;
      break;
    case 'gemini':
    default:
      apiKey = apiKeys.gemini;
      break;
  }

  console.log(`🤖 LLM Provider: ${provider}, API Key presente: ${!!apiKey}`);

  return {
    llm: apiKey,
    provider: provider
  };
}

// Llamar al LLM
async function llamarLLM(mensajes, opciones = {}) {
  const { llm: apiKey, provider } = getApiKeys();

  if (!apiKey) {
    console.error('❌ No hay API Key de LLM configurada para provider:', provider);
    throw new Error('No hay API Key de LLM configurada. Configura las variables de entorno en Railway.');
  }

  console.log(`📤 Llamando a ${provider}...`);

  try {
    switch (provider) {
      case 'anthropic':
        return await llamarClaude(mensajes, { ...opciones, apiKey });
      case 'groq':
        return await llamarGroq(mensajes, { ...opciones, apiKey });
      case 'openai':
        return await llamarOpenAI(mensajes, { ...opciones, apiKey });
      case 'gemini':
      default:
        return await llamarGemini(mensajes, { ...opciones, apiKey });
    }
  } catch (error) {
    console.error(`❌ Error llamando a ${provider}:`, error.message);
    throw error;
  }
}

// Llamar a Google Gemini
async function llamarGemini(mensajes, opciones) {
  const systemMsg = mensajes.find(m => m.role === 'system')?.content || '';
  const userMsgs = mensajes.filter(m => m.role !== 'system');

  // Convertir formato OpenAI a formato Gemini
  const contents = userMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${opciones.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemMsg }] },
        generationConfig: {
          temperature: opciones.temperature || 0.7,
          maxOutputTokens: opciones.maxTokens || 1000
        }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error('❌ Error Gemini:', data.error);
    throw new Error(data.error.message || 'Error en Gemini API');
  }

  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    console.error('❌ Respuesta Gemini vacía:', JSON.stringify(data));
    throw new Error('Respuesta vacía de Gemini');
  }

  return data.candidates[0].content.parts[0].text;
}

async function llamarOpenAI(mensajes, opciones) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opciones.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: opciones.modelo || 'gpt-4o-mini',
      messages: mensajes,
      max_tokens: opciones.maxTokens || 1000,
      temperature: opciones.temperature || 0.7
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Error en OpenAI API');
  }
  return data.choices[0].message.content;
}

async function llamarClaude(mensajes, opciones) {
  const systemMsg = mensajes.find(m => m.role === 'system')?.content || '';
  const userMsgs = mensajes.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opciones.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: opciones.modelo || 'claude-3-5-sonnet-20241022',
      max_tokens: opciones.maxTokens || 1000,
      system: systemMsg,
      messages: userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Error en Anthropic API');
  }
  return data.content[0].text;
}

async function llamarGroq(mensajes, opciones) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opciones.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: opciones.modelo || 'llama-3.3-70b-versatile',
      messages: mensajes,
      max_tokens: opciones.maxTokens || 1000
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Error en Groq API');
  }
  return data.choices[0].message.content;
}

// Procesar mensaje con IA
export async function procesarConIA(mensaje, contexto = {}) {
  const { canal, sesion = {}, telefono, chatId, callSid } = contexto;

  // Construir historial de conversación
  const historial = sesion.historial || [];
  const datosUsuario = sesion.datos || {};
  const pasoActual = sesion.paso || 'inicio';

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

  // System prompt enriquecido
  const systemPrompt = `${SYSTEM_PROMPT_IMSS}

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
${canal === 'telefono' ? '- Respuestas cortas y claras para voz. Máximo 2-3 oraciones.' : ''}
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
    let respuesta = await llamarLLM(mensajes);

    // Extraer datos estructurados si los hay
    let nuevosDatos = null;
    let nuevoPaso = null;

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

  // Mapeo de palabras numéricas en español
  const palabrasANumeros = {
    'mil': 1000,
    'un mil': 1000,
    'dos mil': 2000,
    'tres mil': 3000,
    'cuatro mil': 4000,
    'cinco mil': 5000,
    'seis mil': 6000,
    'siete mil': 7000,
    'ocho mil': 8000,
    'nueve mil': 9000,
    'diez mil': 10000,
    'once mil': 11000,
    'doce mil': 12000,
    'trece mil': 13000,
    'catorce mil': 14000,
    'quince mil': 15000,
    'dieciseis mil': 16000,
    'diecisiete mil': 17000,
    'dieciocho mil': 18000,
    'diecinueve mil': 19000,
    'veinte mil': 20000,
    'veinticinco mil': 25000,
    'treinta mil': 30000,
    'cuarenta mil': 40000,
    'cincuenta mil': 50000
  };

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
        `Tu cuota mensual sería de ${resultado.cuotas.cuotaMensual} pesos. ` +
        `Tu pensión estimada es de ${resultado.pension.mensualEstimada} pesos mensuales. ` +
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
      return `\n\nTu cuota total mensual sería de ${resultado.totales.mensualSinInfonavit} pesos. ` +
        `Esto incluye ${resultado.totales.patron} como patrón y ${resultado.totales.obrero} como trabajador.`;
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
      return `\n\nEl costo anual del seguro de salud familiar sería de ${resultado.totales.cuotaAnualFamilia} pesos. ` +
        `El primer año incluye inscripción por ${resultado.cuotaInscripcion.monto} pesos adicionales.`;
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

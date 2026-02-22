/**
 * Sistema de Feedback para Entrenamiento de IA
 * Almacena calificaciones de respuestas para mejorar el modelo
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FEEDBACK_FILE = join(__dirname, '..', 'database', 'feedback.json');

// Estructura inicial
const estructuraInicial = {
  metadata: {
    totalRespuestas: 0,
    positivas: 0,
    negativas: 0,
    ultimaActualizacion: null
  },
  respuestas: [],
  patronesBuenos: [],    // Patrones que funcionan bien
  patronesMalos: []      // Patrones a evitar
};

// Cargar feedback existente
function cargarFeedback() {
  try {
    if (existsSync(FEEDBACK_FILE)) {
      return JSON.parse(readFileSync(FEEDBACK_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error cargando feedback:', e.message);
  }
  return { ...estructuraInicial };
}

// Guardar feedback
function guardarFeedback(data) {
  try {
    data.metadata.ultimaActualizacion = new Date().toISOString();
    writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error guardando feedback:', e.message);
    return false;
  }
}

/**
 * Registrar feedback de una respuesta
 * @param {Object} datos - Datos del feedback
 * @param {string} datos.pregunta - Pregunta del usuario
 * @param {string} datos.respuesta - Respuesta de la IA
 * @param {number} datos.rating - 1 (positivo/thumbs up) o -1 (negativo/thumbs down)
 * @param {string} datos.canal - Canal de comunicación
 * @param {string} datos.comentario - Comentario opcional
 * @param {string} datos.modalidad - Modalidad consultada (10, 40, 33)
 */
export function registrarFeedback(datos) {
  const { pregunta, respuesta, rating, canal = 'web', comentario = '', modalidad = null } = datos;

  if (!pregunta || !respuesta || !rating) {
    throw new Error('Faltan datos: pregunta, respuesta y rating son requeridos');
  }

  if (rating !== 1 && rating !== -1) {
    throw new Error('Rating debe ser 1 (positivo) o -1 (negativo)');
  }

  const feedback = cargarFeedback();

  const registro = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    pregunta: pregunta.substring(0, 500), // Limitar longitud
    respuesta: respuesta.substring(0, 2000),
    rating,
    canal,
    modalidad,
    comentario: comentario.substring(0, 500),
    // Extraer características para análisis
    caracteristicas: extraerCaracteristicas(pregunta, respuesta)
  };

  feedback.respuestas.push(registro);
  feedback.metadata.totalRespuestas++;

  if (rating === 1) {
    feedback.metadata.positivas++;
    // Agregar a patrones buenos si tiene alta relevancia
    if (registro.caracteristicas.tieneCifras && registro.caracteristicas.tieneArticuloLey) {
      agregarPatron(feedback.patronesBuenos, registro);
    }
  } else {
    feedback.metadata.negativas++;
    agregarPatron(feedback.patronesMalos, registro);
  }

  // Mantener solo los últimos 1000 registros detallados
  if (feedback.respuestas.length > 1000) {
    feedback.respuestas = feedback.respuestas.slice(-1000);
  }

  guardarFeedback(feedback);

  return {
    success: true,
    id: registro.id,
    stats: {
      total: feedback.metadata.totalRespuestas,
      positivas: feedback.metadata.positivas,
      negativas: feedback.metadata.negativas,
      tasaPositiva: ((feedback.metadata.positivas / feedback.metadata.totalRespuestas) * 100).toFixed(1) + '%'
    }
  };
}

/**
 * Extraer características de la interacción para análisis
 */
function extraerCaracteristicas(pregunta, respuesta) {
  return {
    longitudPregunta: pregunta.length,
    longitudRespuesta: respuesta.length,
    tieneCifras: /\$[\d,]+/.test(respuesta),
    tieneArticuloLey: /art[íi]culo?\s*\d+/i.test(respuesta) || /LSS/i.test(respuesta),
    tieneEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(respuesta),
    tieneTabla: respuesta.includes('|') && respuesta.includes('-'),
    mencionaModalidad: /modalidad\s*(10|40|33)/i.test(respuesta),
    tieneAdvertencia: /importante|advertencia|cuidado|⚠️/i.test(respuesta),
    palabrasClave: extraerPalabrasClave(pregunta)
  };
}

/**
 * Extraer palabras clave de la pregunta
 */
function extraerPalabrasClave(texto) {
  const palabrasRelevantes = [
    'pensión', 'pension', 'jubilación', 'jubilacion', 'retiro',
    'semanas', 'cotizar', 'imss', 'modalidad', 'cuota', 'pago',
    'salario', 'uma', 'ley 73', 'ley 97', 'afore', 'médico', 'medico',
    'servicio', 'atención', 'atencion', 'edad', 'requisitos'
  ];

  const textoLower = texto.toLowerCase();
  return palabrasRelevantes.filter(p => textoLower.includes(p));
}

/**
 * Agregar patrón a la lista
 */
function agregarPatron(lista, registro) {
  const patron = {
    palabrasClave: registro.caracteristicas.palabrasClave,
    modalidad: registro.modalidad,
    tieneArticuloLey: registro.caracteristicas.tieneArticuloLey,
    tieneCifras: registro.caracteristicas.tieneCifras,
    ejemploRespuesta: registro.respuesta.substring(0, 300)
  };

  // Evitar duplicados similares
  const existe = lista.some(p =>
    JSON.stringify(p.palabrasClave) === JSON.stringify(patron.palabrasClave) &&
    p.modalidad === patron.modalidad
  );

  if (!existe) {
    lista.push(patron);
    // Mantener solo los últimos 100 patrones
    if (lista.length > 100) {
      lista.shift();
    }
  }
}

/**
 * Obtener estadísticas de feedback
 */
export function obtenerEstadisticas() {
  const feedback = cargarFeedback();

  // Análisis por modalidad
  const porModalidad = {};
  const porCanal = {};

  for (const r of feedback.respuestas) {
    // Por modalidad
    const mod = r.modalidad || 'general';
    if (!porModalidad[mod]) {
      porModalidad[mod] = { positivas: 0, negativas: 0 };
    }
    if (r.rating === 1) porModalidad[mod].positivas++;
    else porModalidad[mod].negativas++;

    // Por canal
    const canal = r.canal || 'web';
    if (!porCanal[canal]) {
      porCanal[canal] = { positivas: 0, negativas: 0 };
    }
    if (r.rating === 1) porCanal[canal].positivas++;
    else porCanal[canal].negativas++;
  }

  return {
    general: {
      total: feedback.metadata.totalRespuestas,
      positivas: feedback.metadata.positivas,
      negativas: feedback.metadata.negativas,
      tasaPositiva: feedback.metadata.totalRespuestas > 0
        ? ((feedback.metadata.positivas / feedback.metadata.totalRespuestas) * 100).toFixed(1) + '%'
        : '0%',
      ultimaActualizacion: feedback.metadata.ultimaActualizacion
    },
    porModalidad,
    porCanal,
    patronesBuenos: feedback.patronesBuenos.length,
    patronesMalos: feedback.patronesMalos.length
  };
}

/**
 * Obtener patrones para mejorar respuestas
 * (Útil para few-shot prompting)
 */
export function obtenerPatronesParaPrompt() {
  const feedback = cargarFeedback();

  return {
    buenos: feedback.patronesBuenos.slice(-10).map(p => ({
      contexto: p.palabrasClave.join(', '),
      modalidad: p.modalidad,
      ejemplo: p.ejemploRespuesta
    })),
    evitar: feedback.patronesMalos.slice(-5).map(p => ({
      contexto: p.palabrasClave.join(', '),
      problema: 'Respuesta calificada negativamente'
    }))
  };
}

/**
 * Obtener respuestas recientes para revisión
 */
export function obtenerRespuestasRecientes(limite = 20, soloNegativas = false) {
  const feedback = cargarFeedback();

  let respuestas = feedback.respuestas;

  if (soloNegativas) {
    respuestas = respuestas.filter(r => r.rating === -1);
  }

  return respuestas.slice(-limite).reverse();
}

/**
 * Exportar datos para análisis externo
 */
export function exportarDatos() {
  return cargarFeedback();
}

export default {
  registrarFeedback,
  obtenerEstadisticas,
  obtenerPatronesParaPrompt,
  obtenerRespuestasRecientes,
  exportarDatos
};

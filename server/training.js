/**
 * TRAINING - Sistema de entrenamiento del agente IA
 * Permite agregar reglas, conocimiento y ejemplos desde la web
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TRAINING_PATH = join(__dirname, 'data', 'training.json');

// Estructura por defecto
const DEFAULT_TRAINING = {
  // Reglas personalizadas que el agente debe seguir
  reglas: [
    {
      id: 1,
      titulo: "Preguntar tiempo sin cotizar",
      contenido: "SIEMPRE preguntar '¿Cuánto tiempo llevas sin cotizar al IMSS?' antes de recomendar cualquier modalidad.",
      activo: true,
      prioridad: 1
    }
  ],

  // Preguntas frecuentes con respuestas predefinidas
  faq: [
    {
      id: 1,
      pregunta: "¿Qué es la Modalidad 40?",
      respuesta: "La Modalidad 40 es un esquema de continuación voluntaria del IMSS que te permite seguir cotizando para mejorar tu pensión, pero NO incluye servicio médico.",
      palabrasClave: ["modalidad 40", "mod 40", "que es modalidad"],
      activo: true
    }
  ],

  // Conocimiento adicional (datos, tablas, información)
  conocimiento: [
    {
      id: 1,
      categoria: "Requisitos",
      titulo: "Requisitos Modalidad 40",
      contenido: "Para inscribirte en Modalidad 40 necesitas: 1) Mínimo 52 semanas cotizadas en los últimos 5 años, 2) No tener patrón actual, 3) Inscribirte dentro de 5 años de tu última baja.",
      activo: true
    }
  ],

  // Ejemplos de conversación para que el agente aprenda
  ejemplos: [
    {
      id: 1,
      contexto: "Usuario con más de 5 años sin cotizar",
      usuarioDice: "Quiero inscribirme en modalidad 40, tengo 8 años sin cotizar",
      agenteResponde: "Con más de 5 años sin cotizar, no puedes inscribirte directo en Modalidad 40. Te recomiendo primero inscribirte en Modalidad 10 por al menos 1 año para reactivar tus derechos. Después podrás cambiarte a Modalidad 40. ¿Te calculo cuánto pagarías en Modalidad 10?",
      activo: true
    }
  ],

  // Frases prohibidas que el agente NO debe decir
  prohibido: [
    {
      id: 1,
      frase: "No estoy seguro",
      alternativa: "Déjame verificar esa información para darte datos precisos.",
      activo: true
    }
  ],

  // Configuración del comportamiento
  configuracion: {
    nombreAgente: "Asesor IMSS",
    saludoInicial: "¡Hola! Soy tu asesor virtual de pensiones IMSS. ¿En qué puedo ayudarte hoy?",
    despedida: "¡Gracias por consultar! Si tienes más dudas, aquí estaré.",
    tono: "profesional", // profesional, amigable, formal
    usarEmojis: true,
    maxRespuesta: 500 // caracteres máximo por respuesta
  }
};

// Cache en memoria
let trainingCache = null;

/**
 * Cargar datos de entrenamiento
 */
export function cargarTraining() {
  try {
    if (existsSync(TRAINING_PATH)) {
      const data = readFileSync(TRAINING_PATH, 'utf8');
      trainingCache = JSON.parse(data);
      // Asegurar que tiene todas las propiedades
      trainingCache = { ...DEFAULT_TRAINING, ...trainingCache };
    } else {
      trainingCache = { ...DEFAULT_TRAINING };
      guardarTraining(trainingCache);
    }
  } catch (error) {
    console.error('Error cargando training:', error.message);
    trainingCache = { ...DEFAULT_TRAINING };
  }
  return trainingCache;
}

/**
 * Guardar datos de entrenamiento
 */
export function guardarTraining(training) {
  try {
    writeFileSync(TRAINING_PATH, JSON.stringify(training, null, 2), 'utf8');
    trainingCache = training;
    return true;
  } catch (error) {
    console.error('Error guardando training:', error.message);
    return false;
  }
}

/**
 * Obtener todo el entrenamiento
 */
export function obtenerTraining() {
  return cargarTraining();
}

/**
 * Generar prompt de entrenamiento para el agente
 */
export function generarPromptEntrenamiento() {
  const training = cargarTraining();
  let prompt = '\n\n# ENTRENAMIENTO PERSONALIZADO\n';

  // Reglas personalizadas
  const reglasActivas = training.reglas.filter(r => r.activo).sort((a, b) => a.prioridad - b.prioridad);
  if (reglasActivas.length > 0) {
    prompt += '\n## REGLAS OBLIGATORIAS:\n';
    reglasActivas.forEach((r, i) => {
      prompt += `${i + 1}. **${r.titulo}**: ${r.contenido}\n`;
    });
  }

  // FAQ
  const faqActivas = training.faq.filter(f => f.activo);
  if (faqActivas.length > 0) {
    prompt += '\n## RESPUESTAS PREDEFINIDAS (usar cuando aplique):\n';
    faqActivas.forEach(f => {
      prompt += `\nP: ${f.pregunta}\nR: ${f.respuesta}\n`;
    });
  }

  // Conocimiento adicional
  const conocimientoActivo = training.conocimiento.filter(c => c.activo);
  if (conocimientoActivo.length > 0) {
    prompt += '\n## CONOCIMIENTO ADICIONAL:\n';
    conocimientoActivo.forEach(c => {
      prompt += `\n### ${c.titulo} (${c.categoria}):\n${c.contenido}\n`;
    });
  }

  // Ejemplos de conversación
  const ejemplosActivos = training.ejemplos.filter(e => e.activo);
  if (ejemplosActivos.length > 0) {
    prompt += '\n## EJEMPLOS DE RESPUESTAS CORRECTAS:\n';
    ejemplosActivos.forEach(e => {
      prompt += `\n**Contexto:** ${e.contexto}\n`;
      prompt += `**Usuario:** "${e.usuarioDice}"\n`;
      prompt += `**Tu respuesta:** "${e.agenteResponde}"\n`;
    });
  }

  // Frases prohibidas
  const prohibidoActivo = training.prohibido.filter(p => p.activo);
  if (prohibidoActivo.length > 0) {
    prompt += '\n## FRASES PROHIBIDAS (nunca usar):\n';
    prohibidoActivo.forEach(p => {
      prompt += `- NO digas: "${p.frase}" → En su lugar: "${p.alternativa}"\n`;
    });
  }

  // Configuración de comportamiento
  const config = training.configuracion;
  prompt += `\n## COMPORTAMIENTO:\n`;
  prompt += `- Tu nombre: ${config.nombreAgente}\n`;
  prompt += `- Tono: ${config.tono}\n`;
  prompt += `- ${config.usarEmojis ? 'Puedes usar emojis' : 'NO uses emojis'}\n`;
  prompt += `- Mantén respuestas de máximo ${config.maxRespuesta} caracteres\n`;
  prompt += `- Saludo inicial: "${config.saludoInicial}"\n`;

  return prompt;
}

// === CRUD para cada sección ===

// REGLAS
export function agregarRegla(regla) {
  const training = cargarTraining();
  const nuevoId = training.reglas.length > 0 ? Math.max(...training.reglas.map(r => r.id)) + 1 : 1;
  const nuevaRegla = {
    id: nuevoId,
    titulo: regla.titulo || 'Sin título',
    contenido: regla.contenido || '',
    activo: regla.activo !== undefined ? regla.activo : true,
    prioridad: regla.prioridad || training.reglas.length + 1
  };
  training.reglas.push(nuevaRegla);
  guardarTraining(training);
  return nuevaRegla;
}

export function actualizarRegla(id, datos) {
  const training = cargarTraining();
  const index = training.reglas.findIndex(r => r.id === parseInt(id));
  if (index === -1) return null;
  training.reglas[index] = { ...training.reglas[index], ...datos, id: parseInt(id) };
  guardarTraining(training);
  return training.reglas[index];
}

export function eliminarRegla(id) {
  const training = cargarTraining();
  const index = training.reglas.findIndex(r => r.id === parseInt(id));
  if (index === -1) return false;
  training.reglas.splice(index, 1);
  guardarTraining(training);
  return true;
}

// FAQ
export function agregarFaq(faq) {
  const training = cargarTraining();
  const nuevoId = training.faq.length > 0 ? Math.max(...training.faq.map(f => f.id)) + 1 : 1;
  const nuevaFaq = {
    id: nuevoId,
    pregunta: faq.pregunta || '',
    respuesta: faq.respuesta || '',
    palabrasClave: faq.palabrasClave || [],
    activo: faq.activo !== undefined ? faq.activo : true
  };
  training.faq.push(nuevaFaq);
  guardarTraining(training);
  return nuevaFaq;
}

export function actualizarFaq(id, datos) {
  const training = cargarTraining();
  const index = training.faq.findIndex(f => f.id === parseInt(id));
  if (index === -1) return null;
  training.faq[index] = { ...training.faq[index], ...datos, id: parseInt(id) };
  guardarTraining(training);
  return training.faq[index];
}

export function eliminarFaq(id) {
  const training = cargarTraining();
  const index = training.faq.findIndex(f => f.id === parseInt(id));
  if (index === -1) return false;
  training.faq.splice(index, 1);
  guardarTraining(training);
  return true;
}

// CONOCIMIENTO
export function agregarConocimiento(conocimiento) {
  const training = cargarTraining();
  const nuevoId = training.conocimiento.length > 0 ? Math.max(...training.conocimiento.map(c => c.id)) + 1 : 1;
  const nuevo = {
    id: nuevoId,
    categoria: conocimiento.categoria || 'General',
    titulo: conocimiento.titulo || 'Sin título',
    contenido: conocimiento.contenido || '',
    activo: conocimiento.activo !== undefined ? conocimiento.activo : true
  };
  training.conocimiento.push(nuevo);
  guardarTraining(training);
  return nuevo;
}

export function actualizarConocimiento(id, datos) {
  const training = cargarTraining();
  const index = training.conocimiento.findIndex(c => c.id === parseInt(id));
  if (index === -1) return null;
  training.conocimiento[index] = { ...training.conocimiento[index], ...datos, id: parseInt(id) };
  guardarTraining(training);
  return training.conocimiento[index];
}

export function eliminarConocimiento(id) {
  const training = cargarTraining();
  const index = training.conocimiento.findIndex(c => c.id === parseInt(id));
  if (index === -1) return false;
  training.conocimiento.splice(index, 1);
  guardarTraining(training);
  return true;
}

// EJEMPLOS
export function agregarEjemplo(ejemplo) {
  const training = cargarTraining();
  const nuevoId = training.ejemplos.length > 0 ? Math.max(...training.ejemplos.map(e => e.id)) + 1 : 1;
  const nuevo = {
    id: nuevoId,
    contexto: ejemplo.contexto || '',
    usuarioDice: ejemplo.usuarioDice || '',
    agenteResponde: ejemplo.agenteResponde || '',
    activo: ejemplo.activo !== undefined ? ejemplo.activo : true
  };
  training.ejemplos.push(nuevo);
  guardarTraining(training);
  return nuevo;
}

export function actualizarEjemplo(id, datos) {
  const training = cargarTraining();
  const index = training.ejemplos.findIndex(e => e.id === parseInt(id));
  if (index === -1) return null;
  training.ejemplos[index] = { ...training.ejemplos[index], ...datos, id: parseInt(id) };
  guardarTraining(training);
  return training.ejemplos[index];
}

export function eliminarEjemplo(id) {
  const training = cargarTraining();
  const index = training.ejemplos.findIndex(e => e.id === parseInt(id));
  if (index === -1) return false;
  training.ejemplos.splice(index, 1);
  guardarTraining(training);
  return true;
}

// CONFIGURACION
export function actualizarConfiguracion(config) {
  const training = cargarTraining();
  training.configuracion = { ...training.configuracion, ...config };
  guardarTraining(training);
  return training.configuracion;
}

// Cargar al iniciar
cargarTraining();

export default {
  cargarTraining,
  guardarTraining,
  obtenerTraining,
  generarPromptEntrenamiento,
  agregarRegla,
  actualizarRegla,
  eliminarRegla,
  agregarFaq,
  actualizarFaq,
  eliminarFaq,
  agregarConocimiento,
  actualizarConocimiento,
  eliminarConocimiento,
  agregarEjemplo,
  actualizarEjemplo,
  eliminarEjemplo,
  actualizarConfiguracion
};

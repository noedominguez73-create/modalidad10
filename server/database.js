/**
 * Servicio de Base de Datos
 * Carga y gestiona los datos actualizables (UMA, cuotas, INPC, etc.)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'database');

// Cache de datos
let cache = {};

// Cargar archivo JSON
function cargarArchivo(nombre) {
  const ruta = join(DB_PATH, `${nombre}.json`);
  if (!existsSync(ruta)) {
    console.warn(`Archivo no encontrado: ${ruta}`);
    return null;
  }
  try {
    const contenido = readFileSync(ruta, 'utf8');
    return JSON.parse(contenido);
  } catch (e) {
    console.error(`Error cargando ${nombre}:`, e.message);
    return null;
  }
}

// Guardar archivo JSON
function guardarArchivo(nombre, datos) {
  const ruta = join(DB_PATH, `${nombre}.json`);
  try {
    writeFileSync(ruta, JSON.stringify(datos, null, 2), 'utf8');
    // Invalidar cache
    delete cache[nombre];
    return true;
  } catch (e) {
    console.error(`Error guardando ${nombre}:`, e.message);
    return false;
  }
}

// Obtener datos con cache
function obtener(nombre) {
  if (!cache[nombre]) {
    cache[nombre] = cargarArchivo(nombre);
  }
  return cache[nombre];
}

// Recargar todos los datos
function recargarTodo() {
  cache = {};
  return {
    uma: obtener('uma'),
    salariosMinimos: obtener('salarios-minimos'),
    cesantiaVejez: obtener('cesantia-vejez'),
    cuotasImss: obtener('cuotas-imss'),
    pensionLey73: obtener('pension-ley73'),
    inpc: obtener('inpc')
  };
}

// ============ FUNCIONES ESPECÍFICAS ============

// Obtener UMA vigente
export function obtenerUMA(año = null) {
  const data = obtener('uma');
  if (!data) return { diario: 113.14, mensual: 3440.45, anual: 41296.10 };

  const añoConsulta = año || data.vigente;
  return data.historico[añoConsulta] || data.historico[data.vigente];
}

// Obtener salario mínimo
export function obtenerSalarioMinimo(año = null, zona = 'general') {
  const data = obtener('salarios-minimos');
  if (!data) return zona === 'frontera' ? 419.88 : 278.80;

  const añoConsulta = año || data.vigente;
  const salarios = data.historico[añoConsulta] || data.historico[data.vigente];
  return salarios[zona] || salarios.general;
}

// Obtener porcentaje de cesantía
export function obtenerPorcentajeCesantia(año, vecesUMA) {
  const data = obtener('cesantia-vejez');
  if (!data) return { patron: 3.15, obrero: 1.125 };

  const tabla = data.tabla_incrementos[año] || data.tabla_incrementos['2025'];

  let rango;
  if (vecesUMA <= 1.00) rango = 'hasta_1.00_uma';
  else if (vecesUMA <= 1.50) rango = '1.01_a_1.50_uma';
  else if (vecesUMA <= 2.00) rango = '1.51_a_2.00_uma';
  else if (vecesUMA <= 2.50) rango = '2.01_a_2.50_uma';
  else if (vecesUMA <= 3.00) rango = '2.51_a_3.00_uma';
  else if (vecesUMA <= 3.50) rango = '3.01_a_3.50_uma';
  else if (vecesUMA <= 4.00) rango = '3.51_a_4.00_uma';
  else rango = 'mas_de_4.00_uma';

  return tabla[rango];
}

// Obtener cuotas IMSS
export function obtenerCuotasIMSS(modalidad = '40') {
  const data = obtener('cuotas-imss');
  if (!data) return null;

  return modalidad === '10' ? data.modalidad_10 : data.modalidad_40;
}

// Obtener prima de riesgo
export function obtenerPrimaRiesgo(clase = 'I') {
  const data = obtener('cuotas-imss');
  if (!data) return 0.54355;

  return data.primas_riesgo_trabajo.clases[clase]?.prima || 0.54355;
}

// Obtener factores pensión Ley 73
export function obtenerFactoresPension() {
  const data = obtener('pension-ley73');
  if (!data) {
    return {
      factores_edad: { 60: 0.75, 61: 0.80, 62: 0.85, 63: 0.90, 64: 0.95, 65: 1.00 },
      semanas_minimas: 500
    };
  }
  return data;
}

// Obtener INPC
export function obtenerINPC(año, mes) {
  const data = obtener('inpc');
  if (!data) return null;

  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const nombreMes = typeof mes === 'number' ? meses[mes - 1] : mes.toLowerCase();
  return data.historico[año]?.[nombreMes] || null;
}

// ============ API DE ADMINISTRACIÓN ============

// Actualizar UMA
export function actualizarUMA(año, datos) {
  const data = obtener('uma') || { historico: {} };
  data.historico[año] = datos;
  data.vigente = Math.max(...Object.keys(data.historico).map(Number));
  data._ultima_actualizacion = new Date().toISOString().split('T')[0];
  return guardarArchivo('uma', data);
}

// Actualizar salario mínimo
export function actualizarSalarioMinimo(año, general, frontera) {
  const data = obtener('salarios-minimos') || { historico: {} };
  data.historico[año] = { general, frontera };
  data.vigente = Math.max(...Object.keys(data.historico).map(Number));
  data._ultima_actualizacion = new Date().toISOString().split('T')[0];
  return guardarArchivo('salarios-minimos', data);
}

// Actualizar INPC
export function actualizarINPC(año, mes, valor) {
  const data = obtener('inpc') || { historico: {} };
  if (!data.historico[año]) data.historico[año] = {};
  data.historico[año][mes.toLowerCase()] = valor;
  data._ultima_actualizacion = new Date().toISOString().split('T')[0];
  return guardarArchivo('inpc', data);
}

// Obtener resumen de todos los datos
export function obtenerResumenDatos() {
  return {
    uma: obtenerUMA(),
    salarioMinimo: {
      general: obtenerSalarioMinimo(null, 'general'),
      frontera: obtenerSalarioMinimo(null, 'frontera')
    },
    cuotasModalidad40: obtenerCuotasIMSS('40'),
    cuotasModalidad10: obtenerCuotasIMSS('10'),
    factoresPension: obtenerFactoresPension(),
    ultimaActualizacion: {
      uma: obtener('uma')?._ultima_actualizacion,
      salarios: obtener('salarios-minimos')?._ultima_actualizacion,
      inpc: obtener('inpc')?._ultima_actualizacion
    }
  };
}

// Exportar todo
export default {
  obtenerUMA,
  obtenerSalarioMinimo,
  obtenerPorcentajeCesantia,
  obtenerCuotasIMSS,
  obtenerPrimaRiesgo,
  obtenerFactoresPension,
  obtenerINPC,
  actualizarUMA,
  actualizarSalarioMinimo,
  actualizarINPC,
  obtenerResumenDatos,
  recargarTodo
};

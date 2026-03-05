/**
 * Utilidades compartidas de Base de Datos
 * Centraliza cargarDB/guardarDB para evitar duplicación en módulos CRM
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Rutas de bases de datos
export const DB_PATHS = {
  crmPrincipal: join(__dirname, '..', '..', 'database', 'clientes-prospectos.json'),
  feedback: join(__dirname, '..', '..', 'database', 'feedback.json'),
  settings: join(__dirname, '..', '..', 'database', 'settings.json')
};

// Estructura por defecto del CRM
const DEFAULT_CRM_DB = {
  prospectos: [],
  clientes: [],
  pagosRecibidos: [],
  pagosIMSS: [],
  verificacionesVigencia: []
};

/**
 * Cargar base de datos JSON
 * @param {string} dbPath - Ruta al archivo JSON
 * @param {object} defaultData - Datos por defecto si no existe
 * @returns {object} Datos cargados
 */
export function cargarDB(dbPath = DB_PATHS.crmPrincipal, defaultData = DEFAULT_CRM_DB) {
  try {
    if (existsSync(dbPath)) {
      const contenido = readFileSync(dbPath, 'utf8');
      return JSON.parse(contenido);
    }
  } catch (e) {
    console.error(`[DB] Error cargando ${dbPath}:`, e.message);
  }
  return { ...defaultData };
}

/**
 * Guardar base de datos JSON
 * @param {object} db - Datos a guardar
 * @param {string} dbPath - Ruta al archivo JSON
 * @returns {boolean} true si se guardó correctamente
 */
export function guardarDB(db, dbPath = DB_PATHS.crmPrincipal) {
  try {
    writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`[DB] Error guardando ${dbPath}:`, e.message);
    return false;
  }
}

/**
 * Cargar CRM (atajo para la BD principal)
 */
export function cargarCRM() {
  return cargarDB(DB_PATHS.crmPrincipal, DEFAULT_CRM_DB);
}

/**
 * Guardar CRM (atajo para la BD principal)
 */
export function guardarCRM(db) {
  return guardarDB(db, DB_PATHS.crmPrincipal);
}

// Validadores compartidos
export const validadores = {
  /**
   * Validar CURP (formato mexicano)
   */
  curp(curp) {
    if (!curp) return { valido: false, mensaje: 'CURP requerido' };
    const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
    if (!regex.test(curp.toUpperCase())) {
      return { valido: false, mensaje: 'Formato de CURP inválido' };
    }
    return { valido: true };
  },

  /**
   * Validar NSS (11 dígitos)
   */
  nss(nss) {
    if (!nss) return { valido: false, mensaje: 'NSS requerido' };
    const regex = /^\d{11}$/;
    if (!regex.test(nss)) {
      return { valido: false, mensaje: 'NSS debe tener 11 dígitos' };
    }
    return { valido: true };
  },

  /**
   * Validar teléfono USA
   */
  telefonoUSA(telefono) {
    if (!telefono) return { valido: false, mensaje: 'Teléfono requerido' };
    const limpio = telefono.replace(/\D/g, '');
    if (limpio.length === 10 || (limpio.length === 11 && limpio.startsWith('1'))) {
      return { valido: true, formato: '+1' + limpio.slice(-10) };
    }
    return { valido: false, mensaje: 'Formato de teléfono USA inválido' };
  },

  /**
   * Validar teléfono México
   */
  telefonoMX(telefono) {
    if (!telefono) return { valido: false, mensaje: 'Teléfono requerido' };
    const limpio = telefono.replace(/\D/g, '');
    if (limpio.length === 10 || (limpio.length === 12 && limpio.startsWith('52'))) {
      return { valido: true, formato: '+52' + limpio.slice(-10) };
    }
    return { valido: false, mensaje: 'Formato de teléfono MX inválido' };
  },

  /**
   * Validar email
   */
  email(email) {
    if (!email) return { valido: false, mensaje: 'Email requerido' };
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      return { valido: false, mensaje: 'Formato de email inválido' };
    }
    return { valido: true };
  }
};

export default {
  cargarDB,
  guardarDB,
  cargarCRM,
  guardarCRM,
  DB_PATHS,
  validadores
};

/**
 * Almacén de Sesiones con LRU Cache
 * Reemplaza Map() simple para prevenir memory leaks
 *
 * Características:
 * - Límite máximo de sesiones
 * - TTL automático (tiempo de vida)
 * - Evicción LRU (Least Recently Used)
 */

import { LRUCache } from 'lru-cache';

// Configuración por defecto
const DEFAULT_OPTIONS = {
  max: 10000,           // Máximo 10,000 sesiones
  ttl: 1000 * 60 * 60,  // 1 hora de TTL
  updateAgeOnGet: true, // Renovar TTL al acceder
  updateAgeOnHas: true
};

// Almacenes por canal
const stores = {};

/**
 * Obtener o crear almacén de sesiones para un canal
 * @param {string} channel - Nombre del canal (whatsapp, telegram, facebook, voice)
 * @param {object} options - Opciones de configuración
 */
export function getStore(channel, options = {}) {
  if (!stores[channel]) {
    stores[channel] = new LRUCache({
      ...DEFAULT_OPTIONS,
      ...options
    });
    console.log(`[SessionStore] Creado almacén para canal: ${channel}`);
  }
  return stores[channel];
}

/**
 * Obtener sesión de un usuario
 */
export function getSession(channel, oderId) {
  const store = getStore(channel);
  return store.get(oderId) || null;
}

/**
 * Crear o actualizar sesión
 */
export function setSession(channel, oderId, data) {
  const store = getStore(channel);
  const existing = store.get(oderId) || {};
  const updated = {
    ...existing,
    ...data,
    ultimaActividad: Date.now(),
    oderId
  };
  store.set(oderId, updated);
  return updated;
}

/**
 * Eliminar sesión
 */
export function deleteSession(channel, oderId) {
  const store = getStore(channel);
  return store.delete(oderId);
}

/**
 * Verificar si existe sesión
 */
export function hasSession(channel, oderId) {
  const store = getStore(channel);
  return store.has(oderId);
}

/**
 * Obtener todas las sesiones activas de un canal
 */
export function getAllSessions(channel) {
  const store = getStore(channel);
  const sessions = [];

  for (const [oderId, data] of store.entries()) {
    sessions.push({
      oderId,
      ...data
    });
  }

  return sessions;
}

/**
 * Obtener estadísticas del almacén
 */
export function getStats(channel) {
  const store = getStore(channel);
  return {
    channel,
    size: store.size,
    maxSize: store.max,
    ttl: store.ttl
  };
}

/**
 * Obtener estadísticas de todos los canales
 */
export function getAllStats() {
  const stats = {};
  for (const channel in stores) {
    stats[channel] = getStats(channel);
  }
  return stats;
}

/**
 * Limpiar sesiones expiradas manualmente (LRU lo hace automático, pero por si acaso)
 */
export function purgeExpired(channel) {
  const store = getStore(channel);
  store.purgeStale();
  return store.size;
}

/**
 * Limpiar todas las sesiones de un canal
 */
export function clearChannel(channel) {
  const store = getStore(channel);
  store.clear();
}

// Clase wrapper para compatibilidad con código existente que usa Map
export class SessionMap {
  constructor(channel, options = {}) {
    this.channel = channel;
    this.store = getStore(channel, options);
  }

  get(oderId) {
    return this.store.get(oderId);
  }

  set(oderId, value) {
    return this.store.set(oderId, { ...value, oderId, ultimaActividad: Date.now() });
  }

  has(oderId) {
    return this.store.has(oderId);
  }

  delete(oderId) {
    return this.store.delete(oderId);
  }

  get size() {
    return this.store.size;
  }

  entries() {
    return this.store.entries();
  }

  values() {
    return this.store.values();
  }

  keys() {
    return this.store.keys();
  }

  forEach(callback) {
    for (const [key, value] of this.store.entries()) {
      callback(value, key, this);
    }
  }

  clear() {
    return this.store.clear();
  }
}

export default {
  getStore,
  getSession,
  setSession,
  deleteSession,
  hasSession,
  getAllSessions,
  getStats,
  getAllStats,
  purgeExpired,
  clearChannel,
  SessionMap
};

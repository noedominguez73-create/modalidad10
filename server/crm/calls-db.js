/**
 * CALLS DB — Historial de llamadas telefónicas
 * Equivalente a tabla `twilio_calls` de la arquitectura Callcenteria
 * Persiste en server/data/calls.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CALLS_PATH = join(__dirname, '..', 'data', 'calls.json');

let callsCache = null;

// -------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------

function cargarCalls() {
    if (callsCache) return callsCache;
    try {
        if (existsSync(CALLS_PATH)) {
            callsCache = JSON.parse(readFileSync(CALLS_PATH, 'utf8'));
        } else {
            callsCache = [];
            guardarCalls(callsCache);
        }
    } catch (e) {
        console.error('❌ Error cargando calls.json:', e.message);
        callsCache = [];
    }
    return callsCache;
}

function guardarCalls(calls) {
    try {
        writeFileSync(CALLS_PATH, JSON.stringify(calls, null, 2), 'utf8');
        callsCache = calls;
        return true;
    } catch (e) {
        console.error('❌ Error guardando calls.json:', e.message);
        return false;
    }
}

// -------------------------------------------------------------------
// API PÚBLICA
// -------------------------------------------------------------------

/**
 * Registrar una nueva llamada al inicio
 * @param {{ call_sid, from_number, to_number, direction, status, agent_id }} data
 */
export function registrarLlamada({ call_sid, from_number, to_number, direction = 'inbound', status = 'ringing', agent_id = null }) {
    const calls = cargarCalls();

    // Verificar si ya existe (evitar duplicados por reintentos de Twilio)
    const existente = calls.find(c => c.call_sid === call_sid);
    if (existente) return existente;

    const nuevaLlamada = {
        call_sid,
        from_number,
        to_number,
        direction,
        status,
        agent_id,
        transcript: '',
        duration: null,
        recording_url: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    calls.unshift(nuevaLlamada); // Más recientes primero

    // Mantener máximo 500 llamadas
    if (calls.length > 500) calls.pop();

    guardarCalls(calls);
    return nuevaLlamada;
}

/**
 * Actualizar estado/duración de una llamada existente
 * @param {string} call_sid
 * @param {{ status, duration, recording_url }} datos
 */
export function actualizarLlamada(call_sid, datos) {
    const calls = cargarCalls();
    const index = calls.findIndex(c => c.call_sid === call_sid);

    if (index === -1) {
        // Si no existe, crear un registro mínimo (puede pasar con llamadas salientes)
        return registrarLlamada({
            call_sid,
            from_number: datos.from_number || '',
            to_number: datos.to_number || '',
            direction: datos.direction || 'inbound',
            status: datos.status || 'completed',
            agent_id: datos.agent_id || null
        });
    }

    calls[index] = {
        ...calls[index],
        ...datos,
        updatedAt: new Date().toISOString()
    };

    guardarCalls(calls);
    return calls[index];
}

/**
 * Agregar un turno al transcript de una llamada
 * @param {string} call_sid
 * @param {string} userMsg  — Lo que dijo el usuario
 * @param {string} aiMsg    — Lo que respondió la IA
 */
export function agregarTranscript(call_sid, userMsg, aiMsg) {
    const calls = cargarCalls();
    const index = calls.findIndex(c => c.call_sid === call_sid);

    if (index === -1) return false;

    const turno = `\nUser: ${userMsg}\nAI: ${aiMsg}`;
    calls[index].transcript = (calls[index].transcript || '') + turno;
    calls[index].updatedAt = new Date().toISOString();

    guardarCalls(calls);
    return true;
}

/**
 * Obtener transcript de una llamada
 * @param {string} call_sid
 * @returns {string}
 */
export function obtenerTranscript(call_sid) {
    const calls = cargarCalls();
    const llamada = calls.find(c => c.call_sid === call_sid);
    return llamada?.transcript || '';
}

/**
 * Obtener historial de llamadas con filtros opcionales
 * @param {{ limit?, agent_id?, direction?, call_sid? }} filtros
 */
export function obtenerLlamadas({ limit = 50, agent_id = null, direction = null, call_sid = null } = {}) {
    const calls = cargarCalls();

    let resultado = calls;

    if (call_sid) {
        return calls.find(c => c.call_sid === call_sid) || null;
    }

    if (agent_id) {
        resultado = resultado.filter(c => c.agent_id === agent_id);
    }

    if (direction) {
        resultado = resultado.filter(c => c.direction === direction);
    }

    return resultado.slice(0, limit);
}

/**
 * Eliminar todas las llamadas (para tests)
 */
export function limpiarLlamadas() {
    callsCache = [];
    return guardarCalls(callsCache);
}

export default {
    registrarLlamada,
    actualizarLlamada,
    agregarTranscript,
    obtenerTranscript,
    obtenerLlamadas,
    limpiarLlamadas
};

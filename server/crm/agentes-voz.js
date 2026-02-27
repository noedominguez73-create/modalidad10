/**
 * AGENTES DE VOZ — CRUD y resolución de agente por número/prioridad
 *
 * Lógica de prioridades para encontrar el agente correcto:
 *   1. Agente con telefono_asignado === numero_llamado AND telefono_activo === true AND estado === true
 *   2. Agente marcado como esDefault === true
 *   3. Primer agente activo de tipo 'voz' o 'hibrido'
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTES_DB_PATH = join(__dirname, '..', 'data', 'agentes-voz.json');

// Agente por defecto si no hay ninguno configurado
const DEFAULT_AGENT = {
    id: 'agent_default',
    nombre: 'Asesor General IMSS',
    descripcion: 'Agente principal del sistema',
    tipo: 'voz',
    // greeting_message: Lo primero que dice el agente al contestar
    greeting_message: 'Bienvenido al asesor de pensiones del IMSS. Soy una inteligencia artificial y te ayudaré con tu Modalidad 40, Modalidad 10 o cualquier duda sobre pensiones. ¿En qué puedo ayudarte?',
    // prompt_sistema: Las instrucciones que recibe la IA
    prompt_sistema: 'Eres un experto asesor de pensiones del IMSS en México. Tu objetivo es precalificar clientes, explicarles cómo funciona la Modalidad 40, Modalidad 10 y calcular sus pensiones basándote en la ley del 73. Sé amable, profesional, conciso y directo. Solo puedes emitir UNA pregunta o respuesta por turno. Máximo 2-3 oraciones.',
    personalidad: 'Profesional, empático y conciso',
    voz: 'Polly.Mia',
    idioma: 'es-MX',
    // Teléfono asignado a este agente (número exacto de Twilio, e.g. +15551234567)
    telefono_asignado: '',
    telefono_activo: true,
    estado: true,
    esDefault: true,
    createdAt: new Date().toISOString()
};

let agentesCache = null;

// -------------------------------------------------------------------
// HELPERS INTERNOS
// -------------------------------------------------------------------

function initDB() {
    if (!existsSync(AGENTES_DB_PATH)) {
        try {
            writeFileSync(AGENTES_DB_PATH, JSON.stringify([DEFAULT_AGENT], null, 2), 'utf8');
            agentesCache = [DEFAULT_AGENT];
            return true;
        } catch (e) {
            console.error('❌ Error inicializando BD de Agentes de Voz:', e);
            return false;
        }
    }
    return true;
}

function normalizarTelefono(telefono) {
    if (!telefono) return '';
    // Quitar +, espacios y guiones, tomar últimos 10 dígitos
    const limpio = telefono.replace(/[\+\s\-\(\)]/g, '');
    return limpio.slice(-10);
}

// -------------------------------------------------------------------
// CRUD BÁSICO
// -------------------------------------------------------------------

export function obtenerAgentes() {
    if (!agentesCache) {
        try {
            if (!existsSync(AGENTES_DB_PATH)) initDB();
            const data = readFileSync(AGENTES_DB_PATH, 'utf8');
            agentesCache = JSON.parse(data);
        } catch (e) {
            console.error('❌ Error leyendo BD de Agentes de Voz:', e);
            agentesCache = [DEFAULT_AGENT];
        }
    }
    return agentesCache;
}

function persistirAgentes(agentes) {
    writeFileSync(AGENTES_DB_PATH, JSON.stringify(agentes, null, 2), 'utf8');
    agentesCache = agentes;
}

export function crearAgente(datosAgente) {
    const agentes = obtenerAgentes();

    // Si tiene telefono_asignado, desasignar del agente anterior
    if (datosAgente.telefono_asignado) {
        _desasignarTelefono(agentes, datosAgente.telefono_asignado);
    }

    const nuevoAgente = {
        telefono_asignado: '',
        telefono_activo: true,
        estado: true,
        tipo: 'voz',
        esDefault: false,
        ...datosAgente,
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString()
    };

    agentes.push(nuevoAgente);
    try {
        persistirAgentes(agentes);
        return nuevoAgente;
    } catch (e) {
        console.error('❌ Error guardando nuevo Agente de Voz:', e);
        throw new Error('No se pudo guardar el agente');
    }
}

export function actualizarAgente(id, datosActualizados) {
    const agentes = obtenerAgentes();
    const index = agentes.findIndex(a => a.id === id);

    if (index === -1) throw new Error(`Agente con ID ${id} no encontrado`);

    // Si cambia el telefono_asignado, desasignar del agente anterior
    const nuevoTel = datosActualizados.telefono_asignado;
    if (nuevoTel !== undefined && nuevoTel !== agentes[index].telefono_asignado) {
        _desasignarTelefono(agentes, nuevoTel, id);
    }

    agentes[index] = {
        ...agentes[index],
        ...datosActualizados,
        id // Proteger ID
    };

    try {
        persistirAgentes(agentes);
        return agentes[index];
    } catch (e) {
        console.error('❌ Error actualizando Agente de Voz:', e);
        throw new Error('No se pudo actualizar el agente');
    }
}

export function eliminarAgente(id) {
    const agentes = obtenerAgentes();
    if (agentes.length <= 1) throw new Error('No se puede eliminar el único agente restante en el sistema');

    const index = agentes.findIndex(a => a.id === id);
    if (index === -1) return false;

    agentes.splice(index, 1);
    try {
        persistirAgentes(agentes);
        return true;
    } catch (e) {
        console.error('❌ Error eliminando Agente de Voz:', e);
        throw new Error('No se pudo eliminar el agente');
    }
}

// -------------------------------------------------------------------
// RESOLUCIÓN DE AGENTE (PRIORIDADES)
// -------------------------------------------------------------------

/**
 * Obtener el agente correcto para un número de teléfono llamado.
 * Prioridades:
 *   1. telefono_asignado === numero AND telefono_activo === true AND estado === true
 *   2. esDefault === true
 *   3. Primer agente activo de tipo 'voz' o 'hibrido'
 *
 * @param {string} numeroLlamado — El número al que llamaron (e.g. +15551234567)
 * @param {string|null} defaultAgentId — ID del agente default configurado en settings
 * @returns {object} El agente encontrado o el fallback
 */
export function getDefaultAgent(numeroLlamado, defaultAgentId = null) {
    const agentes = obtenerAgentes();
    const normalizado = normalizarTelefono(numeroLlamado);

    // PRIORIDAD 1: Agente con número asignado exactamente
    if (normalizado) {
        const por_telefono = agentes.find(a =>
            a.estado !== false &&
            a.telefono_activo !== false &&
            a.telefono_asignado &&
            normalizarTelefono(a.telefono_asignado) === normalizado
        );
        if (por_telefono) {
            console.log(`🎯 [VOICE] Agente encontrado por número asignado: ${por_telefono.nombre}`);
            return por_telefono;
        }
    }

    // PRIORIDAD 2: defaultAgentId desde settings
    if (defaultAgentId) {
        const por_id = agentes.find(a => a.id === defaultAgentId && a.estado !== false);
        if (por_id) {
            console.log(`🎯 [VOICE] Agente default por settings.defaultAgentId: ${por_id.nombre}`);
            return por_id;
        }
    }

    // PRIORIDAD 2b: esDefault === true (marcado en el agente)
    const default_marcado = agentes.find(a => a.esDefault === true && a.estado !== false);
    if (default_marcado) {
        console.log(`🎯 [VOICE] Agente default por esDefault flag: ${default_marcado.nombre}`);
        return default_marcado;
    }

    // PRIORIDAD 3: Primer agente activo de tipo voz o hibrido
    const primer_activo = agentes.find(a =>
        a.estado !== false &&
        (!a.tipo || a.tipo === 'voz' || a.tipo === 'hibrido')
    );
    if (primer_activo) {
        console.log(`🎯 [VOICE] Usando primer agente activo como fallback: ${primer_activo.nombre}`);
        return primer_activo;
    }

    // Fallback absoluto: cualquier agente (incluso si está "inactivo" en el sentido de estado)
    console.warn('⚠️ [VOICE] Sin agentes activos, usando agent[0] como último recurso');
    return agentes[0] || DEFAULT_AGENT;
}

/**
 * Obtener agente por número de teléfono (compatibilidad con código anterior)
 * @deprecated Usar getDefaultAgent en su lugar
 */
export function obtenerAgentePorTelefono(telefono) {
    return getDefaultAgent(telefono);
}

/**
 * Asignar un número de teléfono a un agente (desasignando del anterior)
 */
export function asignarTelefonoAAgente(agentId, telefono) {
    const agentes = obtenerAgentes();
    _desasignarTelefono(agentes, telefono, agentId);
    return actualizarAgente(agentId, { telefono_asignado: telefono, telefono_activo: true });
}

// Quitar un número de todos los agentes excepto el excluido
function _desasignarTelefono(agentes, telefono, excepto = null) {
    if (!telefono) return;
    const normalizado = normalizarTelefono(telefono);
    agentes.forEach(a => {
        if (a.id !== excepto && normalizarTelefono(a.telefono_asignado) === normalizado) {
            a.telefono_asignado = '';
            console.log(`📞 [VOICE] Número ${telefono} desasignado de agente ${a.nombre}`);
        }
    });
}

// Inicializar al cargar el módulo
initDB();

export default {
    obtenerAgentes,
    crearAgente,
    actualizarAgente,
    eliminarAgente,
    getDefaultAgent,
    obtenerAgentePorTelefono,
    asignarTelefonoAAgente
};

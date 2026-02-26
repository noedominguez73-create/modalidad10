import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTES_DB_PATH = join(__dirname, '..', 'data', 'agentes-voz.json');

// Agente por defecto si no hay ninguno configurado
const DEFAULT_AGENT = {
    id: 'agent_default',
    nombre: 'Asesor General',
    descripcion: 'Agente principal del sistema',
    saludo: 'Bienvenido al asesor de pensiones del IMSS. Soy una inteligencia artificial y te ayudaré con tu Modalidad 40 o Modalidad 10. ¿En qué puedo ayudarte?',
    instrucciones: 'Eres un experto asesor de pensiones del IMSS en México. Tu objetivo es precalificar clientes, explicarles cómo funciona la Modalidad 40, Modalidad 10 y calcular sus pensiones basándote en la ley del 73. Sé amable, profesional, conciso y directo.',
    voz: 'Alloy',
    idioma: 'es-MX',
    telefono: '',
    telefonoActivo: true,
    createdAt: new Date().toISOString()
};

let agentesCache = null;

// Inicializar DB si no existe
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

// Cargar todos los agentes
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

// Buscar agente por número de teléfono
export function obtenerAgentePorTelefono(telefono) {
    const agentes = obtenerAgentes();
    // Busca coincidencia exacta o que termine con el número (para manejar formatos internacionales/locales)
    const agenteEncontrado = agentes.find(a =>
        a.telefonoActivo &&
        a.telefono &&
        (a.telefono === telefono || telefono.endsWith(a.telefono.replace('+', '')))
    );

    return agenteEncontrado || agentes[0]; // Retorna el primero (default) si no encuentra coincidencia
}

// Crear nuevo agente
export function crearAgente(datosAgente) {
    const agentes = obtenerAgentes();
    const nuevoAgente = {
        ...datosAgente,
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString()
    };

    agentes.push(nuevoAgente);

    try {
        writeFileSync(AGENTES_DB_PATH, JSON.stringify(agentes, null, 2), 'utf8');
        agentesCache = agentes;
        return nuevoAgente;
    } catch (e) {
        console.error('❌ Error guardando nuevo Agente de Voz:', e);
        throw new Error('No se pudo guardar el agente');
    }
}

// Actualizar agente
export function actualizarAgente(id, datosActualizados) {
    const agentes = obtenerAgentes();
    const index = agentes.findIndex(a => a.id === id);

    if (index === -1) {
        throw new Error(`Agente con ID ${id} no encontrado`);
    }

    agentes[index] = {
        ...agentes[index],
        ...datosActualizados,
        id // Proteger ID
    };

    try {
        writeFileSync(AGENTES_DB_PATH, JSON.stringify(agentes, null, 2), 'utf8');
        agentesCache = agentes;
        return agentes[index];
    } catch (e) {
        console.error('❌ Error actualizando Agente de Voz:', e);
        throw new Error('No se pudo actualizar el agente');
    }
}

// Eliminar agente
export function eliminarAgente(id) {
    const agentes = obtenerAgentes();
    // No permitir borrar el último agente (default)
    if (agentes.length <= 1) {
        throw new Error('No se puede eliminar el único agente restante en el sistema');
    }

    const index = agentes.findIndex(a => a.id === id);

    if (index === -1) {
        return false;
    }

    agentes.splice(index, 1);

    try {
        writeFileSync(AGENTES_DB_PATH, JSON.stringify(agentes, null, 2), 'utf8');
        agentesCache = agentes;
        return true;
    } catch (e) {
        console.error('❌ Error eliminando Agente de Voz:', e);
        throw new Error('No se pudo eliminar el agente');
    }
}

// Inicializar al cargar el módulo
initDB();

export default {
    obtenerAgentes,
    obtenerAgentePorTelefono,
    crearAgente,
    actualizarAgente,
    eliminarAgente
};

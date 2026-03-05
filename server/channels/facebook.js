/**
 * FACEBOOK MESSENGER — Integración con Meta Graph API
 *
 * Soporta: texto, imágenes
 * Usa la misma Graph API que WhatsApp pero con endpoints de Messenger
 *
 * Configuración requerida (env vars):
 *   FACEBOOK_PAGE_TOKEN   — Page Access Token (desde Meta Business)
 *   FACEBOOK_VERIFY_TOKEN — Token para verificar webhook (lo defines tú)
 */

import settings from '../settings.js';
import { SessionMap } from '../shared/session-store.js';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// Sesiones con LRU Cache (máximo 5000, TTL 1 hora)
const sesiones = new SessionMap('facebook', { max: 5000, ttl: 1000 * 60 * 60 });

// Lazy import de ai-agent (mismo patrón que telegram.js)
let _aiAgent = null;
async function getProcessarConIA() {
    if (!_aiAgent) {
        _aiAgent = await import('../ai-agent.js');
    }
    return _aiAgent.default?.procesarConIA || _aiAgent.procesarConIA;
}

// ─── Configuración ───────────────────────────────────────────────────

function obtenerConfig() {
    return settings.obtenerFacebook();
}

export function initFacebook() {
    const cfg = obtenerConfig();
    if (cfg.pageToken && cfg.pageToken.length > 10) {
        console.log('✓ Facebook Messenger inicializado');
        return true;
    }
    console.log('⚠ Facebook Messenger no configurado — falta FACEBOOK_PAGE_TOKEN');
    return false;
}

// ─── Sesiones ────────────────────────────────────────────────────────

function obtenerSesion(senderId) {
    if (!sesiones.has(senderId)) {
        sesiones.set(senderId, {
            senderId,
            paso: 'inicio',
            datos: {},
            historial: [],
            ultimaActividad: Date.now()
        });
    }
    const sesion = sesiones.get(senderId);
    sesion.ultimaActividad = Date.now();
    return sesion;
}

// limpiarSesionesInactivas ya no es necesario - LRU Cache lo maneja automáticamente

function obtenerSesionesActivas() {
    return Array.from(sesiones.values());
}

// ─── Verificación del Webhook (Meta requiere esto al configurar) ─────

export function verificarWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const cfg = obtenerConfig();

    if (mode === 'subscribe' && token === cfg.verifyToken) {
        console.log('✅ [FB] Webhook verificado por Meta');
        return res.status(200).send(challenge);
    }

    console.log('❌ [FB] Verificación fallida:', { mode, token });
    return res.status(403).send('Forbidden');
}

// ─── Webhook: Recibir mensajes de Messenger ──────────────────────────

export async function handleIncomingMessage(req, res) {
    // Meta siempre espera 200 inmediato
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;

        if (body.object !== 'page') return;

        const entries = body.entry || [];
        for (const entry of entries) {
            const messaging = entry.messaging || [];

            for (const event of messaging) {
                const senderId = event.sender?.id;
                if (!senderId) continue;

                // Ignorar eventos de echo (mensajes enviados por nosotros)
                if (event.message?.is_echo) continue;

                const sesion = obtenerSesion(senderId);

                // Obtener nombre del usuario (una sola vez)
                if (!sesion.nombre) {
                    sesion.nombre = await obtenerNombreUsuario(senderId);
                }

                console.log(`💬 [FB] Mensaje de ${sesion.nombre || senderId}`);

                let respuesta = '';

                if (event.message?.text) {
                    const texto = event.message.text;
                    console.log(`💬 [FB] Texto: "${texto}"`);

                    // Indicador de "escribiendo..."
                    await enviarAccionEscribiendo(senderId);

                    try {
                        const procesarConIA = await getProcessarConIA();
                        if (procesarConIA) {
                            const resultado = await procesarConIA(texto, {
                                canal: 'facebook',
                                senderId,
                                sesion: {
                                    historial: sesion.historial,
                                    datos: sesion.datos
                                }
                            });
                            respuesta = resultado.mensaje || resultado;
                            if (resultado.nuevosDatos) {
                                sesion.datos = { ...sesion.datos, ...resultado.nuevosDatos };
                            }
                        } else {
                            respuesta = '¡Hola! Soy el asesor de pensiones del IMSS. El sistema de IA no está disponible en este momento.';
                        }
                    } catch (e) {
                        console.error('❌ [FB] Error IA:', e.message);
                        respuesta = 'Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?';
                    }

                    // Guardar historial
                    sesion.historial.push({ rol: 'usuario', mensaje: texto, timestamp: Date.now() });
                    sesion.historial.push({ rol: 'asistente', mensaje: respuesta, timestamp: Date.now() });

                } else if (event.message?.attachments) {
                    // Imagen u otro adjunto
                    const attachment = event.message.attachments[0];
                    if (attachment.type === 'image') {
                        respuesta = 'Recibí tu imagen. Por ahora solo puedo procesar mensajes de texto. ¿En qué puedo ayudarte?';
                    } else {
                        respuesta = '¡Hola! Puedo ayudarte con preguntas sobre pensiones IMSS. Escríbeme tu duda.';
                    }

                } else if (event.postback?.payload) {
                    // Botones postback
                    const payload = event.postback.payload;
                    console.log(`🔘 [FB] Postback: ${payload}`);
                    respuesta = `Seleccionaste: ${payload}. ¿En qué puedo ayudarte?`;
                }

                // Enviar respuesta
                if (respuesta) {
                    // Facebook tiene límite de 2000 caracteres por mensaje
                    if (respuesta.length > 2000) {
                        const partes = dividirMensaje(respuesta, 2000);
                        for (const parte of partes) {
                            await enviarMensaje(senderId, parte);
                        }
                    } else {
                        await enviarMensaje(senderId, respuesta);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ [FB] Error procesando webhook:', error);
    }
}

// ─── Enviar mensaje ──────────────────────────────────────────────────

export async function enviarMensaje(recipientId, texto) {
    const cfg = obtenerConfig();
    if (!cfg.pageToken) throw new Error('Facebook no configurado — falta FACEBOOK_PAGE_TOKEN');

    const url = `${GRAPH_API}/me/messages?access_token=${cfg.pageToken}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: texto }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('❌ [FB] Error enviando mensaje:', data);
        throw new Error(`Meta API error: ${data.error?.message || JSON.stringify(data)}`);
    }

    console.log(`📤 [FB] Mensaje enviado a ${recipientId}: "${texto.substring(0, 50)}..."`);
    return data.message_id;
}

// ─── Acción "escribiendo..." ─────────────────────────────────────────

async function enviarAccionEscribiendo(recipientId) {
    try {
        const cfg = obtenerConfig();
        await fetch(`${GRAPH_API}/me/messages?access_token=${cfg.pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                sender_action: 'typing_on'
            })
        });
    } catch (e) {
        // No es crítico
    }
}

// ─── Obtener nombre del usuario ──────────────────────────────────────

async function obtenerNombreUsuario(senderId) {
    try {
        const cfg = obtenerConfig();
        const response = await fetch(
            `${GRAPH_API}/${senderId}?fields=first_name,last_name&access_token=${cfg.pageToken}`
        );
        const data = await response.json();
        return data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null;
    } catch (e) {
        return null;
    }
}

// ─── Utilidades ──────────────────────────────────────────────────────

function dividirMensaje(texto, maxLength) {
    const partes = [];
    let restante = texto;
    while (restante.length > maxLength) {
        // Buscar punto o salto de línea para cortar
        let corte = restante.lastIndexOf('\n', maxLength);
        if (corte < maxLength / 2) corte = restante.lastIndexOf('. ', maxLength);
        if (corte < maxLength / 2) corte = maxLength;
        partes.push(restante.substring(0, corte).trim());
        restante = restante.substring(corte).trim();
    }
    if (restante) partes.push(restante);
    return partes;
}

export default {
    initFacebook,
    verificarWebhook,
    handleIncomingMessage,
    enviarMensaje,
    obtenerSesion,
    obtenerSesionesActivas
};

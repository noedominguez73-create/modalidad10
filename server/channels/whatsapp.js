/**
 * WHATSAPP — Integración directa con Meta Cloud API
 *
 * NO usa Twilio — se conecta directamente a graph.facebook.com
 * Soporta: texto, imágenes, documentos
 *
 * Configuración requerida (env vars o settings.json):
 *   WHATSAPP_TOKEN        — Access Token permanente de Meta
 *   WHATSAPP_PHONE_ID     — Phone Number ID (773416909191493)
 *   WHATSAPP_VERIFY_TOKEN — Token para verificar webhook (lo defines tú)
 */

import settings from '../settings.js';
import { SessionMap } from '../shared/session-store.js';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// Sesiones con LRU Cache (máximo 5000, TTL 1 hora)
const sesiones = new SessionMap('whatsapp', { max: 5000, ttl: 1000 * 60 * 60 });

// ─── Configuración ───────────────────────────────────────────────────

function obtenerConfig() {
  const cfg = settings.cargarSettings();
  // IMPORTANTE: Limpiar espacios/saltos de línea del token (Railway a veces los añade)
  const rawToken = process.env.WHATSAPP_TOKEN || cfg.whatsapp?.token || '';
  return {
    token: rawToken.replace(/\s+/g, ''),
    phoneId: (process.env.WHATSAPP_PHONE_ID || cfg.whatsapp?.phoneId || '773416909191493').trim(),
    verifyToken: (process.env.WHATSAPP_VERIFY_TOKEN || cfg.whatsapp?.verifyToken || 'asesoriaimss_verify_2024').trim()
  };
}

export function initWhatsApp() {
  const cfg = obtenerConfig();
  if (cfg.token && cfg.phoneId) {
    console.log(`✓ WhatsApp (Meta Cloud API) inicializado — Phone ID: ${cfg.phoneId}`);
    return true;
  }
  console.log('⚠ WhatsApp no configurado — falta WHATSAPP_TOKEN en variables de entorno');
  return false;
}

// ─── Sesiones ────────────────────────────────────────────────────────

function obtenerSesion(telefono) {
  if (!sesiones.has(telefono)) {
    sesiones.set(telefono, {
      telefono,
      paso: 'inicio',
      datos: {},
      historial: [],
      ultimaActividad: Date.now()
    });
  }
  const sesion = sesiones.get(telefono);
  sesion.ultimaActividad = Date.now();
  return sesion;
}

// limpiarSesionesInactivas ya no es necesario - LRU Cache lo maneja automáticamente

function obtenerSesionesActivas() {
  return Array.from(sesiones.values()).map(s => ({
    ...s,
    canal: 'whatsapp'
  }));
}

// ─── Verificación del Webhook (Meta requiere esto al configurar) ─────

export function verificarWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const cfg = obtenerConfig();

  if (mode === 'subscribe' && token === cfg.verifyToken) {
    console.log('✅ [WA] Webhook verificado por Meta');
    return res.status(200).send(challenge);
  }

  console.log('❌ [WA] Verificación fallida:', { mode, token });
  return res.status(403).send('Forbidden');
}

// ─── Webhook: Recibir mensajes de Meta ───────────────────────────────

export async function handleIncomingMessage(req, res, procesarConIA, validarDocumento) {
  // Meta siempre espera 200 inmediato
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Verificar que sea un evento de mensaje
    if (!body?.object || body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value?.messages || [];
        const contacts = value?.contacts || [];

        for (const msg of messages) {
          const telefono = msg.from; // Número del remitente (sin +)
          const nombreContacto = contacts[0]?.profile?.name || telefono;
          const msgType = msg.type;

          console.log(`💬 [WA] Mensaje de ${nombreContacto} (${telefono}): tipo=${msgType}`);

          // Marcar como leído
          await marcarComoLeido(msg.id);

          // Indicador de "escribiendo..."
          await enviarIndicadorEscribiendo(telefono);

          const sesion = obtenerSesion(telefono);
          sesion.nombreContacto = nombreContacto;

          let respuesta = '';

          if (msgType === 'text' && msg.text?.body) {
            const texto = msg.text.body;
            console.log(`💬 [WA] Texto: "${texto}"`);

            if (procesarConIA) {
              try {
                const resultado = await procesarConIA(texto, {
                  canal: 'whatsapp',
                  telefono,
                  sesion: {
                    historial: sesion.historial,
                    datos: sesion.datos
                  }
                });
                respuesta = resultado.mensaje || resultado;
                if (resultado.nuevosDatos) {
                  sesion.datos = { ...sesion.datos, ...resultado.nuevosDatos };
                }
              } catch (e) {
                console.error('❌ [WA] Error IA:', e.message);
                respuesta = 'Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?';
              }
            } else {
              respuesta = '¡Hola! Soy el asesor de pensiones del IMSS. El sistema de IA no está disponible en este momento, pero puedo ayudarte pronto.';
            }

            // Guardar en historial
            sesion.historial.push({ rol: 'usuario', mensaje: texto, timestamp: Date.now() });
            sesion.historial.push({ rol: 'asistente', mensaje: respuesta, timestamp: Date.now() });

          } else if (msgType === 'image' || msgType === 'document') {
            // Documento o imagen
            const mediaId = msg[msgType]?.id;
            const caption = msg[msgType]?.caption || '';
            console.log(`📎 [WA] Media recibido: ${msgType}, id=${mediaId}`);

            if (validarDocumento && mediaId) {
              try {
                const mediaUrl = await obtenerUrlMedia(mediaId);
                const resultado = await validarDocumento({
                  url: mediaUrl,
                  tipo: msgType,
                  telefono,
                  sesion
                });
                respuesta = resultado.mensaje || 'Documento recibido. Lo estoy analizando.';
              } catch (e) {
                console.error('❌ [WA] Error validando documento:', e);
                respuesta = 'Recibí tu documento pero no pude procesarlo. ¿Podrías enviarlo de nuevo?';
              }
            } else {
              respuesta = 'Recibí tu archivo. Por ahora solo puedo procesar mensajes de texto. ¿En qué puedo ayudarte?';
            }

          } else if (msgType === 'audio') {
            respuesta = 'Recibí tu audio. Por ahora solo puedo procesar mensajes de texto. ¿Podrías escribirme tu pregunta?';

          } else if (msgType === 'location') {
            respuesta = 'Recibí tu ubicación. ¿En qué puedo ayudarte con tu trámite del IMSS?';

          } else {
            // Tipo no soportado
            respuesta = '¡Hola! Puedo ayudarte con preguntas sobre pensiones IMSS. Escríbeme tu duda.';
          }

          // Enviar respuesta
          if (respuesta) {
            await enviarMensaje(telefono, respuesta);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ [WA] Error procesando webhook:', error);
  }
}

// ─── Enviar mensaje ──────────────────────────────────────────────────

export async function enviarMensaje(telefono, texto) {
  const cfg = obtenerConfig();
  if (!cfg.token) throw new Error('WhatsApp no configurado — falta WHATSAPP_TOKEN');

  // Asegurar formato: solo dígitos, sin + ni whatsapp:
  const numero = telefono.replace(/\D/g, '');

  const url = `${GRAPH_API}/${cfg.phoneId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: texto }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ [WA] Error enviando mensaje:', data);
    throw new Error(`Meta API error: ${data.error?.message || JSON.stringify(data)}`);
  }

  console.log(`📤 [WA] Mensaje enviado a ${numero}: "${texto.substring(0, 50)}..."`);
  return data.messages?.[0]?.id || data;
}

// ─── Marcar como leído ───────────────────────────────────────────────

async function marcarComoLeido(messageId) {
  try {
    const cfg = obtenerConfig();
    await fetch(`${GRAPH_API}/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    });
  } catch (e) {
    // No es crítico si falla
  }
}

// ─── Indicador de escribiendo ────────────────────────────────────────

async function enviarIndicadorEscribiendo(telefono) {
  try {
    const cfg = obtenerConfig();
    const numero = telefono.replace(/\D/g, '');
    await fetch(`${GRAPH_API}/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'reaction',
        // Tweak: no hay "typing indicator" directo en Cloud API,
        // pero marcar como leído da feedback visual al usuario
      })
    });
  } catch (e) {
    // No es crítico
  }
}

// ─── Obtener URL de media (para descargar imágenes/documentos) ──────

async function obtenerUrlMedia(mediaId) {
  const cfg = obtenerConfig();
  const response = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${cfg.token}` }
  });
  const data = await response.json();
  return data.url;
}

// ─── Enviar imagen ───────────────────────────────────────────────────

export async function enviarImagen(telefono, imageUrl, caption = '') {
  const cfg = obtenerConfig();
  const numero = telefono.replace(/\D/g, '');

  const response = await fetch(`${GRAPH_API}/${cfg.phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'image',
      image: { link: imageUrl, caption }
    })
  });

  return response.json();
}

// ─── Enviar documento ────────────────────────────────────────────────

export async function enviarDocumento(telefono, documentUrl, filename = 'documento.pdf', caption = '') {
  const cfg = obtenerConfig();
  const numero = telefono.replace(/\D/g, '');

  const response = await fetch(`${GRAPH_API}/${cfg.phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'document',
      document: { link: documentUrl, filename, caption }
    })
  });

  return response.json();
}

export default {
  initWhatsApp,
  verificarWebhook,
  handleIncomingMessage,
  enviarMensaje,
  enviarImagen,
  enviarDocumento,
  obtenerSesion,
  limpiarSesionesInactivas,
  obtenerSesionesActivas
};

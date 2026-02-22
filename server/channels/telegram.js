/**
 * TELEGRAM BOT - Integración con Telegram Bot API
 * Soporta: texto, imágenes, documentos, botones inline, comandos
 */

import TelegramBot from 'node-telegram-bot-api';
import settings from '../settings.js';

let bot = null;
const sesiones = new Map();

// Obtener configuración actual
function getConfig() {
  return settings.obtenerTelegram();
}

export function initTelegram(procesarConIA, validarDocumento) {
  const config = getConfig();

  if (!config.botToken) {
    console.log('⚠ Telegram Bot no configurado (falta TELEGRAM_BOT_TOKEN)');
    return false;
  }

  // Si ya hay un bot corriendo, detenerlo primero
  if (bot) {
    bot.stopPolling();
  }

  bot = new TelegramBot(config.botToken, { polling: true });

  // Comando /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const nombre = msg.from.first_name || 'Usuario';

    await bot.sendMessage(chatId,
      `¡Hola ${nombre}! 👋\n\n` +
      `Soy el *Asesor de Pensiones IMSS*, una inteligencia artificial especializada en:\n\n` +
      `📊 *Modalidad 40* - Continuación voluntaria\n` +
      `📋 *Modalidad 10* - Incorporación voluntaria\n` +
      `💰 *Cálculo de pensión* - Ley 73 y 97\n\n` +
      `¿En qué puedo ayudarte hoy?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Calcular Modalidad 40', callback_data: 'mod40' }],
            [{ text: '📋 Calcular Modalidad 10', callback_data: 'mod10' }],
            [{ text: '💰 Proyectar mi pensión', callback_data: 'pension' }],
            [{ text: '❓ Tengo una pregunta', callback_data: 'pregunta' }]
          ]
        }
      }
    );

    // Iniciar sesión
    sesiones.set(chatId, {
      chatId,
      nombre,
      paso: 'inicio',
      datos: {},
      historial: []
    });
  });

  // Comando /calcular
  bot.onText(/\/calcular/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      '¿Qué deseas calcular?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Modalidad 40', callback_data: 'mod40' }],
            [{ text: 'Modalidad 10', callback_data: 'mod10' }]
          ]
        }
      }
    );
  });

  // Comando /ayuda
  bot.onText(/\/ayuda|\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      `*Comandos disponibles:*\n\n` +
      `/start - Iniciar conversación\n` +
      `/calcular - Calcular cuotas\n` +
      `/pension - Proyectar pensión\n` +
      `/documentos - Enviar documentos\n` +
      `/ayuda - Ver esta ayuda\n\n` +
      `También puedes enviarme tus preguntas directamente o adjuntar documentos para validar.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Callback de botones inline
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    await bot.answerCallbackQuery(query.id);

    const sesion = obtenerSesion(chatId);

    switch (data) {
      case 'mod40':
        sesion.paso = 'mod40_inicio';
        await bot.sendMessage(chatId,
          '📊 *Calculadora Modalidad 40*\n\n' +
          'Para calcular tu cuota necesito algunos datos.\n\n' +
          '¿Cuál es tu fecha de nacimiento? (DD/MM/AAAA)',
          { parse_mode: 'Markdown' }
        );
        break;

      case 'mod10':
        sesion.paso = 'mod10_inicio';
        await bot.sendMessage(chatId,
          '📋 *Calculadora Modalidad 10*\n\n' +
          '¿Cuál es tu ingreso mensual estimado?',
          { parse_mode: 'Markdown' }
        );
        break;

      case 'pension':
        sesion.paso = 'pension_inicio';
        await bot.sendMessage(chatId,
          '💰 *Proyección de Pensión*\n\n' +
          '¿En qué año comenzaste a cotizar al IMSS?',
          { parse_mode: 'Markdown' }
        );
        break;

      case 'pregunta':
        sesion.paso = 'pregunta_libre';
        await bot.sendMessage(chatId,
          '¿Cuál es tu pregunta? Puedo ayudarte con:\n\n' +
          '• Requisitos de Modalidad 40 y 10\n' +
          '• Diferencias entre Ley 73 y 97\n' +
          '• Cálculo de semanas cotizadas\n' +
          '• Y más...'
        );
        break;
    }
  });

  // Mensajes de texto
  bot.on('message', async (msg) => {
    // Ignorar comandos (ya manejados arriba)
    if (msg.text && msg.text.startsWith('/')) return;
    // Ignorar si es callback
    if (!msg.text && !msg.document && !msg.photo) return;

    const chatId = msg.chat.id;
    const sesion = obtenerSesion(chatId);

    try {
      // Si es documento
      if (msg.document) {
        await bot.sendMessage(chatId, '📄 Recibí tu documento, analizándolo...');

        const fileId = msg.document.file_id;
        const fileLink = await bot.getFileLink(fileId);

        const resultado = await validarDocumento({
          url: fileLink,
          tipo: msg.document.mime_type,
          nombre: msg.document.file_name,
          chatId,
          sesion
        });

        await bot.sendMessage(chatId, resultado.mensaje, { parse_mode: 'Markdown' });
        return;
      }

      // Si es foto
      if (msg.photo) {
        await bot.sendMessage(chatId, '🖼 Recibí tu imagen, analizándola...');

        const foto = msg.photo[msg.photo.length - 1]; // Mejor calidad
        const fileLink = await bot.getFileLink(foto.file_id);

        const resultado = await validarDocumento({
          url: fileLink,
          tipo: 'image/jpeg',
          chatId,
          sesion
        });

        await bot.sendMessage(chatId, resultado.mensaje, { parse_mode: 'Markdown' });
        return;
      }

      // Mensaje de texto normal
      const resultado = await procesarConIA(msg.text, {
        canal: 'telegram',
        chatId,
        sesion
      });

      // Actualizar sesión
      if (resultado.nuevosDatos) {
        sesion.datos = { ...sesion.datos, ...resultado.nuevosDatos };
      }
      if (resultado.nuevoPaso) {
        sesion.paso = resultado.nuevoPaso;
      }

      // Enviar respuesta
      const opciones = { parse_mode: 'Markdown' };
      if (resultado.botones) {
        opciones.reply_markup = {
          inline_keyboard: resultado.botones.map(btn => [{ text: btn.texto, callback_data: btn.data }])
        };
      }

      await bot.sendMessage(chatId, resultado.mensaje, opciones);

    } catch (error) {
      console.error('Error en Telegram:', error);
      await bot.sendMessage(chatId, 'Disculpa, tuve un problema. ¿Podrías intentar de nuevo?');
    }
  });

  console.log('✓ Telegram Bot inicializado');
  return true;
}

function obtenerSesion(chatId) {
  if (!sesiones.has(chatId)) {
    sesiones.set(chatId, {
      chatId,
      paso: 'inicio',
      datos: {},
      historial: []
    });
  }
  return sesiones.get(chatId);
}

// Enviar mensaje proactivo
export async function enviarMensaje(chatId, mensaje, opciones = {}) {
  if (!bot) throw new Error('Telegram no inicializado');
  return bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown', ...opciones });
}

// Enviar documento
export async function enviarDocumento(chatId, rutaArchivo, caption = '') {
  if (!bot) throw new Error('Telegram no inicializado');
  return bot.sendDocument(chatId, rutaArchivo, { caption });
}

export default {
  initTelegram,
  enviarMensaje,
  enviarDocumento,
  obtenerSesion
};

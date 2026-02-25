/**
 * TWILIO TOKEN - Generación de Access Tokens para el SDK de voz
 */

import twilio from 'twilio';
import settings from '../settings.js';

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

/**
 * Generar un Access Token para un usuario (identity)
 */
export function generarAccessToken(identity) {
    const config = settings.obtenerTwilio();

    if (!config.accountSid || !config.apiKeySid || !config.apiKeySecret || !config.twimlAppSid) {
        throw new Error('Falta configuración de Twilio (API Key o TwiML App SID)');
    }

    // Crear el Access Token
    const token = new AccessToken(
        config.accountSid,
        config.apiKeySid,
        config.apiKeySecret,
        { identity: identity || 'usuario_anonimo' }
    );

    // Crear el grant para Voz
    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: config.twimlAppSid,
        incomingAllow: true // Permitir recibir llamadas
    });

    token.addGrant(voiceGrant);

    return {
        token: token.toJwt(),
        identity: identity,
        expires: new Date(Date.now() + 3600000).toISOString() // 1 hora
    };
}

export default {
    generarAccessToken
};

/**
 * UTILS - Verificación de conectividad real con proveedores externos
 */

import fetch from 'node-fetch';

/**
 * Verificar Deepgram
 */
export async function verificarDeepgram(apiKey) {
    if (!apiKey) return { ok: false, error: 'No hay API Key' };

    try {
        // Usamos el endpoint de proyectos como un "ping" ligero
        const response = await fetch('https://api.deepgram.com/v1/projects', {
            headers: { 'Authorization': `Token ${apiKey}` }
        });

        if (response.ok) {
            const data = await response.json();
            return { ok: true, projects: data.projects?.length || 0 };
        } else {
            const err = await response.text();
            return { ok: false, error: `Error ${response.status}: ${err}` };
        }
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Verificar LLMs
 */
export async function verificarLLM(provider, apiKey) {
    if (!apiKey) return { ok: false, error: 'No hay API Key' };

    try {
        let url, headers, body;

        switch (provider) {
            case 'openai':
                url = 'https://api.openai.com/v1/models';
                headers = { 'Authorization': `Bearer ${apiKey}` };
                break;

            case 'anthropic':
                url = 'https://api.anthropic.com/v1/messages';
                headers = {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                };
                // Anthropic requiere un body para el ping
                body = JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'ping' }]
                });
                break;

            case 'gemini':
                // Usamos listModels
                url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                break;

            case 'groq':
                url = 'https://api.groq.com/openai/v1/models';
                headers = { 'Authorization': `Bearer ${apiKey}` };
                break;

            default:
                return { ok: false, error: 'Proveedor no soportado para verificación' };
        }

        const response = await fetch(url, {
            method: body ? 'POST' : 'GET',
            headers: headers || {},
            body: body
        });

        if (response.ok) {
            return { ok: true };
        } else {
            const err = await response.text();
            return { ok: false, error: `Error ${response.status}: ${err}` };
        }
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

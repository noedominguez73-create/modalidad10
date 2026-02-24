/**
 * LLM ROUTER
 * Enruta peticiones a diferentes proveedores LLM con failover automático
 */

import { LLM_PROVIDERS, getProviderApiKey, isProviderAvailable } from './index.js';
import settings from '../settings.js';

// Cache de configuración
let providerConfig = null;

/**
 * Obtener configuración de proveedores
 */
function getConfig() {
  if (!providerConfig) {
    providerConfig = settings.obtenerProviderConfig?.() || {
      llm: { default: 'gemini', fallback: ['groq', 'anthropic'], perChannel: {} }
    };
  }
  return providerConfig;
}

/**
 * Refrescar configuración
 */
export function refreshConfig() {
  providerConfig = null;
}

/**
 * Llamar a Gemini
 */
async function callGemini(messages, options) {
  const apiKey = options.apiKey || getProviderApiKey('llm', 'gemini');
  const model = options.model || 'gemini-1.5-flash';

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');

  const contents = userMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemMsg }] },
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 1000
        }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error en Gemini API');
  }

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Respuesta vacía de Gemini');
  }

  return {
    content: data.candidates[0].content.parts[0].text,
    provider: 'gemini',
    model
  };
}

/**
 * Llamar a Anthropic Claude
 */
async function callAnthropic(messages, options) {
  const apiKey = options.apiKey || getProviderApiKey('llm', 'anthropic');
  const model = options.model || 'claude-3-5-sonnet-20241022';

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 1000,
      system: systemMsg,
      messages: userMsgs.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error en Anthropic API');
  }

  return {
    content: data.content[0].text,
    provider: 'anthropic',
    model
  };
}

/**
 * Llamar a OpenAI
 */
async function callOpenAI(messages, options) {
  const apiKey = options.apiKey || getProviderApiKey('llm', 'openai');
  const model = options.model || 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error en OpenAI API');
  }

  return {
    content: data.choices[0].message.content,
    provider: 'openai',
    model
  };
}

/**
 * Llamar a Groq
 */
async function callGroq(messages, options) {
  const apiKey = options.apiKey || getProviderApiKey('llm', 'groq');
  const model = options.model || 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 1000
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error en Groq API');
  }

  return {
    content: data.choices[0].message.content,
    provider: 'groq',
    model
  };
}

/**
 * Llamar a Zhipu GLM
 */
async function callGLM(messages, options) {
  const apiKey = options.apiKey || getProviderApiKey('llm', 'glm5');
  const model = options.model || 'glm-4-flash';

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Error en GLM API');
  }

  return {
    content: data.choices[0].message.content,
    provider: 'glm5',
    model
  };
}

/**
 * Llamar a un proveedor específico
 */
async function callProvider(providerId, messages, options = {}) {
  const startTime = Date.now();

  let result;
  switch (providerId) {
    case 'gemini':
      result = await callGemini(messages, options);
      break;
    case 'anthropic':
      result = await callAnthropic(messages, options);
      break;
    case 'openai':
      result = await callOpenAI(messages, options);
      break;
    case 'groq':
      result = await callGroq(messages, options);
      break;
    case 'glm5':
      result = await callGLM(messages, options);
      break;
    default:
      throw new Error(`Proveedor LLM desconocido: ${providerId}`);
  }

  result.latency = Date.now() - startTime;
  return result;
}

/**
 * Router principal con failover
 */
export async function routeLLM(messages, options = {}) {
  const config = getConfig();
  const { channel, preferredProvider } = options;

  // Determinar proveedor: preferido > por canal > default
  let provider = preferredProvider
    || config.llm?.perChannel?.[channel]
    || config.llm?.default
    || 'gemini';

  // Verificar disponibilidad
  if (!isProviderAvailable('llm', provider)) {
    console.log(`⚠️ Provider ${provider} no disponible, buscando alternativa...`);
    const fallbacks = config.llm?.fallback || ['groq', 'anthropic', 'openai'];

    for (const fb of fallbacks) {
      if (isProviderAvailable('llm', fb)) {
        console.log(`✓ Usando fallback: ${fb}`);
        provider = fb;
        break;
      }
    }
  }

  // Obtener modelo configurado
  const model = options.model || config.llm?.models?.[provider] || LLM_PROVIDERS[provider]?.defaultModel;

  console.log(`🤖 LLM Router: ${provider} (${model})`);

  // Intentar con proveedor principal
  try {
    return await callProvider(provider, messages, { ...options, model });
  } catch (error) {
    console.error(`❌ Error en ${provider}:`, error.message);

    // Failover a proveedores alternativos
    const fallbacks = config.llm?.fallback || ['groq', 'anthropic', 'openai'];

    for (const fallback of fallbacks) {
      if (fallback === provider) continue;
      if (!isProviderAvailable('llm', fallback)) continue;

      try {
        console.log(`⚠️ Failover: ${provider} → ${fallback}`);
        const fbModel = config.llm?.models?.[fallback] || LLM_PROVIDERS[fallback]?.defaultModel;
        return await callProvider(fallback, messages, { ...options, model: fbModel });
      } catch (e) {
        console.error(`❌ Failover ${fallback} falló:`, e.message);
        continue;
      }
    }

    throw new Error(`Todos los proveedores LLM fallaron. Último error: ${error.message}`);
  }
}

/**
 * Probar un proveedor específico
 */
export async function testProvider(providerId, testMessage = '¿Cuánto es 2+2?') {
  if (!isProviderAvailable('llm', providerId)) {
    return {
      success: false,
      provider: providerId,
      error: 'API Key no configurada',
      available: false
    };
  }

  const messages = [
    { role: 'system', content: 'Responde de forma muy breve.' },
    { role: 'user', content: testMessage }
  ];

  try {
    const startTime = Date.now();
    const result = await callProvider(providerId, messages, {});
    const latency = Date.now() - startTime;

    return {
      success: true,
      provider: providerId,
      model: result.model,
      response: result.content.substring(0, 100),
      latency,
      available: true
    };
  } catch (error) {
    return {
      success: false,
      provider: providerId,
      error: error.message,
      available: true
    };
  }
}

/**
 * Probar todos los proveedores disponibles
 */
export async function testAllProviders(testMessage = '¿Cuánto es 2+2?') {
  const results = {};

  for (const providerId of Object.keys(LLM_PROVIDERS)) {
    results[providerId] = await testProvider(providerId, testMessage);
  }

  return results;
}

export default {
  routeLLM,
  testProvider,
  testAllProviders,
  refreshConfig
};

/**
 * PROVIDER REGISTRY
 * Registro central de todos los proveedores de IA disponibles
 */

// Proveedores de LLM (Cerebro)
export const LLM_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GOOGLE_API_KEY',
    altEnvKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', speed: 'fast' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', speed: 'medium' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', speed: 'fast' }
    ],
    defaultModel: 'gemini-1.5-flash',
    latency: '800-1500ms',
    costTier: 'low'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', speed: 'medium' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', speed: 'fast' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', speed: 'slow' }
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
    latency: '1000-2000ms',
    costTier: 'medium'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI GPT',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', speed: 'medium' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', speed: 'fast' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', speed: 'slow' }
    ],
    defaultModel: 'gpt-4o-mini',
    latency: '1500-3000ms',
    costTier: 'high'
  },
  groq: {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', speed: 'fast' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', speed: 'ultra-fast' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', speed: 'fast' }
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    latency: '200-400ms',
    costTier: 'low',
    recommended: true,
    recommendedFor: ['voice']
  },
  glm5: {
    id: 'glm5',
    name: 'Zhipu GLM',
    envKey: 'ZHIPU_API_KEY',
    altEnvKey: 'GLM5_API_KEY',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', speed: 'fast' },
      { id: 'glm-4', name: 'GLM-4', speed: 'medium' }
    ],
    defaultModel: 'glm-4-flash',
    latency: '500-1000ms',
    costTier: 'low'
  }
};

// Proveedores de TTS (Voz - Habla)
export const TTS_PROVIDERS = {
  deepgram: {
    id: 'deepgram',
    name: 'Deepgram Aura',
    envKey: 'DEEPGRAM_API_KEY',
    voices: [
      { id: 'aura-2-selena-es', name: 'Selena (ES)', gender: 'female', recommended: true },
      { id: 'aura-2-luna-es', name: 'Luna (ES)', gender: 'female' },
      { id: 'aura-2-estrella-es', name: 'Estrella (ES)', gender: 'female' },
      { id: 'aura-2-diana-es', name: 'Diana (ES)', gender: 'female' },
      { id: 'aura-2-javier-es', name: 'Javier (ES)', gender: 'male' }
    ],
    defaultVoice: 'aura-2-selena-es',
    latency: '200-400ms',
    quality: 'high',
    recommended: true
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    envKey: 'ELEVENLABS_API_KEY',
    voices: [
      { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Valentina (ES)', gender: 'female' },
      { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica (ES)', gender: 'female' }
    ],
    defaultVoice: 'pMsXgVXv3BLzUgSXRplE',
    latency: '400-800ms',
    quality: 'very-high'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI TTS',
    envKey: 'OPENAI_API_KEY',
    voices: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'echo', name: 'Echo', gender: 'male' },
      { id: 'fable', name: 'Fable', gender: 'neutral' },
      { id: 'nova', name: 'Nova', gender: 'female' },
      { id: 'onyx', name: 'Onyx', gender: 'male' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' }
    ],
    defaultVoice: 'nova',
    latency: '500-1000ms',
    quality: 'high'
  },
  'amazon-polly': {
    id: 'amazon-polly',
    name: 'Amazon Polly (via Twilio)',
    envKey: null, // Usa Twilio
    voices: [
      { id: 'Polly.Mia', name: 'Mia (ES-MX)', gender: 'female' },
      { id: 'Polly.Lucia', name: 'Lucia (ES)', gender: 'female' },
      { id: 'Polly.Lupe', name: 'Lupe (ES-US)', gender: 'female' },
      { id: 'Polly.Miguel', name: 'Miguel (ES-US)', gender: 'male' }
    ],
    defaultVoice: 'Polly.Mia',
    latency: '300-600ms',
    quality: 'medium',
    viaTwilio: true
  }
};

// Proveedores de STT (Oídos - Escucha)
export const STT_PROVIDERS = {
  deepgram: {
    id: 'deepgram',
    name: 'Deepgram Nova',
    envKey: 'DEEPGRAM_API_KEY',
    models: [
      { id: 'nova-3', name: 'Nova 3', accuracy: 'highest' },
      { id: 'nova-2', name: 'Nova 2', accuracy: 'high' }
    ],
    defaultModel: 'nova-3',
    latency: '100-300ms',
    languages: ['es', 'en', 'pt'],
    recommended: true
  },
  whisper: {
    id: 'whisper',
    name: 'OpenAI Whisper',
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'whisper-1', name: 'Whisper V1', accuracy: 'high' }
    ],
    defaultModel: 'whisper-1',
    latency: '500-1500ms',
    languages: ['es', 'en', 'multi']
  },
  google: {
    id: 'google',
    name: 'Google Speech',
    envKey: 'GOOGLE_API_KEY',
    models: [
      { id: 'latest_long', name: 'Latest Long', accuracy: 'high' },
      { id: 'latest_short', name: 'Latest Short', accuracy: 'high' }
    ],
    defaultModel: 'latest_long',
    latency: '300-800ms',
    languages: ['es', 'en']
  }
};

// Proveedores de Canal (Mensajería)
export const CHANNEL_PROVIDERS = {
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    envKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    channels: ['voice', 'sms', 'whatsapp']
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    envKeys: ['TELEGRAM_BOT_TOKEN'],
    channels: ['telegram']
  }
};

// Canales disponibles
export const CHANNELS = {
  web: {
    id: 'web',
    name: 'Chat Web',
    icon: '🌐',
    requiresTTS: false,
    requiresSTT: false,
    defaultLLM: 'gemini'
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    requiresTTS: false,
    requiresSTT: false,
    defaultLLM: 'gemini',
    provider: 'twilio'
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    requiresTTS: false,
    requiresSTT: false,
    defaultLLM: 'gemini',
    provider: 'telegram'
  },
  voice: {
    id: 'voice',
    name: 'Llamadas',
    icon: '📞',
    requiresTTS: true,
    requiresSTT: true,
    defaultLLM: 'groq', // Baja latencia para voz
    defaultTTS: 'deepgram',
    defaultSTT: 'deepgram',
    provider: 'twilio'
  }
};

// Configuración por defecto
export const DEFAULT_PROVIDER_CONFIG = {
  llm: {
    default: 'gemini',
    fallback: ['groq', 'anthropic'],
    perChannel: {
      web: 'gemini',
      whatsapp: 'gemini',
      telegram: 'gemini',
      voice: 'groq'
    },
    models: {
      gemini: 'gemini-1.5-flash',
      anthropic: 'claude-3-5-sonnet-20241022',
      openai: 'gpt-4o-mini',
      groq: 'llama-3.3-70b-versatile',
      glm5: 'glm-4-flash'
    }
  },
  tts: {
    default: 'deepgram',
    fallback: ['amazon-polly'],
    voices: {
      deepgram: 'aura-2-selena-es',
      elevenlabs: 'pMsXgVXv3BLzUgSXRplE',
      openai: 'nova',
      'amazon-polly': 'Polly.Mia'
    }
  },
  stt: {
    default: 'deepgram',
    models: {
      deepgram: 'nova-3',
      whisper: 'whisper-1'
    }
  }
};

// Obtener API key para un proveedor
export function getProviderApiKey(type, providerId) {
  let provider;

  switch (type) {
    case 'llm':
      provider = LLM_PROVIDERS[providerId];
      break;
    case 'tts':
      provider = TTS_PROVIDERS[providerId];
      break;
    case 'stt':
      provider = STT_PROVIDERS[providerId];
      break;
    default:
      return null;
  }

  if (!provider) return null;
  if (provider.viaTwilio) return 'via-twilio';

  const key = process.env[provider.envKey] ||
              (provider.altEnvKey ? process.env[provider.altEnvKey] : null);

  return key || null;
}

// Verificar si un proveedor está disponible
export function isProviderAvailable(type, providerId) {
  const apiKey = getProviderApiKey(type, providerId);
  return !!apiKey;
}

// Obtener estado de todos los proveedores
export function getAllProvidersStatus() {
  const status = {
    llm: {},
    tts: {},
    stt: {},
    channels: {}
  };

  // LLM
  for (const [id, provider] of Object.entries(LLM_PROVIDERS)) {
    const apiKey = getProviderApiKey('llm', id);
    status.llm[id] = {
      ...provider,
      available: !!apiKey,
      apiKeyPresent: !!apiKey
    };
  }

  // TTS
  for (const [id, provider] of Object.entries(TTS_PROVIDERS)) {
    const apiKey = getProviderApiKey('tts', id);
    status.tts[id] = {
      ...provider,
      available: provider.viaTwilio ? true : !!apiKey,
      apiKeyPresent: provider.viaTwilio ? true : !!apiKey
    };
  }

  // STT
  for (const [id, provider] of Object.entries(STT_PROVIDERS)) {
    const apiKey = getProviderApiKey('stt', id);
    status.stt[id] = {
      ...provider,
      available: !!apiKey,
      apiKeyPresent: !!apiKey
    };
  }

  // Channels
  for (const [id, provider] of Object.entries(CHANNEL_PROVIDERS)) {
    const keysPresent = provider.envKeys.every(key => !!process.env[key]);
    status.channels[id] = {
      ...provider,
      available: keysPresent,
      apiKeyPresent: keysPresent
    };
  }

  return status;
}

export default {
  LLM_PROVIDERS,
  TTS_PROVIDERS,
  STT_PROVIDERS,
  CHANNEL_PROVIDERS,
  CHANNELS,
  DEFAULT_PROVIDER_CONFIG,
  getProviderApiKey,
  isProviderAvailable,
  getAllProvidersStatus
};

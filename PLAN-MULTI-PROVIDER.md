# Plan: Sistema Multi-Proveedor de IA con Dashboard de Control

## Investigación de la Industria

### Fuentes Consultadas
- [The Voice AI Stack for Building Agents](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents)
- [LLM Orchestration Frameworks 2024-2025](https://research.aimultiple.com/llm-orchestration/)
- [LiteLLM - Multi-Provider Gateway](https://docs.litellm.ai/docs/)
- [OpenRouter - Unified LLM API](https://docs.litellm.ai/docs/providers/openrouter)
- [Voice Agent Platforms Comparison](https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2025)
- [Deepgram vs ElevenLabs](https://deepgram.com/learn/deepgram-vs-elevenlabs)
- [Pipecat - Open Source Voice AI](https://github.com/pipecat-ai/pipecat)
- [PuPu - Multi-Provider Voice Showcase](https://github.com/mrjonathanm/PuPu)

### Patrones de la Industria

#### 1. Arquitectura de Orquestación de Voz
```
┌─────────────────────────────────────────────────────────────┐
│                    VOICE AI STACK                           │
├─────────────────────────────────────────────────────────────┤
│  👂 STT (Oídos)     │  🧠 LLM (Cerebro)  │  🗣️ TTS (Voz)    │
│  - Deepgram Nova-3  │  - Gemini          │  - Deepgram Aura │
│  - OpenAI Whisper   │  - Claude          │  - ElevenLabs    │
│  - AssemblyAI       │  - GPT-4           │  - PlayHT        │
│  - Google STT       │  - Groq/Llama      │  - Amazon Polly  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   ORCHESTRATOR    │
                    │  (Router/Gateway) │
                    └───────────────────┘
```

#### 2. Patrón LLM Gateway (LiteLLM/OpenRouter)
- **Interfaz unificada**: Una sola API para 100+ modelos
- **Failover automático**: Si un proveedor falla, usa otro
- **Load balancing**: Distribuir carga entre proveedores
- **Cost tracking**: Monitorear costos por proveedor
- **Latencia < 400ms**: Meta para conversaciones naturales

#### 3. Configuración por Canal (Pipecat/Vapi Style)
```json
{
  "channels": {
    "voice": { "llm": "gemini", "tts": "deepgram", "stt": "deepgram" },
    "whatsapp": { "llm": "claude", "tts": null, "stt": null },
    "telegram": { "llm": "groq", "tts": null, "stt": null },
    "web": { "llm": "gemini", "tts": null, "stt": null }
  }
}
```

---

## Arquitectura Propuesta

### Estructura de Proveedores

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER REGISTRY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LLM Providers          TTS Providers         STT Providers     │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐   │
│  │ gemini      │       │ deepgram    │       │ deepgram    │   │
│  │ anthropic   │       │ elevenlabs  │       │ whisper     │   │
│  │ openai      │       │ playht      │       │ assemblyai  │   │
│  │ groq        │       │ amazon-polly│       │ google      │   │
│  │ glm5        │       │ google-tts  │       │             │   │
│  └─────────────┘       │ openai-tts  │       └─────────────┘   │
│                        └─────────────┘                          │
│                                                                  │
│  Channel Providers      Messaging                               │
│  ┌─────────────┐       ┌─────────────┐                         │
│  │ twilio-voice│       │ twilio-sms  │                         │
│  │ vonage      │       │ twilio-wa   │                         │
│  │ plivo       │       │ telegram    │                         │
│  └─────────────┘       │ messenger   │                         │
│                        └─────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Configuración en settings.json

```json
{
  "providers": {
    "llm": {
      "default": "gemini",
      "available": ["gemini", "anthropic", "openai", "groq", "glm5"],
      "fallback": ["groq", "openai"],
      "perChannel": {
        "web": "gemini",
        "whatsapp": "gemini",
        "telegram": "gemini",
        "voice": "groq"
      }
    },
    "tts": {
      "default": "deepgram",
      "available": ["deepgram", "elevenlabs", "openai", "amazon-polly"],
      "fallback": ["amazon-polly"],
      "models": {
        "deepgram": "aura-2-selena-es",
        "elevenlabs": "eleven_multilingual_v2",
        "openai": "tts-1-hd",
        "amazon-polly": "Mia"
      }
    },
    "stt": {
      "default": "deepgram",
      "available": ["deepgram", "whisper", "google"],
      "models": {
        "deepgram": "nova-3",
        "whisper": "whisper-1"
      }
    }
  },
  "channels": {
    "web": {
      "enabled": true,
      "llm": "gemini"
    },
    "whatsapp": {
      "enabled": true,
      "llm": "gemini",
      "provider": "twilio"
    },
    "telegram": {
      "enabled": true,
      "llm": "gemini"
    },
    "voice": {
      "enabled": true,
      "llm": "groq",
      "tts": "deepgram",
      "stt": "deepgram",
      "provider": "twilio"
    }
  }
}
```

---

## Plan de Implementación

### Fase 1: Backend - Sistema de Proveedores

#### 1.1 Crear `server/providers/index.js`
```javascript
// Registry central de proveedores
export const PROVIDERS = {
  llm: {
    gemini: { name: 'Google Gemini', envKey: 'GOOGLE_API_KEY', models: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
    anthropic: { name: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY', models: ['claude-3-5-sonnet', 'claude-3-haiku'] },
    openai: { name: 'OpenAI', envKey: 'OPENAI_API_KEY', models: ['gpt-4o', 'gpt-4o-mini'] },
    groq: { name: 'Groq', envKey: 'GROQ_API_KEY', models: ['llama-3.3-70b', 'mixtral-8x7b'] },
    glm5: { name: 'Zhipu GLM', envKey: 'ZHIPU_API_KEY', models: ['glm-4-flash'] }
  },
  tts: {
    deepgram: { name: 'Deepgram Aura', envKey: 'DEEPGRAM_API_KEY', voices: ['aura-2-selena-es', 'aura-2-luna-es'] },
    elevenlabs: { name: 'ElevenLabs', envKey: 'ELEVENLABS_API_KEY', voices: [] },
    openai: { name: 'OpenAI TTS', envKey: 'OPENAI_API_KEY', voices: ['alloy', 'echo', 'nova'] },
    'amazon-polly': { name: 'Amazon Polly', envKey: 'AWS_ACCESS_KEY', voices: ['Mia', 'Lucia'] }
  },
  stt: {
    deepgram: { name: 'Deepgram Nova', envKey: 'DEEPGRAM_API_KEY', models: ['nova-3', 'nova-2'] },
    whisper: { name: 'OpenAI Whisper', envKey: 'OPENAI_API_KEY', models: ['whisper-1'] },
    google: { name: 'Google STT', envKey: 'GOOGLE_API_KEY', models: ['latest_long'] }
  }
};
```

#### 1.2 Crear `server/providers/llm-router.js`
```javascript
// Router inteligente de LLM con failover
export async function routeLLM(messages, options = {}) {
  const { channel, preferredProvider } = options;
  const config = settings.obtenerProviderConfig();

  // Determinar proveedor: preferido > por canal > default
  let provider = preferredProvider
    || config.llm.perChannel?.[channel]
    || config.llm.default;

  // Intentar con proveedor principal
  try {
    return await callProvider(provider, messages, options);
  } catch (error) {
    // Failover a proveedores alternativos
    for (const fallback of config.llm.fallback) {
      try {
        console.log(`⚠️ Failover de ${provider} a ${fallback}`);
        return await callProvider(fallback, messages, options);
      } catch (e) {
        continue;
      }
    }
    throw new Error('Todos los proveedores LLM fallaron');
  }
}
```

#### 1.3 Crear `server/providers/tts-router.js`
```javascript
// Router de TTS con múltiples proveedores
export async function routeTTS(text, options = {}) {
  const config = settings.obtenerProviderConfig();
  const provider = options.provider || config.tts.default;

  switch (provider) {
    case 'deepgram': return await deepgramTTS(text, options);
    case 'elevenlabs': return await elevenlabsTTS(text, options);
    case 'openai': return await openaiTTS(text, options);
    case 'amazon-polly': return await pollyTTS(text, options);
    default: return await deepgramTTS(text, options);
  }
}
```

#### 1.4 Modificar `server/settings.js`
Agregar funciones:
- `obtenerProviderConfig()`
- `guardarProviderConfig(config)`
- `obtenerProviderStatus()` - Estado de cada proveedor
- `testProvider(type, provider)` - Probar conexión

#### 1.5 Nuevos endpoints en `server/index.js`
```
GET  /api/providers              → Lista de proveedores disponibles
GET  /api/providers/status       → Estado de conexión de cada uno
POST /api/providers/test/:type/:provider → Probar un proveedor específico
GET  /api/providers/config       → Configuración actual
POST /api/providers/config       → Guardar configuración
```

---

### Fase 2: Frontend - Dashboard de Control

#### 2.1 Nueva sección en Config: "Proveedores de IA"

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ Configuración                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🧠 CEREBRO (LLM)                           [Probar Todo]  │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │                                                           │   │
│ │ Proveedor Default: [Gemini ▼]                             │   │
│ │                                                           │   │
│ │ ┌─────────────────┬─────────────┬──────────┬───────────┐ │   │
│ │ │ Proveedor       │ Estado      │ Modelo   │ Acciones  │ │   │
│ │ ├─────────────────┼─────────────┼──────────┼───────────┤ │   │
│ │ │ 🟢 Gemini       │ Conectado   │ 1.5-flash│ [Probar]  │ │   │
│ │ │ 🟢 Claude       │ Conectado   │ 3.5-sonnet│ [Probar] │ │   │
│ │ │ 🟢 Groq         │ Conectado   │ llama-3.3│ [Probar]  │ │   │
│ │ │ 🔴 OpenAI       │ Sin API Key │ -        │ [Config]  │ │   │
│ │ │ 🟢 GLM-5        │ Conectado   │ glm-4    │ [Probar]  │ │   │
│ │ └─────────────────┴─────────────┴──────────┴───────────┘ │   │
│ │                                                           │   │
│ │ Fallback Order: [Groq] → [Claude] → [OpenAI]             │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🗣️ VOZ (TTS)                               [Probar Todo]  │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │                                                           │   │
│ │ Proveedor Default: [Deepgram ▼]                           │   │
│ │                                                           │   │
│ │ ┌─────────────────┬─────────────┬──────────┬───────────┐ │   │
│ │ │ Proveedor       │ Estado      │ Voz      │ Acciones  │ │   │
│ │ ├─────────────────┼─────────────┼──────────┼───────────┤ │   │
│ │ │ 🟢 Deepgram     │ Conectado   │ Selena   │ [🔊 Demo] │ │   │
│ │ │ 🔴 ElevenLabs   │ Sin API Key │ -        │ [Config]  │ │   │
│ │ │ 🟡 Amazon Polly │ Via Twilio  │ Mia      │ [🔊 Demo] │ │   │
│ │ │ 🔴 OpenAI TTS   │ Sin API Key │ -        │ [Config]  │ │   │
│ │ └─────────────────┴─────────────┴──────────┴───────────┘ │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 👂 OÍDOS (STT)                             [Probar Todo]  │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ Proveedor Default: [Deepgram ▼]                           │   │
│ │ 🟢 Deepgram Nova-3  │  🔴 Whisper  │  🔴 Google STT       │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📱 CONFIGURACIÓN POR CANAL                                │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │                                                           │   │
│ │ ┌────────────┬─────────┬─────────┬─────────┬───────────┐ │   │
│ │ │ Canal      │ LLM     │ TTS     │ STT     │ Estado    │ │   │
│ │ ├────────────┼─────────┼─────────┼─────────┼───────────┤ │   │
│ │ │ 🌐 Web     │ Gemini  │ -       │ -       │ 🟢 Activo │ │   │
│ │ │ 📱 WhatsApp│ Gemini  │ -       │ -       │ 🟢 Activo │ │   │
│ │ │ ✈️ Telegram│ Gemini  │ -       │ -       │ 🟢 Activo │ │   │
│ │ │ 📞 Llamadas│ Groq    │ Deepgram│ Deepgram│ 🟢 Activo │ │   │
│ │ └────────────┴─────────┴─────────┴─────────┴───────────┘ │   │
│ │                                                           │   │
│ │ [Editar Canal] [Guardar Cambios]                          │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Panel de Pruebas

```
┌─────────────────────────────────────────────────────────────────┐
│ 🧪 CENTRO DE PRUEBAS                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Prueba de LLM                                               │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Mensaje: [Hola, ¿cómo funciona la Modalidad 40?      ] │ │ │
│ │ │ Proveedor: [Gemini ▼] [Claude ▼] [Groq ▼]              │ │ │
│ │ │                                    [Enviar a Todos]     │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ Resultados:                                                 │ │
│ │ ┌─────────────┬──────────────────────────────┬────────────┐│ │
│ │ │ Gemini      │ "La Modalidad 40 es..."      │ 1.2s 🟢   ││ │
│ │ │ Claude      │ "La Modalidad 40 permite..." │ 0.8s 🟢   ││ │
│ │ │ Groq        │ "Modalidad 40 del IMSS..."   │ 0.3s 🟢   ││ │
│ │ └─────────────┴──────────────────────────────┴────────────┘│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Prueba de TTS                                               │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Texto: [Bienvenido al IMSS, ¿en qué puedo ayudarte?  ] │ │ │
│ │ │ Voz: [Deepgram Selena ▼] [Polly Mia ▼]                  │ │ │
│ │ │                                    [Generar Audio]       │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                             │ │
│ │ 🔊 Deepgram: [▶️ Reproducir] 245ms                          │ │
│ │ 🔊 Polly:    [▶️ Reproducir] 890ms                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Prueba End-to-End (Simulación de Llamada)                   │ │
│ │                                                             │ │
│ │ [🎤 Grabar Audio] → [STT] → [LLM] → [TTS] → [🔊 Escuchar]  │ │
│ │                                                             │ │
│ │ Pipeline: Deepgram STT → Gemini → Deepgram TTS              │ │
│ │ Latencia total: 1.4s                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Fase 3: Archivos a Crear/Modificar

#### Archivos Nuevos:
1. `server/providers/index.js` - Registry de proveedores
2. `server/providers/llm-router.js` - Router de LLM con failover
3. `server/providers/tts-router.js` - Router de TTS
4. `server/providers/stt-router.js` - Router de STT (futuro)
5. `server/channels/elevenlabs-tts.js` - Integración ElevenLabs
6. `server/channels/openai-tts.js` - Integración OpenAI TTS

#### Archivos a Modificar:
1. `server/settings.js` - Agregar funciones de proveedores
2. `server/index.js` - Nuevos endpoints de proveedores y pruebas
3. `server/ai-agent.js` - Usar llm-router en lugar de llamadas directas
4. `server/channels/twilio-voice.js` - Usar tts-router
5. `client/src/App.jsx` - Nueva UI de proveedores
6. `client/src/index.css` - Estilos para la nueva sección

---

### Fase 4: Orden de Implementación

```
1. Backend - Providers Registry (30 min)
   └── server/providers/index.js

2. Backend - LLM Router (45 min)
   └── server/providers/llm-router.js
   └── Modificar ai-agent.js para usar router

3. Backend - TTS Router (30 min)
   └── server/providers/tts-router.js
   └── Modificar twilio-voice.js para usar router

4. Backend - Settings & Endpoints (45 min)
   └── Modificar settings.js
   └── Agregar endpoints en index.js

5. Backend - Test Endpoints (30 min)
   └── POST /api/providers/test/llm/:provider
   └── POST /api/providers/test/tts/:provider
   └── POST /api/test/e2e

6. Frontend - Provider Config UI (60 min)
   └── Sección de proveedores LLM
   └── Sección de proveedores TTS
   └── Configuración por canal

7. Frontend - Test Center UI (45 min)
   └── Pruebas de LLM comparativas
   └── Pruebas de TTS con audio
   └── Prueba end-to-end

8. Testing & Deploy (30 min)
   └── Verificar todas las integraciones
   └── Commit y push a Railway
```

---

## Variables de Entorno Necesarias

```env
# LLM Providers
GOOGLE_API_KEY=xxx          # Gemini
ANTHROPIC_API_KEY=xxx       # Claude
OPENAI_API_KEY=xxx          # GPT-4, Whisper, TTS
GROQ_API_KEY=xxx            # Groq/Llama
ZHIPU_API_KEY=xxx           # GLM-5

# TTS Providers
DEEPGRAM_API_KEY=xxx        # Deepgram Aura
ELEVENLABS_API_KEY=xxx      # ElevenLabs (opcional)

# Messaging
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx

# Config
LLM_PROVIDER=gemini         # Default provider
TTS_PROVIDER=deepgram       # Default TTS
```

---

## Métricas de Éxito

1. **Cambio de proveedor en < 5 segundos** desde el dashboard
2. **Failover automático** si un proveedor falla
3. **Pruebas comparativas** de LLM en tiempo real
4. **Demo de audio** para cada voz TTS disponible
5. **Configuración por canal** persistente
6. **Indicadores visuales** claros de estado (🟢/🟡/🔴)

---

## Notas Técnicas

### Latencia Esperada por Proveedor
| Proveedor | Tipo | Latencia Típica |
|-----------|------|-----------------|
| Groq      | LLM  | 200-400ms       |
| Gemini    | LLM  | 800-1500ms      |
| Claude    | LLM  | 1000-2000ms     |
| GPT-4     | LLM  | 1500-3000ms     |
| Deepgram  | TTS  | 200-400ms       |
| ElevenLabs| TTS  | 400-800ms       |
| Polly     | TTS  | 300-600ms       |

### Recomendaciones para Voz
- **STT**: Deepgram Nova-3 (mejor latencia y precisión en español)
- **LLM para voz**: Groq (latencia ultra-baja) o Gemini Flash
- **TTS**: Deepgram Aura (natural) o Polly Mia (estable)

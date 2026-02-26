import { useState, useEffect, useRef } from 'react'
import CRM from './CRM'

const UMA_2025 = 113.14
const TOPE_25_UMAS = 25 * UMA_2025

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [datos, setDatos] = useState({
    fechaNacimiento: '',
    semanasActuales: '',
    salarioDeseado: '',
    salarioPromedio5Anos: '',
    fechaInicioModalidad: new Date().toISOString().split('T')[0],
    edadRetiro: 65
  })
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Modalidad 10 state
  const [datosMod10, setDatosMod10] = useState({
    salarioMensual: '',
    claseRiesgo: 'I',
    zona: 'centro',
    incluirInfonavit: false,
    periodoPago: 'mensual'
  })
  const [resultadoMod10, setResultadoMod10] = useState(null)

  // Trabajadoras del Hogar state
  const [datosTrabHogar, setDatosTrabHogar] = useState({
    salarioMensual: '',
    diasPorSemana: 5,
    zona: 'general',
    incluirInfonavit: true
  })
  const [resultadoTrabHogar, setResultadoTrabHogar] = useState(null)
  const [infoTrabHogar, setInfoTrabHogar] = useState(null)

  // Datos de referencia (UMA, salarios mínimos)
  const [datosReferencia, setDatosReferencia] = useState({
    uma: { diario: 113.14, mensual: 3394.20 },
    salarioMinimo: { general: 278.80, frontera: 419.88 }
  })

  // Cargar datos de referencia al inicio
  useEffect(() => {
    cargarDatosReferencia()
    cargarInfoTrabHogar()
  }, [])

  const cargarInfoTrabHogar = async () => {
    try {
      const res = await fetch('/api/trabajadoras-hogar/info')
      const data = await res.json()
      setInfoTrabHogar(data)
    } catch (err) {
      console.error('Error cargando info Trabajadoras Hogar:', err)
    }
  }

  const calcularTrabHogar = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/calcular-trabajadoras-hogar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosTrabHogar)
      })
      const data = await res.json()

      if (data.success) {
        setResultadoTrabHogar(data.data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error de conexion con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const cargarDatosReferencia = async () => {
    try {
      const res = await fetch('/api/db/resumen')
      const data = await res.json()
      if (data.uma && data.salarioMinimo) {
        setDatosReferencia({
          uma: data.uma,
          salarioMinimo: data.salarioMinimo
        })
      }
    } catch (err) {
      console.error('Error cargando datos de referencia:', err)
    }
  }

  // Settings state (solo opciones del cliente, NO secretos)
  const [settingsData, setSettingsData] = useState({
    servicios: { twilio: false, telegram: false, deepgram: false, llmConfigurado: false },
    voz: { speakModel: 'aura-2-selena-es', listenModel: 'nova-3', listenLanguage: 'es' },
    llm: { provider: 'gemini', temperature: 0.7 },
    numeros: [],
    imss: { año: 2025, uma: {}, salarioMinimo: {} },
    // Configuracion de proveedores por canal
    providers: {
      web: 'gemini',
      whatsapp: 'gemini',
      telegram: 'gemini',
      voice: 'groq',
      tts: 'deepgram'
    }
  })
  const [serviciosStatus, setServiciosStatus] = useState({ twilio: false, telegram: false, deepgram: false, llmConfigurado: false })
  const [nuevoNumero, setNuevoNumero] = useState({ nombre: '', numero: '', tipo: 'voz' })
  const [settingsMsg, setSettingsMsg] = useState('')
  const [qrModal, setQrModal] = useState({ visible: false, numero: '', nombre: '' })

  // Training state
  const [trainingData, setTrainingData] = useState({
    reglas: [],
    faq: [],
    conocimiento: [],
    ejemplos: [],
    prohibido: [],
    configuracion: {
      nombreAgente: 'Asesor IMSS',
      saludoInicial: '',
      despedida: '',
      tono: 'profesional',
      usarEmojis: true,
      maxRespuesta: 500
    }
  })
  const [trainingMsg, setTrainingMsg] = useState('')
  const [trainingTab, setTrainingTab] = useState('reglas')

  // Estado para valores actualizables (UMA, salarios)
  const [valoresActualizables, setValoresActualizables] = useState({
    uma: { diario: '', mensual: '', anual: '' },
    salarios: { general: '', frontera: '' },
    año: new Date().getFullYear()
  })

  // Cargar settings al inicio
  useEffect(() => {
    cargarSettings()
    cargarValoresActualizables()
    cargarTraining()
  }, [])

  // Cargar datos de entrenamiento
  const cargarTraining = async () => {
    try {
      const res = await fetch('/api/training')
      const data = await res.json()
      if (data.success && data.data) {
        // Merge defensivo para evitar propiedades undefined
        const d = data.data || {}
        setTrainingData(prev => ({
          reglas: d.reglas || prev.reglas || [],
          faq: d.faq || prev.faq || [],
          conocimiento: d.conocimiento || prev.conocimiento || [],
          ejemplos: d.ejemplos || prev.ejemplos || [],
          prohibido: d.prohibido || prev.prohibido || [],
          configuracion: d.configuracion || prev.configuracion || {}
        }))
      }
    } catch (err) {
      console.error('Error cargando training:', err)
    }
  }

  const cargarValoresActualizables = async () => {
    try {
      const res = await fetch('/api/db/resumen')
      const data = await res.json()
      setValoresActualizables({
        uma: {
          diario: data.uma?.diario || 113.14,
          mensual: data.uma?.mensual || 3394.20,
          anual: data.uma?.anual || 41296.10
        },
        salarios: {
          general: data.salarioMinimo?.general || 278.80,
          frontera: data.salarioMinimo?.frontera || 419.88
        },
        año: new Date().getFullYear()
      })
      // También actualizar datos de referencia
      if (data.uma && data.salarioMinimo) {
        setDatosReferencia({
          uma: data.uma,
          salarioMinimo: data.salarioMinimo
        })
      }
    } catch (err) {
      console.error('Error cargando valores:', err)
    }
  }

  const guardarUMA = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/db/uma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          año: valoresActualizables.año,
          diario: valoresActualizables.uma.diario,
          mensual: valoresActualizables.uma.mensual,
          anual: valoresActualizables.uma.anual
        })
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('UMA actualizado correctamente')
        cargarValoresActualizables()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  const guardarSalarios = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/db/salarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          año: valoresActualizables.año,
          general: valoresActualizables.salarios.general,
          frontera: valoresActualizables.salarios.frontera
        })
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('Salarios minimos actualizados correctamente')
        cargarValoresActualizables()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  const cargarSettings = async () => {
    try {
      // Cargar settings generales
      const res = await fetch('/api/settings')
      const data = await res.json()

      // Cargar configuracion de proveedores
      let providers = { web: 'gemini', whatsapp: 'gemini', telegram: 'gemini', voice: 'groq', tts: 'deepgram' }
      try {
        const provRes = await fetch('/api/providers/config')
        const provData = await provRes.json()
        if (provData.llm?.perChannel) {
          providers = {
            web: provData.llm.perChannel.web || provData.llm.default || 'gemini',
            whatsapp: provData.llm.perChannel.whatsapp || provData.llm.default || 'gemini',
            telegram: provData.llm.perChannel.telegram || provData.llm.default || 'gemini',
            voice: provData.llm.perChannel.voice || 'groq',
            tts: provData.tts?.default || 'deepgram'
          }
        }
      } catch (e) {
        console.log('Usando proveedores por defecto')
      }

      // Merge defensivo para evitar propiedades undefined
      setSettingsData(prev => ({
        servicios: data.servicios || prev.servicios || {},
        voz: data.voz || prev.voz || {},
        llm: data.llm || prev.llm || {},
        numeros: data.numeros || prev.numeros || [],
        imss: data.imss || prev.imss || {},
        providers
      }))
      setServiciosStatus(data.servicios || {})
    } catch (err) {
      console.error('Error cargando settings:', err)
    }
  }

  // Guardar configuración de voz
  const guardarVozConfig = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/settings/voz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData.voz)
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('Configuración de voz guardada')
        cargarSettings()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  // Guardar configuración de LLM
  const guardarLlmConfig = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData.llm)
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('Configuración de IA guardada')
        cargarSettings()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  // Verificar estado de servicios
  const verificarServicios = async () => {
    try {
      setSettingsMsg('Verificando conexiones...')
      const provider = settingsData.llm?.provider || 'gemini'

      const [twilioRes, telegramRes, deepgramRes, llmRes] = await Promise.all([
        fetch('/api/settings/test-twilio', { method: 'POST' }),
        fetch('/api/settings/test-telegram', { method: 'POST' }),
        fetch('/api/settings/test-deepgram', { method: 'POST' }),
        fetch(`/api/settings/test-llm/${provider}`, { method: 'POST' })
      ])

      const twilioData = await twilioRes.json()
      const telegramData = await telegramRes.json()
      const deepgramData = await deepgramRes.json()
      const llmData = await llmRes.json()

      setServiciosStatus({
        twilio: twilioData.conectado,
        telegram: telegramData.conectado,
        deepgram: deepgramData.conectado,
        llmConfigurado: llmData.conectado,
        twilioError: twilioData.error,
        telegramError: telegramData.error,
        deepgramError: deepgramData.error,
        llmError: llmData.error
      })

      setSettingsMsg('Verificación completada')
    } catch (err) {
      setSettingsMsg('Error verificando servicios')
    }
  }

  const agregarNumero = async () => {
    if (!nuevoNumero.numero) return
    try {
      const res = await fetch('/api/settings/numeros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoNumero)
      })
      const data = await res.json()
      if (data.success) {
        setNuevoNumero({ nombre: '', numero: '', tipo: 'voz' })
        cargarSettings()
      }
    } catch (err) {
      console.error('Error agregando numero:', err)
    }
  }

  const eliminarNumero = async (id) => {
    try {
      await fetch(`/api/settings/numeros/${id}`, { method: 'DELETE' })
      cargarSettings()
    } catch (err) {
      console.error('Error eliminando numero:', err)
    }
  }

  // Chat state
  const [mensajes, setMensajes] = useState([
    {
      tipo: 'agente',
      texto: '¡Hola! Soy tu asesor virtual de pensiones IMSS. Te ayudaré a calcular tu Modalidad 40 y proyectar tu pensión. ¿Comenzamos con algunas preguntas?'
    }
  ])
  const [inputChat, setInputChat] = useState('')
  const [contextoChat, setContextoChat] = useState({})
  const [pasoActual, setPasoActual] = useState('inicio')
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleChange = (e) => {
    const { name, value } = e.target
    setDatos(prev => ({ ...prev, [name]: value }))
  }

  const calcular = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })
      const data = await res.json()

      if (data.success) {
        setResultado(data.data)
        setActiveTab('resultados')
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const enviarMensajeChat = async () => {
    if (!inputChat.trim()) return

    const userText = inputChat.trim()
    const nuevoMensaje = { tipo: 'usuario', texto: userText }

    setMensajes(prev => [...prev, nuevoMensaje])
    setInputChat('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: userText,
          datos: datos, // Enviar datos actuales del formulario
          historial: mensajes.map(m => ({
            rol: m.tipo === 'agente' ? 'asistente' : 'usuario',
            mensaje: m.texto
          })),
          paso: pasoActual
        })
      })

      const data = await res.json()

      if (data.mensaje) {
        setMensajes(prev => [...prev, { tipo: 'agente', texto: data.mensaje }])
      }

      // Sincronizar datos extraídos por la IA con el estado global
      if (data.nuevosDatos) {
        setDatos(prev => ({ ...prev, ...data.nuevosDatos }))
      }

      if (data.nuevoPaso) {
        setPasoActual(data.nuevoPaso)
      }

    } catch (err) {
      setMensajes(prev => [...prev, {
        tipo: 'agente',
        texto: 'Lo siento, tuve un problema al conectar con mi cerebro digital. ¿Podrías reintentar?'
      }])
    } finally {
      setLoading(false)
    }
  }
  const calcularMod10 = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/calcular-mod10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosMod10)
      })
      const data = await res.json()

      if (data.success) {
        setResultadoMod10(data.data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error de conexion con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (num) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num)
  }

  const opcionesRapidas = [
    { texto: 'Comenzar diagnóstico', accion: () => setPasoActual('inicio') },
    { texto: '¿Qué es Modalidad 40?', accion: () => setInputChat('¿Qué es la Modalidad 40?') },
    { texto: 'Requisitos', accion: () => setInputChat('¿Cuáles son los requisitos para Modalidad 40?') },
    { texto: 'Ley 73 vs Ley 97', accion: () => setInputChat('¿Qué diferencia hay entre Ley 73 y Ley 97?') }
  ]

  return (
    <div className="app" >
      <header>
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h1>Calculadora Modalidad 40</h1>
        </div>
        <p className="subtitle">IMSS - Ley 73 | Agente Experto con RAG</p>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          Asesor IA
        </button>
        <button className={activeTab === 'form' ? 'active' : ''} onClick={() => setActiveTab('form')}>
          Mod 40
        </button>
        <button className={activeTab === 'mod10' ? 'active' : ''} onClick={() => setActiveTab('mod10')}>
          Mod 10
        </button>
        <button className={activeTab === 'trabhogar' ? 'active' : ''} onClick={() => setActiveTab('trabhogar')}>
          Hogar
        </button>
        <button className={activeTab === 'resultados' ? 'active' : ''} onClick={() => setActiveTab('resultados')} disabled={!resultado}>
          Resultados
        </button>
        <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>
          Info Legal
        </button>
        <button className={activeTab === 'crm' ? 'active' : ''} onClick={() => setActiveTab('crm')}>
          CRM
        </button>
        <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>
          Config
        </button>
        <button className={activeTab === 'training' ? 'active' : ''} onClick={() => setActiveTab('training')}>
          Entrenar IA
        </button>
      </nav>

      <main>
        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="chat-messages">
              {mensajes.map((msg, i) => (
                <div key={i} className={`message ${msg.tipo}`}>
                  {msg.tipo === 'agente' && <div className="avatar">🤖</div>}
                  <div className="message-content">
                    {msg.texto.split('\n').map((line, j) => (
                      <p key={j}>{line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/<strong>(.*?)<\/strong>/g, (_, m) => m)}</p>
                    ))}
                  </div>
                  {msg.tipo === 'usuario' && <div className="avatar">👤</div>}
                </div>
              ))}
              {loading && (
                <div className="message agente">
                  <div className="avatar">🤖</div>
                  <div className="message-content typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="quick-options">
              {pasoActual === 'inicio' && opcionesRapidas.map((op, i) => (
                <button key={i} onClick={op.accion}>{op.texto}</button>
              ))}
            </div>

            <div className="chat-input">
              <input
                type="text"
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && enviarMensajeChat()}
                placeholder="Escribe tu mensaje o respuesta..."
                disabled={loading}
              />
              <button onClick={enviarMensajeChat} disabled={loading || !inputChat.trim()}>
                Enviar
              </button>
            </div>
          </div>
        )}

        {activeTab === 'form' && (
          <form onSubmit={calcular} className="form-card">
            <h2>Calculadora Directa</h2>
            <p className="form-hint">Ingresa tus datos para calcular tu proyección de pensión</p>

            <div className="form-section">
              <h3>Información Personal</h3>

              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input type="date" name="fechaNacimiento" value={datos.fechaNacimiento} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label>Semanas Cotizadas Actuales</label>
                <input type="number" name="semanasActuales" value={datos.semanasActuales} onChange={handleChange} placeholder="Ej: 800" min="0" required />
                <span className="hint">Consulta tu NSS en la app IMSS Digital</span>
              </div>

              <div className="form-group">
                <label>Edad de Retiro Deseada</label>
                <select name="edadRetiro" value={datos.edadRetiro} onChange={handleChange}>
                  <option value="60">60 años (75% de pensión)</option>
                  <option value="61">61 años (80% de pensión)</option>
                  <option value="62">62 años (85% de pensión)</option>
                  <option value="63">63 años (90% de pensión)</option>
                  <option value="64">64 años (95% de pensión)</option>
                  <option value="65">65 años (100% de pensión)</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Salario para Modalidad 40</h3>

              <div className="form-group">
                <label>Salario Diario a Registrar</label>
                <input type="number" name="salarioDeseado" value={datos.salarioDeseado} onChange={handleChange} placeholder="Ej: 2500" step="0.01" max={TOPE_25_UMAS} required />
                <span className="hint">Tope máximo: {formatMoney(TOPE_25_UMAS)} diarios (25 UMAs)</span>
              </div>

              <div className="quick-calc">
                <h4>Salarios Predefinidos (UMAs 2025)</h4>
                <div className="uma-buttons">
                  <button type="button" onClick={() => setDatos(d => ({ ...d, salarioDeseado: (UMA_2025 * 10).toFixed(2) }))}>
                    10 UMAs<br /><small>{formatMoney(UMA_2025 * 10 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({ ...d, salarioDeseado: (UMA_2025 * 15).toFixed(2) }))}>
                    15 UMAs<br /><small>{formatMoney(UMA_2025 * 15 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({ ...d, salarioDeseado: (UMA_2025 * 20).toFixed(2) }))}>
                    20 UMAs<br /><small>{formatMoney(UMA_2025 * 20 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({ ...d, salarioDeseado: (UMA_2025 * 25).toFixed(2) }))}>
                    25 UMAs (MAX)<br /><small>{formatMoney(UMA_2025 * 25 * 30)}/mes</small>
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Calculando...' : 'Calcular Pensión'}
            </button>
          </form>
        )}

        {activeTab === 'mod10' && (
          <div className="mod10-container">
            <form onSubmit={calcularMod10} className="form-card">
              <h2>Modalidad 10 - Incorporacion Voluntaria</h2>
              <p className="form-hint">Para trabajadores independientes. Incluye servicio medico IMSS + semanas para pension.</p>

              <div className="form-section">
                <h3>Datos de Cotizacion</h3>

                <div className="form-group">
                  <label>Ingreso Mensual</label>
                  <input
                    type="number"
                    value={datosMod10.salarioMensual}
                    onChange={(e) => setDatosMod10(prev => ({ ...prev, salarioMensual: e.target.value }))}
                    placeholder="Ej: 15000"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Zona</label>
                  <select
                    value={datosMod10.zona}
                    onChange={(e) => setDatosMod10(prev => ({ ...prev, zona: e.target.value }))}
                  >
                    <option value="centro">Resto del Pais (Salario minimo ${datosReferencia.salarioMinimo.general})</option>
                    <option value="frontera">Franja Fronteriza (Salario minimo ${datosReferencia.salarioMinimo.frontera})</option>
                  </select>
                  <span className="hint">
                    Salario minimo diario: <strong>${datosMod10.zona === 'frontera' ? datosReferencia.salarioMinimo.frontera : datosReferencia.salarioMinimo.general}</strong> |
                    UMA diario: <strong>${datosReferencia.uma.diario}</strong>
                  </span>
                </div>

                <div className="form-group">
                  <label>Clase de Riesgo</label>
                  <select
                    value={datosMod10.claseRiesgo}
                    onChange={(e) => setDatosMod10(prev => ({ ...prev, claseRiesgo: e.target.value }))}
                  >
                    <option value="I">Clase I - Riesgo Minimo (Oficinas, consultoria)</option>
                    <option value="II">Clase II - Riesgo Bajo (Comercio, restaurantes)</option>
                    <option value="III">Clase III - Riesgo Medio (Manufactura, transporte)</option>
                    <option value="IV">Clase IV - Riesgo Alto (Construccion especializada)</option>
                    <option value="V">Clase V - Riesgo Maximo (Mineria, petroleo)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Periodo de Pago</label>
                  <select
                    value={datosMod10.periodoPago}
                    onChange={(e) => setDatosMod10(prev => ({ ...prev, periodoPago: e.target.value }))}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h3>INFONAVIT (Opcional)</h3>
                <div className="infonavit-option">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={datosMod10.incluirInfonavit}
                      onChange={(e) => setDatosMod10(prev => ({ ...prev, incluirInfonavit: e.target.checked }))}
                    />
                    <span className="checkmark"></span>
                    <span className="checkbox-label">Incluir aportaciones INFONAVIT (5% adicional)</span>
                  </label>
                  <p className="form-hint">
                    El INFONAVIT te permite acumular puntos para credito de vivienda.
                    Es opcional y representa un 5% adicional sobre tu ingreso.
                  </p>
                </div>
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Calculando...' : 'Calcular Cuotas'}
              </button>
            </form>

            {resultadoMod10 && (
              <div className="results mod10-results">
                <div className="result-card highlight">
                  <h3>Tu Cuota {resultadoMod10.periodoSeleccionado.nombre}</h3>
                  <div className="big-number">{formatMoney(resultadoMod10.periodoSeleccionado.total)}</div>
                  <p>{datosMod10.incluirInfonavit ? 'con INFONAVIT' : 'sin INFONAVIT'}</p>
                </div>

                <div className="result-grid">
                  <div className="result-card">
                    <h3>Desglose de Pago</h3>
                    <div className="stat"><span>Cuotas IMSS</span><strong>{formatMoney(resultadoMod10.periodoSeleccionado.cuotaIMSS)}</strong></div>
                    {datosMod10.incluirInfonavit && (
                      <div className="stat"><span>INFONAVIT (5%)</span><strong>{formatMoney(resultadoMod10.periodoSeleccionado.cuotaInfonavit)}</strong></div>
                    )}
                    <div className="stat highlight-stat"><span>Total a Pagar</span><strong className="accent">{formatMoney(resultadoMod10.periodoSeleccionado.total)}</strong></div>
                  </div>

                  <div className="result-card">
                    <h3>Datos de Cotizacion</h3>
                    <div className="stat"><span>Salario mensual</span><strong>{formatMoney(resultadoMod10.datos.salarioMensual)}</strong></div>
                    <div className="stat"><span>Salario diario</span><strong>{formatMoney(resultadoMod10.datos.salarioDiario)}</strong></div>
                    <div className="stat"><span>Clase de riesgo</span><strong>{resultadoMod10.datos.claseRiesgo}</strong></div>
                    <div className="stat"><span>Zona</span><strong>{resultadoMod10.datos.zona}</strong></div>
                  </div>
                </div>

                <div className="result-card full-width">
                  <h3>Comparativa de Periodos</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          <th>Cuotas IMSS</th>
                          {datosMod10.incluirInfonavit && <th>INFONAVIT</th>}
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(resultadoMod10.periodos).map(([key, periodo]) => (
                          <tr key={key} className={key === datosMod10.periodoPago ? 'selected' : ''}>
                            <td>{periodo.nombre}</td>
                            <td>{formatMoney(periodo.cuotaIMSS)}</td>
                            {datosMod10.incluirInfonavit && <td>{formatMoney(periodo.cuotaInfonavit)}</td>}
                            <td className="accent">{formatMoney(periodo.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="result-card full-width">
                  <h3>Beneficios Modalidad 10</h3>
                  <ul className="beneficios-lista">
                    {resultadoMod10.informacion.beneficios.map((beneficio, i) => (
                      <li key={i}>{beneficio}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trabhogar' && (
          <div className="trabhogar-container">
            <form onSubmit={calcularTrabHogar} className="form-card">
              <h2>Personas Trabajadoras del Hogar</h2>
              <p className="form-hint">
                Calcula las cuotas IMSS para empleadas domesticas, cocineras, jardineros,
                cuidadores y otras personas que trabajan en el hogar. Es obligatorio desde 2022.
              </p>

              <div className="form-section">
                <h3>Datos de la Trabajadora</h3>

                <div className="form-group">
                  <label>Salario Mensual que Paga</label>
                  <input
                    type="number"
                    value={datosTrabHogar.salarioMensual}
                    onChange={(e) => setDatosTrabHogar(prev => ({ ...prev, salarioMensual: e.target.value }))}
                    placeholder="Ej: 6000"
                    min="0"
                    required
                  />
                  <span className="hint">El salario real que le paga a la trabajadora</span>
                </div>

                <div className="form-group">
                  <label>Dias Trabajados por Semana</label>
                  <select
                    value={datosTrabHogar.diasPorSemana}
                    onChange={(e) => setDatosTrabHogar(prev => ({ ...prev, diasPorSemana: parseInt(e.target.value) }))}
                  >
                    <option value="1">1 dia por semana</option>
                    <option value="2">2 dias por semana</option>
                    <option value="3">3 dias por semana</option>
                    <option value="4">4 dias por semana</option>
                    <option value="5">5 dias por semana</option>
                    <option value="6">6 dias por semana</option>
                    <option value="7">7 dias por semana (tiempo completo)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Zona Geografica</label>
                  <select
                    value={datosTrabHogar.zona}
                    onChange={(e) => setDatosTrabHogar(prev => ({ ...prev, zona: e.target.value }))}
                  >
                    <option value="general">Resto del Pais</option>
                    <option value="frontera">Zona Libre de la Frontera Norte</option>
                  </select>
                </div>
              </div>

              <div className="form-section">
                <h3>INFONAVIT (Credito de Vivienda)</h3>
                <div className="infonavit-option">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={datosTrabHogar.incluirInfonavit}
                      onChange={(e) => setDatosTrabHogar(prev => ({ ...prev, incluirInfonavit: e.target.checked }))}
                    />
                    <span className="checkmark"></span>
                    <span className="checkbox-label">Incluir aportaciones INFONAVIT (5% adicional)</span>
                  </label>
                  <p className="form-hint">
                    Recomendado: permite a la trabajadora acceder a credito de vivienda INFONAVIT.
                  </p>
                </div>
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Calculando...' : 'Calcular Cuotas'}
              </button>
            </form>

            {resultadoTrabHogar && (
              <div className="results trabhogar-results">
                <div className="result-card highlight">
                  <h3>Cuota Mensual del Patron</h3>
                  <div className="big-number">{formatMoney(resultadoTrabHogar.totales.patron)}</div>
                  <p>que usted paga al IMSS</p>
                </div>

                <div className="result-grid">
                  <div className="result-card">
                    <h3>Resumen de Pagos</h3>
                    <div className="stat"><span>Pago mensual (Patron)</span><strong className="accent">{formatMoney(resultadoTrabHogar.resumen.pagoMensualPatron)}</strong></div>
                    <div className="stat"><span>Deduccion trabajadora</span><strong>{formatMoney(resultadoTrabHogar.resumen.deduccionMensualObrero)}</strong></div>
                    <div className="stat"><span>Aportacion Gobierno</span><strong>{formatMoney(resultadoTrabHogar.resumen.aportacionGobierno)}</strong></div>
                    <div className="stat highlight-stat"><span>Total aportacion</span><strong>{formatMoney(resultadoTrabHogar.resumen.totalAportacionMensual)}</strong></div>
                  </div>

                  <div className="result-card">
                    <h3>Datos de Cotizacion</h3>
                    <div className="stat"><span>Salario mensual</span><strong>{formatMoney(resultadoTrabHogar.datosEntrada.salarioMensual)}</strong></div>
                    <div className="stat"><span>Dias por semana</span><strong>{resultadoTrabHogar.datosEntrada.diasPorSemana} dias</strong></div>
                    <div className="stat"><span>Dias al mes</span><strong>{resultadoTrabHogar.calculo.diasTrabajadosMes.toFixed(1)} dias</strong></div>
                    <div className="stat"><span>SBC diario</span><strong>{formatMoney(resultadoTrabHogar.calculo.sbcDiarioTopado)}</strong></div>
                    <div className="stat"><span>Zona</span><strong>{resultadoTrabHogar.datosEntrada.zonaDescripcion}</strong></div>
                  </div>
                </div>

                <div className="result-card full-width">
                  <h3>Desglose de Cuotas Mensuales</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Concepto</th>
                          <th>Patron</th>
                          <th>Trabajadora</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Riesgos de Trabajo</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.riesgosTrabajo.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.riesgosTrabajo.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Enf. y Maternidad (Cuota Fija)</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesCuotaFija.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesCuotaFija.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Enf. y Maternidad (Excedente)</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesExcedente.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesExcedente.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Enf. y Maternidad (Dinero)</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesDinero.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.enfermedadesDinero.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Gastos Medicos Pensionados</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.gastosMedicos.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.gastosMedicos.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Invalidez y Vida</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.invalidezVida.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.invalidezVida.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Guarderias y Prest. Sociales</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.guarderias.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.guarderias.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Retiro (SAR)</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.retiro.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.retiro.obrero)}</td>
                        </tr>
                        <tr>
                          <td>Cesantia y Vejez</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.cesantiaVejez.patron)}</td>
                          <td>{formatMoney(resultadoTrabHogar.desglose.cesantiaVejez.obrero)}</td>
                        </tr>
                        {resultadoTrabHogar.datosEntrada.incluirInfonavit && (
                          <tr>
                            <td>INFONAVIT</td>
                            <td>{formatMoney(resultadoTrabHogar.desglose.infonavit.patron)}</td>
                            <td>{formatMoney(resultadoTrabHogar.desglose.infonavit.obrero)}</td>
                          </tr>
                        )}
                        <tr className="total-row">
                          <td><strong>TOTAL</strong></td>
                          <td><strong className="accent">{formatMoney(resultadoTrabHogar.totales.patron)}</strong></td>
                          <td><strong>{formatMoney(resultadoTrabHogar.totales.obrero)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {infoTrabHogar && (
                  <div className="result-card full-width">
                    <h3>Beneficios para la Trabajadora</h3>
                    <ul className="beneficios-lista">
                      {infoTrabHogar.beneficios.map((beneficio, i) => (
                        <li key={i}>{beneficio}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resultados' && resultado && (
          <div className="results">
            <div className="result-card highlight">
              <h3>Tu Pensión Estimada</h3>
              <div className="big-number">{formatMoney(resultado.pension.mensualEstimada)}</div>
              <p>mensuales al retiro</p>
              <div className="pension-details">
                <span>Aguinaldo: {formatMoney(resultado.pension.aguinaldo)}</span>
                <span>Anual: {formatMoney(resultado.pension.pensionAnual)}</span>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-card">
                <h3>Datos Personales</h3>
                <div className="stat"><span>Edad actual</span><strong>{resultado.datosPersonales.edadActual} años</strong></div>
                <div className="stat"><span>Fecha de retiro</span><strong>{resultado.datosPersonales.fechaRetiro}</strong></div>
                <div className="stat"><span>Años para retiro</span><strong>{resultado.datosPersonales.anosParaRetiro} años</strong></div>
              </div>

              <div className="result-card">
                <h3>Semanas Cotizadas</h3>
                <div className="stat"><span>Actuales</span><strong>{resultado.semanas.actuales}</strong></div>
                <div className="stat"><span>A cotizar</span><strong>+{resultado.semanas.aCotizar}</strong></div>
                <div className="stat"><span>Total final</span><strong className="accent">{resultado.semanas.finales}</strong></div>
                <div className="stat"><span>% de pensión</span><strong>{resultado.semanas.porcentajePension.toFixed(2)}%</strong></div>
              </div>

              <div className="result-card">
                <h3>Cuotas Modalidad 40</h3>
                <div className="stat"><span>Salario registrado</span><strong>{formatMoney(resultado.cuotas.salarioMensualRegistrado)}/mes</strong></div>
                <div className="stat highlight-stat"><span>Pago mensual</span><strong className="accent">{formatMoney(resultado.cuotas.cuotaMensual)}</strong></div>
                <div className="stat"><span>Meses a pagar</span><strong>{resultado.cuotas.mesesAPagar}</strong></div>
                <div className="stat"><span>Inversión total</span><strong>{formatMoney(resultado.cuotas.inversionTotal)}</strong></div>
              </div>

              <div className="result-card">
                <h3>Análisis de Inversión</h3>
                <div className="stat"><span>Recuperación en</span><strong>{resultado.analisisInversion.recuperacionEnMeses} meses</strong></div>
                <div className="stat"><span>Rendimiento anual</span><strong className="accent">{resultado.analisisInversion.rendimientoAnual}%</strong></div>
              </div>
            </div>

            <div className="result-card full-width">
              <h3>Comparativa de Escenarios</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Escenario</th>
                      <th>Salario Mensual</th>
                      <th>Cuota Mensual</th>
                      <th>Pensión Estimada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.escenarios.map((esc, i) => (
                      <tr key={i}>
                        <td>{esc.nombre}</td>
                        <td>{formatMoney(esc.salarioMensual)}</td>
                        <td>{formatMoney(esc.cuotaMensual)}</td>
                        <td className="accent">{formatMoney(esc.pensionEstimada)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="info-section">
            <div className="info-card">
              <h2>Artículo 218 LSS - Modalidad 40</h2>
              <p>Los asegurados que hayan dejado de estar sujetos al régimen obligatorio pueden <strong>continuar voluntariamente</strong> en el mismo, para incrementar semanas y mejorar salario promedio.</p>
              <div className="requisitos">
                <h4>Requisitos:</h4>
                <ul>
                  <li>Mínimo 52 semanas cotizadas en últimos 5 años</li>
                  <li>No estar sujeto a relación de trabajo</li>
                  <li>Inscribirse antes de cumplir 60 años</li>
                </ul>
              </div>
            </div>

            <div className="info-card">
              <h2>Cuota: 10.075%</h2>
              <div className="desglose">
                <div className="item"><span>Enf. y Maternidad</span><span>1.675%</span></div>
                <div className="item"><span>Invalidez y Vida</span><span>1.75%</span></div>
                <div className="item"><span>Retiro</span><span>2.00%</span></div>
                <div className="item"><span>Cesantía y Vejez</span><span>4.275%</span></div>
                <div className="item total"><span>TOTAL</span><span>10.075%</span></div>
              </div>
            </div>

            <div className="info-card">
              <h2>Factor por Edad de Retiro</h2>
              <table className="factor-table">
                <thead><tr><th>Edad</th><th>Factor</th></tr></thead>
                <tbody>
                  <tr><td>60 años</td><td>75%</td></tr>
                  <tr><td>61 años</td><td>80%</td></tr>
                  <tr><td>62 años</td><td>85%</td></tr>
                  <tr><td>63 años</td><td>90%</td></tr>
                  <tr><td>64 años</td><td>95%</td></tr>
                  <tr><td>65 años</td><td>100%</td></tr>
                </tbody>
              </table>
            </div>

            <div className="info-card">
              <h2>Ley 73 vs Ley 97</h2>
              <div className="comparacion">
                <div className="ley">
                  <h4>Ley 73</h4>
                  <ul>
                    <li>Pensión calculada por IMSS</li>
                    <li>Basada en semanas + salario promedio</li>
                    <li>Pago vitalicio</li>
                    <li>Mejorable con Modalidad 40</li>
                  </ul>
                </div>
                <div className="ley">
                  <h4>Ley 97</h4>
                  <ul>
                    <li>Pensión de tu AFORE</li>
                    <li>Depende del saldo acumulado</li>
                    <li>Renta vitalicia o programada</li>
                    <li>Aportaciones voluntarias ayudan</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h2>UMA 2025</h2>
              <p><strong>Valor diario:</strong> $113.14 MXN</p>
              <p><strong>Tope salarial (25 UMAs):</strong> $2,828.50 diarios = $84,855 mensuales</p>
            </div>
          </div>
        )}

        {activeTab === 'crm' && (
          <CRM />
        )}

        {activeTab === 'config' && (
          <div className="settings-section">
            <h2>Configuracion</h2>

            {settingsMsg && <div className="settings-msg">{settingsMsg}</div>}

            {/* Estado de Servicios - Solo lectura */}
            <div className="settings-card">
              <h3>Estado de Servicios</h3>
              <p className="form-hint">Las API Keys se configuran en las variables de entorno de Railway</p>

              <div className="services-status">
                <div className="service-item">
                  <span className="service-name">Twilio (Voice/WhatsApp)</span>
                  <div className="status-container">
                    <span className={`status-badge ${serviciosStatus.twilio ? 'connected' : 'disconnected'}`}>
                      {serviciosStatus.twilio ? 'Conectado' : 'Desconectado'}
                    </span>
                    {serviciosStatus.twilioError && <span className="status-error-msg">{serviciosStatus.twilioError}</span>}
                  </div>
                </div>
                <div className="service-item">
                  <span className="service-name">Telegram</span>
                  <div className="status-container">
                    <span className={`status-badge ${serviciosStatus.telegram ? 'connected' : 'disconnected'}`}>
                      {serviciosStatus.telegram ? 'Conectado' : 'Desconectado'}
                    </span>
                    {serviciosStatus.telegramError && <span className="status-error-msg">{serviciosStatus.telegramError}</span>}
                  </div>
                </div>
                <div className="service-item">
                  <span className="service-name">Deepgram (Voz IA)</span>
                  <div className="status-container">
                    <span className={`status-badge ${serviciosStatus.deepgram ? 'connected' : 'disconnected'}`}>
                      {serviciosStatus.deepgram ? 'Conectado' : 'Desconectado'}
                    </span>
                    {serviciosStatus.deepgramError && <span className="status-error-msg">{serviciosStatus.deepgramError}</span>}
                  </div>
                </div>
                <div className="service-item">
                  <span className="service-name">LLM (IA Conversacional)</span>
                  <div className="status-container">
                    <span className={`status-badge ${serviciosStatus.llmConfigurado ? 'connected' : 'disconnected'}`}>
                      {serviciosStatus.llmConfigurado ? 'Conectado' : 'Desconectado'}
                    </span>
                    {serviciosStatus.llmError && <span className="status-error-msg">{serviciosStatus.llmError}</span>}
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button onClick={verificarServicios}>
                  Verificar Conexiones
                </button>
              </div>
            </div>

            {/* Proveedores de IA - Multi-Provider */}
            <div className="settings-card providers-card">
              <h3>Proveedores de IA</h3>
              <p className="form-hint">Configura qué proveedor usa cada función. Las API Keys se configuran en Railway.</p>

              {/* LLM Providers */}
              <div className="provider-section">
                <h4>Cerebro (LLM)</h4>
                <div className="provider-grid">
                  <div className={`provider-item ${serviciosStatus.gemini ? 'available' : 'unavailable'}`} title="Env: GEMINI_API_KEY">
                    <span className="provider-icon">G</span>
                    <span className="provider-name">Gemini</span>
                    <span className={`provider-status ${serviciosStatus.gemini ? 'online' : 'offline'}`}>
                      {serviciosStatus.gemini ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                  <div className={`provider-item ${serviciosStatus.anthropic ? 'available' : 'unavailable'}`} title="Env: ANTHROPIC_API_KEY">
                    <span className="provider-icon">A</span>
                    <span className="provider-name">Claude</span>
                    <span className={`provider-status ${serviciosStatus.anthropic ? 'online' : 'offline'}`}>
                      {serviciosStatus.anthropic ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                  <div className={`provider-item ${serviciosStatus.groq ? 'available' : 'unavailable'}`} title="Env: GROQ_API_KEY">
                    <span className="provider-icon">Q</span>
                    <span className="provider-name">Groq</span>
                    <span className={`provider-status ${serviciosStatus.groq ? 'online' : 'offline'}`}>
                      {serviciosStatus.groq ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                  <div className={`provider-item ${serviciosStatus.openai ? 'available' : 'unavailable'}`} title="Env: OPENAI_API_KEY">
                    <span className="provider-icon">O</span>
                    <span className="provider-name">OpenAI</span>
                    <span className={`provider-status ${serviciosStatus.openai ? 'online' : 'offline'}`}>
                      {serviciosStatus.openai ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                  <div className={`provider-item ${serviciosStatus.glm5 ? 'available' : 'unavailable'}`} title="Env: GLM_API_KEY">
                    <span className="provider-icon">Z</span>
                    <span className="provider-name">GLM-5</span>
                    <span className={`provider-status ${serviciosStatus.glm5 ? 'online' : 'offline'}`}>
                      {serviciosStatus.glm5 ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TTS Providers */}
              <div className="provider-section">
                <h4>Voz (TTS)</h4>
                <div className="provider-grid">
                  <div className={`provider-item ${serviciosStatus.deepgram ? 'available' : 'unavailable'}`}>
                    <span className="provider-icon">D</span>
                    <span className="provider-name">Deepgram</span>
                    <span className={`provider-status ${serviciosStatus.deepgram ? 'online' : 'offline'}`}>
                      {serviciosStatus.deepgram ? 'Listo' : 'Sin API'}
                    </span>
                  </div>
                  <div className="provider-item available">
                    <span className="provider-icon">P</span>
                    <span className="provider-name">Polly</span>
                    <span className="provider-status online">Via Twilio</span>
                  </div>
                </div>
              </div>

              {/* Channel Config */}
              <div className="provider-section">
                <h4>Configuracion por Canal</h4>
                <p className="form-hint">Selecciona y guarda el proveedor para cada canal</p>
                <div className="channel-config">
                  <div className="channel-row">
                    <span className="channel-icon">🌐</span>
                    <span className="channel-name">Web/Chat</span>
                    <select
                      data-channel="web"
                      value={settingsData.providers?.web || 'gemini'}
                      onChange={(e) => setSettingsData(prev => ({
                        ...prev,
                        providers: { ...prev.providers, web: e.target.value }
                      }))}
                      className="channel-select"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="anthropic">Claude</option>
                      <option value="groq">Groq (Rapido)</option>
                      <option value="openai">OpenAI</option>
                      <option value="glm5">GLM-5</option>
                    </select>
                  </div>
                  <div className="channel-row">
                    <span className="channel-icon">📱</span>
                    <span className="channel-name">WhatsApp</span>
                    <select
                      data-channel="whatsapp"
                      value={settingsData.providers?.whatsapp || 'gemini'}
                      onChange={(e) => setSettingsData(prev => ({
                        ...prev,
                        providers: { ...prev.providers, whatsapp: e.target.value }
                      }))}
                      className="channel-select"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="anthropic">Claude</option>
                      <option value="groq">Groq (Rapido)</option>
                      <option value="openai">OpenAI</option>
                      <option value="glm5">GLM-5</option>
                    </select>
                  </div>
                  <div className="channel-row">
                    <span className="channel-icon">✈️</span>
                    <span className="channel-name">Telegram</span>
                    <select
                      data-channel="telegram"
                      value={settingsData.providers?.telegram || 'gemini'}
                      onChange={(e) => setSettingsData(prev => ({
                        ...prev,
                        providers: { ...prev.providers, telegram: e.target.value }
                      }))}
                      className="channel-select"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="anthropic">Claude</option>
                      <option value="groq">Groq (Rapido)</option>
                      <option value="openai">OpenAI</option>
                      <option value="glm5">GLM-5</option>
                    </select>
                  </div>
                  <div className="channel-row">
                    <span className="channel-icon">📞</span>
                    <span className="channel-name">Llamadas</span>
                    <select
                      data-channel="voice"
                      value={settingsData.providers?.voice || 'groq'}
                      onChange={(e) => setSettingsData(prev => ({
                        ...prev,
                        providers: { ...prev.providers, voice: e.target.value }
                      }))}
                      className="channel-select"
                    >
                      <option value="groq">Groq (Recomendado)</option>
                      <option value="gemini">Gemini</option>
                      <option value="anthropic">Claude</option>
                    </select>
                    <select
                      data-channel="tts"
                      value={settingsData.providers?.tts || 'deepgram'}
                      onChange={(e) => setSettingsData(prev => ({
                        ...prev,
                        providers: { ...prev.providers, tts: e.target.value }
                      }))}
                      className="channel-select"
                    >
                      <option value="deepgram">Deepgram TTS</option>
                      <option value="amazon-polly">Amazon Polly</option>
                    </select>
                  </div>
                </div>
                <div className="settings-actions" style={{ marginTop: '15px' }}>
                  <button
                    onClick={async () => {
                      try {
                        setSettingsMsg('Guardando configuracion...');

                        // Usar valores del estado React (ya no del DOM)
                        const webProvider = settingsData.providers?.web || 'gemini';
                        const whatsappProvider = settingsData.providers?.whatsapp || 'gemini';
                        const telegramProvider = settingsData.providers?.telegram || 'gemini';
                        const voiceProvider = settingsData.providers?.voice || 'groq';
                        const ttsProvider = settingsData.providers?.tts || 'deepgram';

                        // Guardar configuracion completa de proveedores
                        const config = {
                          llm: {
                            default: webProvider,
                            fallback: ['groq', 'anthropic'],
                            perChannel: {
                              web: webProvider,
                              whatsapp: whatsappProvider,
                              telegram: telegramProvider,
                              voice: voiceProvider
                            }
                          },
                          tts: {
                            default: ttsProvider
                          }
                        };

                        await fetch('/api/providers/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(config)
                        });

                        // Tambien guardar en settings/llm para compatibilidad
                        await fetch('/api/settings/llm', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            provider: webProvider,
                            temperature: settingsData.llm?.temperature || 0.7
                          })
                        });

                        setSettingsMsg(`Configuracion guardada: Web=${webProvider}, WhatsApp=${whatsappProvider}, Telegram=${telegramProvider}, Llamadas=${voiceProvider}, TTS=${ttsProvider}`);
                        setTimeout(() => setSettingsMsg(''), 5000);
                      } catch (err) {
                        setSettingsMsg('Error guardando configuracion');
                        console.error(err);
                      }
                    }}
                    className="primary"
                  >
                    Guardar TODA la Configuracion de Proveedores
                  </button>
                </div>
              </div>
            </div>

            {/* Canales de Comunicación - Números */}
            <div className="settings-card">
              <h3>Canales de Comunicacion</h3>
              <p className="form-hint">Configura los números de teléfono para cada canal</p>

              <div className="numeros-lista">
                {(settingsData.numeros || []).map(num => {
                  const estaConectado = (num.tipo === 'voz' || num.tipo === 'whatsapp')
                    ? serviciosStatus.twilio
                    : (num.tipo === 'telegram' ? serviciosStatus.telegram : false)
                  return (
                    <div key={num.id} className={`numero-item ${estaConectado ? 'conectado' : 'desconectado'}`}>
                      <span className={`numero-status ${estaConectado ? 'online' : 'offline'}`}></span>
                      <span className="numero-icono">
                        {num.tipo === 'voz' && '📞'}
                        {num.tipo === 'whatsapp' && '📱'}
                        {num.tipo === 'telegram' && '🤖'}
                      </span>
                      <span className="numero-nombre">{num.nombre}</span>
                      <span className="numero-valor">{num.numero}</span>
                      <span className={`numero-tipo ${num.tipo}`}>{num.tipo}</span>
                      {num.tipo === 'whatsapp' && (
                        <button
                          className="numero-qr"
                          onClick={() => setQrModal({ visible: true, numero: num.numero, nombre: num.nombre })}
                          title="Ver QR de WhatsApp"
                        >
                          QR
                        </button>
                      )}
                      <button className="numero-delete" onClick={() => eliminarNumero(num.id)}>X</button>
                    </div>
                  )
                })}
                {(!settingsData.numeros || settingsData.numeros.length === 0) && (
                  <p className="empty-state">No hay numeros configurados</p>
                )}
              </div>

              <div className="agregar-numero">
                <h4>Agregar Numero</h4>
                <div className="numero-form">
                  <input
                    type="text"
                    placeholder="Nombre (ej: WhatsApp México)"
                    value={nuevoNumero.nombre}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Numero (+52...) o @usuario"
                    value={nuevoNumero.numero}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, numero: e.target.value }))}
                  />
                  <select
                    value={nuevoNumero.tipo}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, tipo: e.target.value }))}
                  >
                    <option value="voz">Llamadas (Twilio)</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                  <button onClick={agregarNumero}>Agregar</button>
                </div>
              </div>
            </div>

            {/* Configuración de Voz */}
            <div className="settings-card">
              <h3>Configuracion de Voz</h3>
              <p className="form-hint">Selecciona la voz y modelo para las llamadas telefónicas</p>

              <div className="form-group">
                <label>Voz del Asistente (TTS)</label>
                <select
                  value={settingsData.voz?.speakModel || 'aura-2-selena-es'}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    voz: { ...prev.voz, speakModel: e.target.value }
                  }))}
                  className="provider-select"
                >
                  <optgroup label="Voces Femeninas">
                    <option value="aura-2-selena-es">Selena (Recomendada)</option>
                    <option value="aura-2-luna-es">Luna</option>
                    <option value="aura-2-estrella-es">Estrella</option>
                    <option value="aura-2-diana-es">Diana</option>
                    <option value="aura-2-carina-es">Carina</option>
                    <option value="aura-2-aquila-es">Aquila</option>
                  </optgroup>
                  <optgroup label="Voces Masculinas">
                    <option value="aura-2-javier-es">Javier</option>
                  </optgroup>
                </select>
              </div>

              <div className="form-group-row">
                <div className="form-group">
                  <label>Modelo de Reconocimiento (STT)</label>
                  <select
                    value={settingsData.voz?.listenModel || 'nova-3'}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      voz: { ...prev.voz, listenModel: e.target.value }
                    }))}
                  >
                    <option value="nova-3">Nova 3 (Mejor calidad)</option>
                    <option value="nova-2">Nova 2</option>
                    <option value="enhanced">Enhanced</option>
                    <option value="base">Base (Más rápido)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Idioma</label>
                  <select
                    value={settingsData.voz?.listenLanguage || 'es'}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      voz: { ...prev.voz, listenLanguage: e.target.value }
                    }))}
                  >
                    <option value="es">Español (España)</option>
                    <option value="es-419">Español (Latinoamérica)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="settings-actions">
                <button onClick={guardarVozConfig} className="primary">Guardar Configuracion de Voz</button>
              </div>
            </div>

            {/* Configuración de IA */}
            <div className="settings-card">
              <h3>Configuracion de IA</h3>
              <p className="form-hint">Selecciona el modelo de lenguaje para el agente conversacional</p>

              <div className="form-group">
                <label>Proveedor de IA</label>
                <select
                  value={settingsData.llm?.provider || 'gemini'}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    llm: { ...prev.llm, provider: e.target.value }
                  }))}
                  className="provider-select"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI GPT-4</option>
                  <option value="groq">Groq (Llama - Rápido)</option>
                  <option value="glm5">GLM-5 (Zhipu AI - Multimodal)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Creatividad: {settingsData.llm?.temperature || 0.7} ({settingsData.llm?.temperature < 0.3 ? 'Preciso' : settingsData.llm?.temperature > 0.7 ? 'Creativo' : 'Balanceado'})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settingsData.llm?.temperature || 0.7}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    llm: { ...prev.llm, temperature: parseFloat(e.target.value) }
                  }))}
                />
              </div>

              <div className="settings-actions">
                <button onClick={guardarLlmConfig} className="primary">Guardar Configuracion de IA</button>
              </div>
            </div>

            <div className="settings-card">
              <h3>Valores de Referencia IMSS</h3>
              <p className="form-hint">Estos valores se actualizan cada año. UMA en febrero, Salarios en enero.</p>

              <div className="form-group">
                <label>Año de Aplicacion</label>
                <input
                  type="number"
                  value={valoresActualizables.año}
                  onChange={(e) => setValoresActualizables(prev => ({ ...prev, año: parseInt(e.target.value) }))}
                  min="2020"
                  max="2030"
                />
              </div>

              <div className="valores-grid">
                <div className="valor-section">
                  <h4>UMA (Unidad de Medida y Actualizacion)</h4>
                  <div className="form-group">
                    <label>Diario</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresActualizables.uma.diario}
                      onChange={(e) => setValoresActualizables(prev => ({
                        ...prev,
                        uma: {
                          ...prev.uma,
                          diario: parseFloat(e.target.value),
                          mensual: parseFloat(e.target.value) * 30.4,
                          anual: parseFloat(e.target.value) * 365
                        }
                      }))}
                      placeholder="113.14"
                    />
                  </div>
                  <div className="form-group">
                    <label>Mensual (calculado)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresActualizables.uma.mensual?.toFixed(2) || ''}
                      readOnly
                      className="readonly"
                    />
                  </div>
                  <div className="form-group">
                    <label>Anual (calculado)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresActualizables.uma.anual?.toFixed(2) || ''}
                      readOnly
                      className="readonly"
                    />
                  </div>
                  <button onClick={guardarUMA} className="submit-btn">Guardar UMA</button>
                </div>

                <div className="valor-section">
                  <h4>Salarios Minimos</h4>
                  <div className="form-group">
                    <label>Resto del Pais (General)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresActualizables.salarios.general}
                      onChange={(e) => setValoresActualizables(prev => ({
                        ...prev,
                        salarios: { ...prev.salarios, general: parseFloat(e.target.value) }
                      }))}
                      placeholder="278.80"
                    />
                  </div>
                  <div className="form-group">
                    <label>Franja Fronteriza</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresActualizables.salarios.frontera}
                      onChange={(e) => setValoresActualizables(prev => ({
                        ...prev,
                        salarios: { ...prev.salarios, frontera: parseFloat(e.target.value) }
                      }))}
                      placeholder="419.88"
                    />
                  </div>
                  <button onClick={guardarSalarios} className="submit-btn">Guardar Salarios</button>
                </div>
              </div>
            </div>

            {/* Modal QR WhatsApp */}
            {qrModal.visible && (
              <div className="qr-modal-overlay" onClick={() => setQrModal({ visible: false, numero: '', nombre: '' })}>
                <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
                  <button className="qr-modal-close" onClick={() => setQrModal({ visible: false, numero: '', nombre: '' })}>×</button>
                  <h3>WhatsApp - {qrModal.nombre || 'Asesor IMSS'}</h3>
                  <p className="qr-numero">{qrModal.numero}</p>
                  <div className="qr-code">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://wa.me/${qrModal.numero.replace(/[^0-9]/g, '')}?text=Hola, necesito información sobre mi pensión IMSS`)}`}
                      alt="QR WhatsApp"
                    />
                  </div>
                  <p className="qr-instrucciones">Escanea este código con tu celular para abrir WhatsApp</p>
                  <a
                    href={`https://wa.me/${qrModal.numero.replace(/[^0-9]/g, '')}?text=Hola, necesito información sobre mi pensión IMSS`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qr-link"
                  >
                    Abrir WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'training' && (
          <div className="training-section">
            <h2>Entrenamiento del Agente IA</h2>
            <p className="training-desc">Agrega reglas, conocimiento y ejemplos para personalizar las respuestas del agente sin tocar código.</p>

            {trainingMsg && <div className="training-msg">{trainingMsg}</div>}

            <div className="training-tabs">
              <button className={trainingTab === 'reglas' ? 'active' : ''} onClick={() => setTrainingTab('reglas')}>
                Reglas
              </button>
              <button className={trainingTab === 'faq' ? 'active' : ''} onClick={() => setTrainingTab('faq')}>
                FAQ
              </button>
              <button className={trainingTab === 'conocimiento' ? 'active' : ''} onClick={() => setTrainingTab('conocimiento')}>
                Conocimiento
              </button>
              <button className={trainingTab === 'ejemplos' ? 'active' : ''} onClick={() => setTrainingTab('ejemplos')}>
                Ejemplos
              </button>
              <button className={trainingTab === 'config' ? 'active' : ''} onClick={() => setTrainingTab('config')}>
                Comportamiento
              </button>
            </div>

            {/* REGLAS */}
            {trainingTab === 'reglas' && (
              <div className="training-card">
                <h3>Reglas Obligatorias</h3>
                <p>El agente SIEMPRE seguira estas reglas al responder.</p>

                <div className="training-list">
                  {(trainingData.reglas || []).map(regla => (
                    <div key={regla.id} className={`training-item ${regla.activo ? 'activo' : 'inactivo'}`}>
                      <div className="item-header">
                        <strong>{regla.titulo}</strong>
                        <div className="item-actions">
                          <button
                            className={`toggle-btn ${regla.activo ? 'on' : 'off'}`}
                            onClick={async () => {
                              await fetch(`/api/training/reglas/${regla.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ activo: !regla.activo })
                              })
                              cargarTraining()
                            }}
                          >
                            {regla.activo ? 'ON' : 'OFF'}
                          </button>
                          <button
                            className="delete-btn"
                            onClick={async () => {
                              await fetch(`/api/training/reglas/${regla.id}`, { method: 'DELETE' })
                              cargarTraining()
                            }}
                          >
                            X
                          </button>
                        </div>
                      </div>
                      <p>{regla.contenido}</p>
                    </div>
                  ))}
                </div>

                <div className="training-form">
                  <h4>Agregar Nueva Regla</h4>
                  <input
                    type="text"
                    placeholder="Titulo de la regla"
                    id="regla-titulo"
                  />
                  <textarea
                    placeholder="Descripcion de la regla (ej: Siempre preguntar cuanto tiempo sin cotizar)"
                    id="regla-contenido"
                    rows="3"
                  />
                  <button
                    className="submit-btn"
                    onClick={async () => {
                      const titulo = document.getElementById('regla-titulo').value
                      const contenido = document.getElementById('regla-contenido').value
                      if (!titulo || !contenido) return setTrainingMsg('Completa todos los campos')

                      setTrainingMsg('Guardando...')
                      try {
                        const res = await fetch('/api/training/reglas', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ titulo, contenido })
                        })

                        if (res.ok) {
                          document.getElementById('regla-titulo').value = ''
                          document.getElementById('regla-contenido').value = ''
                          setTrainingMsg('Regla agregada con éxito')
                          cargarTraining()
                        } else {
                          const err = await res.json()
                          setTrainingMsg(`Error: ${err.error || 'No se pudo guardar'}`)
                        }
                      } catch (e) {
                        setTrainingMsg('Error de conexión con el servidor')
                      }

                      setTimeout(() => setTrainingMsg(''), 3000)
                    }}
                  >
                    Agregar Regla
                  </button>
                </div>
              </div>
            )}

            {/* FAQ */}
            {trainingTab === 'faq' && (
              <div className="training-card">
                <h3>Preguntas Frecuentes</h3>
                <p>Respuestas predefinidas que el agente usara cuando detecte estas preguntas.</p>

                <div className="training-list">
                  {(trainingData.faq || []).map(faq => (
                    <div key={faq.id} className={`training-item ${faq.activo ? 'activo' : 'inactivo'}`}>
                      <div className="item-header">
                        <strong>P: {faq.pregunta}</strong>
                        <div className="item-actions">
                          <button
                            className={`toggle-btn ${faq.activo ? 'on' : 'off'}`}
                            onClick={async () => {
                              await fetch(`/api/training/faq/${faq.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ activo: !faq.activo })
                              })
                              cargarTraining()
                            }}
                          >
                            {faq.activo ? 'ON' : 'OFF'}
                          </button>
                          <button
                            className="delete-btn"
                            onClick={async () => {
                              await fetch(`/api/training/faq/${faq.id}`, { method: 'DELETE' })
                              cargarTraining()
                            }}
                          >
                            X
                          </button>
                        </div>
                      </div>
                      <p><strong>R:</strong> {faq.respuesta}</p>
                    </div>
                  ))}
                </div>

                <div className="training-form">
                  <h4>Agregar Nueva FAQ</h4>
                  <input
                    type="text"
                    placeholder="Pregunta (ej: Que es la Modalidad 40?)"
                    id="faq-pregunta"
                  />
                  <textarea
                    placeholder="Respuesta que el agente debe dar"
                    id="faq-respuesta"
                    rows="3"
                  />
                  <button
                    className="submit-btn"
                    onClick={async () => {
                      const pregunta = document.getElementById('faq-pregunta').value
                      const respuesta = document.getElementById('faq-respuesta').value
                      if (!pregunta || !respuesta) return setTrainingMsg('Completa todos los campos')

                      setTrainingMsg('Guardando...')
                      try {
                        const res = await fetch('/api/training/faq', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ pregunta, respuesta })
                        })

                        if (res.ok) {
                          document.getElementById('faq-pregunta').value = ''
                          document.getElementById('faq-respuesta').value = ''
                          setTrainingMsg('FAQ agregada con éxito')
                          cargarTraining()
                        } else {
                          const err = await res.json()
                          setTrainingMsg(`Error: ${err.error || 'No se pudo guardar'}`)
                        }
                      } catch (e) {
                        setTrainingMsg('Error de conexión con el servidor')
                      }

                      setTimeout(() => setTrainingMsg(''), 3000)
                    }}
                  >
                    Agregar FAQ
                  </button>
                </div>
              </div>
            )}

            {/* CONOCIMIENTO */}
            {trainingTab === 'conocimiento' && (
              <div className="training-card">
                <h3>Base de Conocimiento</h3>
                <p>Informacion adicional que el agente puede usar para responder.</p>

                <div className="training-list">
                  {(trainingData.conocimiento || []).map(item => (
                    <div key={item.id} className={`training-item ${item.activo ? 'activo' : 'inactivo'}`}>
                      <div className="item-header">
                        <strong>[{item.categoria}] {item.titulo}</strong>
                        <div className="item-actions">
                          <button
                            className={`toggle-btn ${item.activo ? 'on' : 'off'}`}
                            onClick={async () => {
                              await fetch(`/api/training/conocimiento/${item.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ activo: !item.activo })
                              })
                              cargarTraining()
                            }}
                          >
                            {item.activo ? 'ON' : 'OFF'}
                          </button>
                          <button
                            className="delete-btn"
                            onClick={async () => {
                              await fetch(`/api/training/conocimiento/${item.id}`, { method: 'DELETE' })
                              cargarTraining()
                            }}
                          >
                            X
                          </button>
                        </div>
                      </div>
                      <p>{item.contenido}</p>
                    </div>
                  ))}
                </div>

                <div className="training-form">
                  <h4>Agregar Conocimiento</h4>
                  <select id="conocimiento-categoria">
                    <option value="Requisitos">Requisitos</option>
                    <option value="Costos">Costos</option>
                    <option value="Proceso">Proceso</option>
                    <option value="Legal">Legal</option>
                    <option value="General">General</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Titulo"
                    id="conocimiento-titulo"
                  />
                  <textarea
                    placeholder="Contenido del conocimiento"
                    id="conocimiento-contenido"
                    rows="4"
                  />
                  <button
                    className="submit-btn"
                    onClick={async () => {
                      const categoria = document.getElementById('conocimiento-categoria').value
                      const titulo = document.getElementById('conocimiento-titulo').value
                      const contenido = document.getElementById('conocimiento-contenido').value
                      if (!titulo || !contenido) return setTrainingMsg('Completa todos los campos')

                      setTrainingMsg('Guardando...')
                      try {
                        const res = await fetch('/api/training/conocimiento', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ categoria, titulo, contenido })
                        })

                        if (res.ok) {
                          document.getElementById('conocimiento-titulo').value = ''
                          document.getElementById('conocimiento-contenido').value = ''
                          setTrainingMsg('Conocimiento agregado con éxito')
                          cargarTraining()
                        } else {
                          const err = await res.json()
                          setTrainingMsg(`Error: ${err.error || 'No se pudo guardar'}`)
                        }
                      } catch (e) {
                        setTrainingMsg('Error de conexión con el servidor')
                      }

                      setTimeout(() => setTrainingMsg(''), 3000)
                    }}
                  >
                    Agregar Conocimiento
                  </button>
                </div>
              </div>
            )}

            {/* EJEMPLOS */}
            {trainingTab === 'ejemplos' && (
              <div className="training-card">
                <h3>Ejemplos de Conversacion</h3>
                <p>Ensenale al agente como responder en situaciones especificas.</p>

                <div className="training-list">
                  {(trainingData.ejemplos || []).map(ej => (
                    <div key={ej.id} className={`training-item ejemplo ${ej.activo ? 'activo' : 'inactivo'}`}>
                      <div className="item-header">
                        <strong>Contexto: {ej.contexto}</strong>
                        <div className="item-actions">
                          <button
                            className={`toggle-btn ${ej.activo ? 'on' : 'off'}`}
                            onClick={async () => {
                              await fetch(`/api/training/ejemplos/${ej.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ activo: !ej.activo })
                              })
                              cargarTraining()
                            }}
                          >
                            {ej.activo ? 'ON' : 'OFF'}
                          </button>
                          <button
                            className="delete-btn"
                            onClick={async () => {
                              await fetch(`/api/training/ejemplos/${ej.id}`, { method: 'DELETE' })
                              cargarTraining()
                            }}
                          >
                            X
                          </button>
                        </div>
                      </div>
                      <div className="ejemplo-conversacion">
                        <p><span className="usuario">Usuario:</span> {ej.usuarioDice}</p>
                        <p><span className="agente">Agente:</span> {ej.agenteResponde}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="training-form">
                  <h4>Agregar Ejemplo</h4>
                  <input
                    type="text"
                    placeholder="Contexto (ej: Usuario con mas de 5 anios sin cotizar)"
                    id="ejemplo-contexto"
                  />
                  <textarea
                    placeholder="El usuario dice..."
                    id="ejemplo-usuario"
                    rows="2"
                  />
                  <textarea
                    placeholder="El agente debe responder..."
                    id="ejemplo-agente"
                    rows="3"
                  />
                  <button
                    className="submit-btn"
                    onClick={async () => {
                      const contexto = document.getElementById('ejemplo-contexto').value
                      const usuarioDice = document.getElementById('ejemplo-usuario').value
                      const agenteResponde = document.getElementById('ejemplo-agente').value
                      if (!contexto || !usuarioDice || !agenteResponde) return setTrainingMsg('Completa todos los campos')

                      setTrainingMsg('Guardando...')
                      try {
                        const res = await fetch('/api/training/ejemplos', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ contexto, usuarioDice, agenteResponde })
                        })

                        if (res.ok) {
                          document.getElementById('ejemplo-contexto').value = ''
                          document.getElementById('ejemplo-usuario').value = ''
                          document.getElementById('ejemplo-agente').value = ''
                          setTrainingMsg('Ejemplo agregado con éxito')
                          cargarTraining()
                        } else {
                          const err = await res.json()
                          setTrainingMsg(`Error: ${err.error || 'No se pudo guardar'}`)
                        }
                      } catch (e) {
                        setTrainingMsg('Error de conexión con el servidor')
                      }

                      setTimeout(() => setTrainingMsg(''), 3000)
                    }}
                  >
                    Agregar Ejemplo
                  </button>
                </div>
              </div>
            )}

            {/* CONFIGURACION */}
            {trainingTab === 'config' && (
              <div className="training-card">
                <h3>Comportamiento del Agente</h3>

                <div className="training-form config-form">
                  <div className="form-group">
                    <label>Nombre del Agente</label>
                    <input
                      type="text"
                      value={trainingData.configuracion?.nombreAgente || ''}
                      onChange={(e) => setTrainingData(prev => ({
                        ...prev,
                        configuracion: { ...(prev.configuracion || {}), nombreAgente: e.target.value }
                      }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Saludo Inicial</label>
                    <textarea
                      value={trainingData.configuracion?.saludoInicial || ''}
                      onChange={(e) => setTrainingData(prev => ({
                        ...prev,
                        configuracion: { ...(prev.configuracion || {}), saludoInicial: e.target.value }
                      }))}
                      rows="2"
                    />
                  </div>

                  <div className="form-group">
                    <label>Despedida</label>
                    <textarea
                      value={trainingData.configuracion?.despedida || ''}
                      onChange={(e) => setTrainingData(prev => ({
                        ...prev,
                        configuracion: { ...(prev.configuracion || {}), despedida: e.target.value }
                      }))}
                      rows="2"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tono de Comunicacion</label>
                      <select
                        value={trainingData.configuracion?.tono || 'profesional'}
                        onChange={(e) => setTrainingData(prev => ({
                          ...prev,
                          configuracion: { ...(prev.configuracion || {}), tono: e.target.value }
                        }))}
                      >
                        <option value="profesional">Profesional</option>
                        <option value="amigable">Amigable</option>
                        <option value="formal">Formal</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Max Caracteres por Respuesta</label>
                      <input
                        type="number"
                        value={trainingData.configuracion?.maxRespuesta || 500}
                        onChange={(e) => setTrainingData(prev => ({
                          ...prev,
                          configuracion: { ...(prev.configuracion || {}), maxRespuesta: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>

                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={trainingData.configuracion?.usarEmojis ?? true}
                        onChange={(e) => setTrainingData(prev => ({
                          ...prev,
                          configuracion: { ...(prev.configuracion || {}), usarEmojis: e.target.checked }
                        }))}
                      />
                      Usar emojis en respuestas
                    </label>
                  </div>

                  <button
                    className="submit-btn"
                    onClick={async () => {
                      setTrainingMsg('Guardando configuración...')
                      try {
                        const res = await fetch('/api/training/configuracion', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(trainingData.configuracion || {})
                        })

                        if (res.ok) {
                          setTrainingMsg('Configuración guardada correctamente')
                          cargarTraining()
                        } else {
                          const err = await res.json()
                          setTrainingMsg(`Error: ${err.error || 'No se pudo guardar'}`)
                        }
                      } catch (e) {
                        setTrainingMsg('Error de conexión con el servidor')
                      }

                      setTimeout(() => setTrainingMsg(''), 3000)
                    }}
                  >
                    Guardar Configuración
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer>
        <p>Herramienta informativa con IA + RAG. Consulta al IMSS para información oficial.</p>
      </footer>
    </div>
  )
}

export default App

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

  // Settings state
  const [settingsData, setSettingsData] = useState({
    twilio: { accountSid: '', authToken: '', webhookBaseUrl: '' },
    telegram: { botToken: '', botUsername: '' },
    apiKeys: { vision: '', voz: '', llm: '', browser: '' },
    numeros: []
  })
  const [twilioStatus, setTwilioStatus] = useState({ conectado: false, cargando: false })
  const [telegramStatus, setTelegramStatus] = useState({ conectado: false, cargando: false })
  const [nuevoNumero, setNuevoNumero] = useState({ nombre: '', numero: '', tipo: 'voz' })
  const [showToken, setShowToken] = useState({ twilio: false, telegram: false, vision: false, voz: false, llm: false, browser: false })
  const [settingsMsg, setSettingsMsg] = useState('')

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
  }, [])

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
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettingsData(data)
      setTwilioStatus(prev => ({ ...prev, conectado: data.twilio.configurado }))
      setTelegramStatus(prev => ({ ...prev, conectado: data.telegram.configurado }))
    } catch (err) {
      console.error('Error cargando settings:', err)
    }
  }

  const guardarTwilio = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/settings/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData.twilio)
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('Twilio guardado correctamente')
        cargarSettings()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  const guardarTelegram = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/settings/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData.telegram)
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('Telegram guardado correctamente')
        cargarSettings()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  const guardarApiKeys = async () => {
    try {
      setSettingsMsg('')
      const res = await fetch('/api/settings/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData.apiKeys)
      })
      const data = await res.json()
      if (data.success) {
        setSettingsMsg('API Keys guardadas correctamente')
        cargarSettings()
      } else {
        setSettingsMsg('Error: ' + data.error)
      }
    } catch (err) {
      setSettingsMsg('Error de conexion')
    }
  }

  const probarTwilio = async () => {
    setTwilioStatus(prev => ({ ...prev, cargando: true }))
    try {
      const res = await fetch('/api/settings/test-twilio', { method: 'POST' })
      const data = await res.json()
      setTwilioStatus({ conectado: data.conectado, cargando: false, cuenta: data.cuenta, error: data.error })
    } catch (err) {
      setTwilioStatus({ conectado: false, cargando: false, error: 'Error de conexion' })
    }
  }

  const probarTelegram = async () => {
    setTelegramStatus(prev => ({ ...prev, cargando: true }))
    try {
      const res = await fetch('/api/settings/test-telegram', { method: 'POST' })
      const data = await res.json()
      setTelegramStatus({ conectado: data.conectado, cargando: false, bot: data.bot, error: data.error })
    } catch (err) {
      setTelegramStatus({ conectado: false, cargando: false, error: 'Error de conexion' })
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

    const nuevoMensaje = { tipo: 'usuario', texto: inputChat }
    setMensajes(prev => [...prev, nuevoMensaje])
    setInputChat('')
    setLoading(true)

    // Procesar respuesta según el paso actual
    const respuesta = await procesarRespuesta(inputChat, pasoActual, contextoChat)

    setMensajes(prev => [...prev, { tipo: 'agente', texto: respuesta.mensaje }])

    if (respuesta.nuevoContexto) {
      setContextoChat(prev => ({ ...prev, ...respuesta.nuevoContexto }))
    }

    if (respuesta.siguientePaso) {
      setPasoActual(respuesta.siguientePaso)
    }

    if (respuesta.calculo) {
      setResultado(respuesta.calculo)
    }

    setLoading(false)
  }

  const procesarRespuesta = async (mensaje, paso, contexto) => {
    // Lógica de flujo conversacional
    switch (paso) {
      case 'inicio':
        return {
          mensaje: '¿En qué año comenzaste a trabajar formalmente y a cotizar al IMSS por primera vez?',
          siguientePaso: 'regimen'
        }

      case 'regimen':
        const año = parseInt(mensaje)
        if (isNaN(año) || año < 1940 || año > 2024) {
          return { mensaje: 'Por favor, ingresa un año válido (ejemplo: 1995)' }
        }
        const regimen = año < 1997 ? 'ley73' : 'ley97'
        return {
          mensaje: regimen === 'ley73'
            ? `Perfecto, cotizaste antes de 1997, eso significa que eres **asegurado Ley 73**. Tu pensión se calcula por semanas + salario promedio. Esto es muy favorable.\n\n¿Cuántas semanas cotizadas tienes reconocidas actualmente? (Puedes consultarlo en la app IMSS Digital)`
            : `Comenzaste a cotizar después de 1997, eres **asegurado Ley 97**. Tu pensión depende principalmente de tu AFORE. Sin embargo, si también cotizaste antes de 1997, podrías elegir Ley 73.\n\n¿Cuántas semanas cotizadas tienes?`,
          nuevoContexto: { regimen, añoInicio: año },
          siguientePaso: 'semanas'
        }

      case 'semanas':
        const semanas = parseInt(mensaje)
        if (isNaN(semanas) || semanas < 0) {
          return { mensaje: 'Por favor, ingresa un número válido de semanas (ejemplo: 850)' }
        }
        if (semanas < 500) {
          return {
            mensaje: `Tienes ${semanas} semanas. Para pensionarte por Ley 73 necesitas mínimo **500 semanas**. Te faltan ${500 - semanas} semanas.\n\nLa Modalidad 40 te puede ayudar a completarlas. ¿Actualmente tienes un trabajo donde te cotizan al IMSS?`,
            nuevoContexto: { semanasActuales: semanas },
            siguientePaso: 'situacion'
          }
        }
        return {
          mensaje: `¡Excelente! Con ${semanas} semanas ya cumples el requisito mínimo para pensión. ${semanas >= 1000 ? 'Además tienes un buen número de semanas acumuladas.' : ''}\n\n¿Actualmente tienes un trabajo donde te cotizan al IMSS, o estás dado de baja?`,
          nuevoContexto: { semanasActuales: semanas },
          siguientePaso: 'situacion'
        }

      case 'situacion':
        const msgLower = mensaje.toLowerCase()
        if (msgLower.includes('sí') || msgLower.includes('si') || msgLower.includes('tengo') || msgLower.includes('trabajo')) {
          return {
            mensaje: 'Mientras tengas un patrón que te cotice, **no puedes inscribirte en Modalidad 40** (ya estás en régimen obligatorio). \n\nLa Modalidad 40 es para cuando dejes de trabajar formalmente. ¿Te gustaría ver una proyección de tu pensión actual?',
            nuevoContexto: { situacionLaboral: 'activo' },
            siguientePaso: 'salario'
          }
        }
        return {
          mensaje: '¡Perfecto! Al no tener patrón, **eres candidato para Modalidad 40**. Esto te permitirá seguir cotizando y mejorar tu pensión.\n\n¿Cuál era tu salario mensual aproximado en tu último empleo?',
          nuevoContexto: { situacionLaboral: 'baja', elegibleMod40: true },
          siguientePaso: 'salario'
        }

      case 'salario':
        const salarioMensual = parseFloat(mensaje.replace(/[,$]/g, ''))
        if (isNaN(salarioMensual) || salarioMensual < 1000) {
          return { mensaje: 'Por favor, ingresa tu salario mensual (ejemplo: 25000)' }
        }
        const salarioDiario = salarioMensual / 30
        return {
          mensaje: `Tu salario era de **$${salarioMensual.toLocaleString()}/mes** ($${salarioDiario.toFixed(2)} diarios).\n\nEn Modalidad 40 puedes registrar un salario **mayor** (hasta $84,855/mes = 25 UMAs) para mejorar tu pensión. \n\n¿Cuál es tu fecha de nacimiento?`,
          nuevoContexto: { salarioActual: salarioDiario, salarioDeseado: salarioDiario },
          siguientePaso: 'nacimiento'
        }

      case 'nacimiento':
        // Intentar parsear la fecha
        let fechaNac
        try {
          // Soportar varios formatos
          if (mensaje.includes('/')) {
            const partes = mensaje.split('/')
            fechaNac = new Date(partes[2], partes[1] - 1, partes[0])
          } else if (mensaje.includes('-')) {
            fechaNac = new Date(mensaje)
          } else {
            return { mensaje: 'Por favor, ingresa tu fecha de nacimiento (ejemplo: 15/03/1965 o 1965-03-15)' }
          }
        } catch {
          return { mensaje: 'Por favor, ingresa tu fecha de nacimiento (ejemplo: 15/03/1965)' }
        }

        const hoy = new Date()
        const edad = hoy.getFullYear() - fechaNac.getFullYear()

        if (edad < 40 || edad > 80) {
          return { mensaje: 'La fecha no parece correcta. Por favor verifica.' }
        }

        return {
          mensaje: `Tienes **${edad} años**. ${edad >= 60 ? '¡Ya puedes jubilarte!' : `Te faltan ${60 - edad} años para jubilarte a los 60.`}\n\n¿A qué edad te gustaría jubilarte? (60-65 años)`,
          nuevoContexto: { fechaNacimiento: fechaNac.toISOString().split('T')[0], edadActual: edad },
          siguientePaso: 'edad_retiro'
        }

      case 'edad_retiro':
        const edadRetiro = parseInt(mensaje)
        if (isNaN(edadRetiro) || edadRetiro < 60 || edadRetiro > 65) {
          return { mensaje: 'La edad de retiro debe estar entre 60 y 65 años.' }
        }

        // Tenemos todos los datos, calcular
        const datosCalculo = {
          fechaNacimiento: contexto.fechaNacimiento,
          semanasActuales: contexto.semanasActuales,
          salarioDeseado: contexto.salarioActual,
          edadRetiro
        }

        try {
          const res = await fetch('/api/calcular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosCalculo)
          })
          const data = await res.json()

          if (data.success) {
            const r = data.data
            const factores = { 60: '75%', 61: '80%', 62: '85%', 63: '90%', 64: '95%', 65: '100%' }

            return {
              mensaje: `## 📊 Tu Proyección de Pensión\n\n` +
                `**Edad de retiro:** ${edadRetiro} años (Factor: ${factores[edadRetiro]})\n` +
                `**Semanas finales:** ${r.semanas.finales}\n\n` +
                `### 💰 Cuota Modalidad 40\n` +
                `- Mensual: **$${r.cuotas.cuotaMensual.toLocaleString()}**\n` +
                `- Inversión total: $${r.cuotas.inversionTotal.toLocaleString()}\n\n` +
                `### 🎯 Pensión Estimada\n` +
                `- Mensual: **$${r.pension.mensualEstimada.toLocaleString()}**\n` +
                `- Anual (con aguinaldo): $${r.pension.pensionAnual.toLocaleString()}\n\n` +
                `### 📈 Análisis de Inversión\n` +
                `- Recuperas tu inversión en **${r.analisisInversion.recuperacionEnMeses} meses**\n` +
                `- Rendimiento anual: ${r.analisisInversion.rendimientoAnual}%\n\n` +
                `¿Te gustaría ver qué pasa si registras un salario más alto? Puedes ir a la pestaña "Calculadora" para simular diferentes escenarios.`,
              nuevoContexto: { edadRetiro, calculoRealizado: true },
              calculo: data.data,
              siguientePaso: 'completado'
            }
          }
        } catch (e) {
          return { mensaje: 'Hubo un error al calcular. Por favor intenta de nuevo.' }
        }
        break

      case 'completado':
        if (mensaje.toLowerCase().includes('salario') || mensaje.toLowerCase().includes('más alto') || mensaje.toLowerCase().includes('escenario')) {
          return {
            mensaje: 'Para simular diferentes salarios, ve a la pestaña **"Calculadora"** donde puedes ajustar todos los parámetros.\n\n¿Hay algo más que te gustaría saber sobre la Modalidad 40 o las pensiones del IMSS?'
          }
        }
        // Buscar en base de conocimiento
        try {
          const res = await fetch('/api/rag/buscar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consulta: mensaje })
          })
          const data = await res.json()

          if (data.resultados && data.resultados.length > 0) {
            const mejor = data.resultados[0]
            return {
              mensaje: `**${mejor.titulo || mejor.pregunta}**\n\n${mejor.contenido || mejor.respuesta}\n\n📚 *Fuente: ${mejor.referencia}*`
            }
          }
        } catch (e) {
          console.error(e)
        }

        return {
          mensaje: 'Puedo ayudarte con preguntas sobre:\n- Requisitos de Modalidad 40\n- Diferencias entre Ley 73 y Ley 97\n- Cálculo de pensiones\n- Cuotas y aportaciones\n\n¿Qué te gustaría saber?'
        }

      default:
        return {
          mensaje: '¿En qué puedo ayudarte?',
          siguientePaso: 'inicio'
        }
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
    <div className="app">
      <header>
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
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
                  <button type="button" onClick={() => setDatos(d => ({...d, salarioDeseado: (UMA_2025 * 10).toFixed(2)}))}>
                    10 UMAs<br/><small>{formatMoney(UMA_2025 * 10 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({...d, salarioDeseado: (UMA_2025 * 15).toFixed(2)}))}>
                    15 UMAs<br/><small>{formatMoney(UMA_2025 * 15 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({...d, salarioDeseado: (UMA_2025 * 20).toFixed(2)}))}>
                    20 UMAs<br/><small>{formatMoney(UMA_2025 * 20 * 30)}/mes</small>
                  </button>
                  <button type="button" onClick={() => setDatos(d => ({...d, salarioDeseado: (UMA_2025 * 25).toFixed(2)}))}>
                    25 UMAs (MAX)<br/><small>{formatMoney(UMA_2025 * 25 * 30)}/mes</small>
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

            <div className="settings-card">
              <div className="settings-header">
                <h3>Twilio (Voz / WhatsApp)</h3>
                <span className={`status-badge ${twilioStatus.conectado ? 'connected' : 'disconnected'}`}>
                  {twilioStatus.conectado ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              <div className="form-group">
                <label>Account SID</label>
                <input
                  type="text"
                  value={settingsData.twilio.accountSid}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    twilio: { ...prev.twilio, accountSid: e.target.value }
                  }))}
                  placeholder="AC..."
                />
              </div>

              <div className="form-group">
                <label>Auth Token</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.twilio ? 'text' : 'password'}
                    value={settingsData.twilio.authToken}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      twilio: { ...prev.twilio, authToken: e.target.value }
                    }))}
                    placeholder="Token de autenticacion"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, twilio: !prev.twilio }))}>
                    {showToken.twilio ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Webhook URL</label>
                <input
                  type="text"
                  value={settingsData.twilio.webhookBaseUrl}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    twilio: { ...prev.twilio, webhookBaseUrl: e.target.value }
                  }))}
                  placeholder="https://tu-dominio.com"
                />
              </div>

              <div className="settings-actions">
                <button onClick={probarTwilio} disabled={twilioStatus.cargando}>
                  {twilioStatus.cargando ? 'Probando...' : 'Probar'}
                </button>
                <button onClick={guardarTwilio} className="primary">Guardar</button>
              </div>

              {twilioStatus.cuenta && (
                <div className="status-info success">
                  Cuenta: {twilioStatus.cuenta.nombre} ({twilioStatus.cuenta.estado})
                </div>
              )}
              {twilioStatus.error && (
                <div className="status-info error">{twilioStatus.error}</div>
              )}
            </div>

            <div className="settings-card">
              <div className="settings-header">
                <h3>Telegram</h3>
                <span className={`status-badge ${telegramStatus.conectado ? 'connected' : 'disconnected'}`}>
                  {telegramStatus.conectado ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              <div className="form-group">
                <label>Bot Token</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.telegram ? 'text' : 'password'}
                    value={settingsData.telegram.botToken}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      telegram: { ...prev.telegram, botToken: e.target.value }
                    }))}
                    placeholder="123456789:ABC..."
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, telegram: !prev.telegram }))}>
                    {showToken.telegram ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Bot Username</label>
                <input
                  type="text"
                  value={settingsData.telegram.botUsername}
                  onChange={(e) => setSettingsData(prev => ({
                    ...prev,
                    telegram: { ...prev.telegram, botUsername: e.target.value }
                  }))}
                  placeholder="@mi_bot"
                />
              </div>

              <div className="settings-actions">
                <button onClick={probarTelegram} disabled={telegramStatus.cargando}>
                  {telegramStatus.cargando ? 'Probando...' : 'Probar'}
                </button>
                <button onClick={guardarTelegram} className="primary">Guardar</button>
              </div>

              {telegramStatus.bot && (
                <div className="status-info success">
                  Bot: @{telegramStatus.bot.username} ({telegramStatus.bot.nombre})
                </div>
              )}
              {telegramStatus.error && (
                <div className="status-info error">{telegramStatus.error}</div>
              )}
            </div>

            <div className="settings-card">
              <h3>API Keys - Servicios de IA</h3>

              <div className="form-group">
                <label>Vision (Documentos/OCR)</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.vision ? 'text' : 'password'}
                    value={settingsData.apiKeys?.vision || ''}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      apiKeys: { ...prev.apiKeys, vision: e.target.value }
                    }))}
                    placeholder="API Key para analisis de imagenes"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, vision: !prev.vision }))}>
                    {showToken.vision ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Voz (Speech-to-Text / Text-to-Speech)</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.voz ? 'text' : 'password'}
                    value={settingsData.apiKeys?.voz || ''}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      apiKeys: { ...prev.apiKeys, voz: e.target.value }
                    }))}
                    placeholder="API Key para servicios de voz"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, voz: !prev.voz }))}>
                    {showToken.voz ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>LLM (Agente Conversacional)</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.llm ? 'text' : 'password'}
                    value={settingsData.apiKeys?.llm || ''}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      apiKeys: { ...prev.apiKeys, llm: e.target.value }
                    }))}
                    placeholder="API Key para modelo de lenguaje"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, llm: !prev.llm }))}>
                    {showToken.llm ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Browser (Navegacion Automatizada)</label>
                <div className="input-with-toggle">
                  <input
                    type={showToken.browser ? 'text' : 'password'}
                    value={settingsData.apiKeys?.browser || ''}
                    onChange={(e) => setSettingsData(prev => ({
                      ...prev,
                      apiKeys: { ...prev.apiKeys, browser: e.target.value }
                    }))}
                    placeholder="API Key para Browserless.io u otro"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowToken(prev => ({ ...prev, browser: !prev.browser }))}>
                    {showToken.browser ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="settings-actions">
                <button onClick={guardarApiKeys} className="primary">Guardar API Keys</button>
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

            <div className="settings-card">
              <h3>Numeros de Telefono</h3>

              <div className="numeros-lista">
                {settingsData.numeros.map(num => (
                  <div key={num.id} className="numero-item">
                    <span className="numero-icono">
                      {num.tipo === 'voz' && '📞'}
                      {num.tipo === 'whatsapp' && '📱'}
                      {num.tipo === 'telegram' && '🤖'}
                    </span>
                    <span className="numero-nombre">{num.nombre}</span>
                    <span className="numero-valor">{num.numero}</span>
                    <span className={`numero-tipo ${num.tipo}`}>{num.tipo}</span>
                    <button className="numero-delete" onClick={() => eliminarNumero(num.id)}>X</button>
                  </div>
                ))}
                {settingsData.numeros.length === 0 && (
                  <p className="empty-state">No hay numeros configurados</p>
                )}
              </div>

              <div className="agregar-numero">
                <h4>Agregar Numero</h4>
                <div className="numero-form">
                  <input
                    type="text"
                    placeholder="Nombre (ej: Principal)"
                    value={nuevoNumero.nombre}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Numero (+52...)"
                    value={nuevoNumero.numero}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, numero: e.target.value }))}
                  />
                  <select
                    value={nuevoNumero.tipo}
                    onChange={(e) => setNuevoNumero(prev => ({ ...prev, tipo: e.target.value }))}
                  >
                    <option value="voz">Voz</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                  <button onClick={agregarNumero}>Agregar</button>
                </div>
              </div>
            </div>
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

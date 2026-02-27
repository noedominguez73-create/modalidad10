import { useState, useEffect } from 'react'
import TwilioPhone from './components/TwilioPhone'
import CreateVoiceAgent from './components/CreateVoiceAgent'

function CRM() {
  const [vista, setVista] = useState('dashboard')
  const [subVista, setSubVista] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [mensajeTipo, setMensajeTipo] = useState('info')

  // Data states
  const [dashboard, setDashboard] = useState(null)
  const [prospectos, setProspectos] = useState([])
  const [clientes, setClientes] = useState([])
  const [pagos, setPagos] = useState([])
  const [pagosPendientesIMSS, setPagosPendientesIMSS] = useState([])
  const [historialPagos, setHistorialPagos] = useState([])
  const [recordatorios, setRecordatorios] = useState([])
  const [clientesPagoPendiente, setClientesPagoPendiente] = useState([])
  const [agentesVoz, setAgentesVoz] = useState([]) // IA Voice Agents

  // Selected items
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null)
  const [agenteAEditar, setAgenteAEditar] = useState(null)

  // Forms
  const [nuevoProspecto, setNuevoProspecto] = useState({
    nombreCompleto: '',
    telefonoUSA: '',
    whatsapp: '',
    email: '',
    curp: '',
    nss: '',
    fechaNacimiento: '',
    modalidadInteres: '40',
    origen: 'whatsapp',
    notas: ''
  })

  const [nuevoPago, setNuevoPago] = useState({
    metodo: 'paypal',
    monto: '',
    moneda: 'USD',
    nombreRemitente: '',
    emailRemitente: '',
    telefonoRemitente: '',
    notaRemitente: '',
    referencia: ''
  })

  const [conversionData, setConversionData] = useState({
    modalidad: '40',
    salarioRegistrado: '',
    metodoPagoPreferido: 'paypal',
    cuotaMensual: '',
    cuotaServicio: 15,
    fechaCorte: 15,
    datosPago: {
      paypalEmail: '',
      zellePhone: '',
      zelleEmail: ''
    }
  })

  const [datosIMSS, setDatosIMSS] = useState({
    referenciaIMSS: '',
    lineaCaptura: '',
    banco: 'BBVA',
    fechaPagoIMSS: new Date().toISOString().split('T')[0]
  })

  const [datosVigencia, setDatosVigencia] = useState({
    vigente: true,
    fechaVigenciaHasta: '',
    clinicaAsignada: ''
  })

  const [filtros, setFiltros] = useState({
    estatus: '',
    modalidad: '',
    metodoPago: '',
    fechaDesde: '',
    fechaHasta: ''
  })

  const [busqueda, setBusqueda] = useState('')

  // Cargar dashboard al inicio
  useEffect(() => {
    cargarDashboard()
  }, [])

  useEffect(() => {
    if (vista === 'notificaciones') {
      cargarAgentesVoz()
    }
  }, [vista])

  const mostrarMensaje = (texto, tipo = 'info') => {
    setMensaje(texto)
    setMensajeTipo(tipo)
    setTimeout(() => setMensaje(''), 5000)
  }

  const cargarDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/dashboard')
      const data = await res.json()
      if (data.success) {
        setDashboard(data.data)
      }
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    }
    setLoading(false)
  }

  const cargarProspectos = async () => {
    setLoading(true)
    try {
      let url = '/api/crm/prospectos'
      const params = new URLSearchParams()
      if (filtros.estatus) params.append('estatus', filtros.estatus)
      if (filtros.modalidad) params.append('modalidad', filtros.modalidad)
      if (params.toString()) url += '?' + params.toString()

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setProspectos(data.data)
      }
    } catch (err) {
      console.error('Error cargando prospectos:', err)
    }
    setLoading(false)
  }

  const cargarClientes = async () => {
    setLoading(true)
    try {
      let url = '/api/crm/clientes'
      const params = new URLSearchParams()
      if (filtros.estatus) params.append('estatus', filtros.estatus)
      if (filtros.modalidad) params.append('modalidad', filtros.modalidad)
      if (params.toString()) url += '?' + params.toString()

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setClientes(data.data)
      }
    } catch (err) {
      console.error('Error cargando clientes:', err)
    }
    setLoading(false)
  }

  const cargarClienteDetalle = async (id) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/clientes/${id}`)
      const data = await res.json()
      if (data.success) {
        setClienteSeleccionado(data.data)
        setSubVista('detalle-cliente')
      }
    } catch (err) {
      console.error('Error cargando cliente:', err)
    }
    setLoading(false)
  }

  const cargarProspectoDetalle = async (id) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/prospectos/${id}`)
      const data = await res.json()
      if (data.success) {
        setProspectoSeleccionado(data.data)
        setSubVista('detalle-prospecto')
      }
    } catch (err) {
      console.error('Error cargando prospecto:', err)
    }
    setLoading(false)
  }

  const cargarPagosPendientesMatch = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/pagos/pendientes-match')
      const data = await res.json()
      if (data.success) {
        setPagos(data.data)
      }
    } catch (err) {
      console.error('Error cargando pagos:', err)
    }
    setLoading(false)
  }

  const cargarPagosPendientesIMSS = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/pagos/pendientes-imss')
      const data = await res.json()
      if (data.success) {
        setPagosPendientesIMSS(data.data)
      }
    } catch (err) {
      console.error('Error cargando pagos IMSS:', err)
    }
    setLoading(false)
  }

  const cargarHistorialPagos = async () => {
    setLoading(true)
    try {
      let url = '/api/crm/pagos/historial'
      const params = new URLSearchParams()
      if (filtros.metodoPago) params.append('metodo', filtros.metodoPago)
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)
      if (params.toString()) url += '?' + params.toString()

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setHistorialPagos(data.data)
      }
    } catch (err) {
      console.error('Error cargando historial:', err)
    }
    setLoading(false)
  }

  const cargarRecordatorios = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/notificaciones/recordatorios')
      const data = await res.json()
      if (data.success) {
        setRecordatorios(data.data)
      }
    } catch (err) {
      console.error('Error cargando recordatorios:', err)
    }
    setLoading(false)
  }

  const cargarClientesPagoPendiente = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/clientes-pago-pendiente')
      const data = await res.json()
      if (data.success) {
        setClientesPagoPendiente(data.data)
      }
    } catch (err) {
      console.error('Error cargando clientes:', err)
    }
    setLoading(false)
  }

  const cargarAgentesVoz = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agentes')
      const data = await res.json()
      if (data.success) setAgentesVoz(data.data)
    } catch (err) { console.error('Error:', err) }
    setLoading(false)
  }

  const eliminarAgenteVoz = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este agente?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/agentes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Agente eliminado', 'success')
        cargarAgentesVoz()
      } else mostrarMensaje(data.error || 'Error', 'error')
    } catch (err) { mostrarMensaje('Error de conexión', 'error') }
    setLoading(false)
  }

  // CRUD Operations
  const crearProspecto = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/crm/prospectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProspecto)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Prospecto creado exitosamente', 'success')
        setNuevoProspecto({
          nombreCompleto: '', telefonoUSA: '', whatsapp: '', email: '',
          curp: '', nss: '', fechaNacimiento: '', modalidadInteres: '40', origen: 'whatsapp', notas: ''
        })
        cargarProspectos()
        cargarDashboard()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const actualizarProspecto = async (id, datos) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/prospectos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Prospecto actualizado', 'success')
        setProspectoSeleccionado(data.data)
        cargarProspectos()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const registrarContacto = async (prospectoId, datosContacto) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/prospectos/${prospectoId}/contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosContacto)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Contacto registrado', 'success')
        setProspectoSeleccionado(data.data)
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const convertirACliente = async (prospectoId) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/prospectos/${prospectoId}/convertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversionData)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Cliente creado exitosamente', 'success')
        setSubVista(null)
        setProspectoSeleccionado(null)
        cargarProspectos()
        cargarClientes()
        cargarDashboard()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const actualizarCliente = async (id, datos) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Cliente actualizado', 'success')
        setClienteSeleccionado(data.data)
        cargarClientes()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const registrarPago = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/crm/pagos/recibidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoPago)
      })
      const data = await res.json()
      if (data.success) {
        if (data.data.matchAutomatico) {
          mostrarMensaje(`Pago registrado con match automatico (${data.data.pago.matchConfidencia}% confianza)`, 'success')
        } else {
          mostrarMensaje('Pago registrado - pendiente de match manual', 'info')
        }
        setNuevoPago({
          metodo: 'paypal', monto: '', moneda: 'USD',
          nombreRemitente: '', emailRemitente: '', telefonoRemitente: '', notaRemitente: '', referencia: ''
        })
        cargarPagosPendientesMatch()
        cargarDashboard()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const confirmarPago = async (pagoId) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/pagos/${pagoId}/confirmar`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Pago confirmado - listo para pagar IMSS', 'success')
        cargarPagosPendientesMatch()
        cargarPagosPendientesIMSS()
        cargarDashboard()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const matchManual = async (pagoId, clienteId) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/pagos/${pagoId}/match/${clienteId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Match realizado - confirmar para proceder', 'success')
        cargarPagosPendientesMatch()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const marcarPagadoIMSS = async (pagoId) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/pagos/${pagoId}/pagado-imss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosIMSS)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Pago IMSS registrado exitosamente', 'success')
        setPagoSeleccionado(null)
        setDatosIMSS({
          referenciaIMSS: '', lineaCaptura: '', banco: 'BBVA',
          fechaPagoIMSS: new Date().toISOString().split('T')[0]
        })
        cargarPagosPendientesIMSS()
        cargarDashboard()
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const actualizarVigencia = async (clienteId) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/crm/clientes/${clienteId}/vigencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosVigencia)
      })
      const data = await res.json()
      if (data.success) {
        mostrarMensaje('Vigencia actualizada', 'success')
        setClienteSeleccionado(data.data)
        setDatosVigencia({ vigente: true, fechaVigenciaHasta: '', clinicaAsignada: '' })
      } else {
        mostrarMensaje('Error: ' + data.error, 'error')
      }
    } catch (err) {
      mostrarMensaje('Error de conexion', 'error')
    }
    setLoading(false)
  }

  const generarMensajeBienvenida = async (clienteId) => {
    try {
      const res = await fetch(`/api/crm/notificaciones/bienvenida/${clienteId}`)
      const data = await res.json()
      if (data.success) {
        navigator.clipboard.writeText(data.data.mensaje)
        mostrarMensaje('Mensaje copiado al portapapeles', 'success')
      }
    } catch (err) {
      mostrarMensaje('Error generando mensaje', 'error')
    }
  }

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista)
    setSubVista(null)
    setMensaje('')
    setProspectoSeleccionado(null)
    setClienteSeleccionado(null)
    setPagoSeleccionado(null)

    switch (nuevaVista) {
      case 'dashboard': cargarDashboard(); break
      case 'prospectos': cargarProspectos(); break
      case 'clientes': cargarClientes(); break
      case 'pagos':
        cargarPagosPendientesMatch()
        cargarPagosPendientesIMSS()
        break
      case 'historial': cargarHistorialPagos(); break
      case 'notificaciones':
        cargarRecordatorios()
        cargarClientesPagoPendiente()
        break
    }
  }

  const formatMoney = (num, moneda = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: moneda
    }).format(num || 0)
  }

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A'
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  const formatFechaHora = (fecha) => {
    if (!fecha) return 'N/A'
    return new Date(fecha).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const filtrarItems = (items, campo = 'nombreCompleto') => {
    if (!busqueda) return items
    const termino = busqueda.toLowerCase()
    return items.filter(item =>
      (item[campo] && item[campo].toLowerCase().includes(termino)) ||
      (item.nss && item.nss.includes(termino)) ||
      (item.email && item.email.toLowerCase().includes(termino)) ||
      (item.whatsapp && item.whatsapp.includes(termino))
    )
  }

  return (
    <div className="crm-container">
      {/* Navegacion principal */}
      <div className="crm-nav">
        <button className={vista === 'dashboard' ? 'active' : ''} onClick={() => cambiarVista('dashboard')}>
          📊 Dashboard
        </button>
        <button className={vista === 'prospectos' ? 'active' : ''} onClick={() => cambiarVista('prospectos')}>
          👥 Prospectos
        </button>
        <button className={vista === 'clientes' ? 'active' : ''} onClick={() => cambiarVista('clientes')}>
          🧑‍💼 Clientes
        </button>
        <button className={vista === 'pagos' ? 'active' : ''} onClick={() => cambiarVista('pagos')}>
          💰 Pagos
        </button>
        <button className={vista === 'historial' ? 'active' : ''} onClick={() => cambiarVista('historial')}>
          📜 Historial
        </button>
        <button className={vista === 'notificaciones' ? 'active' : ''} onClick={() => cambiarVista('notificaciones')}>
          📱 Notificaciones
        </button>

        <div className="crm-nav-phone" style={{ marginTop: 'auto', padding: '10px' }}>
          <TwilioPhone identity="admin_crm" />
        </div>
      </div>

      {/* Mensajes */}
      {mensaje && (
        <div className={`crm-mensaje ${mensajeTipo}`}>
          {mensajeTipo === 'success' && '✅ '}
          {mensajeTipo === 'error' && '❌ '}
          {mensajeTipo === 'info' && 'ℹ️ '}
          {mensaje}
        </div>
      )}

      {loading && <div className="crm-loading">⏳ Cargando...</div>}

      {/* ==================== CREAR AGENTE VOZ ==================== */}
      {vista === 'notificaciones' && subVista === 'crear-agente' && (
        <div className="absolute inset-0 z-50 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          <CreateVoiceAgent
            agenteAEditar={agenteAEditar}
            onBack={() => {
              setVista('notificaciones');
              setSubVista(null);
              setAgenteAEditar(null);
              cargarAgentesVoz(); // Recargar tras crear/editar
            }}
          />
        </div>
      )}

      {/* ==================== DASHBOARD ==================== */}
      {vista === 'dashboard' && dashboard && (
        <div className="crm-dashboard">
          <h2>📊 Dashboard CRM</h2>

          <div className="dashboard-stats">
            <div className="stat-card prospectos" onClick={() => cambiarVista('prospectos')}>
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <span className="stat-number">{dashboard.prospectos.total}</span>
                <span className="stat-label">Prospectos</span>
              </div>
              <div className="stat-detail">
                {dashboard.pendientes.prospectosPorContactar} por contactar
              </div>
            </div>

            <div className="stat-card clientes" onClick={() => cambiarVista('clientes')}>
              <div className="stat-icon">🧑‍💼</div>
              <div className="stat-info">
                <span className="stat-number">{dashboard.clientes.activos}</span>
                <span className="stat-label">Clientes Activos</span>
              </div>
              <div className="stat-detail">
                {formatMoney(dashboard.clientes.ingresosMensuales.USD)}/mes
              </div>
            </div>

            <div className="stat-card pagos" onClick={() => cambiarVista('pagos')}>
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <span className="stat-number">{dashboard.pagos.pagosMes}</span>
                <span className="stat-label">Pagos del Mes</span>
              </div>
              <div className="stat-detail">
                {formatMoney(dashboard.pagos.totalRecibidoMes)} recibidos
              </div>
            </div>

            <div className="stat-card pendientes" onClick={() => cambiarVista('pagos')}>
              <div className="stat-icon">⏳</div>
              <div className="stat-info">
                <span className="stat-number">{dashboard.pendientes.pagosPorMatch + dashboard.pendientes.pagosPorIMSS}</span>
                <span className="stat-label">Pendientes</span>
              </div>
              <div className="stat-detail">
                {dashboard.pendientes.pagosPorMatch} match | {dashboard.pendientes.pagosPorIMSS} IMSS
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-section">
              <h3>📈 Resumen del Mes</h3>
              <div className="resumen-grid">
                <div className="resumen-item">
                  <span className="resumen-label">Total Recibido</span>
                  <span className="resumen-value success">{formatMoney(dashboard.pagos.totalRecibidoMes)}</span>
                </div>
                <div className="resumen-item">
                  <span className="resumen-label">Pagado al IMSS</span>
                  <span className="resumen-value">{formatMoney(dashboard.pagos.totalPagadoIMSSMes)}</span>
                </div>
                <div className="resumen-item">
                  <span className="resumen-label">Por Pagar IMSS</span>
                  <span className="resumen-value warning">{formatMoney(dashboard.pagos.totalRecibidoMes - dashboard.pagos.totalPagadoIMSSMes)}</span>
                </div>
                <div className="resumen-item">
                  <span className="resumen-label">Clientes Pago Pendiente</span>
                  <span className="resumen-value">{dashboard.pendientes.clientesPagoPendiente}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>👥 Prospectos por Estatus</h3>
              <div className="estatus-list">
                {Object.entries(dashboard.prospectos.porEstatus).map(([status, count]) => (
                  <div key={status} className="estatus-item">
                    <span className={`estatus-badge ${status}`}>{status}</span>
                    <span className="estatus-count">{count}</span>
                  </div>
                ))}
                {Object.keys(dashboard.prospectos.porEstatus).length === 0 && (
                  <p className="empty-text">Sin prospectos</p>
                )}
              </div>
            </div>

            <div className="dashboard-section">
              <h3>🏷️ Clientes por Modalidad</h3>
              <div className="modalidad-list">
                {Object.entries(dashboard.clientes.porModalidad).map(([mod, count]) => (
                  <div key={mod} className="modalidad-item">
                    <span className="modalidad-badge">Mod {mod}</span>
                    <span className="modalidad-count">{count} clientes</span>
                  </div>
                ))}
                {Object.keys(dashboard.clientes.porModalidad).length === 0 && (
                  <p className="empty-text">Sin clientes</p>
                )}
              </div>
            </div>

            <div className="dashboard-section">
              <h3>💳 Pagos por Metodo</h3>
              <div className="metodo-list">
                {Object.entries(dashboard.pagos.porMetodo).map(([metodo, count]) => (
                  <div key={metodo} className="metodo-item">
                    <span className="metodo-icon">
                      {metodo === 'paypal' && '💳'}
                      {metodo === 'zelle' && '🏦'}
                      {metodo === 'westernUnion' && '💵'}
                      {metodo === 'venmo' && '📱'}
                      {metodo === 'transferenciaMX' && '🇲🇽'}
                    </span>
                    <span className="metodo-nombre">{metodo}</span>
                    <span className="metodo-count">{count}</span>
                  </div>
                ))}
                {Object.keys(dashboard.pagos.porMetodo).length === 0 && (
                  <p className="empty-text">Sin pagos</p>
                )}
              </div>
            </div>
          </div>

          {/* Acciones rapidas */}
          <div className="acciones-rapidas">
            <h3>⚡ Acciones Rapidas</h3>
            <div className="acciones-grid">
              <button onClick={() => { cambiarVista('prospectos'); setSubVista('nuevo'); }}>
                ➕ Nuevo Prospecto
              </button>
              <button onClick={() => { cambiarVista('pagos'); setSubVista('nuevo-pago'); }}>
                💰 Registrar Pago
              </button>
              <button onClick={() => cambiarVista('notificaciones')}>
                📱 Ver Recordatorios
              </button>
              <button onClick={() => cambiarVista('historial')}>
                📜 Ver Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROSPECTOS ==================== */}
      {vista === 'prospectos' && !subVista && (
        <div className="crm-prospectos">
          <div className="vista-header">
            <h2>👥 Gestion de Prospectos</h2>
            <button className="btn-primary" onClick={() => setSubVista('nuevo')}>
              ➕ Nuevo Prospecto
            </button>
          </div>

          {/* Filtros y busqueda */}
          <div className="filtros-bar">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, NSS, email, telefono..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="busqueda-input"
            />
            <select value={filtros.estatus} onChange={(e) => setFiltros(f => ({ ...f, estatus: e.target.value }))}>
              <option value="">Todos los estatus</option>
              <option value="nuevo">Nuevo</option>
              <option value="interesado">Interesado</option>
              <option value="sin_respuesta">Sin respuesta</option>
              <option value="no_interesado">No interesado</option>
              <option value="convertido">Convertido</option>
            </select>
            <select value={filtros.modalidad} onChange={(e) => setFiltros(f => ({ ...f, modalidad: e.target.value }))}>
              <option value="">Todas las modalidades</option>
              <option value="40">Modalidad 40</option>
              <option value="10">Modalidad 10</option>
              <option value="33">Modalidad 33</option>
              <option value="hogar">Trabajadoras Hogar</option>
            </select>
            <button onClick={cargarProspectos}>Filtrar</button>
          </div>

          {/* Lista de prospectos */}
          <div className="prospectos-grid">
            {filtrarItems(prospectos).map(p => (
              <div key={p.id} className={`prospecto-card ${p.estatus}`} onClick={() => cargarProspectoDetalle(p.id)}>
                <div className="card-header">
                  <span className="card-nombre">{p.nombreCompleto}</span>
                  <span className={`estatus-badge ${p.estatus}`}>{p.estatus}</span>
                </div>
                <div className="card-body">
                  <div className="info-row">
                    <span>📱 {p.whatsapp || p.telefonoUSA || 'Sin telefono'}</span>
                  </div>
                  <div className="info-row">
                    <span>📧 {p.email || 'Sin email'}</span>
                  </div>
                  <div className="info-row">
                    <span>🔢 NSS: {p.nss || 'Pendiente'}</span>
                    <span>🏷️ Mod {p.modalidadInteres}</span>
                  </div>
                  <div className="info-row muted">
                    <span>📅 {formatFecha(p.fechaRegistro)}</span>
                    <span>📞 {p.intentosContacto} contactos</span>
                  </div>
                </div>
              </div>
            ))}
            {prospectos.length === 0 && (
              <p className="empty-state">No hay prospectos registrados</p>
            )}
          </div>
        </div>
      )}

      {/* Formulario nuevo prospecto */}
      {vista === 'prospectos' && subVista === 'nuevo' && (
        <div className="crm-form-view">
          <div className="vista-header">
            <button className="btn-back" onClick={() => setSubVista(null)}>← Volver</button>
            <h2>➕ Nuevo Prospecto</h2>
          </div>

          <form onSubmit={crearProspecto} className="crm-form">
            <div className="form-section">
              <h3>Datos Personales</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input
                    type="text"
                    value={nuevoProspecto.nombreCompleto}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, nombreCompleto: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CURP</label>
                  <input
                    type="text"
                    value={nuevoProspecto.curp}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, curp: e.target.value.toUpperCase() }))}
                    maxLength={18}
                    placeholder="18 caracteres"
                  />
                </div>
                <div className="form-group">
                  <label>NSS</label>
                  <input
                    type="text"
                    value={nuevoProspecto.nss}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, nss: e.target.value.replace(/\D/g, '') }))}
                    maxLength={11}
                    placeholder="11 digitos"
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={nuevoProspecto.fechaNacimiento}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, fechaNacimiento: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Contacto</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Telefono USA</label>
                  <input
                    type="tel"
                    value={nuevoProspecto.telefonoUSA}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, telefonoUSA: e.target.value }))}
                    placeholder="+1 555 123 4567"
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input
                    type="tel"
                    value={nuevoProspecto.whatsapp}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="+1 555 123 4567"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={nuevoProspecto.email}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Servicio</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Modalidad de Interes</label>
                  <select
                    value={nuevoProspecto.modalidadInteres}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, modalidadInteres: e.target.value }))}
                  >
                    <option value="40">Modalidad 40 (Pension)</option>
                    <option value="10">Modalidad 10 (Independiente)</option>
                    <option value="33">Modalidad 33 (Salud Familiar)</option>
                    <option value="hogar">Trabajadoras del Hogar</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Origen del Contacto</label>
                  <select
                    value={nuevoProspecto.origen}
                    onChange={(e) => setNuevoProspecto(p => ({ ...p, origen: e.target.value }))}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="llamada">Llamada</option>
                    <option value="referido">Referido</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="form-group full-width">
                <label>Notas</label>
                <textarea
                  value={nuevoProspecto.notas}
                  onChange={(e) => setNuevoProspecto(p => ({ ...p, notas: e.target.value }))}
                  rows={3}
                  placeholder="Informacion adicional..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setSubVista(null)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Crear Prospecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detalle de prospecto */}
      {vista === 'prospectos' && subVista === 'detalle-prospecto' && prospectoSeleccionado && (
        <div className="crm-detalle">
          <div className="vista-header">
            <button className="btn-back" onClick={() => { setSubVista(null); setProspectoSeleccionado(null); }}>← Volver</button>
            <h2>👤 {prospectoSeleccionado.nombreCompleto}</h2>
            <span className={`estatus-badge large ${prospectoSeleccionado.estatus}`}>{prospectoSeleccionado.estatus}</span>
          </div>

          <div className="detalle-grid">
            <div className="detalle-section">
              <h3>📋 Datos Personales</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">CURP</span>
                  <span className="dato-value">{prospectoSeleccionado.curp || 'No registrado'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">NSS</span>
                  <span className="dato-value">{prospectoSeleccionado.nss || 'No registrado'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Fecha Nacimiento</span>
                  <span className="dato-value">{formatFecha(prospectoSeleccionado.fechaNacimiento)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Sexo</span>
                  <span className="dato-value">{prospectoSeleccionado.sexo || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="detalle-section">
              <h3>📱 Contacto</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Telefono USA</span>
                  <span className="dato-value">{prospectoSeleccionado.telefonoUSA || 'N/A'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">WhatsApp</span>
                  <span className="dato-value clickable">
                    {prospectoSeleccionado.whatsapp || 'N/A'}
                    {prospectoSeleccionado.whatsapp && (
                      <a href={`https://wa.me/${prospectoSeleccionado.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"> 📱</a>
                    )}
                  </span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Email</span>
                  <span className="dato-value">{prospectoSeleccionado.email || 'N/A'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Canal Preferido</span>
                  <span className="dato-value">{prospectoSeleccionado.canalPreferido}</span>
                </div>
              </div>
            </div>

            <div className="detalle-section">
              <h3>🏷️ Servicio</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Modalidad Interes</span>
                  <span className="dato-value">Modalidad {prospectoSeleccionado.modalidadInteres}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Origen</span>
                  <span className="dato-value">{prospectoSeleccionado.origen}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Fecha Registro</span>
                  <span className="dato-value">{formatFecha(prospectoSeleccionado.fechaRegistro)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Intentos Contacto</span>
                  <span className="dato-value">{prospectoSeleccionado.intentosContacto}</span>
                </div>
              </div>
            </div>

            {/* Historial de contactos */}
            <div className="detalle-section full-width">
              <h3>📞 Historial de Contactos</h3>
              {prospectoSeleccionado.historialContactos && prospectoSeleccionado.historialContactos.length > 0 ? (
                <div className="historial-list">
                  {prospectoSeleccionado.historialContactos.map((c, i) => (
                    <div key={i} className="historial-item">
                      <div className="historial-fecha">{formatFechaHora(c.fecha)}</div>
                      <div className="historial-canal">{c.canal}</div>
                      <div className={`historial-resultado ${c.resultado}`}>{c.resultado}</div>
                      {c.notas && <div className="historial-notas">{c.notas}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Sin historial de contactos</p>
              )}

              {/* Registrar nuevo contacto */}
              <div className="nuevo-contacto">
                <h4>Registrar Contacto</h4>
                <div className="contacto-form">
                  <select id="contacto-canal">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="llamada">Llamada</option>
                    <option value="email">Email</option>
                  </select>
                  <select id="contacto-resultado">
                    <option value="contactado">Contactado</option>
                    <option value="interesado">Interesado</option>
                    <option value="no_contesta">No contesta</option>
                    <option value="no_interesado">No interesado</option>
                  </select>
                  <input type="text" id="contacto-notas" placeholder="Notas..." />
                  <button onClick={() => {
                    const canal = document.getElementById('contacto-canal').value
                    const resultado = document.getElementById('contacto-resultado').value
                    const notas = document.getElementById('contacto-notas').value
                    registrarContacto(prospectoSeleccionado.id, { canal, resultado, notas })
                  }}>Registrar</button>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="detalle-section full-width">
              <h3>📝 Notas</h3>
              {prospectoSeleccionado.notas && prospectoSeleccionado.notas.length > 0 ? (
                <div className="notas-list">
                  {prospectoSeleccionado.notas.map((n, i) => (
                    <div key={i} className="nota-item">
                      <span className="nota-fecha">{formatFechaHora(n.fecha)}</span>
                      <span className="nota-texto">{n.texto}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Sin notas</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="detalle-acciones">
            {prospectoSeleccionado.estatus !== 'convertido' && prospectoSeleccionado.nss && prospectoSeleccionado.curp && (
              <button className="btn-primary" onClick={() => setSubVista('convertir')}>
                🔄 Convertir a Cliente
              </button>
            )}
            {prospectoSeleccionado.whatsapp && (
              <a href={`https://wa.me/${prospectoSeleccionado.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                📱 Abrir WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* Modal convertir a cliente */}
      {vista === 'prospectos' && subVista === 'convertir' && prospectoSeleccionado && (
        <div className="modal-overlay" onClick={() => setSubVista('detalle-prospecto')}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h3>🔄 Convertir a Cliente</h3>
            <p className="modal-subtitle">{prospectoSeleccionado.nombreCompleto} - NSS: {prospectoSeleccionado.nss}</p>

            <div className="form-section">
              <h4>Servicio</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Modalidad</label>
                  <select
                    value={conversionData.modalidad}
                    onChange={(e) => setConversionData(c => ({ ...c, modalidad: e.target.value }))}
                  >
                    <option value="40">Modalidad 40</option>
                    <option value="10">Modalidad 10</option>
                    <option value="33">Modalidad 33</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Salario Registrado (MXN)</label>
                  <input
                    type="number"
                    value={conversionData.salarioRegistrado}
                    onChange={(e) => setConversionData(c => ({ ...c, salarioRegistrado: e.target.value }))}
                    placeholder="Ej: 85000"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Cuotas</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Cuota IMSS Mensual (USD)</label>
                  <input
                    type="number"
                    value={conversionData.cuotaMensual}
                    onChange={(e) => setConversionData(c => ({ ...c, cuotaMensual: parseFloat(e.target.value) }))}
                    placeholder="Ej: 350"
                  />
                </div>
                <div className="form-group">
                  <label>Cuota Servicio (USD)</label>
                  <input
                    type="number"
                    value={conversionData.cuotaServicio}
                    onChange={(e) => setConversionData(c => ({ ...c, cuotaServicio: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>Dia de Corte</label>
                  <input
                    type="number"
                    value={conversionData.fechaCorte}
                    onChange={(e) => setConversionData(c => ({ ...c, fechaCorte: parseInt(e.target.value) }))}
                    min={1}
                    max={28}
                  />
                </div>
              </div>
              <div className="cuota-total">
                <span>Total Mensual:</span>
                <strong>{formatMoney((conversionData.cuotaMensual || 0) + (conversionData.cuotaServicio || 0))}</strong>
              </div>
            </div>

            <div className="form-section">
              <h4>Metodo de Pago</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Metodo Preferido</label>
                  <select
                    value={conversionData.metodoPagoPreferido}
                    onChange={(e) => setConversionData(c => ({ ...c, metodoPagoPreferido: e.target.value }))}
                  >
                    <option value="paypal">PayPal</option>
                    <option value="zelle">Zelle</option>
                    <option value="westernUnion">Western Union</option>
                    <option value="venmo">Venmo</option>
                    <option value="transferenciaMX">Transferencia Mexico</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Email PayPal</label>
                  <input
                    type="email"
                    value={conversionData.datosPago.paypalEmail}
                    onChange={(e) => setConversionData(c => ({ ...c, datosPago: { ...c.datosPago, paypalEmail: e.target.value } }))}
                  />
                </div>
                <div className="form-group">
                  <label>Telefono Zelle</label>
                  <input
                    type="tel"
                    value={conversionData.datosPago.zellePhone}
                    onChange={(e) => setConversionData(c => ({ ...c, datosPago: { ...c.datosPago, zellePhone: e.target.value } }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setSubVista('detalle-prospecto')}>Cancelar</button>
              <button className="btn-primary" onClick={() => convertirACliente(prospectoSeleccionado.id)} disabled={loading}>
                {loading ? 'Convirtiendo...' : '✅ Convertir a Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLIENTES ==================== */}
      {vista === 'clientes' && !subVista && (
        <div className="crm-clientes">
          <div className="vista-header">
            <h2>🧑‍💼 Gestion de Clientes</h2>
          </div>

          {/* Filtros */}
          <div className="filtros-bar">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="busqueda-input"
            />
            <select value={filtros.estatus} onChange={(e) => setFiltros(f => ({ ...f, estatus: e.target.value }))}>
              <option value="">Todos los estatus</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
            </select>
            <select value={filtros.modalidad} onChange={(e) => setFiltros(f => ({ ...f, modalidad: e.target.value }))}>
              <option value="">Todas las modalidades</option>
              <option value="40">Modalidad 40</option>
              <option value="10">Modalidad 10</option>
              <option value="33">Modalidad 33</option>
            </select>
            <button onClick={cargarClientes}>Filtrar</button>
          </div>

          {/* Lista de clientes */}
          <div className="clientes-grid">
            {filtrarItems(clientes).map(c => (
              <div key={c.id} className={`cliente-card ${c.estatusServicio}`} onClick={() => cargarClienteDetalle(c.id)}>
                <div className="card-header">
                  <span className="card-nombre">{c.nombreCompleto}</span>
                  <span className={`estatus-badge ${c.estatusServicio}`}>{c.estatusServicio}</span>
                </div>
                <div className="card-body">
                  <div className="info-row">
                    <span>🔢 NSS: {c.nss}</span>
                    <span>🏷️ Mod {c.modalidad}</span>
                  </div>
                  <div className="info-row highlight">
                    <span>💰 {formatMoney(c.totalMensual)}/mes</span>
                    <span>💳 {c.metodoPagoPreferido}</span>
                  </div>
                  <div className="info-row">
                    <span>📅 Corte: dia {c.fechaCorte}</span>
                    <span className={c.mesActualPagado ? 'success' : 'warning'}>
                      {c.mesActualPagado ? '✅ Pagado' : '⏳ Pendiente'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className={c.vigenciaIMSS?.vigente ? 'success' : 'warning'}>
                      {c.vigenciaIMSS?.vigente ? '✅ Vigente' : '⚠️ Verificar vigencia'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {clientes.length === 0 && (
              <p className="empty-state">No hay clientes registrados</p>
            )}
          </div>
        </div>
      )}

      {/* Detalle de cliente */}
      {vista === 'clientes' && subVista === 'detalle-cliente' && clienteSeleccionado && (
        <div className="crm-detalle">
          <div className="vista-header">
            <button className="btn-back" onClick={() => { setSubVista(null); setClienteSeleccionado(null); }}>← Volver</button>
            <h2>🧑‍💼 {clienteSeleccionado.nombreCompleto}</h2>
            <span className={`estatus-badge large ${clienteSeleccionado.estatusServicio}`}>{clienteSeleccionado.estatusServicio}</span>
          </div>

          <div className="detalle-grid">
            {/* Datos personales */}
            <div className="detalle-section">
              <h3>📋 Datos Personales</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">CURP</span>
                  <span className="dato-value">{clienteSeleccionado.curp}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">NSS</span>
                  <span className="dato-value">{clienteSeleccionado.nss}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Fecha Nacimiento</span>
                  <span className="dato-value">{formatFecha(clienteSeleccionado.fechaNacimiento)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Fecha Alta</span>
                  <span className="dato-value">{formatFecha(clienteSeleccionado.fechaAlta)}</span>
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="detalle-section">
              <h3>📱 Contacto</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Telefono USA</span>
                  <span className="dato-value">{clienteSeleccionado.telefonoUSA || 'N/A'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">WhatsApp</span>
                  <span className="dato-value clickable">
                    {clienteSeleccionado.whatsapp}
                    <a href={`https://wa.me/${clienteSeleccionado.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"> 📱</a>
                  </span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Email</span>
                  <span className="dato-value">{clienteSeleccionado.email || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Servicio */}
            <div className="detalle-section highlight-section">
              <h3>🏷️ Servicio Contratado</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Modalidad</span>
                  <span className="dato-value large">Modalidad {clienteSeleccionado.modalidad}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Salario Registrado</span>
                  <span className="dato-value">{formatMoney(clienteSeleccionado.salarioRegistrado, 'MXN')}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Cuota IMSS</span>
                  <span className="dato-value">{formatMoney(clienteSeleccionado.cuotaIMSS)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Cuota Servicio</span>
                  <span className="dato-value">{formatMoney(clienteSeleccionado.cuotaServicio)}</span>
                </div>
                <div className="dato-item total">
                  <span className="dato-label">Total Mensual</span>
                  <span className="dato-value large">{formatMoney(clienteSeleccionado.totalMensual)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Metodo Pago</span>
                  <span className="dato-value">{clienteSeleccionado.metodoPagoPreferido}</span>
                </div>
              </div>
            </div>

            {/* Ciclo de pago */}
            <div className="detalle-section">
              <h3>📅 Ciclo de Pago</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Dia de Corte</span>
                  <span className="dato-value">Dia {clienteSeleccionado.fechaCorte}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Limite Pago Cliente</span>
                  <span className="dato-value">Dia {clienteSeleccionado.fechaLimitePagoCliente}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Pago IMSS</span>
                  <span className="dato-value">Dia {clienteSeleccionado.fechaPagoIMSS}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Proximo Corte</span>
                  <span className="dato-value">{formatFecha(clienteSeleccionado.proximoCorte)}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Estatus Pago</span>
                  <span className={`dato-value ${clienteSeleccionado.mesActualPagado ? 'success' : 'warning'}`}>
                    {clienteSeleccionado.mesActualPagado ? '✅ Pagado' : '⏳ Pendiente'}
                  </span>
                </div>
              </div>
            </div>

            {/* Vigencia IMSS */}
            <div className="detalle-section">
              <h3>🏥 Vigencia IMSS</h3>
              <div className="datos-grid">
                <div className="dato-item">
                  <span className="dato-label">Estatus</span>
                  <span className={`dato-value ${clienteSeleccionado.vigenciaIMSS?.vigente ? 'success' : 'warning'}`}>
                    {clienteSeleccionado.vigenciaIMSS?.vigente ? '✅ Vigente' : '⚠️ No verificado'}
                  </span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Vigente Hasta</span>
                  <span className="dato-value">{clienteSeleccionado.vigenciaIMSS?.fechaVigenciaHasta || 'N/A'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Clinica</span>
                  <span className="dato-value">{clienteSeleccionado.vigenciaIMSS?.clinicaAsignada || 'N/A'}</span>
                </div>
                <div className="dato-item">
                  <span className="dato-label">Ultima Verificacion</span>
                  <span className="dato-value">{formatFecha(clienteSeleccionado.vigenciaIMSS?.ultimaVerificacion)}</span>
                </div>
              </div>

              {/* Actualizar vigencia */}
              <div className="actualizar-vigencia">
                <h4>Actualizar Vigencia</h4>
                <div className="vigencia-form">
                  <select
                    value={datosVigencia.vigente}
                    onChange={(e) => setDatosVigencia(v => ({ ...v, vigente: e.target.value === 'true' }))}
                  >
                    <option value="true">Vigente</option>
                    <option value="false">No Vigente</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Vigente hasta (ej: 31/03/2026)"
                    value={datosVigencia.fechaVigenciaHasta}
                    onChange={(e) => setDatosVigencia(v => ({ ...v, fechaVigenciaHasta: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder="Clinica asignada"
                    value={datosVigencia.clinicaAsignada}
                    onChange={(e) => setDatosVigencia(v => ({ ...v, clinicaAsignada: e.target.value }))}
                  />
                  <button onClick={() => actualizarVigencia(clienteSeleccionado.id)}>Actualizar</button>
                </div>
              </div>
            </div>

            {/* Historial de pagos */}
            <div className="detalle-section full-width">
              <h3>💰 Historial de Pagos</h3>
              {clienteSeleccionado.historialPagos && clienteSeleccionado.historialPagos.length > 0 ? (
                <div className="pagos-tabla">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Periodo</th>
                        <th>Monto</th>
                        <th>Metodo</th>
                        <th>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clienteSeleccionado.historialPagos.map((p, i) => (
                        <tr key={i}>
                          <td>{formatFecha(p.fecha)}</td>
                          <td>{p.periodo}</td>
                          <td>{formatMoney(p.monto, p.moneda)}</td>
                          <td>{p.metodo}</td>
                          <td><span className={`estatus-badge small ${p.estatus}`}>{p.estatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-text">Sin historial de pagos</p>
              )}
            </div>

            {/* Historial de vigencias */}
            <div className="detalle-section full-width">
              <h3>🏥 Historial de Vigencias</h3>
              {clienteSeleccionado.historialVigencias && clienteSeleccionado.historialVigencias.length > 0 ? (
                <div className="vigencias-lista">
                  {clienteSeleccionado.historialVigencias.map((v, i) => (
                    <div key={i} className="vigencia-item">
                      <span className="vigencia-fecha">{formatFecha(v.fecha)}</span>
                      <span className={`vigencia-estatus ${v.vigente ? 'success' : 'error'}`}>
                        {v.vigente ? '✅ Vigente' : '❌ No vigente'}
                      </span>
                      <span className="vigencia-hasta">Hasta: {v.fechaVigenciaHasta || 'N/A'}</span>
                      <span className="vigencia-clinica">{v.clinicaAsignada || ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Sin historial de vigencias</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="detalle-acciones">
            <button onClick={() => generarMensajeBienvenida(clienteSeleccionado.id)}>
              📋 Copiar Mensaje Bienvenida
            </button>
            {clienteSeleccionado.whatsapp && (
              <a href={`https://wa.me/${clienteSeleccionado.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                📱 Abrir WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* ==================== PAGOS ==================== */}
      {vista === 'pagos' && (
        <div className="crm-pagos">
          <div className="vista-header">
            <h2>💰 Gestion de Pagos</h2>
            <button className="btn-primary" onClick={() => setSubVista('nuevo-pago')}>
              ➕ Registrar Pago
            </button>
          </div>

          {/* Tabs de pagos */}
          <div className="pagos-tabs">
            <button className={!subVista || subVista === 'pendientes-match' ? 'active' : ''} onClick={() => { setSubVista('pendientes-match'); cargarPagosPendientesMatch(); }}>
              ⏳ Pendientes Match ({pagos.length})
            </button>
            <button className={subVista === 'pendientes-imss' ? 'active' : ''} onClick={() => { setSubVista('pendientes-imss'); cargarPagosPendientesIMSS(); }}>
              🏛️ Pendientes IMSS ({pagosPendientesIMSS.length})
            </button>
          </div>

          {/* Formulario nuevo pago */}
          {subVista === 'nuevo-pago' && (
            <div className="crm-section">
              <div className="section-header">
                <h3>➕ Registrar Pago Recibido</h3>
                <button className="btn-close" onClick={() => setSubVista(null)}>✕</button>
              </div>
              <form onSubmit={registrarPago} className="pago-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Metodo de Pago</label>
                    <select
                      value={nuevoPago.metodo}
                      onChange={(e) => setNuevoPago(p => ({ ...p, metodo: e.target.value }))}
                    >
                      <option value="paypal">💳 PayPal</option>
                      <option value="zelle">🏦 Zelle</option>
                      <option value="westernUnion">💵 Western Union</option>
                      <option value="venmo">📱 Venmo</option>
                      <option value="transferenciaMX">🇲🇽 Transferencia MX</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Monto *</label>
                    <input
                      type="number"
                      value={nuevoPago.monto}
                      onChange={(e) => setNuevoPago(p => ({ ...p, monto: e.target.value }))}
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Moneda</label>
                    <select
                      value={nuevoPago.moneda}
                      onChange={(e) => setNuevoPago(p => ({ ...p, moneda: e.target.value }))}
                    >
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nombre Remitente</label>
                    <input
                      type="text"
                      value={nuevoPago.nombreRemitente}
                      onChange={(e) => setNuevoPago(p => ({ ...p, nombreRemitente: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Remitente</label>
                    <input
                      type="email"
                      value={nuevoPago.emailRemitente}
                      onChange={(e) => setNuevoPago(p => ({ ...p, emailRemitente: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Telefono Remitente</label>
                    <input
                      type="tel"
                      value={nuevoPago.telefonoRemitente}
                      onChange={(e) => setNuevoPago(p => ({ ...p, telefonoRemitente: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Referencia</label>
                    <input
                      type="text"
                      value={nuevoPago.referencia}
                      onChange={(e) => setNuevoPago(p => ({ ...p, referencia: e.target.value }))}
                      placeholder="Numero de transaccion"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Nota (NSS, nombre, etc.)</label>
                    <input
                      type="text"
                      value={nuevoPago.notaRemitente}
                      onChange={(e) => setNuevoPago(p => ({ ...p, notaRemitente: e.target.value }))}
                      placeholder="Informacion para identificar al cliente"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => setSubVista(null)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Registrando...' : '💰 Registrar Pago'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista pagos pendientes de match */}
          {(!subVista || subVista === 'pendientes-match') && (
            <div className="pagos-lista">
              {pagos.map(pago => (
                <div key={pago.id} className={`pago-card ${pago.estatusProcesamiento}`}>
                  <div className="pago-header">
                    <span className="pago-monto">{formatMoney(pago.monto, pago.moneda)}</span>
                    <span className="pago-metodo">{pago.metodo}</span>
                    <span className={`pago-estatus ${pago.estatusProcesamiento}`}>
                      {pago.estatusProcesamiento === 'matched_pendiente_confirmacion' ? '🔗 Match pendiente' : '⏳ Sin match'}
                    </span>
                  </div>
                  <div className="pago-body">
                    <div className="pago-info">
                      <span>📅 {formatFecha(pago.fecha)}</span>
                      <span>👤 {pago.nombreRemitente || 'Sin nombre'}</span>
                      <span>📧 {pago.emailRemitente || 'Sin email'}</span>
                    </div>
                    {pago.notaRemitente && (
                      <div className="pago-nota">📝 {pago.notaRemitente}</div>
                    )}

                    {pago.matched && pago.candidatosMatch && pago.candidatosMatch[0] && (
                      <div className="pago-match-info">
                        <div className="match-header">
                          <span className="match-icon">🔗</span>
                          <span className="match-confidence">{pago.matchConfidencia}% confianza</span>
                          <span className="match-tipo">({pago.matchedPor})</span>
                        </div>
                        <div className="match-cliente">
                          <span className="cliente-nombre">{pago.candidatosMatch[0].nombreCompleto}</span>
                          <span className="cliente-nss">NSS: {pago.candidatosMatch[0].nss}</span>
                        </div>
                        <div className="match-razones">
                          {pago.candidatosMatch[0].razones.map((r, i) => (
                            <span key={i} className="razon-badge">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!pago.matched && pago.candidatosMatch && pago.candidatosMatch.length > 0 && (
                      <div className="candidatos-section">
                        <h4>Posibles Clientes:</h4>
                        {pago.candidatosMatch.map((c, i) => (
                          <div key={i} className="candidato-item">
                            <div className="candidato-info">
                              <span className="candidato-nombre">{c.nombreCompleto}</span>
                              <span className="candidato-nss">NSS: {c.nss}</span>
                              <span className="candidato-confidence">{c.confidencia}%</span>
                            </div>
                            <button className="btn-small" onClick={() => matchManual(pago.id, c.clienteId)}>
                              Vincular
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pago-actions">
                    {pago.estatusProcesamiento === 'matched_pendiente_confirmacion' && (
                      <button className="btn-success" onClick={() => confirmarPago(pago.id)}>
                        ✅ Confirmar Match
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pagos.length === 0 && (
                <p className="empty-state">No hay pagos pendientes de match</p>
              )}
            </div>
          )}

          {/* Lista pagos pendientes de pago IMSS */}
          {subVista === 'pendientes-imss' && (
            <div className="pagos-lista">
              {pagosPendientesIMSS.map(pago => (
                <div key={pago.id} className="pago-card imss-pendiente">
                  <div className="pago-header">
                    <span className="pago-monto">{formatMoney(pago.monto, pago.moneda)}</span>
                    <span className="pago-metodo">{pago.metodo}</span>
                    <span className="pago-estatus warning">🏛️ Pendiente IMSS</span>
                  </div>
                  <div className="pago-body">
                    <div className="pago-info">
                      <span>📅 Recibido: {formatFecha(pago.fecha)}</span>
                      <span>✅ Confirmado: {formatFecha(pago.fechaConfirmacion)}</span>
                    </div>
                    {pago.candidatosMatch && pago.candidatosMatch[0] && (
                      <div className="cliente-info">
                        <span className="cliente-nombre">{pago.candidatosMatch[0].nombreCompleto}</span>
                        <span className="cliente-nss">NSS: {pago.candidatosMatch[0].nss}</span>
                      </div>
                    )}
                  </div>
                  <div className="pago-actions">
                    <button className="btn-primary" onClick={() => setPagoSeleccionado(pago)}>
                      🏛️ Registrar Pago IMSS
                    </button>
                  </div>
                </div>
              ))}
              {pagosPendientesIMSS.length === 0 && (
                <p className="empty-state">No hay pagos pendientes de pago al IMSS</p>
              )}
            </div>
          )}

          {/* Modal registrar pago IMSS */}
          {pagoSeleccionado && (
            <div className="modal-overlay" onClick={() => setPagoSeleccionado(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>🏛️ Registrar Pago al IMSS</h3>
                <p className="modal-subtitle">Pago recibido: {formatMoney(pagoSeleccionado.monto, pagoSeleccionado.moneda)}</p>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Referencia IMSS</label>
                    <input
                      type="text"
                      value={datosIMSS.referenciaIMSS}
                      onChange={(e) => setDatosIMSS(d => ({ ...d, referenciaIMSS: e.target.value }))}
                      placeholder="Numero de referencia"
                    />
                  </div>
                  <div className="form-group">
                    <label>Linea de Captura</label>
                    <input
                      type="text"
                      value={datosIMSS.lineaCaptura}
                      onChange={(e) => setDatosIMSS(d => ({ ...d, lineaCaptura: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Banco</label>
                    <select
                      value={datosIMSS.banco}
                      onChange={(e) => setDatosIMSS(d => ({ ...d, banco: e.target.value }))}
                    >
                      <option value="BBVA">BBVA</option>
                      <option value="Banamex">Banamex</option>
                      <option value="Santander">Santander</option>
                      <option value="Banorte">Banorte</option>
                      <option value="HSBC">HSBC</option>
                      <option value="Scotiabank">Scotiabank</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha de Pago</label>
                    <input
                      type="date"
                      value={datosIMSS.fechaPagoIMSS}
                      onChange={(e) => setDatosIMSS(d => ({ ...d, fechaPagoIMSS: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setPagoSeleccionado(null)}>Cancelar</button>
                  <button className="btn-primary" onClick={() => marcarPagadoIMSS(pagoSeleccionado.id)} disabled={loading}>
                    {loading ? 'Registrando...' : '✅ Confirmar Pago IMSS'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== HISTORIAL ==================== */}
      {vista === 'historial' && (
        <div className="crm-historial">
          <div className="vista-header">
            <h2>📜 Historial de Pagos</h2>
          </div>

          {/* Filtros */}
          <div className="filtros-bar">
            <select value={filtros.metodoPago} onChange={(e) => setFiltros(f => ({ ...f, metodoPago: e.target.value }))}>
              <option value="">Todos los metodos</option>
              <option value="paypal">PayPal</option>
              <option value="zelle">Zelle</option>
              <option value="westernUnion">Western Union</option>
              <option value="venmo">Venmo</option>
              <option value="transferenciaMX">Transferencia MX</option>
            </select>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros(f => ({ ...f, fechaDesde: e.target.value }))}
              placeholder="Desde"
            />
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros(f => ({ ...f, fechaHasta: e.target.value }))}
              placeholder="Hasta"
            />
            <button onClick={cargarHistorialPagos}>Filtrar</button>
          </div>

          {/* Tabla de historial */}
          <div className="historial-tabla">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Metodo</th>
                  <th>Remitente</th>
                  <th>Estatus</th>
                  <th>Pago IMSS</th>
                </tr>
              </thead>
              <tbody>
                {historialPagos.map(p => (
                  <tr key={p.id}>
                    <td>{formatFecha(p.fecha)}</td>
                    <td className="monto">{formatMoney(p.monto, p.moneda)}</td>
                    <td>{p.metodo}</td>
                    <td>{p.nombreRemitente || 'N/A'}</td>
                    <td><span className={`estatus-badge small ${p.estatusProcesamiento}`}>{p.estatusProcesamiento}</span></td>
                    <td>{p.fechaPagoIMSS ? formatFecha(p.fechaPagoIMSS) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historialPagos.length === 0 && (
              <p className="empty-state">No hay pagos en el historial</p>
            )}
          </div>

          {/* Resumen */}
          {historialPagos.length > 0 && (
            <div className="historial-resumen">
              <div className="resumen-item">
                <span>Total Pagos:</span>
                <strong>{historialPagos.length}</strong>
              </div>
              <div className="resumen-item">
                <span>Monto Total:</span>
                <strong>{formatMoney(historialPagos.reduce((sum, p) => sum + p.monto, 0))}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== NOTIFICACIONES ==================== */}
      {vista === 'notificaciones' && !subVista && (
        <div className="crm-notificaciones">
          <div className="vista-header">
            <h2>📱 Notificaciones y Recordatorios</h2>
            <button
              className="btn-primary"
              onClick={() => { setAgenteAEditar(null); setSubVista('crear-agente'); }}
              style={{ backgroundColor: '#2563eb' }}
            >
              🤖💼 Crear Agente de Voz
            </button>
          </div>

          {/* Agentes de Voz (IA) */}
          <div className="notif-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🤖 Agentes de Voz Activos ({agentesVoz.length})</h3>
            <div className="clientes-pendientes-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {agentesVoz.map(agente => (
                <div key={agente.id} className="cliente-pendiente-card bg-slate-800 border !border-slate-700">
                  <div className="cliente-info">
                    <span className="cliente-nombre flex items-center gap-2">
                      {agente.nombre}
                      {agente.telefonoActivo ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">{agente.telefono || 'Sin asigar'}</span>
                  </div>
                  <div className="cliente-meta mt-2 mb-3 !text-[11px] text-slate-300">
                    <p className="line-clamp-2">{agente.descripcion}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="bg-slate-700 px-2 py-0.5 rounded text-[10px]">{agente.voz}</span>
                      <span className="bg-slate-700 px-2 py-0.5 rounded text-[10px]">{agente.idioma}</span>
                    </div>
                  </div>
                  <div className="cliente-actions flex justify-end gap-2 border-t border-slate-700 pt-3">
                    <button
                      onClick={() => { setAgenteAEditar(agente); setSubVista('crear-agente'); }}
                      className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                    >
                      <span className="material-icons-outlined text-sm">edit</span> Editar
                    </button>
                    <button
                      onClick={() => eliminarAgenteVoz(agente.id)}
                      className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 ml-3"
                    >
                      <span className="material-icons-outlined text-sm">delete</span> Eliminar
                    </button>
                  </div>
                </div>
              ))}
              {agentesVoz.length === 0 && (
                <p className="empty-state text-slate-500">No hay agentes de voz creados.</p>
              )}
            </div>
          </div>

          {/* Recordatorios de pago */}
          <div className="notif-section">
            <h3>⏰ Recordatorios de Pago ({recordatorios.length})</h3>
            <div className="recordatorios-grid">
              {recordatorios.map((r, i) => (
                <div key={i} className={`recordatorio-card ${r.prioridad}`}>
                  <div className="recordatorio-header">
                    <span className="recordatorio-nombre">{r.nombreCliente}</span>
                    <span className={`prioridad-badge ${r.prioridad}`}>
                      {r.prioridad === 'urgente' && '🔴 Urgente'}
                      {r.prioridad === 'alta' && '🟠 Alta'}
                      {r.prioridad === 'normal' && '🟢 Normal'}
                    </span>
                  </div>
                  <div className="recordatorio-info">
                    <span>📱 {r.whatsapp}</span>
                    <span className={r.diasRestantes < 0 ? 'vencido' : ''}>
                      {r.diasRestantes < 0
                        ? `⚠️ Vencido hace ${Math.abs(r.diasRestantes)} dias`
                        : `📅 Faltan ${r.diasRestantes} dias`}
                    </span>
                  </div>
                  <div className="recordatorio-mensaje">
                    <pre>{r.mensaje}</pre>
                  </div>
                  <div className="recordatorio-actions">
                    <button onClick={() => { navigator.clipboard.writeText(r.mensaje); mostrarMensaje('Mensaje copiado', 'success'); }}>
                      📋 Copiar
                    </button>
                    <a
                      href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(r.mensaje)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp"
                    >
                      📱 Enviar WhatsApp
                    </a>
                  </div>
                </div>
              ))}
              {recordatorios.length === 0 && (
                <p className="empty-state">No hay recordatorios pendientes</p>
              )}
            </div>
          </div>

          {/* Clientes con pago pendiente */}
          <div className="notif-section">
            <h3>💰 Clientes con Pago Pendiente ({clientesPagoPendiente.length})</h3>
            <div className="clientes-pendientes-grid">
              {clientesPagoPendiente.map(c => (
                <div key={c.id} className="cliente-pendiente-card">
                  <div className="cliente-info">
                    <span className="cliente-nombre">{c.nombreCompleto}</span>
                    <span className="cliente-monto">{formatMoney(c.totalMensual)}</span>
                  </div>
                  <div className="cliente-meta">
                    <span>📅 Corte: {formatFecha(c.proximoCorte)}</span>
                    <span>📱 {c.whatsapp}</span>
                  </div>
                  <div className="cliente-actions">
                    <a
                      href={`https://wa.me/${c.whatsapp?.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp small"
                    >
                      📱 WhatsApp
                    </a>
                  </div>
                </div>
              ))}
              {clientesPagoPendiente.length === 0 && (
                <p className="empty-state">Todos los clientes estan al dia</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CRM

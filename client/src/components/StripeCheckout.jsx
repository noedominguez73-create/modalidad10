/**
 * StripeCheckout.jsx — Formulario de pago con tarjeta usando Stripe Elements
 *
 * Props:
 *   monto       {number}   — Monto en la unidad base (ej: 15.00 para $15 USD)
 *   moneda      {string}   — 'usd' | 'mxn'
 *   descripcion {string}   — Ej: "Servicio IMSS - Juan Pérez"
 *   metadata    {object}   — Datos extra para Stripe (clienteId, etc.)
 *   onExito     {function} — Callback cuando el pago se confirma
 *   onCancelar  {function} — Callback para volver al formulario anterior
 */

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    Elements,
    CardElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js'

// ─── Formulario interno (dentro del proveedor Elements) ───────────────────────
function FormularioPago({ monto, moneda, descripcion, metadata, onExito, onCancelar }) {
    const stripe = useStripe()
    const elements = useElements()
    const [procesando, setProcesando] = useState(false)
    const [error, setError] = useState('')
    const [exito, setExito] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!stripe || !elements) return

        setProcesando(true)
        setError('')

        try {
            // 1. Crear PaymentIntent en el servidor
            const res = await fetch('/api/stripe/payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto, moneda, descripcion, metadata })
            })
            const data = await res.json()

            if (!data.success) {
                setError(data.error || 'Error creando el pago')
                setProcesando(false)
                return
            }

            // 2. Confirmar el pago con la tarjeta
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
                data.clientSecret,
                {
                    payment_method: {
                        card: elements.getElement(CardElement),
                        billing_details: { name: metadata?.nombreCliente || 'Cliente IMSS' }
                    }
                }
            )

            if (stripeError) {
                setError(stripeError.message)
            } else if (paymentIntent.status === 'succeeded') {
                setExito(true)
                if (onExito) onExito({ paymentIntentId: paymentIntent.id, monto, moneda })
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message)
        }

        setProcesando(false)
    }

    if (exito) {
        return (
            <div style={styles.exitoContainer}>
                <div style={styles.exitoIcono}>✅</div>
                <h3 style={styles.exitoTitulo}>¡Pago exitoso!</h3>
                <p style={styles.exitoDesc}>
                    Se procesó <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda.toUpperCase() }).format(monto)}</strong> correctamente.
                </p>
                <button style={styles.btnSecundario} onClick={onCancelar}>Cerrar</button>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            {/* Monto a cobrar */}
            <div style={styles.montoDisplay}>
                <span style={styles.montoLabel}>Total a cobrar</span>
                <span style={styles.montoCantidad}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda.toUpperCase() }).format(monto)}
                </span>
                {descripcion && <span style={styles.montoDesc}>{descripcion}</span>}
            </div>

            {/* Separador */}
            <div style={styles.separador}>💳 Datos de tarjeta</div>

            {/* Campo de Stripe */}
            <div style={styles.cardElementWrapper}>
                <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>

            {/* Error */}
            {error && (
                <div style={styles.errorBox}>
                    ❌ {error}
                </div>
            )}

            {/* Botones */}
            <div style={styles.botonesRow}>
                <button type="button" onClick={onCancelar} style={styles.btnCancelar} disabled={procesando}>
                    Cancelar
                </button>
                <button type="submit" style={styles.btnPagar} disabled={!stripe || procesando}>
                    {procesando ? '⏳ Procesando...' : `Cobrar ${new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda.toUpperCase() }).format(monto)}`}
                </button>
            </div>

            <p style={styles.seguridad}>🔒 Pago seguro procesado por Stripe</p>
        </form>
    )
}

// ─── Wrapper con carga lazy de Stripe ────────────────────────────────────────
export default function StripeCheckout(props) {
    const [stripePromise, setStripePromise] = useState(null)
    const [cargando, setCargando] = useState(true)
    const [errorConfig, setErrorConfig] = useState('')

    useEffect(() => {
        fetch('/api/stripe/config')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.publishableKey) {
                    setStripePromise(loadStripe(data.publishableKey))
                } else {
                    setErrorConfig('Stripe no está configurado. Verifica las variables de entorno.')
                }
                setCargando(false)
            })
            .catch(() => {
                setErrorConfig('Error conectando con el servidor de pagos.')
                setCargando(false)
            })
    }, [])

    if (cargando) return <div style={styles.loading}>⏳ Cargando pasarela de pago...</div>
    if (errorConfig) return <div style={styles.errorBox}>⚠️ {errorConfig}</div>

    return (
        <Elements stripe={stripePromise} options={{ locale: 'es' }}>
            <FormularioPago {...props} />
        </Elements>
    )
}

// ─── Estilos del CardElement ──────────────────────────────────────────────────
const CARD_ELEMENT_OPTIONS = {
    style: {
        base: {
            fontSize: '16px',
            color: '#e2e8f0',
            fontFamily: 'Inter, system-ui, sans-serif',
            '::placeholder': { color: '#64748b' },
            iconColor: '#7c3aed'
        },
        invalid: { color: '#ef4444', iconColor: '#ef4444' }
    },
    hidePostalCode: false
}

// ─── Estilos inline (compatibles con el CSS existente del CRM) ────────────────
const styles = {
    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    montoDisplay: {
        background: 'rgba(124,58,237,0.15)',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    montoLabel: { fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
    montoCantidad: { fontSize: '28px', fontWeight: '700', color: '#a78bfa' },
    montoDesc: { fontSize: '13px', color: '#94a3b8' },
    separador: { fontSize: '13px', color: '#64748b', fontWeight: '600', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
    cardElementWrapper: {
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '14px 16px'
    },
    errorBox: {
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#fca5a5',
        fontSize: '14px'
    },
    botonesRow: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
    btnPagar: {
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        flex: 1
    },
    btnCancelar: {
        background: 'rgba(255,255,255,0.05)',
        color: '#94a3b8',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '10px 16px',
        fontWeight: '500',
        fontSize: '14px',
        cursor: 'pointer'
    },
    btnSecundario: {
        background: 'rgba(255,255,255,0.08)',
        color: '#e2e8f0',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '10px 20px',
        fontWeight: '500',
        cursor: 'pointer',
        marginTop: '8px'
    },
    seguridad: { textAlign: 'center', fontSize: '12px', color: '#475569', margin: 0 },
    loading: { textAlign: 'center', color: '#94a3b8', padding: '24px' },
    exitoContainer: { textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    exitoIcono: { fontSize: '48px' },
    exitoTitulo: { color: '#4ade80', margin: 0, fontSize: '20px' },
    exitoDesc: { color: '#94a3b8', margin: 0 }
}

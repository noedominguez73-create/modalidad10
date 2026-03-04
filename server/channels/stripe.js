/**
 * STRIPE — Canal de pagos con tarjeta
 * Rutas registradas en index.js:
 *   POST /api/stripe/webhook        (express.raw — ANTES del json middleware)
 *   POST /api/stripe/payment-intent
 *   GET  /api/stripe/config
 */

import Stripe from 'stripe';
import { obtenerStripe } from '../settings.js';

// Instancia lazy de Stripe (se inicializa al primer uso)
let stripeInstance = null;

function getStripe() {
    if (!stripeInstance) {
        const { secretKey } = obtenerStripe();
        if (!secretKey) throw new Error('STRIPE_SECRET_KEY no configurada');
        stripeInstance = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' });
    }
    return stripeInstance;
}

// ─── Crear PaymentIntent ──────────────────────────────────────────────────────
export async function crearPaymentIntent(req, res) {
    try {
        const { monto, moneda = 'usd', descripcion = 'Servicio IMSS', metadata = {} } = req.body;

        if (!monto || isNaN(monto) || Number(monto) <= 0) {
            return res.status(400).json({ success: false, error: 'Monto inválido' });
        }

        // Stripe maneja los montos en centavos
        const montoCentavos = Math.round(Number(monto) * 100);

        const paymentIntent = await getStripe().paymentIntents.create({
            amount: montoCentavos,
            currency: moneda.toLowerCase(),
            description: descripcion,
            metadata: {
                ...metadata,
                sistema: 'asesoria-imss-crm',
                fechaCreacion: new Date().toISOString()
            },
            automatic_payment_methods: { enabled: true }
        });

        console.log(`💳 [Stripe] PaymentIntent creado: ${paymentIntent.id} — ${moneda.toUpperCase()} ${monto}`);

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });

    } catch (err) {
        console.error('[Stripe] Error creando PaymentIntent:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

// ─── Config pública para el frontend ─────────────────────────────────────────
export function obtenerConfig(req, res) {
    const { publishableKey } = obtenerStripe();
    if (!publishableKey) {
        return res.status(503).json({ success: false, error: 'Stripe no configurado (falta STRIPE_PUBLISHABLE_KEY)' });
    }
    res.json({ success: true, publishableKey });
}

// ─── Webhook — DEBE registrarse con express.raw() ────────────────────────────
export async function procesarWebhook(req, res) {
    const { webhookSecret } = obtenerStripe();
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        if (webhookSecret && sig) {
            // Validación criptográfica (modo producción)
            event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // Sin secret configurado: aceptar sin validar (solo modo test)
            event = JSON.parse(req.body.toString());
            console.warn('[Stripe] ⚠️ Webhook sin validar (configura STRIPE_WEBHOOK_SECRET)');
        }
    } catch (err) {
        console.error('[Stripe] Webhook inválido:', err.message);
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    // Procesar eventos
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const pi = event.data.object;
            console.log(`✅ [Stripe] Pago exitoso: ${pi.id} — ${pi.currency.toUpperCase()} ${(pi.amount / 100).toFixed(2)}`);
            // TODO: Actualizar base de datos del CRM con el pago confirmado
            break;
        }
        case 'payment_intent.payment_failed': {
            const pi = event.data.object;
            console.warn(`❌ [Stripe] Pago fallido: ${pi.id} — ${pi.last_payment_error?.message}`);
            break;
        }
        default:
            console.log(`[Stripe] Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
}

# Plan del Sistema de Gestión de Clientes IMSS - Mexicanos en EE.UU.

## Fecha: 2026-02-22
## Estado: EN PROGRESO

---

## RESUMEN EJECUTIVO

Sistema automatizado con IA para gestionar el pago de cuotas IMSS de mexicanos residentes en Estados Unidos. El sistema maneja todo el ciclo desde la captación del prospecto hasta la verificación de vigencia de derechos.

### Flujo Principal:
```
PROSPECTO → CONTACTO IA → CONTRATACIÓN → PAGO CLIENTE → MATCH PAGO → PAGO IMSS → VERIFICACIÓN VIGENCIA → NOTIFICACIÓN → RENOVACIÓN MENSUAL
```

---

## FASE 1: BASE DE DATOS DE PROSPECTOS Y CLIENTES

### 1.1 Estructura de la Base de Datos

**Archivo:** `database/clientes-prospectos.json`

```json
{
  "prospectos": [
    {
      "id": "UUID",
      "fechaRegistro": "2026-02-22",
      "origen": "referido|facebook|llamada_entrante|whatsapp",

      // DATOS PERSONALES
      "nombreCompleto": "",
      "curp": "",
      "nss": "",
      "fechaNacimiento": "",
      "lugarNacimiento": "",
      "sexo": "",

      // CONTACTO EN EE.UU.
      "telefonoUSA": "+1...",
      "telefonoMexico": "+52...",
      "whatsapp": "+1...",
      "email": "",
      "direccionUSA": {
        "calle": "",
        "ciudad": "",
        "estado": "",
        "zipCode": ""
      },

      // CONTACTO DE EMERGENCIA EN MÉXICO
      "contactoMexico": {
        "nombre": "",
        "telefono": "",
        "parentesco": ""
      },

      // DATOS IMSS
      "modalidadInteres": "10|33|40",
      "semanasActuales": null,
      "ultimoPatron": "",
      "fechaUltimaBaja": "",
      "clinicaAsignada": "",

      // ESTATUS
      "estatus": "nuevo|contactado|interesado|documentos_pendientes|pago_pendiente|activo|pausado|cancelado",
      "fechaUltimoContacto": "",
      "siguienteContacto": "",
      "intentosContacto": 0,
      "canalPreferido": "whatsapp|llamada|email",

      // CONSENTIMIENTOS
      "consentimientoContacto": true,
      "consentimientoWhatsapp": true,
      "consentimientoLlamadas": true,
      "fechaConsentimiento": "",

      // NOTAS
      "notas": [],
      "historialContactos": []
    }
  ],

  "clientes": [
    {
      "id": "UUID",
      "prospectoId": "UUID del prospecto original",
      "fechaAlta": "",

      // DATOS HEREDADOS DEL PROSPECTO
      "nombreCompleto": "",
      "curp": "",
      "nss": "",
      "telefonoUSA": "",
      "whatsapp": "",
      "email": "",

      // SERVICIO CONTRATADO
      "modalidad": "10|33|40",
      "salarioRegistrado": 0,
      "incluirInfonavit": false,
      "zona": "general|frontera",

      // CUOTAS
      "cuotaMensual": 0,
      "cuotaServicio": 0,
      "totalMensual": 0,

      // FECHAS DE CICLO
      "fechaCorte": 15,
      "fechaLimitepagoCliente": 10,
      "fechaPagoIMSS": 17,

      // PAGOS
      "metodoPagoPreferido": "paypal|zelle|western_union|transferencia_mx|otro",
      "datosPago": {
        "paypalEmail": "",
        "zellePhone": "",
        "zelleEmail": "",
        "cuentaMexico": ""
      },

      // ESTATUS DE SERVICIO
      "estatusServicio": "activo|pendiente_pago|pagado_pendiente_imss|vigente|suspendido|cancelado",
      "vigenciaIMSS": {
        "ultimaVerificacion": "",
        "vigente": false,
        "fechaVigenciaHasta": "",
        "capturaVigencia": ""
      },

      // HISTORIAL
      "historialPagos": [],
      "historialRenovaciones": [],
      "historialVigencias": []
    }
  ],

  "pagosRecibidos": [
    {
      "id": "UUID",
      "fecha": "",
      "clienteId": "UUID|null",
      "matched": false,

      // DATOS DEL PAGO
      "metodo": "paypal|zelle|western_union|transferencia",
      "monto": 0,
      "moneda": "USD|MXN",
      "referencia": "",
      "comprobante": "",

      // IDENTIFICACIÓN
      "nombreRemitente": "",
      "emailRemitente": "",
      "telefonoRemitente": "",
      "notaRemitente": "",

      // MATCH
      "matchedPor": "automatico|manual",
      "fechaMatch": "",
      "matchConfidencia": 0,

      // PROCESAMIENTO
      "estatusProcesamiento": "recibido|matched|procesando_imss|pagado_imss|verificado|error",
      "fechaPagoIMSS": "",
      "referenciaIMSS": "",
      "capturaComprobante": ""
    }
  ],

  "verificacionesVigencia": [
    {
      "id": "UUID",
      "clienteId": "UUID",
      "fecha": "",
      "nss": "",

      // RESULTADO
      "vigente": false,
      "mensaje": "",
      "detalles": {
        "modalidadVigente": "",
        "fechaVigenciaInicio": "",
        "fechaVigenciaFin": "",
        "clinicaAsignada": "",
        "umf": ""
      },

      // EVIDENCIA
      "capturaURL": "",
      "metodoVerificacion": "portal_imss|app_imss|llamada_imss"
    }
  ]
}
```

### 1.2 Campos Adicionales por Agregar

| Campo | Tipo | Descripción |
|-------|------|-------------|
| curp | string(18) | CURP del asegurado |
| nss | string(11) | Número de Seguro Social |
| telefonoUSA | string | Teléfono en Estados Unidos (+1...) |
| whatsapp | string | WhatsApp (puede ser USA o MX) |
| metodoPago | enum | paypal, zelle, western_union, venmo, transferencia_mx |
| datosPago | object | Datos específicos según método |
| estatusPago | enum | pendiente, recibido, matched, procesado |
| vigenciaIMSS | object | Última verificación de vigencia |

---

## FASE 2: FLUJO DE CONTACTO INICIAL

### 2.1 Captación de Prospectos

**Canales de entrada:**
1. WhatsApp Business (número USA)
2. Llamada telefónica entrante
3. Formulario web
4. Referidos de clientes actuales
5. Facebook/Instagram

**Datos mínimos requeridos inicialmente:**
- Nombre
- Teléfono USA o WhatsApp
- Interés en el servicio

### 2.2 Primer Contacto Automatizado (IA)

**Guión de llamada/WhatsApp:**

```
¡Hola [NOMBRE]! 👋

Soy el asistente de [NOMBRE_EMPRESA], servicio de pago de cuotas IMSS para mexicanos en Estados Unidos.

¿Sabías que puedes mantener tu seguro social mexicano vigente aunque vivas en EE.UU.?

✅ Servicio médico en México cuando visites
✅ Acumulas semanas para tu pensión
✅ Protección para tu familia en México

Nosotros nos encargamos de TODO:
• Inscripción en la modalidad correcta
• Pago mensual de tus cuotas
• Verificación de que estés vigente

💵 Aceptamos: PayPal, Zelle, Western Union

¿Te gustaría saber cuánto pagarías mensualmente?
```

### 2.3 Recopilación de Datos

**Flujo de conversación para recopilar datos:**

1. **Datos básicos:**
   - Nombre completo
   - Fecha de nacimiento
   - CURP (si lo tiene)
   - NSS (si lo tiene)

2. **Contacto:**
   - WhatsApp
   - Email
   - Dirección en USA (para comprobantes)

3. **Situación IMSS:**
   - ¿Ha cotizado antes?
   - ¿Tiene semanas cotizadas?
   - ¿Tiene familia en México que quiere asegurar?

4. **Cálculo de cuota:**
   - Ejecutar calculadora según modalidad
   - Mostrar desglose de costos
   - Explicar fechas de pago

---

## FASE 3: MÉTODOS DE PAGO (CLIENTES EN USA)

### 3.1 Métodos Soportados

| Método | Comisión | Tiempo | Popular |
|--------|----------|--------|---------|
| PayPal | 2.9% + $0.30 | Inmediato | ⭐⭐⭐⭐⭐ |
| Zelle | Gratis | Inmediato | ⭐⭐⭐⭐ |
| Venmo | 1.9% + $0.10 | Inmediato | ⭐⭐⭐ |
| Western Union | Variable | 1-3 días | ⭐⭐⭐ |
| Remitly | Variable | 1-2 días | ⭐⭐⭐ |
| Transferencia bancaria MX | ~$5 USD | 1-2 días | ⭐⭐ |

### 3.2 Datos de Cobro por Método

**PayPal:**
```
Email: pagos@tuempresa.com
Nota: Incluir "IMSS-[NOMBRE]-[NSS últimos 4 dígitos]"
```

**Zelle:**
```
Teléfono: +1 (XXX) XXX-XXXX
Email: pagos@tuempresa.com
Nota: "IMSS-[NOMBRE]"
```

**Western Union:**
```
Beneficiario: [NOMBRE EMPRESA]
Ciudad: [CIUDAD], México
Teléfono: +52 XXX XXX XXXX
Referencia: NSS del cliente
```

### 3.3 Estructura de Pagos

```json
{
  "metodoPago": {
    "paypal": {
      "email": "pagos@empresa.com",
      "instrucciones": "Enviar como 'Amigos y familia' para evitar comisión"
    },
    "zelle": {
      "telefono": "+1XXXXXXXXXX",
      "email": "pagos@empresa.com"
    },
    "westernUnion": {
      "beneficiario": "NOMBRE EMPRESA",
      "ciudad": "Ciudad, Estado, México",
      "telefono": "+52XXXXXXXXXX"
    },
    "venmo": {
      "usuario": "@empresa-imss"
    },
    "transferenciaMX": {
      "banco": "BBVA",
      "clabe": "XXXXXXXXXXXX",
      "beneficiario": "NOMBRE EMPRESA"
    }
  }
}
```

---

## FASE 4: MATCH DE PAGOS

### 4.1 Proceso de Match Automático

**Criterios de coincidencia (en orden de prioridad):**

1. **Match exacto por referencia:**
   - Nota del pago contiene NSS
   - Nota contiene nombre exacto

2. **Match por monto + fecha:**
   - Monto coincide con cuota del cliente
   - Fecha dentro de ventana de pago (día 1-15)

3. **Match por datos del remitente:**
   - Email de PayPal = email del cliente
   - Teléfono Zelle = WhatsApp del cliente
   - Nombre remitente ≈ nombre cliente

4. **Match manual:**
   - Si no hay coincidencia automática
   - Notificar para revisión manual

### 4.2 Flujo de Confirmación de Pago

```
[PAGO RECIBIDO]
      ↓
[INTENTO MATCH AUTOMÁTICO]
      ↓
   ¿Match?
   /     \
  SÍ     NO
  ↓       ↓
[Confirmar  [WhatsApp a
 con        pagos sin
 cliente]   match]
  ↓           ↓
[Cliente    [Cliente
 confirma]   responde]
  ↓           ↓
[MATCH COMPLETADO]
      ↓
[Proceder a pago IMSS]
```

### 4.3 Mensaje de Confirmación de Pago

```
¡Hola [NOMBRE]! 💰

Recibimos un pago por $[MONTO] [MONEDA] vía [MÉTODO].

📋 Detalles:
• Referencia: [REF]
• Fecha: [FECHA]

¿Confirmas que este pago es tuyo para el servicio IMSS de [MES]?

Responde:
✅ SÍ - Para proceder con el pago de tus cuotas
❌ NO - Si no reconoces este pago
```

---

## FASE 5: PAGO DE CUOTAS IMSS

### 5.1 Proceso de Pago

Una vez confirmado el match:

1. **Preparar datos de pago:**
   - NSS del cliente
   - Monto de cuota calculada
   - Período a pagar

2. **Acceder al portal IMSS:**
   - Portal SIPARE o
   - Banco autorizado

3. **Realizar pago:**
   - Generar línea de captura
   - Pagar con fondos de la empresa
   - Obtener comprobante

4. **Registrar comprobante:**
   - Guardar PDF/imagen
   - Registrar referencia
   - Actualizar estatus

### 5.2 Estructura del Registro de Pago IMSS

```json
{
  "pagoIMSS": {
    "id": "UUID",
    "clienteId": "UUID",
    "pagoClienteId": "UUID",
    "fecha": "2026-02-17",
    "periodo": "202602",

    "datosIMSS": {
      "nss": "12345678901",
      "modalidad": "10",
      "concepto": "Cuotas obrero-patronales",
      "monto": 2500.00
    },

    "transaccion": {
      "lineaCaptura": "XXXXXXXXXXXX",
      "banco": "BBVA",
      "referenciaBanco": "XXXXX",
      "fechaAplicacion": "2026-02-17"
    },

    "comprobante": {
      "url": "/comprobantes/2026/02/cliente-xxx.pdf",
      "tipo": "pdf",
      "fechaGeneracion": ""
    },

    "estatus": "pagado"
  }
}
```

---

## FASE 6: VERIFICACIÓN DE VIGENCIA

### 6.1 Proceso de Verificación

**Después de pagar las cuotas, verificar vigencia:**

1. **Acceder al portal IMSS:**
   - URL: https://serviciosdigitales.imss.gob.mx/
   - Sección: "Vigencia de Derechos"

2. **Consultar con NSS:**
   - Ingresar NSS del cliente
   - Obtener resultado de vigencia

3. **Capturar evidencia:**
   - Screenshot de la pantalla
   - Guardar como imagen
   - Extraer datos relevantes

4. **Notificar al cliente:**
   - Enviar confirmación por WhatsApp
   - Adjuntar captura de vigencia

### 6.2 Datos a Extraer de Vigencia

```json
{
  "vigencia": {
    "nss": "12345678901",
    "nombre": "NOMBRE DEL ASEGURADO",
    "vigente": true,
    "tipoSeguro": "Incorporación Voluntaria Modalidad 10",
    "fechaInicio": "2026-01-01",
    "fechaFin": "2026-12-31",
    "clinica": {
      "numero": "35",
      "nombre": "UMF 35 MONTERREY",
      "direccion": "..."
    },
    "servicios": [
      "Consulta médica",
      "Hospitalización",
      "Medicamentos",
      "Maternidad"
    ]
  }
}
```

### 6.3 Mensaje de Confirmación de Vigencia

```
🎉 ¡[NOMBRE], tu seguro IMSS está VIGENTE!

✅ NSS: [NSS]
✅ Modalidad: [MODALIDAD]
✅ Vigente hasta: [FECHA]
✅ Clínica asignada: [CLINICA]

📋 Servicios disponibles:
• Consulta médica
• Hospitalización
• Medicamentos
• Urgencias

📎 Adjunto: Comprobante de vigencia

Próximo pago: [FECHA_PROXIMO_PAGO]

¿Tienes alguna duda? Estoy para ayudarte 🤝
```

---

## FASE 7: CICLO DE RENOVACIÓN MENSUAL

### 7.1 Calendario Mensual

| Día | Acción |
|-----|--------|
| 1-5 | Recordatorio de pago próximo |
| 1-10 | Ventana de pago del cliente |
| 10 | Segundo recordatorio si no ha pagado |
| 11-15 | Match de pagos recibidos |
| 15-17 | Pago de cuotas IMSS |
| 18-20 | Verificación de vigencia |
| 20-25 | Notificación de vigencia al cliente |
| 25-30 | Preparación del siguiente ciclo |

### 7.2 Mensajes de Recordatorio

**Día 1-5 (Primer recordatorio):**
```
¡Hola [NOMBRE]! 📅

Se acerca la fecha de tu pago mensual de IMSS.

💰 Monto: $[MONTO] USD
📅 Fecha límite: [DIA 10] de [MES]

Métodos de pago:
• PayPal: pagos@empresa.com
• Zelle: +1XXXXXXXXXX

Recuerda incluir tu nombre en la nota del pago.

¿Alguna duda? Responde este mensaje 👍
```

**Día 10 (Segundo recordatorio):**
```
⚠️ [NOMBRE], tu pago de IMSS vence HOY

Para mantener tu seguro vigente, realiza tu pago antes de las 11:59 PM.

💰 $[MONTO] USD

¿Ya pagaste? Envíame tu comprobante para procesarlo 📎
```

**Día 11+ (No ha pagado):**
```
🔴 [NOMBRE], no hemos recibido tu pago

Tu servicio IMSS puede suspenderse si no recibimos el pago.

¿Necesitas ayuda? ¿Algún problema con el pago?

Opciones:
1️⃣ Pagar ahora
2️⃣ Pausar el servicio este mes
3️⃣ Hablar con un asesor

Responde con el número de tu elección.
```

---

## FASE 8: AUTOMATIZACIÓN CON IA

### 8.1 Funciones del Bot de WhatsApp/Llamadas

1. **Captación:**
   - Responder consultas iniciales
   - Explicar el servicio
   - Calcular cuotas estimadas

2. **Onboarding:**
   - Recopilar datos personales
   - Validar CURP/NSS
   - Explicar métodos de pago

3. **Gestión de pagos:**
   - Enviar recordatorios
   - Confirmar pagos recibidos
   - Resolver dudas de pagos

4. **Verificación:**
   - Notificar vigencia
   - Enviar comprobantes
   - Responder consultas de estatus

5. **Soporte:**
   - Resolver dudas frecuentes
   - Escalar a humano si necesario
   - Gestionar cancelaciones

### 8.2 Integración con Browserless.io

Para automatizar la verificación de vigencia:

```javascript
// Pseudocódigo de verificación
async function verificarVigenciaIMSS(nss) {
  const browser = await conectarBrowserless();

  // Navegar al portal IMSS
  await browser.goto('https://serviciosdigitales.imss.gob.mx/');

  // Ir a vigencia de derechos
  await browser.click('Vigencia de derechos');

  // Ingresar NSS
  await browser.type('#nss', nss);
  await browser.click('#consultar');

  // Esperar resultado
  await browser.waitForSelector('.resultado-vigencia');

  // Capturar pantalla
  const screenshot = await browser.screenshot();

  // Extraer datos
  const datos = await browser.evaluate(() => {
    return {
      vigente: document.querySelector('.vigente').textContent,
      fechaFin: document.querySelector('.fecha-fin').textContent,
      clinica: document.querySelector('.clinica').textContent
    };
  });

  return { screenshot, datos };
}
```

---

## FASE 9: IMPLEMENTACIÓN TÉCNICA

### 9.1 Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `database/clientes-prospectos.json` | Base de datos principal |
| `server/crm/prospectos.js` | Gestión de prospectos |
| `server/crm/clientes.js` | Gestión de clientes |
| `server/crm/pagos.js` | Gestión de pagos |
| `server/crm/match-pagos.js` | Algoritmo de match |
| `server/crm/vigencia.js` | Verificación IMSS |
| `server/crm/notificaciones.js` | Envío de mensajes |
| `server/crm/ciclo-mensual.js` | Cron jobs mensuales |
| `client/src/CRM.jsx` | Interfaz de administración |

### 9.2 Endpoints API

```
POST   /api/crm/prospectos           - Crear prospecto
GET    /api/crm/prospectos           - Listar prospectos
PUT    /api/crm/prospectos/:id       - Actualizar prospecto
POST   /api/crm/prospectos/:id/convertir - Convertir a cliente

POST   /api/crm/clientes             - Crear cliente
GET    /api/crm/clientes             - Listar clientes
GET    /api/crm/clientes/:id         - Detalle cliente
PUT    /api/crm/clientes/:id         - Actualizar cliente

POST   /api/crm/pagos/recibidos      - Registrar pago recibido
GET    /api/crm/pagos/pendientes-match - Pagos sin match
POST   /api/crm/pagos/:id/match      - Match manual
POST   /api/crm/pagos/:id/procesar-imss - Marcar como pagado en IMSS

POST   /api/crm/vigencia/:clienteId  - Verificar vigencia
GET    /api/crm/vigencia/:clienteId  - Historial de vigencias

POST   /api/crm/notificaciones/recordatorio - Enviar recordatorios
POST   /api/crm/notificaciones/vigencia     - Notificar vigencia
```

---

## FASE 10: INTERFAZ DE ADMINISTRACIÓN

### 10.1 Dashboard Principal

```
┌────────────────────────────────────────────────────────────────┐
│  📊 CRM - Sistema de Gestión IMSS                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  RESUMEN DEL DÍA                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 15       │ │ 8        │ │ $2,450   │ │ 3        │          │
│  │ Clientes │ │ Pagos    │ │ Recibido │ │ Pendiente│          │
│  │ Activos  │ │ Hoy      │ │ Hoy      │ │ Match    │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                │
│  ACCIONES RÁPIDAS                                              │
│  [+ Nuevo Prospecto] [Ver Pagos Pendientes] [Verificar Vigencia]│
│                                                                │
│  CLIENTES CON PAGO PENDIENTE                                   │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 👤 Juan Pérez      │ $85 USD │ Vence: Feb 10 │ [Recordar] ││
│  │ 👤 María García    │ $92 USD │ Vence: Feb 10 │ [Recordar] ││
│  │ 👤 Carlos López    │ $85 USD │ Vencido       │ [Llamar]   ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  PAGOS SIN MATCH                                               │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 💰 PayPal │ $85 │ "Juan P IMSS" │ Hoy 10:30 │ [Match]     ││
│  │ 💰 Zelle  │ $92 │ Sin nota      │ Hoy 09:15 │ [Match]     ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 10.2 Flujo de Match Manual

```
┌────────────────────────────────────────────────────────────────┐
│  💰 Match de Pago                                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PAGO RECIBIDO:                                                │
│  ├─ Método: PayPal                                             │
│  ├─ Monto: $85.00 USD                                          │
│  ├─ Fecha: 2026-02-10 10:30                                    │
│  ├─ Remitente: juan.perez@email.com                            │
│  └─ Nota: "IMSS febrero Juan"                                  │
│                                                                │
│  POSIBLES COINCIDENCIAS:                                       │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ⭐ 95% │ Juan Pérez García    │ $85.00 │ juan.p@email.com  ││
│  │ ○  45% │ Juan Carlos Mendoza  │ $92.00 │ jc.mendoza@...    ││
│  │ ○  20% │ Pedro Juan López     │ $85.00 │ pedro.l@...       ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  [Confirmar Match con Juan Pérez García]                       │
│  [Buscar otro cliente...]                                      │
│  [Marcar como no identificado]                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## ORDEN DE IMPLEMENTACIÓN

### Semana 1: Base de Datos y Estructura
- [ ] Crear `database/clientes-prospectos.json`
- [ ] Crear módulo `server/crm/prospectos.js`
- [ ] Crear módulo `server/crm/clientes.js`
- [ ] Crear endpoints básicos CRUD

### Semana 2: Sistema de Pagos
- [ ] Crear módulo `server/crm/pagos.js`
- [ ] Implementar registro de pagos recibidos
- [ ] Crear algoritmo de match `server/crm/match-pagos.js`
- [ ] Endpoints de gestión de pagos

### Semana 3: Verificación y Notificaciones
- [ ] Crear módulo `server/crm/vigencia.js`
- [ ] Integrar con Browserless.io para automatización
- [ ] Crear módulo `server/crm/notificaciones.js`
- [ ] Templates de mensajes WhatsApp

### Semana 4: Interfaz y Automatización
- [ ] Crear `client/src/CRM.jsx`
- [ ] Crear cron jobs `server/crm/ciclo-mensual.js`
- [ ] Integrar con bot de WhatsApp existente
- [ ] Pruebas completas del flujo

---

## NOTAS IMPORTANTES

1. **Seguridad de datos:**
   - CURP y NSS son datos sensibles
   - Encriptar en base de datos
   - No exponer en logs

2. **Métodos de pago:**
   - PayPal Business recomendado (tiene API)
   - Zelle no tiene API oficial (manual)
   - Western Union requiere verificación presencial

3. **Verificación IMSS:**
   - El portal puede cambiar sin aviso
   - Tener plan B (verificación manual)
   - Capturas de pantalla como evidencia

4. **Horarios:**
   - Clientes en diferentes zonas horarias
   - Enviar recordatorios en horario del cliente
   - Portal IMSS: mejor entre 8am-10pm México

5. **Escalamiento:**
   - Iniciar con proceso semi-manual
   - Automatizar gradualmente
   - Mantener opción de intervención humana

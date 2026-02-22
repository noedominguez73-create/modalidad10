/**
 * VALIDADOR DE DOCUMENTOS CON IA
 * Analiza documentos del IMSS usando modelos de visión
 */

import fetch from 'node-fetch';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const UPLOADS_PATH = process.env.UPLOADS_PATH || './uploads';

// Tipos de documentos que podemos validar
export const TIPOS_DOCUMENTO = {
  NSS: {
    nombre: 'Número de Seguro Social',
    descripcion: 'Tarjeta o constancia del NSS',
    datosEsperados: ['nss', 'nombre', 'curp']
  },
  SEMANAS: {
    nombre: 'Reporte de Semanas Cotizadas',
    descripcion: 'Reporte descargado del IMSS Digital',
    datosEsperados: ['semanas_cotizadas', 'semanas_reconocidas', 'fecha_reporte']
  },
  CONSTANCIA_BAJA: {
    nombre: 'Constancia de Baja',
    descripcion: 'Documento que acredita baja del régimen obligatorio',
    datosEsperados: ['fecha_baja', 'ultimo_patron', 'ultimo_salario']
  },
  INE: {
    nombre: 'Identificación Oficial',
    descripcion: 'INE/IFE vigente',
    datosEsperados: ['nombre', 'fecha_nacimiento', 'curp', 'clave_elector']
  },
  COMPROBANTE_DOMICILIO: {
    nombre: 'Comprobante de Domicilio',
    descripcion: 'Recibo de servicios no mayor a 3 meses',
    datosEsperados: ['direccion', 'fecha_emision']
  },
  ESTADO_CUENTA_AFORE: {
    nombre: 'Estado de Cuenta AFORE',
    descripcion: 'Estado de cuenta de tu AFORE',
    datosEsperados: ['saldo_total', 'afore', 'semanas_cotizadas']
  }
};

// Prompt para análisis de documentos
const PROMPT_ANALISIS = `Eres un experto en documentos del IMSS (Instituto Mexicano del Seguro Social) de México.
Analiza la imagen del documento proporcionado y extrae la información relevante.

INSTRUCCIONES:
1. Identifica el tipo de documento (NSS, Reporte de Semanas, INE, etc.)
2. Extrae todos los datos visibles de manera estructurada
3. Valida que el documento parezca auténtico (formato correcto, sellos, etc.)
4. Indica si hay problemas o datos ilegibles

RESPONDE EN JSON con este formato:
{
  "tipo_documento": "NSS|SEMANAS|INE|OTRO",
  "es_valido": true/false,
  "confianza": 0-100,
  "datos_extraidos": {
    // datos específicos según el tipo de documento
  },
  "problemas": ["lista de problemas encontrados"],
  "recomendaciones": ["sugerencias para el usuario"]
}`;

// Descargar archivo desde URL
async function descargarArchivo(url, destino) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  writeFileSync(destino, buffer);
  return destino;
}

// Convertir imagen a base64
function imagenABase64(rutaArchivo) {
  const buffer = readFileSync(rutaArchivo);
  return buffer.toString('base64');
}

// Analizar documento con OpenAI Vision
async function analizarConOpenAI(imagenBase64, mimeType = 'image/jpeg') {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API Key no configurada');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT_ANALISIS },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imagenBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const contenido = data.choices[0].message.content;

  // Extraer JSON de la respuesta
  const jsonMatch = contenido.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { tipo_documento: 'DESCONOCIDO', es_valido: false, raw: contenido };
}

// Analizar documento con Claude Vision
async function analizarConClaude(imagenBase64, mimeType = 'image/jpeg') {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API Key no configurada');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imagenBase64
              }
            },
            { type: 'text', text: PROMPT_ANALISIS }
          ]
        }
      ]
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const contenido = data.content[0].text;

  const jsonMatch = contenido.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { tipo_documento: 'DESCONOCIDO', es_valido: false, raw: contenido };
}

// Función principal de validación
export async function validarDocumento(opciones) {
  const { url, tipo: mimeType, nombre, chatId, telefono, sesion } = opciones;

  // Crear directorio de uploads si no existe
  if (!existsSync(UPLOADS_PATH)) {
    mkdirSync(UPLOADS_PATH, { recursive: true });
  }

  try {
    // Descargar el archivo
    const nombreArchivo = `${Date.now()}_${nombre || 'documento'}`;
    const rutaLocal = join(UPLOADS_PATH, nombreArchivo);
    await descargarArchivo(url, rutaLocal);

    // Convertir a base64
    const imagenBase64 = imagenABase64(rutaLocal);

    // Analizar con IA (intentar OpenAI primero, luego Claude)
    let resultado;
    try {
      resultado = await analizarConOpenAI(imagenBase64, mimeType);
    } catch (e) {
      console.log('OpenAI falló, intentando Claude:', e.message);
      resultado = await analizarConClaude(imagenBase64, mimeType);
    }

    // Formatear respuesta para el usuario
    let mensaje = '';

    if (resultado.es_valido) {
      mensaje = `✅ *Documento válido*\n\n`;
      mensaje += `📄 *Tipo:* ${resultado.tipo_documento}\n`;
      mensaje += `🎯 *Confianza:* ${resultado.confianza}%\n\n`;
      mensaje += `*Datos extraídos:*\n`;

      for (const [key, value] of Object.entries(resultado.datos_extraidos || {})) {
        const keyFormateado = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        mensaje += `• ${keyFormateado}: ${value}\n`;
      }

      if (resultado.recomendaciones?.length > 0) {
        mensaje += `\n💡 *Recomendaciones:*\n`;
        resultado.recomendaciones.forEach(r => mensaje += `• ${r}\n`);
      }
    } else {
      mensaje = `⚠️ *Documento no válido o ilegible*\n\n`;

      if (resultado.problemas?.length > 0) {
        mensaje += `*Problemas encontrados:*\n`;
        resultado.problemas.forEach(p => mensaje += `• ${p}\n`);
      }

      mensaje += `\n📸 Por favor, envía una foto más clara del documento.`;
    }

    return {
      valido: resultado.es_valido,
      mensaje,
      datosExtraidos: resultado.datos_extraidos,
      tipoDocumento: resultado.tipo_documento,
      confianza: resultado.confianza,
      raw: resultado
    };

  } catch (error) {
    console.error('Error validando documento:', error);
    return {
      valido: false,
      mensaje: `❌ No pude analizar el documento: ${error.message}\n\nPor favor, intenta enviarlo de nuevo.`,
      error: error.message
    };
  }
}

// Validar datos específicos extraídos
export function validarDatosExtraidos(tipo, datos) {
  const esperados = TIPOS_DOCUMENTO[tipo]?.datosEsperados || [];
  const faltantes = esperados.filter(campo => !datos[campo]);

  return {
    completo: faltantes.length === 0,
    faltantes,
    datos
  };
}

export default {
  validarDocumento,
  validarDatosExtraidos,
  TIPOS_DOCUMENTO
};

/**
 * Calculadora de Modalidad 33 IMSS
 * Seguro de Salud para la Familia
 * Artículo 240 LSS
 *
 * IMPORTANTE: Esta modalidad NO suma semanas para pensión.
 * Solo proporciona cobertura médica (Enfermedades y Maternidad).
 *
 * v3.5 - Carga dinámica de cuotas desde base de datos
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar datos de referencia desde la base de datos
function cargarDatosReferencia() {
  try {
    const umaPath = join(__dirname, '..', 'database', 'uma.json');
    const cuotasPath = join(__dirname, '..', 'database', 'modalidad-33-cuotas.json');

    const umaData = JSON.parse(readFileSync(umaPath, 'utf8'));
    let cuotasData = null;

    if (existsSync(cuotasPath)) {
      cuotasData = JSON.parse(readFileSync(cuotasPath, 'utf8'));
    }

    const anioActual = new Date().getFullYear().toString();
    const uma = umaData.historico[anioActual] || umaData.historico['2026'];

    return {
      UMA_DIARIO: uma.diario,
      UMA_MENSUAL: uma.mensual,
      UMA_ANUAL: uma.anual,
      cuotasMod33: cuotasData
    };
  } catch (e) {
    console.error('Error cargando datos de referencia Mod33:', e.message);
    // Valores por defecto 2026
    return {
      UMA_DIARIO: 117.31,
      UMA_MENSUAL: 3566.22,
      UMA_ANUAL: 42818.15,
      cuotasMod33: null
    };
  }
}

// Cuotas por defecto si no hay base de datos
const CUOTAS_POR_EDAD_DEFAULT = {
  '0-19': { porcentaje: 0.0436, descripcion: 'Menores de 20 años' },
  '20-39': { porcentaje: 0.0772, descripcion: '20 a 39 años' },
  '40-59': { porcentaje: 0.1035, descripcion: '40 a 59 años' },
  '60-69': { porcentaje: 0.1615, descripcion: '60 a 69 años' },
  '70-79': { porcentaje: 0.1850, descripcion: '70 a 79 años' },
  '80+': { porcentaje: 0.2100, descripcion: '80 años o más' }
};

const CUOTA_INSCRIPCION_DEFAULT = {
  porcentaje: 0.1082,
  descripcion: 'Cuota única de inscripción por familia'
};

export function calcularModalidad33(datos) {
  const {
    integrantes = [],  // Array de { edad: number, parentesco: string }
    añosCobertura = 1,
    anio = new Date().getFullYear()
  } = datos;

  if (!integrantes || integrantes.length === 0) {
    throw new Error('Debe especificar al menos un integrante de la familia');
  }

  // Cargar datos actualizados
  const datosRef = cargarDatosReferencia();
  const anioStr = anio.toString();

  // Determinar cuotas a usar
  let cuotasPorEdad = CUOTAS_POR_EDAD_DEFAULT;
  let cuotaInscripcionPorcentaje = CUOTA_INSCRIPCION_DEFAULT.porcentaje;
  let cuotaInscripcionMonto = null;

  if (datosRef.cuotasMod33) {
    // Usar cuotas de la base de datos
    const cuotasAnio = datosRef.cuotasMod33.cuotas_por_edad[anioStr];
    const inscripcionAnio = datosRef.cuotasMod33.cuota_inscripcion[anioStr];

    if (cuotasAnio) {
      cuotasPorEdad = {};
      for (const [rango, info] of Object.entries(cuotasAnio)) {
        cuotasPorEdad[rango] = {
          porcentaje: info.porcentaje_uma_anual / 100,
          montoAnual: info.monto_anual,
          montoMensual: info.monto_mensual,
          descripcion: obtenerDescripcionRango(rango)
        };
      }
    }

    if (inscripcionAnio) {
      cuotaInscripcionPorcentaje = inscripcionAnio.porcentaje_uma_anual / 100;
      cuotaInscripcionMonto = inscripcionAnio.monto_aproximado;
    }
  }

  const umaAnual = datosRef.UMA_ANUAL;
  const resultadoIntegrantes = [];
  let totalAnual = 0;

  // Calcular cuota por cada integrante
  for (const integrante of integrantes) {
    const { edad, parentesco = 'Familiar' } = integrante;
    const grupoEdad = obtenerGrupoEdad(edad);
    const cuotaInfo = cuotasPorEdad[grupoEdad];

    if (!cuotaInfo) {
      throw new Error(`No se encontraron cuotas para el grupo de edad: ${grupoEdad}`);
    }

    // Usar monto fijo si está disponible, sino calcular con porcentaje
    const cuotaAnual = cuotaInfo.montoAnual || (umaAnual * cuotaInfo.porcentaje);
    const cuotaMensual = cuotaInfo.montoMensual || (cuotaAnual / 12);

    resultadoIntegrantes.push({
      edad,
      parentesco,
      grupoEdad: cuotaInfo.descripcion,
      porcentaje: (cuotaInfo.porcentaje * 100).toFixed(2) + '%',
      cuotaAnual: redondear(cuotaAnual),
      cuotaMensual: redondear(cuotaMensual)
    });

    totalAnual += cuotaAnual;
  }

  // Cuota de inscripción (solo primer año)
  const cuotaInscripcion = cuotaInscripcionMonto || (umaAnual * cuotaInscripcionPorcentaje);

  // Totales
  const totalPrimerAño = totalAnual + cuotaInscripcion;
  const totalAñosSiguientes = totalAnual;
  const totalPeriodo = totalPrimerAño + (totalAñosSiguientes * (añosCobertura - 1));

  return {
    informacion: {
      modalidad: '33 - Seguro de Salud para la Familia',
      articulo: 'Art. 240-242 LSS',
      cobertura: 'Enfermedades y Maternidad',
      advertencia: 'NO suma semanas para pensión',
      anioCalculo: anio,
      umaAnual: redondear(umaAnual),
      umaDiario: datosRef.UMA_DIARIO
    },
    integrantes: resultadoIntegrantes,
    cuotaInscripcion: {
      monto: redondear(cuotaInscripcion),
      porcentaje: (cuotaInscripcionPorcentaje * 100).toFixed(2) + '%',
      nota: 'Pago único al inscribirse'
    },
    totales: {
      cuotaAnualFamilia: redondear(totalAnual),
      cuotaMensualFamilia: redondear(totalAnual / 12),
      totalPrimerAño: redondear(totalPrimerAño),
      totalAñosSiguientes: redondear(totalAñosSiguientes),
      totalPeriodo: redondear(totalPeriodo),
      añosCobertura
    },
    beneficios: datosRef.cuotasMod33?.beneficios || [
      'Atención médica en clínicas IMSS',
      'Hospitalización',
      'Cirugías',
      'Medicamentos',
      'Maternidad (embarazo, parto, puerperio)',
      'Atención del recién nacido'
    ],
    parentescosPermitidos: datosRef.cuotasMod33?.parentescos_permitidos || [
      'Titular',
      'Cónyuge',
      'Concubina/Concubinario',
      'Hijos menores de 16 años',
      'Hijos de 16 a 25 años (estudiantes)',
      'Padres'
    ],
    requisitos: [
      'No estar afiliado al régimen obligatorio',
      'No tener derecho a servicios médicos por otra vía',
      'Examen médico de admisión',
      'Pago anual anticipado'
    ],
    exclusiones: datosRef.cuotasMod33?.exclusiones || [
      'NO acumula semanas para pensión',
      'NO genera derechos de incapacidad',
      'NO incluye guarderías'
    ]
  };
}

function obtenerGrupoEdad(edad) {
  if (edad < 20) return '0-19';
  if (edad < 40) return '20-39';
  if (edad < 60) return '40-59';
  if (edad < 70) return '60-69';
  if (edad < 80) return '70-79';
  return '80+';
}

function obtenerDescripcionRango(rango) {
  const descripciones = {
    '0-19': 'Menores de 20 años',
    '20-39': '20 a 39 años',
    '40-59': '40 a 59 años',
    '60-69': '60 a 69 años',
    '70-79': '70 a 79 años',
    '80+': '80 años o más'
  };
  return descripciones[rango] || rango;
}

function redondear(num) {
  return Math.round(num * 100) / 100;
}

// Exportar grupos de edad para el frontend
export function obtenerGruposEdad() {
  const datosRef = cargarDatosReferencia();
  const anioActual = new Date().getFullYear().toString();

  if (datosRef.cuotasMod33) {
    const cuotasAnio = datosRef.cuotasMod33.cuotas_por_edad[anioActual];
    if (cuotasAnio) {
      return Object.entries(cuotasAnio).map(([rango, info]) => ({
        rango,
        descripcion: obtenerDescripcionRango(rango),
        porcentaje: info.porcentaje_uma_anual.toFixed(2) + '%',
        cuotaAnual: info.monto_anual,
        cuotaMensual: info.monto_mensual
      }));
    }
  }

  // Valores por defecto
  return Object.entries(CUOTAS_POR_EDAD_DEFAULT).map(([rango, info]) => ({
    rango,
    descripcion: info.descripcion,
    porcentaje: (info.porcentaje * 100).toFixed(2) + '%',
    cuotaAnual: Math.round(42818.15 * info.porcentaje * 100) / 100
  }));
}

export const GRUPOS_EDAD = obtenerGruposEdad();

export default { calcularModalidad33, GRUPOS_EDAD, obtenerGruposEdad };

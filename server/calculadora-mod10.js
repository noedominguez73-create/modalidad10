/**
 * Calculadora de Modalidad 10 IMSS
 * Incorporación Voluntaria al Régimen Obligatorio (Independientes)
 * Artículo 13 LSS
 *
 * v3.2 - Con divisiones ocupacionales y múltiples períodos de pago
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar datos dinámicos de la base de datos
function cargarDatosReferencia() {
  try {
    const umaPath = join(__dirname, '..', 'database', 'uma.json');
    const salariosPath = join(__dirname, '..', 'database', 'salarios-minimos.json');
    const cuotaSocialPath = join(__dirname, '..', 'database', 'cuota-social.json');

    const umaData = JSON.parse(readFileSync(umaPath, 'utf8'));
    const salariosData = JSON.parse(readFileSync(salariosPath, 'utf8'));
    let cuotaSocialData = null;

    if (existsSync(cuotaSocialPath)) {
      cuotaSocialData = JSON.parse(readFileSync(cuotaSocialPath, 'utf8'));
    }

    const anioActual = new Date().getFullYear().toString();
    const uma = umaData.historico[anioActual] || umaData.historico['2026'];
    const salarios = salariosData.historico[anioActual] || salariosData.historico['2026'];

    return {
      UMA_DIARIO: uma.diario,
      SMG_CENTRO: salarios.general,
      SMG_FRONTERA: salarios.frontera,
      cuotaSocial: cuotaSocialData
    };
  } catch (e) {
    console.error('Error cargando datos de referencia:', e.message);
    // Valores por defecto 2026
    return {
      UMA_DIARIO: 117.31,
      SMG_CENTRO: 315.04,
      SMG_FRONTERA: 419.88,
      cuotaSocial: null
    };
  }
}

// Constantes (valores por defecto, se cargan dinámicamente)
const datosRef = cargarDatosReferencia();
const UMA_2025 = datosRef.UMA_DIARIO;
const SMG_CENTRO = datosRef.SMG_CENTRO;
const SMG_FRONTERA = datosRef.SMG_FRONTERA;

// Límites de salario (en veces UMA)
const LIMITES = {
  centro: {
    minimo: SMG_CENTRO,           // Salario mínimo general
    maximo: 25 * UMA_2025         // 25 UMAs = $2,828.50 diarios
  },
  frontera: {
    minimo: SMG_FRONTERA,         // Salario mínimo frontera
    maximo: 25 * UMA_2025
  }
};

// Primas de Riesgo por Clase (porcentaje)
const PRIMAS_RIESGO = {
  'I': 0.0054355,
  'II': 0.0113065,
  'III': 0.025984,
  'IV': 0.0465325,
  'V': 0.0758875
};

// Porcentajes de cuotas
const CUOTAS = {
  cuotaFija: 0.204,           // 20.4% sobre UMA (solo patrón)
  excedentePatron: 0.011,     // 1.1% sobre excedente 3 UMAs
  excedenteObrero: 0.004,     // 0.4% sobre excedente 3 UMAs
  prestacionesDineroPatron: 0.007,  // 0.7%
  prestacionesDineroObrero: 0.0025, // 0.25%
  gastoMedicoPatron: 0.0105,  // 1.05%
  gastoMedicoObrero: 0.00375, // 0.375%
  invalidezVidaPatron: 0.0175, // 1.75%
  invalidezVidaObrero: 0.00625, // 0.625%
  guarderiasPatron: 0.01,     // 1.0%
  retiro: 0.02,               // 2.0%
  infonavit: 0.05             // 5.0%
};

// Tabla de Cesantía por año y veces UMA (incrementos graduales 2023-2030)
const CESANTIA_TABLA = {
  2023: { 1.00: 0.0315, 1.50: 0.03281, 2.00: 0.03575, 2.50: 0.03751, 3.00: 0.03869, 3.50: 0.03953, 4.00: 0.04016, 4.01: 0.04241 },
  2024: { 1.00: 0.0315, 1.50: 0.03413, 2.00: 0.04000, 2.50: 0.04353, 3.00: 0.04588, 3.50: 0.04756, 4.00: 0.04882, 4.01: 0.05331 },
  2025: { 1.00: 0.0315, 1.50: 0.03544, 2.00: 0.04426, 2.50: 0.04954, 3.00: 0.05307, 3.50: 0.05559, 4.00: 0.05747, 4.01: 0.06422 },
  2026: { 1.00: 0.0315, 1.50: 0.03676, 2.00: 0.04851, 2.50: 0.05556, 3.00: 0.06026, 3.50: 0.06361, 4.00: 0.06613, 4.01: 0.07513 },
  2027: { 1.00: 0.0315, 1.50: 0.03807, 2.00: 0.05276, 2.50: 0.06157, 3.00: 0.06745, 3.50: 0.07164, 4.00: 0.07479, 4.01: 0.08603 },
  2028: { 1.00: 0.0315, 1.50: 0.03939, 2.00: 0.05701, 2.50: 0.06759, 3.00: 0.07464, 3.50: 0.07967, 4.00: 0.08345, 4.01: 0.09694 },
  2029: { 1.00: 0.0315, 1.50: 0.04070, 2.00: 0.06126, 2.50: 0.07360, 3.00: 0.08183, 3.50: 0.08770, 4.00: 0.09211, 4.01: 0.10784 },
  2030: { 1.00: 0.0315, 1.50: 0.04202, 2.00: 0.06552, 2.50: 0.07962, 3.00: 0.08902, 3.50: 0.09573, 4.00: 0.10077, 4.01: 0.11875 }
};

// Períodos de pago
const PERIODOS_PAGO = {
  mensual: { meses: 1, nombre: 'Mensual', descripcion: 'Pago cada mes' },
  bimestral: { meses: 2, nombre: 'Bimestral', descripcion: 'Pago cada 2 meses' },
  semestral: { meses: 6, nombre: 'Semestral', descripcion: 'Pago cada 6 meses' },
  anual: { meses: 12, nombre: 'Anual', descripcion: 'Pago único anual' }
};

// Cargar divisiones ocupacionales
let divisionesOcupacionales = null;
function cargarDivisiones() {
  if (divisionesOcupacionales) return divisionesOcupacionales;

  try {
    const path = join(__dirname, '..', 'database', 'divisiones-ocupacionales.json');
    if (existsSync(path)) {
      divisionesOcupacionales = JSON.parse(readFileSync(path, 'utf8'));
      return divisionesOcupacionales;
    }
  } catch (e) {
    console.error('Error cargando divisiones:', e.message);
  }
  return null;
}

/**
 * Obtener clase de riesgo por división y grupo
 */
export function obtenerClaseRiesgoPorDivision(codigoDivision, codigoGrupo) {
  const divisiones = cargarDivisiones();
  if (!divisiones) return 'I'; // Default

  const division = divisiones.divisiones.find(d => d.codigo === codigoDivision);
  if (!division) return 'I';

  if (codigoGrupo) {
    const grupo = division.grupos.find(g => g.codigo === codigoGrupo);
    if (grupo) return grupo.claseRiesgo;
  }

  // Retornar el riesgo más común de la división
  return division.grupos[0]?.claseRiesgo || 'I';
}

/**
 * Calcular cuotas para un período específico
 */
function calcularCuotasPeriodo(datosMensuales, meses) {
  return {
    imss: redondear(datosMensuales.totalMensual * meses),
    infonavit: redondear(datosMensuales.infonavit * meses),
    total: redondear((datosMensuales.totalMensual + datosMensuales.infonavit) * meses),
    meses
  };
}

/**
 * Calcular fecha límite de pago
 */
function calcularFechaLimite(fechaInicio, periodo) {
  const fecha = new Date(fechaInicio);
  // El pago debe realizarse dentro de los primeros 17 días del período
  fecha.setDate(17);
  return fecha.toISOString().split('T')[0];
}

/**
 * Calcular fechas de cobertura por período
 */
function calcularCobertura(año, mes, mesesPeriodo) {
  const inicio = new Date(año, mes - 1, 1);
  const fin = new Date(año, mes - 1 + mesesPeriodo, 0);

  return {
    inicio: inicio.toISOString().split('T')[0],
    fin: fin.toISOString().split('T')[0],
    meses: mesesPeriodo
  };
}

/**
 * Función principal de cálculo - ACTUALIZADA
 */
export function calcularModalidad10(datos) {
  const {
    salarioMensual,
    ingresoMensual,           // Alternativa: calcular SBC desde ingreso
    zona = 'centro',
    claseRiesgo,              // Si no se proporciona, se calcula por división
    divisionCodigo,           // Código de división ocupacional
    grupoCodigo,              // Código de grupo ocupacional
    mes = new Date().getMonth() + 1,
    año = new Date().getFullYear(),
    incluirInfonavit = false,
    periodoPago = 'mensual'   // mensual, bimestral, semestral, anual
  } = datos;

  // Determinar salario a usar
  let salarioBase = salarioMensual;
  if (!salarioBase && ingresoMensual) {
    salarioBase = ingresoMensual;
  }

  if (!salarioBase || salarioBase <= 0) {
    throw new Error('El salario o ingreso mensual es requerido');
  }

  // Validar límites según zona
  const limites = LIMITES[zona] || LIMITES.centro;
  const salarioDiario = salarioBase / 30;

  if (salarioDiario < limites.minimo) {
    throw new Error(`El salario diario ($${redondear(salarioDiario)}) es menor al mínimo permitido ($${limites.minimo}) para la zona ${zona}`);
  }

  if (salarioDiario > limites.maximo) {
    throw new Error(`El salario diario ($${redondear(salarioDiario)}) excede el máximo permitido ($${redondear(limites.maximo)})`);
  }

  // Determinar clase de riesgo
  let claseRiesgoFinal = claseRiesgo;
  let divisionInfo = null;
  let grupoInfo = null;

  if (!claseRiesgoFinal && divisionCodigo) {
    claseRiesgoFinal = obtenerClaseRiesgoPorDivision(divisionCodigo, grupoCodigo);

    // Obtener info de división/grupo
    const divisiones = cargarDivisiones();
    if (divisiones) {
      const div = divisiones.divisiones.find(d => d.codigo === divisionCodigo);
      if (div) {
        divisionInfo = { codigo: div.codigo, nombre: div.nombre };
        if (grupoCodigo) {
          const grp = div.grupos.find(g => g.codigo === grupoCodigo);
          if (grp) {
            grupoInfo = { codigo: grp.codigo, nombre: grp.nombre };
          }
        }
      }
    }
  }

  claseRiesgoFinal = claseRiesgoFinal || 'I';

  // Obtener días del mes
  const diasMes = new Date(año, mes, 0).getDate();

  // Salario base de cotización (SBC) = salario diario
  const sbc = salarioDiario;

  // Base mensual de cotización
  const baseMensual = sbc * diasMes;

  // Veces UMA del salario
  const vecesUMA = sbc / UMA_2025;

  // Obtener porcentaje de cesantía según año y veces UMA
  const porcentajeCesantia = obtenerPorcentajeCesantia(año, vecesUMA);

  // Prima de riesgo según clase
  const primaRiesgo = PRIMAS_RIESGO[claseRiesgoFinal] || PRIMAS_RIESGO['I'];

  // ============ CÁLCULO DE CUOTAS ============

  // 1. CUOTA FIJA (20.4% sobre UMA * días del mes)
  const cuotaFija = UMA_2025 * diasMes * CUOTAS.cuotaFija;

  // 2. EXCEDENTE (sobre la diferencia del SBC y 3 UMAs)
  const excedenteBase = Math.max(0, sbc - (3 * UMA_2025)) * diasMes;
  const excedentePatron = excedenteBase * CUOTAS.excedentePatron;
  const excedenteObrero = excedenteBase * CUOTAS.excedenteObrero;

  // 3. PRESTACIONES EN DINERO
  const prestacionesDineroPatron = baseMensual * CUOTAS.prestacionesDineroPatron;
  const prestacionesDineroObrero = baseMensual * CUOTAS.prestacionesDineroObrero;

  // 4. GASTOS MÉDICOS PENSIONADOS
  const gastoMedicoPatron = baseMensual * CUOTAS.gastoMedicoPatron;
  const gastoMedicoObrero = baseMensual * CUOTAS.gastoMedicoObrero;

  // 5. RIESGO DE TRABAJO
  const riesgoTrabajo = baseMensual * primaRiesgo;

  // 6. INVALIDEZ Y VIDA
  const invalidezVidaPatron = baseMensual * CUOTAS.invalidezVidaPatron;
  const invalidezVidaObrero = baseMensual * CUOTAS.invalidezVidaObrero;

  // 7. GUARDERÍAS
  const guarderias = baseMensual * CUOTAS.guarderiasPatron;

  // 8. RETIRO
  const retiro = baseMensual * CUOTAS.retiro;

  // 9. CESANTÍA EN EDAD AVANZADA Y VEJEZ
  const cesantiaPatron = baseMensual * (porcentajeCesantia * 0.7375);
  const cesantiaObrero = baseMensual * (porcentajeCesantia * 0.2625);

  // 10. INFONAVIT (opcional)
  const infonavit = incluirInfonavit ? baseMensual * CUOTAS.infonavit : 0;

  // ============ TOTALES ============

  const subtotalIMSSPatron = cuotaFija + excedentePatron + prestacionesDineroPatron +
    gastoMedicoPatron + riesgoTrabajo + invalidezVidaPatron + guarderias;
  const subtotalIMSSObrero = excedenteObrero + prestacionesDineroObrero +
    gastoMedicoObrero + invalidezVidaObrero;

  const subtotalRCVPatron = retiro + cesantiaPatron;
  const subtotalRCVObrero = cesantiaObrero;

  const totalPatron = subtotalIMSSPatron + subtotalRCVPatron;
  const totalObrero = subtotalIMSSObrero + subtotalRCVObrero;
  const totalMensual = totalPatron + totalObrero;

  // ============ CALCULAR TODOS LOS PERÍODOS ============

  const datosMensuales = {
    totalMensual,
    infonavit
  };

  const periodos = {};
  for (const [key, config] of Object.entries(PERIODOS_PAGO)) {
    const cuotas = calcularCuotasPeriodo(datosMensuales, config.meses);
    const cobertura = calcularCobertura(año, mes, config.meses);

    periodos[key] = {
      nombre: config.nombre,
      descripcion: config.descripcion,
      cuotaIMSS: cuotas.imss,
      cuotaInfonavit: incluirInfonavit ? cuotas.infonavit : 0,
      total: incluirInfonavit ? cuotas.total : cuotas.imss,
      cobertura,
      fechaLimitePago: calcularFechaLimite(cobertura.inicio, key)
    };
  }

  // ============ CUOTA SOCIAL (Aportación del Gobierno) ============

  let cuotaSocialMensual = 0;
  let cuotaSocialInfo = null;
  const datosActuales = cargarDatosReferencia();

  if (datosActuales.cuotaSocial) {
    const cuotaSocialAnio = datosActuales.cuotaSocial.cuotas_por_rango_sbc[año.toString()];
    if (cuotaSocialAnio) {
      // Determinar rango de SBC
      let rangoClave = 'hasta_1.00_uma';
      if (vecesUMA > 4.00) rangoClave = 'mas_de_4.00_uma';
      else if (vecesUMA > 3.50) rangoClave = '3.51_a_4.00_uma';
      else if (vecesUMA > 3.00) rangoClave = '3.01_a_3.50_uma';
      else if (vecesUMA > 2.50) rangoClave = '2.51_a_3.00_uma';
      else if (vecesUMA > 2.00) rangoClave = '2.01_a_2.50_uma';
      else if (vecesUMA > 1.50) rangoClave = '1.51_a_2.00_uma';
      else if (vecesUMA > 1.00) rangoClave = '1.01_a_1.50_uma';

      const cuotaRango = cuotaSocialAnio[rangoClave];
      if (cuotaRango) {
        cuotaSocialMensual = cuotaRango.monto_mensual;
        cuotaSocialInfo = {
          rangoSBC: rangoClave,
          montoDiario: cuotaRango.monto_diario,
          montoMensual: cuotaRango.monto_mensual,
          nota: 'Aportación del Gobierno Federal a tu AFORE (solo aplica hasta 4 UMAs)'
        };
      }
    }
  }

  // ============ RESULTADO ============

  return {
    informacion: {
      modalidad: '10 - Incorporación Voluntaria',
      beneficios: ['Servicio médico IMSS', 'Acumula semanas para pensión', 'Guarderías', 'Invalidez y vida', 'Cuota Social del Gobierno'],
      articulo: 'Art. 13 LSS'
    },
    datos: {
      salarioMensual: redondear(salarioBase),
      salarioDiario: redondear(salarioDiario),
      diasMes,
      zona,
      claseRiesgo: claseRiesgoFinal,
      primaRiesgo: (primaRiesgo * 100).toFixed(5) + '%',
      vecesUMA: redondear(vecesUMA),
      año,
      mes: obtenerNombreMes(mes),
      division: divisionInfo,
      grupo: grupoInfo
    },
    limites: {
      salarioMinimoDiario: limites.minimo,
      salarioMaximoDiario: redondear(limites.maximo),
      salarioMinimoMensual: redondear(limites.minimo * 30),
      salarioMaximoMensual: redondear(limites.maximo * 30)
    },
    desglose: {
      cuotaFija: { monto: redondear(cuotaFija), porcentaje: '20.40% sobre UMA', tipo: 'patron' },
      excedentePatron: { monto: redondear(excedentePatron), porcentaje: '1.10%', tipo: 'patron' },
      excedenteObrero: { monto: redondear(excedenteObrero), porcentaje: '0.40%', tipo: 'obrero' },
      prestacionesDineroPatron: { monto: redondear(prestacionesDineroPatron), porcentaje: '0.70%', tipo: 'patron' },
      prestacionesDineroObrero: { monto: redondear(prestacionesDineroObrero), porcentaje: '0.25%', tipo: 'obrero' },
      gastoMedicoPatron: { monto: redondear(gastoMedicoPatron), porcentaje: '1.05%', tipo: 'patron' },
      gastoMedicoObrero: { monto: redondear(gastoMedicoObrero), porcentaje: '0.375%', tipo: 'obrero' },
      riesgoTrabajo: { monto: redondear(riesgoTrabajo), porcentaje: (primaRiesgo * 100).toFixed(3) + '%', tipo: 'patron' },
      invalidezVidaPatron: { monto: redondear(invalidezVidaPatron), porcentaje: '1.75%', tipo: 'patron' },
      invalidezVidaObrero: { monto: redondear(invalidezVidaObrero), porcentaje: '0.625%', tipo: 'obrero' },
      guarderias: { monto: redondear(guarderias), porcentaje: '1.00%', tipo: 'patron' },
      retiro: { monto: redondear(retiro), porcentaje: '2.00%', tipo: 'patron' },
      cesantiaPatron: { monto: redondear(cesantiaPatron), porcentaje: (porcentajeCesantia * 73.75).toFixed(2) + '%', tipo: 'patron' },
      cesantiaObrero: { monto: redondear(cesantiaObrero), porcentaje: (porcentajeCesantia * 26.25).toFixed(2) + '%', tipo: 'obrero' },
      infonavit: { monto: redondear(infonavit), porcentaje: '5.00%', tipo: 'patron', opcional: true, incluido: incluirInfonavit }
    },
    subtotales: {
      imssPatron: redondear(subtotalIMSSPatron),
      imssObrero: redondear(subtotalIMSSObrero),
      rcvPatron: redondear(subtotalRCVPatron),
      rcvObrero: redondear(subtotalRCVObrero)
    },
    totalesMensuales: {
      patron: redondear(totalPatron),
      obrero: redondear(totalObrero),
      imss: redondear(totalMensual),
      infonavit: redondear(infonavit),
      total: redondear(totalMensual + infonavit)
    },
    periodos,
    periodoSeleccionado: periodos[periodoPago] || periodos.mensual,
    cuotaSocial: cuotaSocialInfo
  };
}

function obtenerPorcentajeCesantia(año, vecesUMA) {
  const tablaAño = CESANTIA_TABLA[año] || CESANTIA_TABLA[2025];

  if (vecesUMA <= 1.00) return tablaAño[1.00];
  if (vecesUMA <= 1.50) return tablaAño[1.50];
  if (vecesUMA <= 2.00) return tablaAño[2.00];
  if (vecesUMA <= 2.50) return tablaAño[2.50];
  if (vecesUMA <= 3.00) return tablaAño[3.00];
  if (vecesUMA <= 3.50) return tablaAño[3.50];
  if (vecesUMA <= 4.00) return tablaAño[4.00];
  return tablaAño[4.01];
}

function obtenerNombreMes(mes) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return meses[mes - 1] || meses[0];
}

function redondear(num) {
  return Math.round(num * 100) / 100;
}

// Exportar clases de riesgo para el frontend
export const CLASES_RIESGO = [
  { clase: 'I', prima: 0.54355, descripcion: 'Riesgo Mínimo: Oficinas, consultoría, servicios financieros, educación' },
  { clase: 'II', prima: 1.13065, descripcion: 'Riesgo Bajo: Comercio, restaurantes, servicios médicos consultorios' },
  { clase: 'III', prima: 2.5984, descripcion: 'Riesgo Medio: Manufactura ligera, transporte, agricultura' },
  { clase: 'IV', prima: 4.65325, descripcion: 'Riesgo Alto: Construcción especializada, industria química' },
  { clase: 'V', prima: 7.58875, descripcion: 'Riesgo Máximo: Construcción pesada, minería, petróleo' }
];

// Exportar divisiones ocupacionales
export function obtenerDivisiones() {
  return cargarDivisiones();
}

// Exportar períodos de pago
export const PERIODOS = PERIODOS_PAGO;

// Exportar límites de salario
export const LIMITES_SALARIO = LIMITES;

export default {
  calcularModalidad10,
  CLASES_RIESGO,
  obtenerDivisiones,
  obtenerClaseRiesgoPorDivision,
  PERIODOS,
  LIMITES_SALARIO
};

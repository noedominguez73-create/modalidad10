/**
 * Calculadora de Cuotas IMSS para Personas Trabajadoras del Hogar
 * Basado en: Ley del Seguro Social y programa piloto IMSS
 *
 * El empleador (patrón) paga las cuotas patronales
 * El trabajador contribuye una pequeña parte (se deduce del salario)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar datos de referencia
function cargarDatos() {
  const umaPath = path.join(__dirname, '..', 'database', 'uma.json');
  const salariosPath = path.join(__dirname, '..', 'database', 'salarios-minimos.json');
  const ceavPath = path.join(__dirname, '..', 'database', 'cesantia-vejez.json');
  const cuotaSocialPath = path.join(__dirname, '..', 'database', 'cuota-social.json');

  return {
    uma: JSON.parse(fs.readFileSync(umaPath, 'utf8')),
    salarios: JSON.parse(fs.readFileSync(salariosPath, 'utf8')),
    ceav: JSON.parse(fs.readFileSync(ceavPath, 'utf8')),
    cuotaSocial: JSON.parse(fs.readFileSync(cuotaSocialPath, 'utf8'))
  };
}

// Tasas de cotización para Trabajadoras del Hogar (mismas que régimen obligatorio)
const TASAS = {
  // Riesgos de Trabajo - Solo patrón (Prima mínima)
  riesgosTrabajo: { patron: 0.50, obrero: 0.00 },

  // Enfermedades y Maternidad
  enfermedadesMaternidad: {
    prestacionesEspecie: { patron: 1.05, obrero: 0.375 }, // Cuota fija
    prestacionesEspecieExcedente: { patron: 0.40, obrero: 0.15 }, // Sobre 3 UMAS
    prestacionesDinero: { patron: 0.70, obrero: 0.25 },
    gastosMedicosPensionados: { patron: 1.05, obrero: 0.375 }
  },

  // Invalidez y Vida
  invalidezVida: { patron: 1.75, obrero: 0.625 },

  // Guarderías y Prestaciones Sociales - Solo patrón
  guarderias: { patron: 1.00, obrero: 0.00 },

  // Retiro
  retiro: { patron: 2.00, obrero: 0.00 },

  // INFONAVIT (opcional pero recomendado)
  infonavit: { patron: 5.00, obrero: 0.00 }
};

/**
 * Obtener el rango de UMA según el SBC
 */
function obtenerRangoUMA(sbcEnUMAs) {
  if (sbcEnUMAs <= 1.00) return 'hasta_1.00_uma';
  if (sbcEnUMAs <= 1.50) return '1.01_a_1.50_uma';
  if (sbcEnUMAs <= 2.00) return '1.51_a_2.00_uma';
  if (sbcEnUMAs <= 2.50) return '2.01_a_2.50_uma';
  if (sbcEnUMAs <= 3.00) return '2.51_a_3.00_uma';
  if (sbcEnUMAs <= 3.50) return '3.01_a_3.50_uma';
  if (sbcEnUMAs <= 4.00) return '3.51_a_4.00_uma';
  return 'mas_de_4.00_uma';
}

/**
 * Calcular las cuotas para Trabajadoras del Hogar
 * @param {Object} datos - Datos del cálculo
 * @param {number} datos.salarioMensual - Salario mensual de la trabajadora
 * @param {number} datos.diasPorSemana - Días trabajados por semana (1-7)
 * @param {string} datos.zona - 'frontera' o 'general'
 * @param {boolean} datos.incluirInfonavit - Si incluir INFONAVIT
 * @param {number} datos.anio - Año del cálculo (default: año actual)
 */
export function calcularTrabajadorasHogar(datos) {
  const {
    salarioMensual,
    diasPorSemana,
    zona = 'general',
    incluirInfonavit = true,
    anio = new Date().getFullYear()
  } = datos;

  // Validaciones
  if (!salarioMensual || salarioMensual <= 0) {
    throw new Error('El salario mensual debe ser mayor a 0');
  }
  if (!diasPorSemana || diasPorSemana < 1 || diasPorSemana > 7) {
    throw new Error('Los días por semana deben estar entre 1 y 7');
  }

  // Cargar datos de referencia
  const db = cargarDatos();
  const anioStr = anio.toString();

  // Obtener UMA del año
  const umaAnual = db.uma.historico[anioStr];
  if (!umaAnual) {
    throw new Error(`No hay datos de UMA para el año ${anio}`);
  }
  const umaDiario = umaAnual.diario;
  const umaMensual = umaAnual.mensual;

  // Obtener salario mínimo según zona
  const salariosAnio = db.salarios.historico[anioStr];
  if (!salariosAnio) {
    throw new Error(`No hay datos de salarios mínimos para el año ${anio}`);
  }
  const salarioMinimoDiario = zona === 'frontera' ? salariosAnio.frontera : salariosAnio.general;
  const salarioMinimoMensual = salarioMinimoDiario * 30.4;

  // Calcular días trabajados al mes (promedio)
  const diasTrabajadosMes = (diasPorSemana / 7) * 30.4;

  // Calcular Salario Base de Cotización (SBC)
  // Para trabajadoras del hogar, el SBC se calcula con factor de integración reducido
  const factorIntegracion = 1.0493; // Factor de integración (aguinaldo + vacaciones + prima vacacional)
  const salarioDiario = salarioMensual / diasTrabajadosMes;

  // Verificar que no sea menor al salario mínimo
  const salarioDiarioMinimo = Math.max(salarioDiario, salarioMinimoDiario);
  const sbcDiario = salarioDiarioMinimo * factorIntegracion;

  // Aplicar tope de 25 UMAs
  const topeSBC = umaDiario * 25;
  const sbcDiarioTopado = Math.min(sbcDiario, topeSBC);
  const sbcMensual = sbcDiarioTopado * diasTrabajadosMes;

  // Calcular SBC en UMAs para determinar tasas CEAV
  const sbcEnUMAs = sbcDiarioTopado / umaDiario;
  const rangoUMA = obtenerRangoUMA(sbcEnUMAs);

  // Obtener tasas CEAV progresivas
  const tasasCEAV = db.ceav.tabla_incrementos[anioStr];
  if (!tasasCEAV) {
    throw new Error(`No hay datos de CEAV para el año ${anio}`);
  }
  const ceavRango = tasasCEAV[rangoUMA];

  // Calcular cada concepto
  const desglose = {
    // Riesgos de Trabajo
    riesgosTrabajo: {
      patron: sbcMensual * (TASAS.riesgosTrabajo.patron / 100),
      obrero: 0
    },

    // Enfermedades y Maternidad - Prestaciones en Especie (Cuota Fija)
    enfermedadesCuotaFija: {
      patron: umaMensual * (TASAS.enfermedadesMaternidad.prestacionesEspecie.patron / 100),
      obrero: umaMensual * (TASAS.enfermedadesMaternidad.prestacionesEspecie.obrero / 100)
    },

    // Enfermedades y Maternidad - Excedente (solo si SBC > 3 UMAs)
    enfermedadesExcedente: {
      patron: 0,
      obrero: 0
    },

    // Enfermedades y Maternidad - Prestaciones en Dinero
    enfermedadesDinero: {
      patron: sbcMensual * (TASAS.enfermedadesMaternidad.prestacionesDinero.patron / 100),
      obrero: sbcMensual * (TASAS.enfermedadesMaternidad.prestacionesDinero.obrero / 100)
    },

    // Gastos Médicos Pensionados
    gastosMedicos: {
      patron: sbcMensual * (TASAS.enfermedadesMaternidad.gastosMedicosPensionados.patron / 100),
      obrero: sbcMensual * (TASAS.enfermedadesMaternidad.gastosMedicosPensionados.obrero / 100)
    },

    // Invalidez y Vida
    invalidezVida: {
      patron: sbcMensual * (TASAS.invalidezVida.patron / 100),
      obrero: sbcMensual * (TASAS.invalidezVida.obrero / 100)
    },

    // Guarderías
    guarderias: {
      patron: sbcMensual * (TASAS.guarderias.patron / 100),
      obrero: 0
    },

    // Retiro (SAR)
    retiro: {
      patron: sbcMensual * (TASAS.retiro.patron / 100),
      obrero: 0
    },

    // Cesantía y Vejez (tasas progresivas)
    cesantiaVejez: {
      patron: sbcMensual * (ceavRango.patron / 100),
      obrero: sbcMensual * (ceavRango.obrero / 100)
    },

    // INFONAVIT (opcional)
    infonavit: {
      patron: incluirInfonavit ? sbcMensual * (TASAS.infonavit.patron / 100) : 0,
      obrero: 0
    }
  };

  // Calcular excedente de 3 UMAs si aplica
  if (sbcDiarioTopado > umaDiario * 3) {
    const excedente = sbcMensual - (umaMensual * 3);
    desglose.enfermedadesExcedente = {
      patron: excedente * (TASAS.enfermedadesMaternidad.prestacionesEspecieExcedente.patron / 100),
      obrero: excedente * (TASAS.enfermedadesMaternidad.prestacionesEspecieExcedente.obrero / 100)
    };
  }

  // Calcular totales
  let totalPatron = 0;
  let totalObrero = 0;

  for (const concepto in desglose) {
    totalPatron += desglose[concepto].patron;
    totalObrero += desglose[concepto].obrero;
  }

  // Obtener cuota social (aportación del gobierno)
  let cuotaSocialMensual = 0;
  const cuotaSocialAnio = db.cuotaSocial.cuotas_por_rango_sbc[anioStr];
  if (cuotaSocialAnio && cuotaSocialAnio[rangoUMA]) {
    cuotaSocialMensual = cuotaSocialAnio[rangoUMA].monto_mensual * (diasTrabajadosMes / 30.4);
  }

  return {
    datosEntrada: {
      salarioMensual,
      diasPorSemana,
      zona,
      zonaDescripcion: zona === 'frontera' ? 'Zona Libre de la Frontera Norte' : 'Resto del País',
      incluirInfonavit,
      anio
    },
    valoresReferencia: {
      umaDiario,
      umaMensual,
      salarioMinimoDiario,
      salarioMinimoMensual,
      topeSBC,
      factorIntegracion
    },
    calculo: {
      diasTrabajadosMes: Number(diasTrabajadosMes.toFixed(2)),
      salarioDiario: Number(salarioDiario.toFixed(2)),
      salarioDiarioAjustado: Number(salarioDiarioMinimo.toFixed(2)),
      sbcDiario: Number(sbcDiario.toFixed(2)),
      sbcDiarioTopado: Number(sbcDiarioTopado.toFixed(2)),
      sbcMensual: Number(sbcMensual.toFixed(2)),
      sbcEnUMAs: Number(sbcEnUMAs.toFixed(2)),
      rangoUMA
    },
    tasasCEAV: {
      patron: ceavRango.patron,
      obrero: ceavRango.obrero
    },
    desglose: Object.fromEntries(
      Object.entries(desglose).map(([key, val]) => [
        key,
        {
          patron: Number(val.patron.toFixed(2)),
          obrero: Number(val.obrero.toFixed(2))
        }
      ])
    ),
    totales: {
      patron: Number(totalPatron.toFixed(2)),
      obrero: Number(totalObrero.toFixed(2)),
      total: Number((totalPatron + totalObrero).toFixed(2)),
      cuotaSocial: Number(cuotaSocialMensual.toFixed(2))
    },
    resumen: {
      pagoMensualPatron: Number(totalPatron.toFixed(2)),
      deduccionMensualObrero: Number(totalObrero.toFixed(2)),
      aportacionGobierno: Number(cuotaSocialMensual.toFixed(2)),
      totalAportacionMensual: Number((totalPatron + totalObrero + cuotaSocialMensual).toFixed(2))
    }
  };
}

/**
 * Obtener información general sobre el programa de Trabajadoras del Hogar
 */
export function obtenerInfoTrabajadorasHogar() {
  return {
    nombre: "Seguro de Personas Trabajadoras del Hogar",
    descripcion: "Programa del IMSS que brinda seguridad social a las personas que trabajan en el hogar (limpieza, cocina, cuidado de personas, jardinería, etc.)",
    obligatorio: true,
    vigenciaObligatoriedad: "Desde 2022 es obligatorio para todos los empleadores",
    beneficios: [
      "Atención médica, hospitalaria y maternidad",
      "Incapacidades temporales (pago del 60% del salario)",
      "Pensión por invalidez y vida",
      "Pensión por cesantía o vejez",
      "Guarderías",
      "Prestaciones sociales",
      "Ahorro para el retiro (AFORE)",
      "Crédito de vivienda (INFONAVIT - opcional)"
    ],
    requisitosPatron: [
      "Dar de alta a la trabajadora en el IMSS",
      "Pagar las cuotas obrero-patronales mensualmente",
      "Registrar días y horas trabajadas",
      "Proporcionar alta y baja cuando corresponda"
    ],
    requisitosObrero: [
      "CURP vigente",
      "Acta de nacimiento",
      "Comprobante de domicilio",
      "Identificación oficial"
    ],
    diasMinimos: 1,
    diasMaximos: 7,
    notas: [
      "Las cuotas se calculan según días trabajados por semana",
      "El patrón puede deducir la parte obrera del salario",
      "Se recomienda incluir INFONAVIT para acceso a crédito de vivienda",
      "El salario no puede ser menor al salario mínimo proporcional"
    ],
    enlacesUtiles: [
      { nombre: "Portal IMSS", url: "https://www.imss.gob.mx/personas-trabajadoras-hogar" },
      { nombre: "Alta en línea", url: "https://serviciosdigitales.imss.gob.mx/portal-web/portal" }
    ]
  };
}

export default {
  calcularTrabajadorasHogar,
  obtenerInfoTrabajadorasHogar
};

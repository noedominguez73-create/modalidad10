/**
 * Calculadora de Modalidad 40 IMSS
 *
 * La Modalidad 40 permite a trabajadores que dejaron de cotizar
 * continuar aportando voluntariamente para mejorar su pensión.
 *
 * Aplica principalmente para Ley 73 (antes del 1 de julio de 1997)
 *
 * v3.5 - Carga dinámica de UMA y tasas CEAV
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
    const ceavPath = join(__dirname, '..', 'database', 'cesantia-vejez.json');

    const umaData = JSON.parse(readFileSync(umaPath, 'utf8'));
    let ceavData = null;

    if (existsSync(ceavPath)) {
      ceavData = JSON.parse(readFileSync(ceavPath, 'utf8'));
    }

    const anioActual = new Date().getFullYear().toString();
    const uma = umaData.historico[anioActual] || umaData.historico['2026'];

    // Obtener tasa total de Modalidad 40 para el año actual
    let tasaMod40 = 10.075; // Valor por defecto
    if (ceavData && ceavData.modalidad_40_tasa_total) {
      tasaMod40 = ceavData.modalidad_40_tasa_total[anioActual] || 14.438; // 2026
    }

    return {
      UMA_DIARIO: uma.diario,
      TOPE_SALARIAL: uma.diario * 25,
      PORCENTAJE_CUOTA: tasaMod40 / 100,
      anio: parseInt(anioActual)
    };
  } catch (e) {
    console.error('Error cargando datos de referencia Mod40:', e.message);
    // Valores por defecto 2026
    return {
      UMA_DIARIO: 117.31,
      TOPE_SALARIAL: 117.31 * 25,
      PORCENTAJE_CUOTA: 14.438 / 100,
      anio: 2026
    };
  }
}

// Cargar datos al iniciar
const datosRef = cargarDatosReferencia();
const UMA_2025 = datosRef.UMA_DIARIO;
const TOPE_SALARIAL = datosRef.TOPE_SALARIAL;
const PORCENTAJE_CUOTA = datosRef.PORCENTAJE_CUOTA;
const SEMANAS_MINIMAS_PENSION = 500;
const SEMANAS_MINIMAS_INSCRIPCION = 52;
const EDAD_MAXIMA_INSCRIPCION = 60;

/**
 * Valida elegibilidad para inscribirse en Modalidad 40
 * Basado en Artículo 218 LSS
 */
export function validarElegibilidadMod40(datos) {
  const {
    fechaNacimiento,
    semanasUltimos5Anos,
    tienePatronActual = false,
    fechaBajaIMSS
  } = datos;

  const errores = [];
  const advertencias = [];

  // 1. Validar que no tenga patrón actual
  if (tienePatronActual) {
    errores.push({
      codigo: 'PATRON_ACTIVO',
      mensaje: 'No puede inscribirse en Modalidad 40 si tiene una relación laboral vigente',
      articulo: 'Art. 218 LSS'
    });
  }

  // 2. Validar semanas mínimas en últimos 5 años
  if (semanasUltimos5Anos !== undefined && semanasUltimos5Anos < SEMANAS_MINIMAS_INSCRIPCION) {
    errores.push({
      codigo: 'SEMANAS_INSUFICIENTES',
      mensaje: `Necesita mínimo ${SEMANAS_MINIMAS_INSCRIPCION} semanas cotizadas en los últimos 5 años. Tiene: ${semanasUltimos5Anos}`,
      articulo: 'Art. 218 LSS'
    });
  }

  // 3. Validar edad máxima de inscripción
  if (fechaNacimiento) {
    const edadActual = calcularEdad(new Date(fechaNacimiento), new Date());
    if (edadActual >= EDAD_MAXIMA_INSCRIPCION) {
      advertencias.push({
        codigo: 'EDAD_LIMITE',
        mensaje: `La inscripción después de los ${EDAD_MAXIMA_INSCRIPCION} años limita los beneficios. Edad actual: ${edadActual}`,
        articulo: 'Art. 218 LSS',
        tipo: 'advertencia'
      });
    }
  }

  // 4. Validar plazo desde la baja (5 años máximo)
  if (fechaBajaIMSS) {
    const fechaBaja = new Date(fechaBajaIMSS);
    const hoy = new Date();
    const añosTranscurridos = (hoy - fechaBaja) / (1000 * 60 * 60 * 24 * 365);

    if (añosTranscurridos > 5) {
      errores.push({
        codigo: 'PLAZO_EXCEDIDO',
        mensaje: `Han pasado más de 5 años desde su baja del IMSS (${Math.floor(añosTranscurridos)} años). Debe solicitar reconocimiento de derechos.`,
        articulo: 'Art. 218 LSS'
      });
    }
  }

  return {
    elegible: errores.length === 0,
    errores,
    advertencias,
    requisitos: {
      semanasMinimas: SEMANAS_MINIMAS_INSCRIPCION,
      edadMaxima: EDAD_MAXIMA_INSCRIPCION,
      plazoMaximoAños: 5
    }
  };
}

export function calcularModalidad40(datos) {
  const {
    fechaNacimiento,
    semanasActuales,
    salarioDeseado,
    salarioPromedio5Anos,
    fechaInicioModalidad,
    edadRetiro = 65,
    regimenLey = '73',  // '73' o '97'
    saldoAfore = 0,     // Para cálculo Ley 97
    semanasUltimos5Anos,
    tienePatronActual,
    fechaBajaIMSS
  } = datos;

  // Validaciones básicas
  if (!fechaNacimiento || !semanasActuales || !salarioDeseado) {
    throw new Error('Faltan datos obligatorios: fechaNacimiento, semanasActuales, salarioDeseado');
  }

  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edadActual = calcularEdad(nacimiento, hoy);

  // Validar elegibilidad si se proporcionan datos adicionales
  let elegibilidad = null;
  if (semanasUltimos5Anos !== undefined || tienePatronActual !== undefined || fechaBajaIMSS) {
    elegibilidad = validarElegibilidadMod40({
      fechaNacimiento,
      semanasUltimos5Anos,
      tienePatronActual,
      fechaBajaIMSS
    });
  }

  // Calcular fecha de retiro
  const fechaRetiro = new Date(nacimiento);
  fechaRetiro.setFullYear(fechaRetiro.getFullYear() + edadRetiro);

  // Semanas restantes hasta el retiro
  const inicioModalidad = fechaInicioModalidad ? new Date(fechaInicioModalidad) : hoy;
  const semanasRestantes = calcularSemanasEntre(inicioModalidad, fechaRetiro);
  const semanasFinales = parseInt(semanasActuales) + semanasRestantes;

  // Salario base de cotización (máximo 25 UMAs)
  const salarioDiario = Math.min(parseFloat(salarioDeseado), TOPE_SALARIAL);
  const salarioMensual = salarioDiario * 30;

  // Cuota mensual a pagar
  const cuotaMensual = salarioMensual * PORCENTAJE_CUOTA;
  const cuotaAnual = cuotaMensual * 12;

  // Meses hasta el retiro
  const mesesHastaRetiro = Math.max(0, Math.ceil((fechaRetiro - inicioModalidad) / (1000 * 60 * 60 * 24 * 30)));
  const inversionTotal = cuotaMensual * mesesHastaRetiro;

  // Calcular pensión según régimen de ley
  let pensionEstimada;
  let pensionLey97 = null;
  let comparativaLeyes = null;

  if (regimenLey === '73' || regimenLey === 'ambas') {
    // Cálculo Ley 73
    pensionEstimada = calcularPensionLey73({
      semanasFinales,
      salarioDiario,
      salarioPromedio5Anos: salarioPromedio5Anos || salarioDiario,
      edadRetiro
    });
  }

  if (regimenLey === '97' || regimenLey === 'ambas') {
    // Cálculo Ley 97 (basado en AFORE)
    pensionLey97 = calcularPensionLey97({
      saldoAfore,
      semanasFinales,
      edadRetiro,
      aportacionMensualMod40: salarioMensual * PORCENTAJE_CUOTA,
      mesesRestantes: mesesHastaRetiro
    });
  }

  // Si el usuario puede elegir entre ambas leyes
  if (regimenLey === 'ambas' && pensionEstimada && pensionLey97) {
    comparativaLeyes = {
      ley73: {
        pensionMensual: redondear(pensionEstimada.pensionMensual),
        tipo: 'Vitalicia, pagada por gobierno',
        ventajas: ['Pensión garantizada de por vida', 'Incluye aguinaldo', 'Beneficia a herederos']
      },
      ley97: {
        pensionMensual: redondear(pensionLey97.pensionMensual),
        tipo: 'Basada en saldo AFORE',
        ventajas: ['Saldo es heredable', 'Puede retirarse en una exhibición si saldo es bajo']
      },
      recomendacion: pensionEstimada.pensionMensual > pensionLey97.pensionMensual
        ? 'LEY 73 - Mayor pensión mensual vitalicia'
        : 'LEY 97 - Mayor saldo acumulado en AFORE'
    };
  }

  // Si solo es Ley 97, usar esa como pensión principal
  if (regimenLey === '97' && !pensionEstimada) {
    pensionEstimada = pensionLey97;
  }

  // Calcular escenarios comparativos
  const escenarios = calcularEscenarios(datos, semanasActuales, edadRetiro, nacimiento);

  // Construir respuesta
  const resultado = {
    advertenciaImportante: {
      mensaje: "La Modalidad 40 NO incluye servicio médico. No podrá atenderse en clínicas del IMSS.",
      alternativa: "Si necesita servicio médico + acumular semanas, considere Modalidad 10.",
      articulo: "Art. 218 LSS"
    },
    datosPersonales: {
      edadActual,
      fechaRetiro: fechaRetiro.toISOString().split('T')[0],
      anosParaRetiro: edadRetiro - edadActual,
      regimenLey: regimenLey === 'ambas' ? 'Puede elegir (cotizó antes y después de 1997)' : `Ley ${regimenLey}`
    },
    semanas: {
      actuales: parseInt(semanasActuales),
      aCotizar: semanasRestantes,
      finales: semanasFinales,
      porcentajePension: calcularPorcentajeSemanas(semanasFinales),
      cumpleMinimoPension: semanasFinales >= SEMANAS_MINIMAS_PENSION
    },
    cuotas: {
      salarioDiarioRegistrado: salarioDiario,
      salarioMensualRegistrado: salarioMensual,
      cuotaMensual: redondear(cuotaMensual),
      cuotaAnual: redondear(cuotaAnual),
      mesesAPagar: mesesHastaRetiro,
      inversionTotal: redondear(inversionTotal)
    },
    pension: {
      mensualEstimada: redondear(pensionEstimada.pensionMensual),
      factorEdad: pensionEstimada.factorEdad,
      porcentajeSemanas: pensionEstimada.porcentajeSemanas,
      salarioBaseCalculo: redondear(pensionEstimada.salarioBaseCalculo),
      aguinaldo: redondear(pensionEstimada.pensionMensual * 0.5), // 15 días
      pensionAnual: redondear(pensionEstimada.pensionMensual * 12 + pensionEstimada.pensionMensual * 0.5)
    },
    analisisInversion: {
      inversionTotal: redondear(inversionTotal),
      pensionMensual: redondear(pensionEstimada.pensionMensual),
      recuperacionEnMeses: Math.ceil(inversionTotal / pensionEstimada.pensionMensual),
      rendimientoAnual: redondear((pensionEstimada.pensionMensual * 12 / inversionTotal) * 100)
    },
    escenarios
  };

  // Agregar elegibilidad si se validó
  if (elegibilidad) {
    resultado.elegibilidad = elegibilidad;
  }

  // Agregar comparativa de leyes si aplica
  if (comparativaLeyes) {
    resultado.comparativaLeyes = comparativaLeyes;
  }

  // Agregar cálculo Ley 97 si se calculó por separado
  if (pensionLey97 && regimenLey !== '97') {
    resultado.pensionLey97 = {
      saldoAforeProyectado: redondear(pensionLey97.saldoProyectado),
      pensionMensualEstimada: redondear(pensionLey97.pensionMensual),
      nota: 'Basado en retiro programado con esperanza de vida de 85 años'
    };
  }

  return resultado;
}

/**
 * Calcula pensión estimada bajo Ley 97 (AFORE)
 */
function calcularPensionLey97({ saldoAfore, semanasFinales, edadRetiro, aportacionMensualMod40, mesesRestantes }) {
  // Rendimiento anual promedio AFORE (conservador)
  const rendimientoAnual = 0.05; // 5% real
  const rendimientoMensual = rendimientoAnual / 12;

  // Proyectar saldo AFORE con aportaciones Mod 40
  // Nota: Mod 40 solo aporta a RCV, no directamente al AFORE personal
  // Pero sumamos un estimado del 6.5% que va a cuenta individual
  const aportacionReal = aportacionMensualMod40 * 0.065 / 0.10075; // ~6.5% del SBC va a cuenta individual

  let saldoProyectado = saldoAfore || 0;
  for (let i = 0; i < mesesRestantes; i++) {
    saldoProyectado = saldoProyectado * (1 + rendimientoMensual) + aportacionReal;
  }

  // Calcular pensión mensual (retiro programado)
  // Esperanza de vida promedio: 85 años
  const mesesDeRetiro = (85 - edadRetiro) * 12;
  const pensionMensual = saldoProyectado / mesesDeRetiro;

  return {
    saldoProyectado,
    pensionMensual,
    mesesDeRetiro,
    factorEdad: 1, // No aplica en Ley 97
    porcentajeSemanas: 0, // No aplica en Ley 97
    salarioBaseCalculo: 0 // No aplica en Ley 97
  };
}

function calcularPensionLey73({ semanasFinales, salarioDiario, salarioPromedio5Anos, edadRetiro }) {
  // Factor por edad (60-65 años)
  const factoresEdad = {
    60: 0.75,
    61: 0.80,
    62: 0.85,
    63: 0.90,
    64: 0.95,
    65: 1.00
  };
  const factorEdad = factoresEdad[Math.min(Math.max(edadRetiro, 60), 65)] || 1.00;

  // Porcentaje por semanas cotizadas
  const porcentajeSemanas = calcularPorcentajeSemanas(semanasFinales);

  // El salario base es el promedio de los últimos 5 años
  // Para Modalidad 40, generalmente es el salario registrado
  const salarioBaseCalculo = salarioPromedio5Anos * 30; // Mensual

  // Cuantía básica + incrementos
  // Fórmula: Salario * (porcentajeSemanas/100) * factorEdad
  const pensionMensual = salarioBaseCalculo * (porcentajeSemanas / 100) * factorEdad;

  return {
    pensionMensual: Math.max(pensionMensual, UMA_2025 * 30 * 0.5), // Mínimo garantizado
    factorEdad,
    porcentajeSemanas,
    salarioBaseCalculo
  };
}

function calcularPorcentajeSemanas(semanas) {
  if (semanas < 500) return 0;

  let porcentaje = 0;

  if (semanas >= 500 && semanas <= 1000) {
    // De 500 a 1000: 1.25% por cada 52 semanas
    porcentaje = ((semanas - 500) / 52) * 1.25;
  } else if (semanas > 1000 && semanas <= 1250) {
    // De 1000 a 1250: se suma 1.50% por cada 52 semanas
    porcentaje = 12.019 + ((semanas - 1000) / 52) * 1.50;
  } else if (semanas > 1250 && semanas <= 1500) {
    // De 1250 a 1500: se suma 1.75% por cada 52 semanas
    porcentaje = 19.231 + ((semanas - 1250) / 52) * 1.75;
  } else if (semanas > 1500) {
    // Más de 1500: se suma 2.00% por cada 52 semanas
    porcentaje = 27.404 + ((semanas - 1500) / 52) * 2.00;
  }

  return Math.min(porcentaje, 100); // Máximo 100%
}

function calcularEscenarios(datos, semanasActuales, edadRetiroBase, fechaNacimiento) {
  const escenarios = [];
  const salarios = [
    { nombre: 'Salario Mínimo (1 UMA)', diario: UMA_2025 },
    { nombre: 'Salario Medio (10 UMAs)', diario: UMA_2025 * 10 },
    { nombre: 'Salario Alto (15 UMAs)', diario: UMA_2025 * 15 },
    { nombre: 'Salario Topado (25 UMAs)', diario: TOPE_SALARIAL }
  ];

  for (const salario of salarios) {
    const pension = calcularPensionLey73({
      semanasFinales: parseInt(semanasActuales) + 260, // +5 años
      salarioDiario: salario.diario,
      salarioPromedio5Anos: salario.diario,
      edadRetiro: edadRetiroBase
    });

    const cuotaMensual = salario.diario * 30 * PORCENTAJE_CUOTA;

    escenarios.push({
      nombre: salario.nombre,
      salarioDiario: redondear(salario.diario),
      salarioMensual: redondear(salario.diario * 30),
      cuotaMensual: redondear(cuotaMensual),
      pensionEstimada: redondear(pension.pensionMensual)
    });
  }

  return escenarios;
}

function calcularEdad(fechaNacimiento, fechaActual) {
  let edad = fechaActual.getFullYear() - fechaNacimiento.getFullYear();
  const mes = fechaActual.getMonth() - fechaNacimiento.getMonth();
  if (mes < 0 || (mes === 0 && fechaActual.getDate() < fechaNacimiento.getDate())) {
    edad--;
  }
  return edad;
}

function calcularSemanasEntre(fechaInicio, fechaFin) {
  const diffTime = Math.abs(fechaFin - fechaInicio);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

function redondear(numero) {
  return Math.round(numero * 100) / 100;
}

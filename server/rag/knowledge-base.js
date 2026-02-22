/**
 * BASE DE CONOCIMIENTO PARA RAG
 * Artículos relevantes de la Ley del Seguro Social
 */

export const LEY_SEGURO_SOCIAL = {
  modalidad_40: {
    articulo: "218",
    titulo: "Continuación Voluntaria en el Régimen Obligatorio",
    contenido: `
      Los asegurados que hayan dejado de estar sujetos al régimen obligatorio pueden
      continuar voluntariamente en el mismo, con el fin de incrementar las semanas
      de cotización y mejorar el salario base de cotización para el cálculo de su
      pensión.

      ⚠️ IMPORTANTE: La Modalidad 40 NO incluye servicio médico.
      NO puedes atenderte en clínicas del IMSS mientras estés en esta modalidad.
      Solo sirve para acumular semanas y mejorar tu salario promedio para pensión.

      Si necesitas servicio médico Y acumular semanas → usa Modalidad 10.

      REQUISITOS:
      1. Haber cotizado un mínimo de 52 semanas en los últimos 5 años
      2. No estar sujeto a una relación de trabajo
      3. Presentar solicitud dentro de los 5 años siguientes a la baja

      CUOTA: El asegurado cubrirá íntegramente la cuota que corresponde a los
      seguros de Invalidez y Vida, Retiro, Cesantía en Edad Avanzada y Vejez.

      CUBRE:
      ✅ Invalidez y Vida
      ✅ Retiro, Cesantía en Edad Avanzada y Vejez

      NO CUBRE:
      ❌ Enfermedades y Maternidad (NO hay servicio médico)
      ❌ Guarderías
      ❌ Prestaciones en especie
    `,
    porcentaje: "10.075% del salario base de cotización registrado"
  },

  modalidad_10: {
    articulo: "13",
    titulo: "Incorporación Voluntaria al Régimen Obligatorio",
    contenido: `
      Voluntariamente podrán ser sujetos de aseguramiento al régimen obligatorio:

      I. Los trabajadores en industrias familiares y los independientes
      II. Los trabajadores domésticos
      III. Los ejidatarios, comuneros, colonos y pequeños propietarios
      IV. Los patrones personas físicas con trabajadores asegurados a su servicio
      V. Los trabajadores al servicio de las administraciones públicas

      ✅ VENTAJA PRINCIPAL: La Modalidad 10 ofrece COBERTURA COMPLETA:
      - Servicio médico en clínicas IMSS (te puedes atender)
      - Acumulación de semanas para pensión
      - Es la opción ideal para independientes/freelancers

      DIFERENCIA CON MODALIDAD 40:
      - Mod 10: SÍ médico + SÍ pensión (más caro, cobertura completa)
      - Mod 40: NO médico + SÍ pensión (más barato, solo para jubilación)

      La incorporación voluntaria comprende los seguros de:
      ✅ Enfermedades y Maternidad (SERVICIO MÉDICO)
      ✅ Invalidez y Vida
      ✅ Retiro, Cesantía en Edad Avanzada y Vejez
      ✅ Guarderías (si aplica)
      ✅ Riesgo de Trabajo
    `
  },

  modalidad_33: {
    articulo: "240-242",
    titulo: "Seguro de Salud para la Familia",
    contenido: `
      DEFINICIÓN:
      Seguro voluntario que permite a personas no afiliadas al régimen obligatorio
      obtener cobertura médica del IMSS para toda su familia.

      IMPORTANTE: NO suma semanas para pensión. Solo cubre atención médica.

      COBERTURA:
      - Enfermedades y Maternidad únicamente
      - NO incluye guarderías
      - NO incluye prestaciones en dinero
      - NO genera derechos de pensión

      CUOTAS ANUALES (% del UMA anual):
      - Menores de 19 años: 4.36%
      - 20 a 39 años: 7.72%
      - 40 a 59 años: 10.35%
      - 60 años y más: 16.15%
      - Cuota de inscripción (única): 10.82%

      REQUISITOS:
      1. No estar afiliado al régimen obligatorio
      2. No tener derecho a servicios médicos del IMSS por otra vía
      3. Aprobar examen médico de admisión
      4. Realizar pago anual anticipado

      PERÍODOS DE ESPERA:
      - 30 días para atención general
      - 10 meses para maternidad
      - 12 meses para enfermedades preexistentes

      ¿PARA QUIÉN ES ÚTIL?
      - Freelancers que solo necesitan seguro médico
      - Familias de trabajadores en el extranjero
      - Personas con ingresos variables
      - Quienes ya tienen semanas suficientes para pensión
    `
  },

  pension_cesantia_ley73: {
    articulo: "143",
    titulo: "Pensión por Cesantía en Edad Avanzada (Ley 73)",
    contenido: `
      Para tener derecho al goce de las prestaciones del seguro de cesantía en
      edad avanzada, se requiere que el asegurado:

      I. Haya cumplido 60 años de edad
      II. Haya quedado privado de trabajo remunerado
      III. Tenga reconocidas un mínimo de 500 semanas de cotización

      CUANTÍA DE LA PENSIÓN:
      Se compondrá de una cuantía básica y de incrementos anuales computados
      según el número de cotizaciones semanales reconocidas al asegurado.

      FACTORES POR EDAD:
      - A los 60 años: 75% de la cuantía
      - A los 61 años: 80%
      - A los 62 años: 85%
      - A los 63 años: 90%
      - A los 64 años: 95%
      - A los 65 años: 100%
    `
  },

  pension_vejez_ley73: {
    articulo: "138",
    titulo: "Pensión por Vejez (Ley 73)",
    contenido: `
      Para tener derecho al goce de las prestaciones del seguro de vejez,
      se requiere que el asegurado:

      I. Haya cumplido 65 años de edad
      II. Tenga reconocidas un mínimo de 500 semanas de cotización

      El asegurado podrá diferir o anticipar el disfrute de la pensión,
      en los términos de esta Ley.
    `
  },

  calculo_pension_ley73: {
    articulo: "167",
    titulo: "Cálculo del Salario Base para Pensión",
    contenido: `
      Para calcular la pensión, el salario diario se obtiene dividiendo
      entre trescientos sesenta y cinco el total de las remuneraciones
      percibidas por el asegurado en los últimos cinco años calendario
      anteriores al otorgamiento de la pensión.

      SALARIO PROMEDIO = Suma de salarios últimos 5 años / 1825 días

      NOTA: Al inscribirse en Modalidad 40, el asegurado puede registrar
      un salario mayor al que tenía, hasta el tope de 25 UMAs, lo que
      incrementa significativamente el promedio de los últimos 5 años.
    `
  },

  tabla_incrementos: {
    articulo: "Tabla del artículo 167",
    titulo: "Porcentajes por Semanas Cotizadas",
    contenido: `
      CUANTÍA BÁSICA MÁS INCREMENTOS:

      | Semanas Cotizadas | Incremento por cada 52 semanas |
      |-------------------|--------------------------------|
      | 500 - 1000        | 1.25%                          |
      | 1000 - 1250       | 1.50%                          |
      | 1250 - 1500       | 1.75%                          |
      | 1500 en adelante  | 2.00%                          |

      La pensión no podrá ser superior al 100% del salario promedio.
      La pensión mínima será equivalente al salario mínimo general vigente.
    `
  },

  ley97_diferencias: {
    articulo: "Transitorios 1997",
    titulo: "Diferencias entre Ley 73 y Ley 97",
    contenido: `
      LEY 73 (antes del 1 de julio de 1997):
      - Pensión calculada por el IMSS
      - Basada en semanas cotizadas + salario promedio 5 años
      - Pago vitalicio por el gobierno
      - Puede mejorarse con Modalidad 40

      LEY 97 (a partir del 1 de julio de 1997):
      - Pensión de tu cuenta AFORE
      - Depende de cuánto ahorraste + rendimientos
      - Puedes contratar renta vitalicia o retiro programado
      - Modalidad 40 solo suma semanas, no mejora AFORE directamente

      DERECHO A ELEGIR:
      Los trabajadores que cotizaron antes de 1997 y después de esa fecha
      tienen derecho a elegir entre el régimen de la Ley 73 o la Ley 97
      al momento de pensionarse.
    `
  },

  // ============================================
  // PENSIONES POR FALLECIMIENTO DEL ASEGURADO
  // ============================================

  pension_viudez: {
    articulo: "127-130",
    titulo: "Pensión por Viudez",
    contenido: `
      DEFINICIÓN:
      Prestación económica otorgada al cónyuge o concubino(a) sobreviviente
      cuando fallece un asegurado o pensionado por invalidez.

      PORCENTAJE: 90% de la pensión que hubiera correspondido al asegurado
      por invalidez, o la que venía disfrutando el pensionado.

      REQUISITOS DEL FALLECIDO:
      - Mínimo 150 semanas cotizadas, O
      - Estar pensionado por invalidez, O
      - Fallecimiento por riesgo de trabajo (sin mínimo de semanas)

      ORDEN DE PRIORIDAD (Art. 130 LSS):
      1. CÓNYUGE: Tiene prioridad automática (esposa/esposo legal)
      2. CONCUBINA/O: Solo si no hay cónyuge, requiere:
         - 5 años de convivencia antes de la muerte, O
         - Haber tenido hijos en común
         - Ambos libres de matrimonio durante el concubinato

      ⚠️ RESTRICCIÓN: Si hay varias concubinas, NINGUNA tiene derecho.

      DURACIÓN DEL DERECHO:
      - Vitalicia mientras no contraiga nuevo matrimonio o concubinato
      - Si se casa: Recibe 3 anualidades como finiquito

      DOCUMENTOS REQUERIDOS:
      - Acta de defunción del asegurado
      - Acta de matrimonio o constancia de concubinato
      - Identificación oficial
      - Comprobante de domicilio
      - Estado de cuenta AFORE (si aplica)
    `
  },

  pension_orfandad: {
    articulo: "134-135",
    titulo: "Pensión por Orfandad",
    contenido: `
      DEFINICIÓN:
      Prestación económica para hijos del asegurado o pensionado fallecido.

      PORCENTAJES:
      - Huérfano de UN padre: 20% de la pensión de invalidez
      - Huérfano de AMBOS padres: 30% de la pensión de invalidez
      - LÍMITE: La suma de pensiones no puede exceder 100%

      REQUISITOS DEL FALLECIDO:
      - Mínimo 150 semanas cotizadas, O
      - Estar pensionado por invalidez

      EDADES LÍMITE:
      - Hasta 16 años: Derecho automático
      - De 16 a 25 años: Solo si está estudiando en escuela del sistema
        educativo nacional y no está en régimen obligatorio IMSS
      - Sin límite de edad: Si tiene incapacidad total permanente

      DOCUMENTOS PARA ESTUDIANTES:
      - Constancia de estudios vigente
      - Comprobante de inscripción del período escolar

      CAUSAS DE TERMINACIÓN:
      - Cumplir 16 años (o 25 si estudia)
      - Contraer matrimonio
      - Dejar de estudiar (mayores de 16)
      - Obtener empleo formal (régimen obligatorio IMSS)

      TRÁMITE:
      El representante legal del menor debe solicitar la pensión
      en la subdelegación del IMSS correspondiente.
    `
  },

  pension_ascendientes: {
    articulo: "137",
    titulo: "Pensión por Ascendientes (Padres)",
    contenido: `
      DEFINICIÓN:
      Pensión otorgada a los padres del asegurado fallecido cuando NO existen
      cónyuge, concubino(a) ni hijos con derecho a pensión.

      PORCENTAJE ORIGINAL: 20% para cada padre

      ⚠️ CAMBIO IMPORTANTE (2023):
      La Suprema Corte de Justicia determinó que es discriminatorio
      dar 90% a viudos y solo 20% a padres.

      NUEVO PORCENTAJE: 90% (igual que viudez)
      Aplica si acreditan DEPENDENCIA ECONÓMICA del asegurado fallecido.

      REQUISITOS:
      1. No exista cónyuge/concubino(a) con derecho
      2. No existan hijos con derecho a pensión
      3. Acreditar dependencia económica del fallecido
      4. El asegurado debía tener mínimo 150 semanas cotizadas

      DOCUMENTOS REQUERIDOS:
      - Acta de nacimiento del asegurado (prueba parentesco)
      - Acta de defunción
      - Comprobantes de dependencia económica
      - Declaración de inexistencia de otros beneficiarios
      - Identificación oficial de los padres

      IMPORTANTE:
      Se otorga a CADA padre que cumpla requisitos, no es compartida.
    `
  },

  pension_invalidez: {
    articulo: "119-126",
    titulo: "Pensión por Invalidez",
    contenido: `
      DEFINICIÓN:
      Existe invalidez cuando el asegurado se encuentra imposibilitado para
      procurarse, mediante un trabajo igual, una remuneración superior al 50%
      de su remuneración habitual, y que esa imposibilidad derive de una
      enfermedad o accidente NO de trabajo.

      TIPOS DE INVALIDEZ:
      - Temporal: Puede recuperarse con tratamiento
      - Permanente: No hay posibilidad de recuperación

      REQUISITOS SEGÚN GRADO:
      - Invalidez ≥75%: Mínimo 150 semanas cotizadas
      - Invalidez <75%: Mínimo 250 semanas cotizadas

      CÁLCULO DE LA PENSIÓN:
      - Base: 35% del salario promedio de las últimas 500 semanas
      - + Asignaciones familiares (esposa 15%, hijos 10% c/u)
      - + Ayuda asistencial (si vive solo: 15%)

      DICTAMEN MÉDICO:
      El IMSS realiza evaluación médica para determinar:
      - Grado de invalidez (porcentaje)
      - Tipo (temporal o permanente)
      - Si es derivada de riesgo de trabajo o no

      PENSIONES DERIVADAS (si fallece el pensionado):
      Los beneficiarios tienen derecho a viudez, orfandad o ascendientes.

      INCREMENTOS:
      Se actualizan anualmente en febrero según inflación (INPC).
    `
  },

  pension_incapacidad_trabajo: {
    articulo: "58-62",
    titulo: "Pensión por Incapacidad Permanente (Riesgo de Trabajo)",
    contenido: `
      DEFINICIÓN:
      Pensión otorgada cuando un accidente o enfermedad RELACIONADA CON EL
      TRABAJO causa incapacidad permanente total o parcial.

      ⚠️ IMPORTANTE: NO requiere mínimo de semanas cotizadas.

      TIPOS:
      1. INCAPACIDAD PERMANENTE TOTAL:
         - Pérdida de facultades que impide todo trabajo
         - Pensión = 70% del salario cotizado

      2. INCAPACIDAD PERMANENTE PARCIAL:
         - Disminución parcial de facultades
         - Pensión proporcional al grado de incapacidad

      DIFERENCIA CON INVALIDEZ:
      - Riesgo de trabajo: Accidente/enfermedad laboral
      - Invalidez: Accidente/enfermedad NO laboral

      PRESTACIONES ADICIONALES:
      - Atención médica, quirúrgica y hospitalaria
      - Aparatos de prótesis y ortopedia
      - Rehabilitación

      BENEFICIARIOS EN CASO DE MUERTE:
      Si el trabajador muere por riesgo de trabajo, sus beneficiarios
      reciben pensión sin importar las semanas cotizadas.
    `
  },

  // ============================================
  // SERVICIOS DE ASESORÍA Y TRÁMITES
  // ============================================

  negativa_pension: {
    articulo: "294-296",
    titulo: "Negativa de Pensión y Recursos Legales",
    contenido: `
      CAUSAS COMUNES DE NEGATIVA:
      1. Semanas cotizadas insuficientes
      2. No cumplir requisitos de edad
      3. Documentación incompleta
      4. Errores en el historial laboral
      5. Semanas no reconocidas

      RECURSOS DISPONIBLES:

      1. RECURSO DE INCONFORMIDAD (Gratuito)
         - Plazo: 15 días hábiles desde la notificación
         - Se presenta ante el Consejo Consultivo Delegacional
         - No requiere abogado
         - Regulado por Art. 294-296 LSS

      2. DEMANDA LABORAL
         - Ante Junta Federal de Conciliación y Arbitraje
         - Recomendable tener abogado
         - Para impugnar evaluaciones médicas o interpretación de ley

      3. JUICIO DE AMPARO
         - Último recurso constitucional
         - Para cuestionar la legalidad de la resolución
         - Requiere abogado especializado

      SERVICIOS DE APOYO:
      - PROFEDET: Procuraduría Federal de la Defensa del Trabajo (gratuito)
      - Módulos de atención IMSS
      - Asesorías en subdelegaciones

      DOCUMENTOS PARA RECURSO:
      - Copia de la negativa de pensión
      - Identificación oficial
      - Número de seguridad social
      - Historial laboral (si lo tienes)
    `
  },

  recuperacion_semanas: {
    articulo: "Varios",
    titulo: "Recuperación y Corrección de Semanas Cotizadas",
    contenido: `
      PROBLEMAS COMUNES:
      1. Semanas no registradas
      2. Patrones que no reportaron cotizaciones
      3. Homonimia (confusión de NSS)
      4. Duplicidad de número de seguro social
      5. Errores en datos personales

      CÓMO VERIFICAR TUS SEMANAS:
      - App IMSS Digital (descarga gratuita)
      - Portal web del IMSS
      - Llamar al 800-623-2323
      - Acudir a subdelegación IMSS

      TRÁMITES DE CORRECCIÓN:

      1. ACLARACIÓN ADMINISTRATIVA
         - Para errores menores de datos
         - Se resuelve en subdelegación

      2. SOLICITUD DE RECONOCIMIENTO DE SEMANAS
         - Cuando el patrón no reportó cotizaciones
         - Requiere: recibos de nómina, contratos, constancias

      3. CORRECCIÓN POR HOMONIMIA
         - Cuando hay confusión con otra persona
         - Requiere documentos que prueben tu identidad

      4. UNIFICACIÓN DE NSS
         - Si tienes más de un número de seguro social
         - Se unifican las semanas en un solo número

      DOCUMENTOS ÚTILES:
      - Recibos de nómina antiguos
      - Constancias laborales
      - Contratos de trabajo
      - Hojas rosas (bajas patronales)
      - Cualquier documento que pruebe relación laboral
    `
  },

  tramite_pension_imss: {
    articulo: "Procedimiento",
    titulo: "Cómo Tramitar tu Pensión IMSS Paso a Paso",
    contenido: `
      PASO 1: VERIFICAR REQUISITOS
      - Edad requerida (60 cesantía, 65 vejez)
      - Semanas cotizadas (mínimo 500 Ley 73, 1000+ Ley 97 gradual)
      - Estar dado de baja del régimen obligatorio

      PASO 2: OBTENER DOCUMENTOS
      - Identificación oficial vigente (INE)
      - CURP
      - Comprobante de domicilio
      - Estado de cuenta AFORE
      - Constancia de semanas cotizadas
      - Acta de nacimiento
      - Acta de matrimonio (si aplica)

      PASO 3: PRE-SOLICITUD EN LÍNEA
      - Entrar a www.imss.gob.mx
      - Crear cuenta o iniciar sesión
      - Llenar pre-solicitud de pensión
      - Agendar cita en subdelegación

      PASO 4: ACUDIR A CITA
      - Llevar todos los documentos originales y copias
      - El IMSS verifica información
      - Se determina el régimen (Ley 73 o 97)
      - Se calcula pensión tentativa

      PASO 5: RESOLUCIÓN
      - El IMSS tiene 30 días para resolver
      - Si es positiva: Inicia pago de pensión
      - Si es negativa: Puedes interponer recurso

      TIEMPOS APROXIMADOS:
      - Pre-solicitud: 1 día
      - Cita y trámite: 2-4 horas
      - Resolución: 15-45 días
      - Primer pago: 30-60 días después de aprobación
    `
  },

  tipos_pension_resumen: {
    articulo: "Resumen",
    titulo: "Los 8 Tipos de Pensiones del IMSS",
    contenido: `
      1. CESANTÍA EN EDAD AVANZADA
         - Edad: 60-64 años
         - Semanas: 500 (Ley 73) o 850+ (Ley 97, incrementa anualmente)
         - Factor: 75% a 95% según edad

      2. VEJEZ
         - Edad: 65 años
         - Semanas: 500 (Ley 73) o 850+ (Ley 97)
         - Factor: 100%

      3. INVALIDEZ
         - Por enfermedad o accidente NO laboral
         - Semanas: 150-250 según grado de invalidez
         - Pensión: 35% del salario promedio + asignaciones

      4. INCAPACIDAD PERMANENTE (Riesgo de Trabajo)
         - Por accidente o enfermedad LABORAL
         - Sin mínimo de semanas
         - Pensión: Hasta 70% del salario

      5. VIUDEZ
         - Para cónyuge o concubino(a) sobreviviente
         - 90% de la pensión del fallecido

      6. ORFANDAD
         - Para hijos del asegurado fallecido
         - 20% (un padre) o 30% (ambos padres)
         - Hasta 16 años, o 25 si estudia

      7. ASCENDIENTES
         - Para padres del asegurado fallecido
         - 90% (fallo SCJN 2023) si hay dependencia económica
         - Solo si no hay cónyuge ni hijos

      8. RETIRO ANTICIPADO
         - Antes de los 60 años
         - Requiere saldo suficiente en AFORE
         - Solo régimen Ley 97
    `
  }
};

export const PREGUNTAS_FRECUENTES = [
  {
    pregunta: "¿Qué es la Modalidad 40?",
    respuesta: "Es un esquema del IMSS que permite a trabajadores que dejaron de cotizar continuar aportando voluntariamente para aumentar sus semanas cotizadas y mejorar su salario promedio para la pensión.",
    articulo_relacionado: "218 LSS"
  },
  {
    pregunta: "¿Puedo inscribirme en Modalidad 40 si tengo trabajo?",
    respuesta: "No. La Modalidad 40 es exclusivamente para personas que NO tienen una relación laboral vigente. Si tienes patrón, ya estás en el régimen obligatorio.",
    articulo_relacionado: "218 LSS"
  },
  {
    pregunta: "¿Cuánto tiempo puedo estar en Modalidad 40?",
    respuesta: "Puedes permanecer en Modalidad 40 hasta el momento de tu jubilación. Muchos asegurados la utilizan por 5 años para maximizar el promedio salarial de sus últimos 5 años.",
    articulo_relacionado: "218 LSS"
  },
  {
    pregunta: "¿Qué salario puedo registrar en Modalidad 40?",
    respuesta: "Puedes registrar cualquier salario desde 1 UMA hasta 25 UMAs ($113.14 a $2,828.50 diarios en 2025). No está limitado a tu último salario.",
    articulo_relacionado: "218 LSS"
  },
  {
    pregunta: "¿Me conviene más Ley 73 o Ley 97?",
    respuesta: "Generalmente, si tienes derecho a elegir (cotizaste antes y después de 1997), la Ley 73 es más conveniente si tienes muchas semanas cotizadas y un buen salario promedio, ya que ofrece una pensión vitalicia. La Ley 97 puede ser mejor si tu AFORE tiene un saldo muy alto.",
    articulo_relacionado: "Transitorios 1997"
  },
  {
    pregunta: "¿Qué pasa si muero estando en Modalidad 40?",
    respuesta: "Tus beneficiarios (esposa/o e hijos) tendrían derecho a una pensión de viudez y/u orfandad, calculada sobre tu salario registrado y semanas cotizadas.",
    articulo_relacionado: "127 LSS"
  },
  {
    pregunta: "¿Qué es la Modalidad 33?",
    respuesta: "Es el Seguro de Salud para la Familia. Permite a personas NO afiliadas al IMSS obtener cobertura médica para su familia pagando una cuota anual. IMPORTANTE: No suma semanas para pensión, solo cubre atención médica.",
    articulo_relacionado: "240-242 LSS"
  },
  {
    pregunta: "¿Cuál es la diferencia entre Modalidad 10, 40 y 33?",
    respuesta: "MODALIDAD 10: Servicio médico + acumula semanas pensión (ideal para independientes). MODALIDAD 40: Solo acumula semanas/mejora salario para pensión, SIN servicio médico. MODALIDAD 33: Solo servicio médico familiar, SIN semanas pensión. Si necesitas TODO (médico + pensión) → Mod 10. Solo pensión → Mod 40. Solo médico → Mod 33.",
    articulo_relacionado: "13, 218 y 240 LSS"
  },
  {
    pregunta: "¿La Modalidad 40 incluye servicio médico?",
    respuesta: "NO. La Modalidad 40 NO incluye servicio médico. No puedes atenderte en clínicas del IMSS mientras estés en esta modalidad. Solo sirve para acumular semanas y mejorar tu salario promedio para la pensión. Si necesitas servicio médico Y acumular semanas, debes inscribirte en Modalidad 10.",
    articulo_relacionado: "218 LSS"
  },
  {
    pregunta: "¿Puedo tener Modalidad 40 y Modalidad 33 al mismo tiempo?",
    respuesta: "Sí, es posible y a veces conveniente. La Modalidad 40 NO da servicio médico, entonces podrías pagar Mod 40 para mejorar tu pensión Y pagar Mod 33 para tener cobertura médica. Sin embargo, puede ser más económico inscribirte directamente en Modalidad 10 que te da ambas cosas.",
    articulo_relacionado: "218 y 240 LSS"
  },
  {
    pregunta: "¿Cuánto cuesta la Modalidad 33?",
    respuesta: "Depende de la edad de cada integrante: menores de 19 años pagan 4.36% del UMA anual (~$1,800), de 20-39 años 7.72% (~$3,190), de 40-59 años 10.35% (~$4,280), y 60+ años 16.15% (~$6,675). Más una cuota única de inscripción de 10.82% (~$4,470).",
    articulo_relacionado: "242 LSS"
  },
  {
    pregunta: "Soy independiente, ¿qué modalidad me conviene?",
    respuesta: "Depende de tus necesidades: (1) Si necesitas servicio médico Y quieres acumular semanas para jubilación → MODALIDAD 10 es tu mejor opción. (2) Si ya tienes seguro médico privado o por tu pareja, y solo quieres mejorar tu pensión → MODALIDAD 40 es más barata. (3) Si ya tienes suficientes semanas y solo necesitas médico → MODALIDAD 33.",
    articulo_relacionado: "13 LSS"
  },
  {
    pregunta: "¿Por qué elegiría Modalidad 40 si no tiene servicio médico?",
    respuesta: "La Modalidad 40 es útil cuando: (1) Ya tienes seguro médico por otro lado (esposo/a, seguro privado, ISSSTE, etc.). (2) Quieres maximizar tu pensión con el menor costo posible. (3) Necesitas solo mejorar tu salario promedio de los últimos 5 años. La cuota es más baja porque solo cubre pensión (10.075% vs ~25% de Mod 10).",
    articulo_relacionado: "218 LSS"
  },

  // PENSIONES POR FALLECIMIENTO
  {
    pregunta: "¿Qué es la pensión por viudez y cuánto pagan?",
    respuesta: "La pensión por viudez es el 90% de la pensión que hubiera recibido el asegurado fallecido. La recibe el cónyuge (esposa/o) o, en su defecto, la concubina/o que haya vivido 5 años con el fallecido o tenido hijos. El fallecido debía tener mínimo 150 semanas cotizadas.",
    articulo_relacionado: "127-130 LSS"
  },
  {
    pregunta: "¿Quién tiene prioridad para la pensión de viudez: esposa o concubina?",
    respuesta: "La ESPOSA (cónyuge legal) tiene prioridad automática. La concubina solo tiene derecho si NO hay esposa, y debe acreditar 5 años de convivencia o haber tenido hijos. IMPORTANTE: Si hay varias concubinas, NINGUNA recibe pensión.",
    articulo_relacionado: "130 LSS"
  },
  {
    pregunta: "¿Qué es la pensión por orfandad?",
    respuesta: "Es una pensión para los hijos del asegurado fallecido. Es el 20% de la pensión (30% si es huérfano de ambos padres). Se otorga hasta los 16 años, o hasta los 25 si el hijo está estudiando. El fallecido debía tener mínimo 150 semanas cotizadas.",
    articulo_relacionado: "134-135 LSS"
  },
  {
    pregunta: "¿Mis padres pueden recibir pensión si muero?",
    respuesta: "Sí, tus padres pueden recibir pensión de ASCENDIENTES si: (1) No dejas cónyuge/concubina con derecho, (2) No dejas hijos con derecho, (3) Dependían económicamente de ti. Gracias a un fallo de la Suprema Corte (2023), ahora reciben 90% igual que viudez, en lugar del 20% anterior.",
    articulo_relacionado: "137 LSS"
  },

  // INVALIDEZ E INCAPACIDAD
  {
    pregunta: "¿Cuál es la diferencia entre invalidez e incapacidad?",
    respuesta: "INVALIDEZ: Por enfermedad o accidente NO relacionado con el trabajo. Requiere 150-250 semanas cotizadas. INCAPACIDAD POR RIESGO DE TRABAJO: Por accidente o enfermedad LABORAL. No requiere mínimo de semanas. La incapacidad paga hasta 70% del salario.",
    articulo_relacionado: "119-126 y 58-62 LSS"
  },
  {
    pregunta: "¿Cuántas semanas necesito para pensión por invalidez?",
    respuesta: "Depende del grado de invalidez: Si tienes 75% o más de invalidez → mínimo 150 semanas. Si tienes menos de 75% de invalidez → mínimo 250 semanas. El grado lo determina el dictamen médico del IMSS.",
    articulo_relacionado: "122 LSS"
  },

  // NEGATIVA Y RECURSOS
  {
    pregunta: "¿Qué hago si el IMSS me niega la pensión?",
    respuesta: "Tienes 3 opciones: (1) RECURSO DE INCONFORMIDAD: Gratuito, 15 días para presentarlo, ante el Consejo Consultivo Delegacional. (2) DEMANDA LABORAL: Ante Junta Federal de Conciliación. (3) AMPARO: Último recurso, requiere abogado. También puedes acudir a PROFEDET para asesoría gratuita.",
    articulo_relacionado: "294-296 LSS"
  },
  {
    pregunta: "¿Cómo recupero semanas cotizadas que no aparecen?",
    respuesta: "Primero verifica tus semanas en la app IMSS Digital o portal web. Si faltan semanas: (1) Junta documentos: recibos de nómina, contratos, constancias laborales. (2) Presenta solicitud de reconocimiento en tu subdelegación IMSS. (3) El IMSS investigará y actualizará tu historial si procede.",
    articulo_relacionado: "Aclaración administrativa IMSS"
  },
  {
    pregunta: "¿Cuántas semanas necesito para pensionarme?",
    respuesta: "LEY 73: Mínimo 500 semanas (~10 años). LEY 97: En 2025 son 850 semanas, aumenta 25 cada año hasta llegar a 1,000 en 2031. Para saber tu régimen: si empezaste a cotizar ANTES del 1 de julio de 1997 = Ley 73. Si fue DESPUÉS = Ley 97.",
    articulo_relacionado: "Transitorios y Art. 143 LSS"
  },
  {
    pregunta: "¿Cuáles son los 8 tipos de pensión del IMSS?",
    respuesta: "1) Cesantía en edad avanzada (60-64 años), 2) Vejez (65 años), 3) Invalidez (enfermedad no laboral), 4) Incapacidad permanente (riesgo de trabajo), 5) Viudez (cónyuge/concubino sobreviviente), 6) Orfandad (hijos), 7) Ascendientes (padres), 8) Retiro anticipado (solo Ley 97 con saldo AFORE suficiente).",
    articulo_relacionado: "LSS Títulos II-III"
  },
  {
    pregunta: "¿Cómo tramito mi pensión en el IMSS?",
    respuesta: "1) Verifica que cumples requisitos (edad, semanas). 2) Obtén documentos: INE, CURP, comprobante domicilio, estado AFORE, constancia de semanas. 3) Haz pre-solicitud en www.imss.gob.mx y agenda cita. 4) Acude a la cita con originales y copias. 5) Espera resolución (15-45 días). El primer pago llega 30-60 días después de aprobación.",
    articulo_relacionado: "Procedimiento IMSS"
  }
];

export function buscarEnBaseConocimiento(consulta) {
  const consultaLower = consulta.toLowerCase();
  const resultados = [];

  // Buscar en artículos de ley
  for (const [key, articulo] of Object.entries(LEY_SEGURO_SOCIAL)) {
    const contenidoLower = (articulo.contenido + articulo.titulo).toLowerCase();
    if (contenidoLower.includes(consultaLower) ||
        consultaLower.includes(key.replace('_', ' '))) {
      resultados.push({
        tipo: 'articulo',
        referencia: `Artículo ${articulo.articulo}`,
        titulo: articulo.titulo,
        contenido: articulo.contenido,
        relevancia: calcularRelevancia(consulta, contenidoLower)
      });
    }
  }

  // Buscar en preguntas frecuentes
  for (const faq of PREGUNTAS_FRECUENTES) {
    const faqLower = (faq.pregunta + faq.respuesta).toLowerCase();
    if (faqLower.includes(consultaLower)) {
      resultados.push({
        tipo: 'faq',
        pregunta: faq.pregunta,
        respuesta: faq.respuesta,
        referencia: faq.articulo_relacionado,
        relevancia: calcularRelevancia(consulta, faqLower)
      });
    }
  }

  // Ordenar por relevancia
  return resultados.sort((a, b) => b.relevancia - a.relevancia);
}

function calcularRelevancia(consulta, texto) {
  const palabras = consulta.toLowerCase().split(' ');
  let score = 0;
  for (const palabra of palabras) {
    if (texto.includes(palabra)) score += 1;
  }
  return score / palabras.length;
}

export default {
  LEY_SEGURO_SOCIAL,
  PREGUNTAS_FRECUENTES,
  buscarEnBaseConocimiento
};

/**
 * Módulo de Gestión de Prospectos
 * Sistema CRM para clientes IMSS en Estados Unidos
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', '..', 'database', 'clientes-prospectos.json');

// Cargar base de datos
function cargarDB() {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error cargando DB:', e.message);
  }
  return { prospectos: [], clientes: [], pagosRecibidos: [], pagosIMSS: [], verificacionesVigencia: [] };
}

// Guardar base de datos
function guardarDB(db) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error guardando DB:', e.message);
    return false;
  }
}

// Validar CURP (formato básico)
function validarCURP(curp) {
  if (!curp) return { valido: false, mensaje: 'CURP requerido' };
  const regex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
  if (!regex.test(curp.toUpperCase())) {
    return { valido: false, mensaje: 'Formato de CURP inválido' };
  }
  return { valido: true };
}

// Validar NSS (11 dígitos)
function validarNSS(nss) {
  if (!nss) return { valido: false, mensaje: 'NSS requerido' };
  const regex = /^\d{11}$/;
  if (!regex.test(nss)) {
    return { valido: false, mensaje: 'NSS debe tener 11 dígitos' };
  }
  return { valido: true };
}

// Validar teléfono USA
function validarTelefonoUSA(telefono) {
  if (!telefono) return { valido: false, mensaje: 'Teléfono requerido' };
  const limpio = telefono.replace(/\D/g, '');
  if (limpio.length === 10 || (limpio.length === 11 && limpio.startsWith('1'))) {
    return { valido: true, formato: '+1' + limpio.slice(-10) };
  }
  return { valido: false, mensaje: 'Formato de teléfono USA inválido' };
}

/**
 * Crear nuevo prospecto
 */
export function crearProspecto(datos) {
  const {
    nombreCompleto,
    telefonoUSA,
    whatsapp,
    email,
    curp,
    nss,
    fechaNacimiento,
    modalidadInteres,
    origen = 'manual',
    notas = ''
  } = datos;

  // Validaciones básicas
  if (!nombreCompleto) {
    throw new Error('Nombre completo es requerido');
  }

  if (!telefonoUSA && !whatsapp && !email) {
    throw new Error('Se requiere al menos un método de contacto');
  }

  // Validar teléfono si se proporciona
  let telefonoFormateado = telefonoUSA;
  if (telefonoUSA) {
    const validacion = validarTelefonoUSA(telefonoUSA);
    if (!validacion.valido) {
      throw new Error(validacion.mensaje);
    }
    telefonoFormateado = validacion.formato;
  }

  // Validar CURP si se proporciona
  if (curp) {
    const validacion = validarCURP(curp);
    if (!validacion.valido) {
      throw new Error(validacion.mensaje);
    }
  }

  // Validar NSS si se proporciona
  if (nss) {
    const validacion = validarNSS(nss);
    if (!validacion.valido) {
      throw new Error(validacion.mensaje);
    }
  }

  const db = cargarDB();

  // Verificar si ya existe con mismo NSS o teléfono
  const existente = db.prospectos.find(p =>
    (nss && p.nss === nss) ||
    (telefonoFormateado && p.telefonoUSA === telefonoFormateado)
  );

  if (existente) {
    throw new Error(`Ya existe un prospecto con estos datos: ${existente.nombreCompleto}`);
  }

  const nuevoProspecto = {
    id: uuidv4(),
    fechaRegistro: new Date().toISOString(),
    origen,

    // Datos personales
    nombreCompleto: nombreCompleto.toUpperCase(),
    curp: curp ? curp.toUpperCase() : null,
    nss: nss || null,
    fechaNacimiento: fechaNacimiento || null,
    sexo: curp ? (curp.charAt(10) === 'H' ? 'Masculino' : 'Femenino') : null,

    // Contacto
    telefonoUSA: telefonoFormateado,
    telefonoMexico: null,
    whatsapp: whatsapp || telefonoFormateado,
    email: email ? email.toLowerCase() : null,
    direccionUSA: {
      calle: '',
      ciudad: '',
      estado: '',
      zipCode: ''
    },

    // Contacto emergencia México
    contactoMexico: {
      nombre: '',
      telefono: '',
      parentesco: ''
    },

    // Datos IMSS
    modalidadInteres: modalidadInteres || null,
    semanasActuales: null,
    ultimoPatron: null,
    fechaUltimaBaja: null,

    // Estatus
    estatus: 'nuevo',
    fechaUltimoContacto: null,
    siguienteContacto: new Date().toISOString(),
    intentosContacto: 0,
    canalPreferido: whatsapp ? 'whatsapp' : 'llamada',

    // Consentimientos
    consentimientoContacto: true,
    consentimientoWhatsapp: true,
    consentimientoLlamadas: true,
    fechaConsentimiento: new Date().toISOString(),

    // Notas
    notas: notas ? [{ fecha: new Date().toISOString(), texto: notas }] : [],
    historialContactos: []
  };

  db.prospectos.push(nuevoProspecto);
  guardarDB(db);

  return nuevoProspecto;
}

/**
 * Obtener todos los prospectos
 */
export function obtenerProspectos(filtros = {}) {
  const db = cargarDB();
  let prospectos = [...db.prospectos];

  // Filtrar por estatus
  if (filtros.estatus) {
    prospectos = prospectos.filter(p => p.estatus === filtros.estatus);
  }

  // Filtrar por modalidad de interés
  if (filtros.modalidad) {
    prospectos = prospectos.filter(p => p.modalidadInteres === filtros.modalidad);
  }

  // Filtrar por origen
  if (filtros.origen) {
    prospectos = prospectos.filter(p => p.origen === filtros.origen);
  }

  // Ordenar por fecha de registro (más recientes primero)
  prospectos.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));

  return prospectos;
}

/**
 * Obtener prospecto por ID
 */
export function obtenerProspectoPorId(id) {
  const db = cargarDB();
  return db.prospectos.find(p => p.id === id) || null;
}

/**
 * Buscar prospecto por NSS o teléfono
 */
export function buscarProspecto(termino) {
  const db = cargarDB();
  const terminoLimpio = termino.replace(/\D/g, '');

  return db.prospectos.filter(p =>
    (p.nss && p.nss.includes(terminoLimpio)) ||
    (p.telefonoUSA && p.telefonoUSA.includes(terminoLimpio)) ||
    (p.whatsapp && p.whatsapp.includes(terminoLimpio)) ||
    (p.nombreCompleto && p.nombreCompleto.toUpperCase().includes(termino.toUpperCase())) ||
    (p.email && p.email.toLowerCase().includes(termino.toLowerCase()))
  );
}

/**
 * Actualizar prospecto
 */
export function actualizarProspecto(id, datos) {
  const db = cargarDB();
  const index = db.prospectos.findIndex(p => p.id === id);

  if (index === -1) {
    throw new Error('Prospecto no encontrado');
  }

  // Validar CURP si se actualiza
  if (datos.curp) {
    const validacion = validarCURP(datos.curp);
    if (!validacion.valido) {
      throw new Error(validacion.mensaje);
    }
    datos.curp = datos.curp.toUpperCase();
  }

  // Validar NSS si se actualiza
  if (datos.nss) {
    const validacion = validarNSS(datos.nss);
    if (!validacion.valido) {
      throw new Error(validacion.mensaje);
    }
  }

  // Actualizar campos
  db.prospectos[index] = {
    ...db.prospectos[index],
    ...datos,
    fechaActualizacion: new Date().toISOString()
  };

  guardarDB(db);
  return db.prospectos[index];
}

/**
 * Registrar contacto con prospecto
 */
export function registrarContacto(id, datosContacto) {
  const {
    canal = 'whatsapp',
    resultado = 'contactado',
    notas = '',
    siguienteContacto = null
  } = datosContacto;

  const db = cargarDB();
  const index = db.prospectos.findIndex(p => p.id === id);

  if (index === -1) {
    throw new Error('Prospecto no encontrado');
  }

  const contacto = {
    fecha: new Date().toISOString(),
    canal,
    resultado,
    notas
  };

  db.prospectos[index].historialContactos.push(contacto);
  db.prospectos[index].fechaUltimoContacto = contacto.fecha;
  db.prospectos[index].intentosContacto += 1;

  // Actualizar estatus según resultado
  if (resultado === 'interesado') {
    db.prospectos[index].estatus = 'interesado';
  } else if (resultado === 'no_interesado') {
    db.prospectos[index].estatus = 'no_interesado';
  } else if (resultado === 'no_contesta') {
    db.prospectos[index].estatus = 'sin_respuesta';
  }

  // Programar siguiente contacto
  if (siguienteContacto) {
    db.prospectos[index].siguienteContacto = siguienteContacto;
  } else {
    // Por defecto, siguiente contacto en 3 días
    const siguiente = new Date();
    siguiente.setDate(siguiente.getDate() + 3);
    db.prospectos[index].siguienteContacto = siguiente.toISOString();
  }

  guardarDB(db);
  return db.prospectos[index];
}

/**
 * Agregar nota a prospecto
 */
export function agregarNota(id, texto) {
  const db = cargarDB();
  const index = db.prospectos.findIndex(p => p.id === id);

  if (index === -1) {
    throw new Error('Prospecto no encontrado');
  }

  db.prospectos[index].notas.push({
    fecha: new Date().toISOString(),
    texto
  });

  guardarDB(db);
  return db.prospectos[index];
}

/**
 * Obtener prospectos pendientes de contacto
 */
export function obtenerProspectosPendientes() {
  const db = cargarDB();
  const ahora = new Date();

  return db.prospectos.filter(p => {
    if (p.estatus === 'no_interesado' || p.estatus === 'convertido') {
      return false;
    }
    if (!p.siguienteContacto) {
      return true;
    }
    return new Date(p.siguienteContacto) <= ahora;
  }).sort((a, b) => {
    // Priorizar por número de intentos (menos intentos primero)
    return a.intentosContacto - b.intentosContacto;
  });
}

/**
 * Estadísticas de prospectos
 */
export function obtenerEstadisticasProspectos() {
  const db = cargarDB();
  const prospectos = db.prospectos;

  const porEstatus = {};
  const porOrigen = {};
  const porModalidad = {};

  prospectos.forEach(p => {
    porEstatus[p.estatus] = (porEstatus[p.estatus] || 0) + 1;
    porOrigen[p.origen] = (porOrigen[p.origen] || 0) + 1;
    if (p.modalidadInteres) {
      porModalidad[p.modalidadInteres] = (porModalidad[p.modalidadInteres] || 0) + 1;
    }
  });

  return {
    total: prospectos.length,
    porEstatus,
    porOrigen,
    porModalidad,
    pendientesContacto: obtenerProspectosPendientes().length
  };
}

export default {
  crearProspecto,
  obtenerProspectos,
  obtenerProspectoPorId,
  buscarProspecto,
  actualizarProspecto,
  registrarContacto,
  agregarNota,
  obtenerProspectosPendientes,
  obtenerEstadisticasProspectos,
  validarCURP,
  validarNSS
};

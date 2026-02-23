/**
 * CRM - Sistema de Gestión de Clientes IMSS
 * Índice principal de módulos
 */

export * from './prospectos.js';
export * from './clientes.js';
export * from './pagos.js';
export * from './notificaciones.js';

// Re-exportar defaults
import prospectos from './prospectos.js';
import clientes from './clientes.js';
import pagos from './pagos.js';
import notificaciones from './notificaciones.js';

export default {
  prospectos,
  clientes,
  pagos,
  notificaciones
};

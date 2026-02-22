// PM2 Configuration - Process Manager para producción
module.exports = {
  apps: [
    {
      name: 'calculadora-imss',
      script: 'server/index.js',
      instances: 'max', // Usar todos los CPUs disponibles
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3040
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3040
      },
      // Reiniciar si usa más de 500MB
      max_memory_restart: '500M',
      // Logs
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Auto restart
      watch: false,
      autorestart: true,
      restart_delay: 1000,
      max_restarts: 10
    }
  ]
};

# Guía de Deployment - VPS Hostinger

## Requisitos del VPS

- **OS:** Ubuntu 22.04 LTS (recomendado)
- **RAM:** Mínimo 1GB (2GB recomendado)
- **CPU:** 1 vCPU mínimo
- **Disco:** 20GB SSD
- **Node.js:** v18+ (v20 recomendado)

---

## Paso 1: Preparar el VPS

```bash
# Conectar por SSH
ssh root@tu-ip-vps

# Actualizar sistema
apt update && apt upgrade -y

# Instalar dependencias básicas
apt install -y curl git nginx certbot python3-certbot-nginx
```

---

## Paso 2: Instalar Node.js 20

```bash
# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verificar
node -v  # v20.x.x
npm -v   # 10.x.x

# Instalar PM2 globalmente
npm install -g pm2
```

---

## Paso 3: Crear usuario para la aplicación

```bash
# Crear usuario (más seguro que root)
adduser calculadora
usermod -aG sudo calculadora

# Cambiar a ese usuario
su - calculadora
```

---

## Paso 4: Clonar/Subir el proyecto

**Opción A: Subir con FileZilla/SFTP**
1. Conectar a tu VPS con FileZilla
2. Subir la carpeta `modalidad 10` a `/home/calculadora/`
3. Renombrar a `calculadora-imss`

**Opción B: Clonar desde Git**
```bash
cd /home/calculadora
git clone https://tu-repo.git calculadora-imss
cd calculadora-imss
```

---

## Paso 5: Configurar variables de entorno

```bash
cd /home/calculadora/calculadora-imss

# Copiar template
cp .env.example .env

# Editar con tus credenciales
nano .env
```

**Configuración mínima (.env):**
```env
PORT=3040
NODE_ENV=production

# Al menos una API de IA
OPENAI_API_KEY=sk-tu-key-aqui

# O usar Groq (gratis)
GROQ_API_KEY=gsk_tu-key-aqui
LLM_PROVIDER=groq

# Tu dominio para webhooks
WEBHOOK_BASE_URL=https://tu-dominio.com
```

---

## Paso 6: Instalar dependencias y construir

```bash
cd /home/calculadora/calculadora-imss

# Instalar dependencias del servidor
npm install --production

# Instalar y construir el cliente
cd client
npm install
npm run build
cd ..

# Crear carpetas necesarias
mkdir -p logs uploads
```

---

## Paso 7: Iniciar con PM2

```bash
# Iniciar aplicación
pm2 start ecosystem.config.cjs --env production

# Verificar que está corriendo
pm2 status

# Ver logs
pm2 logs calculadora-imss

# Configurar inicio automático al reiniciar VPS
pm2 startup
pm2 save
```

---

## Paso 8: Configurar Nginx

```bash
# Copiar configuración
sudo cp scripts/nginx.conf /etc/nginx/sites-available/calculadora-imss

# Editar y poner tu dominio
sudo nano /etc/nginx/sites-available/calculadora-imss
# Cambiar "tu-dominio.com" por tu dominio real

# Activar sitio
sudo ln -s /etc/nginx/sites-available/calculadora-imss /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## Paso 9: Configurar SSL (HTTPS)

```bash
# Obtener certificado SSL gratis con Let's Encrypt
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática (ya configurada por defecto)
sudo certbot renew --dry-run
```

---

## Paso 10: Configurar Firewall

```bash
# Permitir tráfico HTTP/HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable

# Verificar
sudo ufw status
```

---

## Paso 11: Configurar Webhooks

### Twilio (Llamadas y WhatsApp)
1. Ir a https://console.twilio.com
2. En tu número de teléfono, configurar:
   - **Voice Webhook:** `https://tu-dominio.com/api/twilio/voice`
   - **SMS Webhook:** `https://tu-dominio.com/api/whatsapp/webhook`

### Telegram
1. El bot usa polling, no necesita webhook
2. Alternativamente, configurar webhook:
```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://tu-dominio.com/api/telegram/webhook"
```

---

## Comandos Útiles

```bash
# Ver estado de la app
pm2 status

# Ver logs en tiempo real
pm2 logs calculadora-imss

# Reiniciar aplicación
pm2 restart calculadora-imss

# Detener aplicación
pm2 stop calculadora-imss

# Actualizar aplicación (después de git pull)
pm2 reload calculadora-imss

# Ver uso de recursos
pm2 monit
```

---

## Estructura en el VPS

```
/home/calculadora/calculadora-imss/
├── server/              # Backend Node.js
├── client/
│   └── dist/            # Frontend compilado
├── database/            # Datos JSON actualizables
├── uploads/             # Documentos de clientes
├── logs/                # Logs de PM2
├── .env                 # Variables de entorno
├── ecosystem.config.cjs # Configuración PM2
└── package.json
```

---

## Verificar que todo funciona

```bash
# Probar API localmente
curl http://localhost:3040/api/status

# Probar desde internet
curl https://tu-dominio.com/api/status
```

Respuesta esperada:
```json
{
  "status": "ok",
  "version": "3.0.0",
  "canales": {
    "web": true,
    "twilio": true,
    "whatsapp": true,
    "telegram": true
  }
}
```

---

## Troubleshooting

### Error: Puerto 3040 en uso
```bash
sudo lsof -i :3040
kill -9 <PID>
```

### Error: Permisos en uploads
```bash
sudo chown -R calculadora:calculadora /home/calculadora/calculadora-imss/uploads
chmod 755 /home/calculadora/calculadora-imss/uploads
```

### Ver errores de Nginx
```bash
sudo tail -f /var/log/nginx/error.log
```

### Reiniciar todo
```bash
pm2 restart all
sudo systemctl restart nginx
```

---

## Actualizar la aplicación

```bash
cd /home/calculadora/calculadora-imss

# Si usas Git
git pull origin main

# Reinstalar dependencias si cambiaron
npm install --production

# Reconstruir frontend
cd client && npm run build && cd ..

# Reiniciar sin downtime
pm2 reload calculadora-imss
```

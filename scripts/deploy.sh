#!/bin/bash
# ============================================
# SCRIPT DE DEPLOYMENT - VPS Hostinger
# ============================================

echo "🚀 Iniciando deployment de Calculadora IMSS..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    echo "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "Instalando PM2..."
    sudo npm install -g pm2
fi

echo -e "${GREEN}✓ PM2 instalado${NC}"

# Crear directorios necesarios
mkdir -p logs uploads

# Instalar dependencias
echo "📦 Instalando dependencias del servidor..."
npm install --production

# Construir cliente
echo "🔨 Construyendo frontend..."
cd client
npm install
npm run build
cd ..

# Copiar build a carpeta pública
echo "📁 Configurando archivos estáticos..."

# Verificar archivo .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No existe archivo .env${NC}"
    echo "Copiando .env.example a .env..."
    cp .env.example .env
    echo -e "${RED}¡IMPORTANTE! Edita el archivo .env con tus credenciales${NC}"
fi

# Detener instancia anterior si existe
pm2 delete calculadora-imss 2>/dev/null

# Iniciar con PM2
echo "🚀 Iniciando servidor con PM2..."
pm2 start ecosystem.config.cjs --env production

# Guardar configuración de PM2
pm2 save

# Configurar inicio automático
pm2 startup

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment completado exitosamente${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 Estado del servidor:"
pm2 status

echo ""
echo "🔗 URLs:"
echo "   - Local: http://localhost:3040"
echo "   - Logs:  pm2 logs calculadora-imss"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Editar .env con tus API keys"
echo "   2. Configurar Nginx como reverse proxy"
echo "   3. Configurar SSL con Certbot"
echo ""

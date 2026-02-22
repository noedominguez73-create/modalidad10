@echo off
title Calculadora Modalidad 40 IMSS
cd /d "C:\modalidad 10"

echo ============================================
echo   Calculadora Modalidad 40 IMSS
echo ============================================
echo.

:: Verificar si node_modules existe
if not exist "node_modules" (
    echo Instalando dependencias del servidor...
    call npm install
)

if not exist "client\node_modules" (
    echo Instalando dependencias del cliente...
    cd client
    call npm install
    cd ..
)

echo.
echo Iniciando servidores...
echo.

:: Iniciar backend en segundo plano
start /min cmd /c "cd /d "C:\modalidad 10" && npm run server"

:: Esperar un momento
timeout /t 2 >nul

:: Iniciar frontend
start /min cmd /c "cd /d "C:\modalidad 10\client" && npm run dev"

:: Esperar a que el frontend esté listo
echo Esperando que los servidores inicien...
timeout /t 5 >nul

:: Abrir navegador
start http://localhost:5173

echo.
echo ============================================
echo   Calculadora lista en: http://localhost:5173
echo   API backend en: http://localhost:3040
echo ============================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul

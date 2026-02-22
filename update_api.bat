@echo off
setlocal enabledelayedexpansion

echo Deteniendo servicio...
net stop "api-mu"

:: --- CONFIGURACIÓN DE RUTAS ---
set "LOGS_DIR=.\daemon"
set "BACKUP_BASE=.\daemon\logs_backup"

:: --- GENERAR TIMESTAMP (Formato: YYYY-MM-DD_HH-MM) ---
:: Esto extrae la fecha de forma independiente a la región del Windows
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "TIMESTAMP=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%"

echo Respaldando archivos .log de %LOGS_DIR%...

:: Crear la carpeta de destino con la fecha
set "DEST_DIR=%BACKUP_BASE%\%TIMESTAMP%"

if exist "%LOGS_DIR%" (
    :: Verificar si hay archivos .log antes de proceder
    dir /b "%LOGS_DIR%\*.log" >nul 2>&1
    if !errorlevel! equ 0 (
        mkdir "%DEST_DIR%"
        :: Mover solo los archivos .log
        move "%LOGS_DIR%\*.log" "%DEST_DIR%\"
        echo Logs movidos exitosamente a %DEST_DIR%
    ) else (
        echo No se encontraron archivos .log en %LOGS_DIR%.
    )
) else (
    echo La carpeta %LOGS_DIR% no existe.
)

echo.
echo Actualizando codigo...
git pull
call npm install

echo.
echo Iniciando servicio...
net start "api-mu"

pause

REM Tmb se puede hacer presionando win + R y escribiendo "services.msc" para abrir el administrador de servicios, luego buscar el servicio "api-mu", hacer clic derecho, deteniendolo y luego volviendolo a correr.
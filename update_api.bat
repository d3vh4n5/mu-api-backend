@echo off
setlocal enabledelayedexpansion

:: ---------------------------------------------------------------------------
:: Actualiza la API (NestJS) en el VPS. Ejecutar como Administrador.
::
:: `git pull` puede modificar ESTE archivo mientras se ejecuta, y cmd lee los
:: .bat de a pedazos. Para evitar que se rompa, primero se copia a %TEMP% y se
:: ejecuta la copia (sin `call`, asi el original no se vuelve a leer).
:: ---------------------------------------------------------------------------
if /i "%~1"=="--run" goto :main
copy /y "%~f0" "%TEMP%\update_api_run.bat" >nul
"%TEMP%\update_api_run.bat" --run "%~dp0"

:main
:: Al ejecutar "como administrador" el directorio actual es System32
cd /d "%~2"
echo Carpeta de la API: %CD%

set "SERVICE_NAME=api-mu"
set "LOGS_DIR=.\daemon"
set "BACKUP_BASE=.\daemon\logs_backup"

echo.
echo Deteniendo servicio...
net stop "%SERVICE_NAME%"

:: --- TIMESTAMP YYYY-MM-DD_HH-MM (wmic esta deprecado en Windows recientes) ---
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "TIMESTAMP=%%I"

echo Respaldando archivos .log de %LOGS_DIR%...
set "DEST_DIR=%BACKUP_BASE%\%TIMESTAMP%"

if exist "%LOGS_DIR%" (
    dir /b "%LOGS_DIR%\*.log" >nul 2>&1
    if !errorlevel! equ 0 (
        mkdir "%DEST_DIR%"
        move "%LOGS_DIR%\*.log" "%DEST_DIR%\"
        echo Logs movidos a %DEST_DIR%
    ) else (
        echo No se encontraron archivos .log en %LOGS_DIR%.
    )
) else (
    echo La carpeta %LOGS_DIR% no existe.
)

echo.
echo [1/5] Actualizando codigo...
git pull || goto :error

echo.
echo [2/5] Instalando dependencias (incluye dev: hacen falta para compilar)...
call npm ci --include=dev || goto :error

echo.
echo [3/5] Generando cliente de Prisma...
call npx prisma generate || goto :error

echo.
echo [4/5] Aplicando migraciones pendientes...
call npx prisma migrate deploy || goto :error

echo.
echo [5/5] Compilando...
call npm run build || goto :error

if not exist "dist\src\main.js" (
    echo No se genero dist\src\main.js
    goto :error
)

echo.
echo Iniciando servicio...
net start "%SERVICE_NAME%" || goto :error

echo.
echo === API actualizada correctamente ===
pause
exit /b

:error
echo.
echo ***************************************************************
echo  ERROR: fallo el paso anterior. El servicio "%SERVICE_NAME%" NO
echo  se inicio. Revisar el error, corregir y volver a ejecutar.
echo ***************************************************************
pause
exit /b

REM Tambien se puede manejar desde services.msc (Win + R), servicio "api-mu".

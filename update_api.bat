@echo off
echo Deteniendo servicio...
net stop "api-mu"

echo Actualizando codigo...
git pull
call npm install

echo Iniciando servicio...
net start "api-mu"
pause

REM Tmb se puede hacer presionando win + R y escribiendo "services.msc" para abrir el administrador de servicios, luego buscar el servicio "api-mu", hacer clic derecho, deteniendolo y luego volviendolo a correr.
# Despliegue en el VPS (Windows)

La API corre como servicio de Windows **`api-mu`** (node-windows):

- `C:\API\index.js` → `require('./dist/src/main.js')`. El servicio apunta a este
  archivo; no moverlo.
- `C:\API\daemon\` → `api-mu.exe` / `api-mu.xml` (WinSW) y los logs `*.log`.
  El XML ejecuta `node_modules\node-windows\lib\wrapper.js`, por eso
  `node-windows` es una dependencia de producción.
- `C:\API\public\downloads\` → archivos del cliente que baja el launcher
  (no está en git). Se sirve en `/downloads/...` y pide `x-api-key`.
- `C:\API\.env` → ver `.env.example`. **`NODE_ENV=production`**.

## Actualizar

Ejecutar `update_api.bat` como Administrador. El script detiene el servicio,
respalda los logs, corre `git pull`, `npm ci`, `prisma generate`,
`prisma migrate deploy` y `nest build`, y vuelve a iniciar el servicio. Si algún
paso falla, el servicio queda detenido y el script lo informa.

## Primera migración desde la API Express

1. Hacer backup de `C:\API` completo (sobre todo `.env` y `public\`). El primer
   `git pull` **borra** del disco `public\index.html`,
   `public\downloads\Mu99bClassic\manifest.json`, `service.cjs` e `index.js`
   (se reemplazan por los nuevos). La API no tiene manifest de respaldo: si
   falta `manifest.json`, `/downloads/Mu99bClassic/manifest.json` y
   `/api/v2/launcher/manifest` responden 404 y los launchers no pueden
   verificar. Se vuelve a publicar con Client Tools → "Publicar en servidor".
2. Anotar del `.env` viejo: `PORT` y `API_KEY` (esta última pasa a ser
   `LAUNCHER_API_KEY`).
3. Crear el `.env` nuevo a partir de `.env.example` (con `DATABASE_URL` en `localhost`).
4. Verificar `node -v` ≥ 20.19.
5. La primera vez, ejecutar los pasos a mano (el `update_api.bat` viejo no compila):
   ```bat
   cd /d C:\API
   net stop api-mu
   git pull
   npm ci --include=dev
   npx prisma generate
   npx prisma migrate status
   npx prisma migrate deploy
   npm run build
   net start api-mu
   ```
   Si `git pull` falla con "untracked working tree files would be overwritten",
   mover esos archivos a otra carpeta y repetir.
6. Si el servicio no arranca, mirar `C:\API\daemon\api-mu.err.log`. Para
   reinstalarlo: `npm run service:uninstall` y luego `npm run service:install`.

## Verificar

```bat
curl -H "x-api-key: <SECRET_API_KEY>" http://localhost:<PORT>/api/v2/health/readiness
curl http://localhost:<PORT>/api/v2/launcher/servers
curl -o NUL -w "%{http_code}" -H "x-api-key: <LAUNCHER_API_KEY>" http://localhost:<PORT>/downloads/Mu99bClassic/manifest.json
curl -o NUL -w "%{http_code}" http://localhost:<PORT>/api/v2/seed
```

El último debe dar `404`: en producción el seed no existe.

El de `manifest.json` debe dar `200`. Si da `404`, ningún launcher puede
verificar el cliente (la API no tiene manifest de respaldo): publicarlo enseguida
desde Client Tools → "Publicar en servidor" (Comparar → Publicar). Conviene
revisarlo **antes** de actualizar la API (que exista
`public\downloads\Mu99bClassic\manifest.json`) para no dejar a los jugadores sin
verificación en el medio.

## Publicar el cliente

Desde la PC del admin, con `tool.exe` → pestaña "Publicar en servidor" (ver
`Launcher/readme.md`). Usa `SECRET_API_KEY` y endpoints
`/api/v2/tools/client-publish` (ejemplos en `docs/client-publish.rest`). Los
archivos esperan en `public\client-publish-staging\` hasta publicar; esa
carpeta se limpia sola al iniciar la siguiente publicación.

## Publicar una versión del launcher

La API **no** tiene la versión escrita en el código: la lee de los metadatos
(FileVersion) de `public\downloads\Mu99bClassic\Client\launcher.exe`, junto con
su sha256. Se cachea por tamaño y fecha, así que no hace falta reiniciar la API.

1. En `Launcher/const/config.py` subir `VERSION` (por ej. `1.2.8`).
2. Compilar: `.venv\Scripts\python build.py --copy` (escribe la versión en el exe).
3. Subir `Client\launcher.exe` (y `Client\Data\Launcher\updater.exe` si cambió)
   a `C:\API\public\downloads\Mu99bClassic\Client\`.

Al próximo inicio, los launchers con versión menor descargan el nuevo, verifican
el sha256 y se actualizan. Si el hash no coincide, no instalan nada.

Comprobar: `GET /api/v2/launcher?version=0.0.1` → `currentVersion` y `launcherSha256`.

## Volver a una versión anterior (rollback)

1. Volver a subir el `launcher.exe` anterior al mismo lugar.
2. En el `.env` de la API poner `LAUNCHER_ALLOW_DOWNGRADE=true` y reiniciar el servicio.
   Ahora actualiza cualquier launcher con versión **distinta** a la publicada.
3. Cuando todos hayan bajado, volver a `LAUNCHER_ALLOW_DOWNGRADE=false`.

Alternativa sin tocar la API: recompilar el código viejo con un número **mayor**
(por ej. 1.2.8 roto → publicar el código de 1.2.7 como 1.2.9).

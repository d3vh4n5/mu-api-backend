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
   (se reemplazan por los nuevos). Si falta `manifest.json`, la API sirve el
   manifest embebido (`src/modules/launcher/data/manifest.ts`).
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

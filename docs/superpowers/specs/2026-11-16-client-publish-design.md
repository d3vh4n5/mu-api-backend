# Publicar el cliente desde Client Tools (sin Escritorio Remoto)

Fecha: 2026-11-16 · Repos afectados: `api` y `Launcher` (client-tools)

## Intención

Hoy, para publicar un cambio del cliente de juego, hay que entrar por Escritorio
Remoto al VPS y copiar archivos a mano en
`C:\API\public\downloads\Mu99bClassic\Client\` (y el `manifest.json`). Queremos
hacerlo desde la PC del admin con `tool.exe`: elegir la carpeta del cliente
local, ver qué cambió y publicarlo con un botón.

## Objetivos

- Nueva pestaña **"Publicar en servidor"** en `Launcher/client-tools/tool.py`.
- Nuevo módulo de la API `src/modules/tools/client-publish/`.
- Subir **solo lo que cambió** (comparando sha256 local contra el servidor).
- Dos modos, elegibles en la tool:
  - **Solo agregar/reemplazar**: nunca borra nada en el servidor.
  - **Espejo**: además borra del servidor lo que ya no está en la carpeta local.
    Antes de confirmar, se muestra la lista de archivos a borrar.
- Los jugadores nunca ven un estado a medias: los archivos nuevos se aplican y
  el `manifest.json` se escribe recién al final, en el paso "publicar".
- Poder publicar también `launcher.exe` (no va en el manifest, pero vive en la
  misma carpeta y la API lee su versión de ahí).

## No-objetivos

- Publicar archivos del servidor de juego (`mu-server-config`, GameServer, etc.).
- Historial de versiones o rollback automático del cliente.
- Interfaz web: esto es solo para la tool de escritorio.

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que un corte a mitad de subida deje a los jugadores con un manifest que apunta
  a archivos inexistentes o con otro sha.
- Que el modo espejo borre `launcher.exe`, o algo fuera de `Client/`.
- Que la API key quede embebida en `tool.exe` (el exe circula fuera del VPS).

## Restricciones encontradas

- La carpeta servida es `getDownloadsDir()/Mu99bClassic/Client`
  (`CLIENT_REL_DIR` en `src/modules/launcher/paths.ts`) y el manifest es
  `Mu99bClassic/manifest.json` (`MANIFEST_REL_PATH`). El launcher arma esas URLs
  y revisa cada tanto el hash del manifest: **no cambiar las rutas**.
- `/public` está en `.gitignore`: lo que escriba la API no choca con `git pull`.
- El throttler global es de 120 requests/min (`RATE_LIMIT_PER_MINUTE`). La
  primera publicación puede ser de ~4000 archivos → los endpoints de este módulo
  llevan `@SkipThrottle()` (ya están protegidos por API key).
- El `ValidationPipe` global usa `forbidNonWhitelisted`; el body JSON por
  defecto de Express tiene un límite de 100 kB. El manifest de ~4000 archivos
  pesa ~600 kB → el endpoint que lo recibe necesita un límite mayor (ver diseño).
- Las subidas son `application/octet-stream`: el body parser de Nest no las
  toca, así que se puede hacer `pipe` del `req` directo a disco.
- El archivo más grande hoy es `launcher.exe` (~23 MB); el cliente total ~374 MB.
- La API tiene un manifest embebido en código (`modules/launcher/data/manifest.ts`)
  que devuelve `GET /api/v2/launcher/manifest` y que se usa de fallback en
  `/downloads/Mu99bClassic/manifest.json`. Quedaría desactualizado tras publicar,
  y además puede esconder un problema real (ver "Manifest: solo el real").

## Enfoques considerados

| Enfoque | Trade-off |
|---|---|
| **A. Archivo por archivo contra la API, con staging** (elegido) | Más código en la API (4 endpoints), pero progreso real, reintento sin perder lo subido, sha verificado por archivo y publicación atómica al final. |
| B. Un ZIP con lo cambiado | Más simple de entender, pero un request de cientos de MB que si se corta vuelve a cero, y suma una dependencia de unzip. |
| C. Sin API (SFTP / carpeta compartida) | Abre puertos y credenciales aparte, no reutiliza API key ni bloqueo de IPs. Descartado. |

Elegido **A** por el usuario.

## Diseño

### Autenticación

- Todos los endpoints: `@UseGuards(ApiKeyGuard)` (acepta solo `SECRET_API_KEY`
  en `x-api-key`, igual que `server-reset`) y `@SkipThrottle()`.
- La tool pide la API key en un campo de contraseña. No se guarda en el exe ni
  en disco *(decisión de Claude: evita dejar la key en una PC compartida; si
  molesta tipearla, se puede guardar en el registro de Windows más adelante)*.
- La URL del servidor sale de `MU_SERVER_URL` (`const/config.py`), editable en
  la pestaña.

### API: `src/modules/tools/client-publish/`

Rutas bajo `/api/v2/tools/client-publish`. Staging en
`PUBLIC_DIR/client-publish-staging/<sessionId>/` (fuera de `downloads`, así no
se sirve nunca).

1. **`GET /state`** → lista de archivos reales en disco dentro de `Client/`:
   `{ files: [{ path, size, sha256 }] }`. Se compara contra el disco y no contra
   el manifest, porque el disco es lo que realmente baja el launcher. Reutiliza
   la idea de caché por `size`+`mtimeMs` de `published-file.ts` para no recalcular
   sha de 374 MB en cada consulta.

2. **`POST /sessions`** → crea una sesión: `{ sessionId }`. Solo una sesión
   activa a la vez; si hay otra, responde 409 con su id y fecha. Una sesión sin
   actividad por 30 minutos se descarta (se borra su staging) al crear la próxima.
   `DELETE /sessions/:id` la cancela a mano.

3. **`PUT /sessions/:id/files?path=<ruta relativa>`** con header
   `x-sha256: <hex>` y body `application/octet-stream`:
   - Valida la ruta (ver Seguridad de rutas).
   - Escribe el stream a `staging/<id>/<path>`, calcula sha256 al vuelo y, si no
     coincide con `x-sha256`, borra el archivo y responde 400.
   - Idempotente: subir de nuevo el mismo path lo reemplaza. Esto es lo que
     permite reintentar tras un corte.

4. **`POST /sessions/:id/publish`** con body JSON. El manifest supera los
   100 kB por defecto: se sube el límite JSON global a 5 MB en `main.ts` con
   `app.useBodyParser('json', { limit: '5mb' })` *(decisión de Claude: Nest no
   tiene límite por ruta sin armar un middleware aparte, y 5 MB sigue siendo
   chico)*. El body se valida con DTOs de class-validator (`ValidateNested`),
   porque el `ValidationPipe` global rechaza propiedades no declaradas.
   ```json
   {
     "manifest": { "version": "1.0.1", "file_count": 4030, "files": [ ... ] },
     "delete": ["Data/Viejo.bmd"],
     "extraFiles": ["launcher.exe"]
   }
   ```
   - `extraFiles`: archivos subidos que **no** van en el manifest (por ahora
     solo `launcher.exe`).
   - **Antes de tocar nada**, valida que cada entrada de `manifest.files` vaya a
     existir con ese sha: o está en staging (sha ya verificado) o ya está en
     `Client/` con ese sha y no está en `delete`. Si algo no cierra → 400 con la
     lista de problemas y no se aplica nada.
   - Aplica: mueve cada archivo de staging a `Client/` (`rename`, mismo volumen),
     luego borra los de `delete`, luego escribe `manifest.json` (a un `.tmp` y
     `rename`) y por último borra el staging.
   - Devuelve `{ uploaded, deleted, manifestFiles }`.
   - Si falla a mitad de aplicar (disco lleno, archivo bloqueado), el
     `manifest.json` viejo sigue en su lugar, así que los launchers no ven la
     versión nueva; se responde 500 y se puede reintentar el publish.

Además de esos 4 endpoints, se registra un `ClientPublishModule` en
`app.module.ts` como `ServerResetModule`, y en `docs/` se agrega
`client-publish.rest` con ejemplos.

### Seguridad de rutas

- Rechazar si la ruta tiene `..`, es absoluta, tiene `:` o empieza con `/` o `\`.
- Normalizar a `/`, resolver contra `Client/` y verificar que el resultado siga
  dentro de `Client/` (comparación sin distinguir mayúsculas, porque es Windows).
- `delete` nunca puede incluir `launcher.exe`. Tampoco puede incluir nada que
  no exista hoy en `Client/` (en ese caso se ignora y se informa en la respuesta).

### Manifest: solo el real, sin fallback

Pedido explícito del usuario: la API usa el `manifest.json` verdadero del disco;
si hay un problema, responde error y **nunca** devuelve un manifest fijo.

- Se borra `src/modules/launcher/data/manifest.ts` y todos sus imports.
- `GET /api/v2/launcher/manifest` lee `MANIFEST_REL_PATH` del disco. Si no
  existe → 404 `{ message: 'manifest.json no publicado' }`; si no es un JSON
  válido o no tiene `files` como array → 500 con el motivo. Se loguea en ambos
  casos.
- Se elimina el handler de fallback de `/downloads/Mu99bClassic/manifest.json`
  en `setup-downloads.ts`. Esa URL la sirve solo `useStaticAssets` desde disco.
  Si el archivo falta, se agrega a continuación un handler que responde 404 en
  JSON y lo loguea (en vez de dejarlo caer en un 404 genérico de Nest).
- El launcher no necesita cambios: `components/frame_update.py` hace
  `raise_for_status()` sobre el manifest, así que un 404/500 se muestra como
  "Error de conexión con el servidor" y la verificación no se marca como hecha.
- Se actualiza `docs/DEPLOY_VPS.md`, que hoy menciona que el manifest embebido
  cubre el caso en que `git pull` borra el del disco: ahora ese caso da error y
  se resuelve publicando desde la tool.

### Tool: pestaña "Publicar en servidor"

Reutiliza la lógica de escaneo y exclusiones de la pestaña "Generador Manifest"
(se extrae a una función compartida, así no se duplica):

```
 Carpeta del cliente: [C:\...\Client            ] [Examinar]
 Servidor:            [http://93.127.142.139    ]
 API key:             [••••••••••••             ]
 Versión manifest:    [1.0.1]
 Modo:  (•) Solo agregar/reemplazar   ( ) Espejo (borra lo que no está local)
 [x] Incluir launcher.exe

 [ 🔍 Comparar con servidor ]

 Nuevos: 3 · Modificados: 12 · A borrar: 2 · Sin cambios: 4014
 ┌───────────────────────────────────────────┐
 │ + Data/Local/Text_Spn.bmd                 │
 │ ~ main.exe                                │
 │ - Data/Viejo.bmd        (solo en espejo)  │
 └───────────────────────────────────────────┘
 Subiendo (5/15): Data/World1/Terrain.att
 [██████████░░░░░░░░░░]
                         [ 🚀 Publicar ]
```

Flujo:

1. **Comparar**: escanea la carpeta local con las exclusiones activas,
   calcula los sha, pide `GET /state` y arma tres listas: nuevos, modificados y
   a borrar (lo que está en el servidor pero no local; **solo en modo espejo**).
   Los archivos excluidos (logs, `launcher.exe`, etc.) nunca entran en
   "a borrar".
2. **Publicar**: si hay archivos a borrar, pide confirmación mostrando la
   cantidad y los primeros nombres. Después crea la sesión, sube los nuevos y
   modificados (con hasta 3 reintentos por archivo si falla la red) y llama a
   `publish` con el manifest local y la lista de borrados.
3. Si `launcher.exe` está tildado y cambió, se sube y se manda en `extraFiles`.
4. Si se cierra la tool o se corta a mitad, nada cambió para los jugadores. Al
   volver a publicar, la tool cancela la sesión vieja y empieza de nuevo
   *(decisión de Claude: retomar una sesión a medias implica guardar estado
   local; con archivos de pocos MB no vale la pena)*.

Las requests corren en un thread (como las otras pestañas) y la UI se actualiza
con `self.after`. Se usa `requests`, que ya está en el launcher.

## Queda a criterio de quien implemente

- Detalles de UI (tamaños, colores): seguir el estilo de las otras pestañas.
- Cómo se ve el detalle de errores del publish en la tool.
- Nombres internos de clases y servicios.

## Pruebas

- API: tests unitarios del servicio para validación de rutas, sha incorrecto,
  publish con manifest inconsistente (no aplica nada), modo espejo y protección
  de `launcher.exe`. Usar un `PUBLIC_DIR` temporal.
- API: `GET /launcher/manifest` devuelve el del disco, 404 si falta y 500 si
  está corrupto (sin ningún fallback).
- Tool: la lógica de diff (local vs servidor + modo) en una función pura con
  test propio. La subida se prueba a mano contra la API local.

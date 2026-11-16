# Publicar el cliente desde Client Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar cambios del cliente de juego al VPS desde `tool.exe` (subiendo solo lo que cambió, con modo "solo agregar" o "espejo"), y que la API sirva únicamente el `manifest.json` real.

**Architecture:** La API (NestJS) suma el módulo `tools/client-publish`: lista el estado real de `Client/`, recibe archivos uno por uno a una carpeta de staging (verificando sha256) y en un paso final los aplica y escribe el manifest. La tool (Python/CustomTkinter) escanea la carpeta local, calcula el diff contra el servidor y orquesta la subida en un thread.

**Tech Stack:** NestJS 11 + Express, Jest/ts-jest (api). Python 3 + customtkinter + requests, `unittest` de la stdlib (Launcher; pytest no está instalado).

**Spec:** `api/docs/superpowers/specs/2026-11-16-client-publish-design.md`

## Global Constraints

- Rutas que usa el launcher, sin cambios: `Mu99bClassic/Client` (`CLIENT_REL_DIR`) y `Mu99bClassic/manifest.json` (`MANIFEST_REL_PATH`) dentro de `getDownloadsDir()`.
- Staging en `PUBLIC_DIR/client-publish-staging/<sessionId>/` (hermano de `downloads`, nunca servido).
- Endpoints bajo `/api/v2/tools/client-publish`, con `@UseGuards(ApiKeyGuard)` (solo `SECRET_API_KEY` en `x-api-key`) y `@SkipThrottle()`.
- Una sola sesión activa; una sesión inactiva por 30 minutos se descarta al crear la siguiente.
- `launcher.exe` (en la raíz de `Client/`) nunca va en el manifest y nunca se borra; solo puede subirse como `extraFiles`.
- Límite JSON global: `app.useBodyParser('json', { limit: '5mb' })`.
- Sin manifest embebido: 404 si `manifest.json` falta, 500 si es inválido; nunca un manifest fijo.
- La API key no se guarda ni en el exe ni en disco.
- Textos de UI y mensajes de error en español, como el resto del proyecto.
- **No commitear** sin que el usuario lo pida (preferencia del usuario): los pasos "Checkpoint" solo verifican; no hay `git commit`.

## Review Focus

1. **Rutas con mayúsculas distintas** (`data/local/Text_Spn.bmd` local vs `Data/Local/...` en el servidor): en Windows son el mismo archivo. El diff debe compararlas sin distinguir mayúsculas, o el modo espejo borraría el archivo que acaba de subir. → test en Task 5 y Task 2.
2. **Rutas con espacios o caracteres no ASCII** (`Data/Música/x.mp3`): viajan en `?path=` y tienen que llegar intactas. → test en Task 3 (servicio) y codificación con `params=` de requests en Task 6.
3. **Publish que referencia un archivo que también está en `delete`**: hay que rechazarlo antes de aplicar. → test en Task 4.
4. **Corte a mitad de la subida y nuevo intento**: la tool cancela la sesión vieja y crea otra; el servidor no debe quedar con un 409 permanente. → test en Task 3 (`createSession` con `force`).
5. **Carpeta local que no es un cliente** (vacía o equivocada) en modo espejo: borraría todo el servidor. → la tool bloquea el publish si no hay `main.exe` local, test en Task 5.

---

### Task 1: La API sirve solo el manifest real

**Files:**
- Delete: `api/src/modules/launcher/data/manifest.ts`
- Create: `api/src/modules/launcher/manifest-file.ts`
- Create: `api/src/modules/launcher/manifest-file.spec.ts`
- Modify: `api/src/modules/launcher/launcher.service.ts` (import y `getManifest`)
- Modify: `api/src/downloads/setup-downloads.ts` (quitar el fallback embebido)
- Modify: `api/docs/DEPLOY_VPS.md` (el caso "git pull borra el manifest" ahora da error y se resuelve publicando con la tool)

**Interfaces:**
- Produces: `readPublishedManifest(): Promise<ClientManifest>` en `manifest-file.ts`; `interface ClientManifest { version: string; file_count: number; files: { path: string; size: number; sha256: string }[] }`; `manifestPath(): string` (= `join(getDownloadsDir(), MANIFEST_REL_PATH)`). Lanza `NotFoundException('manifest.json no publicado')` si falta y `InternalServerErrorException('manifest.json inválido: <motivo>')` si no es JSON o `files` no es array.

- [ ] **Step 1: Tests que fallan** en `manifest-file.spec.ts`, con `process.env.PUBLIC_DIR` apuntando a un `mkdtemp` por test:
  - `devuelve el manifest del disco` → escribe `{version:'1.0.1',file_count:1,files:[{path:'main.exe',size:3,sha256:'abc'}]}` y `expect(await readPublishedManifest()).toEqual(<ese objeto>)`.
  - `404 si no existe` → `rejects.toBeInstanceOf(NotFoundException)`.
  - `500 si no es JSON` → contenido `'{roto'` → `rejects.toBeInstanceOf(InternalServerErrorException)`.
  - `500 si files no es array` → `{version:'1',files:{}}` → `InternalServerErrorException`.
- [ ] **Step 2:** `cd api && npx jest src/modules/launcher/manifest-file.spec.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `manifest-file.ts`, loguear con `Logger('Manifest')` en ambos errores. `LauncherService.getManifest()` pasa a `return readPublishedManifest()`. Borrar `data/manifest.ts`. En `setup-downloads.ts` reemplazar el handler que hace `res.json(manifest)` por uno que responde `404 { statusCode: 404, message: 'manifest.json no publicado' }` y loguea un warn (Express solo llega ahí si `useStaticAssets` no encontró el archivo).
- [ ] **Step 4:** `npx jest src/modules/launcher` → PASS; `npm run build` → sin errores (confirma que no quedan imports de `data/manifest`).
- [ ] **Step 5: Checkpoint** — `grep -rn "data/manifest" api/src` no devuelve nada.

---

### Task 2: Rutas seguras y estado real de `Client/`

**Files:**
- Create: `api/src/modules/tools/client-publish/client-files.ts`
- Create: `api/src/modules/tools/client-publish/client-files.spec.ts`

**Interfaces:**
- Produces:
  - `clientDir(): string` = `join(getDownloadsDir(), CLIENT_REL_DIR)`; `stagingRoot(): string` = `join(PUBLIC_DIR || cwd/public, 'client-publish-staging')` (reutilizar la misma resolución de `PUBLIC_DIR` que `getDownloadsDir`, extrayendo `getPublicDir()` en `setup-downloads.ts`).
  - `normalizeRelPath(rel: string): string` → ruta con `/`, sin `./`; lanza `BadRequestException('Ruta inválida: <rel>')` si está vacía, es absoluta, empieza con `/` o `\`, contiene `:` o tiene un segmento `..`.
  - `resolveInside(baseDir: string, rel: string): string` → `normalizeRelPath` + `resolve`, y verifica (en minúsculas) que el resultado empiece con `baseDir + sep`; si no, `BadRequestException`.
  - `isLauncherExe(rel: string): boolean` → `normalizeRelPath(rel).toLowerCase() === 'launcher.exe'`.
  - `scanClientFiles(): Promise<ClientFileEntry[]>` con `interface ClientFileEntry { path: string; size: number; sha256: string }`, rutas relativas con `/`, ordenadas; caché en memoria por ruta absoluta con `size`+`mtimeMs` (mismo criterio que `published-file.ts`). Si `Client/` no existe, devuelve `[]`.

- [ ] **Step 1: Tests que fallan:**
  - `normalizeRelPath` acepta `'Data\\Local\\Text_Spn.bmd'` → `'Data/Local/Text_Spn.bmd'` y `'Data/Música/a b.mp3'` sin cambios.
  - rechaza (`BadRequestException`) cada uno de: `''`, `'../x'`, `'Data/../../x'`, `'/etc/x'`, `'\\x'`, `'C:/x'`, `'Data/a:b'`.
  - `resolveInside(dir, 'Data/x.bmd')` termina en `join('Data','x.bmd')`.
  - `isLauncherExe('Launcher.EXE')` → `true`; `isLauncherExe('Data/Launcher/updater.exe')` → `false`.
  - `scanClientFiles` en un `PUBLIC_DIR` temporal con `Client/main.exe` (`'abc'`) y `Client/Data/x.bmd` → `[{path:'Data/x.bmd',...},{path:'main.exe',size:3,sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}]`.
  - `scanClientFiles` sin carpeta `Client/` → `[]`.
- [ ] **Step 2:** `npx jest src/modules/tools/client-publish/client-files.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar `client-files.ts` (recorrido con `readdir({ withFileTypes: true })` recursivo; sha con `createReadStream` para no cargar archivos enteros).
- [ ] **Step 4:** mismo comando → PASS.
- [ ] **Step 5: Checkpoint** — `npx jest` completo en verde.

---

### Task 3: Sesiones y subida de archivos

**Files:**
- Create: `api/src/modules/tools/client-publish/client-publish.service.ts`
- Create: `api/src/modules/tools/client-publish/client-publish.service.spec.ts`
- Create: `api/src/modules/tools/client-publish/client-publish.controller.ts`
- Create: `api/src/modules/tools/client-publish/client-publish.module.ts`
- Modify: `api/src/app.module.ts` (registrar `ClientPublishModule` junto a `ServerResetModule`)

**Interfaces:**
- Consumes: Task 2 (`clientDir`, `stagingRoot`, `resolveInside`, `scanClientFiles`).
- Produces (`ClientPublishService`):
  - `getState(): Promise<{ files: ClientFileEntry[] }>`
  - `createSession(force: boolean): Promise<{ sessionId: string }>` — `sessionId` = `randomUUID()`. Si hay sesión activa no vencida y `force` es false → `ConflictException({ message: 'Hay otra publicación en curso', sessionId, startedAt })`. Con `force` o vencida (>30 min sin actividad) borra su staging y la reemplaza.
  - `cancelSession(id: string): Promise<void>` — borra el staging; `NotFoundException` si el id no es el activo.
  - `receiveFile(id: string, rel: string, expectedSha: string, body: Readable): Promise<{ path: string; size: number }>` — valida sesión y ruta, escribe en `resolveInside(stagingDir, rel)` creando carpetas, hashea al vuelo; si el sha no coincide borra el archivo y lanza `BadRequestException('sha256 no coincide para <rel>')`. Actualiza la última actividad. Guarda en la sesión un `Map<string(lowercase rel), { path, sha256, size }>`.
- Controller (`@Controller('tools/client-publish')`, `ApiKeyGuard`, `@SkipThrottle()`):
  - `GET state`
  - `POST sessions` con query `force=true|false`
  - `DELETE sessions/:id`
  - `PUT sessions/:id/files` con query `path`, header `x-sha256` (requerido, 64 hex → si no, 400), body = `@Req() req` como stream.

- [ ] **Step 1: Tests que fallan** (servicio, `PUBLIC_DIR` temporal, body con `Readable.from([Buffer.from('abc')])`):
  - `receiveFile con sha correcto deja el archivo en staging` y devuelve `{ path:'Data/Música/a b.mp3', size:3 }`.
  - `receiveFile con sha incorrecto` → `BadRequestException` y el archivo no existe en staging.
  - `receiveFile dos veces el mismo path reemplaza` (segunda subida con `'xyz'` y su sha → contenido final `'xyz'`).
  - `receiveFile con ruta '../x'` → `BadRequestException`.
  - `createSession con otra activa` → `ConflictException`; `createSession(true)` → id nuevo y el staging viejo ya no existe.
  - `createSession con una vencida` (forzar `lastActivity` 31 minutos atrás con `jest.useFakeTimers().setSystemTime`) → id nuevo sin `force`.
  - `receiveFile con sessionId desconocido` → `NotFoundException`.
- [ ] **Step 2:** `npx jest src/modules/tools/client-publish/client-publish.service.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar servicio, controller y módulo; registrar en `app.module.ts`.
- [ ] **Step 4:** tests → PASS; `npm run build` OK.
- [ ] **Step 5: Checkpoint manual** con la API local (`npm run start:dev`, `SECRET_API_KEY` del `.env`): `curl -X POST -H "x-api-key: $K" "http://localhost:3000/api/v2/tools/client-publish/sessions"` → `{"sessionId":...}`; luego `curl -X PUT -H "x-api-key: $K" -H "x-sha256: ba78...15ad" -H "Content-Type: application/octet-stream" --data-binary "abc" ".../sessions/<id>/files?path=Data%2Ftest.txt"` → 200 y el archivo aparece en `public/client-publish-staging/<id>/Data/test.txt`. Sin key → 401.

---

### Task 4: Publicar (validar, aplicar, escribir manifest)

**Files:**
- Create: `api/src/modules/tools/client-publish/dto/publish.dto.ts`
- Modify: `client-publish.service.ts`, `client-publish.service.spec.ts`, `client-publish.controller.ts`
- Modify: `api/src/main.ts` (body JSON de 5 MB, antes de `listen`)
- Create: `api/docs/client-publish.rest` (ejemplos de los 5 endpoints, estilo de `server-reset.rest`)

**Interfaces:**
- Consumes: Tasks 1–3 (`manifestPath`, `ClientManifest`, sesión con su mapa de archivos).
- Produces:
  - `PublishDto { manifest: ManifestDto; delete: string[]; extraFiles: string[] }`, `ManifestDto { version: string; file_count: number; files: ManifestFileDto[] }`, `ManifestFileDto { path: string; size: number; sha256: string }` — class-validator con `@ValidateNested({ each: true })` + `@Type(...)`; `delete` y `extraFiles` `@IsOptional()` con default `[]`.
  - `publish(id: string, dto: PublishDto): Promise<{ uploaded: number; deleted: string[]; ignored: string[]; manifestFiles: number }>`
  - `POST sessions/:id/publish`.

Reglas de `publish` (en este orden; todo lo de validación ocurre antes de tocar disco):
1. `delete`: normalizar; si alguno es `launcher.exe` → 400. Los que no existen hoy en `Client/` pasan a `ignored`.
2. Para cada `manifest.files[i]`: si `isLauncherExe` → 400; si está en `delete` (sin mayúsculas) → 400; si está en staging con ese sha → ok; si no, tiene que existir en `scanClientFiles()` con ese sha → si no, se junta en la lista de problemas.
3. `extraFiles`: cada uno tiene que estar en staging.
4. Archivos de staging que no figuran ni en el manifest ni en `extraFiles` → problema.
5. Con problemas → `BadRequestException({ message: 'El manifest no coincide con los archivos', problems })` y no se toca nada.
6. Aplicar: `rename` de cada archivo de staging a `resolveInside(clientDir(), rel)` (crear carpetas); `rm` de los `delete`; escribir manifest en `manifestPath() + '.tmp'` y `rename`; borrar staging y cerrar la sesión.

- [ ] **Step 1: Tests que fallan** (servicio):
  - `publish aplica archivos, borra y escribe el manifest`: con `Client/old.bmd` existente, staging `main.exe`, `delete:['old.bmd']` → `main.exe` en `Client/`, `old.bmd` ya no, `readPublishedManifest()` igual al enviado, resultado `{ uploaded:1, deleted:['old.bmd'], ignored:[], manifestFiles:1 }`.
  - `publish rechaza un archivo del manifest que también se borra` → 400 y `Client/` intacto, `manifest.json` previo intacto.
  - `publish rechaza sha del manifest que no está ni en staging ni en Client` → 400 con `problems` que incluye la ruta.
  - `publish rechaza borrar Launcher.exe` → 400.
  - `publish con launcher.exe en extraFiles lo copia y no lo pone en el manifest`.
  - `publish acepta un archivo existente en Client con distinta capitalización` (`Client/Data/X.bmd`, manifest `data/x.bmd` mismo sha) → OK.
  - `publish ignora borrados inexistentes` → `ignored:['nada.bmd']`.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** Implementar DTO, `publish`, endpoint y `app.useBodyParser('json', { limit: '5mb' })`. Agregar `client-publish.rest`.
- [ ] **Step 4:** `npx jest` → PASS; `npm run build` OK.
- [ ] **Step 5: Checkpoint manual:** con la sesión del checkpoint de Task 3, `POST .../publish` con un manifest que incluya `Data/test.txt` → 200 y `GET /downloads/Mu99bClassic/manifest.json` (con `x-api-key`) devuelve ese manifest. Restaurar el `public/` local después.

---

### Task 5: Escaneo compartido y diff en la tool

**Files:**
- Create: `Launcher/client-tools/client_scan.py`
- Create: `Launcher/client-tools/test_client_scan.py`
- Modify: `Launcher/client-tools/tool.py` (`_generate_manifest_worker` usa `scan_client`)
- Modify: `Launcher/client-tools/client-files-manifest/manifest.py` (importa `client_scan` vía `sys.path` en vez de duplicar exclusiones)

**Interfaces:**
- Produces:
  - `DEFAULT_EXCLUDE_DIRS`, `DEFAULT_EXCLUDE_FILES`, `EXCLUDE_EXTENSIONS = {".log", ".dmp"}`, `EXCLUDE_PATHS = {"updater.exe"}` — los valores actuales de `tool.py`/`manifest.py`, en minúsculas.
  - `sha256_file(path: str) -> str`
  - `is_excluded(rel_path: str, exclude_dirs: set[str], exclude_files: set[str]) -> bool` — compara en minúsculas: algún segmento de carpeta en `exclude_dirs`, nombre en `exclude_files`, extensión en `EXCLUDE_EXTENSIONS` o ruta completa en `EXCLUDE_PATHS`.
  - `scan_client(client_dir: str, exclude_dirs: set[str], exclude_files: set[str], on_progress=None) -> list[dict]` — `[{"path","size","sha256"}]` con `/`, ordenado; `on_progress(i, total, rel_path)`.
  - `build_manifest(files: list[dict], version: str) -> dict` → `{"version","file_count","files"}`.
  - `diff_plan(local: list[dict], remote: list[dict], mirror: bool, exclude_dirs, exclude_files) -> dict` → `{"new": [...rel], "modified": [...rel], "delete": [...rel], "unchanged": int}`. Compara por `path.lower()`; `delete` solo si `mirror`, nunca `launcher.exe` ni lo que `is_excluded` marque.
  - `looks_like_client(client_dir: str) -> bool` → existe `main.exe` en la raíz.

- [ ] **Step 1: Tests que fallan** (`unittest`, carpetas con `tempfile.TemporaryDirectory`):
  - `test_diff_detecta_nuevos_modificados_y_sin_cambios`.
  - `test_diff_sin_espejo_no_borra` → `delete == []` aunque el remoto tenga archivos extra.
  - `test_diff_espejo_borra_lo_que_no_esta_local`.
  - `test_diff_espejo_no_borra_launcher_ni_excluidos` (remoto con `launcher.exe`, `Logs/a.log`, `MuError.dmp`).
  - `test_diff_ignora_mayusculas` (local `data/x.bmd`, remoto `Data/X.bmd`, mismo sha → `unchanged == 1`, `delete == []`).
  - `test_scan_excluye_y_ordena` (crea `main.exe`, `Logs/x.txt`, `a.log`, `launcher.exe`, `Data/Launcher/updater.exe`, `updater.exe` → resultado `["Data/Launcher/updater.exe", "main.exe"]`).
  - `test_looks_like_client` (con y sin `main.exe`).
- [ ] **Step 2:** `cd Launcher && .venv/Scripts/python.exe -m unittest client-tools/test_client_scan.py` → FAIL (`ModuleNotFoundError`). (Si el nombre de carpeta con guion molesta a unittest, correr con `-s client-tools -p "test_*.py"` vía `discover`.)
- [ ] **Step 3:** Implementar `client_scan.py`; cambiar `tool.py` y `manifest.py` para usarlo sin cambiar su comportamiento visible.
- [ ] **Step 4:** tests → PASS. Correr `python client-tools/client-files-manifest/manifest.py ../Client` y comparar con el `manifest.json` previo: mismo `file_count`.
- [ ] **Step 5: Checkpoint** — `python client-tools/tool.py` abre y la pestaña "Generador Manifest" sigue generando igual.

---

### Task 6: Pestaña "Publicar en servidor"

**Files:**
- Create: `Launcher/client-tools/publish_api.py`
- Modify: `Launcher/client-tools/tool.py` (tercer tab y su worker)
- Modify: `Launcher/readme.md` (sección de Client Tools: tercera pestaña y cómo usarla)

**Interfaces:**
- Consumes: Task 5 (`scan_client`, `diff_plan`, `build_manifest`, `looks_like_client`); API de Tasks 3–4.
- Produces (`publish_api.py`, todo con `requests`, timeout 30 s, header `x-api-key`):
  - `class PublishApiError(Exception)` con el `message` del JSON de la API si lo hay.
  - `class PublishApi(base_url: str, api_key: str)` con `get_state() -> list[dict]`, `create_session(force: bool) -> str`, `cancel_session(session_id: str) -> None`, `upload_file(session_id: str, rel_path: str, full_path: str, sha256: str) -> None` (stream del archivo abierto en `data=`, `params={"path": rel_path}` para que requests codifique espacios y acentos, hasta 3 intentos ante `ConnectionError`/`Timeout`), `publish(session_id: str, manifest: dict, delete: list[str], extra_files: list[str]) -> dict`.

UI (ver el boceto del spec): carpeta + Examinar, servidor (default `MU_SERVER_URL` de `const.config` o vacío), API key (`show="•"`), versión, radio "Solo agregar/reemplazar" / "Espejo", check "Incluir launcher.exe", botón Comparar, resumen + `CTkTextbox` de solo lectura con `+`/`~`/`-`, label de estado, barra de progreso, botón Publicar (deshabilitado hasta comparar; se vuelve a deshabilitar si cambian carpeta, modo o check).

Flujo del worker de Publicar: si `not looks_like_client` → error sin tocar el servidor; si hay borrados → `messagebox.askyesno` con la cantidad y los primeros 10 nombres; `create_session(force=True)`; subir `new + modified` (+ `launcher.exe` si está tildado y su sha difiere del remoto); `publish`; mostrar `✅ Publicado: N subidos, M borrados`. Ante `PublishApiError` mostrar el mensaje y llamar `cancel_session` (ignorando errores). Las exclusiones son las de la pestaña Generador.

- [ ] **Step 1: Test que falla** `Launcher/client-tools/test_publish_api.py` con `unittest.mock.patch("requests.Session.request")`:
  - `test_upload_codifica_path_y_manda_sha` → la llamada lleva `params={"path": "Data/Música/a b.mp3"}` y header `x-sha256`.
  - `test_upload_reintenta_3_veces_y_falla` → 3 llamadas y luego `PublishApiError`.
  - `test_error_usa_message_de_la_api` → respuesta 409 `{"message":"Hay otra publicación en curso"}` → `str(err)` contiene ese texto.
- [ ] **Step 2:** `.venv/Scripts/python.exe -m unittest discover -s client-tools -p "test_*.py"` → FAIL.
- [ ] **Step 3:** Implementar `publish_api.py` y la pestaña (subir `geometry` si el tercer tab no entra).
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Checkpoint manual end-to-end** contra la API local con un `PUBLIC_DIR` de prueba que tenga una copia de `Client`:
  1. Comparar sin cambios → "Sin cambios: N", Publicar deshabilitado o sin efecto.
  2. Modificar un archivo local → Comparar muestra `~` → Publicar → el archivo cambió en `PUBLIC_DIR/downloads/.../Client` y el `manifest.json` tiene el sha nuevo.
  3. Borrar un archivo local en modo espejo → confirmación → desaparece del servidor; en modo agregar no aparece en la lista.
  4. API key incorrecta → mensaje "API key inválida", nada cambia.
- [ ] **Step 6:** Recompilar `tool.exe` con el comando del readme y verificar que abre.

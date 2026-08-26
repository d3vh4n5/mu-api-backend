los files orignales del server segun Gemini pudieron haber sido creados por "DarkHorse" o "Viciouz"

UPDATE [MuOnline99b].[dbo].[MEMB_INFO] SET ctl1_code = 0 WHERE memb___id = 'admin';
UPDATE [MuOnline99b].[dbo].Character SET CtlCode = 0 WHERE Name = 'Hanster';
-- 0 normal 1 ban 8 y 32 son admin. Pero el juego la da bola solo al archivo local.

## Autenticación web

Define `JWT_SECRET` en el entorno de la API. Como compatibilidad temporal,
también se acepta `AUTH_RESET_SECRET`.

Login:

```http
POST /api/v2/auth/login
Content-Type: application/json

{
	"login": "usuario-o-correo",
	"password": "contraseña"
}
```

La respuesta contiene `access_token`. En las rutas protegidas se envía como
`Authorization: Bearer <access_token>`. `GET /api/v2/auth/me` devuelve los
datos incluidos en el token y sirve para comprobar la sesión.

Para proteger una ruta por autenticación y rol, usa ambos guards:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
```

Las cuentas con `ctl1_code` `8` o `32` reciben el rol `admin`; las demás
reciben `user` y las cuentas con `ctl1_code` `1` no pueden iniciar sesión.


Limpieza absoluta de docker:

docker stop mu_sql_docker
docker rm -f mu_sql_docker
docker volume rm api_mssql_data
docker system prune --volumes -f


Docker:
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=MuOnline.2026.Docker!" -p 1433:1433 --name mu_sql_docker -d mcr.microsoft.com/mssql/server:2022-latest

docker cp database.sql mu_sql_docker:/var/opt/mssql/database.sql

En la consola de docker:

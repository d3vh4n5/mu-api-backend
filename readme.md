los files orignales del server segun Gemini pudieron haber sido creados por "DarkHorse" o "Viciouz"

UPDATE [MuOnline99b].[dbo].[MEMB_INFO] SET ctl1_code = 0 WHERE memb___id = 'admin';
UPDATE [MuOnline99b].[dbo].Character SET CtlCode = 0 WHERE Name = 'Hanster';
-- 0 normal 1 ban 8 y 32 son admin. Pero el juego la da bola solo al archivo local.


Limpieza absoluta de docker:

docker stop mu_sql_docker
docker rm -f mu_sql_docker
docker volume rm api_mssql_data
docker system prune --volumes -f


Docker:
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=MuOnline.2026.Docker!" -p 1433:1433 --name mu_sql_docker -d mcr.microsoft.com/mssql/server:2022-latest

docker cp database.sql mu_sql_docker:/var/opt/mssql/database.sql

En la consola de docker:

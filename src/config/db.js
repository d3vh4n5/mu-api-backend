import sql from 'mssql';
import { config as dotenv } from 'dotenv';

dotenv()

export const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASS || 'root', // Asegúrate de que coincida con el paso 2
    server: process.env.DB_HOST || 'localhost', 
    database: process.env.DB_NAME || 'master',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.NODE_ENV == "PROD" ? true : false,
        trustServerCertificate: true
    }
};

async function conectar() {
    try {
        console.log("Intentando conectar...");
        let pool = await sql.connect(config);
        console.log("¡Base de datos conectada!");
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log(result.recordset[0].version);
        await sql.close();
    } catch (err) {
        console.error("Error detallado:", err.message);
    }
}

conectar();
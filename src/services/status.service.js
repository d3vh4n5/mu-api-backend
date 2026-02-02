import sql from 'mssql';
import { config as dbConfig } from '../config/db.js';

export class StatusService{
    static async getStatus() {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query('SELECT COUNT(*) as online FROM MEMB_STAT WHERE ConnectStat = 1');

        return result.recordset[0];
    }
}
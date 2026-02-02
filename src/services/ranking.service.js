import sql from 'mssql';
import { config as dbConfig } from '../config/db.js';

export class RankingService {

    static async getRanking(){
        let pool = await sql.connect(dbConfig);
        console.log("Probando git")
        const result = await pool.request()
            .query(`
                SELECT TOP 10 
                    C.Name, 
                    C.Class, 
                    C.cLevel, 
                    ISNULL(C.ResetCount, 0) as Resets 
                FROM Character C
                JOIN MEMB_INFO M ON C.AccountID = M.memb___id
                WHERE M.ctl1_code = 0  -- Que la cuenta NO esté bloqueada/admin
                AND C.CtlCode = 0    -- Que el personaje NO sea GM o esté bloqueado
                ORDER BY C.ResetCount DESC, C.cLevel DESC
            `);
        return result
    }
}
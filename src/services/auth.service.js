import sql from 'mssql';
import { config as dbConfig } from '../config/db.js';

export class AuthService {

    static async createUser({ username, password, name, email }) {
        let pool = await sql.connect(dbConfig);

        // 1. Verificar si existe
        const checkUser = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT memb___id FROM MEMB_INFO WHERE memb___id = @username');

        if (checkUser.recordset.length > 0) {
            throw new Error('USER_EXISTS');
        }

        // 2. Insertar usuario
        await pool.request()
            .input('id', sql.VarChar, username)
            .input('pwd', sql.VarChar, password)
            .input('name', sql.VarChar, name || username)
            .input('mail', sql.VarChar, email)
            .query(`
                INSERT INTO MEMB_INFO 
                (memb___id, memb__pwd, memb_name, sno__numb, post_code, addr_info, addr_deta, mail_addr, fpas_ques, fpas_answ, job__code, appl_days, modi_days, out__days, true_days, mail_chek, bloc_code, ctl1_code)
                VALUES 
                (@id, @pwd, @name, '1111111111111', '1234', '1', '1', @mail, 'Pregunta', 'Respuesta', '1', GETDATE(), GETDATE(), GETDATE(), GETDATE(), '1', '0', '0')
            `);

        return true;
    }
}

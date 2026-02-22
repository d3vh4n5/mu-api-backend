import { prisma } from "../lib/prisma/prisma.ts";

export class AuthService {

    static async createUser({ username, password, name, email }) {
        console.log('Creando usuario:', { username, name, email });
        const existingUser = await prisma.mEMB_INFO.findFirst({
            where: { memb___id: username }
        });

        if (existingUser) {
            throw new Error('USER_EXISTS');
        }

        const result = await prisma.mEMB_INFO.create({
            data: {
                // Campos variables
                memb___id: username,
                memb__pwd: password,
                memb_name: name || username,
                mail_addr: email,

                // Campos constantes obligatorios (el "relleno" del Mu Online)
                sno__numb: '1111111111111',
                post_code: '1234',
                addr_info: '1',
                addr_deta: '1',
                fpas_ques: 'Pregunta',
                fpas_answ: 'Respuesta',
                job__code: '1',
                mail_chek: '1',
                bloc_code: '0',
                ctl1_code: '0',

                // Fechas (Prisma traduce new Date() al GETDATE() de SQL)
                appl_days: new Date(),
                modi_days: new Date(),
                out__days: new Date(),
                true_days: new Date(),
                
                // Si tu tabla tiene AccountLevel y otros campos nuevos de Season alta:
                AccountLevel: 0,
                AccountExpireDate: new Date()
            }
        });

        console.log('Usuario creado:', result);

        return result

        // 1. Verificar si existe
        const checkUser = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT memb___id FROM MEMB_INFO WHERE memb___id = @username');

        if (checkUser.recordset.length > 0) {
            throw new Error('USER_EXISTS');
        }
        // TODO: Ver que el email no exista ya

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

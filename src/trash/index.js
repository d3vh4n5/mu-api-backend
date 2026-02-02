
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('user', sql.VarChar, username)
            .input('pass', sql.VarChar, password)
            .query('SELECT memb___id, memb_name FROM MEMB_INFO WHERE memb___id = @user AND memb__pwd = @pass');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            
            // Creamos el Token
            const token = jwt.sign(
                { id: user.memb___id, name: user.memb_name },
                SECRET_KEY,
                { expiresIn: '2h' } // El login dura 2 horas
            );

            res.json({ message: "Login exitoso", token });
        } else {
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});



const autenticarToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Acceso denegado" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido o expirado" });
        req.user = user; // Guardamos los datos del usuario (su ID) en el request
        next();
    });
};

// RUTA PARA RESETEAR
app.post('/api/reset', autenticarToken, async (req, res) => {
    const { charName } = req.body;
    const accountId = req.user.id; // Obtenido del token

    try {
        let pool = await sql.connect(dbConfig);
        
        // 1. Verificar nivel y que el personaje pertenezca a la cuenta
        const char = await pool.request()
            .input('name', sql.VarChar, charName)
            .input('acc', sql.VarChar, accountId)
            .query('SELECT cLevel FROM Character WHERE Name = @name AND AccountID = @acc');

        if (char.recordset.length === 0) return res.status(404).json({ error: "Personaje no encontrado" });
        if (char.recordset[0].cLevel < 400) return res.status(400).json({ error: "Necesitas nivel 400 para resetear" });

        // 2. Ejecutar el Reset
        await pool.request()
            .input('name', sql.VarChar, charName)
            .query(`
                UPDATE Character 
                SET cLevel = 1, 
                    Experience = 0, 
                    ResetCount = ResetCount + 1, 
                    LevelUpPoint = LevelUpPoint + 500 -- Puntos de premio por reset
                WHERE Name = @name
            `);

        res.json({ message: "¡Reset exitoso! Has recibido 500 puntos." });
    } catch (err) {
        res.status(500).json({ error: "Error al procesar el reset" });
    }
});

// RUTA PARA REPARTIR PUNTOS (Ejemplo Fuerza)
app.post('/api/add-stats', autenticarToken, async (req, res) => {
    const { charName, str } = req.body; // str es la cantidad a sumar
    const accountId = req.user.id;

    try {
        let pool = await sql.connect(dbConfig);
        
        // Verificar puntos disponibles
        const char = await pool.request()
            .input('name', sql.VarChar, charName)
            .input('acc', sql.VarChar, accountId)
            .query('SELECT LevelUpPoint FROM Character WHERE Name = @name AND AccountID = @acc');

        if (char.recordset[0].LevelUpPoint < str) return res.status(400).json({ error: "No tienes suficientes puntos" });

        // Restar de LevelUpPoint y sumar a Strength
        await pool.request()
            .input('name', sql.VarChar, charName)
            .input('val', sql.Int, str)
            .query(`
                UPDATE Character 
                SET Strength = Strength + @val, 
                    LevelUpPoint = LevelUpPoint - @val 
                WHERE Name = @name
            `);

        res.json({ message: "Puntos repartidos correctamente" });
    } catch (err) {
        res.status(500).json({ error: "Error al repartir puntos" });
    }
});

// PANEL DE ADMIN: Cambiar rangos o banear
app.post('/api/admin/update-status', autenticarToken, async (req, res) => {
    const { targetName, action } = req.body;
    const adminId = req.user.id; // El ID de quien hace la petición (desde el token)

    // SEGURIDAD: Solo TÚ puedes usar esto. 
    // Reemplaza 'TU_USUARIO_ADMIN' por tu login real.
    if (adminId !== 'admin') {
        return res.status(403).json({ error: "No tienes permisos de administrador." });
    }

    try {
        let pool = await sql.connect(dbConfig);
        
        if (action === 'HACER_GM') {
            await pool.request()
                .input('name', sql.VarChar, targetName)
                .query('UPDATE Character SET CtlCode = 32 WHERE Name = @name');
            return res.json({ message: `${targetName} ahora es GameMaster.` });
        } 
        
        if (action === 'BANEAR_CUENTA') {
            await pool.request()
                .input('user', sql.VarChar, targetName)
                .query('UPDATE MEMB_INFO SET ctl1_code = 1 WHERE memb___id = @user');
            return res.json({ message: `Cuenta ${targetName} baneada.` });
        }

        if (action === 'DESBANEAR_CUENTA') {
            await pool.request()
                .input('user', sql.VarChar, targetName)
                .query('UPDATE MEMB_INFO SET ctl1_code = 0 WHERE memb___id = @user');
            return res.json({ message: `Cuenta ${targetName} activada.` });
        }

        res.status(400).json({ error: "Acción no válida." });
    } catch (err) {
        res.status(500).json({ error: "Error en la base de datos." });
    }
});
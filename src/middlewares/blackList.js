const intentosFallidos = {}; // Diccionario temporal (En producción usa Redis)
const LIMITE_ERRORES = 5;

export const failsChecker = (req, res, next) => {
    const ip = req.ip;
    if (intentosFallidos[ip] >= LIMITE_ERRORES) {
        return res.status(403).send('Tu IP ha sido bloqueada temporalmente por actividad sospechosa.');
    }
    console.log(`Intentos fallidos para ${ip}: ${intentosFallidos[ip] || 0}`);
    next();
}

export const registrarFallo = (req, res) => {
    const ip = req.ip;
    intentosFallidos[ip] = (intentosFallidos[ip] || 0) + 1;
    
    console.log(`⚠️ 404 detectado desde ${ip}. Intento: ${intentosFallidos[ip]}`);
    res.status(404).send('No encontrado.');
};

// Limpieza periódica de IPs bloqueadas (cada hora)
setInterval(() => {
    for (const ip in intentosFallidos) {
        if (intentosFallidos[ip] >= LIMITE_ERRORES) {
            console.log(`🔓 Desbloqueando IP: ${ip}`);
            delete intentosFallidos[ip];
        }
    }
}, 60 * 60 * 1000); // Cada hora
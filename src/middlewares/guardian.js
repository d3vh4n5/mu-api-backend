const API_KEY_VALIDA = process.env.API_KEY;
const LIMITE_INTENTOS = 5;
const TIEMPO_BLOQUEO = 15 * 60 * 1000; // 15 minutos en milisegundos

const listaNegra = new Map();

export const guardian = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const ahora = Date.now();
    console.log(listaNegra)
    // 1. Verificar si la IP ya está bloqueada
    if (listaNegra.has(ip)) {
        const info = listaNegra.get(ip);
        if (ahora < info.bloqueadoHasta) {
            return res.status(403).send('Tu IP ha sido bloqueada por actividad sospechosa.');
        } else {
            
            if (info.intentos >= LIMITE_INTENTOS) {
                listaNegra.delete(ip); // El tiempo expiró, le damos otra oportunidad
            }
        }
    }

    // 2. Validar API Key
    const apiKeyCliente = req.header('x-api-key');
    if (!apiKeyCliente || apiKeyCliente !== API_KEY_VALIDA) {
        
        // Registrar intento fallido
        const registro = listaNegra.get(ip) || { intentos: 0, bloqueadoHasta: 0 };
        registro.intentos++;
        
        if (registro.intentos >= LIMITE_INTENTOS) {
            registro.bloqueadoHasta = ahora + TIEMPO_BLOQUEO;
            console.log(`🚫 IP BLOQUEADA: ${ip} hasta ${new Date(registro.bloqueadoHasta).toISOString()}`);
        }
        
        listaNegra.set(ip, registro);
        
        return res.status(401).json({ 
            error: "No autorizado", 
            //intentos_restantes: Math.max(0, LIMITE_INTENTOS - registro.intentos) 
        });
    }

    // Si llegó aquí, la API Key es correcta. Reseteamos sus intentos por si acaso.
    listaNegra.delete(ip);
    next();
};

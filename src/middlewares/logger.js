export const logger = (req, res, next) => {
    const start = Date.now();
    // Obtenemos la IP. Si req.ip no basta, a veces se usa req.headers['x-forwarded-for']
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    
    console.log(`IN  [${new Date().toISOString()}] ${ip} | ${req.method} ${req.originalUrl}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;

        let color = '\x1b[32m'; // verde (2xx)
        if (res.statusCode >= 400) color = '\x1b[33m'; // amarillo (4xx)
        if (res.statusCode >= 500) color = '\x1b[31m'; // rojo (5xx)

        console.log(
            `${color}OUT [${new Date().toISOString()}] ${ip} | ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)\x1b[0m`
        );
    });
    
    next();
}
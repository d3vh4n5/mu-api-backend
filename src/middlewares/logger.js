export const logger = (req, res, next) => {
    const start = Date.now();
    console.log(`IN  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;

        let color = '\x1b[32m'; // verde
        if (res.statusCode >= 400) color = '\x1b[33m'; // amarillo
        if (res.statusCode >= 500) color = '\x1b[31m'; // rojo

        console.log(
            `${color}OUT [${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
        );
    });
    
    next();
}
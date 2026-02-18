import rateLimit from 'express-rate-limit';

export const limitadorDescorteces = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    max: 100, // Límite de 100 peticiones por IP en esos 15 min
    message: "Demasiadas peticiones, por favor intenta más tarde.",
    standardHeaders: true, // Devuelve información de límite en los headers
    legacyHeaders: false,
});

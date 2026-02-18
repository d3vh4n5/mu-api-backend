import crypto from 'crypto';

/**
 * Genera una API Key segura
 * @param {string} prefix - Identificador (ej: 'api_dev', 'sk_live')
 */
function generateSecureApiKey(prefix = 'sk') {
    // Generamos 32 bytes de datos aleatorios (muy difícil de predecir)
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${randomBytes}`;
}

const nuevaKey = generateSecureApiKey('mu_api');
console.log("🗝️ Tu nueva API KEY:");
console.log(nuevaKey);
// Ejemplo de salida: myapi_8f21b1... (64 caracteres aleatorios)
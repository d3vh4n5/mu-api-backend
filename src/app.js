import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import authRouter from './routes/auth.routes.js';
import rankingRouter from './routes/ranking.routes.js'
import statusRouter from './routes/status.routes.js'
import { logger } from './middlewares/logger.js';
import healthRouter from './routes/health.routes.js'
import launcherRouter from './routes/launcher.routes.js';
import { failsChecker, registrarFallo } from './middlewares/blackList.js';
import { guardian } from './middlewares/guardian.js';
import { limitadorDescorteces } from './middlewares/rateLimit.js';

export const app = express();
const SECRET_KEY = process.env.SECRET_KEY ?? "secret"; // Cambia esto por algo difícil


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json()); // Para poder leer datos JSON en el body
app.use(helmet());
//app.set('trust proxy', true); // Si estás detrás de un proxy (como Nginx o Heroku), esto es importante para obtener la IP real del cliente

app.use(logger);
app.use(limitadorDescorteces); // Aplicar rate limiting
app.use(failsChecker);
app.use(guardian);
app.use(express.static(path.join(__dirname, '../public')));

app.use('/health', healthRouter)
app.use('/api/auth', authRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/status', statusRouter);
app.use('/api/launcher', launcherRouter);

app.use(registrarFallo); // Middleware para registrar fallos 404

// Middleware de manejo de errores (opcional, para capturar errores no manejados)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Error interno del servidor.');
});
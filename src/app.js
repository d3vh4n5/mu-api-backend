import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import authRouter from './routes/auth.routes.js';
import rankingRouter from './routes/ranking.routes.js'
import statusRouter from './routes/status.routes.js'
import { logger } from './middlewares/logger.js';
import healthRouter from './routes/health.routes.js'

export const app = express();
const SECRET_KEY = process.env.SECRET_KEY ?? "secret"; // Cambia esto por algo difícil


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json()); // Para poder leer datos JSON en el body
app.use(express.static(path.join(__dirname, 'public')));

app.use(logger);
app.use('/health', healthRouter)
app.use('/api/auth', authRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/status', statusRouter);


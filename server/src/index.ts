import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import feedRouter from './routes/feed';
import socialRouter from './routes/social';
import connectionsRouter from './routes/connections';
import accountRouter from './routes/account';
import broadcastRouter from './routes/broadcast';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { initFeedSocket } from './services/feedSocket';
import { runMigrations } from './db/migrate';
import { startScheduler, stopScheduler } from './scheduler';

dotenv.config();

// Validate required env vars
const requiredEnvVars = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'DB_HOST'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*' },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes — unprotected
app.use('/auth', authRouter);

// Auth middleware — applied to all protected routes
app.use('/feed', authMiddleware, feedRouter);
app.use('/social', authMiddleware, socialRouter);
app.use('/connections', authMiddleware, connectionsRouter);
app.use('/account', authMiddleware, accountRouter);
app.use('/broadcasts', authMiddleware, broadcastRouter);

initFeedSocket(io);

// Error handler — must be last
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function boot() {
  await runMigrations();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startScheduler();
  });
}

process.on('SIGTERM', () => {
  stopScheduler();
  httpServer.close();
});

process.on('SIGINT', () => {
  stopScheduler();
  httpServer.close();
});

boot().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, io, httpServer };

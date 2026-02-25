import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import feedRouter from './routes/feed';
import socialRouter from './routes/social';
import connectionsRouter from './routes/connections';
import accountRouter from './routes/account';
import { initFeedSocket } from './services/feedSocket';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/feed', feedRouter);
app.use('/social', socialRouter);
app.use('/connections', connectionsRouter);
app.use('/account', accountRouter);

initFeedSocket(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, io, httpServer };

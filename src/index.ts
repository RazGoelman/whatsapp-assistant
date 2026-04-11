import express from 'express';
import { config } from './config';
import webhookRouter from './routes/webhook';

const app = express();

app.use(express.json());
app.use(webhookRouter);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.send('WhatsApp Calendar Bot is running!');
});

app.listen(config.port, () => {
  console.log(`🚀 WhatsApp Calendar Bot running on port ${config.port}`);
  console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook`);
});

export default app;

import express from 'express';
import { config } from './config';
import webhookRouter from './routes/webhook';
import { startReminders, startDailySummary } from './services/scheduler';

const app = express();

app.use(express.json());
app.use(webhookRouter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.send('WhatsApp Calendar Bot is running!');
});

app.listen(config.port, () => {
  console.log(`🚀 WhatsApp Calendar Bot running on port ${config.port}`);
  console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook`);
  startReminders();
  startDailySummary();
});

export default app;

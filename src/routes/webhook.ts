import { Router, Request, Response } from 'express';
import { config } from '../config';
import { handleIncomingMessage, handleVoiceMessage } from '../services/router';

const router = Router();

router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

router.post('/webhook', (req: Request, res: Response) => {
  res.status(200).send('OK');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    if (!value?.messages) return;

    const message = value.messages[0];
    const from = message.from;
    console.log(`📥 Message from ${from}, type: ${message.type}`);

    if (message.type === 'text') {
      handleIncomingMessage(from, message.text.body).catch((err) =>
        console.error('❌ Message handler error:', err.message)
      );
    } else if (message.type === 'audio') {
      handleVoiceMessage(from, message.audio.id).catch((err) =>
        console.error('❌ Voice handler error:', err.message)
      );
    } else {
      handleIncomingMessage(from, `[${message.type}]`).catch((err) =>
        console.error('❌ Handler error:', err.message)
      );
    }
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error.message);
  }
});

export default router;

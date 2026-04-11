import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// GET route for webhook verification
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

// POST route for incoming messages (placeholder for now)
router.post('/webhook', (req: Request, res: Response) => {
  console.log('📥 Received webhook:', JSON.stringify(req.body, null, 2));
  res.status(200).send('OK');
});

export default router;

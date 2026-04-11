"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const router = (0, express_1.Router)();
// GET route for webhook verification
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config_1.config.meta.webhookVerifyToken) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    }
    else {
        console.log('❌ Webhook verification failed');
        res.status(403).send('Forbidden');
    }
});
// POST route for incoming messages (placeholder for now)
router.post('/webhook', (req, res) => {
    console.log('📥 Received webhook:', JSON.stringify(req.body, null, 2));
    res.status(200).send('OK');
});
exports.default = router;

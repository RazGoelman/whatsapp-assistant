"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const router_1 = require("../services/router");
const router = (0, express_1.Router)();
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
// Deduplication: track processed message IDs
const processedMessages = new Set();
router.post('/webhook', (req, res) => {
    res.status(200).send('OK');
    try {
        const body = req.body;
        if (body.object !== 'whatsapp_business_account')
            return;
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        if (!value?.messages)
            return;
        const message = value.messages[0];
        const from = message.from;
        const messageId = message.id;
        if (processedMessages.has(messageId)) {
            console.log(`⏭️ Skipping duplicate message: ${messageId}`);
            return;
        }
        processedMessages.add(messageId);
        if (processedMessages.size > 200) {
            const arr = Array.from(processedMessages);
            arr.slice(0, arr.length - 100).forEach((id) => processedMessages.delete(id));
        }
        console.log(`📥 Message from ${from}, type: ${message.type}`);
        if (message.type === 'text') {
            (0, router_1.handleIncomingMessage)(from, message.text.body).catch((err) => console.error('❌ Message handler error:', err.message));
        }
        else if (message.type === 'audio') {
            (0, router_1.handleVoiceMessage)(from, message.audio.id).catch((err) => console.error('❌ Voice handler error:', err.message));
        }
        else {
            (0, router_1.handleIncomingMessage)(from, `[${message.type}]`).catch((err) => console.error('❌ Handler error:', err.message));
        }
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error.message);
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.sendWhatsAppReaction = sendWhatsAppReaction;
exports.downloadMedia = downloadMedia;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const API_URL = `https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${config_1.config.meta.phoneNumberId}/messages`;
async function sendWhatsAppMessage(to, text) {
    try {
        await axios_1.default.post(API_URL, {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        }, {
            headers: {
                Authorization: `Bearer ${config_1.config.meta.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        console.log(`📤 Message sent to ${to}`);
    }
    catch (error) {
        console.error('❌ Failed to send WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
}
async function sendWhatsAppReaction(to, messageId, emoji) {
    try {
        await axios_1.default.post(API_URL, {
            messaging_product: 'whatsapp',
            to,
            type: 'reaction',
            reaction: { message_id: messageId, emoji },
        }, {
            headers: {
                Authorization: `Bearer ${config_1.config.meta.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
    }
    catch (error) {
        console.error('❌ Failed to send reaction:', error.response?.data || error.message);
    }
}
async function downloadMedia(mediaId) {
    const mediaUrl = `https://graph.facebook.com/${config_1.config.meta.graphApiVersion}/${mediaId}`;
    const metaRes = await axios_1.default.get(mediaUrl, {
        headers: { Authorization: `Bearer ${config_1.config.meta.accessToken}` },
    });
    const downloadRes = await axios_1.default.get(metaRes.data.url, {
        headers: { Authorization: `Bearer ${config_1.config.meta.accessToken}` },
        responseType: 'arraybuffer',
    });
    return Buffer.from(downloadRes.data);
}

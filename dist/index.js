"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (_req, res) => {
    res.send('WhatsApp Calendar Bot is running!');
});
app.listen(config_1.config.port, () => {
    console.log(`🚀 WhatsApp Calendar Bot running on port ${config_1.config.port}`);
    console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook`);
});
exports.default = app;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const webhook_1 = __importDefault(require("./routes/webhook"));
const scheduler_1 = require("./services/scheduler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(webhook_1.default);
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (_req, res) => {
    res.send('WhatsApp Calendar Bot is running!');
});
app.listen(config_1.config.port, () => {
    console.log(`🚀 WhatsApp Calendar Bot running on port ${config_1.config.port}`);
    console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook`);
    (0, scheduler_1.startReminders)();
    (0, scheduler_1.startDailySummary)();
    (0, scheduler_1.startWeeklySummary)();
});
exports.default = app;

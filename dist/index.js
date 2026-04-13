"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const webhook_1 = __importDefault(require("./routes/webhook"));
const booking_1 = __importDefault(require("./routes/booking"));
const scheduler_1 = require("./services/scheduler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(webhook_1.default);
app.use(booking_1.default);
app.get("/health", (_req, res) => { res.status(200).json({ status: "ok" }); });
app.get("/", (_req, res) => { res.send("WhatsApp Calendar Bot is running!"); });
app.listen(config_1.config.port, () => {
    console.log("Bot running on port " + config_1.config.port);
    console.log("Booking: " + config_1.config.baseUrl + "/book");
    (0, scheduler_1.startReminders)();
    (0, scheduler_1.startDailySummary)();
    (0, scheduler_1.startWeeklySummary)();
    (0, scheduler_1.startBirthdayReminders)();
});
exports.default = app;

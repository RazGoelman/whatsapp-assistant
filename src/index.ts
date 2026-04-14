import express from "express";
import { config } from "./config";
import webhookRouter from "./routes/webhook";
import bookingRouter from "./routes/booking";
import { startReminders, startDailySummary, startWeeklySummary, startBirthdayReminders, startCustomReminders } from "./services/scheduler";
const app = express();
app.use(express.json());
app.use(webhookRouter);
app.use(bookingRouter);
app.get("/health", (_req, res) => { res.status(200).json({ status: "ok" }); });
app.get("/", (_req, res) => { res.send("WhatsApp Calendar Bot is running!"); });
app.listen(config.port, () => {
  console.log("Bot running on port " + config.port);
  console.log("Booking: " + config.baseUrl + "/book");
  startReminders(); startDailySummary(); startWeeklySummary(); startBirthdayReminders();
  startCustomReminders();
});
export default app;

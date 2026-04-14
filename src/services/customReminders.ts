import * as fs from "fs";
import * as path from "path";
const DATA_DIR = path.join(process.cwd(), "data");
const REMINDERS_FILE = path.join(DATA_DIR, "reminders.json");
export interface CustomReminder { id: string; text: string; dateTime: string; from: string; sent: boolean; }
function ensureDataDir(): void { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function loadReminders(): CustomReminder[] { ensureDataDir(); if (!fs.existsSync(REMINDERS_FILE)) return []; try { return JSON.parse(fs.readFileSync(REMINDERS_FILE, "utf8")); } catch { return []; } }
function saveReminders(r: CustomReminder[]): void { ensureDataDir(); fs.writeFileSync(REMINDERS_FILE, JSON.stringify(r, null, 2)); }
export function addReminder(text: string, dateTime: string, from: string): CustomReminder { const reminders = loadReminders(); const reminder: CustomReminder = { id: "r" + Date.now(), text, dateTime, from, sent: false }; reminders.push(reminder); saveReminders(reminders); return reminder; }
export function getTodayReminders(from: string): CustomReminder[] { const reminders = loadReminders(); const today = new Date().toISOString().split("T")[0]; return reminders.filter((r) => r.from === from && r.dateTime.startsWith(today) && !r.sent).sort((a, b) => a.dateTime.localeCompare(b.dateTime)); }
export function getPendingReminders(): CustomReminder[] { const now = new Date().toISOString(); return loadReminders().filter((r) => !r.sent && r.dateTime <= now); }
export function markReminderSent(id: string): void { const reminders = loadReminders(); const r = reminders.find((x) => x.id === id); if (r) { r.sent = true; saveReminders(reminders); } }
export function getAllActiveReminders(from: string): CustomReminder[] { return loadReminders().filter((r) => r.from === from && !r.sent).sort((a, b) => a.dateTime.localeCompare(b.dateTime)); }

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReminder = addReminder;
exports.getTodayReminders = getTodayReminders;
exports.getPendingReminders = getPendingReminders;
exports.markReminderSent = markReminderSent;
exports.getAllActiveReminders = getAllActiveReminders;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), "data");
const REMINDERS_FILE = path.join(DATA_DIR, "reminders.json");
function ensureDataDir() { if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true }); }
function loadReminders() { ensureDataDir(); if (!fs.existsSync(REMINDERS_FILE))
    return []; try {
    return JSON.parse(fs.readFileSync(REMINDERS_FILE, "utf8"));
}
catch {
    return [];
} }
function saveReminders(r) { ensureDataDir(); fs.writeFileSync(REMINDERS_FILE, JSON.stringify(r, null, 2)); }
function addReminder(text, dateTime, from) { const reminders = loadReminders(); const reminder = { id: "r" + Date.now(), text, dateTime, from, sent: false }; reminders.push(reminder); saveReminders(reminders); return reminder; }
function getTodayReminders(from) { const reminders = loadReminders(); const today = new Date().toISOString().split("T")[0]; return reminders.filter((r) => r.from === from && r.dateTime.startsWith(today) && !r.sent).sort((a, b) => a.dateTime.localeCompare(b.dateTime)); }
function getPendingReminders() { const now = new Date().toISOString(); return loadReminders().filter((r) => !r.sent && r.dateTime <= now); }
function markReminderSent(id) { const reminders = loadReminders(); const r = reminders.find((x) => x.id === id); if (r) {
    r.sent = true;
    saveReminders(reminders);
} }
function getAllActiveReminders(from) { return loadReminders().filter((r) => r.from === from && !r.sent).sort((a, b) => a.dateTime.localeCompare(b.dateTime)); }

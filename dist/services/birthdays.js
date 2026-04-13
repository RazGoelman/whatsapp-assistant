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
exports.addBirthday = addBirthday;
exports.removeBirthday = removeBirthday;
exports.getUpcomingBirthdays = getUpcomingBirthdays;
exports.getTodayBirthdays = getTodayBirthdays;
exports.getTomorrowBirthdays = getTomorrowBirthdays;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), "data");
const BIRTHDAYS_FILE = path.join(DATA_DIR, "birthdays.json");
function ensureDataDir() { if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true }); }
function loadBirthdays() { ensureDataDir(); if (!fs.existsSync(BIRTHDAYS_FILE))
    return []; try {
    return JSON.parse(fs.readFileSync(BIRTHDAYS_FILE, "utf8"));
}
catch {
    return [];
} }
function saveBirthdays(b) { ensureDataDir(); fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(b, null, 2)); }
function addBirthday(name, date, type = "birthday") { const b = loadBirthdays(); const i = b.findIndex((x) => x.name.toLowerCase() === name.toLowerCase()); if (i >= 0)
    b[i] = { name, date, type };
else
    b.push({ name, date, type }); saveBirthdays(b); }
function removeBirthday(name) { const b = loadBirthdays(); const f = b.filter((x) => x.name.toLowerCase() !== name.toLowerCase()); if (f.length === b.length)
    return false; saveBirthdays(f); return true; }
function getUpcomingBirthdays(daysAhead = 30) { const b = loadBirthdays(); const now = new Date(); const u = []; for (const x of b) {
    const [mm, dd] = x.date.split("-").map(Number);
    const d = new Date(now.getFullYear(), mm - 1, dd);
    if (d < now)
        d.setFullYear(d.getFullYear() + 1);
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diff <= daysAhead)
        u.push({ ...x, daysUntil: diff });
} return u.sort((a, b) => a.daysUntil - b.daysUntil); }
function getTodayBirthdays() { const now = new Date(); const s = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"); return loadBirthdays().filter((b) => b.date === s); }
function getTomorrowBirthdays() { const t = new Date(); t.setDate(t.getDate() + 1); const s = String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); return loadBirthdays().filter((b) => b.date === s); }

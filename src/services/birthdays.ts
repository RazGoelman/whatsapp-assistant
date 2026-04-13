import * as fs from "fs";
import * as path from "path";
const DATA_DIR = path.join(process.cwd(), "data");
const BIRTHDAYS_FILE = path.join(DATA_DIR, "birthdays.json");
export interface Birthday { name: string; date: string; type: "birthday" | "anniversary" | "custom"; }
function ensureDataDir(): void { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function loadBirthdays(): Birthday[] { ensureDataDir(); if (!fs.existsSync(BIRTHDAYS_FILE)) return []; try { return JSON.parse(fs.readFileSync(BIRTHDAYS_FILE, "utf8")); } catch { return []; } }
function saveBirthdays(b: Birthday[]): void { ensureDataDir(); fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(b, null, 2)); }
export function addBirthday(name: string, date: string, type: Birthday["type"] = "birthday"): void { const b = loadBirthdays(); const i = b.findIndex((x) => x.name.toLowerCase() === name.toLowerCase()); if (i >= 0) b[i] = { name, date, type }; else b.push({ name, date, type }); saveBirthdays(b); }
export function removeBirthday(name: string): boolean { const b = loadBirthdays(); const f = b.filter((x) => x.name.toLowerCase() !== name.toLowerCase()); if (f.length === b.length) return false; saveBirthdays(f); return true; }
export function getUpcomingBirthdays(daysAhead: number = 30): Birthday[] { const b = loadBirthdays(); const now = new Date(); const u: (Birthday & { daysUntil: number })[] = []; for (const x of b) { const [mm, dd] = x.date.split("-").map(Number); const d = new Date(now.getFullYear(), mm - 1, dd); if (d < now) d.setFullYear(d.getFullYear() + 1); const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000); if (diff <= daysAhead) u.push({ ...x, daysUntil: diff }); } return u.sort((a, b) => a.daysUntil - b.daysUntil); }
export function getTodayBirthdays(): Birthday[] { const now = new Date(); const s = String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"); return loadBirthdays().filter((b) => b.date === s); }
export function getTomorrowBirthdays(): Birthday[] { const t = new Date(); t.setDate(t.getDate() + 1); const s = String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); return loadBirthdays().filter((b) => b.date === s); }

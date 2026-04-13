"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const calendar_1 = require("../services/calendar");
const whatsapp_1 = require("../services/whatsapp");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get("/book", (_req, res) => { res.send(getBookingPageHTML()); });
router.get("/api/slots", async (req, res) => {
    try {
        const date = req.query.date;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).json({ error: "Invalid date" });
            return;
        }
        const events = await (0, calendar_1.queryEvents)(new Date(date + "T08:00:00").toISOString(), new Date(date + "T20:00:00").toISOString());
        const busy = events.map((e) => ({ start: e.start.split("T")[1]?.substring(0, 5) || "00:00", end: e.end.split("T")[1]?.substring(0, 5) || "00:00" })).sort((a, b) => a.start.localeCompare(b.start));
        const slots = [];
        for (let h = 8; h < 20; h++) {
            for (const m of [0, 30]) {
                const start = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
                const endH = m === 30 ? h + 1 : h;
                const endM = m === 30 ? 0 : 30;
                const end = String(endH).padStart(2, "0") + ":" + String(endM).padStart(2, "0");
                if (!busy.some((b) => b.start < end && b.end > start))
                    slots.push(start);
            }
        }
        res.json({ date, slots });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post("/api/book", async (req, res) => {
    try {
        const { name, email, subject, date, time } = req.body;
        if (!name || !email || !subject || !date || !time) {
            res.status(400).json({ error: "Missing fields" });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ error: "Invalid email" });
            return;
        }
        const start = date + "T" + time + ":00";
        const [h, m] = time.split(":").map(Number);
        const end = date + "T" + String(h).padStart(2, "0") + ":" + String(m + 30).padStart(2, "0") + ":00";
        await (0, calendar_1.createEvent)({ summary: subject + " \u2014 " + name, start, end, description: "Booked by: " + name + "\nEmail: " + email, attendees: [email] });
        await (0, whatsapp_1.sendWhatsAppMessage)(config_1.config.userPhoneNumber, "\u{1f4c5} \u05e0\u05e7\u05d1\u05e2\u05d4 \u05e4\u05d2\u05d9\u05e9\u05d4 \u05d7\u05d3\u05e9\u05d4!\n\u{1f464} " + name + "\n\u{1f4e7} " + email + "\n\u{1f4cb} " + subject + "\n\u{1f550} " + date + " " + time);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
function getBookingPageHTML() {
    return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>\u05e7\u05d1\u05d9\u05e2\u05ea \u05e4\u05d2\u05d9\u05e9\u05d4</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f5f5f5;color:#333;min-height:100vh;display:flex;justify-content:center;padding:20px}.c{background:#fff;border-radius:16px;box-shadow:0 2px 20px rgba(0,0,0,.08);max-width:480px;width:100%;padding:32px;margin-top:20px}h1{font-size:24px;font-weight:600;margin-bottom:4px;text-align:center}.sub{text-align:center;color:#666;font-size:14px;margin-bottom:24px}label{display:block;font-size:14px;font-weight:500;margin-bottom:6px;color:#444}input{width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:15px;margin-bottom:16px;outline:none}input:focus{border-color:#4A90D9}.slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.sl{padding:8px;text-align:center;border:1.5px solid #ddd;border-radius:10px;cursor:pointer;font-size:14px}.sl:hover{border-color:#4A90D9;background:#f0f7ff}.sl.sel{background:#4A90D9;color:#fff;border-color:#4A90D9}button[type=submit]{width:100%;padding:12px;background:#4A90D9;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:500;cursor:pointer}button[type=submit]:disabled{background:#ccc}.ok{text-align:center;padding:40px}.ok h2{color:#2d8a4e;margin:16px 0 8px}.err{color:#d32f2f;font-size:13px;margin-bottom:12px}.ld{text-align:center;padding:20px;color:#888}.ns{text-align:center;padding:16px;color:#888;background:#f9f9f9;border-radius:10px;margin-bottom:16px}</style></head><body><div class="c"><h1>\u{1f4c5} \u05e7\u05d1\u05d9\u05e2\u05ea \u05e4\u05d2\u05d9\u05e9\u05d4</h1><p class="sub">\u05d1\u05d7\u05e8 \u05ea\u05d0\u05e8\u05d9\u05da \u05d5\u05e9\u05e2\u05d4</p><div id="fv"><label>\u05ea\u05d0\u05e8\u05d9\u05da</label><input type="date" id="di"/><label>\u05e9\u05e2\u05d4 \u05e4\u05e0\u05d5\u05d9\u05d4</label><div id="sc"><div class="ld">\u05d1\u05d7\u05e8 \u05ea\u05d0\u05e8\u05d9\u05da...</div></div><label>\u05e9\u05dd \u05de\u05dc\u05d0</label><input type="text" id="ni" placeholder="\u05d4\u05e9\u05dd \u05e9\u05dc\u05da"/><label>\u05d0\u05d9\u05de\u05d9\u05d9\u05dc</label><input type="email" id="ei" placeholder="your@email.com"/><label>\u05e0\u05d5\u05e9\u05d0</label><input type="text" id="si" placeholder="\u05d1\u05de\u05d4 \u05ea\u05e8\u05e6\u05d4 \u05dc\u05d3\u05d5\u05df?"/><div id="er" class="err"></div><button type="submit" id="sb" disabled onclick="go()">\u05e7\u05d1\u05e2 \u05e4\u05d2\u05d9\u05e9\u05d4</button></div><div id="sv" class="ok" style="display:none"><div style="font-size:48px">\u2705</div><h2>\u05d4\u05e4\u05d2\u05d9\u05e9\u05d4 \u05e0\u05e7\u05d1\u05e2\u05d4!</h2><p>\u05d0\u05d9\u05e9\u05d5\u05e8 \u05e0\u05e9\u05dc\u05d7 \u05dc\u05de\u05d9\u05d9\u05dc</p></div></div><script>let ss="";const d=document.getElementById("di"),t=new Date();d.min=t.toISOString().split("T")[0];const mx=new Date(t);mx.setDate(mx.getDate()+14);d.max=mx.toISOString().split("T")[0];d.addEventListener("change",ls);async function ls(){const v=d.value;if(!v)return;const c=document.getElementById("sc");c.innerHTML="<div class=ld>Loading...</div>";ss="";document.getElementById("sb").disabled=true;try{const r=await fetch("/api/slots?date="+v);const j=await r.json();if(!j.slots||!j.slots.length){c.innerHTML="<div class=ns>\u05d0\u05d9\u05df \u05e9\u05e2\u05d5\u05ea \u05e4\u05e0\u05d5\u05d9\u05d5\u05ea</div>";return}c.innerHTML="<div class=slots>"+j.slots.map(s=>"<div class=sl onclick=\"pk(this,'"+s+"')\">"+s+"</div>").join("")+"</div>"}catch(e){c.innerHTML="<div class=err>Error</div>"}}function pk(el,t){document.querySelectorAll(".sl").forEach(s=>s.classList.remove("sel"));el.classList.add("sel");ss=t;document.getElementById("sb").disabled=false}async function go(){const n=document.getElementById("ni").value.trim(),e=document.getElementById("ei").value.trim(),s=document.getElementById("si").value.trim(),dt=d.value,er=document.getElementById("er");er.textContent="";if(!n||!e||!s||!dt||!ss){er.textContent="\u05e0\u05d0 \u05dc\u05de\u05dc\u05d0 \u05d0\u05ea \u05db\u05dc \u05d4\u05e9\u05d3\u05d5\u05ea";return}document.getElementById("sb").disabled=true;document.getElementById("sb").textContent="...";try{const r=await fetch("/api/book",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,email:e,subject:s,date:dt,time:ss})});const j=await r.json();if(j.success){document.getElementById("fv").style.display="none";document.getElementById("sv").style.display="block"}else{er.textContent=j.error;document.getElementById("sb").disabled=false;document.getElementById("sb").textContent="\u05e7\u05d1\u05e2 \u05e4\u05d2\u05d9\u05e9\u05d4"}}catch(x){er.textContent="Error";document.getElementById("sb").disabled=false;document.getElementById("sb").textContent="\u05e7\u05d1\u05e2 \u05e4\u05d2\u05d9\u05e9\u05d4"}}</script></body></html>`;
}
exports.default = router;

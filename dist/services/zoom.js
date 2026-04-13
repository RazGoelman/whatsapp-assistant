"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isZoomConfigured = isZoomConfigured;
exports.createZoomMeeting = createZoomMeeting;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
let zoomToken = "";
let tokenExpires = 0;
function isZoomConfigured() {
    return !!(config_1.config.zoom.accountId && config_1.config.zoom.clientId && config_1.config.zoom.clientSecret);
}
async function getZoomToken() {
    if (zoomToken && Date.now() < tokenExpires)
        return zoomToken;
    const auth = Buffer.from(config_1.config.zoom.clientId + ":" + config_1.config.zoom.clientSecret).toString("base64");
    const res = await axios_1.default.post("https://zoom.us/oauth/token", null, {
        params: { grant_type: "account_credentials", account_id: config_1.config.zoom.accountId },
        headers: { Authorization: "Basic " + auth },
    });
    zoomToken = res.data.access_token;
    tokenExpires = Date.now() + (res.data.expires_in - 60) * 1000;
    return zoomToken;
}
async function createZoomMeeting(topic, startTime, duration = 60) {
    if (!isZoomConfigured())
        throw new Error("Zoom not configured");
    const token = await getZoomToken();
    const res = await axios_1.default.post("https://api.zoom.us/v2/users/me/meetings", {
        topic,
        type: 2,
        start_time: startTime,
        duration,
        timezone: config_1.config.timezone,
        settings: { join_before_host: true, waiting_room: false },
    }, {
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    });
    return res.data.join_url;
}

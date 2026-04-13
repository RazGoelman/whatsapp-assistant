import axios from "axios";
import { config } from "../config";

let zoomToken: string = "";
let tokenExpires: number = 0;

export function isZoomConfigured(): boolean {
  return !!(config.zoom.accountId && config.zoom.clientId && config.zoom.clientSecret);
}

async function getZoomToken(): Promise<string> {
  if (zoomToken && Date.now() < tokenExpires) return zoomToken;
  const auth = Buffer.from(config.zoom.clientId + ":" + config.zoom.clientSecret).toString("base64");
  const res = await axios.post("https://zoom.us/oauth/token", null, {
    params: { grant_type: "account_credentials", account_id: config.zoom.accountId },
    headers: { Authorization: "Basic " + auth },
  });
  zoomToken = res.data.access_token;
  tokenExpires = Date.now() + (res.data.expires_in - 60) * 1000;
  return zoomToken;
}

export async function createZoomMeeting(topic: string, startTime: string, duration: number = 60): Promise<string> {
  if (!isZoomConfigured()) throw new Error("Zoom not configured");
  const token = await getZoomToken();
  const res = await axios.post("https://api.zoom.us/v2/users/me/meetings", {
    topic,
    type: 2,
    start_time: startTime,
    duration,
    timezone: config.timezone,
    settings: { join_before_host: true, waiting_room: false },
  }, {
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  return res.data.join_url;
}

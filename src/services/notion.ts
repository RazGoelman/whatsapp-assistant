import { config } from "../config";
let notionClient: any = null;
function getNotion() {
  if (!config.notion.apiKey) return null;
  if (!notionClient) { try { const { Client } = require("@notionhq/client"); notionClient = new Client({ auth: config.notion.apiKey }); } catch { return null; } }
  return notionClient;
}
export function isNotionConfigured(): boolean { return !!(config.notion.apiKey && config.notion.databaseId); }
export async function createNotionPage(title: string, content: string): Promise<string> {
  const notion = getNotion(); if (!notion) throw new Error("Notion not configured");
  const page = await notion.pages.create({ parent: { database_id: config.notion.databaseId }, properties: { title: { title: [{ text: { content: title } }] } }, children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content } }] } }] });
  return page.id;
}
export async function queryNotionPages(limit: number = 5): Promise<{ title: string; url: string }[]> {
  const notion = getNotion(); if (!notion) throw new Error("Notion not configured");
  const res = await notion.databases.query({ database_id: config.notion.databaseId, page_size: limit, sorts: [{ timestamp: "created_time", direction: "descending" }] });
  return res.results.map((p: any) => { const t = p.properties?.title || p.properties?.Name; return { title: t?.title?.[0]?.plain_text || "(no title)", url: p.url || "" }; });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNotionConfigured = isNotionConfigured;
exports.createNotionPage = createNotionPage;
exports.queryNotionPages = queryNotionPages;
const config_1 = require("../config");
let notionClient = null;
function getNotion() {
    if (!config_1.config.notion.apiKey)
        return null;
    if (!notionClient) {
        try {
            const { Client } = require("@notionhq/client");
            notionClient = new Client({ auth: config_1.config.notion.apiKey });
        }
        catch {
            return null;
        }
    }
    return notionClient;
}
function isNotionConfigured() { return !!(config_1.config.notion.apiKey && config_1.config.notion.databaseId); }
async function createNotionPage(title, content) {
    const notion = getNotion();
    if (!notion)
        throw new Error("Notion not configured");
    const page = await notion.pages.create({ parent: { database_id: config_1.config.notion.databaseId }, properties: { title: { title: [{ text: { content: title } }] } }, children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content } }] } }] });
    return page.id;
}
async function queryNotionPages(limit = 5) {
    const notion = getNotion();
    if (!notion)
        throw new Error("Notion not configured");
    const res = await notion.databases.query({ database_id: config_1.config.notion.databaseId, page_size: limit, sorts: [{ timestamp: "created_time", direction: "descending" }] });
    return res.results.map((p) => { const t = p.properties?.title || p.properties?.Name; return { title: t?.title?.[0]?.plain_text || "(no title)", url: p.url || "" }; });
}

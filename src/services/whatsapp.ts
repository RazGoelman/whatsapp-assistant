import axios from 'axios';
import { config } from '../config';

const API_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}/${config.meta.phoneNumberId}/messages`;

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  try {
    await axios.post(
      API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`📤 Message sent to ${to}`);
  } catch (error: any) {
    console.error('❌ Failed to send WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

export async function sendWhatsAppReaction(to: string, messageId: string, emoji: string): Promise<void> {
  try {
    await axios.post(
      API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'reaction',
        reaction: { message_id: messageId, emoji },
      },
      {
        headers: {
          Authorization: `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Failed to send reaction:', error.response?.data || error.message);
  }
}

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const mediaUrl = `https://graph.facebook.com/${config.meta.graphApiVersion}/${mediaId}`;
  const metaRes = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${config.meta.accessToken}` },
  });

  const downloadRes = await axios.get(metaRes.data.url, {
    headers: { Authorization: `Bearer ${config.meta.accessToken}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(downloadRes.data);
}

import OpenAI from 'openai';
import { config } from '../config';
import { downloadMedia } from './whatsapp';
import { Readable } from 'stream';
import { File } from 'buffer';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function transcribeAudio(mediaId: string): Promise<string> {
  try {
    const audioBuffer = await downloadMedia(mediaId);
    const uint8 = new Uint8Array(audioBuffer);
    const file = new File([uint8], 'audio.ogg', { type: 'audio/ogg' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'he',
    });

    console.log(`🎙️ Transcribed: ${transcription.text}`);
    return transcription.text;
  } catch (error: any) {
    console.error('❌ Transcription failed:', error.message);
    throw error;
  }
}

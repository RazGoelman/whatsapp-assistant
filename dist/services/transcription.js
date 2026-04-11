"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = transcribeAudio;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../config");
const whatsapp_1 = require("./whatsapp");
const buffer_1 = require("buffer");
const openai = new openai_1.default({ apiKey: config_1.config.openai.apiKey });
async function transcribeAudio(mediaId) {
    try {
        const audioBuffer = await (0, whatsapp_1.downloadMedia)(mediaId);
        const uint8 = new Uint8Array(audioBuffer);
        const file = new buffer_1.File([uint8], 'audio.ogg', { type: 'audio/ogg' });
        const transcription = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            language: 'he',
        });
        console.log(`🎙️ Transcribed: ${transcription.text}`);
        return transcription.text;
    }
    catch (error) {
        console.error('❌ Transcription failed:', error.message);
        throw error;
    }
}

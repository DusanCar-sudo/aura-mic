// ElevenLabs STT — transcribe audio files
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export interface STTResult {
  text: string;
  language_code?: string;
  language_probability?: number;
  duration?: number;
}

/**
 * Transcribe an audio file via ElevenLabs Scribe STT.
 * Normalizes to 16kHz mono WAV first for best results.
 */
export async function transcribeFile(audioPath: string, apiKey?: string): Promise<string> {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');

  const modelId = process.env.ELEVENLABS_STT_MODEL || 'scribe_v1';

  // Normalize to 16kHz mono WAV
  const tmpDir = fs.mkdtempSync(path.join('/tmp', 'aura-mic-stt-'));
  let wavPath = path.join(tmpDir, 'input.wav');

  try {
    try {
      execSync(`ffmpeg -y -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}" 2>/dev/null`, { stdio: 'pipe', timeout: 15000 });
    } catch {
      wavPath = audioPath; // fallback: use original
    }

    const fileBuffer = fs.readFileSync(wavPath);
    const blob = new Blob([fileBuffer], { type: 'audio/wav' });

    const formData = new FormData();
    formData.append('file', blob, path.basename(wavPath));
    formData.append('model_id', modelId);

    const response = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs STT HTTP ${response.status}: ${errText.slice(0, 500)}`);
    }

    const result = await response.json() as STTResult;
    return result.text.trim();
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

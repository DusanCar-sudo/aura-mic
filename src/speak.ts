// ElevenLabs TTS — text-to-speech and voice listing
import { execSync, spawn } from 'child_process';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Friendly name → voice ID mapping
const FRIENDLY_VOICES: Record<string, string> = {
  rachel:  '21m00Tcm4TlvDq8ikWAM',
  adam:    'pNInz6obpgDQGcFmaJgB',
  antoni:  'ErXwobaYiN019PkySvjV',
  arthur:  'YMecB64Jv2M4R0FCdhmH',
  brian:   'VR6AewLTigWG4xSOukaG',
  callum:  'GDjwgj0jV3oXV2VWz7Oh',
  charlot: 'XB0fDUnXU5powFXDhCwa',
  charlie: 'IKne3meq5aSn9XLyUdCD',
  daniel:   'onwK4e9ZLuTAKqWW03F9',
  ethan:   'bVs0Wd2M4u0QW8Q7lVdJ',
  freya:   'uf2jgS7Dzx1eFbHJQVqB',
  gisele:   'lS9ifSY39A8FbCyauRNa',
  glinda:   'z9fAnlkpzviPz146aGWa',
  jameson:   'EVTuFSYR4khtWepXRk8U',
  jessica:   'nCH5MUhoWXEXOGb3y6LS',
  joseph:   's0akg0sHE7koX5Qy9oyV',
  laura:    'BmUHYzj9PEOKVM8oyKWG',
  liam:     'TXLP0A0B4mptQWc17wSP',
  matilda:  'XrExE9yKIg1WjnnlVkGX',
  matthew:  'YkP0o48QdPMq9D9wI3Ik',
  michael:  'flq6f7yk4E4fJM5XTYuZ',
  mimi:     'zrHiDhphv9ZnVXBqCLjz',
  nicole:   'piTKgcLEGmPE4e6mEKli',
  river:    'pL2wGS6dYw0H7L1bW89N',
  sarah:    'EXAVITQu4vr4xnSDxMaL',
  serena:   'pcUG4OO4ySCMXpsRKTnV',
  thomas:   't0jbNlBVZ17f02VDIeMI',
};

export function resolveVoice(name: string): string {
  return FRIENDLY_VOICES[name.toLowerCase()] || name;
}

/**
 * Synthesize speech via ElevenLabs TTS and play it aloud.
 */
export async function speakText(text: string, voice?: string, apiKey?: string): Promise<void> {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');

  const voiceId = resolveVoice(voice || process.env.ELEVENLABS_VOICE || 'rachel');

  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
  };

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs TTS HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const audioBuf = Buffer.from(await response.arrayBuffer());
  await playAudio(audioBuf);
}

/**
 * List available ElevenLabs voices.
 */
export async function listVoices(apiKey?: string): Promise<void> {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');

  const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
    method: 'GET',
    headers: { 'xi-api-key': key },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs voices HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json() as { voices?: Array<{ voice_id: string; name: string; category?: string }> };
  const voices = data.voices ?? [];

  console.log('\n  Available ElevenLabs Voices\n');
  console.log('  ' + 'Name'.padEnd(20) + 'Voice ID'.padEnd(28) + 'Category');
  console.log('  ' + '─'.repeat(70));
  for (const v of voices) {
    console.log('  ' + v.name.padEnd(20) + v.voice_id.padEnd(28) + (v.category || ''));
  }
  console.log('\n  Use:  aura-mic speak "Hello" --voice ' + (voices[0]?.name || 'rachel') + '\n');
}

/**
 * Play an MP3/audio buffer through the sound server.
 * Uses ffplay (handles MP3) or converts to raw PCM for paplay/pw-play.
 */
function playAudio(buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    // Try ffplay first (handles MP3 natively)
    try {
      execSync('which ffplay', { stdio: 'pipe' });
      const proc = spawn('ffplay', ['-nodisp', '-autoexit', '-'], { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffplay exited with code ${code}${stderr.trim() ? ': ' + stderr.trim().split('\n').slice(-1)[0] : ''}`));
      });
      proc.stdin.write(buf);
      proc.stdin.end();
      return;
    } catch {}

    // Fallback: paplay/pw-play with raw PCM (assume 44.1kHz stereo)
    const players = ['paplay', 'pw-play', 'aplay'];
    let player: string | null = null;
    for (const p of players) {
      try { execSync('which ' + p, { stdio: 'pipe' }); player = p; break; } catch {}
    }
    if (!player) { reject(new Error('No audio player found')); return; }

    const proc = spawn(player, [], { stdio: ['pipe', 'ignore', 'pipe'] });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${player} exited with code ${code}`));
    });
    proc.stdin.write(buf);
    proc.stdin.end();
  });
}

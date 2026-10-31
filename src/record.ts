// Microphone recording via pw-record / parec / arecord
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SAMPLE_RATE = 16000;

export function listDevices(): void {
  console.log('\n  Available Audio Input Devices\n');
  try {
    const output = execSync('pactl list sources short', { stdio: 'pipe', encoding: 'utf8', timeout: 5000 });
    for (const line of output.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const id = parts[1];
      const state = parts[7] || '';
      const icon = state === 'RUNNING' ? '🎤 ' : '   ';
      console.log(`  ${icon}${id}`);
    }
    console.log('\n  Use:  aura-mic --device <name>\n');
  } catch {
    console.log('  Could not list devices (pactl not available).\n');
  }
}

export function getDefaultDevice(): string {
  try {
    return execSync('pactl get-default-source 2>/dev/null', { stdio: 'pipe', encoding: 'utf8', timeout: 5000 }).trim();
  } catch { return ''; }
}

interface RecorderInfo { cmd: string; args: string[] }

function pickRecorder(deviceId?: string): RecorderInfo | null {
  try {
    execSync('which pw-record', { stdio: 'pipe' });
    const args = ['--rate=' + String(SAMPLE_RATE), '--format=s16', '--channels=1'];
    if (deviceId) args.push('--target=' + deviceId);
    return { cmd: 'pw-record', args };
  } catch {}
  try {
    execSync('which parec', { stdio: 'pipe' });
    const args = ['--rate=' + String(SAMPLE_RATE), '--format=s16le', '--channels=1', '--raw'];
    if (deviceId) args.push('--device=' + deviceId);
    return { cmd: 'parec', args };
  } catch {}
  try {
    execSync('which arecord', { stdio: 'pipe' });
    const args = ['-r', String(SAMPLE_RATE), '-f', 'S16_LE', '-c', '1'];
    if (deviceId) args.push('-D', deviceId);
    return { cmd: 'arecord', args };
  } catch {}
  return null;
}

/**
 * Record microphone to a WAV file. Resolves with the file path.
 * Stops on Ctrl+C, or when silence is detected (if silenceMs > 0),
 * or when maxDurationMs is reached.
 */
export function recordToFile(
  deviceId?: string,
  silenceMs = 0,
  maxDurationMs = 180000,
  isRunning?: () => boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const recorder = pickRecorder(deviceId);
    if (!recorder) { reject(new Error('No audio recorder found (install pw-record, parec, or arecord)')); return; }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-mic-'));
    const wavPath = path.join(tmpDir, 'recording.wav');
    const rawPath = path.join(tmpDir, 'recording.raw');

    let proc: import('child_process').ChildProcess;
    let ffmpeg: import('child_process').ChildProcess | null = null;
    let stopped = false;

    if (recorder.cmd === 'parec') {
      ffmpeg = spawn('ffmpeg', ['-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0', '-y', wavPath], { stdio: ['pipe', 'inherit', 'inherit'] });
      proc = spawn(recorder.cmd, recorder.args, { stdio: ['ignore', 'pipe', 'inherit'] });
      proc.stdout!.pipe(ffmpeg.stdin!);
    } else if (recorder.cmd === 'arecord') {
      // arecord can write raw, then we convert
      proc = spawn(recorder.cmd, [...recorder.args, '-t', 'raw', rawPath], { stdio: ['ignore', 'inherit', 'inherit'] });
    } else {
      proc = spawn(recorder.cmd, [...recorder.args, wavPath], { stdio: ['ignore', 'inherit', 'inherit'] });
    }

    const onSigint = () => {
      stopped = true;
      proc.kill('SIGTERM');
      if (ffmpeg) ffmpeg.kill('SIGTERM');
    };
    process.on('SIGINT', onSigint);

    // Silence detection via file size monitoring
    let lastSize = 0;
    let lastSoundTime = Date.now();
    const startTime = Date.now();
    const monitor = setInterval(() => {
      if (stopped) return;
      try {
        const f = recorder.cmd === 'arecord' ? rawPath : wavPath;
        if (!fs.existsSync(f)) return;
        const size = fs.statSync(f).size;
        if (size > lastSize + SAMPLE_RATE * 2 * 0.1) { // grew by >100ms
          lastSoundTime = Date.now();
          lastSize = size;
        }
        const elapsed = Date.now() - startTime;
        const silenceElapsed = Date.now() - lastSoundTime;
        if ((silenceMs > 0 && silenceElapsed >= silenceMs && elapsed > 1500) || elapsed >= maxDurationMs) {
          stopped = true;
          proc.kill('SIGTERM');
          if (ffmpeg) ffmpeg.kill('SIGTERM');
        }
      } catch {}
    }, 200);

    proc.on('close', async () => {
      clearInterval(monitor);
      process.removeListener('SIGINT', onSigint);

      // Convert arecord raw to wav
      if (recorder.cmd === 'arecord' && fs.existsSync(rawPath)) {
        try {
          execSync(`ffmpeg -y -f s16le -ar ${SAMPLE_RATE} -ac 1 -i "${rawPath}" "${wavPath}" 2>/dev/null`, { stdio: 'pipe', timeout: 10000 });
        } catch {}
      }

      if (stopped && fs.existsSync(wavPath) && fs.statSync(wavPath).size > 512) {
        resolve(wavPath);
      } else {
        // Copy to a persistent path before tmpDir is gone
        const persistPath = path.join(os.tmpdir(), 'aura-mic-' + Date.now() + '.wav');
        try { if (fs.existsSync(wavPath)) fs.copyFileSync(wavPath, persistPath); } catch {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        if (fs.existsSync(persistPath)) {
          resolve(persistPath);
        } else {
          reject(new Error('No audio captured'));
        }
      }
    });

    proc.on('error', (err) => {
      clearInterval(monitor);
      process.removeListener('SIGINT', onSigint);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      reject(err);
    });
  });
}

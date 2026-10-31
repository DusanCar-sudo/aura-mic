#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// aura-mic — standalone microphone dictation with ElevenLabs STT/TTS
// ─────────────────────────────────────────────────────────────────────────────

import minimist from 'minimist';
import chalk from 'chalk';
import { loadEnv } from './env.js';
import { listDevices, getDefaultDevice, recordToFile } from './record.js';
import { transcribeFile } from './transcribe.js';
import { speakText, listVoices } from './speak.js';
import { injectText } from './inject.js';
import { chatWithDeepInfra, listDeepInfraModels } from './deepinfra.js';

// Load .env before anything else
loadEnv();

const argv = minimist(process.argv.slice(2));
const command = argv._[0] || 'record';

const CHROME = chalk.bold;
const DIM = chalk.dim;
const GREEN = chalk.green;
const RED = chalk.red;
const YELLOW = chalk.yellow;

function printHelp() {
  console.log(`
  ${CHROME('aura-mic')} — microphone dictation with ElevenLabs

  ${CHROME('COMMANDS')}
    ${GREEN('aura-mic')}                        Record → transcribe → type into focused window
    ${GREEN('aura-mic loop')}                     Continuous dictation (Ctrl+C to stop)
    ${GREEN('aura-mic speak <text>')}             Speak text aloud via ElevenLabs TTS
    ${GREEN('aura-mic transcribe <file>')}        Transcribe an audio file
    ${GREEN('aura-mic voices')}                   List available ElevenLabs voices
    ${GREEN('aura-mic devices')}                  List audio input devices
    ${GREEN('aura-mic chat')}                     Chat with a DeepInfra LLM
    ${GREEN('aura-mic models')}                   List available DeepInfra models

  ${CHROME('OPTIONS')}
    --no-inject       Copy to clipboard instead of typing
    --device <name>   Use specific audio device
    --voice <name>    TTS voice (friendly name or ID)
    --model <name>    DeepInfra model (default: from .env or deepinfra/Qwen/Qwen3-Max)
    --submit          Press Enter after typing
    --silence <ms>    Silence threshold (default: 2200)
    --max <ms>        Max recording duration (default: 180000)

  ${CHROME('EXAMPLES')}
    aura-mic
    aura-mic --no-inject
    aura-mic loop --silence 1500
    aura-mic speak "Hello, world!"
    aura-mic speak "Hello" --voice adam
    aura-mic transcribe recording.wav
    aura-mic chat
    aura-mic chat --model deepinfra/deepseek-ai/DeepSeek-R1
    aura-mic models
`);
}

async function main() {
  if (argv.help || argv.h) { printHelp(); return; }

  switch (command) {
    case 'voices':
      await listVoices();
      break;
    case 'devices':
      listDevices();
      break;
    case 'models':
      await listDeepInfraModels();
      break;
    case 'chat':
      await runChat();
      break;
    case 'speak': {
      const text = argv._.slice(1).join(' ');
      if (!text) { console.error(RED('Usage: aura-mic speak <text>')); process.exit(1); }
      const voice = argv.voice || process.env.ELEVENLABS_VOICE || 'rachel';
      await speakText(text, voice);
      break;
    }
    case 'transcribe': {
      const file = argv._[1];
      if (!file) { console.error(RED('Usage: aura-mic transcribe <file>')); process.exit(1); }
      const text = await transcribeFile(file);
      console.log('\n' + CHROME('── Transcription ──'));
      console.log(text);
      console.log(CHROME('──') + '\n');
      break;
    }
    case 'loop': {
      await runLoop();
      break;
    }
    case 'record':
    default: {
      await runOnce();
      break;
    }
  }
}

async function runOnce() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error(RED('\n  ELEVENLABS_API_KEY not set. Get one at https://elevenlabs.io/app/settings/api-keys\n'));
    process.exit(1);
  }

  const inject = !argv['no-inject'];
  const deviceId = argv.device;
  const devName = deviceId || getDefaultDevice();

  console.log(GREEN('\n  🎤  Recording — speak into your microphone.'));
  if (devName) console.log(DIM('     Device: ' + devName));
  console.log(DIM('     Press Ctrl+C to stop and transcribe.\n'));

  // Record until Ctrl+C
  const wavPath = await recordToFile(deviceId);

  // Transcribe
  const text = await transcribeFile(wavPath);
  const cleaned = text.trim();

  if (cleaned) {
    console.log(chalk.cyan('\n  ' + cleaned + '\n'));
    if (inject) {
      try {
        await injectText(cleaned, { submit: argv.submit });
        console.log(DIM('  ⌨️  Typed into focused window.\n'));
      } catch (err) {
        console.log(YELLOW('  ⌨️  Injection failed (' + String(err) + ') — text shown above.\n'));
      }
    } else {
      // Copy to clipboard
      try {
        const { copyToClipboard } = await import('./inject.js');
        await copyToClipboard(cleaned);
        console.log(DIM('  📋 Copied to clipboard.\n'));
      } catch {
        console.log(DIM('  Text shown above.\n'));
      }
    }
  } else {
    console.log(YELLOW('\n  No speech detected.\n'));
  }
}

async function runChat() {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    console.error(RED('\n  DEEPINFRA_API_KEY not set. Get one at https://deepinfra.com/dash\n'));
    process.exit(1);
  }
  const model = argv.model || process.env.DEEPINFRA_MODEL || 'deepinfra/Qwen/Qwen3-Max';
  const history: { role: string; content: string }[] = [];
  console.log(GREEN(`\n  💬 Chat with ${model}`));
  console.log(DIM('     Type your message, Enter to send, Ctrl+C to exit.\n'));

  let running = true;
  process.on('SIGINT', () => { running = false; console.log(YELLOW('\n  Bye!\n')); });

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (running) {
    const input = await new Promise<string>((resolve) => {
      rl.question('  You: ', (answer) => resolve(answer));
    });
    if (!input.trim()) continue;
    history.push({ role: 'user', content: input });
    process.stdout.write('  Aura: ');
    let fullText = '';
    try {
      for await (const chunk of chatWithDeepInfra(history, model, apiKey)) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      console.log('\n');
      if (fullText) history.push({ role: 'assistant', content: fullText });
    } catch (err) {
      console.error(RED('  Error: ' + String(err) + '\n'));
    }
  }
  rl.close();
}

async function runLoop() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error(RED('\n  ELEVENLABS_API_KEY not set.\n'));
    process.exit(1);
  }

  const silenceMs = Number(argv.silence) || Number(process.env.SILENCE_MS) || 2200;
  const maxMs = Number(argv.max) || Number(process.env.MAX_DURATION_MS) || 180000;
  const deviceId = argv.device;
  const devName = deviceId || getDefaultDevice();

  console.log(GREEN('\n  🎙️  Dictation Loop — continuous voice-to-text'));
  if (devName) console.log(DIM('     Device: ' + devName));
  console.log(DIM('     Silence threshold: ' + silenceMs + 'ms'));
  console.log(YELLOW('     Press Ctrl+C to stop.\n'));

  let running = true;
  let round = 0;
  process.on('SIGINT', () => { running = false; console.log(YELLOW('\n  Stopping...\n')); });

  while (running) {
    round++;
    console.log(GREEN('  ── Round ' + round + ' ── Listening...'));
    try {
      const wavPath = await recordToFile(deviceId, silenceMs, maxMs, () => running);
      if (!running) break;
      const text = await transcribeFile(wavPath);
      const cleaned = text.trim();
      if (cleaned) {
        console.log(chalk.cyan('  ' + cleaned));
        try {
          await injectText(cleaned, { submit: argv.submit });
          console.log(GREEN('  ✓ Injected\n'));
        } catch {
          try {
            const { copyToClipboard } = await import('./inject.js');
            await copyToClipboard(cleaned);
            console.log(DIM('  📋 Copied (inject failed)\n'));
          } catch { console.log('\n'); }
        }
      } else {
        console.log(DIM('  (no speech detected)\n'));
      }
    } catch (err) {
      if (!running) break;
      console.error(RED('  Error: ' + String(err)));
    }
  }

  console.log(GREEN('  Dictation loop ended.\n'));
}

main().catch(err => {
  console.error(RED('\n  Fatal: ' + String(err) + '\n'));
  process.exit(1);
});

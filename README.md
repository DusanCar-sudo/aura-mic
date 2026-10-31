# Aura Mic

Standalone microphone dictation program powered by ElevenLabs STT & TTS.

## Features

- **Record → Transcribe → Type**: Records your voice, transcribes via ElevenLabs Scribe, types the result into the focused window
- **Text-to-Speak**: Speak any text aloud via ElevenLabs TTS
- **Continuous Dictation Loop**: Record → transcribe → inject → repeat, with silence detection
- **Hotkey Toggle**: One press to start, one press to stop & send
- **Audio File Transcription**: Transcribe existing audio files
- **LLM Chat**: Chat with DeepInfra models (DeepSeek R1, Qwen3 Max, Claude, GLM, Kimi, MiniMax, etc.)

## Setup

```bash
cd aura-mic
npm install
cp .env.example .env
# Edit .env and add your ELEVENLABS_API_KEY and DEEPINFRA_API_KEY
npm run build
npm link  # optional: make `aura-mic` available globally
```

## Usage

```bash
# Record once, transcribe, and type into focused window
aura-mic

# Record once, transcribe, copy to clipboard (no typing)
aura-mic --no-inject

# Continuous dictation loop (Ctrl+C to stop)
aura-mic loop

# Transcribe an audio file
aura-mic transcribe <file.mp3|wav|ogg|...>

# Speak text aloud
aura-mic speak "Hello, world!"
aura-mic speak "Hello" --voice adam

# List available ElevenLabs voices
aura-mic voices

# List audio input devices
aura-mic devices

# Chat with a DeepInfra LLM
aura-mic chat
aura-mic chat --model deepinfra/deepseek-ai/DeepSeek-R1
aura-mic chat --model deepinfra/Qwen/Qwen3-Max

# List available DeepInfra models
aura-mic models
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | (required) |
| `ELEVENLABS_VOICE` | Default TTS voice (friendly name or voice ID) | `rachel` |
| `ELEVENLABS_STT_MODEL` | STT model | `scribe_v1` |
| `SAMPLE_RATE` | Recording sample rate | `16000` |
| `SILENCE_MS` | Silence threshold for auto-stop (ms) | `2200` |
| `MAX_DURATION_MS` | Max recording duration (ms) | `180000` |

## Requirements

- Node.js >= 18
- `pw-record`, `parec`, or `arecord` for microphone recording
- `ffmpeg` for audio normalization
- `paplay`, `pw-play`, `ffplay`, or `aplay` for audio playback
- `wtype` + `ydotool` (Wayland) or `xdotool` (X11) for text injection
- `wl-copy`/`xclip`/`xsel` for clipboard

## Project Structure

```
aura-mic/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── record.ts         # Microphone recording
│   ├── transcribe.ts     # ElevenLabs STT
│   ├── speak.ts          # ElevenLabs TTS + playback
│   ├── inject.ts         # Text injection into focused window
│   └── silence.ts        # Silence detection
├── dist/                 # Compiled output
├── .env                  # API keys (never commit)
└── package.json
```

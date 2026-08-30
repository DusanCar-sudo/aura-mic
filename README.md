# aura-mic

Speak, and the words land in whatever window you're looking at.

`aura-mic` records from your microphone, transcribes it, and types the result into the focused
window — a terminal, an editor, a browser text box. It is a single command with no daemon, no
tray icon, and no model to download: transcription runs against a hosted API, or against your own
Parakeet server if you'd rather nothing left the machine.

It was extracted from [Aura Code](https://github.com/DusanCar-sudo/aura-code), where it lived as
the `dic` command. The package is `aura-mic`; the command you type stays **`dic`**, so existing
shortcuts keep working. `aura-mic` is installed as a longer alias for the same thing.

## Install

```sh
npm install -g aura-mic
```

You also need a recorder and, for typing into other windows, an injector:

| | Linux | macOS |
|---|---|---|
| Recording | `arecord` (`alsa-utils`) | built in |
| Typing | `ydotool` + `ydotoold`, or `wtype` | built in |
| Clipboard | `wl-clipboard` (Wayland) or `xclip` (X11) | built in |

On KDE/KWin under Wayland, use `ydotool` — KWin refuses `wtype`.

## Use

```sh
dic                      # record, transcribe, type it where the cursor is
dic --no-inject          # transcribe to the clipboard only
dic loop                 # keep going: speak, it types, repeat
dic speak "hello there"  # the other direction — text to speech
dic devices              # list microphones
dic help
```

Press `Ctrl+C` to stop a recording.

### As a global hotkey

`toggle` is the mode worth binding to a key: press once to start recording, press again to
transcribe, type, and hit Enter.

```sh
dic toggle               # first press records, second sends
dic toggle --no-submit   # ... without pressing Enter for you
```

Bind it however your desktop does shortcuts — KDE: *System Settings → Shortcuts → Custom*, or with
`keyd`:

```
x = command(/usr/bin/env dic toggle)
```

A hotkey daemon usually runs as root with almost no environment, so make sure the command it runs
exports `WAYLAND_DISPLAY`, `DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR` and `YDOTOOL_SOCKET` for
your user, or the typing step will silently do nothing.

## Keys

Set whichever provider you want in the environment. Speech-to-text is tried in this order, and the
first one configured wins:

| Variable | Provider | Notes |
|---|---|---|
| `PARAKEET_BASE_URL` | Self-hosted NVIDIA Parakeet | No key. Nothing leaves your machine. |
| `XIAOMI_API_KEY` | MiMo ASR | Also the only provider for text-to-speech. |
| `OPENAI_API_KEY` | OpenAI Whisper | |
| `GROQ_API_KEY` | Groq Whisper | Fastest of the hosted options. |

Text-to-speech (`aura-mic speak`) needs `XIAOMI_API_KEY` specifically.

Put them in your shell profile, or somewhere a hotkey daemon can read — a file sourced by the
wrapper script works well. Don't commit them.

## Where it keeps things

Saved recordings go to `~/.aura/recordings`, shared with Aura Code if you have it. Set
`AURA_MIC_HOME` to keep them somewhere of their own.

## Library use

The transcription and speech functions are exported, so you can use them without the CLI:

```ts
import { transcribeFile, speakText, synthesizeSpeech } from 'aura-mic';

const text = await transcribeFile('/path/to/audio.wav');
await speakText('done');
```

## License

MIT

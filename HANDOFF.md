# aura-mic — handoff

Repo: https://github.com/DusanCar-sudo/aura-mic (public, MIT, branch `master`)
Source: `/mnt/bigdata/aura/projects/aura-mic/`
Version: `0.1.0`. One commit. **Not on npm.**

## What it is

Speech-to-text and text-to-speech for the terminal: record, transcribe, type the
result into the focused window. Extracted from Aura Code, where it was the `dic`
command.

Four source files, ~1,300 lines: `cli.ts` (arg parsing and help), `dictate.ts`
(recording, transcription, injection, TTS — the bulk), `clipboard.ts`,
`home.ts` (state path).

`npx tsc` is clean and `node dist/cli.js help` runs.

## Read this before changing anything

**The command is `dic`, not `aura-mic`.** The package is named `aura-mic` and
installs both bins, but `dic` is what the user types, what the help and README
lead with, and what is bound to a global hotkey. Do not "finish" the rename.

**The user's live dictation runs from the Aura Code working tree, not from
here.** `~/.local/bin/dic-toggle-run` execs
`/mnt/bigdata/aura/aura-code/dist/cli/dic.js`, invoked by `keyd` as root
(`/etc/keyd/default.conf`). So a broken build in *aura-code* takes their
dictation down system-wide, and changes made *here* do not affect their hotkey
at all until the two are reconciled. This is the single most surprising fact
about this project.

**Aura Code still has its own copy.** `src/tools/dictate.ts` there is the same
code, still used at `src/cli/index.ts:3617` for `speakText`. The two are
duplicated. Collapsing them means publishing this package and having aura-code
depend on it — which is why the npm publish below is the next real step, not a
nicety.

**Keys are environment-only.** Nothing is committed and nothing should be. The
user's live keys are in `~/.config/environment.d/dic-stt.conf`, which the hotkey
wrapper sources. The repo was scanned for `sk-`/`gsk_`/`nvapi-`/`ghp_`/AWS
patterns and personal paths before the first push; keep it that way.

## Next steps, in order

1. **Publish to npm.** The README says `npm install -g aura-mic`, which does not
   work yet — the one thing in this repo that is currently untrue. It is a
   public, irreversible action, so ask the user first.
2. **Point aura-code at the package** once it is published, and delete its copy
   of `dictate.ts`, keeping `speakText` working at `src/cli/index.ts:3617`.
3. **Consider repointing the hotkey.** `dic-toggle-run` running a dev tree is a
   footgun; the installed package at
   `~/.local/lib/node_modules/aura-code/dist/cli/dic.js` is the safer target.
   The user's call — it is their machine and their muscle memory.
4. **Tests.** There are none. `clipboard.ts`'s provider detection and
   `home.ts`'s override precedence are pure and worth covering first;
   `dictate.ts` needs the recorder stubbed.

## Known-good and known-broken on the user's machine

- `arecord`, `ydotoold` (running), `keyd` (active), clipboard tools: all present.
- `~/.local/bin/dictate-live` and `/usr/local/bin/dictate` are **dead symlinks**
  into `~/whisper.cpp/`, which no longer exists. Unrelated to this package;
  offer to remove them.

## One fix already made here

Clipboard detection probed `xclip` before `wl-copy`. On Wayland, XWayland
usually provides `xclip`, so it won, wrote to the X11 clipboard, reported
success — and native Wayland applications read a clipboard that never received
the text. Wayland is checked first when `WAYLAND_DISPLAY` is set. **Aura Code's
copy still has the original ordering**, so it still has this bug.

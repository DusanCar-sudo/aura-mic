// Text injection — type text into the focused window + clipboard
import { spawn, execSync } from 'child_process';

const TYPE_DELAY_MS = 12;

export interface InjectOptions {
  submit?: boolean;
}

/** Copy text to clipboard (wl-copy on Wayland, xclip/xsel on X11). */
export async function copyToClipboard(text: string): Promise<void> {
  const candidates: string[][] = process.env.WAYLAND_DISPLAY
    ? [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']]
    : [['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input'], ['wl-copy']];

  for (const [cmd, ...args] of candidates) {
    try {
      execSync('which ' + cmd, { stdio: 'pipe' });
      const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.stdin.write(text);
      proc.stdin.end();
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(cmd + ' timed out')), 5000);
        proc.on('exit', () => { clearTimeout(t); resolve(); });
        proc.on('error', (e) => { clearTimeout(t); reject(e); });
      });
      return;
    } catch { /* try next */ }
  }
  throw new Error('No clipboard tool found (install wl-clipboard, xclip, or xsel)');
}

function pressEnter(isWayland: boolean): void {
  if (isWayland) {
    try {
      execSync('ydotool key 28:1 28:0', { stdio: ['ignore', 'ignore', 'ignore'], timeout: 5000 });
      return;
    } catch {}
  }
  try {
    execSync('xdotool key --clearmodifiers Return', { stdio: ['ignore', 'ignore', 'ignore'], timeout: 5000 });
  } catch {}
}

/**
 * Copy text to clipboard AND type it into the focused window.
 */
export async function injectText(text: string, opts: InjectOptions = {}): Promise<void> {
  try { await copyToClipboard(text); } catch {}

  const typed = text.replace(/\s*\n\s*/g, ' ').trim();
  if (!typed) return;

  const isWayland = !!process.env.WAYLAND_DISPLAY;
  if (isWayland) {
    let injected = false;
    try {
      execSync('which wtype', { stdio: 'pipe' });
      await new Promise(r => setTimeout(r, 150));
      execSync(`wtype -d ${TYPE_DELAY_MS} -`, { input: typed, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
      injected = true;
    } catch {}
    if (!injected) {
      try {
        execSync('which ydotool', { stdio: 'pipe' });
        await new Promise(r => setTimeout(r, 150));
        execSync(`ydotool type -d ${TYPE_DELAY_MS} --file -`, { input: typed, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
        injected = true;
      } catch {}
    }
    if (!injected) throw new Error('no working Wayland injector');
    if (opts.submit) pressEnter(true);
    return;
  }

  try {
    execSync('which xdotool', { stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 150));
    execSync(`xdotool type --clearmodifiers --delay ${TYPE_DELAY_MS} --file -`, { input: typed, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
    if (opts.submit) pressEnter(false);
  } catch {
    throw new Error('Cannot inject text: install xdotool (X11)');
  }
}

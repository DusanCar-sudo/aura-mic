import { execSync } from 'child_process';

export interface ClipboardInput {
  action: 'copy' | 'paste';
  text?: string;
}

interface ClipboardCommand {
  copy: string[];
  paste: string[];
}

function has(bin: string): boolean {
  try {
    execSync(`command -v ${bin}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick a clipboard utility for this session.
 *
 * Wayland is checked first when `WAYLAND_DISPLAY` is set, which is a
 * deliberate change from the order this was extracted from. XWayland usually
 * provides `xclip` on a Wayland desktop, so probing xclip first finds it and
 * writes to the X11 clipboard — which native Wayland applications never read.
 * The copy reports success and the text is nowhere to be pasted.
 */
function detectClipboardCommand(): ClipboardCommand | null {
  const wayland: ClipboardCommand = { copy: ['wl-copy'], paste: ['wl-paste'] };
  const candidates: Array<[string, ClipboardCommand]> = [
    ['xclip', { copy: ['xclip', '-selection', 'clipboard'], paste: ['xclip', '-selection', 'clipboard', '-o'] }],
    ['xsel', { copy: ['xsel', '--clipboard', '--input'], paste: ['xsel', '--clipboard', '--output'] }],
    ['wl-copy', wayland],
    ['pbcopy', { copy: ['pbcopy'], paste: ['pbpaste'] }],
  ];

  if (process.env.WAYLAND_DISPLAY && has('wl-copy')) return wayland;

  for (const [bin, cmd] of candidates) {
    if (has(bin)) return cmd;
  }
  return null;
}

export async function clipboardTool(input: ClipboardInput): Promise<string> {
  const cmds = detectClipboardCommand();
  if (!cmds) {
    return 'Error: No clipboard utility found. Install xclip, xsel, or wl-clipboard.';
  }

  switch (input.action) {
    case 'copy': {
      if (input.text === undefined) return 'Error: text is required for copy';
      try {
        const [bin, ...args] = cmds.copy;
        // stdout/stderr must be ignored: wl-copy (and xclip) fork a daemon that
        // inherits them, so with pipes execSync never returns.
        execSync(`${bin} ${args.join(' ')}`, {
          input: input.text,
          stdio: ['pipe', 'ignore', 'ignore'],
          timeout: 5000,
        });
        return `Copied ${input.text.length} characters to clipboard.`;
      } catch (e: any) {
        return `Error copying to clipboard: ${e?.message}`;
      }
    }

    case 'paste': {
      try {
        const [bin, ...args] = cmds.paste;
        const result = execSync(`${bin} ${args.join(' ')}`, { encoding: 'utf8' });
        return `Clipboard contents:\n${result}`;
      } catch (e: any) {
        return `Error reading clipboard: ${e?.message}`;
      }
    }

    default:
      return `Error: Unknown clipboard action: ${(input as ClipboardInput).action}`;
  }
}

import * as os from 'os';
import * as path from 'path';

/**
 * Where aura-mic keeps its state — saved recordings, mostly.
 *
 * Deliberately still `~/.aura`, and still honouring `AURA_HOME`: this tool was
 * extracted from Aura Code and shares a machine with it, so pointing somewhere
 * new would strand recordings people already have and split one state
 * directory into two for no benefit. `AURA_MIC_HOME` overrides it for anyone
 * who wants them kept apart.
 */
export function auraHome(): string {
  const own = process.env.AURA_MIC_HOME?.trim();
  if (own) return own;
  const shared = process.env.AURA_HOME?.trim();
  return shared ? shared : path.join(os.homedir(), '.aura');
}

/** A path inside {@link auraHome}, e.g. auraPath('recordings'). */
export function auraPath(...segments: string[]): string {
  return path.join(auraHome(), ...segments);
}

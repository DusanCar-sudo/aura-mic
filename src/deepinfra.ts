// DeepInfra — chat completions and model listing
// OpenAI-compatible API at https://api.deepinfra.com/v1/openai
import chalk from 'chalk';

const DEEPINFRA_BASE = 'https://api.deepinfra.com/v1/openai';
const RED = chalk.red;

export interface DeepInfraModel {
  id: string;
  owned_by: string;
  context_length?: number;
}

/**
 * Stream a chat completion from DeepInfra.
 * Yields text chunks as they arrive.
 */
export async function* chatWithDeepInfra(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
): AsyncGenerator<string> {
  const response = await fetch(`${DEEPINFRA_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepInfra HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch { /* skip malformed lines */ }
    }
  }
}

/**
 * List available DeepInfra models (OpenAI-compatible /models endpoint).
 */
export async function listDeepInfraModels(apiKey?: string): Promise<void> {
  const key = apiKey || process.env.DEEPINFRA_API_KEY;
  if (!key) {
    console.error(RED('\n  DEEPINFRA_API_KEY not set. Get one at https://deepinfra.com/dash\n'));
    process.exit(1);
  }

  const response = await fetch(`${DEEPINFRA_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepInfra models HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json() as { data?: DeepInfraModel[] };
  const models = data.data ?? [];

  console.log('\n  Available DeepInfra Models\n');
  console.log('  ' + 'Model ID'.padEnd(55) + 'Owner');
  console.log('  ' + '─'.repeat(75));
  for (const m of models) {
    console.log('  ' + m.id.padEnd(55) + (m.owned_by || ''));
  }
  console.log('\n  Use:  aura-mic chat --model deepinfra/<id>\n');
}

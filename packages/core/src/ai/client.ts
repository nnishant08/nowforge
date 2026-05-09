/**
 * Bring-your-own-key AI client. Talks to either Anthropic (Claude) or
 * OpenAI (GPT). Both surfaces (browser extension + VS Code extension)
 * import this directly so they share the wire format and token handling.
 *
 * Uses native fetch (Chrome MV3 has it; Node 18+ has it).
 */

import { SYSTEM_PROMPT } from './systemPrompt.js';

export type AIProvider = 'anthropic' | 'openai';

export interface AICallOptions {
  provider: AIProvider;
  apiKey: string;
  model: string;
  /** User-side prompt (built from prompts.ts). */
  userPrompt: string;
  /** Override the system prompt (rare). */
  systemPrompt?: string;
  /** Hard cap on output tokens. Default 2048. */
  maxTokens?: number;
  /** Optional AbortSignal. */
  signal?: AbortSignal;
}

export interface AIResponse {
  ok: boolean;
  text: string;
  /** When ok=false. */
  error?: string;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const system = options.systemPrompt ?? SYSTEM_PROMPT;
  const maxTokens = options.maxTokens ?? 2048;

  if (options.provider === 'anthropic') {
    return callAnthropic(options, system, maxTokens);
  }
  return callOpenAI(options, system, maxTokens);
}

async function callAnthropic(
  o: AICallOptions,
  system: string,
  maxTokens: number
): Promise<AIResponse> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: o.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': o.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for browser-side calls (CORS preflight bypass on the
        // Anthropic API for known consumer extensions).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: o.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: o.userPrompt }],
      }),
    });
  } catch (e) {
    return { ok: false, text: '', error: `Network error: ${(e as Error).message}` };
  }

  let json: AnthropicResponse;
  try { json = (await res.json()) as AnthropicResponse; }
  catch { return { ok: false, text: '', error: `HTTP ${res.status} (no JSON body)` }; }

  if (!res.ok) {
    return { ok: false, text: '', error: json.error?.message ?? `HTTP ${res.status}` };
  }
  const text = (json.content ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
  return { ok: true, text };
}

async function callOpenAI(
  o: AICallOptions,
  system: string,
  maxTokens: number
): Promise<AIResponse> {
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: o.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${o.apiKey}`,
      },
      body: JSON.stringify({
        model: o.model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: o.userPrompt },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, text: '', error: `Network error: ${(e as Error).message}` };
  }

  let json: OpenAIResponse;
  try { json = (await res.json()) as OpenAIResponse; }
  catch { return { ok: false, text: '', error: `HTTP ${res.status} (no JSON body)` }; }

  if (!res.ok) {
    return { ok: false, text: '', error: json.error?.message ?? `HTTP ${res.status}` };
  }
  const text = json.choices?.[0]?.message?.content ?? '';
  return { ok: true, text };
}

/** Default model per provider. Edit centrally. */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
};

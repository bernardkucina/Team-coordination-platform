/** A minimal Slack Web API client (form-encoded POST, which every method accepts). */
import { config } from '../../core/config';

export class SlackError extends Error {
  constructor(public method: string, public code: string) {
    super(`Slack ${method} failed: ${code}`);
  }
}

export const slackEnabled = (): boolean => !!config.slack.botToken;

export const slack = async <T extends object = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
  if (!config.slack.botToken) throw new SlackError(method, 'not_configured');
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const res = await fetch(`${config.slack.apiUrl}/${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.slack.botToken}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({ ok: false, error: `http_${res.status}` }))) as { ok: boolean; error?: string };
  if (!data.ok) throw new SlackError(method, data.error ?? `http_${res.status}`);
  return data as T;
};

/** Replaces the message a button was clicked in (response_url from an interaction). */
export const respond = async (responseUrl: string, message: { text: string; blocks?: unknown[] }): Promise<void> => {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ replace_original: true, ...message }),
    signal: AbortSignal.timeout(8000),
  });
};

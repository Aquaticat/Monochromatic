/**
 * HTTP client for an OpenAI-compatible chat completions endpoint (llama.cpp, Ollama, etc.).
 *
 * Reads `CHAT_COMPLETIONS_URL` from the environment.
 * Enforces an in-memory sliding-window rate limit so a single Done instance
 * cannot overwhelm the shared inference server.
 */

//region Configuration

const DEFAULT_COMPLETIONS_URL = "http://localhost:8080/v1/chat/completions";

/** Resolved endpoint URL, evaluated once at import time. */
const completionsUrl = process.env.CHAT_COMPLETIONS_URL ?? DEFAULT_COMPLETIONS_URL;

//endregion Configuration

//region Rate limiter -- sliding-window counter

const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_DURATION_MS = 60_000;

/** Timestamps of requests within the current window. */
const requestTimestamps: number[] = [];

/**
 * Removes expired entries and checks whether the limit has been reached.
 * @returns `true` when the request should be rejected
 */
function isRateLimited(): boolean {
  const cutoff = Date.now() - WINDOW_DURATION_MS;

  // Discard entries older than the window
  while (requestTimestamps.length > 0 && (requestTimestamps[0] as number) < cutoff) {
    requestTimestamps.shift();
  }

  return requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW;
}

/** Records the current timestamp in the sliding window. */
function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

//endregion Rate limiter

//region Types

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionOptions = {
  /** Messages in the conversation. */
  messages: ChatMessage[];
  /** Sampling temperature (0 = deterministic). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** When `true`, request `response_format: { type: "json_object" }`. */
  jsonMode?: boolean;
};

type ChatCompletionResponseChoice = {
  message: { role: string; content: string };
};

type ChatCompletionResponse = {
  choices: ChatCompletionResponseChoice[];
};

export type ChatCompletionResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

//endregion Types

//region Public API

/**
 * Sends a chat completion request to the configured endpoint.
 *
 * Returns an error result rather than throwing so callers can degrade
 * gracefully (e.g. skip autofill when the AI is unavailable).
 *
 * @param options - Messages, temperature, and format controls
 * @returns Completion text on success, or a descriptive error string
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  if (isRateLimited()) {
    return { ok: false, error: "Rate limit exceeded — try again in a moment" };
  }

  recordRequest();

  const body: Record<string, unknown> = {
    messages: options.messages,
    temperature: options.temperature ?? 0,
  };

  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens;
  }

  if (options.jsonMode === true) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(completionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      return { ok: false, error: `AI endpoint returned ${String(response.status)}: ${errorText}` };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const firstChoice = data.choices[0];
    if (firstChoice === undefined) {
      return { ok: false, error: "AI returned no choices" };
    }

    return { ok: true, content: firstChoice.message.content };
  } catch (caughtError: unknown) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    console.error("AI chat completion failed:", caughtError);
    return { ok: false, error: `AI request failed: ${message}` };
  }
}

//endregion Public API

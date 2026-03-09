import type { CaptureSet } from "./analyze/memory.ts";

import { API_URL } from "./analyze/llama.ts";
import { log } from "./log.ts";

/** Maximum number of capture sets sent to the LLM in a single request. */
const MAX_CAPTURE_SETS = 3;

/** System prompt instructing the vision LLM how to evaluate productivity. */
const SYSTEM_PROMPT = `You are a strict productivity monitor for a user with ADHD. You analyze desktop screenshots and webcam captures taken at 5-minute intervals.

RULES FOR DECLARING UNPRODUCTIVE:
1. ENTERTAINMENT: Any non-music entertainment visible = UNPRODUCTIVE. This includes: YouTube videos, Twitch, gaming, social media (Twitter/X, Reddit, Instagram, TikTok, Facebook), news browsing, streaming sites, memes, comics. Music players (Spotify, YouTube Music, etc.) are ALLOWED and do NOT count as entertainment.
2. DISTRACTION (webcam): Assume user is looking at the screen unless — user is holding/using a phone, head down sleeping, or chair is empty. Looking at the ceiling or the wall doesn't count as distraction.
3. STAGNATION: If multiple captures are provided and the screen content has NOT meaningfully changed between them (same windows, same scroll position, same text), the user is pretending to work = UNPRODUCTIVE.

PRODUCTIVE means: actively coding, writing, reading documentation, using work tools, communicating in work chats, designing, or similar focused work activity.

OUTPUT FORMAT:
- First, briefly describe what you see in each capture (apps, windows, webcam).
- Then state your reasoning for the verdict.
- FINAL LINE must be exactly: VERDICT: PRODUCTIVE or VERDICT: UNPRODUCTIVE`;

/**
 * Shape of the OpenAI-compatible chat message content array.
 */
type ChatMessage = {
  /** Role of the message sender. */
  role: string;
  /** Array of text and image content parts. */
  content: (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  )[];
};

/**
 * Shape of the OpenAI-compatible chat completion response.
 */
type CompletionResponse = {
  /** Array of completion choices. */
  choices: { message: { content: string } }[];
  /** Token usage statistics. */
  usage: { prompt_tokens: number; completion_tokens: number };
};

/**
 * Wraps a raw image buffer as a base64 data-URL content entry
 * for the OpenAI-compatible vision API.
 * @param buf - JPEG image bytes
 * @returns image_url content entry
 */
function buildImageEntry(buf: Buffer) {
  return {
    type: "image_url" as const,
    image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}` },
  };
}

/**
 * Extracts a PRODUCTIVE or UNPRODUCTIVE verdict from the LLM response text.
 * Looks for the canonical `VERDICT: ...` line first, falls back to keyword matching.
 * @param result - raw LLM response text
 * @returns parsed verdict
 * @example
 * ```ts
 * parseVerdict("... VERDICT: UNPRODUCTIVE"); // "UNPRODUCTIVE"
 * parseVerdict("The user appears productive."); // "PRODUCTIVE"
 * ```
 */
export function parseVerdict(result: string): "PRODUCTIVE" | "UNPRODUCTIVE" {
  const upper = result.toUpperCase();
  const match = upper.match(/VERDICT:\s*(PRODUCTIVE|UNPRODUCTIVE)/);
  if (match) return match[1] as "PRODUCTIVE" | "UNPRODUCTIVE";
  if (upper.includes("UNPRODUCTIVE")) return "UNPRODUCTIVE";
  return "PRODUCTIVE";
}

/**
 * Sends buffered capture sets to the local vision LLM for productivity analysis.
 * Constructs a multimodal prompt with timestamped screenshot/webcam pairs and
 * returns the raw LLM response text containing the verdict.
 * @param sets - recent capture sets to analyze (mutated: cleared after building the prompt to free memory)
 * @returns raw LLM response text including the verdict line
 * @throws when the LLM API returns a non-OK status
 * @example
 * ```ts
 * const result = await analyze(getRecent());
 * const verdict = parseVerdict(result);
 * ```
 */
export async function analyze(sets: CaptureSet[]): Promise<string> {
  const content: ChatMessage["content"] = [];
  const capped = sets.slice(0, MAX_CAPTURE_SETS);
  const numSets = capped.length;

  for (let i = 0; i < numSets; i++) {
    const ts = new Date(capped[i].timestamp).toLocaleTimeString();
    content.push({ type: "text", text: `--- Capture at ${ts} ---` });
    content.push({ type: "text", text: "Desktop screenshot:" });
    content.push(buildImageEntry(capped[i].screenshot));
    content.push({ type: "text", text: "Webcam:" });
    content.push(buildImageEntry(capped[i].webcam));
  }
  // Release references to raw Buffers so they can be GC'd during inference
  sets.length = 0;

  content.push({
    type: "text",
    text:
      numSets > 1
        ? "Analyze all captures. Has meaningful progress been made between them? Is the user focused or distracted? Provide your verdict."
        : "Analyze this capture. Is the user focused on productive work or distracted? Provide your verdict.",
  });

  const payload = {
    model: "lfm2.5-vl-1.6b",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    max_tokens: 512,
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
  };

  const start = performance.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as CompletionResponse;
  const elapsed = ((performance.now() - start) / 1_000).toFixed(1);
  const { prompt_tokens, completion_tokens } = data.usage;

  log.debug(
    `[analyze] ${prompt_tokens} prompt + ${completion_tokens} completion tokens, ${elapsed}s`,
  );
  return data.choices[0].message.content;
}

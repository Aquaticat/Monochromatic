import { MS_PER_SECOND, } from '@monochromatic-dev/module-numeric-const';

import type { CaptureSet, } from './analyze/memory.ts';

import { API_URL, } from './analyze/llama.ts';
import { log, } from './log.ts';

/** Maximum number of capture sets sent to the LLM in a single request. */
const MAX_CAPTURE_SETS = 3;

/** System prompt instructing the vision LLM how to evaluate productivity. */
const SYSTEM_PROMPT =
  `You are a strict productivity monitor for a user with ADHD. You analyze desktop screenshots and webcam captures taken at 5-minute intervals.

RULES FOR DECLARING UNPRODUCTIVE:
1. ENTERTAINMENT: Any non-music entertainment visible = UNPRODUCTIVE. This includes: YouTube videos, Twitch, gaming, social media (Twitter/X, Reddit, Instagram, TikTok, Facebook), news browsing, streaming sites, memes, comics. Music players (Spotify, YouTube Music, etc.) are ALLOWED and do NOT count as entertainment.
2. DISTRACTION (webcam): Assume user is looking at the screen unless user is holding/using a phone, head down sleeping, or chair is empty. Looking at the ceiling or the wall doesn't count as distraction.
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
    | {
      type: 'text';
      text: string;
    }
    | {
      type: 'image_url';
      image_url: { url: string; };
    }
  )[];
};

/**
 * Shape of the OpenAI-compatible chat completion response.
 */
type CompletionResponse = {
  /** Array of completion choices. */
  choices: { message: { content: string; }; }[];
  /** Token usage statistics. */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
};

/**
 * Wraps a raw image buffer as a base64 data-URL content entry
 * for the OpenAI-compatible vision API.
 *
 * @param buf - JPEG image bytes
 *
 * @returns image_url content entry
 */
function buildImageEntry(
  buf: Buffer,
): {
  type: 'image_url';
  image_url: { url: string; };
} {
  return {
    type: 'image_url' as const,
    image_url: { url: `data:image/jpeg;base64,${buf.toString('base64',)}`, },
  };
}

/** Literal keyword that prefixes the canonical verdict line in LLM output. */
const VERDICT_PREFIX = 'VERDICT:';

/**
 * Returns the position just after any horizontal whitespace starting at `from`.
 *
 * @param s - haystack
 *
 * @param from - starting index
 *
 * @returns first non-space/tab position at or after `from`
 */
function skipSpacesAndTabs({
  s,
  from,
}: {
  s: string;
  from: number;
},): number {
  if (from >= s.length)
    return from;
  /** Char at the current cursor; advanced when it is horizontal whitespace. */
  const c = s.charAt(from,);
  if ((c === ' ') || (c === '\t')) {
    return skipSpacesAndTabs({
      s,
      from: from + 1,
    },);
  }
  return from;
}

/**
 * Locates the literal verdict token after `VERDICT:` in an upper-cased line.
 *
 * @param upper - upper-cased LLM response
 *
 * @returns `'PRODUCTIVE'` / `'UNPRODUCTIVE'` when present; `undefined` otherwise
 */
function findVerdictToken(upper: string,): 'PRODUCTIVE' | 'UNPRODUCTIVE' | undefined {
  /** Index of the canonical `VERDICT:` literal; -1 means the line is missing. */
  const idx = upper.indexOf(VERDICT_PREFIX,);
  if (idx === (-1))
    return undefined;
  /** Cursor after `VERDICT:` and any inline whitespace; verdict word starts here. */
  const start = skipSpacesAndTabs({
    s: upper,
    from: idx + VERDICT_PREFIX.length,
  },);
  /** Substring beginning at `start`; checked against the longer alternative first. */
  const tail = upper.slice(start,);
  if (tail.startsWith('UNPRODUCTIVE',))
    return 'UNPRODUCTIVE';
  if (tail.startsWith('PRODUCTIVE',))
    return 'PRODUCTIVE';
  return undefined;
}

/**
 * Extracts a PRODUCTIVE or UNPRODUCTIVE verdict from the LLM response text.
 * Looks for the canonical `VERDICT: ...` line first, falls back to keyword matching.
 *
 * @param result - raw LLM response text
 *
 * @returns parsed verdict
 *
 * @example
 * ```ts
 * parseVerdict("... VERDICT: UNPRODUCTIVE"); // "UNPRODUCTIVE"
 * parseVerdict("The user appears productive."); // "PRODUCTIVE"
 * ```
 */
export function parseVerdict(result: string,): 'PRODUCTIVE' | 'UNPRODUCTIVE' {
  /** Upper-cased copy of the response so verdict matching is case-insensitive. */
  const upper = result.toUpperCase();
  /** Parsed verdict from the canonical line; undefined when only fallback keyword matching can apply. */
  const verdict = findVerdictToken(upper,);
  if (verdict !== undefined)
    return verdict;
  if (upper.includes('UNPRODUCTIVE',))
    return 'UNPRODUCTIVE';
  return 'PRODUCTIVE';
}

/**
 * Sends buffered capture sets to the local vision LLM for productivity analysis.
 * Constructs a multimodal prompt with timestamped screenshot/webcam pairs and
 * returns the raw LLM response text containing the verdict.
 *
 * @param sets - recent capture sets to analyze (mutated: cleared after building the prompt to free memory)
 *
 * @returns raw LLM response text including the verdict line
 *
 * @throws when the LLM API returns a non-OK status
 *
 * @example
 * ```ts
 * const result = await analyze(getRecent());
 * const verdict = parseVerdict(result);
 * ```
 */
export async function analyze(sets: CaptureSet[],): Promise<string> {
  /**
   * Capture sets trimmed to {@link MAX_CAPTURE_SETS} so prompt size stays bounded.
   */
  const capped = sets.slice(
    0,
    MAX_CAPTURE_SETS,
  );
  /** Cached length so the prompt-tail branch does not re-walk `capped`. */
  const numSets = capped.length;

  /** Build content array by flat-mapping each capture into its message entries. */
  const content: ChatMessage['content'] = capped.flatMap(
    function captureEntries(capture,) {
      /** Human-readable local time used to label each capture in the prompt. */
      const ts = new Date(capture.timestamp,).toLocaleTimeString();
      return [
        {
          type: 'text' as const,
          text: `--- Capture at ${ts} ---`,
        },
        {
          type: 'text' as const,
          text: 'Desktop screenshot:',
        },
        buildImageEntry(capture.screenshot,),
        {
          type: 'text' as const,
          text: 'Webcam:',
        },
        buildImageEntry(capture.webcam,),
      ];
    },
  );
  // Release references to raw Buffers so they can be GC'd during inference
  sets.length = 0;

  content.push({
    type: 'text',
    text: numSets > 1
      ? 'Analyze all captures. Has meaningful progress been made between them? Is the user focused or distracted? Provide your verdict.'
      : 'Analyze this capture. Is the user focused on productive work or distracted? Provide your verdict.',
  },);

  /** OpenAI-compatible chat completion request body sent to the local llama-server. */
  const payload = {
    model: 'lfm2.5-vl-1.6b',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content,
      },
    ],
    max_tokens: 512,
    temperature: 0.7,
    top_p: 0.8,
    top_k: 20,
  };

  /** Monotonic timestamp captured before the request so elapsed time can be logged. */
  const start = performance.now();
  /** Response handle from llama-server; checked for non-OK status before reading the body. */
  const res = await fetch(
    API_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify(payload,),
    },
  );

  if (!res.ok) {
    /** Raw error body included in the thrown error so callers can diagnose API failures. */
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`,);
  }

  /** Parsed completion response carrying both the verdict text and token-usage stats. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response shape is defined by the OpenAI-compatible API
  const data = (await res.json()) as CompletionResponse;
  /** Wall-clock seconds spent on the request, rounded to one decimal for log output. */
  const elapsed = ((performance.now() - start) / MS_PER_SECOND).toFixed(1,);
  /** Token-usage fields pulled out for the debug log line. */
  const {
    prompt_tokens,
    completion_tokens,
  } = data.usage;

  log.debug(
    `[analyze] ${prompt_tokens} prompt + ${completion_tokens} completion tokens, ${elapsed}s`,
  );
  /** First completion choice; treated as the canonical response since `n=1`. */
  const [firstChoice,] = data.choices;
  if (firstChoice === undefined)
    throw new Error('OpenAI API returned empty choices array',);
  return firstChoice.message.content;
}

/**
 * Chapter-and-dialogue generator.
 *
 * Builds the system + user prompt pair, sends through the LLM
 * provider with `expectJson`, then validates the parsed shape into
 * the {@link Chapter} record used by the lecture screen.
 */
import {
  LL,
  rawString,
} from '../i18n/runtime.ts';
import { chat, } from '../llm/index.ts';
import type {
  Chapter,
  DialogueBeat,
  Pose,
} from '../types.ts';

/** LLM JSON response shape we validate against. */
type RawResponse = {
  title?: unknown;
  chapters?: unknown;
};

/** Recognized poses; anything else falls back to `neutral`. */
const VALID_POSES: readonly Pose[] = [
  'neutral',
  'thinking',
  'happy',
];

/**
 * Maximum paper text length sent to the LLM. Larger papers are
 * truncated with a notice; longer-context follow-up is a TODO.
 */
const PAPER_TEXT_BUDGET = 60_000;

/** Coerces an unknown to `Pose` with a safe fallback. */
function asPose(value: unknown,): Pose {
  if (typeof value !== 'string')
    return 'neutral';
  for (const pose of VALID_POSES) {
    if (pose === value)
      return pose;
  }
  return 'neutral';
}

/** Returns `true` when value is a non-null object. */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Coerces a beat object into the typed shape. */
function asBeat(value: unknown,): DialogueBeat | undefined {
  if (!isRecord(value,))
    return undefined;
  if (typeof value['text'] !== 'string')
    return undefined;
  return {
    text: value['text'],
    pose: asPose(value['pose'],),
  };
}

/** Coerces a chapter object into the typed shape. */
function asChapter(value: unknown,): Chapter | undefined {
  if (!isRecord(value,))
    return undefined;
  if (typeof value['title'] !== 'string'
    || typeof value['summary'] !== 'string')
  {
    return undefined;
  }
  if (!Array.isArray(value['dialogue'],))
    return undefined;
  /** Validated beat list dropped to {@link DialogueBeat} entries only. */
  const dialogue = value['dialogue']
    .map(asBeat,)
    .filter(function isBeat(b,): b is DialogueBeat {
      return b !== undefined;
    },);
  if (dialogue.length === 0)
    return undefined;
  return {
    title: value['title'],
    summary: value['summary'],
    dialogue,
  };
}

/** Generated payload, returned to the caller. */
export type Generation = {
  /** Inferred or LLM-supplied paper title. */
  title: string;

  /** Validated chapters. */
  chapters: readonly Chapter[];
};

/**
 * Sends the paper text to the LLM and returns parsed chapters.
 *
 * @param paperText - full extracted paper text
 *
 * @param signal - optional abort signal
 *
 * @returns generation result with title and chapters
 *
 * @throws when the LLM response cannot be parsed into chapters
 */
export async function generateChapters(
  {
    paperText,
    signal,
  }: {
    paperText: string;
    signal: AbortSignal | undefined;
  },
): Promise<Generation> {
  /** Current locale's translation accessors, used for default title fallback. */
  const ll = LL();
  /** Paper body capped to {@link PAPER_TEXT_BUDGET} with a truncation notice. */
  const truncated = paperText.length > PAPER_TEXT_BUDGET
    ? `${
      paperText.slice(
        0,
        PAPER_TEXT_BUDGET,
      )
    }\n\n[TRUNCATED: ${paperText.length} total chars]`
    : paperText;
  /*
   * `rawString` instead of `ll.persona()` / `ll.chapterInstruction()`:
   * the chapter instruction embeds a JSON schema with deeply nested
   * `{}` patterns. typesafe-i18n's `REGEX_BRACKETS_SPLIT`
   * (`/(\{(?:[^{}]+|\{(?:[^{}]+)*\})*\})/g`) catastrophically
   * backtracks on that input under V8; the page hangs for minutes
   * before any fetch is dispatched. Bypassing the template parser
   * makes the prompt build sub-millisecond. Documented in
   * TROUBLESHOOTING.typesafe-i18n-regex-redos.md.
   */
  /** Persona prompt plus chapter-instruction schema, used as the system message. */
  const systemMessage = `${rawString('persona',)}\n\n${rawString('chapterInstruction',)}`;
  /** Paper body wrapped in fences with the JSON-only directive. */
  const userMessage =
    `Paper text:\n\n---BEGIN PAPER---\n${truncated}\n---END PAPER---\n\nRespond with valid JSON only.`;
  /** Raw LLM response text returned by the provider. */
  const text = await chat({
    messages: [
      {
        role: 'system',
        content: systemMessage,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    expectJson: true,
    signal,
  },);
  /** Response text with surrounding Markdown JSON fences stripped. */
  const cleaned = stripJsonFence(text,);
  /*
   * LLM output is an untrusted shape; we narrow against `RawResponse`
   * which uses `unknown` for every nested field, then validate via
   * `asChapter`/`asBeat` before exposing to the lecture screen.
   */
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- untrusted LLM JSON narrowed to a fully-`unknown` shape */
  /** Parsed JSON narrowed to {@link RawResponse}; every nested field stays `unknown`. */
  const parsed = JSON.parse(cleaned,) as RawResponse;
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  if (!Array.isArray(parsed.chapters,))
    throw new Error('generator: response missing `chapters` array',);
  /** Validated chapter list dropped to {@link Chapter} entries only. */
  const chapters = parsed
    .chapters
    .map(asChapter,)
    .filter(function isChapter(c,): c is Chapter {
      return c !== undefined;
    },);
  if (chapters.length === 0)
    throw new Error('generator: no valid chapters in response',);
  /** LLM-provided paper title, falling back to the locale default when missing. */
  const title = typeof parsed.title === 'string' && parsed.title.length > 0
    ? parsed.title
    : ll.defaultPaperTitle();
  return {
    title,
    chapters,
  };
}

/**
 * Strips ```json ... ``` fences sometimes returned by JSON-mode-less
 * providers. Returns the original input when no fence is detected.
 */
function stripJsonFence(text: string,): string {
  /** Input with surrounding whitespace removed, used to detect the fence. */
  const trimmed = text.trim();
  if (trimmed.startsWith('```',)) {
    /** Fenceless body returned when a Markdown JSON fence wrapped the input. */
    const stripped = trimmed
      .replace(
        /^```(?:json)?\s*/,
        '',
      )
      .replace(
        /```\s*$/,
        '',
      );
    return stripped.trim();
  }
  return trimmed;
}

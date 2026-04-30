/**
 * Claude Code statusline displaying a context-aware activity word, model name,
 * effort level, context window usage, and rate limit warnings.
 *
 * Reads JSON from stdin (which includes `transcript_path`) and `~/.claude/settings.json`.
 * Extracts a gerund from the most recent assistant text in the transcript
 * so the statusline shows what Claude is contextually doing instead of a random word.
 * Writes ANSI-colored status text to stdout.
 */

import { openAsBlob, } from 'node:fs';
import { readFile, } from 'node:fs/promises';
import { text, } from 'node:stream/consumers';

//region ANSI escape helpers

const RESET = '\u001B[0m';
const RED = '\u001B[31m';
const GREEN = '\u001B[32m';
const YELLOW = '\u001B[33m';
const MAGENTA = '\u001B[35m';
const WHITE = '\u001B[37m';

function color(
  code: string,
  text: string,
): string {
  return `${code}${text}${RESET}`;
}

//endregion

//region Types for the statusline JSON payload

type StatuslineInput = {
  transcript_path?: string;
  model?: {
    id?: string;
    display_name?: string;
  };
  context_window?: {
    context_window_size?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  rate_limits?: {
    five_hour?: RateLimitTier;
    seven_day?: RateLimitTier;
  };
};

type RateLimitTier = {
  used_percentage?: number;
  resets_at?: number;
};

//endregion

//region Model display name

/** Latest versions and default context sizes per model family. */
const MODEL_DEFAULTS: Record<
  string,
  {
    latestVersion: string;
    defaultContext: string;
  }
> = {
  Opus: {
    latestVersion: '4.7',
    defaultContext: '1M',
  },
  Sonnet: {
    latestVersion: '4.6',
    defaultContext: '200K',
  },
  Haiku: {
    latestVersion: '4.5',
    defaultContext: '200K',
  },
};

const DISPLAY_NAME_RE =
  /^(?<family>[A-Za-z]+)(?: (?<version>\d+\.\d+))?(?: \((?<context>\S+) context\))?$/;

/**
 * Parse "Opus 4.6 (1M context)" and strip parts that match current defaults.
 *
 * @example formatModelDisplay("Opus 4.6 (1M context)") // "Opus"
 *
 * @example formatModelDisplay("Sonnet 4.6 (1M context)") // "Sonnet (1M)"
 *
 * @example formatModelDisplay("Opus 4.5 (200K context)") // "Opus 4.5 (200K)"
 */
function formatModelDisplay(raw: string,): string {
  const match = DISPLAY_NAME_RE.exec(raw,);
  if (!match?.groups)
    return raw;

  const {
    family,
    version,
    context,
  } = match.groups;
  const defaults = MODEL_DEFAULTS[family];
  let result = family;

  if (version && version !== defaults?.latestVersion)
    result += ` ${version}`;
  if (context && context !== defaults?.defaultContext)
    result += ` (${context})`;

  return result;
}

//endregion

//region Relative time formatting

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

/** Format epoch seconds as a relative duration like "1h23m" or "3d2h". */
function formatRelativeTime(resetsAt: number,): string {
  const diff = resetsAt - Math.floor(Date.now() / 1_000,);

  if (diff <= 0)
    return 'now';
  if (diff < SECONDS_PER_MINUTE)
    return `${diff}s`;
  if (diff < SECONDS_PER_HOUR)
    return `${Math.floor(diff / SECONDS_PER_MINUTE,)}m`;
  if (diff < SECONDS_PER_DAY) {
    const hours = Math.floor(diff / SECONDS_PER_HOUR,);
    const mins = Math.floor((diff % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,);
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  }

  const days = Math.floor(diff / SECONDS_PER_DAY,);
  const hours = Math.floor((diff % SECONDS_PER_DAY) / SECONDS_PER_HOUR,);
  return hours > 0 ? `${days}d${hours}h` : `${days}d`;
}

//endregion

//region Rate limit formatting

const RATE_LIMIT_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 10;
const CAUTION_THRESHOLD = 25;

/**
 * Format a rate limit tier as colored "X% left (Yt)".
 * Returns empty string if data is missing or remaining capacity is above threshold.
 */
function formatRateLimit(tier: RateLimitTier | undefined,): string {
  if (!tier?.used_percentage || !tier.resets_at)
    return '';

  const remaining = Math.floor(100 - tier.used_percentage,);
  if (remaining > RATE_LIMIT_THRESHOLD)
    return '';

  const timeLeft = formatRelativeTime(tier.resets_at,);
  const rateColor = remaining <= CRITICAL_THRESHOLD
    ? RED
    : (remaining <= CAUTION_THRESHOLD
      ? YELLOW
      : GREEN);

  return `${
    color(
      rateColor,
      `${remaining}% left`,
    )
  } (${timeLeft})`;
}

//endregion

//region Context window formatting

const CONTEXT_THRESHOLD_WHITE = 900_000;
const CONTEXT_THRESHOLD_MAGENTA = 200_000;
const CONTEXT_THRESHOLD_YELLOW = 100_000;
const THOUSANDS = 1_000;

/** Format used/total token counter with color based on usage level. */
function formatContextWindow(
  used: number,
  total: number,
): string {
  const usedFmt = used >= THOUSANDS
    ? `${String(Math.floor(used / THOUSANDS,),).padStart(3,)},${
      String(
        used % THOUSANDS,
      )
        .padStart(
          3,
          '0',
        )
    }`
    : String(used,).padStart(7,);

  const totalFmt = total.toLocaleString('en-US',);

  const contextColor = used >= CONTEXT_THRESHOLD_WHITE
    ? WHITE
    : used >= CONTEXT_THRESHOLD_MAGENTA
    ? MAGENTA
    : used >= CONTEXT_THRESHOLD_YELLOW
    ? YELLOW
    : '';

  return contextColor
    ? `${
      color(
        contextColor,
        usedFmt,
      )
    }/${totalFmt}`
    : `${usedFmt}/${totalFmt}`;
}

//endregion

//region Effort level from settings

/** Effort level symbols matching Claude Code's built-in indicators. */
const EFFORT_SYMBOLS: Record<string, string> = {
  low: '\u25CB',
  medium: '\u25D0',
  max: '\u25C9',
};

/**
 * Read `effortLevel` from `~/.claude/settings.json`.
 * Returns empty string for "high" (default) or when unreadable.
 *
 * @example readEffortIndicator() // "○" when low, "◐" when medium, "" when high
 */
async function readEffortIndicator(): Promise<string> {
  try {
    const home = process.env['HOME'] ?? '';
    const settingsPath = `${home}/.claude/settings.json`;
    const raw = await readFile(
      settingsPath,
      'utf8',
    );
    const settings: { effortLevel?: string; } = JSON.parse(raw,);
    const level = settings.effortLevel ?? 'high';
    return EFFORT_SYMBOLS[level] ?? '';
  }
  catch {
    return '';
  }
}

//endregion

//region Activity word -- gerund extraction from transcript

/**
 * Words ending in "-ing" that are not meaningful activity verbs.
 * Includes phase-implying verbs, generic fillers, pronouns,
 * prepositions, adjectives, and words where "-ing" is part of the root.
 */
const NOISE_GERUNDS = new Set([
  // Phase-implying (sound wrong at arbitrary points)
  'beginning',
  'completing',
  'continuing',
  'ending',
  'finishing',
  'starting',
  'stopping',
  'waiting',
  'pending',
  // Too generic
  'asking',
  'calling',
  'coming',
  'doing',
  'getting',
  'giving',
  'going',
  'having',
  'keeping',
  'knowing',
  'letting',
  'looking',
  'making',
  'meaning',
  'putting',
  'saying',
  'seeing',
  'showing',
  'telling',
  'trying',
  'turning',
  'wanting',
  'working',
  'reading',
  'searching',
  // Pronouns and determiners
  'anything',
  'everything',
  'nothing',
  'something',
  'thing',
  // Prepositions and conjunctions
  'according',
  'assuming',
  'concerning',
  'considering',
  'depending',
  'during',
  'excluding',
  'following',
  'including',
  'providing',
  'regarding',
  'supposing',
  // Adjectives
  'amazing',
  'annoying',
  'boring',
  'confusing',
  'corresponding',
  'exciting',
  'existing',
  'frustrating',
  'interesting',
  'missing',
  'lint-missing',
  'outstanding',
  'overwhelming',
  'remaining',
  'surprising',
  'surrounding',
  'underlying',
  // Not gerunds (root contains "-ing")
  'bring',
  'cling',
  'fling',
  'king',
  'ring',
  'sing',
  'sling',
  'spring',
  'sting',
  'string',
  'swing',
  'wing',
  'wring',
  'sibling',
  // Common filler verbs
  'being',
  'needing',
  'running',
  'thinking',
  'using',
  // Strays inserted by Claude Code
  'quizzical-crafting',
  'crafting',
  'wild-nibbling',
  'nibbling',
  'purring',
  'hatching',
  'purring-hatching',
  'beaming',
  'hidden-beaming',
  'nnothing',
  'nstring',
],);

/** Minimum word length to consider as a gerund candidate. */
const MIN_GERUND_LENGTH = 5;

/** Matches words ending in "-ing", including hyphenated compounds like "tree-shaking". */
const GERUND_PATTERN = /\b[a-z]+-?[a-z]*ing\b/g;

/** Number of bytes to read from the end of the transcript. */
const TAIL_BYTES = 8_192;

/**
 * Find the last meaningful gerund in a string.
 *
 * @param text - Any text to scan (raw transcript, prose, JSON -- gerunds survive regardless).
 *
 * @returns Capitalized gerund, or `undefined` if none found.
 *
 * @example findGerundInText("Let me start searching for the file") // "Searching"
 *
 * @example findGerundInText("I'll try compiling and then testing") // "Testing"
 */
function findGerundInText(text: string,): string | undefined {
  const matches = text.toLowerCase().match(GERUND_PATTERN,) ?? [];
  const candidates = matches
    .filter(function isLongEnough(w,) {
      return w.length >= MIN_GERUND_LENGTH;
    },)
    .filter(function isNotNoise(w,) {
      return !NOISE_GERUNDS.has(w,);
    },);

  if (candidates.length === 0)
    return undefined;

  const last = candidates.at(-1,);
  /* oxlint-disable-next-line typescript/no-non-null-assertion -- length check guarantees element */
  return last!.charAt(0,).toUpperCase() + last!.slice(1,);
}

/**
 * Extract a context-aware activity word from the transcript.
 * Reads the last {@link TAIL_BYTES} of the transcript as a raw string
 * and finds the last gerund in it. No JSON parsing needed --
 * gerunds in assistant prose survive the JSONL wrapping.
 * Falls back to "".
 *
 * @param transcriptPath - Path to the session transcript JSONL.
 *
 * @returns Capitalized activity word.
 */
async function readActivityWord(
  transcriptPath: string | undefined,
): Promise<string> {
  if (!transcriptPath)
    return '';

  try {
    const blob = await openAsBlob(transcriptPath,);
    const start = Math.max(
      0,
      blob.size - TAIL_BYTES,
    );
    const tail = await blob
      .slice(
        start,
        blob.size,
      )
      .text();
    return findGerundInText(tail,) ?? '';
  }
  catch {
    return '';
  }
}

//endregion

//region Main

/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON from Claude Code statusline dispatch */
const input = JSON.parse(await text(process.stdin,),) as StatuslineInput;

const SEP = '    ';

// Model name + effort level
const displayName = input.model?.display_name;
const effortIndicator = await readEffortIndicator();
const modelSegment = displayName
  ? (function formatModel() {
    const model = formatModelDisplay(displayName,);
    return effortIndicator
      ? `${model} ${
        color(
          YELLOW,
          effortIndicator,
        )
      }`
      : model;
  })()
  : '';

// Context window
const usage = input.context_window?.current_usage;
const total = input.context_window?.context_window_size ?? 0;
const used = (usage?.input_tokens ?? 0)
  + (usage?.cache_creation_input_tokens ?? 0)
  + (usage?.cache_read_input_tokens ?? 0)
  + (usage?.output_tokens ?? 0);
const contextSegment = used > 0 && total > 0
  ? formatContextWindow(
    used,
    total,
  )
  : '';

// Rate limits (only visible when approaching limits)
const fiveHour = formatRateLimit(input.rate_limits?.five_hour,);
const sevenDay = formatRateLimit(input.rate_limits?.seven_day,);
const rateSegment = fiveHour && sevenDay
  ? `${fiveHour} · ${sevenDay}`
  : fiveHour || sevenDay || '';

// Activity word (context-aware, extracted from transcript)
const activityWord = await readActivityWord(input.transcript_path,);

const line = [
  modelSegment,
  contextSegment,
  rateSegment,
  activityWord,
]
  .filter(function isNonEmpty(s,) {
    return s.length > 0;
  },)
  .join(SEP,);

if (line.length > 0)
  console.log(line,);

//endregion

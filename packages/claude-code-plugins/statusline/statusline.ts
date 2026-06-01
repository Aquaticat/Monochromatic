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

/**
 * ANSI reset; appended after every coloured segment to avoid bleeding into adjacent text.
 */
const RESET = '\u001B[0m';
/**
 * ANSI red; reserved for critical states (low remaining quota, projected overrun).
 */
const RED = '\u001B[31m';
/**
 * ANSI green; reserved for healthy states (plenty of quota remaining).
 */
const GREEN = '\u001B[32m';
/**
 * ANSI yellow; reserved for caution states and the effort indicator.
 */
const YELLOW = '\u001B[33m';
/**
 * ANSI magenta; reserved for the upper context-usage tier just below the maximum.
 */
const MAGENTA = '\u001B[35m';
/**
 * ANSI white; reserved for the top context-usage tier, signalling the window is nearly full.
 */
const WHITE = '\u001B[37m';

/**
 * Wrap a string in an ANSI colour code and reset.
 *
 * @param code - Escape sequence opening the colour scope.
 *
 * @param text - Content to render inside that scope.
 *
 * @returns Concatenation of code, content, and {@link RESET}.
 */
function color(
  code: string,
  text: string,
): string {
  return `${code}${text}${RESET}`;
}

//endregion

//region Types for the statusline JSON payload

/**
 * Shape of the JSON payload Claude Code dispatches to the statusline binary on stdin.
 */
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

/**
 * One rate-limit window (five-hour or seven-day) as reported in {@link StatuslineInput}.
 */
type RateLimitTier = {
  used_percentage?: number;
  resets_at?: number;
};

//endregion

//region Model display name

/**
 * Latest versions and default context sizes per model family.
 */
const MODEL_DEFAULTS: Record<
  string,
  {
    latestVersion: string;
    defaultContext: string;
  }
> = {
  Opus: {
    latestVersion: '4.8',
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

/**
 * Capture `family`, optional `version`, and optional `context` from display names
 * like `Opus`, `Opus 4.6`, or `Opus 4.6 (1M context)`.
 */
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
  /**
   * Captured groups from the display-name format; `null` when the input does not match the expected shape.
   */
  const match = DISPLAY_NAME_RE.exec(raw,);
  if (!match?.groups)
    return raw;

  /**
   * Components of the parsed display name; each may be empty for short variants like `"Opus"`.
   */
  const {
    family,
    version,
    context,
  } = match.groups;
  /**
   * Reference values for this family; lookup miss leaves `undefined`, which fails the equality checks below and keeps the raw version/context in the output.
   */
  const defaults = MODEL_DEFAULTS[family];
  /**
   * Accumulator for the trimmed display name, seeded with the family and extended only with parts that diverge from defaults.
   */
  let result = family;

  if (version && (version !== defaults
    ?.latestVersion))
    result += ` ${version}`;
  if (context && (context !== defaults
    ?.defaultContext))
    result += ` (${context})`;

  return result;
}

//endregion

//region Relative time formatting

/**
 * Seconds in one minute, named so duration arithmetic reads as units rather than magic.
 */
const SECONDS_PER_MINUTE = 60;
/**
 * Seconds in one hour, used both for time arithmetic and to derive {@link FIVE_HOUR_WINDOW_SECONDS}.
 */
const SECONDS_PER_HOUR = 3_600;
/**
 * Seconds in one day, used both for time arithmetic and to derive {@link SEVEN_DAY_WINDOW_SECONDS}.
 */
const SECONDS_PER_DAY = 86_400;

/**
 * Format epoch seconds as a relative duration like "1h23m" or "3d2h".
 */
function formatRelativeTime(resetsAt: number,): string {
  /**
   * Remaining seconds until the reset; non-positive when the reset already passed.
   */
  const diff = resetsAt - Math
    .floor(Date.now()
      / 1_000,);

  if (diff <= 0)
    return 'now';
  if (diff < SECONDS_PER_MINUTE)
    return `${diff}s`;
  if (diff < SECONDS_PER_HOUR)
    return `${Math.floor(diff / SECONDS_PER_MINUTE,)}m`;
  if (diff < SECONDS_PER_DAY) {
    /**
     * Whole-hour component of `diff` for the sub-day formatting branch.
     */
    const hours = Math.floor(diff / SECONDS_PER_HOUR,);
    /**
     * Residual minutes after subtracting the whole hours; omitted from output when zero.
     */
    const mins = Math.floor((diff % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,);
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  }

  /**
   * Whole-day component of `diff` for the multi-day formatting branch.
   */
  const days = Math.floor(diff / SECONDS_PER_DAY,);
  /**
   * Residual hours after subtracting the whole days; omitted from output when zero.
   */
  const hours = Math.floor((diff % SECONDS_PER_DAY) / SECONDS_PER_HOUR,);
  return hours > 0 ? `${days}d${hours}h` : `${days}d`;
}

//endregion

//region Rate limit formatting

/**
 * Visibility cutoff: tier renders only once remaining is at or below this percentage.
 */
const RATE_LIMIT_THRESHOLD = 50;
/**
 * Critical-band cutoff: at or below this remaining percentage the tier renders red.
 */
const CRITICAL_THRESHOLD = 10;
/**
 * Caution-band cutoff: at or below this remaining percentage the tier renders yellow.
 */
const CAUTION_THRESHOLD = 25;
/**
 * Length of the five-hour rate-limit window in seconds; used to recover elapsed time from `resets_at`.
 */
const FIVE_HOUR_WINDOW_SECONDS = 5 * SECONDS_PER_HOUR;
/**
 * Length of the seven-day rate-limit window in seconds; used to recover elapsed time from `resets_at`.
 */
const SEVEN_DAY_WINDOW_SECONDS = 7 * SECONDS_PER_DAY;
/**
 * Projected-usage cutoff: forces a rate-limit segment to render when the extrapolated end-of-window usage exceeds this percentage.
 */
const PROJECTED_OVERRUN_THRESHOLD = 100;

/**
 * Minimum used_percentage required before extrapolating burn rate.
 * Avoids spurious overrun warnings from one-shot quota counters at session start,
 * where a few seconds of elapsed time would extrapolate any nonzero usage to infinity.
 */
const MIN_USAGE_FOR_PROJECTION = 5;

/**
 * Format a rate limit tier as colored "X% left (Yt)", annotated with a
 * projected-overrun marker " →Z%" when the current burn rate extrapolates
 * past 100% before the window resets.
 *
 * Renders when remaining is at or below {@link RATE_LIMIT_THRESHOLD}
 * **or** when projection exceeds {@link PROJECTED_OVERRUN_THRESHOLD};
 * returns empty string otherwise, or when tier data is missing.
 *
 * @param tier - The rate-limit tier payload from the statusline JSON.
 *
 * @param windowSeconds - Fixed window duration; used to recover elapsed time as `windowSeconds - (resets_at - now)`.
 *
 * @example formatRateLimit({tier: {used_percentage: 92, resets_at: NOW + 3600}, windowSeconds: 18000}) // "8% left (1h)" in red
 *
 * @example formatRateLimit({tier: {used_percentage: 60, resets_at: NOW + 7200}, windowSeconds: 18000}) // "40% left →200% (2h)" in red, since projection > 100
 */
function formatRateLimit({
  tier,
  windowSeconds,
}: {
  tier: RateLimitTier | undefined;
  windowSeconds: number;
},): string {
  if ((!tier?.used_percentage) || (!tier.resets_at))
    return '';

  /**
   * Current wall-clock time in epoch seconds; matched against `tier.resets_at` to derive elapsed.
   */
  const now = Math.floor(Date.now()
    / 1_000,);
  /**
   * Seconds already consumed in the window; negative when `resets_at` is in the future by more than the configured duration.
   */
  const elapsed = windowSeconds - (tier.resets_at
    - now);
  /**
   * Linear extrapolation of end-of-window usage from current burn rate.
   *
   * Set to `0` when elapsed is non-positive or usage is below {@link MIN_USAGE_FOR_PROJECTION},
   * to suppress the divide-by-tiny-elapsed amplification at session start.
   */
  const projected = (elapsed > 0) && (tier.used_percentage
    >= MIN_USAGE_FOR_PROJECTION)
    ? (tier.used_percentage
      / elapsed) * windowSeconds
    : 0;
  /**
   * True when projected usage exceeds 100%, forcing the segment to render even below {@link RATE_LIMIT_THRESHOLD}.
   */
  const isProjectedOverrun = projected > PROJECTED_OVERRUN_THRESHOLD;

  /**
   * Remaining quota percentage as a whole number; the user-facing value in the output.
   */
  const remaining = Math.floor(100 - tier
    .used_percentage,);
  if ((remaining > RATE_LIMIT_THRESHOLD) && (!isProjectedOverrun))
    return '';

  /**
   * Human-readable time until window reset, formatted by {@link formatRelativeTime}.
   */
  const timeLeft = formatRelativeTime(tier.resets_at,);
  /**
   * Colour code picked from the critical/caution/healthy bands or red for any projected overrun.
   */
  const rateColor = (isProjectedOverrun || (remaining <= CRITICAL_THRESHOLD))
    ? RED
    : (remaining <= CAUTION_THRESHOLD
      ? YELLOW
      : GREEN);

  /**
   * Inline annotation showing the projected end-of-window percentage; empty when no overrun is projected.
   */
  const overrunMarker = isProjectedOverrun
    ? ` →${Math.floor(projected,)}%`
    : '';

  return `${
    color(
      rateColor,
      `${remaining}% left${overrunMarker}`,
    )
  } (${timeLeft})`;
}

//endregion

//region Context window formatting

/**
 * Token count at or above which the used segment renders white, signalling the window is nearly full.
 */
const CONTEXT_THRESHOLD_WHITE = 900_000;
/**
 * Token count at or above which the used segment renders magenta, the upper tier just below white.
 */
const CONTEXT_THRESHOLD_MAGENTA = 200_000;
/**
 * Token count at or above which the used segment renders yellow, the first non-neutral tier.
 */
const CONTEXT_THRESHOLD_YELLOW = 100_000;
/**
 * Base for the thousands grouping used by {@link formatContextWindow}.
 */
const THOUSANDS = 1_000;

/**
 * Format used/total token counter with color based on usage level.
 */
function formatContextWindow(
  used: number,
  total: number,
): string {
  /**
   * Used-token count rendered with a comma between thousands and ones blocks, right-padded so adjacent
   * statusline frames align column-by-column instead of wobbling as the count grows.
   */
  const usedFmt = used >= THOUSANDS
    ? `${String(Math.floor(used / THOUSANDS,),)
      .padStart(3,)},${
      String(
        used % THOUSANDS,
      )
        .padStart(
          3,
          '0',
        )
    }`
    : String(used,)
      .padStart(7,);

  /**
   * Total token count rendered with locale-aware thousands separators.
   */
  const totalFmt = total.toLocaleString('en-US',);

  /**
   * Colour code picked from the WHITE/MAGENTA/YELLOW bands; empty when usage sits below every threshold.
   */
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

/**
 * Effort level symbols matching Claude Code's built-in indicators.
 */
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
    /**
     * User home directory; treated as empty when the env var is unset so the path simply fails to resolve.
     */
    const home = process.env
      .HOME
      ?? '';
    /**
     * Path to the global Claude Code settings file storing `effortLevel`.
     */
    const settingsPath = `${home}/.claude/settings.json`;
    /**
     * Raw JSON read from disk; only `effortLevel` is consumed downstream.
     */
    const raw = await readFile(
      settingsPath,
      'utf8',
    );
    /**
     * Parsed settings narrowed to just the `effortLevel` field this function cares about.
     */
    const settings: { effortLevel?: string; } = JSON.parse(raw,);
    /**
     * Resolved effort level; defaults to `"high"`, which is the rendered-as-empty branch.
     */
    const level = settings.effortLevel
      ?? 'high';
    return EFFORT_SYMBOLS[level]
      ?? '';
  }
  catch {
    return '';
  }
}

//endregion

//region Activity word: gerund extraction from transcript

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

/**
 * Minimum word length to consider as a gerund candidate.
 */
const MIN_GERUND_LENGTH = 5;

/**
 * Matches words ending in "-ing", including hyphenated compounds like "tree-shaking".
 */
const GERUND_PATTERN = /\b[a-z]+-?[a-z]*ing\b/g;

/**
 * Number of bytes to read from the end of the transcript.
 */
const TAIL_BYTES = 8_192;

/**
 * Find the last meaningful gerund in a string.
 *
 * @param text - Any text to scan (raw transcript, prose, JSON; gerunds survive regardless).
 *
 * @returns Capitalized gerund, or `undefined` if none found.
 *
 * @example findGerundInText("Let me start searching for the file") // "Searching"
 *
 * @example findGerundInText("I'll try compiling and then testing") // "Testing"
 */
function findGerundInText(text: string,): string | undefined {
  /**
   * Raw `-ing` matches across the lowercased text; empty array when nothing matches, so downstream filters stay total.
   */
  const matches = text.toLowerCase()
    .match(GERUND_PATTERN,)
    ?? [];
  /**
   * Matches that survive the length and noise filters; the last one becomes the activity word.
   */
  const candidates = matches
    .filter(function isLongEnough(w,) {
      return w.length
        >= MIN_GERUND_LENGTH;
    },)
    .filter(function isNotNoise(w,) {
      return !NOISE_GERUNDS.has(w,);
    },);

  if (candidates.length
    === 0)
    return undefined;

  /**
   * Last surviving candidate; preferred over the first so the statusline tracks the most recent activity.
   */
  const last = candidates.at(-1,);
  /* oxlint-disable-next-line typescript/no-non-null-assertion -- length check guarantees element */
  return last!.charAt(0,)
    .toUpperCase()
    + last!
    .slice(1,);
}

/**
 * Extract a context-aware activity word from the transcript.
 * Reads the last {@link TAIL_BYTES} of the transcript as a raw string
 * and finds the last gerund in it. No JSON parsing needed:
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
    /**
     * Blob view of the transcript; preferred over readFile so we can slice the tail without loading the full file.
     */
    const blob = await openAsBlob(transcriptPath,);
    /**
     * Slice offset clamped to zero so transcripts shorter than {@link TAIL_BYTES} still read from the beginning.
     */
    const start = Math.max(
      0,
      blob.size
        - TAIL_BYTES,
    );
    /**
     * Tail of the transcript decoded as UTF-8 text; we accept potential codepoint truncation at the head, since later matches win.
     */
    const tail = await blob
      .slice(
        start,
        blob.size,
      )
      .text();
    return findGerundInText(tail,)
      ?? '';
  }
  catch {
    return '';
  }
}

//endregion

//region Main

/**
 * Parsed statusline payload from stdin; trusted as {@link StatuslineInput} because Claude Code dispatches it directly.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON from Claude Code statusline dispatch */
const input = JSON.parse(await text(process.stdin,),) as StatuslineInput;

/**
 * Separator inserted between rendered segments; four spaces give breathing room without ANSI artifacts.
 */
const SEP = '    ';

/**
 * Model display name pulled from the input; absent or empty when Claude Code did not supply it.
 */
const displayName = input.model
  ?.display_name;
/**
 * Effort-level indicator read from `~/.claude/settings.json`; empty when "high" or unreadable.
 */
const effortIndicator = await readEffortIndicator();
/**
 * Composed model segment: model name plus the yellow effort indicator when applicable; empty when no display name.
 */
const modelSegment = displayName
  ? (function formatModel() {
    /**
     * Trimmed display form of the model name from {@link formatModelDisplay}.
     */
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

/**
 * Current-usage subtree from the input; absent when Claude Code has not reported any usage yet.
 */
const usage = input.context_window
  ?.current_usage;
/**
 * Total context-window size; defaults to zero so the segment is suppressed when the input lacks this field.
 */
const total = input.context_window
  ?.context_window_size
  ?? 0;
/**
 * Sum of every input/output/cache token bucket; the user-facing "used" half of the context segment.
 */
const used = (usage?.input_tokens
  ?? 0)
  + (usage?.cache_creation_input_tokens
    ?? 0)
  + (usage?.cache_read_input_tokens
    ?? 0)
  + (usage?.output_tokens
    ?? 0);
/**
 * Rendered context-window segment; empty until both used and total are known so the line stays clean at session start.
 */
const contextSegment = (used > 0) && (total > 0)
  ? formatContextWindow(
    used,
    total,
  )
  : '';

/**
 * Rendered five-hour rate-limit segment; empty when remaining is comfortable and no overrun is projected.
 */
const fiveHour = formatRateLimit({
  tier: input.rate_limits
    ?.five_hour,
  windowSeconds: FIVE_HOUR_WINDOW_SECONDS,
},);
/**
 * Rendered seven-day rate-limit segment; same emit-when-needed logic as {@link fiveHour}.
 */
const sevenDay = formatRateLimit({
  tier: input.rate_limits
    ?.seven_day,
  windowSeconds: SEVEN_DAY_WINDOW_SECONDS,
},);
/**
 * Joined rate-limit segment; uses a middle-dot separator only when both tiers render.
 */
const rateSegment = fiveHour && sevenDay
  ? `${fiveHour} · ${sevenDay}`
  : fiveHour || sevenDay
    || '';

/**
 * Context-aware activity word extracted from the transcript tail; empty when extraction fails or no transcript exists.
 */
const activityWord = await readActivityWord(input.transcript_path,);

/**
 * Final statusline assembled from the four segments, dropping empty ones so the separator never appears doubled.
 */
const line = [
  modelSegment,
  contextSegment,
  rateSegment,
  activityWord,
]
  .filter(function isNonEmpty(s,) {
    return s.length
      > 0;
  },)
  .join(SEP,);

if (line.length
  > 0)
  console.log(line,);

//endregion

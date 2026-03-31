#!/usr/bin/env bun

/**
 * Claude Code statusline displaying model name, effort level, context window usage, and rate limit warnings.
 * Reads JSON from stdin and `~/.claude/settings.json`, writes ANSI-colored status text to stdout.
 */

//region ANSI escape helpers

const RESET = "\x1b[0m"
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const MAGENTA = "\x1b[35m"
const WHITE = "\x1b[37m"

function color(code: string, text: string): string {
  return `${code}${text}${RESET}`
}

//endregion

//region Types for the statusline JSON payload

type StatuslineInput = {
  model?: {
    id?: string
    display_name?: string
  }
  context_window?: {
    context_window_size?: number
    current_usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  rate_limits?: {
    five_hour?: RateLimitTier
    seven_day?: RateLimitTier
  }
}

type RateLimitTier = {
  used_percentage?: number
  resets_at?: number
}

//endregion

//region Model display name

/** Latest versions and default context sizes per model family. */
const MODEL_DEFAULTS: Record<string, { latestVersion: string; defaultContext: string }> = {
  Opus: { latestVersion: "4.6", defaultContext: "1M" },
  Sonnet: { latestVersion: "4.6", defaultContext: "200K" },
  Haiku: { latestVersion: "4.5", defaultContext: "200K" },
}

const DISPLAY_NAME_RE = /^(?<family>[A-Za-z]+)(?: (?<version>\d+\.\d+))?(?: \((?<context>\S+) context\))?$/

/**
 * Parse "Opus 4.6 (1M context)" and strip parts that match current defaults.
 *
 * @example formatModelDisplay("Opus 4.6 (1M context)") // "Opus"
 * @example formatModelDisplay("Sonnet 4.6 (1M context)") // "Sonnet (1M)"
 * @example formatModelDisplay("Opus 4.5 (200K context)") // "Opus 4.5 (200K)"
 */
function formatModelDisplay(raw: string): string {
  const match = DISPLAY_NAME_RE.exec(raw)
  if (!match?.groups) {
    return raw
  }

  const { family, version, context } = match.groups
  const defaults = MODEL_DEFAULTS[family]
  let result = family

  if (version && version !== defaults?.latestVersion) {
    result += ` ${version}`
  }
  if (context && context !== defaults?.defaultContext) {
    result += ` (${context})`
  }

  return result
}

//endregion

//region Relative time formatting

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400

/** Format epoch seconds as a relative duration like "1h23m" or "3d2h". */
function formatRelativeTime(resetsAt: number): string {
  const diff = resetsAt - Math.floor(Date.now() / 1000)

  if (diff <= 0) {
    return "now"
  }
  if (diff < SECONDS_PER_MINUTE) {
    return `${diff}s`
  }
  if (diff < SECONDS_PER_HOUR) {
    return `${Math.floor(diff / SECONDS_PER_MINUTE)}m`
  }
  if (diff < SECONDS_PER_DAY) {
    const hours = Math.floor(diff / SECONDS_PER_HOUR)
    const mins = Math.floor((diff % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
  }

  const days = Math.floor(diff / SECONDS_PER_DAY)
  const hours = Math.floor((diff % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  return hours > 0 ? `${days}d${hours}h` : `${days}d`
}

//endregion

//region Rate limit formatting

const RATE_LIMIT_THRESHOLD = 50
const CRITICAL_THRESHOLD = 10
const CAUTION_THRESHOLD = 25

/**
 * Format a rate limit tier as colored "X% left (Yt)".
 * Returns empty string if data is missing or remaining capacity is above threshold.
 */
function formatRateLimit(tier: RateLimitTier | undefined): string {
  if (!tier?.used_percentage || !tier.resets_at) {
    return ""
  }

  const remaining = Math.floor(100 - tier.used_percentage)
  if (remaining > RATE_LIMIT_THRESHOLD) {
    return ""
  }

  const timeLeft = formatRelativeTime(tier.resets_at)
  const rateColor =
    remaining <= CRITICAL_THRESHOLD ? RED
    : remaining <= CAUTION_THRESHOLD ? YELLOW
    : GREEN

  return `${color(rateColor, `${remaining}% left`)} (${timeLeft})`
}

//endregion

//region Context window formatting

const CONTEXT_THRESHOLD_WHITE = 900_000
const CONTEXT_THRESHOLD_MAGENTA = 200_000
const CONTEXT_THRESHOLD_YELLOW = 100_000
const THOUSANDS = 1000

/** Format used/total token counter with color based on usage level. */
function formatContextWindow(used: number, total: number): string {
  const usedFmt =
    used >= THOUSANDS
      ? `${String(Math.floor(used / THOUSANDS)).padStart(3)},${String(used % THOUSANDS).padStart(3, "0")}`
      : String(used).padStart(7)

  const totalFmt = total.toLocaleString("en-US")

  const contextColor =
    used >= CONTEXT_THRESHOLD_WHITE ? WHITE
    : used >= CONTEXT_THRESHOLD_MAGENTA ? MAGENTA
    : used >= CONTEXT_THRESHOLD_YELLOW ? YELLOW
    : ""

  return contextColor
    ? `${color(contextColor, usedFmt)}/${totalFmt}`
    : `${usedFmt}/${totalFmt}`
}

//endregion

//region Effort level from settings

/** Effort level symbols matching Claude Code's built-in indicators. */
const EFFORT_SYMBOLS: Record<string, string> = {
  low: "\u25CB",
  medium: "\u25D0",
  max: "\u25C9",
}

/**
 * Read `effortLevel` from `~/.claude/settings.json`.
 * Returns empty string for "high" (default) or when unreadable.
 *
 * @example readEffortIndicator() // "○" when low, "◐" when medium, "" when high
 */
async function readEffortIndicator(): Promise<string> {
  try {
    const home = process.env["HOME"] ?? ""
    const settingsPath = `${home}/.claude/settings.json`
    const file = Bun.file(settingsPath)
    const settings: { effortLevel?: string } = await file.json()
    const level = settings.effortLevel ?? "high"
    return EFFORT_SYMBOLS[level] ?? ""
  } catch {
    return ""
  }
}

//endregion

//region Main

const input: StatuslineInput = await Bun.stdin.json()

const SEP = "    "
const segments: string[] = []

// Model name + effort level
const displayName = input.model?.display_name
const effortIndicator = await readEffortIndicator()
if (displayName) {
  const model = formatModelDisplay(displayName)
  segments.push(effortIndicator ? `${model} ${color(YELLOW, effortIndicator)}` : model)
}

// Context window
const usage = input.context_window?.current_usage
const total = input.context_window?.context_window_size ?? 0
const used =
  (usage?.input_tokens ?? 0) +
  (usage?.cache_creation_input_tokens ?? 0) +
  (usage?.cache_read_input_tokens ?? 0) +
  (usage?.output_tokens ?? 0)

if (used > 0 && total > 0) {
  segments.push(formatContextWindow(used, total))
}

// Rate limits (only visible when approaching limits)
const fiveHour = formatRateLimit(input.rate_limits?.five_hour)
const sevenDay = formatRateLimit(input.rate_limits?.seven_day)

if (fiveHour && sevenDay) {
  segments.push(`${fiveHour} · ${sevenDay}`)
} else if (fiveHour) {
  segments.push(fiveHour)
} else if (sevenDay) {
  segments.push(sevenDay)
}

if (segments.length > 0) {
  console.log(segments.join(SEP))
}

//endregion

# statusline

Minimal Claude Code status line showing context window token usage and API rate limit warnings.

## What it displays

A fixed-width token counter plus rate limit indicators that appear only when approaching limits.

**Normal usage** (rate limits comfortable):

```
Opus     51,045/1,000,000
```

**Approaching a limit** (session window at 72% used, 28% remaining):

```
Opus     51,045/1,000,000    28% left (1h23m)
```

**Both tiers constrained**:

```
Opus     51,045/1,000,000    28% left (1h23m) · 12% left (3d2h)
```

The token counter is always 7 characters wide (`TTT,OOO` format) so the display never shifts.

## Rate limit indicators

Rate limit warnings use a "remaining + time-to-reset" framing.
Instead of "72% used, resets at 4pm," the status line shows "28% left (1h23m)."
This answers the natural question: "How much can I do before it refills?"

Indicators only appear when remaining capacity drops to 50% or below.
When everything is comfortable, nothing extra is shown -- no news is good news.

Two tiers are tracked from the statusline JSON payload:

- **Session** (`rate_limits.five_hour`) -- 5-hour rolling window
- **Week** (`rate_limits.seven_day`) -- 7-day rolling window

If both tiers are constrained, both appear separated by a centered dot.
If only one is constrained, only that one is shown.
Data is only available for Pro/Max subscribers after the first API response in a session.

## Color thresholds

**Context window** (token counter):

- **Default** (no color) -- under 100,000 tokens
- **Yellow** -- 100,000 or more
- **Pink/magenta** -- 200,000 or more
- **White** -- 900,000 or more (near context limit)

**Rate limit remaining**:

- **Green** -- more than 25% remaining
- **Yellow** -- 10-25% remaining
- **Red** -- 10% or less remaining

## Token calculation

Sums all token types from the current API state:
`input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens`
from `context_window.current_usage`.
This matches the built-in token counter (`SBH` in Claude Code's source), which includes output tokens.
Note that `used_percentage` excludes output tokens, so this count is slightly higher.

The count may briefly differ from the built-in counter during active tool use or subagent work.
The built-in reads usage from the last message in the conversation,
while `context_window.current_usage` comes from the statusline JSON payload.
These data sources can reference different API calls until the next assistant response settles them.

Claude Code debounces statusline script invocations at 300ms.
This is built into Claude Code itself and cannot be configured from the script side.

## Dependencies

- `jq` for JSON parsing
- `awk` for percentage arithmetic
- `date` for relative time calculation

## Installation

Copy the script to `~/.claude/`:

```bash
cp statusline.sh ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh
```

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline.sh"
  }
}
```

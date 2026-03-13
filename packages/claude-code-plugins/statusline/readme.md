# statusline

Minimal Claude Code status line that shows only context window token usage.

## What it displays

A single fixed-width token counter: `used/total`.

```
 51,045/1,000,000
```

The used count is always 7 characters wide (`TTT,OOO` format) so the display never shifts
as the number grows. The comma in the thousands position is always present.

## Color thresholds

The used token count changes color as context fills up:

- **Default** (no color) -- under 100,000 tokens
- **Yellow** -- 100,000 or more
- **Pink/magenta** -- 200,000 or more
- **White** -- 900,000 or more (near context limit)

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

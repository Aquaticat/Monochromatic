# stop-reminders

Claude Code `Stop` hook that detects uncertain language in Claude's responses
and reminds it to investigate rather than guess.

## What it does

Scans Claude's final response for hedging phrases like "probably",
 "maybe",
 "I think",
"I believe",
 and similar markers.
 When found,
 blocks the stop and sends a reminder
to search for evidence,
 read code,
 or check documentation before responding.

The hook strips code blocks,
 inline code,
 blockquotes,
 and quoted strings before scanning
to reduce false positives from code,
 quoted material,
 or verbatim mentions.

**Loop prevention**:
 when `stop_hook_active` is true (Claude is already continuing
from a prior stop hook block),
 the hook allows the stop unconditionally
to prevent infinite blocking cycles.

## Detected patterns

- **Modal hedges**:
   probably,
   maybe,
   perhaps,
   possibly,
   likely,
   presumably
- **Epistemic hedges**:
   I think,
   I believe,
   I assume,
   I suspect,
   I imagine,
   I guess,
   I suppose
- **Conditional hedges**:
   might be,
   could be,
   should be
- **Uncertainty markers**:
   not sure,
   not certain,
   hard to say,
   difficult to tell
- **Approximation markers**:
   if I recall,
   if I remember,
   from what I recall,
   as far as I know

## Installation

Add the package as a workspace dependency in the root `package.json`:

```json
{
  "devDependencies": {
    "@monochromatic-dev/claude-code-plugin-stop-reminder": "workspace:*"
  }
}
```

Then run `pnpm install` to link the binary.

## Setup

Add to `.claude/settings.json` or `.claude/settings.local.json`:

```jsonc
{
  "hooks": {
    "Stop": [{ "type": "command", "command": "ccsr" }],
  },
}
```

## Binary

`ccsr`:
 **C**laude **C**ode **S**top **R**eminders

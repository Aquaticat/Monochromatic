# stop-reminders

Claude Code `Stop` hook that detects uncertain language in Claude's responses
and reminds it to investigate rather than guess,
and that refuses to let a turn end while work remains.

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

**Per-detector gating**:
 the response-quality detectors (hedging,
 dismissal,
 trailing question) run only when `stop_hook_active` is false,
 so a forced continuation is never re-blocked
for wording Claude was already told about.

## Forced continuation

Separately from the response-quality detectors,
 the hook blocks every stop unconditionally.
This exists because Claude routinely ends a turn by announcing its next action
instead of performing it,
 leaving the user to type `Continue.`
Measured across this repository's transcripts,
 a forced continuation issues a tool call 91% of the time,
 a state-changing call 88% of the time,
 and runs a median of nine tool calls.

This detector reads none of the response text.
That is the point:
 every text-conditioned rule can be satisfied by changing the text,
 and a rule keyed on the phrase `Next:` is satisfied by deleting that sentence,
 which turns an informative stop into a silent one.

A trailing question takes precedence,
 because instructing Claude to resume work
and to route its question through `AskUserQuestion`
in the same reason would be contradictory.

**Termination** comes from Claude Code,
 not from this hook.
Measured on two disposable sessions against Claude Code 2.1.220,
 a hook that blocks unconditionally is dispatched nine times,
 after which the CLI ends the turn regardless of the ninth block.
`stop_hook_active` is false on the first dispatch and true on every one after,
 never clearing,
 so honoring it caps forced continuation at one.

**Kill switch**:
 set `MONOCHROMATIC_STOP_AUTO_CONTINUE` to `off`,
 `0`,
 `false`,
 or `no` to disable forced continuation
without editing settings or code.
The response-quality detectors keep working.

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

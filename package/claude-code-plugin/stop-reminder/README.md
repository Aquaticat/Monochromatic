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
 blocking a stop puts the agent back to work most of the time,
 with a median of nine tool calls per forced continuation.
The rate depends on what did the blocking,
 and the conservative figure is the right one to plan against:
 text-detector blocks issued a tool call 88% of the time
and a state-changing call 84% of the time,
 falling to 82% and 82% on Opus 5,
 where 27% still needed a human nudge afterwards.
Goal-condition blocks scored 100% on every metric,
 which is why pooling the two overstates the case.

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
 not from this hook,
 which counts nothing.
Measured on three disposable sessions against Claude Code 2.1.220,
 the CLI ended the chain on its own every time,
 but not at a fixed count:
 two runs of a minimal always-blocking hook ended after nine dispatches,
 and a run of this handler ended after seventeen.
Termination is reliable;
 the bound is not a constant,
 and the rule governing it is not established.

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

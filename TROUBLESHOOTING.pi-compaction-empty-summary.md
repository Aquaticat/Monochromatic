# pi compaction empty summary

**Date**: 2026-04-28
**pi version**: 0.70.6
**Upstream source**: [mariozechner/pi-coding-agent](https://github.com/mariozechner/pi-coding-agent), `src/core/compaction/compaction.ts`

## Problem

Running `/compact` on a small session (or auto-compaction triggering when
the entire conversation fits within `keepRecentTokens`) produces a
blank summary with "(none)" in every section:

```
[compaction]

Compacted from 10,857 tokens

 Goal

 (none - no conversation provided)

 Constraints & Preferences

 - (none)

 Progress

 ### Done

 - (none)

 ...
```

The compaction entry is written to the session file with `fromHook: false`
and empty `details` (`readFiles: [], modifiedFiles: []`), polluting the
session with a useless compaction record.

Morph Compact extensions also fail silently in this scenario because
`messagesToSummarize` is empty, causing the extension to fall through
to pi's default summarizer.

## Minimal reproduction

```bash
# Start a fresh pi session with a large system prompt (AGENTS.md, etc.)
pi
# Exchange a single message
> Hello?
< Hey there!

# Manually trigger compaction
/compact

# Result: blank "(none)" summary
```

Auto-compaction also triggers this when `contextTokens > contextWindow - reserveTokens`
but the entire session fits within `keepRecentTokens` (20K). This can happen
with models that have small context windows, or sessions where system-prompt
tokens dominate but conversation tokens are minimal.

## Root cause

Two bugs in pi's compaction pipeline:

### Bug 1: `prepareCompaction` returns a preparation with empty `messagesToSummarize`

**Source**: `src/core/compaction/compaction.ts`, `prepareCompaction()` function

When the total session tokens are below `keepRecentTokens` (default 20,000),
`findCutPoint()` sets `firstKeptEntryIndex` to 0 (keep everything from the
beginning). This makes `historyEnd` equal to `firstKeptEntryIndex` (0), so the
loop that populates `messagesToSummarize` never executes:

```typescript
// src/core/compaction/compaction.ts, prepareCompaction()
const historyEnd = cutPoint.isSplitTurn
  ? cutPoint.turnStartIndex
  : cutPoint.firstKeptEntryIndex;

// This loop never executes when historyEnd === boundaryStart === 0
const messagesToSummarize: AgentMessage[] = [];
for (let i = boundaryStart; i < historyEnd; i++) {
  const msg = getMessageFromEntryForCompaction(pathEntries[i],);
  if (msg)
    messagesToSummarize.push(msg,);
}
```

`prepareCompaction` returns a valid `CompactionPreparation` object with
`messagesToSummarize: []` and `tokensBefore > 0`. The caller in
`agent-session.ts` does not check whether `messagesToSummarize` is empty
before proceeding with compaction.

Compare with the early-return guard in `agent-session.ts` line 1256:

```typescript
const preparation = prepareCompaction(pathEntries, settings,);
if (!preparation) {
  // Check why we can't compact
  const lastEntry = pathEntries[pathEntries.length - 1];
  if (lastEntry?.type === 'compaction')
    throw new Error('Already compacted',);
  throw new Error('Nothing to compact (session too small)',);
}
```

This guard catches `undefined` but not a preparation with empty messages.

### Bug 2: `compact()` calls `generateSummary([])` without an empty guard

**Source**: `src/core/compaction/compaction.ts`, `compact()` function, line 574

When `messagesToSummarize` is empty and the compaction is not a split turn,
`compact()` unconditionally calls `generateSummary(messagesToSummarize, ...)`
with an empty array. The summarizer serializes an empty conversation
(`<conversation>\n\n</conversation>`) and asks the LLM to summarize it,
producing the "(none)" template.

Notably, the split-turn branch already has a guard for this exact case:

```typescript
// Line 565 — split-turn branch has a guard:
messagesToSummarize.length > 0
    ? generateSummary(messagesToSummarize, ...)
    : Promise.resolve("No prior history."),

// Line 574 — non-split branch has NO guard:
summary = await generateSummary(messagesToSummarize, ...);
```

The non-split path should have the same `"No prior history."` fallback,
or better yet, compaction should not proceed at all when there is nothing
to summarize.

## What does not work

- Returning `undefined` from a `session_before_compact` extension handler
  falls through to pi's default summarizer, which hits the same bug.
- Setting `compressionRatio` to any value in Morph Compact does not help —
  the issue is that `messagesToSummarize` is empty before Morph is ever called.

## Verified workaround

The Morph Compact extension (`packages/pi/morph-compact/`) now returns
`{ cancel: true }` from its `session_before_compact` handler when
`messagesToSummarize` is empty and no `previousSummary` exists. This
prevents pi from creating a useless compaction entry:

```typescript
// packages/pi/morph-compact/src/index.ts
const hasMessages = messagesToSummarize.length > 0
  || turnPrefixMessages.length > 0;
if (!hasMessages && previousSummary === undefined) {
  ctx.ui.notify(
    'Morph Compact: nothing to compact — session too small',
    'warning',
  );
  return { cancel: true, };
}
```

For manual `/compact`, pi throws "Compaction cancelled". For
auto-compaction, pi silently skips the compaction cycle. Both are
correct behaviors when there is nothing meaningful to compact.

Without the Morph Compact extension, the workaround is to avoid
running `/compact` on sessions that are too small to compact.

## Suggested upstream fix

`prepareCompaction` should return `undefined` when `messagesToSummarize`
is empty and `turnPrefixMessages` is empty and no `previousSummary`
exists, matching the caller's expectation that `undefined` means
"nothing to compact":

```typescript
// At the end of prepareCompaction(), before the return:
if (messagesToSummarize.length === 0
  && turnPrefixMessages.length === 0
  && !previousSummary)
{
  return undefined;
}
```

Alternatively, `compact()` should guard against empty
`messagesToSummarize` in the non-split-turn path, mirroring the
split-turn guard:

```typescript
// In compact(), the non-split else branch:
else {
    summary = messagesToSummarize.length > 0 || previousSummary
        ? await generateSummary(messagesToSummarize, ...)
        : "No prior history.";
}
```

---

## Draft GitHub issue

**Title**: Compaction produces empty "(none)" summary when session fits within keepRecentTokens

**Labels**: bug, compaction

**Description**:

### Reproduction

1. Start a fresh pi session
2. Exchange a single message (e.g. "Hello?" / "Hey there!")
3. Run `/compact`

### Expected behavior

Compaction should either refuse ("Nothing to compact") or produce a
meaningful summary.

### Actual behavior

Compaction writes a blank entry with "(none)" in every section:

```
## Goal
(none - no conversation provided)
## Constraints & Preferences
- (none)
...
```

### Root cause

1. `prepareCompaction()` returns a `CompactionPreparation` with
   `messagesToSummarize: []` when the entire session fits within
   `keepRecentTokens` (20K). The caller in `agent-session.ts` only
   checks for `undefined`, not empty messages.

2. `compact()` calls `generateSummary([])` without checking whether
   `messagesToSummarize` is empty. The split-turn branch already has
   this guard (returns `"No prior history."`), but the non-split
   branch does not.

### Suggested fix

Option A: `prepareCompaction` returns `undefined` when
`messagesToSummarize` is empty and no `previousSummary` exists.

Option B: `compact()` guards the non-split-turn branch with the same
`messagesToSummarize.length > 0` check used in the split-turn branch.

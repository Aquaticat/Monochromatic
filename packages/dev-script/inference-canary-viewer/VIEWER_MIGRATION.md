# Viewer migration: artifacts as source of truth

The inference-canary runner no longer writes `canary-history.jsonl` or exports `HISTORY_PATH`.
All run data is now persisted as enriched artifacts in `src/canary-lint/`.
The viewer must be updated to derive its data from artifacts instead of the JSONL file.

## What changed in inference-canary

- **Deleted**: `history-io.ts` (JSONL read/write), `HISTORY_PATH` from `paths.ts`
- **Kept**: `history-types.ts` (HistoryEntry, HistoryFile, ModelThreshold, OpenRouterModelId), `history-stats.ts` (computeThreshold, etc.)
- **Runner no longer**: reads history, appends history, computes degradation thresholds, or reports degradation
- **Runner now writes**: enriched `meta.json` + `response.txt` per probe per pass, plus `failure-<timestamp>/meta.json` for whole-model failures

## Enriched artifact format

Every `meta.json` now has this shape (type: `EnrichedArtifactMeta` from `linter-artifacts.ts`):

```json
{
  "model": "anthropic/claude-sonnet-4.6",
  "probe": "csv-rfc4180",
  "pass": "initial",
  "timestamp": "2026-03-06T12:00:00.000Z",
  "score": 0.85,
  "reasoning": "Let me think about this...",
  "timing": {
    "timeToFirstChunkMs": 1234,
    "interChunkMs": [50, 60],
    "totalMs": 15000,
    "chunkCount": 200
  },
  "usage": {
    "promptTokens": 500,
    "completionTokens": 2000,
    "reasoningTokens": 1500,
    "totalTokens": 2500
  },
  "finishReason": "stop",
  "config": {
    "verbosity": "low",
    "reasoning": true,
    "maxTokens": 128000,
    "consistencyRuns": 2
  }
}
```

Fix-pass artifacts also have `"fixPrompt": "..."`.
Failed/partial artifacts have `"partial": true` and/or `"error": "..."`.
Whole-model failures: `canary-lint/<model-slug>/failure-<timestamp>/meta.json` with `"failed": true`.

Alongside each `meta.json`, `response.txt` contains the raw model output.

## What the viewer needs to do

1. **Stop reading `canary-history.jsonl`**: delete `src/data/read-history.ts` and its `HISTORY_PATH` import
2. **Build HistoryEntry from artifacts**: modify `readArtifacts()` (or add a new function) to:
   - Read each `meta.json` as `EnrichedArtifactMeta` (falling back to `ArtifactMeta` for old artifacts without enrichment)
   - Group initial-pass artifacts by `(model, timestamp)` to form runs
   - Compute `overallScore` as the mean of per-probe `score` fields
   - Build `probeScores` from individual artifact scores
   - Build `pass2Scores` from fix-pass artifact scores
   - Populate `timing`, `usage`, `config` from the enriched fields
   - Return `HistoryFile` (array of `HistoryEntry`) for the existing chart/view code
3. **Move degradation detection here**: the runner no longer computes `degradationLikely`. The viewer already imports `computeThreshold` from `history-stats.ts` -- use it to flag degradation when rendering
4. **Display new data in overlays**: the detail overlay can now show:
   - Reasoning/thinking traces (from `reasoning` field)
   - Token usage breakdown
   - Timing (time-to-first-chunk, total)
   - Finish reason
   - Fix prompt text (for fix-pass overlays)
   - Config snapshot
   - Partial/error flags for failed runs

## Backward compatibility

Old artifacts (pre-enrichment) have basic `ArtifactMeta` with only `model`, `probe`, `pass`, `timestamp`.
They won't have `score`, `reasoning`, `timing`, etc.
The viewer should handle missing fields gracefully (e.g. show "N/A" for score, skip reasoning section).

## Types to import

From `@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts`:
- `ArtifactMeta`, `EnrichedArtifactMeta`, `FailureArtifactMeta`, `LINT_DIR`, `artifactDir`

From `@monochromatic-dev/dev-script-inference-canary/src/history-types.ts` (still exists):
- `HistoryEntry`, `HistoryFile`, `ModelThreshold`, `OpenRouterModelId`

From `@monochromatic-dev/dev-script-inference-canary/src/history-stats.ts` (still exists):
- `computeThreshold`

From `@monochromatic-dev/dev-script-inference-canary/src/runner-types.ts`:
- `StreamTiming`, `StreamUsage`, `ConfigSnapshot`

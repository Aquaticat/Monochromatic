# Viewer migration: artifacts as source of truth

The inference-canary runner no longer writes `canary-history.jsonl` or maintains any history files.
All run data is now persisted as enriched artifacts in `src/canary-lint/`.
The viewer must be updated to derive its data entirely from artifacts.

## What changed in inference-canary

- **Deleted**: `history-io.ts`, `history-types.ts`, `history-stats.ts`, `history.ts`, `HISTORY_PATH`
- **Moved**: `ISOTimestamp` and `OpenRouterModelId` now live in `runner-types.ts`
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
2. **Define your own data model**: the old `HistoryEntry`, `HistoryFile`, `ModelThreshold` types no longer exist in the runner package. Define viewer-local types that match the artifact-based data, or work directly with `EnrichedArtifactMeta`
3. **Build run data from artifacts**: modify `readArtifacts()` (or add a new function) to:
   - Read each `meta.json` as `EnrichedArtifactMeta` (falling back to `ArtifactMeta` for old artifacts without enrichment)
   - Group initial-pass artifacts by `(model, timestamp)` to form runs
   - Compute `overallScore` as the mean of per-probe `score` fields
   - Build per-probe scores from individual artifact scores
   - Build pass-2 scores from fix-pass artifact scores
   - Populate `timing`, `usage`, `config` from the enriched fields
4. **Implement degradation detection locally**: the runner no longer computes `degradationLikely` and `computeThreshold` has been deleted. Reimplement the statistical logic (mean - 2*stddev, floored at 0.3, min 3 samples) in the viewer if degradation flagging is desired
5. **Display new data in overlays**: the detail overlay can now show:
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

From `@monochromatic-dev/dev-script-inference-canary/src/runner-types.ts`:
- `ISOTimestamp`, `OpenRouterModelId`, `StreamTiming`, `StreamUsage`, `ConfigSnapshot`

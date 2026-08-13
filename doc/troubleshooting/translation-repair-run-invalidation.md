# What invalidates a corpus run, and what silently does not

Investigated 2026-08-13, after a night of landing pipeline fixes while a pass
 was running.

## A running pass cannot see a rebuild

`corpus-pass.ts` has no dynamic imports, so Node loads its whole module graph
 once at process start.
Rebuilding `dist/final/node/index.mjs` while a pass runs therefore changes
 nothing for that pass: it executes the pipeline as of the moment it started,
 to completion.

This is good news and bad news in equal measure.
A pass is internally CONSISTENT no matter how much the repository moves under
 it, so its artifacts are always one coherent population.
It is also silently STALE, and nothing in its logs or artifacts says which
 pipeline it is running beyond the `tip` commit recorded per artifact.

Check it directly rather than assuming a rebuild took effect:

```bash
# no dynamic imports means the graph is frozen at startup
rg --count 'await import|import\(' src/corpus-run/corpus-pass.ts
stat --format='%y' dist/final/node/index.mjs   # compare against process start
```

## The slice cache has two guards and a hole between them

A cached slice is keyed on `SLICE_CACHE_VERSION`, a `runShape` fold, the slice
 index, and both texts.
The two guards are documented and deliberate:

-   `SLICE_CACHE_VERSION` is bumped by hand when `ChunkRepairOutcome` changes
    shape or an existing field changes meaning.
-   `runShape` covers everything that changes what the models are ASKED:
    rosters, adjudication config, editor addendum, identity context.

Neither covers a change to what the code DOES with the answers.
A gate is exactly that.
The footnote-integrity gate added on 2026-08-13 left the prompts, the roster
 and the texts identical, so both guards matched, while a candidate the old
 gate shipped may be one the new gate refuses.
A slice cached before it could be resumed after it, and nothing would look
 wrong.

The bump was missed on the very commit that added the gate, which is the useful
 part of this record: the convention depends entirely on the author noticing,
 and it failed the first time it was tested. `SLICE_CACHE_VERSION` now carries
 that case by name so the next gate change has a precedent to recognise itself
 in.

An automatic key over the hash of `src/` was considered and not built.
It would invalidate on comment and test changes too, and a pass takes days, so
 the cost of a spurious full recompute is high and the discipline is cheap
 where it is remembered.

## Passes at this pin

-   `pass10`, started 01:55 UTC, stopped 04:29 UTC with 3 settled entries.
    Ran the pipeline as of 01:55 throughout: the invisible-line masker was in,
    the CRLF front-matter fix, the footnote-graph fix and the footnote gate
    were not. Artifacts kept under
    `node_modules/.monochromatic/translation-repair-runs-pass10`, and they are
    a consistent old-pipeline population rather than a mixed one.
-   `pass11`, started 04:27 UTC into
    `node_modules/.monochromatic/translation-repair-runs-pass11`, running every
    fix landed that night.

Restarting rather than continuing follows the standing instruction to land
 certainly-good pipeline changes immediately and restart runs as needed.
The new pass was confirmed authenticating and doing real work BEFORE the old
 one was stopped, so no window existed with nothing running.

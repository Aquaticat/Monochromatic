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
-   `pass11`, started 04:27 UTC, stopped 04:36 UTC with nothing settled.
    Superseded before it had produced anything, by the typography fix.
-   `pass12`, started 04:35 UTC, stopped 05:14 UTC with nothing settled and six
    slices cached. Ran cache version 7: the typography fix landed 04:34, one
    minute before it started, so it carried that and nothing later.
-   `pass13`, started 05:12 UTC into
    `node_modules/.monochromatic/translation-repair-runs-pass13`, running cache
    version 9, so it carries the naturalness-eligibility fix `pass12` lacked
    plus the quote-anchoring telemetry.

Two restarts in ten minutes is cheap and a third would not be: a restart costs
 whatever the current pass has settled, so its price rises with every hour.
Batching is the reason `pass12` waited for a check that the other settled
 policies, translator additions and declared names, had actually reached the
 prompts. They had, so it started with nothing else pending.

`pass12` was NOT restarted for the naturalness-eligibility fix landed after it
 (cache version 8), and the asymmetry was deliberate rather than fatigue.
The typography fix touched every repaired region of every entry, 99 curly
 characters lost corpus-wide; the eligibility fix touches only slices holding an
 invisible-only line, which is 3 lines in `Toka_ls` and nowhere else.
So `pass12` would have refined `Toka_ls` on fewer slices than the current code,
 and nothing else differed. Restarting was worth doing but not urgent.

The quote-anchoring telemetry then made it worth doing at once, on a different
 argument: that telemetry is measurable ONLY on a pass that runs it, so leaving
 `pass12` alone would have spent days of provider capacity producing a
 population that cannot answer the question the suffix exists to answer.
`pass12` was two hours from having settled anything, which is the cheapest a
 restart ever gets, and the cost only rises from here.

Restarting rather than continuing follows the standing instruction to land
 certainly-good pipeline changes immediately and restart runs as needed.
The ordering held every time: `pass13` was confirmed streaming completions,
 applying an editor patch and hearing 3 of 3 checkers BEFORE `pass12` was
 signalled, so no window existed with nothing running.

## First artifact under the new code, and what it does and does not show

`pass13` settled `AmbeR_the_anpa` first, and the same entry exists in the
 56-entry population, so the two can be put side by side. They are NOT a
 controlled comparison: the runs differ by many commits, not only by the
 night's, and this is one entry.

```text
                     pass13      old run
  status             repaired    repaired
  duration           27 min      79 min
  issues filed       36          53
  accepted           19          35
  rejected            6          13
  needs-human        11           5
  findings           39          42
```

What it rules out is useful even at one entry. The finding profile is nearly
 identical, kind for kind: same `quote-not-found` count, same
 `refine-candidates`, `refine-selected` and `refine-declined` counts, same
 editor-stage counts within one. If the night's stricter gates were refusing
 patches in bulk, the editor and refine findings would move and they did not.

The difference sits UPSTREAM of any patch gate. Fewer claims were filed and a
 larger share of them landed on `needs-human`, 31% against 9%. That is critic
 and adjudication behaviour, which the footnote-integrity gate and the
 typography change do not touch.

Worth watching rather than acting on. If the `needs-human` share stays near a
 third as `pass13` accumulates, the composition of any sheet drawn from it
 differs from the sheets drawn so far, and that matters for comparing precision
 figures across passes.

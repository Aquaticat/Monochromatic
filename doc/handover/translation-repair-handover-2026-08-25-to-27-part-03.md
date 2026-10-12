# Translation repair handover snapshots: 2026-08-25 to 2026-08-27, part 03

Part 03 of [Translation repair handover snapshots: 2026-08-25 to 2026-08-27](translation-repair-handover-2026-08-25-to-27.md),
whose index lists every part in order.

## Landing sequence for the parked work, verified ready (2026-08-25)

Everything below is blocked on the calibration exiting and nothing else.
The archive was verified on 2026-08-25 and applies cleanly:
`gzip --test` passes,
it holds 33 repo-relative paths,
HEAD descends from its base `f800f1352`,
every commit between that base and HEAD is documentation only,
and NONE of the 33 files changed in that range.
So untarring over the repo root reverts nothing and clobbers no concurrent work.

### Order, and why this order

CORRECTED 2026-08-25:
step 1 used to read the pid file,
which holds the wrong process.
`doc/runbook/translation-repair-corpus-pass.md` carries the reasoning and the controls.

```sh
# 1. Confirm the run is actually gone, rather than merely quiet.
#    NOT the pid file: it holds the launching bash wrapper, and the work runs
#    two levels below it. Measured live: bash 3038649 at 2792 KB, mise 3038654,
#    node 3038820 at 126340 KB doing the work. Ask what is running instead.
running() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    mapfile -d '' -t argv < "$d/cmdline" 2>/dev/null || continue
    [ "${#argv[@]}" -gt 0 ] || continue
    [ "$(basename -- "${argv[0]}")" = node ] || continue
    for a in "${argv[@]:1}"; do
      [ "$(basename -- "$a")" = "$1" ] && echo "alive pid=${d#/proc/}"
    done
  done
}
running editor-calibrate.mjs   # silence means gone

# 2. Read the standing FIRST, while the tree still matches the build that
#    produced it. This answers `#200`, and nothing else here can change it.
node ~/temp/agent/standing-from-log.mjs \
  ~/temp/agent/editor-calibrate-fullroster-20260825.log

# 3. Land the parked work. 16 new files, 17 modified, 0 identical.
tar --extract --file ~/temp/agent/spend-telemetry-210.tar.gz \
  --directory /var/home/user/worktrees/translation-repair

# 4. Build BEFORE any test: the suite imports from `dist/`, so a test run
#    against a stale bundle measures the old code and passes.
mise run //package/module/translation-repair:build

# 5. Then lint, types, tests.
mise run //package/module/translation-repair:lint
mise run //package/module/translation-repair:lint:types
mise run //package/module/translation-repair:test:unit
```

### The commit, and the trap in it

`CPN`:
a pathspec commit omits any file it does not name,
and this lands SIXTEEN
new files.
Naming only the modified ones would commit a tree whose imports do not
resolve at that commit while the working tree still builds,
which is invisible
until somebody checks out that commit.

Verify with `git status --short` afterwards that nothing is left untracked.

New files,
all of which must appear in the pathspec:

    package/module/translation-repair/src/candidate-ledger.ts
    package/module/translation-repair/src/candidate-ledger.unit.test.ts
    package/module/translation-repair/src/candidate-select-record.ts
    package/module/translation-repair/src/corpus-run/hyper-price.ts
    package/module/translation-repair/src/corpus-run/hyper-price.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-parse.ts
    package/module/translation-repair/src/corpus-run/ledger-read.ts
    package/module/translation-repair/src/corpus-run/ledger-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-report.ts
    package/module/translation-repair/src/corpus-run/spend-cost.ts
    package/module/translation-repair/src/corpus-run/spend-cost.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-read.ts
    package/module/translation-repair/src/corpus-run/spend-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-report.ts
    package/module/translation-repair/src/spend-line.ts
    package/module/translation-repair/src/spend-line.unit.test.ts

Modified files:

    package/module/translation-repair/mise.toml
    package/module/translation-repair/rolldown.node.config.ts
    package/module/translation-repair/src/anthropic-delta-scan.ts
    package/module/translation-repair/src/anthropic-delta-scan.unit.test.ts
    package/module/translation-repair/src/ballot-barrel.ts
    package/module/translation-repair/src/candidate-select.ts
    package/module/translation-repair/src/corpus-run/sentinel-probe.ts
    package/module/translation-repair/src/editor-ensemble.ts
    package/module/translation-repair/src/hyper-client.ts
    package/module/translation-repair/src/judge-fidelity.ts
    package/module/translation-repair/src/pipeline-barrel.ts
    package/module/translation-repair/src/provider-barrel.ts
    package/module/translation-repair/src/refine-stage.ts
    package/module/translation-repair/src/stream-idle-guard.ts
    package/module/translation-repair/src/stream-idle-guard.unit.test.ts
    package/module/translation-repair/src/synthetic-client.ts
    package/module/translation-repair/src/translate-judge.ts

### The three measurements owed immediately after, before anything else is built

Each one is a prediction already on record,
and each is falsifiable.
Take them on
the first post-fix run rather than reasoning about them.

-   `qwen3.8-max` cut rate.
    Pre-fix baseline 21 of 119,
    17.6 percent,
    stable
    against an earlier 12 of 71.
    `#211` predicts NOT that this falls but that
    each cut costs a fraction of the time and bytes,
    because `contentCap` can
    finally see the model.
    Record whichever happens.
-   `deepseek-v4-pro-0813` zero-content count.
    Pre-fix 12 of 127.
    Twelve to zero
    means it is the same mechanism as `qwen3.8-max`;
    twelve holding means
    `text_delta` inside a thinking block,
    which `#211` deliberately does not
    exempt,
    and that opens its own task.
-   `qwen3.8-max` content characters at p50 and p95.
    Pre-fix both are 0.
    Any
    nonzero value confirms the routing fix at the user boundary rather than in a
    unit test.

## The run will finish, and budget is not what would stop it (2026-08-25)

Measured at 4h21m into the full-roster calibration,
off its own 115 `METERS` readings,
read with `node dist/final/node/meter-report.mjs` directly
rather than through the task,
which would have rebuilt `dist` underneath it.

Both providers answered every reading:
`synthetic wet=115 dry=0 unreadable=0`,
`hyper wet=115 dry=0 unreadable=0`,
so this run has had no outage at all and its numbers carry no availability caveat.

Runway against work left,
which is the only question that mattered:

-   Hyper drained 205 of 10000 in 4.39h,
    so 46.7 per hour,
    leaving 210 hours of runway.
-   Synthetic drained 5.183pp gross in the same window,
    so 1.18pp per hour,
    leaving 79 hours.
-   Seventeen of forty slices are done,
    and the remaining twenty three come to
    6.0 hours at the whole-run mean gap of 943s,
    7.3 hours at the slower last-half mean of 1150s,
    and 12.9 hours if every remaining slice were as slow as the slowest one yet seen at 2017s.

Even the pessimistic arm finishes with an order of magnitude of budget to spare.
Nothing here needs the account owner to top up or reset anything.

### The weekly allowance refilled mid-run, and endpoint arithmetic is 62% wrong

`syntheticWeekly` ROSE once in 115 steps,
from 95.594% to 97.577% at 2026-08-25T03:03:24.086Z,
a jump of 1.982pp.
The subscription window rolls,
so an allowance is not a monotone drain.

That breaks the obvious way to price a run.
Net endpoint change reads 3.200pp,
gross drain summed over the downward steps alone reads 5.183pp,
so subtracting the endpoints understates what was actually spent by 62%.

THE SAME DETECTOR FOUND ZERO RISES IN `hyperBalance`,
0 of 115 steps,
which is what a prepaid balance should do and is what makes the synthetic
result meaningful rather than an untested instrument.

`meter-report` prints `level first` and `level last`,
which are exactly the two numbers a reader will subtract.
It does not claim they are spend,
and its own job is duty cycle and outages,
but nothing warns that the difference is not the cost.
`#210`'s token-priced spend line is the right instrument for cost
and this is one more reason it is:
meter deltas cannot answer the question at all.

### Slice lines carry no timestamp, which is more of `#215`

Sixteen of the seventeen slice gaps here were recovered by carrying the most
recent `METERS` timestamp forward through the log,
because `slice N of 40` lines have no timestamp of their own.
`#215` is recorded as a run being unable to say where its wall-clock went
for want of a duration on the completion line.
It is worse than that:
the per-slice progress lines cannot be placed on a clock
at all except by leaning on an unrelated line that happens to be timestamped.
Whatever `#215` adds should cover the progress lines too.

## Corpus text in commits: what the owner decided, and the rule (2026-08-25)

Raised because a sweep found corpus text committed to a PUBLIC repository,
and the working rule carried across sessions said it should never be there.
`doc/audit/corpus-text-reached-a-public-repository.md` has the measurements.
The short version:
fifteen documents under `doc/` carry 185 lines of Chinese
source text,
plus English memorial sentences that a script-keyed scan cannot see,
on `origin/translation-repair-rebased`,
none of it on `origin/main`,
publicly readable since 2026-08-20.

THE OWNER DECIDED NOTHING IS REMOVED.
Exposing corpus text is sometimes fine,
because the owner is friends with the
people who run the site the corpus comes from.
So no file changes,
no history is rewritten,
nothing is force-pushed,
and the repository stays public.
A session that rediscovers this must not reopen it,
must not offer to scrub it,
and must not treat it as an incident.
The relationship that makes it fine is not visible from inside the repository,
which is why it is written here.

### The rule going forward

The instruction attached to that decision was to take extra care not to expose
more in commits later.
Permission is not indifference,
and it is not retroactive cover for adding more
without thinking.

-   Corpus text enters a commit only when it carries evidence nothing else can carry,
    and only as much of it as the evidence needs.
    Where a rendering changed a tense,
    or an aligner paired the wrong headings,
    the wording IS the finding and quoting it is right.
    Where the point is a count,
    a rate,
    a slice index or a model's behaviour,
    it is not,
    and the id and index say it better.

-   Never quote because quoting was easier than naming.
    That is the failure mode that produced 185 lines:
    each one was individually defensible and nobody was counting.

-   A document ABOUT the exposure quotes nothing.
    Naming files and counts is the whole discipline,
    so an audit that reprints the evidence repeats the fault it records.

-   Everything else about handling the corpus is unchanged.
    It is read at runtime from the pinned clone by `git show <sha>:<path>`,
    corpus files are never committed,
    and artifacts and grading sheets stay under run directories outside the repository.

### Why this is not an `AGENTS.md` rule

Proposed there and declined by the owner as too narrow to be worth a repo-wide
shortcode:
it is a rule about one corpus,
in one package,
under one relationship.
It belongs where the people working on that package will read it.

## Corpus exposure is not a blocker, and sanitization is the last step (2026-08-25)

Supersedes the caution in the corpus-exposure sections of this handover.
The owner set the plan after `#456` was measured:

-   COMMIT THE CORPUS HOWEVER IS CONVENIENT.
    Do not spend effort avoiding corpus text in commits,
    do not shrink a quote to dodge exposure,
    and do not treat a corpus-bearing diff as something to route around.
    Nothing about corpus text blocks any commit on this branch.

-   SANITIZATION HAPPENS ONCE,
    AT THE END.
    When the pipeline is production ready,
    tell the owner with the `AskUserQuestion` tool rather than in ordinary prose,
    because that is the signal they are waiting for.
    They will disable branch protection temporarily,
    and the corpus content committed along the way gets sanitized then.

-   THE DENY-LIST IS BUILT AND NOT INSTALLED.
    `doc/decision/corpus-deny-list-for-forbidden-strings.md` has the design and the evidence.
    Installing 10206 literal rules today would cost about two minutes of rule compilation
    on every single commit,
    because the scanner recompiles the runtime rules file per scan.
    `#456` is the fix.
    The deny-list waits for it rather than taxing every commit,
    and it waits without cost,
    since sanitization at the end covers the same ground.

WHAT THIS DOES NOT CHANGE.
The corpus is still read at runtime from the pinned clone,
corpus files are still never committed as corpus files,
and artifacts and grading sheets still live under run directories outside the repository.
The change is that quoting inside our own documents is now unremarkable.

FOR THE SANITIZATION ITSELF (rendering-8,
2026-08-26):
the persisted runs of the settled rendering audit,
`<runs dir>/rendering-audit-settled/*.json`,
carry document spans and model prose in every row's `report`
(`locator.text`,
`focus.text` on both sides,
each voice's `reason`),
so they are corpus-bearing whatever the `textIdentity` digest beside them says;
the module notes that once claimed otherwise were corrected in `744890056`.

## Two source fixes found while the run was live, both owed (2026-08-25)

Both were found by testing documentation against reality rather than by reading code,
and both edit `src/`,
which restamps the pipeline digest and invalidates
the slice cache the calibration has been buying since 01:29Z.
So both wait for the run,
and both belong in the landing sequence
after the standing is read and the parked work is extracted.

-   `#217`:
    `verify-published` cannot tell a clean run from an empty one.
    NOW BUILT AND PARKED,
    in the section `#217` is built,
    GFP-proven and parked.
    `doc/runbook/translation-repair-corpus-pass.md` carries the workaround until it lands.

-   `#218`:
    a real Bilibili account UID sat in the TSDoc `@example` for `readingAnchors`
    in `image-reading-sense.ts`.
    NOW FIXED AND PARKED beside `#217`.
    An invented UID was rejected,
    because any ten-digit number could be somebody's real account.
    The example now reads `'posted by Mittens on 2019-04-07'`,
    which demonstrates more of what the docstring claims than the original did:
    it lists a date and a username first,
    and the old example carried only a digit run.

`#219` is not a code fix and is the easiest thing here to lose:
when the pipeline is production ready,
say so with the `AskUserQuestion` tool,
not in prose,
because that is the signal the owner is waiting for
before disabling branch protection to sanitize the committed corpus text.

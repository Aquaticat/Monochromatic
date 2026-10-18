# Wall-clock bound unit tests handover (issue 1762)

## Purpose and status

This handover records an investigation-only assessment of
[issue 1762][i1762],
which claims four default-run unit tests bound real wall-clock elapsed time
that the parallel `test:unit` runner can stretch past.

The session verified the issue against the current tree,
measured the two speed budgets in isolation,
reproduced the contention condition through the real runner,
and changed no code,
no tests,
and no tracker state.
The only artifact is this document,
committed as `docs(handover): record wall-clock bound test assessment for issue 1762`.

How to respond:
read the assessment and the remedy directions,
then pick a tracker disposition from the next actions.
Implementing fixes needs its own authorization
(the resolution workflow in `doc/agent/issue-tracker.md`).

## The framing disagreement

The issue frames the situation as correct-but-fragile tests plus an environmental stressor:
the runner spawns up to `availableParallelism()` node processes,
contention can stretch a correct run past its budget,
and the headline prescription is to quarantine the four tests as `*.expensive.*`
following the `tsc-filter` precedent.

The user's counter-framing:
the defect belongs to our own package,
module,
and test code,
meaning the test designs themselves,
and the remedy belongs inside the tests rather than in excluding them from the default run.

Assessment:
the counter-framing is correct,
with three corrections to the issue's record.

1.  The inventory is incomplete.
    The two tightest real-elapsed upper bounds in the default suite
    (`FAST_FLUSH_MS = 40` in `package/module/logger/src/create-logger.unit.test.ts`)
    are absent from the issue,
    because its line-based probe cannot see assertions whose matcher sits on the next line.
2.  The family is not homogeneous.
    Two sites replace a wall-clock surrogate with a direct observation of the property,
    two sites encode the property as a timing comparison with no timing-free alternative,
    and one is a complexity guard with roughly 176x measured slack.
    The issue's first acceptance option
    (no upper-bound wall-clock assertion in the default run)
    would ban the legitimate second kind.
3.  The flakiness is hypothetical.
    No observed failure is cited,
    and this session's repro
    (five batches at the runner's full 32-process width through the real task)
    produced zero failures.

The issue is still right about the real kernel:
the `describe` concurrency proof (79 ms margin on a 101 ms span)
and the unlisted logger fast-flush bounds (40 ms ceiling,
20 ms discrimination margin)
are genuinely load-sensitive designs,
and the issue's alternative remedy,
load-insensitive proofs,
is the correct direction for those sites.

## Verified record

### What the issue gets right

- The four cited sites exist with the cited bounds:
  `package/module/test/src/describe.unit.test.ts:58` (180 ms),
  `package/cli/wg-quicker/src/config.unit.test.ts:222` (250 ms),
  `package/cli/mvm/src/libvirt-tools.unit.test.ts:243` (30 s),
  `package/agent-harness-shared/search-fetch/src/gh-process.unit.test.ts:359` (5 s).
- The runner behavior matches:
  `mise.toml:571` bounds workers at `Math.min(availableParallelism(), files.length)`
  (the issue cites `mise.toml:564`;
  the content matches at line 571 in the current tree),
  the default glob collects 1073 `*.unit.test.ts` files,
  and `mise.toml:669` excludes `*.expensive.*` from the default run.
- Category (testing) and difficulty (easy) are plausible.

### What verification corrected

- "The rest mock the clock or bound from below" is false.
  `create-logger.unit.test.ts` measures real `performance.now()` via its `timeFlush` helper
  (line 65)
  and upper-bounds it at lines 811 and 1076 with `FAST_FLUSH_MS = 40` (line 41).
  Only three default-run files mock the clock with `useFakeTimers`:
  `package/module/logger/src/sink/file-batch.unit.test.ts`,
  `package/module/test-sandbox/src/sandbox.unit.test.ts`,
  `package/module/test/src/sinon-clock.unit.test.ts`.
  The logger assertion spans two lines
  (`expect(elapsed,)` then `.toBeLessThan(FAST_FLUSH_MS,)`),
  which is why the issue's line-based probe missed it.
- "The tightest bounds are the 250 ms parse budget and the 180 ms concurrency proof" is false.
  The tightest real-elapsed upper bound in the default suite is the logger's 40 ms.
- The `tsc-filter` precedent does not transfer.
  `package/dev-script/task-util/src/tsc-filter.expensive.unit.test.ts:52` quarantines tests
  that spawn real `tsc` (seconds-long,
  CPU-heavy)
  and records observed flakiness.
  The six sites here are millisecond-scale timer,
  parse,
  and short-lived-child tests with no observed failure on record.

### Complete inventory: seven assertions in five files

Family A,
wall-clock surrogate bounds where a load-insensitive observation of the same property exists:

- `package/module/test/src/describe.unit.test.ts:58`:
  elapsed < `MAX_SEQUENTIAL` (180 ms) around two 100 ms timer children.
  Isolated measurement:
  101 ms every run.
  The same file already proves concurrency limits without any clock
  via active/peak counters in `limits concurrency to the given value` (lines 126-155).
- `package/agent-harness-shared/search-fetch/src/gh-process.unit.test.ts:359`:
  `elapsed < LONG_SLEEP_MILLISECONDS` (5000,
  line 44) after aborting at 60 ms (line 64).
  The bound is redundant:
  on abort the runner rethrows Node's rejection carrying `code: 'ABORT_ERR'`
  (`gh-process.ts:82` and the cancellation branch at lines 233-237),
  while an unstopped child exits cleanly at 5 s and resolves the promise,
  so the test's existing `caught instanceof Error` assertion already fails
  in the world where cancellation did not stop the child.

Family B,
discriminating bounds where the elapsed comparison is itself the property:

- `package/cli/mvm/src/libvirt-tools.unit.test.ts:243`:
  spawn must return at child exit rather than wait for a stream a lingering process holds
  for 60 s;
  the 30 s bound separates the two behaviors and has roughly 29 s of slack
  over the normal sub-second return.
- `package/module/logger/src/create-logger.unit.test.ts:811` and `:1076`:
  a second flush must not wait out the 60 ms deadline
  (`SHORT_DEADLINE_MS`,
  line 29)
  again;
  the 40 ms bound sits between immediate return and re-waited deadline.
  Discrimination margin is 20 ms and load margin is 40 ms:
  the tightest real-elapsed bound in the default suite,
  and unlisted by the issue.

Family C,
complexity guard:

- `package/cli/wg-quicker/src/config.unit.test.ts:222`:
  250 ms budget for parsing 4000 `AllowedIPs` prefixes,
  named `parses a very large AllowedIPs value without quadratic slowdown`.
  Measured in isolation:
  median 0.03 ms,
  worst 1.42 ms over 25 runs,
  so the bound carries roughly 176x slack against the worst observed run.
  A quadratic regression would take seconds and trip it reliably.

### Measurements

Isolated runs on this 32-core machine,
otherwise idle:

- wg-quicker parse,
  importing `package/cli/wg-quicker/dist/final/node/config.mjs`,
  25 iterations:
  min 0.01 ms,
  median 0.03 ms,
  p95 0.19 ms,
  max 1.42 ms against the 250 ms bound.
- describe concurrency proof,
  seven full-file runs of `node src/describe.unit.test.ts` from `package/module/test`:
  the inner `[concurrent-suite] [PASS] child-a, child-b` span measured 101 ms in every run
  against the 180 ms bound.

Contention repro through the real runner:

- Five iterations of `mise run test:unit -- <32 files>`,
  where the batch is the five files holding the seven assertions
  plus 27 stride-sampled files from the 1073-file default glob,
  reaching the runner's full 32-process width.
- All five iterations exited 0 with no failed-file list and no assertion failures.
- Zero failures in five trials is weak evidence of absence.
  A full-suite run sustains contention far longer than one 32-file batch,
  and a CI machine with fewer cores has a different contention profile.

## Remedy directions

Ordered by load sensitivity:

1.  `describe.unit.test.ts`:
    replace the elapsed bound with the peak-counter observation the same file already uses
    (active/peak incremented inside each child,
    assert `peak === 2`).
    Peak 2 proves overlap directly;
    sequential dispatch cannot reach it.
    Delete the timing.
2.  `create-logger.unit.test.ts`:
    scale the deadline constants by roughly 10x
    (for example a 600 ms deadline with a 400 ms fast-flush bound and the tolerance scaled to match),
    keeping the discrimination ratio while widening the absolute margin.
    Cost:
    a fraction of a second more per deadline test.
    Alternative:
    keep 60/40 and document the slack justification.
3.  `gh-process.unit.test.ts`:
    assert the cancellation diagnostic on the caught error
    (`code === 'ABORT_ERR'`)
    and delete the elapsed bound.
    The rejection shape discriminates kill-from-cancellation from run-to-completion
    without any clock.
4.  `libvirt-tools.unit.test.ts`:
    keep the bound,
    document the discrimination relationship
    (30 s ceiling versus the 60 s lingering hold)
    in a comment,
    and derive the ceiling from the hold constant instead of a bare `30_000`.
5.  `config.unit.test.ts`:
    keep the bound and document the measured slack.
    Optional:
    convert to a ratio-scaling check;
    the precedent pattern is the `deep / shallow` ratio assertion in
    `package/module/deepmerge-ts.fuzz/src/scale-complexity.local.unit.test.ts` (S1).
    The absolute bound is already robust at 176x worst-case slack,
    so this is cosmetic.

## Rejected ideas

- Quarantining these tests as `*.expensive.*`.
  The marker means genuinely expensive tests excluded from the default run
  (`mise.toml:669`);
  these are millisecond-scale.
  Quarantining would drop the harness's only default-run concurrency proof
  and the config parser's linearity guard from the default suite,
  eroding exactly the PKG and TCV signal the issue says it protects.
- The acceptance option "no upper-bound wall-clock assertion in the default run".
  Family B bounds encode the property under test
  (returns before the 60 s hold ends;
  flushes faster than the 60 ms deadline).
  No timing-free formulation proves those,
  so the documented-slack branch of the acceptance is the only workable one for them.
- Treating the runner as the defect site.
  32 processes on 32 cores is the intended test throughput,
  not pathological oversubscription;
  the fixes belong in the tests.

## Meta finding for the review pipeline

The issue was filed by the automated repository-wide review (unit `cross-testing`)
using a line-based grep probe.
Multiline assertion chains,
where `expect(value,)` and its matcher sit on separate lines,
evade that shape.
That is how the two tightest bounds left the inventory.
A reprobing of this class needs a multiline shape such as
`rg -U 'expect\([\s\S]{0,200}?\.toBeLessThan'`.

## Open questions

- Did any of these assertions ever fail in CI or on a smaller machine?
  Nothing is cited in the issue and nothing reproduced here;
  CI logs would settle whether the false-red risk is observed or purely theoretical.
- Logger constants:
  scale up,
  or document as-is?
  Scaling costs a fraction of a second per test;
  documenting costs robustness.
- Does the review pipeline prefer a correction comment on issue 1762,
  or a corrected refiling?

## Next actions

- The user picks a tracker disposition:
  post a correction-and-reframing comment on issue 1762 (recommended),
  leave the tracker untouched with this handover as the record,
  or close and refile a corrected issue.
- If fixes get authorized later,
  implement in the remedy order:
  the describe rewrite and logger scaling first,
  since those are the load-sensitive sites.
- No source,
  test,
  or tracker mutation happened in this session.

## Evidence appendix

Key commands and outputs:

- Issue text and citations:
  `gh --repo Aquaticats/Monochromatic issue view 1762 --json number,title,body,labels`.
- Multiline elapsed-bound probe over default-run tests
  (`expect(<elapsed-like>,)...toBeLessThan` within 80 chars):
  hits at `describe.unit.test.ts:58`,
  `config.unit.test.ts:222`,
  `libvirt-tools.unit.test.ts:243`,
  `create-logger.unit.test.ts:810-811` and `:1075-1076`.
- Comparison-in-argument probe (`expect(x < Y,).toBe(true,)`):
  `gh-process.unit.test.ts:359` (real elapsed)
  and `package/ssg/aquati.cat/src/component/site-footer.unit.test.ts:137`
  (computed value,
  not real elapsed;
  the file uses no clock).
- File-level intersection of real-clock users
  (`performance.now()`,
  `Date.now()`,
  `hrtime`)
  with `toBeLessThan` users:
  exactly the five inventory files.
  `scale-complexity.local.unit.test.ts` is in the intersection but its only
  `toBeLessThan` bounds a binary-searched argument capacity,
  and its timing ratio assertion is a lower bound.
- Parse timing one-liner (node,
  built dist import,
  25 iterations):
  `{"min":"0.01","median":"0.03","p95":"0.19","max":"1.42","bound":250}`.
- Describe timing:
  seven isolated runs,
  `[concurrent-suite] [PASS] child-a, child-b (101ms)` in every run.
- Contention repro:
  five `mise run test:unit -- <32-file batch>` invocations,
  every exit code 0,
  no `test files failed:` line.
- Cancellation rethrow path:
  `gh-process.ts:233-237` rethrows the raw rejection when
  `isCancellation` matches,
  and `CANCELLATION_CODE = 'ABORT_ERR'` at line 82.

[i1762]: https://github.com/Aquaticats/Monochromatic/issues/1762

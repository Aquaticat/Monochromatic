# AGENTS.md gap proposals from the 2026-10-22 sessions

## Why

Three failure modes this session were predicted by no current rule,
or were allowed only by reading a rule against its measured practice (GAP).
Each proposal tightens an existing rule,
keeps the rule under the RLM budget,
and carries the evidence that produced it.
Nothing here edits `AGENTS.md` before the user accepts.

## Proposal 1: TP1 probes facade subpaths and runtime bindings

Spotted failure mode:
a claim that `typescript@7.1.0-beta` has no `transpileModule`
was built from the package root surface,
which is only a version stub,
while the classic API lives at the `typescript/sync` and `typescript/async`
exports-map subpaths.
The claim is retracted (user right,
agent wrong).
A second instance:
`Error.isError` narrowing trusted the installed `.d.ts` files
while `node_modules/typescript/lib` holds only facade types,
so the runtime binding needed its own probe.

Proposed wording,
replacing the current TP1 text:

```text
TP1:
 Third-party APIs and CLIs:
 read the installed type definitions before calling;
 on facade packages probe every exports-map subpath and confirm the runtime binding with `typeof`;
 on an undefined-method error,
 fetch current docs immediately;
 test the simplest invocation first.
```

Evidence:
39 words after whitespace normalization (RLM holds),
and both incidents above resolved only after a subpath probe
(`require.resolve('typescript/sync')`) and a runtime `typeof` check.

Risks:
one extra probe step per unfamiliar package;
low,
and it replaces the more expensive wrong-claim recovery.

## Proposal 2: QIV counts test-run reach

Spotted failure mode:
the module-test harness's `describe({ name, children })` is lazy,
so an unawaited suite is a silent no-op that exits 0.
This session's first teardown run "passed" while running nothing;
reach was validated only by counting suite and `[PASS]` names in the output.

Proposed wording,
replacing the current QIV text:

```text
QIV:
 Before trusting a null or count,
 validate scope,
 cache,
 harness,
 generator reach (stale cache,
 one-file lint,
 narrow fuzzer,
 wrong assertion,
 unawaited lazy suite);
 list unexercised surfaces.
 A green test run counts only when its output contains the expected suite and test names.
```

Evidence:
41 words after whitespace normalization (RLM holds);
the suite-reach check now names
`semantic bridge teardown when the native channel dies`
and its three `it` names before any green claim.

Risks:
reading test output on every green run;
cheap,
and it is the only proof the suite ran.

## Proposal 3: PP1 names the callback-API boundary bridge

Spotted failure mode:
PP1 forbids `new Promise`,
and the repository measures 183 uses across 90 files
(73 production files,
2026-10-22),
clustered at callback-API bridges where promise construction is the seam.
The letter disagrees with the practice,
so every bridge reads as a violation.

Option A (recommended),
replacing the current PP1 text:

```text
PP1:
 `async`/`await` only:
 no promise chains or `new Promise` except a callback-API boundary bridge that resolves or rejects once.
```

Option B:
keep PP1 as written and migrate bridges to `util.promisify`
where the callback shape fits,
leaving custom shapes (multi-argument and event callbacks)
as the documented exception.

Option C:
keep PP1 as written and record the 73 files as accepted debt.

Evidence and ranking:
A beats B because `promisify` cannot cover multi-argument and event callbacks,
so B still needs the exception while adding churn to 73 files;
B beats C only if the repository wants the migration churn,
since C leaves the letter and the practice disagreeing.

Risks for A:
the exception must keep its "once" bound,
or it opens a door to promise-chains built through `new Promise`;
the wording above keeps that bound.

## Dropped lead: the `.type.test.ts` convention

A candidate gap about a `TS14` `.type.test.ts` clause did not ground:
no `TS14` code exists in `AGENTS.md`,
and the convention mismatch is already recorded in
`doc/planning/module-i18n-compose.md`
("The plan's `*.type.test.ts` convention does not exist in this workspace").
Nothing to propose.

## What accepting unlocks

Acceptance of a proposal is the user's answer in the question tool.
On acceptance,
the matching `AGENTS.md` rule is edited,
`file-enforcer` is checked first (WC2),
and the edit commits as `docs(AGENTS.md)` work.
Until then the proposals stay here and in the handover queue.

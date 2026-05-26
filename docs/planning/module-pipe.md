# Plan: `@monochromatic-dev/module-pipe`

Status: not started on `main`. Two prior implementations exist on feature branches (see "Prior art"); this plan
specifies a fresh, third implementation that synthesizes the verified-best parts of both and closes the footguns
each one hit. Implement under `packages/module/pipe/`.

The package provides type-safe left-to-right function composition with four functions across two axes:

- `piped` / `pipedAsync`: eager, value-first. Take a `value` plus steps, run immediately, return the result.
- `pipe` / `pipeAsync`: deferred, point-free. Take only steps, return a reusable pipeline function.

Steps and the value travel as named keys (`fn1..fn9`) on one object, never an array or rest arguments. A classic
variadic `pipe(value, ...fns)` cannot be typed safely and is doubly banned by the workspace (`no-rest-params`,
`require-destructured-params`), and `noUncheckedIndexedAccess` would force a guard on every `fns[i]`. Arity is typed
by hand-written 1..9 overloads.

## Prior art

Both branches fork from `73a005ca` (also `main`'s base; `main` is one commit ahead at `b19739d8`), add three commits
implementing this package, and pass `lint:types`, `lint:oxlint` (460 rules, 0 errors), and all unit tests.

- `feat/module-pipe` (worktree `~/worktrees/module-pipe`), called "plain" below. Factored type helpers
  (`SyncStep`, `AsyncStep`, `NoStepsAfter1..9`), per-arity `RunArgs1..9` union, runtime overflow rejection,
  package-name test imports, broader negative type tests.
- `feat/module-pipe-opus` (worktree `~/worktrees/module-pipe-opus`), called "opus" below. Fully inlined overload
  step shapes, thin flat `RunArgs`, exported `typeChecks()` test pattern, polished README, richer `index.ts` doc.

The branches are the durable reference; the worktree directories may be cleaned up. Inspect a file from either
branch without a worktree:

```bash
# inspect prior-art files from main
git show feat/module-pipe:packages/module/pipe/src/types.ts
git show feat/module-pipe-opus:packages/module/pipe/src/run.ts
git diff feat/module-pipe feat/module-pipe-opus -- packages/module/pipe/src
```

The two were compared in depth; the synthesis below is the conclusion. Read this plan, not the branches, for what
to build; pull file bodies from the named branch and apply the deltas this plan specifies.

## File layout

```txt
# packages/module/pipe/
packages/module/pipe/
  package.json
  tsconfig.json
  mise.toml
  tsdown.browser.config.ts
  tsdown.node.config.ts
  README.md
  src/
    index.ts              # barrel + @packageDocumentation
    types.ts              # internal types (not re-exported)
    errors.ts             # PipeStepGapError + PipeStepOverflowError (not re-exported)
    run.ts                # runPipe + runPipeAsync cores (not re-exported)
    pipe.ts               # deferred sync; 1..9 overloads + impl
    pipe-async.ts         # deferred async
    piped.ts              # eager sync
    piped-async.ts        # eager async
    pipe.unit.test.ts
    pipe-async.unit.test.ts
    piped.unit.test.ts
    piped-async.unit.test.ts
```

## Per-file specification

Provenance tags name the branch to copy the body from; "delta" names what to change.

### Config files

- `package.json`: copy from either (identical but for `description`). Use opus's description. Keep the `exports`
  map exactly:

```jsonc
// packages/module/pipe/package.json (exports)
"exports": {
  ".": {
    "types": "./dist/final/neutral/index.d.mts",
    "node": "./dist/final/node/index.mjs",
    "default": "./dist/final/neutral/index.mjs"
  },
  "./ts": "./src/index.ts",
  "./ts/*": "./src/*"
}
```

- `tsconfig.json`: `{ "extends": "@monochromatic-dev/config-typescript/dom" }` only. Delta from opus: drop the
  empty `"compilerOptions": {}` block.
- `tsdown.browser.config.ts` re-exports `@monochromatic-dev/config-tsdown/.ts`; `tsdown.node.config.ts` re-exports
  `.node.ts`. `mise.toml` mirrors a sibling module package (extends `build`, `build:js[:browser|:node]`,
  `watch:*`, `lint`, `lint:oxlint`, `lint:types`, `test:unit`). Copy from either branch.

### `src/types.ts`

Synthesis: opus's flat internal args plus plain's named overload helpers.

- From plain: `SyncStep<TInput, TOutput>`, `AsyncStep<TInput, TOutput>` (the latter takes `Awaited<TInput>`),
  `CallablePipeFn`, and `NoStepsAfter1..9`. Keep `readonly fn10?: never` in every `NoStepsAfterN`, including
  `NoStepsAfter9`. See footgun 1.
- From opus: flat `PipeFn`, flat `RunArgs` (one type: `value` + required `fn1` + optional `fn2..fn9` + optional
  `l`), flat `DeferredArgs` (same minus `value`), and `RunCallableArgs` built from `CallablePipeFn`.
- Delta from plain: drop the `RunArgs1..9` and `DeferredArgs1..9` per-arity unions. The internal core only needs a
  wide callable shape; the per-arity union re-constrains what the public overloads already enforce (footgun 9 is
  about the public side, not this internal type). Add `readonly fn10?: never` to `RunCallableArgs` so the runtime
  overflow destructure stays typed.

### `src/errors.ts`

From plain: both `PipeStepGapError` (constructed from the zero-based first-gap index, reported one-based) and
`PipeStepOverflowError`. Custom error classes set `this.name`. Keep TSDoc with `@example`. Not re-exported.

### `src/run.ts`

From plain: `runPipe` and `runPipeAsync` as explicit if-chains of nested calls dispatching on the first absent
`fnN`; extracted `assertContiguousSteps` and `assertNoOverflowStep` helpers; the named `NO_STEP_GAP = -1` sentinel.
The `args as RunCallableArgs` cast carries a scoped `oxlint-disable`/`enable` with the never-to-unknown
variance-widening justification.

Delta (fixes a bug both branches have, in opposite directions; see footgun 3): validation failures
(`PipeStepGapError`, `PipeStepOverflowError`) must be logged under an accurate message distinct from step failures,
and must be logged (opus does not). Concretely: run `assertNoOverflowStep` and `assertContiguousSteps` before the
`try`, wrapped so they log `invalid pipe arguments: ...` then rethrow; reserve the `try`/`catch` `step failed: ...`
log for actual step execution. Do not let a gap or overflow be logged as `step failed` (plain's mislabel), and do
not let it be silent (opus's gap path).

`runPipeAsync`: await the initial value first, await every intermediate, and `return await` the final step (not a
bare `return` of the promise). See footguns 4 and 5.

### `src/pipe.ts`, `pipe-async.ts`, `piped.ts`, `piped-async.ts`

From plain: 1..9 overloads written with `SyncStep`/`AsyncStep` plus `& NoStepsAfterN`, not opus's inlined four-line
step shapes (footgun 11). The implementation signature takes `DeferredArgs` (deferred) or includes `value` (eager)
and delegates to `runPipe`/`runPipeAsync`.

Deferred forms (`pipe`, `pipeAsync`): the returned pipeline tags the logger at call time, inside the returned
function, not once at definition time. The eager-equals-deferred identity must hold:
`pipe(steps)(value) === piped({ value, ...steps })`.

### `src/index.ts`

Barrel re-exporting only `pipe`, `pipeAsync`, `piped`, `pipedAsync`. From opus: the `@packageDocumentation` block
explaining the two axes, why named keys, and the eager/deferred identity, with one `@example` per function.

### Test files (`*.unit.test.ts`)

Mix both branches:

- Import the function under test from `@monochromatic-dev/module-pipe` (plain), not `../dist/final/neutral/...`
  (opus). See footgun 7.
- Compile-time assertions in an exported `typeChecks(): void` function (opus), never a `if (Date.now() < 0)`
  dead branch (plain). See footgun 8.
- Shared step fixtures (`increment`, `double`, `toLabel`, `lengthOf`) and helpers (`makeCapturingLogger`,
  `runAndCatch`) defined once at file top (opus).
- Negative type tests in `typeChecks()` covering: gap on a pre-built variable, explicit `fn2: undefined`, zero
  steps, and fn10 on a pre-built variable. The fn10 case must use a pre-built `const`, not only a fresh literal
  (footgun 1). Positive `expectTypeOf` assertions lock the inferred output type and no-annotation parameter
  inference.
- Runtime tests: gap and overflow throw the named errors (assert `error.name` and message); async tests assert the
  last step's rejection is propagated and logged (opus's explicit last-step case); logger tests assert the
  composed `[piped] [runPipe]` / `[pipe] [runPipe]` tags.

### Cross-reference repoints

The pipe source is already removed from `module-es` on `main` (`4db429b8`); only doc references remain. Update:

- `docs/todo/code-quality.md`: the "Functional Programming Utilities" list still says to import composition from
  module-es. Repoint to `@monochromatic-dev/module-pipe` and label the forms eager vs deferred.
- `packages/module/es/README.md`: the "Functional Programming Patterns" example imports `pipe`/`piped`/etc. from
  `@monochromatic-dev/module-es`. Repoint to `@monochromatic-dev/module-pipe` and add the package to the sibling
  list. Compare both branches' versions of this edit and take the clearer wording.

## Footguns

Numbered for reference in review. Each names the symptom, the cause, and the rule.

1.  fn10 silent drop. TypeScript excess-property checks fire only on fresh object literals, never on pre-built
    variables, so object types stay open and extra keys pass through. opus omits `fn10?: never` and any runtime
    guard; a pre-built `{ fn1..fn10 }` compiles clean and silently drops fn10 (verified: the `@ts-expect-error`
    on a pre-built variable was reported "unused" against opus, "used" against plain). Rule: keep `fn10?: never`
    in every `NoStepsAfter1..9` and keep the runtime `assertNoOverflowStep` + `PipeStepOverflowError`. Do not
    accept "a tenth step is structurally impossible"; it is not. Test fn10 rejection with a pre-built `const`,
    because opus's literal-only fn10 test passed via excess-property checking and gave false confidence.

2.  Never-tails are load-bearing for overload resolution, not just gap rejection. Without the `fnK?: never` tails,
    a pre-built object with extra step keys is structurally assignable to a smaller-arity overload and resolves to
    it, returning the wrong (earlier) step's type with no error. `NoStepsAfterN` both forbids gaps and forces
    arity-exact resolution on pre-built objects. Do not thin the tails to save lines.

3.  Validation-error logging. plain runs the gap/overflow asserts inside the `try`, so the thrown error is logged
    as `step failed: ...` though no step ran (misleading). opus keeps the gap check before the `try`, so it logs
    nothing (invisible). Rule: validate before the `try`, log validation failures under an accurate label
    (`invalid pipe arguments: ...`), and keep the `step failed: ...` log for real step execution only.

4.  Final async step must be `return await`, not `return`. A bare `return fn9(...)` moves a last-step rejection
    outside the `try`, so it is neither caught nor logged, breaking symmetry with inner steps. opus needed a
    dedicated commit (`8c027e7e`) to fix exactly this. Await the final application.

5.  Async initial value. Await `value` first so the cores accept `T | Promise<T>`; await each intermediate before
    the next step. Steps run strictly sequentially, never in parallel.

6.  Build before test. Tests resolve the package through `exports` to `dist/final/*`, and the type tests check the
    emitted `.d.mts` overloads, not `src`. A stale dist yields false pass or false fail. Always
    `mise run //packages/module/pipe:buildAndTest`, never `test:unit` alone after a source edit. To run one file
    after building: `mise run //packages/module/pipe:buildAndTest -- src/piped.unit.test.ts`.

7.  Test import path. Import from `@monochromatic-dev/module-pipe` (what a consumer imports; resolves via the
    `exports` map). Do not import from `../dist/final/neutral/index.mjs` (opus); it couples tests to the build
    layout and skips the consumer-facing resolution path.

8.  Compile-time assertions. Use an exported `typeChecks(): void` that is never called but is type-checked by
    `lint:types`. Do not wrap `expectTypeOf` in a `if (Date.now() < 0)` dead branch (plain); it is a hack and reads
    as live code.

9.  No array indexing in the core. Do not implement dispatch as `steps[i]` iteration or a `reduce` over an array:
    `noUncheckedIndexedAccess` makes every element `T | undefined` (guard on every access), and an array erases the
    per-step types. Use named keys and the explicit if-chain.

10. No recursion over the steps. AGENTS.md bans recursion over linear input (V8 has no tail-call elimination;
    accumulator recursion is also O(n^2)). Do not "simplify" the nine-branch if-chain into recursion or a
    self-calling helper. The if-chain is intentional and correct.

11. max-lines limit. opus's fully-inlined overload shapes pushed each `pipe*.ts` to roughly 310 lines; the
    `SyncStep` + `NoStepsAfterN` factoring keeps them near 165. If a file nears the limit, split (re-export from
    `index.ts`, move helpers to siblings, types to `types.ts`). Never compress params onto one line, join
    declarations, or strip TSDoc to fit; that trades one lint rule for another.

12. tsconfig DOM baseline. Extend `@monochromatic-dev/config-typescript/dom`. The `module-logger` dependency pulls
    in OPFS and DOM sink types; a stricter non-dom base surfaces type errors from the dependency that look like
    pipe bugs but are not.

13. Unsafe-assertion suppression. The single `args as RunCallableArgs` cast needs a scoped
    `/* oxlint-disable ... -- ... */` ... `/* oxlint-enable ... */` whose justification states it is
    never-to-unknown parameter-variance widening that preserves `this: void`, leaving the typed overloads as the
    safe public surface. Keep the justification; do not widen with `any` or `Function`.

14. Workspace style that bites here: `this: void` on every step type (blocks method-style `this`); `const TInput`
    generic parameter; `readonly` on array/object params; named function declarations only, so the `.filter`,
    `.some`, and pipeline callbacks must be named functions, not arrows.

15. TSDoc on all declarations, including locals, internal helpers, and `typeChecks`. Document both error classes
    with `@throws`. Escape `*/` as `*\/` inside blocks. Avoid `the`/`a`/`an` in `@param`/`@returns`; explain why.

16. Log-string coupling. Tag assertions match exact debug strings (`2 steps`, `[piped] [runPipe] 2 steps`). If you
    reword a core log line or change the tag composition, update the tests in lockstep. Preserve the order:
    public-function tag wraps first, then the core tag.

17. Do not skip the cross-reference repoints (`docs/todo/code-quality.md`, `packages/module/es/README.md`). The
    code already moved out of module-es; the dangling doc references are the remaining work and are easy to forget.

18. Git hygiene. Commit with explicit package-scoped pathspecs (`git add packages/module/pipe`, then the doc files
    separately), never `-A`, `.`, or a `--no-enforce` bypass; the `cli-git` guards reject bulk staging on purpose.
    Conventional commits, scope `module-pipe` for the package and `*` for the cross-repo doc repoints. Commit per
    logical unit: the package first, the doc repoints second.

19. Zero steps and gaps are compile errors. `fn1` is required by every overload; a gap fails because the
    never-tails reject the out-of-order key. Lock both with `@ts-expect-error` in `typeChecks`.

20. exactOptionalPropertyTypes. An explicit `fn2: undefined` must be rejected (the never tail plus
    `exactOptionalPropertyTypes`). Include this negative case; it is distinct from "fn2 absent".

## Acceptance criteria

- `mise run //packages/module/pipe:lint:types` clean.
- `mise run //packages/module/pipe:lint:oxlint` zero warnings and zero errors.
- `mise run //packages/module/pipe:buildAndTest` green; tests cover all four public functions, both runtime cores,
  both error classes, both logger-present and logger-absent paths, the eager/deferred identity, and the negative
  type cases in footguns 1, 19, 20.
- `README.md` present and accurate; `@packageDocumentation` and per-declaration TSDoc complete.
- Cross-reference repoints landed.
- A pre-built `{ fn1..fn10 }` is a compile error and, when forced past the types, throws `PipeStepOverflowError`;
  a pre-built gapped object is a compile error and throws `PipeStepGapError`. Verify both, the pre-built variants
  specifically, before declaring done.

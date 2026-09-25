# Issue 563: exact array-conversion lint policy

Status: grilling in progress; no decision recorded yet.
Issue: <https://github.com/Aquaticat/Monochromatic/issues/563>.

## Problem

`unicorn/no-useless-spread` (oxlint 1.85.0, error via `correctness`) removes the spread in `[...x.m()]`
whenever `m` is a method name that returns a fresh array on `Array.prototype`.
It has no type information, so it also rewrites strings, typed arrays, and iterators.
`--fix` applies it because the rule emits a `SafeFix` despite its `fix_dangerous` metadata.

## Evidence gathered

### Reproductions on oxlint 1.85.0

- `[...text.slice(0, 3,),].some(...)` becomes `text.slice(0, 3,).some(...)`: TS2339.
- `Array.from(typed.map(double,),)` becomes `[...typed.map(double,),]` via `unicorn/prefer-spread`,
  then `typed.map(double,)` via `no-useless-spread`: `Uint8Array` instead of `number[]`, silent when inferred.
- `unicorn/prefer-spread` alone rewrites `scoopGrams.slice()` to `[...scoopGrams]` (typed array becomes
  `number[]`) and `menuCode.slice()` to `[...menuCode]` (caught afterwards by `no-misused-spread`).
- Autofixed diagnostics never print under the wrapper's fix loop (`oxlint-wrapper.ts:254-277`),
  so `oxlint-guidance.ts` entries cannot warn about an applied fix.

### Upstream

- oxc issue 26159 tracks the `no-useless-spread` string case; PRs 26160 and 26615 are open and unreviewed.
- eslint-plugin-unicorn removed the unsafe fix in PR 1996 (2022) and now reports unknown receivers without a fix.
- oxlint cannot disable one rule's CLI autofix, and neither `no-useless-spread` nor `prefer-spread` has options.
- oxlint JS plugins receive no type information (oxc issue 19962); tsgolint has no custom-rule mechanism.
- unicorn `prefer-iterator-to-array` is the closest precedent for explicit conversions (`.toArray()`).

### Prototype

Branch `prototype/issue-563-explicit-conversions`, worktree `~/temp/agent/issue-563-conversions`,
directory `package/oxlint-plugin/no-restricted-syntax/prototype-issue-563/`.
The branch commit is blocked: the forbidden-strings scanner cannot start in the uninstalled worktree.

- Narrow-typed helpers (`copyArray`, `numbersOf`, `collect`, `codePointsOf`) make TypeScript 7.0.2 reject
  every wrong receiver pairing tried (8 `@ts-expect-error` controls; a TS2578 positive control proves the probe).
- Because `copyArray` only accepts arrays, a syntax-only rule can report `copyArray(x.m())` as a useless copy
  with no false positive in code that type-checks.
  It must not autofix: on code that fails type-checking the unwrap would recreate the silent break.
- Learning cost of the helper vocabulary: four names, met only when the narrow ban fires (1 current hit),
  listed in the lint message; a wrong pick fails type-checking.
  `copyArray`, `numbersOf`, and `codePointsOf` errors read plainly (`'string' is not assignable to 'readonly unknown[]'`).
  `collect` with a `length?: never` guard produced `'number' is not assignable to 'undefined'`;
  a string-literal guard type puts the remedy into the TypeScript error text instead.
- Repo-wide run of the prototype rule over `package/`:
  1 spread of an ambiguous method result (a deliberate test fixture),
  175 spreads of other calls, 465 spreads of values, 15 `Array.from` calls;
  280 of the 656 hits sit in tests, fixtures, or fuzz packages.

### Built-ins replace the helpers

`builtins.prototype.ts` shows built-in spellings already let TypeScript reject every wrong receiver tried
(6 `@ts-expect-error` controls):
`iterator.toArray()` exists only on iterators;
`.values().toArray()` covers sets, maps, arrays, and typed arrays but not strings;
`array.toSpliced(0,)` copies arrays only.
What built-ins cannot do without types: tell a needless `x.map(f,).values().toArray()` on an array
from a needed one on a typed array.
The user noted progressive enhancement applies: a type-free baseline, with type information
narrowing messages and enabling safe fixes where the bridge can answer.

## Candidate policies

- Narrow ban with built-in vocabulary: ban `[...x.m()]` for ambiguous `m`; authors use `.toArray()`,
  `.values().toArray()`, string APIs.
- Narrow ban with typed helper vocabulary: the same ban plus helpers and a report-only useless-copy check.
- Broad ban: every sole spread and `Array.from` conversion; 656 current hits.
- Type-aware rule over the TypeScript 7 bridge in `prefer-readonly-parameter-type`.

## Settled so far

- Scope excludes the string-only `prefer-spread` to `no-misused-spread` chain (user answer, Q2).
- Upstream fixes are not awaited; repo precedent replaces problematic upstream rules with project rules
  (`package/config/oxlint/src/rule/restriction.ts:115-140`).

## Open questions

- Which candidate policy.
- Whether `unicorn/prefer-spread` is turned off or replaced, given its standalone typed-array break.

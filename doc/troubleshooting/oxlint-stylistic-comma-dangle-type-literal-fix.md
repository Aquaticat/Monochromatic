# `stylistic/comma-dangle` corrupts `;`-terminated type literals of destructured parameters

## Symptom

`oxlint --fix` with `stylistic/comma-dangle` enabled (oxlint 1.89.0,
`@monochromatic-dev/oxlint-plugin-stylistic` 0.0.1) leaves unparseable TypeScript wherever an
object-pattern parameter carries a type literal whose last member ends with `;`:

```ts
// input
export async function canaryUnder({ salt, }: { readonly salt: number; },): Promise<readonly number[]> {
// after one --fix pass
export async function canaryUnder({ salt, }: { readonly salt: number;, },): Promise<readonly number[]> {
```

The inserted `,` lands after the member's `;`,
producing `;,`.
oxlint then reports `Unexpected token` on the file and no further fixer applies to it.
The first corpus sweep recorded in `doc/troubleshooting/oxlint-typescript-indent-rule.md` broke 3,713
of 7,091 mirror files this way.

## Root cause

Trailing-comma insertion points are chosen in
`package/oxlint-plugin/stylistic/src/utility/comma-dangle.ts`
(`insertionTokenForList`,
`containerPenultimateToken` path).
For an object-pattern parameter the lookup lands on the type literal's closing `}` instead of the
pattern's `}`,
so "token before the close delimiter" is the member's `;`,
and the fixer appends `,` after it.
The same mis-placement emits valid text when the last member has no separator,
which hides the bug behind `;`-terminated members.

Measured trigger family (minimized repros in `~/temp/agent/indent-probe-2026-10-22/comma-repro/`):

- object-pattern parameter plus `;`-terminated type literal member:
  corrupted,
  in both function and arrow forms;
- identifier parameter plus the same type literal:
  never touched,
  even after repeated `--fix` passes;
- member without separator:
  trailing comma inserted,
  output parses;
- `,`-terminated member:
  untouched.

Hypotheses checked and rejected:

- "the stale `dist` bundle caused it":
  reproduced on a fresh rebuild;
  `comma-dangle.ts` has not changed since 2026-09-06;
- "the fixer appends a comma after any last member":
  identifier-parameter type literals are never flagged,
  so the insertion targets the wrong list's tail rather than the member;
- "function declarations only":
  arrow functions reproduce it too.

## Fix and workaround

No fix is shipped.
Until one lands:

- do not enable `stylistic/comma-dangle` in `package/config/oxlint/src/rule/style.ts`;
- run `--fix` passes that include it on disposable copies only;
- recover an already corrupted file with `git checkout -- <file>` or by removing the stray `,` by hand.

Tradeoff of the quick fix (skip insertion when the penultimate token is `;`):
it stops the corruption but leaves member separators unnormalized.
Replacing the `;` with `,` matches dprint's `trailingCommas: always` output but rewrites more text.
The fix task in `doc/handover/issue-577-indent-rule-investigation.md` picks between them with tests.

## Upstream filing

The emitter is this repository's own rule,
so no external upstream filing applies and the
`.out-of-scope/` constraint check does not gate anything here.
A duplicate search of `doc/troubleshooting/` found no earlier record of this failure mode.
The fix task is queued in `doc/handover/issue-577-indent-rule-investigation.md`.

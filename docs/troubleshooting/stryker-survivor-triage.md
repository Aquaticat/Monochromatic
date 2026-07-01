# Stryker 9.6.1 mutation survivors: a per-line `ConditionalExpression -> true` survivor can be a single `&&`/`||` operand, not the whole condition

Stryker (`@stryker-mutator/core` 9.6.1) emits several mutants on one boolean line:
the whole `if` test, and each `&&` or `||` operand separately.
The JSON report distinguishes them only by column, so a survivor printed as
`L73 ConditionalExpression -> true` can be an operand mutant whose kill needs an
input the whole-condition mutant never requires.
Triaging by line alone, then reproducing the assumed whole-condition variant,
makes a correctly-reported survivor look like a harness bug.

## Symptom

A mutation report lists a `Survived` mutant on a source line whose behavior the
unit tests appear to cover.
For `packages/module/jsonc-edit/src/edit-comment.ts` the aggregated survivor read:

```txt
src/edit-comment.ts  L73  Survived  ConditionalExpression  -> true
```

Line 73 is:

```ts
// packages/module/jsonc-edit/src/edit-comment.ts:73
  if ((node.kind === 'record') && ((typeof segment) === 'string')) {
```

Forcing the whole condition true and running the single test file that should
catch it exits non-zero (a kill), which contradicts the `Survived` verdict:

```txt
# edit-comment.ts patched: if ((node.kind === 'record') && ...) -> if (true)
$ node src/edit-comment.unit.test.ts ; echo $?
... TypeError: Cannot read properties of undefined (reading 'findLastIndex') ...
1
```

The contradiction (report says survived, local repro says killed) looks like the
container harness ran a stale or reduced test set.
It did not.

## Root cause

Stryker's `ConditionalExpression` mutator emits a separate mutant for the `if`
test and for each boolean operand of an `&&` or `||`:

```ts
// stryker-js b72a3685 packages/instrumenter/src/mutators/conditional-expression-mutator.ts:25
  *mutate(path) {
    if (isTestOfLoop(path)) {
      yield types.booleanLiteral(false);
    } else if (isTestOfCondition(path)) {
      yield types.booleanLiteral(true);
      yield types.booleanLiteral(false);
    } else if (isBooleanExpression(path)) {
      if (path.parent?.type === 'LogicalExpression') {
        // For (x || y), do not generate the (true || y) mutation ...
        if (path.parent.operator === '||') {
          yield types.booleanLiteral(false);
          return;
        }
        // For (x && y), do not generate the (false && y) mutation ...
        if (path.parent.operator === '&&') {
          yield types.booleanLiteral(true);
          return;
        }
      }
      yield types.booleanLiteral(true);
      yield types.booleanLiteral(false);
    }
```

For `if (A && B)` this yields four mutants:

- whole test `A && B` -> `true` and `A && B` -> `false`, from the
  `isTestOfCondition` branch (lines 28 to 30).
- left operand `A` -> `true`, giving `true && B`, from the `isBooleanExpression`
  `&&` branch (lines 43 to 45).
- right operand `B` -> `true`, giving `A && true`, from the same branch.

The `false && B` and `true || B` operand mutations are deliberately skipped
because they duplicate the whole-condition mutant (the comments at lines 33 to
46 state this).
So the operand mutants that survive are `A -> true` and `B -> true`, each of
which reduces the condition to the other operand alone.

In the report these three `-> true` mutants share line 73 and the replacement
string `true`.
They are told apart only by column:

```txt
# host reproduction, edit-comment.ts, killer = edit-comment.unit.test.ts only
L73 col  7-66  ConditionalExpression -> true :: Killed   # whole (A && B) -> true
L73 col  8-30  ConditionalExpression -> true :: Killed   # left operand A -> true (true && B)
L73 col 36-65  ConditionalExpression -> true :: Survived # right operand B -> true (A && true)
```

The survivor is the right operand `((typeof segment) === 'string') -> true`,
which reduces the guard to `node.kind === 'record'` alone (the segment type is
no longer checked).
It changes behavior only when a record node is reached with a non-string
(numeric) segment: unmutated the guard is false and the code throws
`JsoncTypeError` ("cannot index"), mutated it enters the record branch and
throws `JsoncPathNotFoundError` ("no JSONC node at path").
The existing tests only pass string segments into records and numeric segments
into arrays, so both paths take the same branch under the mutant and the
assertions do not move.
An operand mutant of `A && B` set to `true` is an equivalent mutant for every
input where the other operand already forces the result, and is killed only by
an input that flips the specific operand.

Earlier hypothesis that was wrong: that the container harness fed Stryker a
reduced or stale test set (a bug in
`packages/dev-script/mutation-test`).
Disproved three ways.
The host `selectTestsForSource` returns all fifteen test files, the live podman
`--env MUTATION_SELECTED_TEST_FILES_JSON` carries all fifteen, and a single-file
re-run reproduces the identical six survivors.
The mismatch came from reproducing the wrong mutant: patching `if (true)` tests
the whole-condition mutant at column 7 to 66, which is already `Killed`, not the
right-operand survivor at column 36 to 65.

## Verification

Version under test: `@stryker-mutator/core` and `@stryker-mutator/instrumenter`
9.6.1, source cloned at commit
`b72a3685967b7385809495592e83784b4b76ca2a`.

Harness (host reproduction, no container, no TypeScript checker, one mutate
target, one killer file):

```json
// debug.stryker.json
{
  "testRunner": "command",
  "commandRunner": { "command": "node debug-runner.cjs" },
  "mutate": ["src/edit-comment.ts"],
  "coverageAnalysis": "off",
  "inPlace": true,
  "reporters": ["json"],
  "jsonReporter": { "fileName": "debug-report.json" },
  "concurrency": 1
}
```

```cjs
// debug-runner.cjs (replica of the harness inline sequencer)
const { execFileSync } = require('node:child_process');
const tests = JSON.parse(process.env.MUTATION_TEST_FILES_JSON);
for (const test of tests) {
  try { execFileSync('node', [test], { stdio: 'pipe' }); }
  catch (error) { process.exit(typeof error.status === 'number' ? error.status : 1); }
}
```

```sh
# from packages/module/jsonc-edit; restore src afterwards (inPlace overwrites it)
MUTATION_TEST_FILES_JSON='["src/edit-comment.unit.test.ts"]' \
  ../../dev-script/mutation-test/node_modules/.bin/stryker run debug.stryker.json
```

Mutants that the tests move (the report marks `Killed`):

- `L73 col 7-66` whole `(A && B) -> true`: `setComment` into an array element
  enters the record branch on the array and throws a `TypeError`.
- `L73 col 8-30` left `A -> true` (`true && B`): the type-error test
  (`setComment(['a', 'b'])` where `a` is scalar) enters the record branch on a
  scalar and throws `TypeError` instead of the expected `cannot index`.

Mutants that no test moves (the report marks `Survived`, correctly):

- `L73 col 36-65` right `B -> true` (`A && true`): killed only by a numeric
  segment into a record (for example `setComment([0])` on a record, expected to
  throw `cannot index`), which no test exercised.

Cross-checks that the harness itself is faithful:

```sh
# selection includes every co-located and sidecar test file
node --input-type=module -e '
import { selectTestsForSource } from "./packages/dev-script/mutation-test/src/test-selection.ts"
console.log((await selectTestsForSource({
  packageRoot: process.cwd() + "/packages/module/jsonc-edit",
  sourceFile: "src/edit-comment.ts", fullSuite: true,
})).length)'   # => 15

# a single-file container run reproduces the same six survivors as the full run
mise run //packages/module/jsonc-edit:test:mutation -- --full-suite src/edit-comment.ts
```

## Verified workarounds

These are triage steps, not code changes; the harness needs no fix.

- Group and read survivors by `(file, line, column, mutatorName, replacement)`,
  never by line alone.
  Two mutants can share a line, mutator, and replacement string and differ only
  by the column span, which is the operand they target.
  Tradeoff: the aggregated one-line-per-survivor summary is easier to scan but
  hides operand mutants; keep it for triage speed and drop to the column view
  before concluding anything about a specific survivor.

- Map the column span onto the source substring before reproducing.
  For `L73 col 36-65` the span is `((typeof segment) === 'string')`, so the
  mutant is that operand set to `true`, not the whole `if`.
  Reproduce that exact substitution.
  Tradeoff: none beyond the extra lookup; skipping it is what produces the false
  "harness bug" reading.

- Recognize the operand-to-`true` (and operand-to-`false`) equivalence.
  In `A && B`, setting one operand to `true` is equivalent for every input where
  the other operand already decides the branch.
  Kill it by constructing an input where the untargeted operand is the deciding
  one, then flipping the targeted operand changes the branch (here, a record
  node with a numeric segment, so `node.kind === 'record'` is true while
  `typeof segment === 'string'` is false).
  Tradeoff: some operand mutants are genuinely equivalent (no input separates
  them) and should be recorded as equivalent, not chased.

## What does not work

- Patching the whole condition (`if (true)`) to reproduce a `-> true` survivor.
  That is the column 7 to 66 mutant, which is already killed; it proves nothing
  about the column 36 to 65 survivor and manufactures a contradiction with the
  report.

- Grouping survivors by line and assuming one mutant per line.
  A boolean line with an `&&` or `||` carries three or more `ConditionalExpression`
  mutants; collapsing them by line conflates a killed whole-condition mutant with
  a surviving operand mutant.

- Concluding "the container fed Stryker the wrong tests" from the report-versus-repro
  mismatch.
  The selection, the container environment, and a single-file re-run all agree;
  the mismatch was reproducing the wrong mutant.

## Upstream filing decision

Not filed. The behavior is correct, so the 6-constraint check stops at the first
constraint.

1. Is it really upstream's fault?
   No.
   Emitting one mutant per boolean operand is the intended design of the
   `ConditionalExpression` mutator, and the source even documents why the
   redundant operand mutations are skipped
   (`packages/instrumenter/src/mutators/conditional-expression-mutator.ts:33`
   to `:46`).
   The confusion was a local triage error (reproducing the wrong mutant and
   grouping by line), not a defect in Stryker.

Constraints 2 through 6 are not reached: with no upstream fault there is nothing
to fix, support, contribute, land, or prototype.
`.out-of-scope/` has no Stryker or mutation-testing exemption, and a tracker
search is unnecessary because there is no defect to report; a "these are
separate mutants" issue would be a duplicate of Stryker's own documented
behavior and a publicity incident.

Nothing to file, and no additive comment to make on any existing thread.

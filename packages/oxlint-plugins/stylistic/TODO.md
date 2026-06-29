# Investigate: unit test timeout in oxlint-stylistic

## Problem

`mise run buildAndTest -- packages/oxlint-plugins/stylistic/src/oxlint-stylistic.unit.test.ts`
times out instead of completing normally.
The tests invoke `oxlint` via `nano-spawn` and read JSON output,
so a hang could occur in the spawned process,
 in output buffering,
 or in the test runner itself.

## Investigation steps

1. Run the test file directly with `node src/oxlint-stylistic.unit.test.ts` (bypassing mise) to isolate whether the build step or the test step hangs.
    Do not use `bun test`:
    the module-test harness runs as a side effect of import,
    and `bun test` would print misleading `0 pass / 0 fail` summaries even when the tests actually run.
2. Check whether `oxlint --format json` itself hangs on the fixture files when run manually in the terminal
3. Check if sandbox restrictions block `oxlint` binary execution or file reads (look for "Operation not permitted" in stderr)
4. Verify `nano-spawn` subprocess stdout/stderr handling:
    a full buffer with no reader on stderr could deadlock
5. Try running with a timeout flag on individual test cases (`test('...', async () => { ... }, 30_000)`)
6. Check whether the `--fix` autofix test is the one that hangs (it writes to disk and re-lints,
    more I/O)
7. Look at the `afterEach` cleanup:
    `unlinkSync` on a non-existent file in the catch block should be fine,
    but verify

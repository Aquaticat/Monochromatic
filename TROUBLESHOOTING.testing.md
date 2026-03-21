# Testing troubleshooting

## Duplicate describe blocks causing missing or misattributed test output

Symptoms:
- Reporter output omits some `expect(...)` failures.
- Reporter output omits or misattributes `console.log` messages.
- Test counts in the reporter are lower than the number of tests defined in the file.
- Running a single file shows fewer suites than expected.

Root cause:
- Duplicate `describe` blocks with the same title at the same lexical scope can cause suite merging in the test reporter.
- Merged suites collapse logs and results from earlier suites into the last suite with the same title.
- Duplicate test titles under the same suite increase ambiguity and hide earlier failures.
- The effect is local to a file where the duplicates exist.

Reproduction:
```ts
// example.duplicate-describe.unit.test.ts
import { describe, test, expect } from 'bun:test';

describe('suite', () => {
  test('first', () => {
    // eslint-disable-next-line no-console -- demonstration
    console.log('from first suite');
    expect(1).toBe(2);
  });
});

describe('suite', () => {
  test('second', () => {
    // eslint-disable-next-line no-console -- demonstration
    console.log('from second suite');
    expect(1).toBe(1);
  });
});
```
- The reporter may omit the failure from the first `suite` and show only the second `suite`.
- Console output from the first `suite` can be missing or attributed to the second `suite`.

Impact:
- CI logs become misleading and hide actual failures.
- Local debugging becomes unreliable when logs or failures do not appear.
- Coverage metrics remain unaffected, which can mask the underlying problem.

Detection:
- List `describe` occurrences and scan for duplicate titles at the same scope.
  ```bash
  rg -n "^[[:space:]]*describe\(" -t ts .
  ```
- Focus on files with multiple top-level `describe` entries using the same string title.
- Verify suspicious files by running them directly.
  ```bash
  mise run test -- packages/module/es/src/function.tryCatch.unit.test.ts
  ```
- Temporarily isolate a test to confirm output.
  ```ts
  test.only('case under investigation', () => { /* ... */ });
  ```

Remediation:
- Use a single top-level `describe` per subject (API, function, or feature) within a file.
- Use nested `describe` groups under the top-level suite to partition contexts.
- Ensure `describe` titles are unique at the same scope inside a file.
- Ensure test titles are unique and context-aware to avoid ambiguity.
- Prefer hierarchical grouping over multiple duplicate suites at the same level.

Template for hierarchical grouping:
```ts
import { describe, test, expect } from 'bun:test';

describe('subject-under-test', () => {
  //region Success and retry behavior

  describe('success and retry behavior', () => {
    test('returns result on success', () => { /* ... */ });
    test('retries on true decision', () => { /* ... */ });
  });

  //endregion Success and retry behavior

  //region Null suppression behavior

  describe('null suppression behavior', () => {
    test('returns undefined on null decision', () => { /* ... */ });
  });

  //endregion Null suppression behavior

  //region Validation and type checking

  describe('validation and type checking', () => {
    test('invalid decision type throws TypeError', () => { /* ... */ });
  });

  //endregion Validation and type checking
});
```

Best practices:
- Keep one top-level `describe` per subject in a file.
- Mirror structure between sync and async suites for quick visual diffing.
- Keep suite titles unique and descriptive at their scope.
- Keep test titles explicit about context to avoid collision and ambiguity.
- Use region markers to maintain navigability in long files:
  ```ts
  //region Success and retry behavior -- Direct success paths and retry control
  //endregion Success and retry behavior
  ```

Recommended commands:
- Run a single test file.
  ```bash
  mise run test -- packages/module/es/src/function.tryCatch.unit.test.ts
  ```
- Build and test together to avoid stale artifacts.
  ```bash
  mise run buildAndTest
  ```

## expect.assertions not supported in concurrent test mode

Symptoms:
- Tests fail with assertion count mismatches when running in concurrent mode.
- `expect.assertions(n)` does not reliably validate the expected number of assertions.
- Tests pass in isolation but fail when run together in concurrent batches.

Root cause:
- Bun runs tests concurrently by default in recent versions.
- `expect.assertions(n)` maintains shared state across the test suite to track assertion counts.
- When tests run concurrently, assertions from different tests can interfere with the count, causing false negatives or positives.
- `expect.assertions` is a testing utility designed for sequential execution environments.

Impact:
- Test reliability decreases as concurrency increases.
- Assertion count validations become unreliable.
- Tests may pass locally (sequential mode) but fail in CI (concurrent mode).

Detection:
- Search for all `expect.assertions` usage:
  ```bash
  rg 'expect\.assertions' . --type ts
  ```
- Run tests in concurrent mode to observe failures:
  ```bash
  mise run test
  ```

Remediation:
- **Remove all `expect.assertions` calls** and rely on explicit assertions instead.
- Replace `expect.assertions(n)` with individual assertions that validate the exact behavior expected.
- Example:
  ```ts
  // Before: unreliable in concurrent mode
  test('example', () => {
    expect.assertions(2);
    expect(getValue()).toBe(5);
    expect(getError()).toBeNull();
  });

  // After: reliable regardless of concurrency
  test('example', () => {
    const value = getValue();
    const error = getError();
    expect(value).toBe(5);
    expect(error).toBeNull();
  });
  ```

Best practices:
- Use explicit assertions instead of assertion counters.
- Verify the exact expected outcome of each test case without relying on count validation.
- Structure tests to have a single clear assertion path; if testing multiple outcomes, use nested `test` blocks or separate test cases.

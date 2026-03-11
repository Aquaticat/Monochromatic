# Testing practices

## Test framework

- Unit tests use `bun:test` as the test runner
- Browser and e2e tests use Playwright, executed inside a podman container
- All tests run through `mise run` — never invoke `bun test` or `playwright` directly

## Running tests

```bash
# Run all tests (unit + browser + e2e)
mise run test          # alias: t

# Run a specific unit test file
mise run test -- packages/cli/fy/src/coerce.unit.test.ts

# Build all packages then run all tests (required when tests import from dist)
mise run buildAndTest  # alias: bt

# Build then run a single test file
mise run buildAndTest -- packages/module/es/src/boolean.equal.unit.test.ts

# Watch mode
mise run watch:test    # alias: tW
```

**When to use `buildAndTest`**: packages that produce dist output (e.g. `module-es`) require a fresh build before tests.
Tests import from the built dist, so a stale build causes false failures.
Always use `mise run buildAndTest` instead of `mise run test` alone for these packages.

## Browser and e2e tests

Browser and e2e tests run inside a podman container image (`monochromatic-playwright`).
Build the image first with `mise run prepare:playwright`.

```bash
# Run browser tests (all browsers)
mise run test:browser

# Run browser tests for a specific browser
mise run test:browser:chromium
mise run test:browser:firefox

# Run e2e tests
mise run test:e2e
```

Playwright configuration lives in `playwright.browser.config.ts` and `playwright.e2e.config.ts`.
The browser test server (`playwright/serve.ts`) uses h3.

## Test file naming

- Unit tests: `{name}.unit.test.ts` — co-located alongside source
- Browser tests: `{name}.browser.test.ts`
- E2E tests: `{name}.e2e.test.ts`

Test discovery uses `rg --files --glob '**/*.unit.test.*'` — no configuration file needed.

## Test file setup

```ts
import { describe, expect, test } from 'bun:test';

import { coerceArg } from './coerce.ts';

describe('coerceArg', () => {
  test('coerces integer string to number', () => {
    expect(coerceArg({ arg: '42' })).toBe(42);
  });
});
```

Import the function or module under test directly. Use the function name or module name as the `describe` title.

## Coverage requirements

Aim for 100% test coverage. When certain lines or branches cannot be tested (e.g. error handling for impossible states), use V8 ignore comments:

```ts
/* v8 ignore next -- @preserve */
if (impossibleCondition) {
  throw new Error('This should never happen');
}

// For multiple lines:
/* v8 ignore next 3 -- @preserve */
if (untestableCondition) {
  console.error('Untestable path');
  return fallbackValue;
}
```

## Test structure

- Use descriptive test names that explain expected behavior
- Group related tests using `describe` blocks
- Keep one top-level `describe` per subject per file
- Use `test.each` for parameterized tests
- Test both happy path and error scenarios
- Mock external dependencies using `spyOn` and `mock` from `bun:test`

### Region markers

Use `//region` and `//endregion` markers to organize test groups within a `describe` block:

```ts
describe('coerceArg', () => {
  //region Numeric coercion

  test('coerces integer string to number', () => {
    expect(coerceArg({ arg: '42' })).toBe(42);
  });

  test('coerces negative integer string to number', () => {
    expect(coerceArg({ arg: '-7' })).toBe(-7);
  });

  //endregion Numeric coercion

  //region Boolean and null coercion

  test('coerces "true" to boolean true', () => {
    expect(coerceArg({ arg: 'true' })).toBe(true);
  });

  //endregion Boolean and null coercion
});
```

Region markers provide IDE folding and navigability in long test files.
They also prevent accidental duplicate `describe` blocks at the same scope.

### Async testing with `expect.assertions`

For async tests where assertions run inside callbacks or after async operations, declare the expected assertion count:

```ts
test('config file that copies one file to another', async () => {
  expect.assertions(2);
  await writeFile(join(tempDir, 'source.md'), '# Source Content');

  await import(configPath);

  expect(await readFile(join(tempDir, 'dest.md'), 'utf8')).toBe('# Source Content');
  expect(reads.size).toBeGreaterThan(0);
});
```

### Integration tests with setup and teardown

Use `beforeEach`/`afterEach` with module-scoped variables for integration tests that need temporary state:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

describe('integration: config execution', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'my-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('writes output to temp dir', async () => {
    // ... uses tempDir
  });
});
```

## Type-level testing

Use type-level tests for complex type utilities:

```ts
import {
  type IsArrayFixedLength,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'bun:test';

describe('ArrayFixedLength', () => {
  test('IsArrayFixedLength', () => {
    expectTypeOf<IsArrayFixedLength<[number, string]>>().toEqualTypeOf<true>();
  });
});
```

## `bun:test` quirks

- Import `expect` directly from `bun:test` — it is **not** available as a test context parameter
- `test.for` is not available — use `test.each` instead
- `test.extend` (fixtures) is not available — use `beforeEach`/`afterEach` with module-scoped variables
- `test('name', { skip: condition }, fn)` options object is not available — use `test.skipIf(condition)('name', fn)`
- `vi.spyOn` becomes `spyOn` (imported from `bun:test`)

## Linting test code

### Testing intentional violations

When tests intentionally violate a lint rule to verify behavior:

```ts
// BAD: Adding data to satisfy the linter
expect(isError(new Error('test message'))).toBe(true);

// GOOD: Use disable comments for intentional violations
// oxlint-disable-next-line unicorn/error-message -- Testing error without message
expect(isError(new Error())).toBe(true);
```

### Async patterns

- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(resolve, ms))`
- Add `eslint-disable-next-line no-await-in-loop` when sequential processing is required
- Import and use existing promise utilities instead of creating new promises

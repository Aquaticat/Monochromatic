# Testing Practices

## General Testing Guidelines
- Write a corresponding test file that aims for 100% test coverage
- Unit tests use `bun:test` as the test runner
- Browser tests use Playwright
- Tests can only be run from workspace root using `mise run test`
- To run tests for a specific file pattern:
  - `mise run test:unit -- packages/module/es/src/boolean.equal.unit.test.ts`
  - `mise run test:browser -- packages/module/es/src/boolean.equal.browser.test.ts`
- Tests that import from `@monochromatic-dev/module-es` require the package to be built first (`mise run build:js` in the package directory)

## Coverage Requirements
- If certain lines or branches can't be tested (example: error handling for impossible states), use V8 ignore comments:
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

## Test Structure
- Use descriptive test names that explain the expected behaviour
- Group related tests using `describe` blocks
- Use `test.each` for parameterized tests
- Mock external dependencies using `spyOn` and `mock` from `bun:test`
- Test both happy path and error scenarios

## Type-Level Testing
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

## Test File Setup
Start test files with:
```ts
import {
  // ... members to test. Examples:
  types
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.function.generator.from.iterable.withIndex.sync.named.$;

describe($, () => {
  test('basic', () => {
    // ... actual test
  })
})
```

## Key Differences from Vitest
- Import `expect` directly from `bun:test` -- it is **not** available as a test context parameter
- `test.for` is not available -- use `test.each` instead
- `test.extend` (fixtures) is not available -- use `beforeEach`/`afterEach` with module-scoped variables
- `test('name', { skip: condition }, fn)` options object is not available -- use `test.skipIf(condition)('name', fn)`
- `vi.spyOn` becomes `spyOn` (imported from `bun:test`)

## Linting Test Code

### Testing Intentional Violations
When tests intentionally violate a rule to verify behaviour:
```ts
// BAD: Adding data to satisfy the linter
expect(isError(new Error('test message'))).toBe(true);

// GOOD: Use disable comments for intentional violations
// oxlint-disable-next-line unicorn/error-message -- Testing error without message
expect(isError(new Error())).toBe(true);
```

### Async Testing Patterns
- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(resolve, ms))`
- Add `eslint-disable-next-line no-await-in-loop` when sequential processing is required
- Import and use existing promise utilities instead of creating new promises

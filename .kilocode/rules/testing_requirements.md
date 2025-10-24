# Testing Requirements

## General Testing Guidelines
- Write a corresponding Vitest file that aims for 100% test coverage
- Tests can only be run from workspace root using `moon run test`
- To run tests for a specific file pattern:
  - `moon run testUnit -- packages/module/es/src/boolean.equal.unit.test.ts`
  - `moon run testBrowser -- packages/module/es/src/boolean.equal.browser.test.ts`

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
- Use `it.each` for parameterized tests
- Mock external dependencies using Vitest's mocking capabilities
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
} from 'vitest';

describe('ArrayFixedLength', () => {
  test('IsArrayFixedLength', () => {
    expectTypeOf<IsArrayFixedLength<[number, string]>>().toEqualTypeOf<true>();
  });
});
```

## Test File Setup
Start Vitest files with:
```ts
import {
  // ... members to test. Examples:
  types
} from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.function.generator.from.iterable.withIndex.sync.named.$;

describe($, () => {
  test('basic', ({expect}) => {
    // ... actual test
  })
})
```

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

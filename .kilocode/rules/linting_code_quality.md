# Linting and Code Quality

## Identifying the Linting Tool
When fixing linting issues, first identify which tool reports the error:
- Check the lint output format: `monochromatic:lintOxlint | ! eslint-plugin-unicorn(error-message)` indicates Oxlint
- ESLint errors show as `eslint(rule-name)`
- Oxlint errors often include the plugin name like `eslint-plugin-unicorn(rule-name)`

## Common Linting Fixes

### Testing Intentional Violations
When tests intentionally violate a rule to verify behaviour:
```ts
// BAD: Adding data to satisfy the linter
expect(isError(new Error('test message'))).toBe(true);

// GOOD: Use disable comments for intentional violations
// oxlint-disable-next-line unicorn/error-message -- Testing error without message
expect(isError(new Error())).toBe(true);
```

### Magic Numbers
Define constants for all numeric literals except -2, -1, 0, 1, 2:
```ts
// BAD
const result = value * 100;
if (array.length > 5) { }

// GOOD
const PERCENTAGE_BASE = 100;
const MAX_ARRAY_LENGTH = 5;
const result = value * PERCENTAGE_BASE;
if (array.length > MAX_ARRAY_LENGTH) { }
```

### Loops and Iteration
Prefer functional approaches over imperative loops:
```ts
// BAD: for...in with guard
for (const key in obj) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    result[key] = process(obj[key]);
  }
}

// BETTER: for...of with Object.entries
for (const [key, value] of Object.entries(obj)) {
  result[key] = process(value);
}

// BEST: forEach for side effects
Object.entries(obj).forEach(([key, value]) => {
  result[key] = process(value);
});

// For transformations, use map/reduce
const result = Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [key, process(value)])
);
```

### Async Patterns
- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(resolve, ms))`
- Add `eslint-disable-next-line no-await-in-loop` when sequential processing is required
- Import and use existing promise utilities instead of creating new promises

### Type Annotations
Always add explicit return types for functions:
```ts
// BAD
function processData(data: string) {
  return data.toUpperCase();
}

// GOOD
function processData(data: string): string {
  return data.toUpperCase();
}

// For async functions
async function fetchData(): Promise<Data> {
  return await api.getData();
}
```

### Import Patterns
- When parsers require namespace imports, add disable comment:
  ```ts
  // eslint-disable-next-line import/no-namespace -- Parser needs to be imported as namespace
  import * as tsParser from '@typescript-eslint/parser';
  ```
- For CSS imports in Astro components:
  ```ts
  // eslint-disable-next-line import/no-unassigned-import -- CSS import for styling
  import './_Head.css';
  ```

### Null Checks
Use explicit comparisons instead of `!=` or `==`:
```ts
// BAD
if (value != null) { }

// GOOD
if (value !== null && value !== undefined) { }
```

### Module Disambiguation
For scripts that might be parsed as CommonJS, add an export:
```ts
// At the end of the file
export {};
# Code Simplification Principles

## Core Philosophy

Always question "Do you really need...?" for every construct:
- **Do you really need that mutable variable?** → Use `const` and immutable patterns
- **Do you really need that loop?** → Consider `map`, `filter`, `reduce`, or functional helpers
- **Do you really need that imperative code?** → Look for declarative/functional alternatives
- **Do you really need that complex solution?** → Start with the simplest approach
- **Do you really need to create promises directly?** → Use existing promise utilities like `wait()`

## Progressive Simplification Pattern

When refactoring code, follow this progression:
1. Imperative loop with mutable state → `while` loop with proper conditions
2. `while` loop → `for` loop with calculated iterations
3. `for` loop → Recursive function
4. Recursive function → Higher-order functions or async iterators

## Best Practices

- Always extract and name concepts (e.g., `isTaskPending()` instead of inline conditions)
- Prefer built-in JavaScript/TypeScript methods over manual implementations
- Start with the simplest solution that could work
- Refactor to complexity only when necessary
- Name intermediate values for clarity
- Break complex operations into smaller, testable functions

## Examples

### Bad: Complex imperative code
```ts
let results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].isActive) {
    results.push(items[i].value * 2);
  }
}
```

### Good: Simple functional approach
```ts
const results = items
  .filter(item => item.isActive)
  .map(item => item.value * 2);
```

### Bad: Manual promise creation
```ts
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Good: Use existing utilities
```ts
import { wait } from '@monochromatic-dev/module-es';
// Use wait(ms) directly
```

### Bad: Inline complex conditions
```ts
if (status === 'pending' && retries < maxRetries && !isTimeout) {
  // retry logic
}
```

### Good: Extract and name the concept
```ts
const canRetry = () => 
  status === 'pending' && 
  retries < maxRetries && 
  !isTimeout;

if (canRetry()) {
  // retry logic
}
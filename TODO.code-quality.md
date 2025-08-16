# Code Quality & Patterns Todo

## Current Linting Issues

### High Priority ESLint Fixes

#### Code Quality Issues (Fix in code, not config)

1. **`@typescript-eslint/no-confusing-void-expression`** (26 occurrences, down from 50)
   - Void expressions in wrong contexts
   - These are legitimate code issues that need fixing

2. **Variable abbreviations** (~135 total occurrences, down from 147)
   - Use descriptive names instead of abbreviations
   - **NEVER use single-letter variables like `i`, `j`, `k`** - they provide no semantic meaning
   - Exception: Mathematical formulas where single letters have established meaning

3. **`@typescript-eslint/no-unsafe-return`** (51 occurrences)
   - Unsafe any returns that need proper type annotations

4. **`vitest/prefer-describe-function-title`** (down from 69 to around 30)
   - Update remaining test files to use function references in describe blocks

#### Remaining Files to Fix
- More test files need function references in describe blocks
- Files with remaining `i` variables in for loops  
- Files with void expression issues in test assertions
- Files with window references that need globalThis

### Medium Priority Issues

#### Test File Issues
- Missing JSDoc comments in non-test files (expected for internal utilities)

### Next Steps for ESLint Cleanup
1. Fix all instances of `i` variable usage with descriptive names
2. Fix void expression errors (legitimate code issues)
3. Update remaining test files to use function references in describe blocks
4. Replace `window` with `globalThis` throughout the codebase
5. Address unsafe any returns with proper type annotations

## Completed ESLint Fixes (June 2025)

### Configuration Changes
- ✅ Disable `jsdoc/tag-lines` - formatting concern, not linting
- ✅ Disable `jsdoc/require-jsdoc` for test files
- ✅ Add `param`, `args`, `props`, `ctx`, `var` to allowed abbreviations
- ✅ Add documentation about never using meaningless variable names like `i`

### Code Fixes Completed
- ✅ Fixed variable `i` issues in multiple files (fixture.promises.0to999.ts, fixture.generator.0to999.ts, etc.)
- ✅ Fixed variable `e` issues in catch blocks to use `error` instead
- ✅ Fixed void expression issues in test files
- ✅ Replaced `window` with `globalThis` in figma plugin files
- ✅ Updated many describe blocks to use function references

## Code Patterns and Best Practices

### Meilisearch Task Polling Implementation Evolution

**Learning Example**: The user guided progressive simplification through "Do you really need..." questions:

1. Started with mutable `let taskStatus` and `while` loop with inline constants
2. "Do you really need a mutable variable?" → Moved to immutable `const` inside loop
3. "Do you really need a while(true) break pattern?" → Changed to `while` with proper condition  
4. "Do you really need a while loop at all?" → Changed to `for` loop with calculated iterations
5. "Do you really need a for loop?" → Changed to recursive helper function

#### Final Implementation: Simple Array with `findAsync`

```typescript
// Create array of 100 nulls as a counter
const polls = new Array(100).fill(null);

// Use findAsync where the predicate does all the work
try {
  const completedStatus = await findAsync(
    polls,
    async () => {
      const status = await client.tasks.getTask(task.taskUid);
      if (!isTaskPending(status.status)) {
        return status;
      }
      await wait(TASK_POLL_INTERVAL_MS);
      return false;
    }
  );

  if (completedStatus) {
    if (completedStatus.status !== 'succeeded') {
      console.error(`Task ${task.taskUid} failed:`, completedStatus.error);
      allTasksSuccessful = false;
    }
  } else {
    console.error(`Task ${task.taskUid} timed out after ${TASK_TIMEOUT_MS}ms`);
    allTasksSuccessful = false;
  }
} catch (error) {
  console.error(error);
  allTasksSuccessful = false;
}
```

#### Potential Future Improvements (1am Ideas)

1. **Different utility function**: Perhaps a `times` or `repeat` async function:
   - `const status = await repeatAsync(100, async () => { /* poll logic */ })`
   - This would eliminate the dummy array entirely

2. **Parallel task validation**: Instead of polling tasks sequentially:
   - Create an array of all taskUids from the batch
   - Use `Promise.all` with `findAsync` for each task
   - Or better: a single `findAsync` that polls ALL tasks in each iteration

### Lessons from "Do you really need..."

This questioning pattern teaches:
1. **Question every construct** - Each programming construct adds complexity
2. **Prefer immutability** - Mutable variables should be eliminated when possible  
3. **Prefer declarative over imperative** - Loops can often be replaced with higher-order functions
4. **Extract and name concepts** - Helper functions like `isTaskPending` improve readability
5. **Think functionally first** - There's often a functional solution that's cleaner
6. **Simplify progressively** - Don't stop at the first working solution

## Testing Requirements and Standards

### General Testing Guidelines
- Write a corresponding Vitest file that aims for 100% test coverage
- Tests can only be run from workspace root using `moon run test`
- To run tests for specific patterns:
  - `moon run testUnit -- packages/module/es/src/boolean.equal.unit.test.ts`
  - `moon run testBrowser -- packages/module/es/src/boolean.equal.browser.test.ts`

### Coverage Requirements
If certain lines or branches can't be tested, use V8 ignore comments:
```typescript
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

### Test File Setup
Always start Vitest files with:
```typescript
import {
  // members to test
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());
```

### Testing Intentional Violations
When tests intentionally violate a rule to verify behavior:
```typescript
// BAD: Adding data to satisfy the linter
expect(isError(new Error('test message'))).toBe(true);

// GOOD: Use disable comments for intentional violations
// oxlint-disable-next-line unicorn/error-message -- Testing error without message
expect(isError(new Error())).toBe(true);
```

## TypeScript Standards and Patterns

### Function Patterns
- Always name functions. Prefer function declarations
- Always use parentheses around arrow function parameters (even single parameter)
- Provide explicit parameter and return types for all functions
- Use function overloads for functions with multiple call signatures

### Variable and Immutability Standards
- Prefer `const` over `let` to encourage immutability
- Strive for immutability: avoid reassigning variables and modifying objects in place
- **NEVER use single-letter variables** - they provide no semantic meaning
- **Prefer functional approaches over imperative loops**
- Remove unused variables or prefix them with underscore
- Use `satisfies` operator for type checking without widening

### Error Handling Best Practices
- **NEVER use process.exit()** - throw errors instead
- **Combine console.log/error messages into thrown errors**
- **Use outdent for multi-line error messages**
- **Always log errors in catch blocks**
- **Document expected errors with comments**

## Linting Configuration Philosophy

### When to Fix vs Configure
- **High Priority**: Fix legitimate code issues in the codebase
- **Medium Priority**: Adjust configuration for team workflow
- **Never**: Disable rules just to avoid fixing code

### Rule Categories
1. **Code Quality Issues** - Always fix in code, not config
2. **Style Preferences** - Can be configured for team consistency  
3. **Framework-specific** - May need configuration for specific use cases

### Testing-Specific Linting
- Use disable comments for intentional rule violations in tests
- Different rules may apply to test files vs production code
- Document why test files need different linting rules

## Performance and Code Efficiency

### Async Programming Standards
- Prefer `async/await` over explicit promise creation
- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(...))`
- Avoid await in loops where logically sound
- Use `Promise.all()` for concurrent operations

### Functional Programming Utilities
- Use `piped` for synchronous function composition
- Use `pipedAsync` for async function composition
- Use `pipe`/`pipeAsync` for reusable function pipelines
- Functions generally don't require `.bind()` for `this` context

## Code Organization Standards

### File Organization
- Use `region` markers to delineate logical sections
- Group imports in specific order (built-in, external, workspace, relative, type-only)
- Always include file extensions in imports
- Use absolute imports for workspace packages

### Export Patterns
- Avoid `Object.assign` for extending typed objects
- Export at the end after all object construction is complete  
- Prefer immediately invoked function expressions over mutable variables

## Future Quality Improvements

### Automated Code Quality
- Implement automated code review checks
- Set up quality gates in CI/CD pipeline
- Monitor code quality metrics over time
- Integrate with development workflow

### Developer Experience
- Provide clear error messages for common issues
- Document coding standards and best practices
- Create code templates and snippets
- Implement automated refactoring tools
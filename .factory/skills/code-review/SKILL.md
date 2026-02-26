---
name: code-review
description: >
  Use when reviewing code changes, diffs, pull requests, or when the user asks
  for a code review, quality check, or feedback on their implementation.
  Use when examining staged changes, feature branches, or specific files
  for correctness, style, security, and maintainability issues.
  Also reviews commit messages in PRs and multi-commit bundles.
---

# Code review

Structured code review that checks changes for correctness, type safety, security, style, and maintainability.
Produces actionable findings categorized by severity.

All underlying rules referenced below are defined in AGENTS.md.

## Process

Read the diff or files under review, then evaluate each category below.
Skip categories that do not apply to the language or change.

### 1. Correctness

- Logic errors, off-by-one, unhandled edge cases
- Missing null/undefined checks
- Race conditions in async code
- Incorrect use of APIs or library methods
- Broken error propagation (swallowed exceptions, silent catch blocks)

### 2. Type safety (TypeScript)

- Explicit return types on all functions
- `unknown` over `any`; no bare `Function` type
- No non-null assertions (`!`); use assertion functions or narrowing
- Branded types for domain primitives where appropriate
- `satisfies` over `as` when validating shape without widening
- `const` generic parameters; `readonly` array parameters
- Proper discriminated unions; narrow `typeof === 'symbol'` before identity checks

#### Symbol union narrowing

Flag code that compares a value to a specific symbol and assumes the else branch is non-symbol:

```ts
// Anti-pattern -- flag as BLOCKER
if (out === NO_LITERAL) {
  // handle sentinel
} else {
  // BUG: else may still be a symbol from the union
  use(out.parsed);
}

// Correct pattern
if (typeof out === 'symbol') {
  if (out === NO_LITERAL) {
    // handle sentinel
  } else {
    throw new Error('is symbol, but not expected');
  }
} else {
  use(out.parsed);
}
```

#### Generics

Flag missing `const` or `readonly` modifiers:

```ts
// Bad -- flag as WARNING
function processItems<T extends { id: string }>(items: T[]): T[]

// Good
function processItems<const T extends { id: string }>(items: T[]): T[]

// Bad -- flag as WARNING
function myFn<const T>(myArr: T[]): T[]

// Good
function myFn<const T>(myArr: readonly T[]): T[]
```

Flag non-descriptive generic names:

```ts
// Bad -- flag as NIT
<T extends Record<string, unknown>>

// Good
<TData extends Record<string, unknown>>
```

### 3. Immutability and style

- `const` over `let`; no unnecessary mutation
- **Justify or refactor**: any deviation from the preferred pattern must have a comment explaining why refactoring to the preferred approach is not feasible; if no justification is given, flag it as WARNING
- Functional patterns (`map`/`filter`/`reduce`) over imperative loops
- `for...of` when iteration is unavoidable, never classic `for` loops
- No single-letter variables (except math formulas)
- Magic numbers/strings extracted to named constants (0, 1, 2, -1, -2 exempt)
- Every source code file must be less than 100 lines unless a justification comment is given; flag unjustified files as WARNING (test, fixture, config, and doc files are exempt)
- Extract and name complex conditions

#### Functional over imperative

Flag imperative patterns when functional alternatives exist:

```ts
// Bad -- flag as WARNING
let results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].isActive) {
    results.push(items[i].value * 2);
  }
}

// Good
const results = items
  .filter(item => item.isActive)
  .map(item => item.value * 2);
```

#### Object iteration

Flag `for...in` loops on objects:

```ts
// Bad -- flag as WARNING
for (const key in obj) {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    result[key] = process(obj[key]);
  }
}

// Good
Object.entries(obj).forEach(([key, value]) => {
  result[key] = process(value);
});

// Good (for transformations)
const result = Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [key, process(value)])
);
```

#### Naming extracted concepts

Flag inline complex conditions:

```ts
// Bad -- flag as NIT
if (status === 'pending' && retries < maxRetries && !isTimeout) {
  // retry logic
}

// Good
const canRetry = () =>
  status === 'pending' &&
  retries < maxRetries &&
  !isTimeout;

if (canRetry()) {
  // retry logic
}
```

#### Single-letter variables

```ts
// Bad -- flag as WARNING
for (let i = 0; i < items.length; i++)

// Good
for (let itemIndex = 0; itemIndex < items.length; itemIndex++)
items.forEach((item, itemIndex) => ...)
```

### 4. Security

- No hardcoded secrets, API keys, or credentials
- No unsanitized user input in SQL, shell commands, or HTML
- No overly permissive CORS, file permissions, or network exposure
- Secrets not logged, even at debug level

### 5. Naming and readability

- Semantic, descriptive names for variables, functions, types
- Comments explain WHY, not WHAT
- TSDoc on **all** declarations (functions, types, constants, classes -- including locals inside function bodies) with `@param`, `@returns`, `@throws`, `@example`; do not skip declarations that seem "obvious from context"
- Comments on their own line above code, never inline after code
- No narrative or promotional language in docs
- Region markers for substantial code blocks; flag missing markers as WARNING for substantial blocks and NIT for smaller ones

#### TSDoc quality

Flag WHY-less comments:

```ts
// Bad -- flag as NIT
/** Line counter starting at 1 */

// Good
/** Mutable counter needed to track newlines encountered while scanning */
```

Flag TSDoc on non-declarations:

```ts
// Bad -- flag as WARNING: TSDoc on a statement
/** Increment the counter */
counter++;

// Good
// Increment the counter to account for the trailing newline
counter++;
```

#### Escaping block comment terminators

Flag unescaped `*/` inside TSDoc blocks:

```ts
// Bad -- flag as BLOCKER: premature comment termination
/**
 * Returns a string like "/* comment */"
 */

// Good
/**
 * Returns a string like "/* comment *\\/"
 */
```

### 6. Async patterns

- `async`/`await` over raw promises or callbacks
- No `.then()`, `.catch()`, `.finally()` -- use `async`/`await` with `try`/`catch` or let errors propagate naturally by throwing
- `Promise.all` for independent concurrent operations
- `Promise.allSettled` when partial failure is acceptable
- No `await` in loops without justification and eslint-disable comment
- `AbortController` for cancellable operations
- Streams and subprocesses properly consumed or cleaned up

#### Manual promise creation

Flag explicit `new Promise` when utilities exist:

```ts
// Bad -- flag as WARNING
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Good
import { wait } from '@monochromatic-dev/module-es';
// Use wait(ms) directly
```

### 7. Imports and modules

- Grouped: builtins, external deps, workspace packages, relative, type-only
- Named imports over default imports
- `import type` for type-only imports
- File extensions in relative imports when required by config
- No circular dependencies

### 8. Error handling

- Prefer letting errors propagate by throwing
- No `try...finally` -- use `using`/`await using` with `Symbol.dispose`/`Symbol.asyncDispose` for cleanup
- Custom error classes extending `Error` for domain errors
- No `process.exit()`; throw instead
- Multi-line error messages use `outdent` from `@cspotcode/outdent`
- `@throws` in TSDoc for functions that throw
- `notNullishOrThrow` instead of non-null assertion (`!`)
- Every catch block must log the error with `console.error()`

#### Custom error classes

```ts
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}
```

#### Type guards

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

#### Assertion functions

```ts
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError("Expected string");
  }
}
```

#### notNullishOrThrow over non-null assertion

```ts
// Bad -- flag as BLOCKER
const value = possiblyUndefined!;

// Good
import { notNullishOrThrow } from '@monochromatic-dev/module-es';
const value = notNullishOrThrow(possiblyUndefined);
```

#### Silent error handling

Flag empty or logging-only catch blocks without re-throwing:

```ts
// Bad -- flag as WARNING
catch (error) { console.error('Failed:', error); }

// Good (when error must be handled)
catch (error) { console.error('Failed to get index stats:', error); throw error; }
```

Flag silently discarded unexpected states:

```ts
// Bad -- flag as BLOCKER
if (!(event instanceof CustomEvent)) return;

// Good
if (!(event instanceof CustomEvent)) throw new TypeError("Expected CustomEvent");
```

### 9. Markdown quality

- No tables in markdown files -- use nested headings or lists instead
- Flag any existing tables in changed markdown files as WARNING with a suggestion to convert

### 10. Testing gaps

- New logic paths missing corresponding test cases
- Edge cases not covered (empty input, boundary values, error paths)
- Mocking that hides real integration issues
- Flaky patterns (timing dependencies, shared mutable state)

### 11. Commit messages

When reviewing PRs or multi-commit bundles, also review commit messages.

#### Format

Conventional Commits: `<type>(<scope>): <subject>` with optional body and footer.
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope: package name or `*` for multi-package changes.

#### Single type and scope

```txt
feat(module-es): add a

Description of a
```

#### Multiple types and/or scopes

```txt
feat(module-es): enhance error handling utilities

error.assert.throw: add assertion-based error throwing
- Implement conditional error throwing based on assertions
- Include TypeScript type narrowing support

error.throw: add unified error throwing utility
- Implement consistent error creation
- Provide better stack traces
- Include custom error types

test(module-es): achieve 100% coverage for error utilities
- Add comprehensive test cases
- Use parameterized tests for edge cases
- Ensure proper type inference testing
```

#### Rules

- Group related changes by type (feat, fix, test, etc.)
- Do not mix different types in the same scope section
- Be specific about what changed, not just which files
- Focus on "what" and "why"
- Flag partial commit messages (describing only some changes) as WARNING

### 12. CSS quality

When changes include CSS, check:

- Native platform features over JS reimplementations (`<dialog>`, Popover API, CSS nesting)
- `rem` for all sizing; `calc()` for derivation; no `px` except device-pixel contexts
- Logical properties everywhere (no physical `left`/`right`/`top`/`bottom`)
- No shorthand properties (exception: `inset: 0`)
- Colors via CSS custom properties; no `var()` fallbacks (exception: user-configurable)
- No `!important`
- `:focus-visible` on interactive elements; `48px` minimum touch targets
- Shallow native nesting (1-2 levels)
- Data attributes for state/variant styling, not BEM modifiers

#### Shorthand properties

```css
/* Bad -- flag as WARNING */
border: 1px solid #111;
padding: 0.5rem 1rem;

/* Good */
border-width: calc(1 / 16 * 1rem);
border-style: solid;
border-color: var(--gray-fg);
padding-block: 0.5rem;
padding-inline: 1rem;
```

#### Color tokens

```css
/* Bad -- flag as WARNING */
color: #111;
border-color: #a00;

/* Good */
color: var(--gray-fg);
border-color: var(--error-fg);
```

#### State styling

```html
<!-- Bad -- flag as NIT -->
<span class="pill pill--loading">

<!-- Good -->
<span class="pill" data-loading>
```

```css
/* Bad */
.pill--loading { opacity: 0.5; }

/* Good */
.pill { &[data-loading] { opacity: 0.5; } }
```

### 13. Script conventions

- No bash/shell scripts -- TypeScript only, executed with Bun
- Top-level code, no `main()` wrapper; top-level await for async
- No `process.exit()` -- throw errors instead

## Region markers

Flag missing `//region`/`//endregion` markers on substantial code blocks:

```ts
//region User Authentication Logic -- Handles user login, registration, and session management

function loginUser(credentials: UserCredentials): UserSession {
  return {} as UserSession;
}

function registerUser(details: UserDetails): UserProfile {
  return {} as UserProfile;
}

//endregion User Authentication Logic
```

## Output format

```
Summary: <one-line description of the change and overall assessment>

Findings:

BLOCKER:
- <file:line> <description and suggested action>

WARNING:
- <file:line> <description and suggested action>

NIT:
- <file:line> <description and suggested action>

NON-ACTIONABLE:
- <file:line> <description and best-effort ideas>
```

Omit empty severity sections.
If no issues found, write "No issues found" under Findings.

Every item in BLOCKER, WARNING, and NIT must include a concrete suggested action.
If you spot a real problem but cannot determine a specific fix, place it under NON-ACTIONABLE with best-effort ideas -- still report it, just be honest about uncertainty.

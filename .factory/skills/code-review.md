---
name: code-review
description: >
  Use when reviewing code changes, diffs, pull requests, or when the user asks
  for a code review, quality check, or feedback on their implementation.
  Use when examining staged changes, feature branches, or specific files
  for correctness, style, security, and maintainability issues.
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

### 3. Immutability and style

- `const` over `let`; no unnecessary mutation
- **Justify or refactor**: any deviation from the preferred pattern must have a comment explaining why refactoring to the preferred approach is not feasible; if no justification is given, flag it as WARNING
- Functional patterns (`map`/`filter`/`reduce`) over imperative loops
- `for...of` when iteration is unavoidable, never classic `for` loops
- No single-letter variables (except math formulas)
- Magic numbers/strings extracted to named constants (0, 1, 2, -1, -2 exempt)
- Every source code file must be less than 100 lines unless a justification comment is given; flag unjustified files as WARNING (test, fixture, config, and doc files are exempt)
- Extract and name complex conditions

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

### 6. Async patterns

- `async`/`await` over raw promises or callbacks
- No `.then()`, `.catch()`, `.finally()` -- use `async`/`await` with `try`/`catch` or let errors propagate naturally by throwing
- `Promise.all` for independent concurrent operations
- `Promise.allSettled` when partial failure is acceptable
- No `await` in loops without justification and eslint-disable comment
- `AbortController` for cancellable operations
- Streams and subprocesses properly consumed or cleaned up

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
- Multi-line error messages use template literals or equivalent
- `@throws` in TSDoc for functions that throw

### 9. Markdown quality

- No tables in markdown files -- use nested headings or lists instead
- Flag any existing tables in changed markdown files as WARNING with a suggestion to convert

### 10. Testing gaps

- New logic paths missing corresponding test cases
- Edge cases not covered (empty input, boundary values, error paths)
- Mocking that hides real integration issues
- Flaky patterns (timing dependencies, shared mutable state)

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

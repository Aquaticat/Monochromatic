# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monochromatic is a TypeScript monorepo ecosystem for web development, featuring:
- Reusable development tool configurations
- Functional programming utilities library
- CSS framework (Monochromatic design system)
- Figma plugin tools
- Documentation sites

## Essential Commands

### Initial Setup
```bash
# Install moon globally first
npm install -g @moonrepo/cli

# Setup project
moon run prepare
pnpm install
```

### Development Commands
```bash
# Build everything
moon run build

# Build and watch (recommended for development)
moon run buildWatch

# Run all tests
moon run test

# Run unit tests with coverage report (from workspace root only)
moon run testUnit

# Test in watch mode (run separately for performance)
vitest watch

# Build and test together
moon run buildAndTest

# Full development mode (build + test watch)
moon run buildAndTestWatch
```

### Linting and Formatting
```bash
# Check linting
pnpm run b:lint_eslint
pnpm run b:lint_dprint

# Fix linting issues
pnpm run b:format_eslint
pnpm run b:format_dprint
```

### Package-Specific Commands
```bash
# Build specific package (replace 'es' with package name)
moon run es:js
moon run es:types

# Note: Unit tests use Vitest projects feature and can only be run from workspace root
# To run tests for a specific file pattern:
vitest run src/boolean.equal.unit.test.ts
```

## Architecture

### Monorepo Structure
```
packages/
├── config/         # Shareable tool configurations (ESLint, TypeScript, Vite, etc.)
├── module/es/      # Functional programming utilities with dual Node/browser builds
├── style/monochromatic/  # CSS framework
├── site/astro-test/      # Documentation site
├── figma-plugin/         # Figma integration tools
└── build/                # Build utilities
```

### Build System
- **Package Manager**: pnpm with workspaces and catalog feature
- **Task Orchestration**: Moon CLI
- **Bundler**: Vite v7.0.0-beta.1+
- **Language**: TypeScript with strict type checking
- **Testing**: Vitest for unit and browser tests

### Key Architectural Decisions
1. **Dual Builds**: Packages tagged with `dualBuildsNodeBrowser` produce separate Node.js and browser outputs
2. **Platform-Specific Code**: Use `.node.ts` for Node-only, `.default.ts` for browser/universal
3. **Output Structure**: `dist/final/` for builds, `dist/final/types/` for type definitions
4. **Functional Programming**: Pure functions, immutable data, explicit types

## TypeScript conventions

### Generally

- Adhere to the established linting and formatting configurations (ESLint, Oxlint, dprint).

### Code organization

- Use `region` markers to delineate logical sections of code.
  - This practice enhances code organization and readability, particularly in larger files.
  - Most IDEs recognize `region` and `endregion` comments, allowing these sections to collapse or expand, which aids in navigation.
  - Following `//region` is the purpose of the code block. Following the purpose of the code block, after double hyphens, is the long explanation of the code block.
  - Following `//endregion` repeats the purpose of the code block.
  - Example:
    ```ts
    //region User Authentication Logic -- Handles user login, registration, and session management

    function loginUser(credentials: UserCredentials): UserSession {
      // ... complex login implementation ...
      return {} as UserSession;
    }

    function registerUser(details: UserDetails): UserProfile {
      // ... complex registration implementation ...
      return {} as UserProfile;
    }

    // ... other related functions ...

    //endregion User Authentication Logic
    ```

### Import and module conventions

- Always include file extensions when importing files.
- Group imports in the following order:
  1. Node.js built-in modules
  2. External dependencies
  3. Internal workspace packages
  4. Relative imports (same directory and subdirectories)
  5. Type-only imports (using `import type`)
- Use absolute imports for workspace packages (for example, `@monochromatic-dev/module-es`).
- Prefer named imports over default imports for better tree-shaking.
- Use `import type` for type-only imports to improve build performance.

### Function declarations

- Always name functions. Prefer function declarations.
  - For arrow functions, make sure the JavaScript engine can infer a name.
- Prefer function declarations (`function foo() {}`) for hoistability. For readability, aim to declare functions before their first use.
- Always use parentheses around arrow function parameters.
  - This applies even for a single parameter.
  - dprint enforces this.
- Avoid handling to preserve `this`; prefer arrow functions for callbacks or methods that need to capture `this` from the lexical scope.
- Throw and return early in functions.
- Use function overloads for functions with multiple call signatures.
  - Place overloads before the implementation.
  - Order overloads from most specific to least specific.

### Type definitions and safety

- Provide explicit parameter and return types for all functions, methods, and class accessors.
- Prefer `type` aliases (for example, `type MyType = { /* ... */ };`) over `interface` declarations for defining object shapes, per the `typescript/consistent-type-definitions` lint rule.
- Use `Record<KeyType, ValueType>` for types representing key-value maps (for example, `Record<string, number>`), per the `typescript/consistent-indexed-object-style` lint rule.
- Avoid using the generic `Function` type.
  - Prefer more specific function signatures, such as `(...args: any) => any`, or ideally, define explicit parameters and return types.
  - The `typescript/no-unsafe-function-type` lint rule guides this.
- Avoid declaring unused and optional parameters in `Generator<T>` and `AsyncGenerator<T>` types.
- Use union types instead of enums when possible for better tree-shaking.
- Prefer `as const` assertions for literal types and readonly arrays.
- Use branded types for domain-specific primitives:
  ```ts
  type UserId = string & { readonly __brand: unique symbol };
  type EmailAddress = string & { readonly __brand: unique symbol };
  ```

### Generics and type parameters

- Prefer `const` generic type parameters to enhance type safety and immutability.
  - Good: `function processItems<const T extends { id: string }>(items: T[]): T[]`
  - Bad: `function processItems<T extends { id: string }>(items: T[]): T[]`
- Prefix `readonly` modifier for array parameters. This make the function accept both mutable and immutable arrays, giving it more versitility.
  - Good: `function myFn<const T>(myArr: readonly T[]): T[] { return myArr; }`
  - Bad: `function myFn<const T>(myArr: T[]): T[] { return myArr; }`
- Use generics for `T[]`s, `Iterable<T>`s, `MaybeAsyncIterable<T>`s to ensure the output type doesn't lose fidelity.
  - Good: `function myFn<const T>(myArr: readonly T[]): T[] { return myArr; }`
  - Bad: `function myFn(myArr: readonly unknown[]): unknown[] { return myArr; }`
- Use meaningful constraint names for generic parameters:
  - Good: `<TData extends Record<string, unknown>>`
  - Bad: `<T extends Record<string, unknown>>`
- Apply constraints to generic parameters when appropriate:
  ```ts
  function processItems<const T extends { id: string }>(items: T[]): T[] {
    return items.filter((item) => item.id.length > 0);
  }
  ```

### Generator function overloading

TypeScript's support for overloading generator functions has some quirks:
- For a sync generator, remove the star sign in non-implementation overload signatures.
- For an async generator, remove both the `async` modifier and the star sign in non-implementation overload signatures.
- This is so TypeScript can correctly determine they're overloads.

### Variable declarations and immutability

- Prefer `const` over `let` to encourage immutability and prevent accidental reassignment. Only use `let` when a variable's value must change.
- Strive for immutability: Avoid reassigning variables (use `const`), modifying objects or arrays in place, and prefer functions that return new instances rather than mutating their inputs.
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables.
  - However, you may use the literal numbers `1, -1, 0, 2, -2` directly, as configured in the `eslint/no-magic-numbers` lint rule.
- Use `satisfies` operator for type checking without widening:
  ```ts
  const config = {
    apiUrl: "https://api.example.com",
    timeout: 5000,
  } satisfies Config;
  ```

### Async programming

- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation.
- Avoid using await in loops wherever logically sound.
- Use `Promise.all()` for concurrent operations when order doesn't matter.
- Use `Promise.allSettled()` when you need results from all promises regardless of failures.
- Handle promise rejections explicitly with try-catch blocks.
- Consider using `AbortController` for cancellable async operations.

### Error handling

- Create custom error classes that extend `Error` for domain-specific errors:
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
- Prefer throwing errors over returning error codes or null values or result types.
  - Use `@throws` in TSDoc to signal when a function throws.
    ```ts
    /**
     * Divides two numbers.
     * @param numerator - to be divided.
     * @param denominator - by which to divide.
     * @throws {RangeError} If the denominator is zero.
     * @returns result of the division.
     */
    function divide(numerator: number, denominator: number): number {
      if (denominator === 0) {
        throw new RangeError("Cannot divide by zero");
      }
      return numerator / denominator;
    }
    ```
- Use assertion functions for runtime type checking:
  ```ts
  function assertIsString(value: unknown): asserts value is string {
    if (typeof value !== "string") {
      throw new TypeError("Expected string");
    }
  }
  ```

### Class design

- Prefer composition over inheritance.
- Use `readonly` for properties that shouldn't change after construction.
- Make class methods `private` by default, only expose what's necessary.
- Use `#private` fields for truly private data (not accessible via bracket notation).
- Implement interfaces explicitly when a class should conform to a contract.
- Use abstract classes sparingly, prefer interfaces and composition.

### Performance considerations

- Use `unknown` instead of `any` for better type safety.
- Prefer type assertions (`as`) over angle bracket syntax (`<Type>`).
- Use type guards for runtime type checking:
  ```ts
  function isString(value: unknown): value is string {
    return typeof value === "string";
  }
  ```
- Avoid deep nesting in conditional types to prevent performance issues.
- Use `satisfies` instead of type assertions when possible.
- Consider using `const` assertions for immutable data structures.

### Documentation standards

Write comprehensive TSDoc comments for all exported members (functions, types, constants, classes, and everything else):
- This includes providing descriptions for parameters and return values.
- Adhere to the `eslint-plugin-jsdoc` recommended rules, TSDoc variant.
- Use `{@inheritDoc originalFn}` for a function that's the mere non-async variant of the original function.
- Avoid `the`, `a`, `an` in `@param` or `@returns` description.
  - Good: `@returns Set containing all unique elements from the input iterable.`, `@param iterable - to convert.`
  - Bad: `@returns A set containing all unique elements from the input iterable.`, `@returns The set containing all unique elements from the input iterable.`, `@param iterable - the iterable to convert.`
- Avoid repeating the name of the parameter without adding additional context in `@param` description.
  - Good: `@param iterable - to convert.`, `@param numerator - to be divided.`
  - Bad: `@param iterable - iterable to convert.`, `@param numerator - number to be divided.`
- For async functions, assume users are using `await` syntax to consume their results and don't need the docs to tell them the function technically returns a promise.
  - Good: `Converts Iterable to Set.`, `@returns Set containing all unique elements from the input iterable.`
  - Bad: `Converts Iterable to Promise<Set>.`, `@returns Promise that resolves to Set containing all unique elements from the input iterable.`
- Use `@example` tags to provide usage examples:
  ```ts
  /**
   * Calculates the sum of two numbers.
   * @param a - First number
   * @param b - Second number
   * @returns Sum of the two numbers
   * @example
   * ```ts
   * const result = add(2, 3); // 5
   * ```
   */
  function add(a: number, b: number): number {
    return a + b;
  }
  ```

### Testing requirements

- Write a corresponding Vitest file that aims for 100% test coverage.
- If certain lines or branches cannot be tested (e.g., error handling for impossible states), use v8 ignore comments:
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
- Use descriptive test names that explain the expected behavior.
- Group related tests using `describe` blocks.
- Use `it.each` for parameterized tests.
- Mock external dependencies using Vitest's mocking capabilities.
- Test both happy path and error scenarios.
- Use type-level tests for complex type utilities:
  ```ts
    import {
      type IsArrayFixedLength,
    } from '@monochromatic-dev/module-es';
    import {
      describe,
      expectTypeOf,
      test,
    } from 'vitest';

    await logtapeConfigure(await logtapeConfiguration());

    describe('ArrayFixedLength', () => {
      test('IsArrayFixedLength', () => {
        expectTypeOf<IsArrayFixedLength<[number, string]>>().toEqualTypeOf<true>();
      });
    });
  ```
- Always start Vitest files with:
  ```ts
  import {
    // members to test. Examples:
    // equal,
    // everyIterable,
    // everyIterableAsync,

    // Logging library used.
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

## Dependency Management
- Use `workspace:*` for internal dependencies
- `strictPeerDependencies: true` enforces exact versions
- Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`
- `nodeLinker: isolated` for isolated node_modules

## Common Patterns

### Adding a New Package
1. Create directory under appropriate category in `packages/`
2. Add `moon.yml` with appropriate tags
3. Configure `package.json` with workspace dependencies
4. Set up dual builds if needed (tag: `dualBuildsNodeBrowser`)

### Git Commit Guidelines

Follow the Conventional Commits specification for all commit messages to ensure consistency and enable automated tooling.

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (white-space, formatting)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes to build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

#### Scope
Use the package name or area of change:
- `module-es`: For changes in the ES module package
- `style`: For CSS framework changes
- `config`: For configuration package changes
- `*`: For changes affecting multiple packages

#### Subject Line Rules
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

#### Body Guidelines
- Wrap at 72 characters
- Explain what and why, not how
- Include motivation for change and contrast with previous behavior

#### Breaking Changes
- Add `BREAKING CHANGE:` in footer
- Or append `!` after type/scope: `feat(api)!: remove deprecated methods`

#### Examples

**Single Change:**
```
feat(module-es): add type guards for primitive values

Implements comprehensive type guard functions for checking primitive
JavaScript values including strings, numbers, booleans, null, and
undefined. These guards provide both runtime checking and TypeScript
type narrowing.

Closes #123
```

**Multiple Changes in One Commit:**
```
feat(module-es): enhance error handling utilities

error.assert.throw: add support for async error assertions
- Implement assertThrowAsync for testing async functions
- Add convenience methods for common error types
- Include TypeScript type narrowing for caught errors

error.throw: add comprehensive type assertion guards
- Implement notNullishOrThrow, notEmptyOrThrow, etc.
- Provide detailed TypeScript type refinement
- Include helpful error messages with actual values

test: achieve 100% coverage for error utilities
- Add unit tests for all error handling functions
- Use v8 ignore comments for unreachable branches
- Ensure all edge cases are covered
```

**Breaking Change:**
```
refactor(module-es)!: rename type assertion functions

BREAKING CHANGE: All type assertion functions now follow the
pattern `not{Type}OrThrow` instead of `assert{Type}`. This provides
better consistency with the library's naming conventions.

Migration guide:
- assertNotNull() → notNullOrThrow()
- assertNotEmpty() → notEmptyOrThrow()
- assertDefined() → notUndefinedOrThrow()
```

**Fix with Details:**
```
fix(module-es): correct type inference in array utilities

The generic constraint for array.filter was too restrictive, causing
TypeScript to lose type information when filtering arrays of union
types. Updated the constraint to preserve full type fidelity.

Previously: filter<T>(arr: T[]) → T[]
Now: filter<const T>(arr: readonly T[]) → T[]

Fixes #456
```

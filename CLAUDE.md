# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- vale Microsoft.Wordiness = NO -->
<!-- vale alex.Condescending = NO -->
FORBIDDEN LANGUAGE PATTERNS:
- Apologies: "sorry", "I apologize", "my apologies", "unfortunately", "I'm afraid"
- Vague validation: "that's a good point", "I understand your concern"
- Generalizations: "typically", "usually", "in most cases", "generally speaking"
- Flattery: "excellent question", "great idea", "you're absolutely right", "exactly"
- Performative empathy: "I can imagine how frustrating", "that must be difficult"
- Excessive assurance: "rest assured", "I promise", "you can be confident that"
- Submissive language: "if that's okay", "would it be alright if", "I hope you don't mind"
- Verbal backspacing: "actually", "to clarify", "what I meant was", "let me rephrase"
- Fillers: "okay", "great", "certainly", "here is", "of course", "definitely"
- Self-deprecation: "I should have", "I could have done better", "my mistake"

COMMUNICATION STYLE:
- State facts directly without hedging
- Give clear answers without softening language
- Use declarative statements, not apologetic qualifiers
- Provide information efficiently without relationship management

WHEN YOU MAKE ERRORS:
- State the correction: "That's incorrect. The actual answer is..."
- Provide the right information immediately

WHEN YOU CAN'T HELP:
- "I can't do that"
- "That information isn't available"
- "Try `specific alternative`"

Your job is to provide useful information efficiently. Emotional labor isn't your responsibility.
<!-- vale Microsoft.Wordiness = YES -->
<!-- vale alex.Condescending = YES -->

EMOJI USAGE:
- NEVER use emojis in any content meant to be read by humans.
- Focus on clear, professional text without decorative elements

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

# Run all tests (from workspace root only)
moon run test

# Run unit tests with coverage report (from workspace root only)
moon run testUnit

# Note: Tests can only be run from workspace root
# To run tests for a specific file pattern:
moon run testUnit -- packages/module/es/src/boolean.equal.unit.test.ts
moon run testBrowser -- packages/module/es/src/boolean.equal.browser.test.ts

# Test in watch mode (not recommended, will provide wrong coverage result)
moon run testWatch

# Clear moon cache (useful when debugging cached tasks)
moon clean --lifetime '1 seconds'

# Build and test together
moon run buildAndTest

# Full development mode (build + test watch)
moon run buildAndTestWatch
```

### Linting and Formatting

Don't run linters or formatters. The user will run them themselves.

### Package-Specific Commands
```bash
# Build specific package (replace 'es' with package name)
moon run es:js
moon run es:types
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
- **Testing**: Vitest for unit and browser tests. The only working test command is `moon run test` from workspace root. To run a specific test, do `moon run testUnit -- <fileRelativePath>`

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
- Prefer immediately invoked function expressions (IIFEs) over mutable variables for conditional value computation:
  ```ts
  // Instead of: let valeExists = false; followed by mutations
  const valeExists = (function getVale(platform: NodeJS.Platform): boolean {
    try {
      execSync(platform === 'win32' ? 'where.exe vale' : 'which vale', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })(currentPlatform);
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
- If certain lines or branches can't be tested (example: error handling for impossible states), use v8 ignore comments:
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

When writing commit messages for multiple changes across different files, include ALL changes in a single comprehensive commit message.
Don't write commit messages that only describe partial changes.

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types
- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`

#### Scope
Use the package name or area of change:
- `module-es`
- `*`: For changes affecting multiple packages

#### Examples

**Change of one type and scope:**
```
feat(module-es): add a

Description of a

Closes #123
```

**Change of multiple types and/or scopes**
```
feat(module-es): enhance error handling utilities

error.assert.throw: add a
- Implement b
- Include c

error.throw: add d
- Implement e
- Provide f
- Include g

test(module-es): achieve 100% coverage for error utilities
- Add h
- Use i
- Ensure j
```

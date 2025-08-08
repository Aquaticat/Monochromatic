# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Be honest.

**IMPORTANT DATE REMINDER**: Always use the current date from the environment information provided in the system prompt. Today's date is shown in the <env> section. Never assume or guess dates.

Forbidden language patterns:
- Apologies: "sorry", "I apologize", "my apologies", "unfortunately", "I'm afraid"
- Vague validation: "that's a good point", "I understand your concern"
- Generalizations: "typically", "usually", "in most cases", "generally speaking"
- Flattery: "excellent question", "great idea", "you're absolutely right", "exactly", "you're right", "you're correct"
- Performative empathy: "I can imagine how frustrating", "that must be difficult"
- Excessive assurance: "rest assured", "I promise", "you can be confident that"
- Submissive language: "if that's okay", "would it be alright if", "I hope you don't mind"
- Verbal backspacing: "actually", "to clarify", "what I meant was", "let me rephrase"
- Fillers: "okay", "great", "certainly", "here is", "of course", "definitely", "perfect"
- Self-deprecation: "I should have", "I could have done better", "my mistake"
- Collective language in documentation: "we", "our", "we chose", "we use", "our philosophy"
- Prescriptive language: "should", "must" (except for critical requirements), "ought to"
- Meta-references: "the project", "this means", "this aligns with"

Forbidden acknowledgement patterns:
- "You're right", "You're correct", "You're absolutely right"
- "That's right", "That's correct", "Exactly right"
- "Good point", "Good catch", "Nice catch"
- Instead: Jump directly to the technical response

Communication style:
- State facts directly without hedging
- Give clear answers without softening language
- Use declarative statements, not apologetic qualifiers
- Provide information efficiently without relationship management

When you make errors:
- State the correction: "That's incorrect. The actual answer is..."
- Provide the right information immediately

When you can't help:
- "I can't do that"
- "That information isn't available"
- "Try `specific alternative`"

When users point out issues or suggest improvements:
- Don't acknowledge they're right/correct
- Don't apologize for the error
- Simply implement the change and explain what was done
- Jump directly to fixing the issue or implementing the suggestion

Emoji usage:
- NEVER use emojis in any content meant to be read by humans.
- Focus on clear, professional text without decorative elements

Capitalization:
- NEVER use ALL CAPS for headings or emphasis in documentation
- Use sentence case for headings
- For emphasis, use **bold** formatting instead of capitalization

Handling external changes:
- When files have been modified externally, acknowledge the change
- Ask for clarification before reverting or modifying externally changed content
- Don't proceed with implementing features that won't achieve their intended effect
- If a tool/command doesn't support the requested functionality, explain this instead of creating non-functional code

Script preferences:
- NEVER write bash/shell scripts (non-portable, unreadable, unfamiliar)
- When scripts are needed, create TypeScript files as `moon.<action>.ts` in `packages/module/es/src/`
- Use Bun to execute TypeScript scripts directly
- Avoid creating main() functions
  - Instead of wrapping code in a main() function, write top-level code directly
  - Bad: `function main() { /* code */ } main();`
  - Good: Just write the code at the top level
  - For async operations, use top-level await: `await someAsyncOperation();`
- Avoid exiting with 0; just let the program naturally run to the end
  - Bad: `process.exit(0);` at the end of successful execution
  - Good: Let the script complete naturally
  - The Node.js/Bun runtime will exit with code 0 automatically when the script finishes
- NEVER use process.exit() - throw errors instead
  - Bad: `process.exit(1);`
  - Good: `throw new Error('Error description');`
  - Uncaught errors automatically set exit code to 1

## Search Tools

- **`ripgrep` (rg)** is available in this environment for fast text searching
- Use `rg` directly with Bash tool for searching specific strings, types, or patterns
- **Don't waste time navigating `pnpm`'s complex node_modules structure** - just search everywhere at once
- Examples:
  - `rg "interface AnalyzeOptions" -t ts` (searches all TypeScript files)
  - `rg "export.*parseForESLint" --type ts`
  - `rg "functionName" -A 5 -B 5` (show 5 lines before/after matches)
- This is much faster than:
  - Using Grep tool
  - Trying to find the exact path in `pnpm`'s symlinked `.pnpm` directories
  - Guessing where packages are located

## Functional Programming Utilities

When composing functions:
- Use `piped` for synchronous function composition: `piped(input, fn1, fn2, fn3)`
- Use `pipedAsync` for async function composition: `await pipedAsync(input, fn1, asyncFn2, fn3)`
- Use `pipe` to create a reusable sync function pipeline: `const pipeline = pipe(fn1, fn2, fn3); pipeline(input)`
- Use `pipeAsync` to create a reusable async function pipeline: `const pipeline = pipeAsync(fn1, asyncFn2, fn3); await pipeline(input)`
- Functions generally don't require `.bind()` for `this` context unless specifically documented
  - Example: `pipedAsync(data, transform, index.addDocuments)` works fine without `.bind(index)`
  - Instance methods already have their context when referenced as `instance.method`

## Code Simplification Principles

Always question "Do you really need...?" for every construct:
- **Do you really need that mutable variable?** → Use `const` and immutable patterns
- **Do you really need that loop?** → Consider `map`, `filter`, `reduce`, or functional helpers
- **Do you really need that imperative code?** → Look for declarative/functional alternatives
- **Do you really need that complex solution?** → Start with the simplest approach
- **Do you really need to create promises directly?** → Use existing promise utilities like `wait()`

Progressive simplification example:
1. Imperative loop with mutable state → `while` loop with proper conditions
2. `while` loop → `for` loop with calculated iterations
3. `for` loop → Recursive function
4. Recursive function → Higher-order functions or async iterators

Always extract and name concepts (e.g., `isTaskPending()` instead of inline conditions)

## Third-Party Library Usage

When working with third-party libraries:
- **IMMEDIATELY retrieve documentation when encountering undefined method errors**
  - The moment you see errors like "X is not a function", "Cannot read property X of undefined", or "X is undefined"
  - Use ALL available documentation tools to understand the correct API:
    - `context7` for library documentation
    - `exa:crawling` to fetch from `https://www.npmjs.com/package/<package-name>`
    - `github:search_code` or `github:get_file_contents` to find usage examples
    - `WebSearch` for recent documentation and examples
  - NEVER guess or assume API methods exist - always verify first
- **Always retrieve documentation from GitHub or npm pages** when implementing features with third-party libraries
  - For npm packages: Use `exa:crawling` to fetch from `https://www.npmjs.com/package/<package-name>`
  - For GitHub repos: Use `github:get_file_contents` to fetch from the library's GitHub page
  - This ensures you have the most up-to-date API documentation and usage examples
- Always check the actual type definitions before using APIs
- Read the actual source types, not just documentation (which may be outdated)
- When encountering type errors, read the error message carefully - it often shows what's actually expected

## CLI Tool Documentation Analysis

When working with CLI tools and their documentation:
- **Pay attention to command patterns in examples** - tools often have their own execution conventions
  - Look for patterns across multiple examples, not just individual commands
  - Notice what's consistent vs what varies (e.g., `uv run example.py` vs `uv run --with dep example.py`)
- **Don't assume traditional execution patterns** - modern tools often wrap execution
  - `uv run script.py` NOT `uv run python script.py`
  - `npx script.js` NOT `npx node script.js`
  - Many tools handle interpreter invocation automatically
- **When you see multiple examples of the same pattern, trust it** - documentation examples are usually correct
- **Test assumptions with the simplest case first** - try the minimal command before adding complexity
- **Read error messages carefully** - they often reveal the correct usage pattern

## Working with Third-Party Repositories

When setting up or integrating third-party tools:
- **Never modify files in cloned third-party repositories**
  - This breaks git pull/update workflows
  - Makes it difficult to track upstream changes
  - Creates merge conflicts when updating
- **Always prefer configuration-based solutions**
  - Use external config files (e.g., ~/.claude.json for MCP servers)
  - Use command-line arguments and environment variables
  - Create wrapper scripts in a separate location if needed
- **If modifications seem necessary, find alternatives**
  - Look for official configuration mechanisms
  - Use the tool's intended extension points
  - Create a fork only if you need permanent modifications
- **Keep third-party repos pristine**
  - Allows easy updates with `git pull`
  - Prevents accidental commits to upstream
  - Maintains clear separation between your code and dependencies

## Tool Version Management

- **Only pin tool versions when necessary** with clear justification
- If pinning is required, always include comments explaining why
- Example: `# Pin to v1.2.3 - v1.3.0 introduced breaking API changes`
- Document version requirements in both the pinning file and README
- Regularly review pinned versions to check if constraints still apply

## Project Overview

Monochromatic is a TypeScript monorepo ecosystem for web development, featuring:
- Reusable development tool configurations
- Functional programming utilities library
- CSS framework (Monochromatic design system)
- Figma plugin tools
- Documentation sites

## Essential Commands

**IMPORTANT**: All builds and tasks are managed by Moon. Never run `pnpm exec` or direct package scripts. Always use `moon run` commands.

### Initial Setup
```bash
# Install moon globally first
npm install -g @moonrepo/cli

# Setup project
moon run prepare
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

### Building Projects
**IMPORTANT**: When rebuilding after configuration changes (like ESLint rules), always use `moon run build` to rebuild all projects at once. Moon's caching system ensures this is efficient and won't unnecessarily rebuild unchanged projects. This approach is preferred over building individual packages.

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
- **Package Manager**: pnpm with workspace and catalog feature
- **Task Orchestration**: Moon CLI (runs task dependencies in parallel by default)
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
- **Use `.ts` extensions in imports when `allowImportingTsExtensions` is enabled** (not `.js`)
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
  - `dprint` enforces this.
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
- Prefix `readonly` modifier for array parameters. This make the function accept both mutable and immutable arrays, giving it more versatility.
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
- **NEVER use single-letter variables like `i`, `j`, `k`** - they provide no semantic meaning
  - Bad: `for (let i = 0; i < items.length; i++)`
  - Good: `for (let itemIndex = 0; itemIndex < items.length; itemIndex++)`
  - Good: `items.forEach((item, itemIndex) => ...)`
  - Exception: Mathematical formulas where single letters have established meaning (e.g., `x`, `y` for coordinates)
- **Prefer functional approaches over imperative loops**:
  - Bad: Manual loop with mutable counter to count occurrences
  - Good: `string.split(delimiter).length - 1` or similar built-in methods
  - Use array methods (`map`, `filter`, `reduce`) over for loops
  - Use `for...of` when iteration is unavoidable, not traditional `for` loops
  - Always check if JavaScript/TypeScript provides a built-in method before writing manual loops
- Remove unused variables or prefix them with underscore (e.g., `_unusedVar`)
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables.
  - However, you may use the literal numbers `1, -1, 0, 2, -2` directly, as configured in the `eslint/no-magic-numbers` lint rule.
- Use `satisfies` operator for type checking without widening:
  ```ts
  const config = {
    apiUrl: "https://api.example.com",
    timeout: 5000,
  } satisfies Config;
  ```
- **Destructuring pattern with dependencies**: When destructuring multiple variables where some depend on others, use separate destructuring blocks
  - First block: Define independent variables
  - Second block: Define variables that depend on the first block
  - Example:
    ```ts
    // First block - independent variables
    const {
      searchForm,
      resultsSection,
    } = {
      searchForm: identity<HTMLFormElement>(notFalsyOrThrow(
        document.querySelector('.searchForm'),
      )),
      resultsSection: identity<HTMLElement>(notFalsyOrThrow(
        document.querySelector('.results'),
      )),
    };

    // Second block - depends on searchForm
    const {
      searchInput,
      submitButton,
    } = {
      searchInput: identity<HTMLInputElement>(notFalsyOrThrow(
        searchForm.querySelector('input'),
      )),
      submitButton: identity<HTMLButtonElement>(notFalsyOrThrow(
        searchForm.querySelector('button[type="submit"]'),
      )),
    };
    ```

### Export conventions

- **Avoid `Object.assign` for extending typed objects** - create a new const instead
  - Bad: `const plugin = {}; Object.assign(plugin.configs, {...});`
  - Good: Create a new const with explicit type that includes all properties:
    ```ts
    const plugin: FlatConfig.Plugin = { meta: {...}, configs: {} };
    const pluginWithConfig: FlatConfig.Plugin & { configs: { recommended: FlatConfig.Config[] } } = {
      ...plugin,
      configs: { recommended: [...] }
    };
    export default pluginWithConfig;
    ```
- This approach provides full type safety and never causes TypeScript complaints
- Always export at the end after all object construction is complete
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
- Always prefer `async/await` over callbacks; convert callback-based APIs to promises using `util.promisify()` or manual promisification
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
- Use `notNullishOrThrow` for TypeScript type narrowing instead of non-null assertion operator
  - The non-null assertion operator (`!`) is banned in this codebase
  - `import { notNullishOrThrow } from '@monochromatic-dev/module-es'` to assert values are non-nullish
  - Good: `const value = notNullishOrThrow(possiblyUndefined);`
  - Bad: `const value = possiblyUndefined!;`
  - If you don't want it to crash, properly check and handle the falsy/nullish value instead

- **NEVER use process.exit()** - it violates the ESLint n/no-process-exit rule
  - process.exit() immediately stops the Node.js process without allowing graceful cleanup
  - This can stop an application at any unexpected moment and doesn't give other parts a chance to handle errors
  - Bad: `if (error) { console.error('Error occurred'); process.exit(1); }`
  - Good: `if (error) { throw new Error('Error occurred'); }`
  - Throwing errors provides better stacktraces and allows parent code to handle errors
  - **Thrown errors automatically set exit code to 1** - no need to manually set process.exitCode
- **Combine console.log/error messages into thrown errors**
  - When you need to log an error message before throwing, include the entire message in the error
  - Bad: `console.error('Dependencies check failed'); console.error('Run: pnpm install'); throw new Error('Dependencies not installed');`
  - Good: `throw new Error('Dependencies check failed\nRun: pnpm install');`
  - This ensures error context is preserved in the error object itself
- **Use outdent for multi-line error messages**
  - For error messages with multiple lines, use `outdent` from `@cspotcode/outdent` instead of `\n`
  - Import: `import { outdent } from '@cspotcode/outdent';`
  - Bad: `throw new Error('Error message\nLine 2\nLine 3');`
  - Good:
    ```ts
    throw new Error(outdent`
      Error message
      Line 2
      Line 3
    `);
    ```
  - This provides better readability and automatic indentation handling
- **Use process.exitCode only for non-standard exit codes**
  - When you need a specific exit code other than 0 (success) or 1 (error), use process.exitCode
  - Example: `process.exitCode = 2;` for a specific error condition that needs code 2
  - The process will exit gracefully with your specified code after all async operations complete
- **Always log errors in catch blocks**:
  - Every catch block must log the caught error for debugging
  - Log ALL errors, even "expected" ones - the actual error might be different than expected
    - Example: You expect "index not found" but get "network timeout" instead
  - Use `console.error()` for errors, include context about what operation failed
  - Good: `catch (error) { console.error('Failed to get index stats:', error); }`
  - Bad: `catch (e) { /* silently ignore */ }` or `catch (e) { createIndex(); /* assume we know the error */ }`
  - **Document expected errors with comments**:
    ```ts
    try {
      await index.getStats();
    } catch (error) {
      // Expected error: index doesn't exist (404)
      // But could also be: network error, auth failure, etc.
      console.log('Creating index...', error);
    }
    ```
- **Avoid deprecated JavaScript/TypeScript features**:
  - Use `substring()` or `slice()` instead of deprecated `substr()`
  - Check MDN or TypeScript documentation for deprecation warnings
  - Prefer modern, supported alternatives

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

#### Technical documentation writing style

When writing technical documentation (README, philosophy, architecture docs):
- Write in active voice without collective pronouns
- State facts directly: "Astro for documentation" instead of "We chose Astro for our documentation"
- Avoid meta-references: write "Prioritizing portability" instead of "This aligns with the project's philosophy of portability"
- Use present tense for current state, future tense only for planned features
- Eliminate unnecessary connecting phrases and transitions

#### TSDoc comments

Write comprehensive TSDoc comments for all exported members (functions, types, constants, classes, and everything else):
- This includes providing descriptions for parameters and return values.
- **Use TSDoc format for EVERYTHING that can be documented** - functions, constants, types, interfaces, classes, enums, etc. Not just exported members.
- Any code element that could benefit from documentation should have TSDoc comments.
- Adhere to the `eslint-plugin-jsdoc` recommended rules, TSDoc variant.
- Use `{@inheritDoc originalFn}` for a function that's the mere non-async variant of the original function.

**Use TSDoc where supported, regular comments elsewhere:**

TSDoc (`/** */`) can be used for:
- Functions, methods, arrow functions
- Classes and class members (properties, methods)
- Interfaces and their properties
- Type aliases
- Enums and enum members
- Variables/constants (top-level)
- Namespaces/modules

TSDoc CANNOT be used for (use `//` or `/* */` instead):
- Expression statements (assignments, function calls, increments, etc.)
- Control flow statements (if, for, while, switch)
- Import/export statements
- Return statements
- Individual parameters in signatures
- Any comment that isn't immediately followed by a declaration

Key rule: TSDoc must directly precede a declaration (variable, function, class, type, etc.), not a statement or expression

**Comment placement:**
- NEVER use inline comments after code
- Always place comments on their own line above the code they describe

Examples:
```ts
// CORRECT usage
/** Frontmatter delimiter */
const DELIMITER = '---';

/** Result of parsing operation */
type Result = {
  /** Parsed data */
  data: string;
  /** Whether error occurred */
  error: boolean;
};

/** Process the input data */
function process() {
  // Regular comment for logic inside function
  if (!valid) {
    // Handle error case
    // Return null on error
    return null;
  }
}

// BAD - inline comments
const x = 5; // This is x
return null; // Return null on error

// GOOD - comments on their own line
// This is x
const x = 5;
// Return null on error
return null;

// INCORRECT - Don't use TSDoc where not supported
function badExample() {
  /** WRONG - TSDoc not supported inside functions */
  const x = 5;

  /** WRONG - TSDoc not supported for if statements */
  if (x > 0) {
    /** WRONG - TSDoc not supported for return */
    return x;
  }
}
```
- Avoid `the`, `a`, `an` in `@param` or `@returns` description.
  - Good: `@returns Set containing all unique elements from the input iterable.`, `@param iterable - to convert.`
  - Bad: `@returns A set containing all unique elements from the input iterable.`, `@returns The set containing all unique elements from the input iterable.`, `@param iterable - the iterable to convert.`
- Avoid repeating the name of the parameter without adding additional context in `@param` description.
  - Good: `@param iterable - to convert.`, `@param numerator - to be divided.`
  - Bad: `@param iterable - iterable to convert.`, `@param numerator - number to be divided.`
- **Comments should explain WHY, not WHAT**:
  - Good: `/** Mutable counter needed to track newlines encountered while scanning */`
  - Bad: `/** Line counter starting at 1 */`
  - Focus on intent, purpose, and design decisions
  - Explain why something is mutable when using `let`
  - Don't just restate what the code already shows
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
- Use descriptive test names that explain the expected behaviour.
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

## Markdown Conventions

### Text formatting
- One sentence per line for better diffs and readability
- Use **bold** for emphasis, avoid _italics_
- Prefer fenced code blocks with language tags over inline code for multi-line snippets
- Use inline code \`like this\` for single commands, function names, or short code

### Lists
- Use `-` for unordered lists with one space after
- Numbered lists: pad marker to 4 characters (e.g., `1.  `, `10. `)
- Maintain consistent indentation (2 spaces for nested items)
- Add blank lines before and after lists

### Code blocks
- Always specify language for syntax highlighting
- Use \`\`\`bash for shell commands, \`\`\`ts for TypeScript
- Include file paths as comments when showing file contents

### Links and references
- Use reference-style links for repeated URLs
- Prefer relative links for internal documentation
- Include descriptive link text, avoid "click here"

### Structure
- Use ATX-style headers (`#` not underlines)
- Maximum header depth: 4 levels (####)
- Add blank line before headers (except first)
- Keep line length under 120 characters when possible

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
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files (removing deprecated files, updating `.gitignore`, etc.)
- `revert`: Reverts a previous commit

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

**Important commit message rules:**
- Group related changes by type (feat, fix, test, etc.)
- Don't mix different types in the same scope section
- Be specific about what changed, not just which files
- Never use emojis in commit messages
- Focus on the "what" and "why", not just listing file changes

## Linting and Code Quality

### Identifying the linting tool
When fixing linting issues, first identify which tool reports the error:
- Check the lint output format: `monochromatic:lintOxlint | ! eslint-plugin-unicorn(error-message)` indicates Oxlint
- ESLint errors show as `eslint(rule-name)`
- Oxlint errors often include the plugin name like `eslint-plugin-unicorn(rule-name)`

### Common linting fixes

#### Testing intentional violations
When tests intentionally violate a rule to verify behaviour:
```ts
// BAD: Adding data to satisfy the linter
expect(isError(new Error('test message'))).toBe(true);

// GOOD: Use disable comments for intentional violations
// oxlint-disable-next-line unicorn/error-message -- Testing error without message
expect(isError(new Error())).toBe(true);
```

#### Magic numbers
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

#### Loops and iteration
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

#### Async patterns
- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(resolve, ms))`
- Add `eslint-disable-next-line no-await-in-loop` when sequential processing is required
- Import and use existing promise utilities instead of creating new promises

#### Type annotations
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

#### Import patterns
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

#### Null checks
Use explicit comparisons instead of `!=` or `==`:
```ts
// BAD
if (value != null) { }

// GOOD
if (value !== null && value !== undefined) { }
```

#### Module disambiguation
For scripts that might be parsed as CommonJS, add an export:
```ts
// At the end of the file
export {};
```

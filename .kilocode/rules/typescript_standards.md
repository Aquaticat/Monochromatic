# TypeScript Standards

## General Guidelines
- Adhere to the established linting and formatting configurations (ESLint, Oxlint, dprint)

## Code Organization
- Use `region` markers to delineate logical sections of code
  - This practice enhances code organization and readability, particularly in larger files
  - Most IDEs recognize `region` and `endregion` comments, allowing these sections to collapse or expand
  - Following `//region` is the purpose of the code block. After double hyphens, provide a long explanation
  - Following `//endregion` repeats the purpose of the code block
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

    //endregion User Authentication Logic
    ```

## Import and Module Conventions
- Always include file extensions when importing files
- **Use `.ts` extensions in imports when `allowImportingTsExtensions` is enabled** (not `.js`)
- Group imports in the following order:
  1. Node.js built-in modules
  2. External dependencies
  3. Internal workspace packages
  4. Relative imports (same directory and subdirectories)
  5. Type-only imports (using `import type`)
- Use absolute imports for workspace packages (for example, `@monochromatic-dev/module-es`)
- Prefer named imports over default imports for better tree-shaking
- Use `import type` for type-only imports to improve build performance

## Function Declarations
- Always name functions. Prefer function declarations
  - For arrow functions, make sure the JavaScript engine can infer a name
- Prefer function declarations (`function foo() {}`) for hoistability
- Always use parentheses around arrow function parameters
  - This applies even for a single parameter
  - `dprint` enforces this
- Avoid binding to preserve `this`; prefer arrow functions for callbacks
- Throw and return early in functions
- Use function overloads for functions with multiple call signatures
  - Place overloads before the implementation
  - Order overloads from most specific to least specific

## Type Definitions and Safety
- Provide explicit parameter and return types for all functions, methods, and class accessors
- Prefer `type` aliases over `interface` declarations for object shapes
- Use `Record<KeyType, ValueType>` for key-value maps
- Avoid using the generic `Function` type
  - Prefer more specific function signatures like `(...args: any) => any`
- Avoid declaring unused and optional parameters in `Generator<T>` and `AsyncGenerator<T>` types
- Use union types instead of enums when possible for better tree-shaking
- Prefer `as const` assertions for literal types and readonly arrays
- Use branded types for domain-specific primitives:
  ```ts
  type UserId = string & { readonly __brand: unique symbol };
  type EmailAddress = string & { readonly __brand: unique symbol };
  ```

## Generics and Type Parameters
- Prefer `const` generic type parameters to enhance type safety and immutability
  - Good: `function processItems<const T extends { id: string }>(items: T[]): T[]`
  - Bad: `function processItems<T extends { id: string }>(items: T[]): T[]`
- Prefix `readonly` modifier for array parameters for versatility
  - Good: `function myFn<const T>(myArr: readonly T[]): T[] { return myArr; }`
  - Bad: `function myFn<const T>(myArr: T[]): T[] { return myArr; }`
- Use generics for arrays and iterables to ensure output type fidelity
- Use meaningful constraint names for generic parameters:
  - Good: `<TData extends Record<string, unknown>>`
  - Bad: `<T extends Record<string, unknown>>`
- Apply constraints to generic parameters when appropriate

## Generator Function Overloading
TypeScript's support for overloading generator functions has quirks:
- For sync generators, remove the star sign in non-implementation overload signatures
- For async generators, remove both the `async` modifier and star sign in non-implementation overload signatures
- This allows TypeScript to correctly determine they're overloads

## Variable Declarations and Immutability
- Prefer `const` over `let` to encourage immutability
- Strive for immutability: avoid reassigning variables and modifying objects in place
- **NEVER use single-letter variables like `i`, `j`, `k`** - they provide no semantic meaning
  - Bad: `for (let i = 0; i < items.length; i++)`
  - Good: `for (let itemIndex = 0; itemIndex < items.length; itemIndex++)`
  - Good: `items.forEach((item, itemIndex) => ...)`
  - Exception: Mathematical formulas where single letters have established meaning
- **Prefer functional approaches over imperative loops**:
  - Use array methods (`map`, `filter`, `reduce`) over for loops
  - Use `for...of` when iteration is unavoidable, not traditional `for` loops
  - Always check if JavaScript/TypeScript provides a built-in method before writing manual loops
- Remove unused variables or prefix them with underscore (e.g., `_unusedVar`)
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables
  - Exception: you may use the literal numbers `1, -1, 0, 2, -2` directly
- Use `satisfies` operator for type checking without widening:
  ```ts
  const config = {
    apiUrl: "https://api.example.com",
    timeout: 5000,
  } satisfies Config;
  ```
- **Destructuring pattern with dependencies**: When destructuring multiple variables where some depend on others, use separate destructuring blocks
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

## Export Conventions
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

## Async Programming
- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation
- Always prefer `async/await` over callbacks; convert callback-based APIs to promises
- Avoid using await in loops wherever logically sound
- Use `Promise.all()` for concurrent operations when order doesn't matter
- Use `Promise.allSettled()` when you need results from all promises regardless of failures
- Handle promise rejections explicitly with try-catch blocks
- Consider using `AbortController` for cancellable async operations

## Error Handling
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
- Prefer throwing errors over returning error codes or null values or result types
- Use `@throws` in TSDoc to signal when a function throws
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
  - `import { notNullishOrThrow } from '@monochromatic-dev/module-es'`
  - Good: `const value = notNullishOrThrow(possiblyUndefined);`
  - Bad: `const value = possiblyUndefined!;`
- **NEVER use process.exit()** - it violates the ESLint n/no-process-exit rule
  - Throwing errors provides better stacktraces and allows parent code to handle errors
  - **Thrown errors automatically set exit code to 1** - no need to manually set process.exitCode
- **Combine console.log/error messages into thrown errors**
  - When you need to log an error message before throwing, include the entire message in the error
  - Bad: `console.error('Failed'); console.error('Run: pnpm install'); throw new Error('Error');`
  - Good: `throw new Error('Dependencies check failed\nRun: pnpm install');`
- **Use outdent for multi-line error messages**
  - For error messages with multiple lines, use `outdent` from `@cspotcode/outdent`
  - Import: `import { outdent } from '@cspotcode/outdent';`
  - Good:
    ```ts
    throw new Error(outdent`
      Error message
      Line 2
      Line 3
    `);
    ```
- **Use process.exitCode only for non-standard exit codes**
  - When you need a specific exit code other than 0 (success) or 1 (error), use process.exitCode
  - Example: `process.exitCode = 2;` for a specific error condition
- **Always log errors in catch blocks**:
  - Every catch block must log the caught error for debugging
  - Log ALL errors, even "expected" ones - the actual error might be different than expected
  - Use `console.error()` for errors, include context about what operation failed
  - Good: `catch (error) { console.error('Failed to get index stats:', error); }`
  - Bad: `catch (e) { /* silently ignore */ }`
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

## Class Design
- Prefer composition over inheritance
- Use `readonly` for properties that shouldn't change after construction
- Make class methods `private` by default, only expose what's necessary
- Use `#private` fields for truly private data (not accessible via bracket notation)
- Implement interfaces explicitly when a class should conform to a contract
- Use abstract classes sparingly, prefer interfaces and composition

## Performance Considerations
- Use `unknown` instead of `any` for better type safety
- Prefer type assertions (`as`) over angle bracket syntax (`<Type>`)
- Use type guards for runtime type checking:
  ```ts
  function isString(value: unknown): value is string {
    return typeof value === "string";
  }
  ```
- Avoid deep nesting in conditional types to prevent performance issues
- Use `satisfies` instead of type assertions when possible
- Consider using `const` assertions for immutable data structures
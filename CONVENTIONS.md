When writing code in TypeScript, try to:

- Adhere to the established ESLint and formatting configurations (ESLint, Oxlint, dprint).
- Prefer named functions; anonymous functions are acceptable, particularly for callbacks where context is clear.
- Avoid special handling to preserve `this`; prefer arrow functions for callbacks or methods that need to capture `this`
  from the lexical scope.
- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation.
- Write a corresponding Vitest file that aims for 100% test coverage.
- Prefer `const` generic type parameters to enhance type safety and immutability.
- Prefer function declarations (`function foo() {}`) for hoistability. For readability, aim to declare functions before
  their first use.
- Provide explicit parameter and return types for all functions, methods, and class accessors.
- Prefer `const` over `let` to encourage immutability and prevent accidental reassignment. `let` should only be used
  when a variable's value must change.
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables.
- Write JSDoc comments for all exported members to aid in documentation, IDE autocompletion, and discoverability.
- Always include file extensions when importing files.
- Strive for immutability: Avoid reassigning variables (use `const`), modifying objects or arrays in place, and prefer
  functions that return new instances rather than mutating their inputs.
- Utilize single quotes for strings (e.g., `'example'`) and JSX attributes, as enforced by dprint.
- Ensure all TypeScript statements are terminated with semicolons, as enforced by dprint.
- Apply trailing commas in multi-line arrays, objects, and type parameter lists, following dprint configurations.
- Prefer `type` aliases (e.g., `type MyType = { /* ... */ };`) over `interface` declarations for defining object shapes, per the `typescript/consistent-type-definitions` lint rule.
- Use `Record<KeyType, ValueType>` for types representing simple key-value maps (e.g., `Record<string, number>`), per the `typescript/consistent-indexed-object-style` lint rule.
- Note: The `eslint/no-unused-vars` lint rule is disabled. Rely on editor feedback for unused variables during development; they are removed by the bundler in production.

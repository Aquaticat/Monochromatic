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

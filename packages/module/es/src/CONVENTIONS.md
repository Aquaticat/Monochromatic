When writing code in TypeScript, try to:
- Follow eslint airbnb coding style.
- Avoid special handling to preserve `this`; prefer arrow functions for callbacks or methods that need to capture `this` from the lexical scope.
- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation to simplify asynchronous code and error handling.
- Write a corresponding Vitest file that aims for 100% test coverage.
- Prefer `const` generic type parameters to enhance type safety and immutability.
- Prefer function declarations (`function foo() {}`) for hoistability. For readability, aim to declare functions before their first use when practical.
- Provide explicit parameter and return types for all functions, methods, and class accessors.
- Prefer `const` over `let` to encourage immutability and prevent accidental reassignment. `let` should only be used when a variable's value must change.
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables with descriptive names at the top of the file or in a dedicated constants file.
- Use `camelCase` for variables, function names, and parameters (e.g., `myVariable`, `calculateValue`).
- Use `PascalCase` for class names, interface names, type aliases, and enum names (e.g., `MyClass`, `UserData`, `ColorOption`).
- Use `kebab-case` for file and directory names (e.g., `user-profile.ts`, `utility-functions.ts`).
- Write JSDoc comments for all exported functions, classes, types, and interfaces to aid in documentation, IDE autocompletion, and discoverability.
- Organize imports as follows:
  1. External library imports (e.g., `import React from 'react';`)
  2. Internal absolute path imports (e.g., `import { MyService } from 'src/services/my-service';`)
  3. Relative path imports (e.g., `import { helper } from './helpers';`)
  - Within each group, sort imports alphabetically by module name.
- Strive for immutability: Avoid reassigning variables (use `const`), modifying objects or arrays in place, and prefer functions that return new instances rather than mutating their inputs.
- Use a code formatter like Prettier (configured in the project) to ensure consistent code style and minimize stylistic debates.

Exclude fillers like "okay", "great", "certainly", "Here is".
Avoid emotional responses, vague validation, generalizations, flattery, performative empathy, excessive assurance,
submissive language, and verbal backspacing.

---

When writing code in TypeScript, try to:

- Adhere to the established linting and formatting configurations (ESLint, Oxlint, dprint).
- Always include file extensions when importing files.
- Always name functions. Prefer function declarations.
  - For arrow functions, make sure the JavaScript engine can infer a name.
- Always use parentheses around arrow function parameters.
  - This applies even for a single parameter.
  - This is enforced by dprint.
- Avoid declaring unused and optional parameters in `Generator<T>` and `AsyncGenerator<T>` types.
- Avoid special handling to preserve `this`; prefer arrow functions for callbacks or methods that need to capture `this`
  from the lexical scope.
- Avoid using await in loops.
- Avoid using the generic `Function` type.
  - Prefer more specific function signatures, such as `(...args: any) => any`,
    or ideally, define explicit parameters and return types.
  - This is guided by the `typescript/no-unsafe-function-type` lint rule.
- Declare magic numbers, strings, regexes, and similar literal values as `const` variables.
  - However, the literal numbers `1, -1, 0, 2, -2` may be used directly,
    as configured in the `eslint/no-magic-numbers` lint rule.
- Note: The `eslint/no-unused-vars` lint rule is disabled. Rely on editor feedback for unused variables during development; they are removed by the bundler in production.
- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation.
- Prefer `const` generic type parameters to enhance type safety and immutability.
- Prefer `const` over `let` to encourage immutability and prevent accidental reassignment. `let` should only be used
  when a variable's value must change.
- Prefer function declarations (`function foo() {}`) for hoistability. For readability, aim to declare functions before
  their first use.
- Prefer `type` aliases (e.g., `type MyType = { /* ... */ };`) over `interface` declarations for defining object shapes, per the `typescript/consistent-type-definitions` lint rule.
- Provide explicit parameter and return types for all functions, methods, and class accessors.
- Strive for immutability: Avoid reassigning variables (use `const`), modifying objects or arrays in place, and prefer
  functions that return new instances rather than mutating their inputs.
- Throw and return early in functions.
- TypeScript's support for overloading generator functions has some quirks.
  - For a sync generator, remove the star sign in non-implementation overload signatures.
  - For an async generator, remove both the `async` modifier and the star sign in non-implementation overload signatures.
  - This is so TypeScript can correctly determine they're overloads.
- Use `Record<KeyType, ValueType>` for types representing simple key-value maps (e.g., `Record<string, number>`), per the `typescript/consistent-indexed-object-style` lint rule.
- Use `region` markers to delineate logical sections of code.
  - This practice enhances code organization and readability, particularly in larger files.
  - Most IDEs recognize `region` and `endregion` comments, allowing these sections to be collapsed or expanded, which aids in navigation.
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
- Write a corresponding Vitest file that aims for 100% test coverage.
- Write comprehensive TSDoc comments for all exported members.
  - This includes providing descriptions for parameters and return values.
  - Adhere to the `eslint-plugin-jsdoc` recommended rules, TSDoc variant.
  - Use `{@inheritDoc originalFn}` for a function that is the mere non-async variant of the original function.

---

When writing Markdown files:

- Ensure each sentence or long phrase is on its own line.
- Bullet lists use the `-` marker.
- There should be one space after the marker.
- For numbered lists, pad the `1.` marker with enough space after it so it is always 4 characters long.
  - For example:
    1.  This is the first item.
    2.  This is the second item.

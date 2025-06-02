Exclude fillers like "okay", "great", "certainly", "Here is".
Avoid emotional responses, vague validation, generalizations, flattery, performative empathy, excessive assurance,
submissive language, and verbal backspacing.

---

When writing code in TypeScript, try to:

- Adhere to the established linting and formatting configurations (ESLint, Oxlint, dprint).
- Prefer named functions; anonymous functions are acceptable, particularly for callbacks where context is clear.
- Throw and return early in functions.
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
  - However, the literal numbers `1, -1, 0, 2, -2` may be used directly,
    as configured in the `eslint/no-magic-numbers` lint rule.
- Write comprehensive JSDoc comments for all exported members.
  - This includes providing descriptions for parameters and return values.
  - Adhere to the `eslint-plugin-jsdoc` recommended rules.
- Always include file extensions when importing files.
- Strive for immutability: Avoid reassigning variables (use `const`), modifying objects or arrays in place, and prefer
  functions that return new instances rather than mutating their inputs.
- Utilize single quotes for strings (e.g., `'example'`) and JSX attributes, as enforced by dprint.
- Ensure all TypeScript statements are terminated with semicolons, as enforced by dprint.
- Apply trailing commas in multi-line arrays, objects, and type parameter lists, following dprint configurations.
- Prefer `type` aliases (e.g., `type MyType = { /* ... */ };`) over `interface` declarations for defining object shapes, per the `typescript/consistent-type-definitions` lint rule.
- Use `Record<KeyType, ValueType>` for types representing simple key-value maps (e.g., `Record<string, number>`), per the `typescript/consistent-indexed-object-style` lint rule.
- Note: The `eslint/no-unused-vars` lint rule is disabled. Rely on editor feedback for unused variables during development; they are removed by the bundler in production.
- Always use parentheses around arrow function parameters.
  - This applies even for a single parameter.
  - This is enforced by dprint.
- Usage of `null` is permitted where necessary.
  - For example, for interoperability with libraries that require it.
  - The `unicorn/no-null` lint rule is disabled to allow this flexibility.
- Utilize optional catch binding (e.g., `try { ... } catch { ... }`)
  when the error object is not needed within the catch block.
  - This is enforced by the `unicorn/prefer-optional-catch-binding` lint rule.
- Always provide a separator argument when using `Array.prototype.join()`.
  - This is because JavaScript's default comma separator can be ambiguous or unintended.
  - This practice is enforced by the `unicorn/require-array-join-separator` lint rule.
- Avoid using the generic `Function` type.
  - Prefer more specific function signatures, such as `(...args: any) => any`,
    or ideally, define explicit parameters and return types.
  - This is guided by the `typescript/no-unsafe-function-type` lint rule.
- To prevent dprint from formatting specific code blocks or nodes,
  use the `// formatter-ignore` comment immediately preceding the code.
- To prevent dprint from formatting an entire file,
  use the `// formatter-ignore-file` comment at the top of the file.
- For long binary expressions (e.g., `a + b + c`)
  and member expressions (e.g., `object.prop1.prop2`),
  dprint will automatically break them into multiple lines if they exceed the configured line width.
  - Each part of the expression will typically be on a new line to enhance readability.

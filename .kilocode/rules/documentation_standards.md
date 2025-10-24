# Documentation Standards

## Technical Documentation Writing Style

When writing technical documentation (README, philosophy, architecture docs):
- Write in active voice without collective pronouns
- State facts directly: "Astro for documentation" instead of "We chose Astro for our documentation"
- Avoid meta-references: write "Prioritizing portability" instead of "This aligns with the project's philosophy of portability"
- Use present tense for current state, future tense only for planned features
- Eliminate unnecessary connecting phrases and transitions

## TSDoc Comments

Write comprehensive TSDoc comments for all exported members (functions, types, constants, classes, and everything else):
- This includes providing descriptions for parameters and return values
- **Use TSDoc format for EVERYTHING that can be documented** - functions, constants, types, interfaces, classes, enums, etc. Not just exported members
- Any code element that could benefit from documentation should have TSDoc comments
- Adhere to the `eslint-plugin-jsdoc` recommended rules, TSDoc variant
- Use `{@inheritDoc originalFn}` for a function that's the mere non-async variant of the original function

### Use TSDoc where supported, regular comments elsewhere:

TSDoc (`/** */`) can be used for:
- Functions, methods, arrow functions
- Classes and class members (properties, methods)
- Interfaces and their properties
- Type aliases
- Enums and enum members
- Variables/constants (any level)
- Namespaces/modules

TSDoc CANNOT be used for (use `//` or `/* */` instead):
- Expression statements (assignments, function calls, increments, etc.)
- Control flow statements (if, for, while, switch)
- Import/export statements
- Return statements
- Individual parameters in signatures
- Any comment that isn't immediately followed by a declaration

Key rule: TSDoc must directly precede a declaration (variable, function, class, type, etc.), not a statement or expression

### Comment Placement
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

### Escaping block comment terminators
- Escape block comment terminators inside comments and code snippets to avoid premature comment termination.
- Write `*/` as `*\\/` in TSDoc blocks and in any block comments in examples.

```ts
/**
 * This comment includes an escaped terminator token: *\\/
 */
const example = "/* within string */"; // strings do not need escaping
```

### TSDoc Style Guidelines
- Avoid `the`, `a`, `an` in `@param` or `@returns` description
  - Good: `@returns Set containing all unique elements from the input iterable.`, `@param iterable - to convert.`
  - Bad: `@returns A set containing all unique elements from the input iterable.`, `@param iterable - the iterable to convert.`
- Avoid repeating the name of the parameter without adding additional context in `@param` description
  - Good: `@param iterable - to convert.`, `@param numerator - to be divided.`
  - Bad: `@param iterable - iterable to convert.`, `@param numerator - number to be divided.`
- **Comments should explain WHY, not WHAT**:
  - Good: `/** Mutable counter needed to track newlines encountered while scanning */`
  - Bad: `/** Line counter starting at 1 */`
  - Focus on intent, purpose, and design decisions
  - Explain why something is mutable when using `let`
  - Don't just restate what the code already shows
- For async functions, assume users are using `await` syntax to consume their results and don't need the docs to tell them the function technically returns a promise
  - Good: `Converts Iterable to Set.`, `@returns Set containing all unique elements from the input iterable.`
  - Bad: `Converts Iterable to Promise<Set>.`, `@returns Promise that resolves to Set containing all unique elements from the input iterable.`
- Always include `@example` tags to provide usage examples:
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

## Markdown Conventions

### Text Formatting
- One sentence per line for better diffs and readability
- Use **bold** for emphasis, avoid _italics_
- Prefer fenced code blocks with language tags over inline code for multi-line snippets
- Use inline code \`like this\` for single commands, function names, or short code

### Lists
- Use `-` for unordered lists with one space after
- Numbered lists: pad marker to 4 characters (e.g., `1.  `, `10. `)
- Maintain consistent indentation (2 spaces for nested items)
- Add blank lines before and after lists

### Code Blocks
- Always specify language for syntax highlighting
- Use \`\`\`bash for shell commands, \`\`\`ts for TypeScript
- Include file paths as comments when showing file contents

### Links and References
- Use reference-style links for repeated URLs
- Prefer relative links for internal documentation
- Include descriptive link text, avoid "click here"

### Structure
- Use ATX-style headers (`#` not underlines)
- Maximum header depth: 4 levels (####)
- Add blank line before headers (except first)
- Keep line length under 120 characters when possible

## Git Commit Guidelines

Follow the Conventional Commits specification for all commit messages to ensure consistency and enable automated tooling.

When writing commit messages for multiple changes across different files, include ALL changes in a single comprehensive commit message. Don't write commit messages that only describe partial changes.

### Commit Message Format

```txt
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
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

### Scope
Use the package name or area of change:
- `module-es`
- `*`: For changes affecting multiple packages

### Examples

**Change of one type and scope:**
```txt
feat(module-es): add a

Description of a
```

**Change of multiple types and/or scopes**
```txt
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

### Important Commit Message Rules
- Group related changes by type (feat, fix, test, etc.)
- Don't mix different types in the same scope section
- Be specific about what changed, not just which files
- Never use emojis in commit messages
- Focus on the "what" and "why", not just listing file changes

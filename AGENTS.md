# Development Guidelines for AI Agents

# Project Context

## Repository Information
This is the Monochromatic TypeScript monorepo ecosystem for web development.

## Important Reminders
**Date Handling**: Always use the current date from the environment information provided in the system prompt. Never assume or guess dates.

## Core Features
- Reusable development tool configurations
- Functional programming utilities library
- CSS framework (Monochromatic design system)
- Documentation sites

## Architecture

## Dependency Management
- Use `workspace:*` for internal dependencies
- `strictPeerDependencies: true` enforces exact versions
- Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`
- `nodeLinker: isolated` for isolated node_modules

## Adding New Packages
1. Create directory under appropriate category in `packages/`
2. Add `mise.toml` with appropriate tags
3. Configure `package.json` with workspace dependencies

# Working Environment

## Essential Commands

All builds and tasks are managed by mise. Never run `pnpm exec` or direct package scripts. Always use `mise run` commands.

Read the `mise.toml` files in the root and packages directories to see all available commands.

Don't run linters or formatters. The user will run them themselves.

## Shell Awareness

### Working Directory
- **NEVER use `cd`** - It's hard to keep track of the current directory
- Use absolute paths or paths relative to monorepo root (agent always starts there)

### Detecting the Current Shell
Use detection commands:
- Check shell name: `echo $0` or `echo $SHELL`
- PowerShell shows `pwsh` or `powershell`, bash shows `bash` or `sh`
- Different syntax for environment vars: `$VAR` works in bash, `$env:VAR` works in PowerShell

### Cross-Shell Compatibility
- Quote paths with spaces or special chars: `"path with spaces"`
- Avoid command chaining: chaining commands provide less information about what's going on.
- Prefer cross-shell compatible syntax when possible

## Search Tools

- **`ripgrep` (rg)** is available in this environment for fast text searching
- Use `rg` directly with for searching specific strings, types, or patterns
- **Don't waste time navigating `pnpm`'s complex node_modules structure** - just search everywhere at once
- Examples:
  - `rg "interface AnalyzeOptions" -t ts` (searches all TypeScript files)
  - `rg "export.*parseForESLint" --type ts`
  - `rg "functionName" -A 5 -B 5` (show 5 lines before/after matches)
- This is much faster than:
  - Using Grep tool
  - Trying to find the exact path in `pnpm`'s symlinked `.pnpm` directories
  - Guessing where packages are located

# Communication & Documentation

## Communication Style

Be direct and honest.

### Documentation Standards
- NEVER use emojis in any content meant to be read by humans
- Focus on clear, professional text without decorative elements
- NEVER use ALL CAPS for headings or emphasis in documentation
- Use sentence case for headings
- For emphasis, use **bold** formatting instead of capitalization
- Write in active voice without collective pronouns
- State facts directly: "Astro for documentation" instead of "We chose Astro for our documentation"
- Avoid meta-references: write "Prioritizing portability" instead of "This aligns with the project's philosophy of portability"
- Use present tense for current state, future tense only for planned features
- Eliminate unnecessary connecting phrases and transitions

### Handling External Changes
- When files have been modified externally, acknowledge the change
- Ask for clarification before reverting or modifying externally changed content
- Don't proceed with implementing features that won't achieve their intended effect
- If a tool/command doesn't support the requested functionality, explain this instead of creating non-functional code

## Documentation Practices

### TSDoc Comments

Write comprehensive TSDoc comments for **all** declarations -- functions, types, constants, classes, and everything else -- whether exported or not, including locals inside function bodies:
- This includes providing descriptions for parameters and return values
- **Use TSDoc format for EVERYTHING that can be documented** - functions, constants, types, interfaces, classes, enums, etc. Not just exported members
- Do not skip declarations that seem "obvious from context" -- what is obvious to the current reader may not be obvious to a future reader with less context, less domain knowledge, or less intelligence; thorough documentation costs little to write but compounds in value over every future read
- Any code element that could benefit from documentation should have TSDoc comments
- Adhere to the `eslint-plugin-jsdoc` recommended rules, TSDoc variant
- Use `{@inheritDoc originalFn}` for a function that's the mere non-async variant of the original function
- Unless the code element is genuinely dead code, consider every code element to be important and notable and worthy to be documented - if they do nothing they won't be there.

#### Use TSDoc where supported, regular comments elsewhere:

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

#### Comment Placement
- NEVER use inline comments after code
- Always place comments on their own line above the code they describe

#### Escaping block comment terminators
- Escape block comment terminators inside comments and code snippets to avoid premature comment termination.
- Write `*/` as `*\\/` in TSDoc blocks and in any block comments in examples.

```ts
/**
 * This comment includes an escaped terminator token: *\\/
 */
const example = "/* within string */";
```

#### TSDoc Style Guidelines
- Avoid `the`, `a`, `an` in `@param` or `@returns` description
- Avoid repeating the name of the parameter without adding additional context in `@param` description
- **Comments should explain WHY, not WHAT**:
  - Good: `/** Mutable counter needed to track newlines encountered while scanning */`
  - Bad: `/** Line counter starting at 1 */`
  - Focus on intent, purpose, and design decisions
  - Explain why something is mutable when using `let`
  - Don't just restate what the code already shows
- For async functions, assume users are using `await` syntax to consume their results and don't need the docs to tell them the function technically returns a promise
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

### Markdown Conventions

#### Text Formatting
- One sentence per line for better diffs and readability
- Use **bold** for emphasis, avoid _italics_
- Prefer fenced code blocks with language tags over inline code for multi-line snippets
- Use inline code \`like this\` for single commands, function names, or short code

#### Lists
- Use `-` for unordered lists with one space after
- Numbered lists: pad marker to 4 characters (e.g., `1.  `, `10. `)
- Maintain consistent indentation (2 spaces for nested items)
- Add blank lines before and after lists

#### Code Blocks
- Always specify language for syntax highlighting
- Use \`\`\`bash for shell commands, \`\`\`ts for TypeScript
- Include file paths as comments when showing file contents

#### Links and References
- Use reference-style links for repeated URLs
- Prefer relative links for internal documentation
- Include descriptive link text, avoid "click here"

#### Tables
- **No tables in markdown files** -- tables have poor readability when viewed via `cat`/terminal and render badly on mobile
- Use nested headings or lists instead
- Flag any existing tables in changed markdown files for conversion to headings or lists

#### Structure
- Use ATX-style headers (`#` not underlines)
- Maximum header depth: 4 levels (####)
- Add blank line before headers (except first)
- Keep line length under 120 characters when possible

### Git Commit Guidelines

Follow the Conventional Commits specification for all commit messages to ensure consistency and enable automated tooling.

When writing commit messages for multiple changes across different files, include ALL changes in a single comprehensive commit message. Don't write commit messages that only describe partial changes.

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

#### Important Commit Message Rules
- Group related changes by type (feat, fix, test, etc.)
- Don't mix different types in the same scope section
- Be specific about what changed, not just which files
- Never use emojis in commit messages
- Focus on the "what" and "why", not just listing file changes

# Development Practices

## Script Preferences

- **NEVER write bash/shell scripts** (non-portable, unreadable, unfamiliar)
- When scripts are needed, create TypeScript files as `mise.<action>.ts` in `packages/module/es/src/`
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

## Tool Version Management

- **Only pin tool versions when necessary** with clear justification
- If pinning is required, always include comments explaining why
- Example: `# Pin to v1.2.3 - v1.3.0 introduced breaking API changes`
- Document version requirements in both the pinning file and README
- Regularly review pinned versions to check if constraints still apply

## Third-Party Library Usage

### Immediate Documentation Retrieval
- **IMMEDIATELY retrieve documentation when encountering undefined method errors**
  - The moment you see errors like "X is not a function", "Cannot read property X of undefined", or "X is undefined"
  - Use ALL available documentation tools to understand the correct API

### Documentation Best Practices
- **Always retrieve documentation from GitHub or npm pages** when implementing features with third-party libraries
  - For npm packages: Use `exa:crawling` to fetch from `https://www.npmjs.com/package/<package-name>`
  - For GitHub repos: Use `github:get_file_contents` to fetch from the library's GitHub page
  - This ensures you have the most up-to-date API documentation and usage examples
- Always check the actual type definitions before using APIs
- Read the actual source types, not just documentation (which may be outdated)
- When encountering type errors, read the error message carefully - it often shows what's actually expected

### CLI Tool Documentation Analysis

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

### Working with Third-Party Repositories

When setting up or integrating third-party tools:
- **Never modify files in cloned third-party repositories**
  - This breaks git pull/update workflows
  - Makes it difficult to track upstream changes
  - Creates merge conflicts when updating
- **Always prefer configuration-based solutions**
  - Use external config files (e.g., ~/.kilocode.json for MCP servers)
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

# Code Quality

## Code Simplification

### Core Philosophy

Always question "Do you really need...?" for every construct:
- **Do you really need that mutable variable?** → Use `const` and immutable patterns
- **Do you really need that loop?** → Consider `map`, `filter`, `reduce`, or functional helpers
- **Do you really need that imperative code?** → Look for declarative/functional alternatives
- **Do you really need that complex solution?** → Start with the simplest approach
- **Do you really need to create promises directly?** → Use existing promise utilities like `wait()`

### Progressive Simplification Pattern

When refactoring code, follow this progression:
1. Imperative loop with mutable state → `while` loop with proper conditions
2. `while` loop → `for` loop with calculated iterations
3. `for` loop → Recursive function
4. Recursive function → Higher-order functions or async iterators

### Best Practices

- Always extract and name concepts (e.g., `isTaskPending()` instead of inline conditions)
- Prefer built-in JavaScript/TypeScript methods over manual implementations
- Start with the simplest solution that could work
- Refactor to complexity only when necessary
- Name intermediate values for clarity
- Break complex operations into smaller, testable functions
- Preemptively split large files over 100 lines; all files should be under 200 lines.
  - This limit applies only to production/library source code -- test files, fixture files, configuration files, and documentation files are exempt.
  - If splitting is not feasible (e.g. would cause import cycles), add a justification comment at the top of the file explaining why.

### Examples

#### Bad: Complex imperative code
```ts
let results = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].isActive) {
    results.push(items[i].value * 2);
  }
}
```

#### Good: Simple functional approach
```ts
const results = items
  .filter(item => item.isActive)
  .map(item => item.value * 2);
```

#### Bad: Manual promise creation
```ts
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Good: Use existing utilities
```ts
import { wait } from '@monochromatic-dev/module-es';
// Use wait(ms) directly
```

#### Bad: Inline complex conditions
```ts
if (status === 'pending' && retries < maxRetries && !isTimeout) {
  // retry logic
}
```

#### Good: Extract and name the concept
```ts
const canRetry = () =>
  status === 'pending' &&
  retries < maxRetries &&
  !isTimeout;

if (canRetry()) {
  // retry logic
}
```

## Linting Guidelines

### Identifying the Linting Tool
When fixing linting issues, first identify which tool reports the error:
- Check the lint output format: `monochromatic:lintOxlint | ! eslint-plugin-unicorn(error-message)` indicates Oxlint
- ESLint errors show as `eslint(rule-name)`
- Oxlint errors often include the plugin name like `eslint-plugin-unicorn(rule-name)`

### Common Linting Fixes

#### Magic Numbers
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

#### Loops and Iteration
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

#### Async Patterns
- Use `wait()` from module-es instead of `new Promise(resolve => setTimeout(resolve, ms))`
- Add `eslint-disable-next-line no-await-in-loop` when sequential processing is required
- Import and use existing promise utilities instead of creating new promises

#### Type Annotations
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

#### Import Patterns
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

#### Null Checks
Use explicit comparisons instead of `!=` or `==`:
```ts
// BAD
if (value != null) { }

// GOOD
if (value !== null && value !== undefined) { }
```

#### Module Disambiguation
For scripts that might be parsed as CommonJS, add an export:
```ts
// At the end of the file
export {};
```

## Logging

- Log extensively -- `console.log` calls are cheap to write and invaluable when debugging
- Add logging to new code by default: function entry points, branch decisions, error paths, async lifecycle events
- Never remove logging to "clean up" -- a quiet console helps no one when something breaks; a noisy console costs nothing in development
- Treat logging as permanent infrastructure, not temporary scaffolding

## Security

- No hardcoded secrets, API keys, or credentials in source code
- No unsanitized user input in SQL, shell commands, or HTML
- No overly permissive CORS, file permissions, or network exposure
- Secrets must not be logged, even at debug level

## CSS best practices

### Platform primitives over custom implementations

- Use native HTML and CSS features instead of reimplementing them in JavaScript
  - `<dialog>` for modals and overlays -- provides `::backdrop`, top-layer stacking, focus trapping, and Escape-to-close for free
  - Popover API (`popover="auto"` / `popover="manual"`) for drawers, dropdowns, and tooltips -- provides `:popover-open`, light-dismiss, and top-layer without z-index management
  - `:popover-open` and `[open]` selectors for visibility instead of manual class toggling
  - CSS nesting, `@layer`, `@scope`, container queries, and other modern CSS features that eliminate JavaScript workarounds
- The browser support baseline is Firefox ESR 140 (June 2025) -- see `PHILOSOPHY.browser-support.md` for the full feature list
- When in doubt about a platform feature, check against the baseline before using it
- Never build custom backdrop overlays, focus traps, or dismiss handlers when the platform provides them

### Units and values

- Always use `rem` for font sizes, never `px`
  - Use `calc()` to show derivation: `font-size: calc(15 / 16 * 1rem)` instead of `font-size: 0.9375rem`
  - Exception: `text-underline-offset` may use `em` because it relates to the font size immediately above itself
- Use `rem` for all sizing, spacing, borders, and decorative elements
  - Everything scales with user font preferences, including borders and outlines
  - Modern screens do not need pixel-crisp borders; when sub-pixel precision is truly needed, use `image-rendering: pixelated` or similar CSS properties
  - Never use `px` except in contexts where the value is truly device-pixel-dependent
- Document magic numbers with a comment explaining their origin

### Logical properties

- Use logical properties everywhere physical properties would go
  - `margin-inline-start` not `margin-left`, `padding-inline-end` not `padding-right`
  - `border-inline-end` not `border-right`, `inset-inline-start` not `left`
  - `inline-size` / `block-size` when sizing should respect writing direction
  - `text-align: start` not `text-align: left`
- No exceptions -- logical properties apply to fixed and absolute positioning too (`inset-block-start` not `top`, `inset-inline-end` not `right`)

### No shorthand properties

- Avoid shorthand properties like `border`, `padding`, `margin`, `font`, `background`, `flex`
  - Shorthands reset sub-properties to initial values in surprising ways
  - Longhand is easier to scan and diff
  - Bad: `border: 1px solid #111`
  - Good: `border-width: calc(1 / 16 * 1rem); border-style: solid; border-color: var(--gray-fg);`
  - Bad: `padding: 0.5rem 1rem`
  - Good: `padding-block: 0.5rem; padding-inline: 1rem;`
- Exception: `inset: 0` is acceptable because all four sides genuinely share the same value

### Color tokens

- Never hardcode color values in component CSS
  - Every color must reference a CSS custom property from the design token system
  - Bad: `color: #111; border-color: #a00; background: rgba(0, 0, 0, 0.3);`
  - Good: `color: var(--gray-fg); border-color: var(--error-fg); background: var(--overlay-bg);`
- If a needed token does not exist, add it to the token system first, then reference it

### Custom property fallbacks

- Do not provide fallback values in `var()` calls
  - Fallbacks hide missing tokens during development
  - Bad: `color: var(--gray-fg, #111);`
  - Good: `color: var(--gray-fg);`
- Exception: user-configurable properties that genuinely may not be defined, e.g. `var(--user-accent, #800)`

### Minimalism

- Use as few CSS properties as possible
  - Question every declaration: "Does removing this change anything?"
  - Remove `flex-shrink: 0` if the element is not in a flex container or already fits
  - Remove `display: block` on elements that are block by default
  - Remove `font: inherit` if already inherited
- Use as few breakpoints as possible
  - Each breakpoint should change the minimum needed to adapt the layout
  - Avoid duplicating the same property at multiple breakpoints when a single fluid approach (e.g. `clamp()`, `min()`, `max()`) works
- Never use `!important` -- it signals a structural problem in specificity management

### Accessibility

- All interactive elements must have `:focus-visible` styles
  - Provide a visible outline or other indicator for keyboard navigation
- Touch targets must be at least `48px` in both `inline-size` and `block-size` (Material Design minimum)
  - Use `min-inline-size` and `min-block-size`, not fixed `inline-size`/`block-size`, so the element can grow if content demands it

### Mixin design

- Prefer many small, composable mixins over few large monolithic ones
  - Inspired by Tailwind utility classes, but as `@mixin` / `@apply` instead of class names
  - Example primitives: `--flex-center`, `--border-radius-full`, `--whitespace-nowrap`, `--scrollbar-hidden`
  - Compose in the component: `@apply --flex-center; @apply --border-radius-full;`
- Mixin names must describe what the mixin does, not what it is used for
  - Bad: `--reset-button` (ambiguous -- reset a button, or a button that resets?)
  - Good: `--appearance-none` (clearly strips browser-default appearance)
- Mixin bodies must themselves follow all the rules above (logical properties, no shorthands, tokens for colors, etc.)

### CSS nesting

- Use native CSS nesting (`&`) to group related rules under their parent
  - Keeps pseudo-classes, pseudo-elements, child selectors, and attribute selectors co-located with the rule they modify
  - Bad (flat, repeated selectors):
    ```css
    .close { @apply --appearance-none; }
    .close:focus-visible { outline-style: solid; }
    .close svg { inline-size: 2rem; }
    ```
  - Good (nested):
    ```css
    .close {
      @apply --appearance-none;

      &:focus-visible { outline-style: solid; }

      & svg { inline-size: 2rem; }
    }
    ```
- Keep nesting shallow -- one level is typical, two is occasionally warranted, three or more signals the selector structure should be simplified

### State and variant styling

- Use data attributes instead of BEM modifier classes for state-driven or variant-driven styling
  - Data attributes express state, BEM conflates state with naming convention
  - Bad: `class="pill pill--loading"`, `.pill--loading { opacity: 0.5; }`
  - Good: `<span class="pill" data-loading>`, `.pill { &[data-loading] { opacity: 0.5; } }`
- Boolean states use valueless data attributes: `data-loading`, `data-hidden`, `data-autofilled`
- Enumerated variants use data attribute values: `data-size="small"`, `data-variant="primary"`

# TypeScript Standards

## General Guidelines
- Adhere to the established linting and formatting configurations (ESLint, Oxlint, dprint)

## Code Organization

### Region Markers
Use `region` markers to delineate logical sections of code:
- This practice enhances code organization and readability, particularly in larger files
- Most IDEs recognize `region` and `endregion` comments, allowing these sections to collapse or expand
- Following `//region` is the purpose of the code block. After double hyphens, provide a long explanation
- Following `//endregion` repeats the purpose of the code block
- Use language-appropriate syntax with no space between the comment marker and the keyword (e.g. `//region`, `#region`, `--region`)
- Missing region markers on substantial code blocks are noteworthy; smaller blocks benefit from them but less critically
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

### Import and Module Conventions
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

### Function Declarations
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

### Export Conventions
- **Avoid `Object.assign` for extending typed objects** - create a new const instead
- **Prefer exporting constructs immediately when declared**:
  - **Bad**: `function myFn() {}; export { myFn }`
  - **Bad**: `const myConst = 'value'; export { myConst }`
  - **Good**: `export function myFn() {}`
  - **Good**: `export const myConst = 'value'`
  - This approach reduces cognitive load by making it immediately clear what is exported from the module

## Type System

### Type Definitions and Safety
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

### Symbol Union Narrowing
- TypeScript does not narrow a union to non-symbol by comparing a value to a specific unique symbol.
- Identity checks against a single symbol do not eliminate the symbol category, so the else branch can still be a symbol from the same union.
- Narrow by category first using `typeof value === 'symbol'`, then discriminate by identity for expected symbols within that block.

```ts
// Single symbol sentinel
// Anti-pattern (bug is in else)
if (out === NO_LITERAL) {
  // handle sentinel
} else {
  // BUG: else may still be a symbol from the union
  use(out.parsed);
}

// Preferred
if (typeof out === 'symbol') {
  if (out === NO_LITERAL) {
    // handle sentinel
  } else {
    throw new Error('is symbol, but not expected');
  }
} else {
  use(out.parsed);
}
```

```ts
// Multiple possible symbol sentinels
if (typeof out === 'symbol') {
  if (out === SYMBOL_A) {
    // handle A
  } else if (out === SYMBOL_B) {
    // handle B
  } else {
    throw new Error('is symbol, but not one of the expected');
  }
} else {
  // non-symbol branch
  use(out.parsed);
}
```

### Generics and Type Parameters
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

### Generator Function Overloading
TypeScript's support for overloading generator functions has quirks:
- For sync generators, remove the star sign in non-implementation overload signatures
- For async generators, remove both the `async` modifier and star sign in non-implementation overload signatures
- This allows TypeScript to correctly determine they're overloads

## Variable & Value Patterns

### Immutability and Declarations
- Prefer `const` over `let` to encourage immutability
- Strive for immutability: avoid reassigning variables and modifying objects in place
- **Justify or refactor**: any deviation from the preferred pattern must have a comment explaining why refactoring to the preferred approach is not feasible; examples include but are not limited to: `let` bindings, imperative loops (`for...of`, `while`, `do...while`) instead of functional alternatives, in-place mutation (`.push()`, `.splice()`, property assignment on an existing object), `any` casts, non-null assertions, `await` in loops, raw `.then()` chains
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
- Use `satisfies` operator for type checking without widening
- **Destructuring pattern with dependencies**: When destructuring multiple variables where some depend on others, use separate destructuring blocks

## Programming Patterns

### Async Programming
- Prefer `async/await` and promise-returning library functions over explicit `new Promise` creation
- Always prefer `async/await` over callbacks; convert callback-based APIs to promises
- **No `.then()`, `.catch()`, `.finally()`** -- use `async`/`await` with `try`/`catch` or let errors propagate naturally by throwing
- Avoid using await in loops wherever logically sound
- Use `Promise.all()` for concurrent operations when order doesn't matter
- Use `Promise.allSettled()` when you need results from all promises regardless of failures
- Handle promise rejections explicitly with try-catch blocks
- Consider using `AbortController` for cancellable async operations

### Error Handling
- **No `try...finally`** -- use `using`/`await using` with `Symbol.dispose`/`Symbol.asyncDispose` for cleanup; when disposal is not applicable, restructure the code to make cleanup explicit without `finally`
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
- **Use outdent for multi-line error messages**
  - For error messages with multiple lines, use `outdent` from `@cspotcode/outdent`
  - Import: `import { outdent } from '@cspotcode/outdent';`
- **Use process.exitCode only for non-standard exit codes**
- **Always log errors in catch blocks**:
  - Every catch block must log the caught error for debugging
  - Log ALL errors, even "expected" ones - the actual error might be different than expected
  - Use `console.error()` for errors, include context about what operation failed
  - Good: `catch (error) { console.error('Failed to get index stats:', error); }`
  - Bad: `catch (e) { /* silently ignore */ }`
- **Avoid deprecated JavaScript/TypeScript features**:
  - Use `substring()` or `slice()` instead of deprecated `substr()`
  - Check MDN or TypeScript documentation for deprecation warnings
  - Prefer modern, supported alternatives
- **Never silently discard unexpected states** -- when narrowing a type at runtime (e.g. `instanceof`, `typeof`, discriminant checks), the failure branch means something is seriously wrong; throw an error instead of returning early or ignoring the case
  - Bad: `if (!(event instanceof CustomEvent)) return;` -- silently hides a bug
  - Good: `if (!(event instanceof CustomEvent)) throw new TypeError("Expected CustomEvent");`
  - This applies to type guards, switch-default branches, and any narrowing where the "else" path should be unreachable in correct code

### Class Design
- Prefer composition over inheritance
- Use `readonly` for properties that shouldn't change after construction
- Make class methods `private` by default, only expose what's necessary
- Use `#private` fields for truly private data (not accessible via bracket notation)
- Implement interfaces explicitly when a class should conform to a contract
- Use abstract classes sparingly, prefer interfaces and composition

### Performance Considerations
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

# Testing

Refer to the Testing Practices skill (.factory/skills/testing-practices.md).

# Code Review

Refer to the Code Review skill (.factory/skills/code-review.md).

# Architecture Decisions

## Monorepo dependency rules

- The root `package.json` may depend on workspace packages (`"@monochromatic-dev/foo": "workspace:*"`)
- Root-level config files, scripts, and tools can import from workspace packages by name rather than using fragile relative paths

## Config-as-code over config-as-data

- When a configuration format (TOML, YAML, JSON) starts needing operators, pipelines, or conditional logic, switch to TypeScript
- TypeScript config files provide type checking, IDE support, and composability that no data format can match
- Don't invent a DSL inside a data format -- if the config needs `if`, `map`, or `await`, it's code

## Direct execution over descriptor patterns

- Don't build a two-phase "collect descriptors then interpret" system unless dry-run, conflict resolution, or pre-execution inspection is a concrete requirement
- Direct async functions with `await` at the call site are simpler to write, debug, and understand
- Users get explicit control over sequencing and parallelism with `await` and `Promise.all` instead of the framework guessing
- Apply YAGNI to architecture, not just features

## Nested calls over method chaining

- Method chaining (`a().b().c()`) looks clean at the call site but forces a descriptor AST and switch-based interpreter in the implementation
- Nested calls (`c(b(a()))`) let each function be self-contained with no shared state or deferred interpretation
- Prefer nested calls unless left-to-right reading order is genuinely more important than implementation simplicity

# CRUSH.md - Development Guidelines for Agents

## Essential Commands

### Build Commands
- Full build: `moon run build`
- Build with watch: `moon run buildWatch`
- Prepare project: `moon run prepare`

### Test Commands
- Run all tests: `moon run test` (only from workspace root)
- Run unit tests: `moon run testUnit` (from workspace root)
- Run browser tests: `moon run testBrowser` (from workspace root)
- Run tests in watch mode: `moon run testWatch`
- Run unit tests with coverage: `moon run testUnit`

### Linting and Formatting Commands
- Lint all files: `moon run lint`
- Format all files: `moon run format`
- Validate (format + build + test): `moon run validate`

### Development Workflow Commands
- Clean moon cache: `moon clean --lifetime '1 seconds'`
- Check tools: `moon check`
- Install dependencies: `moon run pnpmInstall` or `moon run bunInstall`

### Running Specific Test Files
To run a single test file:
```bash
moon run testUnit -- packages/module/es/src/filename.unit.test.ts
```

Use `moon run testBrowser -- packages/path/to/test` for browser tests.

## Code Style Guidelines

### TypeScript Conventions
- Prefer named function declarations over anonymous functions
- Always include file extensions in imports (.ts)
- Use absolute imports for workspace packages
- Prefer `const` over `let` for immutable variables
- Avoid single-letter variable names
- Use explicit parameter and return types for all functions
- Prefer `type` aliases over `interface` declarations
- Use branded types for domain-specific primitives
- Prefer `const` generic type parameters for enhanced type safety
- Use `as const` assertions for literal types and readonly arrays
- Use `unknown` instead of `any` for better type safety

### Imports Organization
1. Node.js built-in modules
2. External dependencies
3. Internal workspace packages
4. Relative imports
5. Type-only imports with `import type`

### Error Handling
- Throw errors instead of returning error codes or null values
- Never use `process.exit()` - throw errors instead
- Always log errors in catch blocks for debugging
- Use `notNullishOrThrow` instead of non-null assertion operator (!)
- Create custom error classes that extend `Error` for domain-specific errors

### Documentation
- Write comprehensive TSDoc comments for all exported members
- Use `@example` tags to provide usage examples
- Comments should explain "why" not just "what"
- Start Vitest files with proper logging configuration

### Testing Requirements
- Write corresponding Vitest files aiming for 100% coverage
- Test both happy path and error scenarios
- Use descriptive test names that explain the expected behavior
- Mock external dependencies when needed
- Use `it.each` for parameterized tests when appropriate
- Add V8 ignore comments for intentionally untestable code paths

### Async Programming Patterns
- Prefer `async/await` over explicit Promise creation
- Use `Promise.all()` for concurrent operations when order doesn't matter
- Use `Promise.allSettled()` when you need results from all promises regardless of failures
- Use established utilities like `wait()` instead of manual promise creation for delays
- Avoid using `await` in loops when possible

### Code Simplification Principles
- Always question if complex constructs are really needed
- Prefer immutable patterns and functional approaches
- Start with simplest solution then add complexity only when necessary
- Extract and name complex conditions (e.g., `isTaskPending()` instead of inline conditions)
- Prefer functional approaches (`map`, `filter`, `reduce`) over imperative loops
- Avoid deep nesting in conditional types to prevent performance issues
- Use built-in JavaScript methods instead of manual implementations when possible

## Moon-Based Architecture
- All builds and tasks are managed by Moon CLI
- Never run `pnpm exec` or direct package scripts
- Use `moon run <task>` for all development activities
- Dual builds are supported for Node.js and browser targets

## Communication Style
- State facts directly without hedging
- Avoid apologies and softening language
- Focus on technical responses
- No emojis in any content

## Tool Usage
- Use `ripgrep` (rg) for fast text searching across the codebase
- Prefer TypeScript scripts over bash scripts
- Never modify files in cloned third-party repositories
- Immediately retrieve documentation when encountering undefined method errors
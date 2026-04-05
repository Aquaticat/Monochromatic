# Development Guidelines for AI Agents

# Working Environment

Don't use "plan mode" since they currently just bug out. Waiting for upstream fixes.

Don't use pipes in bash tool since they're broken for now. Workarounds like redirecting to file then reading the file works.

Always pass an explicit path (`.` or absolute) to `rg` in the Bash tool.
Without a path argument, `rg` detects non-TTY stdin in the sandbox and switches to stdin-reading mode.
Combined with command chains (`&&`, `;`), the `< /dev/null` redirect misapplies to the last command in the chain,
leaving `rg` blocking forever on a socket that never sends EOF. See `PIPE-BUG.md` for details.

The Glob tool is denylisted and disabled because it currently doesn't respect .gitignore .

User input might include raw `\n` which you should consider as newlines since newline is broken sometimes.

Clone entire git repo of a package to a temp dir whenever investigating source code is needed.
Use `gh repo clone` instead of `git clone` -- `gh` handles authentication and fork remotes automatically.

Sandbox breaks `pnpm install` despite proper allowlisting, so run it outside sandbox until this is fixed.

A bash-output-filter hook collapses `/var/home/user` and `/home/user` to `~`,
and strips the cwd prefix from absolute paths in Bash tool output.
These replacements only apply at the **beginning of a line** --
paths embedded mid-line (in error messages, JSON, etc.) are left intact.
This is a display transform only -- actual values are correct.
Do not treat `~` in tool output as a literal tilde in paths;
it represents the full `/var/home/user` or `/home/user` prefix.
When debugging path issues, account for this transform before assuming paths are wrong.
To temporarily skip the filter for a command, include any blocklist pattern in it --
the simplest is a no-op `eval` wrapper: `eval 'your command here'`.
Other blocklist triggers: `export`, `source`, `$(...)`, backticks, `> file` redirect.

Prefer cross-runtime patterns instead of Bun-specific implementations.

## Spawning child Claude sessions

General purpose agents are banned because of bugs.

Use `spawn-claude` outside sandbox to launch steerable child Claude Code sessions in visible terminal windows.
The child session runs independently; results are forwarded back to the parent automatically via hooks.

```bash
spawn-claude "implement feature X"
spawn-claude --cwd /some/path "fix the bug in module Y"
spawn-claude --extra-arguments "--model sonnet" "refactor this module"
```

The command prints `{"spawnId":"<uuid>"}` on success.
Completed child results are injected into context automatically between tool calls.

## Dependency management
- Use `workspace:*` for internal dependencies
- Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`

## Adding new packages
1. Create directory under the appropriate category in `packages/`
2. Add `mise.toml` with task definitions mirroring sibling packages
3. Configure `package.json` with workspace dependencies
4. For CLI packages with a `bin` entry, add `#!/usr/bin/env bun` shebang as the first line of the entry point -- without it, Unix falls back to `/bin/sh` and the script hangs or errors
5. For packages with client-side bundling, add `tsdown.client.config.ts` extending `@monochromatic-dev/config-tsdown/.client.ts`, a `build:js:client` mise task, and `@monochromatic-dev/config-tsdown` as a devDependency

## Essential commands

Mise task `run` commands use nushell, not bash.
Use `;` to chain commands sequentially (`mise run foo; mise run bar`), not `&&`.

All builds and tasks use `mise run`. Never run `pnpm exec` or direct package scripts.
Never invoke raw tools (`tsc`, `tsdown`, `bun test`, `oxlint`, etc.) directly -- use the corresponding mise task instead.
When no suitable mise task exists for an operation, add one to the target package's `mise.toml` before running it.
Read `mise.toml` files in root and package directories for available commands.
To run a task in a specific package, use `mise run //packages/path:task` (not `mise run -C`).
A `PostToolUse` hook for Edit/Write on `.ts` files will run the package-specific `lint:types` task automatically;
until that hook exists, run `mise run //packages/<path>:lint:types` manually after editing TypeScript.

`mise watch -r` takes a bare task name, not a `mise run` invocation.
Write `mise watch -w src -r -- start:server`, not `mise watch -w src -r -- mise run start:server`.
When a dev task needs watch-restart, split the inner command into its own task (e.g. `start:server`)
so `mise watch -r` can reference it by name.

After modifying source in packages that produce dist output (e.g. `module-es`),
always verify with `mise run buildAndTest` instead of running tests alone.
Tests import from the built dist, so a stale build causes false failures.
To run a specific test file after building: `mise run buildAndTest -- path/to/file.test.ts`.

## Workspace conventions

Use the current date from the system prompt environment.

Some root-level files (e.g. `CLAUDE.md`) are generated by file-enforcer.
Before editing any root config file, check `file-enforcer.config.ts` to see if it is a managed output -- if so, edit the source file instead and run file-enforcer.

In spec mode, keep researching and gathering context until the user explicitly asks to draft or exit.

## Research tools

- `rg` -- fast text search; use directly rather than navigating directory trees; `rg --files` to find files by glob
- `agent-browser` -- headless browser automation CLI; use for fetching rendered web pages, taking screenshots, interacting with web UIs, and verifying deployed web applications
- `FetchUrl` -- fetch documentation sites, npm pages, GitHub READMEs; raw source is still useful when docs are incomplete
- `gh` -- query GitHub for issues, PRs, release notes, and repository metadata
- Web search cannot inspect package internals (sizes, dependency trees, source code); clone repos to `/tmp` or install packages instead
- Do not remove cloned repos or other audit artifacts from `/tmp`; the user will clean them up when ready

# Communication & Documentation

## Communication style

Be direct and honest.
Search for evidence before responding to opinions, guesses, or analysis requests.
Identify implicit questions, requests for estimates, or gaps in user input
and research them before responding.
When a user's message contains an embedded question (e.g. "month? year?"),
treat it as a research task: use web search, read relevant code, or check documentation
to give an informed answer rather than deflecting with "genuinely unknown."

When answering questions about external tool features, CLI options, config syntax,
or API capabilities, fetch current documentation or source code before responding.
Do not rely on training data for tool-specific details --
features change across versions and confident-sounding but wrong answers
waste more time than a brief research pause.
If the question is "does X support Y" or "how do I do Y in X,"
treat it as a research task, not a recall task.

When explaining a warning or error, name the exact tool that emitted it
(e.g. "Rolldown's resolver" not "some resolvers") and cite the diagnostic code or message.
Do not attribute a diagnostic to a vague category of tools.
If unsure which tool produced it, investigate first -- search the codebase
for the diagnostic code, check tool documentation, or run the tool directly --
before writing an explanation.

When the user says "I was expecting you to..." or similar unmet-expectation feedback,
treat it as a documentation gap.
Propose a concrete AGENTS.md change (what rule, where it goes, exact wording)
so future sessions don't repeat the same failure.
Do both: perform the expected action **and** propose the AGENTS.md edit.

### Document non-obvious findings

When discovering something that would not be immediately obvious to a future reader,
document it in the relevant readme or doc file right away.
This includes implementation details, behavioral quirks, implicit constraints,
and any context that required investigation or experimentation to uncover.

### Documentation standards
- No emojis in human-readable content
- Sentence case for headings; **bold** for emphasis (not ALL CAPS)
- Active voice without collective pronouns; state facts directly; avoid meta-references to the project's own philosophy
- Present tense for current state, future tense only for planned features
- Eliminate unnecessary connecting phrases

### Handling external changes
- Acknowledge externally modified files; ask before reverting
- Do not proceed with implementing features that will not achieve their intended effect
- Explain when a tool/command does not support requested functionality instead of creating non-functional code

## TSDoc comments

Write comprehensive TSDoc for **all** declarations (exported or not, including locals): functions, types, constants, classes, enums, variables, interfaces.
Adhere to `eslint-plugin-jsdoc` recommended rules, TSDoc variant.
Use `{@inheritDoc originalFn}` for non-async wrappers.

- Use `${ // comment \n '' }` to embed comments inside template literals; do not use target-language comments or move the comment outside the template
- TSDoc (`/** */`) for declarations only; use `//` or `/* */` for statements, control flow, imports, returns
- TSDoc must directly precede a declaration, not a statement
- Comments on their own line above code, never inline after code
- Escape `*/` as `*\\/` inside TSDoc blocks
- Avoid `the`/`a`/`an` in `@param`/`@returns`; explain **why**, not **what**
- Do not mention Promise wrapping for async functions
- Include `@example` tags with usage examples

## Markdown conventions

- Break lines at semantic boundaries so text reads naturally without editor wrapping; **bold** for emphasis; no _italics_
- `-` for unordered lists; pad numbered markers to 4 chars (`1.  `, `10. `)
- Fenced code blocks with language tags; include file paths as comments
- Reference-style links for repeated URLs; relative links for internal docs
- No tables -- use headings or lists instead
- ATX headers, max 4 levels, blank line before headers, lines under 120 chars

## Git commit guidelines

Conventional Commits format: `<type>(<scope>): <subject>`.
Default to committing all working tree changes together unless instructed otherwise.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope: package name or `*` for multi-package changes.

- Group related changes by type; be specific about what changed
- Include ALL changes in a single comprehensive commit message
- Focus on "what" and "why"

# Development Practices

## Act, don't annotate

Move changes where they belong immediately -- different file, new file, gitignore entry.
When unsure, propose a concrete edit and location.

## Package completeness

A package is not finished until:
- It has a `README.md`
- It passes linting with zero errors

Do not declare work complete while either condition is unmet.

## Verify at the user boundary

After building, deploying, or installing an artifact, run a verification step that exercises
the artifact the way an end user would consume it.
Building, bundling, and installing are prerequisites -- not proof that the artifact works.

- Server: confirm it serves correct responses, not just that it starts
- CLI tool: run a real command and check the output
- Hook/plugin: trigger it through the host application, not just by piping test input directly
- Library: import and call it from a consuming project, not just compile it
- Web page: fetch the served HTML and confirm content renders

The verification must cross the integration boundary between the artifact and its consumer.
If the only evidence of success is "it compiled" or "it installed," the task is not verified.

## Hooks and automation

Add explicit guards (transcript size check, env var flag, session type filter) to any automation that spawns agent sessions to prevent recursive token burn.

## Script preferences

- **Never write bash/shell scripts** -- use TypeScript files as `mise.<action>.ts` in `packages/module/es/src/`
- Execute with Bun directly; use top-level code and top-level await (no `main()` wrapper)

## Tool version management

Only pin versions with clear justification and a comment explaining why.

## Test assumptions before encoding them

When writing instructions, configuration, or documentation that prescribes how a tool or API behaves,
test the claim first with a real invocation.
Do not write "use X for Y" based on how X **should** work --
run X against a real target and confirm the output before committing to the approach.
This applies to agent prompts, README guidance, CI scripts, and any artifact that future sessions will follow.

## Third-party libraries

- Immediately retrieve documentation on undefined method errors
- Check actual type definitions before using APIs
- Pay attention to CLI tool command patterns across examples; test the simplest case first
- Never modify files in cloned third-party repositories -- use configuration, env vars, or wrapper scripts
- When encountering unexpected behavior from an external tool, clone its source and trace the exact code path to pinpoint the root cause before assuming a limitation or working around it
- After investigating, write a detailed entry in the appropriate `TROUBLESHOOTING.*.md` file covering: minimal repro, root cause with exact source locations, verified solutions, and what does not work
- When documenting an upstream bug or documentation error in a `BUGREPORT.*.md` file,
  always include an exact source code trace (file paths, line numbers, code snippets)
  that proves the claim -- never assert "the source does X" without showing the code path.
  Also include a draft GitHub issue at the end of the document,
  ready to file against the upstream repository,
  with title, labels, description, reproduction steps, and suggested fix.

# Code Quality

## Simplification

- Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state and imperative loops
- Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-es`) over manual promise creation
- Extract and name concepts; start simple, refactor to complexity only when necessary
- Simplification progression: imperative loop -> while -> for -> recursive -> higher-order functions/async iterators
- Never disable, raise, or bypass the max-lines limit; always split into separate files instead of trimming, compressing, or removing content to fit

## Linting

- Identify which tool reports an error (ESLint vs Oxlint) before fixing
- Prefer `Object.entries` and functional methods over `for...in`
- Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering the rules.

## Logging

Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events.
Never remove logging to "clean up" -- treat logging as permanent infrastructure.

Always use tagged loggers from `@monochromatic-dev/module-es`.
Never use raw `console.log`/`console.error` or untagged logger instances in production code.
Exception: raw `console` is allowed when precise control over terminal output is needed (e.g. CLI user-facing messages, progress indicators, interactive prompts).

- Tag at every module and function boundary; use `myFn.name` as tag to stay in sync with refactors
- Compose tags deeply -- when calling a sub-function that accepts a logger, wrap the current logger with an additional tag before passing it
- Never embed tags manually in message strings (e.g. `l.info("[cycle] done")`) -- use the `tagged` wrapper instead

## Security

No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

## CSS best practices

- Use native platform features: `<dialog>`, Popover API, CSS nesting, `@layer`, `@scope`, container queries
- Browser baseline: Firefox ESR 140 (June 2025); see `PHILOSOPHY.browser-support.md`
- `rem` for all sizing (use `calc()` for derivation); never `px` except device-pixel-dependent contexts
- Logical properties everywhere (`margin-inline-start`, `inset-block-start`, `text-align: start`)
- No shorthand properties that combine unrelated axes or sub-properties (e.g. `margin`, `padding`, `border`, `background`); longhand is easier to scan and diff. Single-axis or single-concept shorthands are fine (`padding-inline`, `margin-block`, `border-radius`, `inset`, `gap`).
- All colors via CSS custom properties from the design token system; no `var()` fallbacks (exception: user-configurable properties)
- Minimal declarations; no `!important`; fluid approaches over breakpoints
- `:focus-visible` on all interactive elements; `48px` minimum touch targets via `min-inline-size`/`min-block-size`
- Small composable mixins named by what they do (not what they style)
- Native CSS nesting; shallow depth (3 levels max)
- Data attributes for state/variant styling instead of BEM modifiers

# TypeScript Standards

- Adhere to ESLint, Oxlint, dprint configurations
- Use `//region`/`//endregion` markers with purpose and explanation for logical code sections
- Include `.ts` extensions in imports; group: built-ins, external, workspace, relative, type-only
- Prefer named imports, `import type` for type-only, absolute imports for workspace packages
- Use `import ... with { type: 'text' }` for static assets (SVG, HTML, CSS, SQL) instead of `readFile` -- Bun resolves these at build time with no async preload step needed
- No arrow functions -- use named function declarations; arrows produce anonymous stack traces and hide intent
- No `const x = function() {}` -- use a function declaration instead; declarations are compatible with TSDoc, support overloading, and are easier to scan
- No calling functions before their declaration in source order -- hoisting makes it legal but reading top-down becomes unreliable
- Always name functions; parentheses around all arrow params in external API callbacks where arrows are unavoidable
- Functions with 2+ parameters must use a single destructured object parameter (named params); exempt: callbacks whose signature is dictated by an external API or library
- No rest parameters (`...args`) in functions we control; accept an array parameter instead
- Export immediately at declaration; avoid `Object.assign` for extending typed objects
- Throw and return early; use overloads (most specific first)

## Type system

- Explicit parameter and return types; `type` over `interface`; `Record` for maps
- Avoid generic `Function` type; avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`
- Union types over enums; `as const` for literals; branded types for domain primitives
- Narrow symbol unions by `typeof` first, then identity check
- `const` generic parameters; `readonly` array parameters; meaningful constraint names (e.g. `TData`)
- Prefer `as` over angle bracket syntax; use type guards for runtime checking; avoid deep nesting in conditional types
- Use assertion functions (`asserts value is T`) for runtime type narrowing
- TypeScript does not propagate `const` narrowing into **function declarations** (both tsc and tsgo); `checker.ts:31181-31192` only extends flow analysis across `FunctionExpression`, `ArrowFunction`, and method/accessor closures because declarations are hoisted and could be called before the narrowing guard. Fix: use a helper that returns non-null (`function requireElement<T>(sel): T { ... throw ... }`), or reassign to a new `const` with an explicit type annotation after the null check
- Generator overloads: remove `*` (sync) or `async *` (async) from non-implementation signatures

## Variables and values

- `const` over `let`; comment any deviation from immutability
- Remove unused variables or prefix with underscore (`_unusedVar`)
- No single-letter variables (exception: math formulas)
- Functional approaches over loops; `for...of` when iteration is unavoidable
- Avoid deprecated features (`substring()`/`slice()` over `substr()`)
- `satisfies` for type checking without widening; separate destructuring blocks for dependent values
- Magic literals as named `const` (exception: `-2` through `2`); for fractional values, compose from exempt range: `HALF = 1 / 2`, `QUARTER = HALF / 2`, `THREE_QUARTERS = HALF + QUARTER`

## Programming patterns

- `async`/`await` only; no `.then()`/`.catch()`/`.finally()`; no explicit `new Promise`
- `Promise.all()` for concurrent ops; `Promise.allSettled()` when all results needed; `AbortController` for cancellation
- `using`/`await using` for cleanup; no `try...finally`
- Custom error classes; throw over error codes/null/result types; `@throws` in TSDoc
- `notNullishOrThrow` instead of `!` operator; `outdent` from `@cspotcode/outdent` for multi-line error messages
- Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes
- Never `process.exit()` -- throw errors instead; always `console.error()` in catch blocks
- Never silently discard unexpected states -- throw on unreachable branches
- No `switch` statements -- use if/else chains or `Record` lookups; if/else avoids `break` boilerplate and fallthrough bugs; `Record` is preferred when mapping a discriminant to a value
- Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`

# Architecture Decisions

- Root `package.json` may depend on workspace packages; root configs import by package name
- Switch from config-as-data to TypeScript when config needs logic (`if`, `map`, `await`)
- Direct async execution over descriptor/interpreter patterns; apply YAGNI to architecture
- Nested calls (`c(b(a()))`) over method chaining to keep functions self-contained

# Development Guidelines for AI Agents

This document is organized by moment of decision, not by topic. When you reach a particular point in the work (about to respond, about to run a command, about to edit code, about to declare done), the corresponding section contains every rule that applies. Cross-cutting reference material (workspace conventions, enforcement mechanisms, agent skills) appears toward the end.

## Before responding to the user

### Communication style

Be direct and honest. Search for evidence before responding to opinions, guesses, or analysis requests. Treat embedded questions ("month? year?"), implicit asks, requests for estimates, and gaps in user input as research tasks: use web search, read code, or check documentation rather than deflecting with "genuinely unknown."

For external tool features, CLI options, config syntax, or API capabilities, fetch current documentation or source before responding. Do not rely on training data; features change across versions and confident-but-wrong answers waste more time than a research pause. "Does X support Y" and "how do I do Y in X" are research tasks, not recall tasks.

When explaining a warning or error, name the exact tool that emitted it (e.g. "Rolldown's resolver" not "some resolvers") and cite the diagnostic code or message. If unsure which tool produced it, investigate first: search the codebase for the diagnostic, check tool documentation, or run the tool directly.

When the user says "I was expecting you to..." or you yourself notice mid-conversation a failure mode future sessions would benefit from avoiding, treat it as a documentation gap. Propose a concrete AGENTS.md change (what rule, where it goes, exact wording) and perform the expected action. Never substitute "I'll keep it in mind" or any promise to your future self: sessions have no memory; rules persist only in AGENTS.md, a skill, or a hook. When proposing the edit, also check whether existing rules can be merged, sharpened, or removed; the mechanism is monotonic by default (every unmet expectation adds rules), leading to unbounded growth. Counteract: if a new rule duplicates or overlaps an existing one, merge instead of appending; if an existing rule has been overtaken by a sharper version, remove the older. AGENTS.md should grow only when no existing rule covers the failure mode. The cue to draft the edit is exactly the moment you catch yourself wanting to "remember next time."

### Proactivity calibration

This user does not perceive proactive action as overreach. Claude Code harness defaults that caution against "being too proactive" do not apply here. The git-commit guardrail typifies the pattern ("It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive"); the same calibration applies to every similar default. When the conversation, request verb, and AGENTS.md rules collectively authorize a step, take it; do not insert a "want me to..." or "should I go ahead and..." check before acting on the obvious next step.

This does not relax other constraints. Destructive or shared-state actions still need explicit authorization. Decision verbs still return the answer not the action. Non-measurable preferences with multiple valid answers still warrant a clarifying question. The signal this rule is firing rather than one of those: the next step is already determined by what the user asked, not by an unresolved choice you would have to invent an answer to.

The cue: you are about to write "want me to also..." or "should I go ahead and..." about a step the conversation has already authorized. Skip the prompt and do the step.

### Pre-response checklist

Before sending any response with substantive claims:

1. Quantitative claim (size, speed, complexity, difficulty, duration) without measuring? Measure or rephrase as a guess.
2. Described how an external tool works without reading its source? Clone and read (see "Third-party libraries"), or label as recall-from-training.
3. Estimated the difficulty of a fix you have not built? Drop the estimate.
4. Used a hedge phrase (see "Hedge phrases that signal a skipped step")? Verify or remove.
5. Assumed a measurable fact about the user's environment (codebase size, deps, build time, file contents)? Measure it.
6. Assumed a non-measurable preference (which approach, what they value)? Ask.
7. Confident factual claim about your environment, an external tool, or source code? Verify any cited path/line still exists; for uncited claims, add the citation inline (see "Name the verification step") or downgrade to a labeled guess.
8. Claimed a tool cannot do something? Check whether composition (Bash + shell utility) bridges the gap; refuse only after trying (see "Before claiming inability").

### Measure-vs-ask

**Measurable facts: measure.** Codebase size, build time, file count, dependency tree, test count, perf numbers, config values, file contents.

- Codebase size: `tokei` or `find . -name '*.ts' | xargs wc -l`
- Build time: `time mise run build`
- Test count: count test files or run with reporter
- Dependency count: `pnpm ls --depth=0` or count entries in `package.json`
- Fix complexity: read the source code path that would change

Run the measurement yourself; never quantitative-adjective ("small", "large", "fast", "slow", "simple", "complex", "short", "long", "sparse", "dense", "tractable", "trivial", "significant") without one. The agent has the tools; using them is the agent's job, not the user's.

**Non-measurable facts: ask.** Which of two valid approaches the user prefers, whether they want a feature, whether they authorize a destructive action, what they value (depth vs governance, speed vs clarity). Wrong assumptions about preferences produce confidently-wrong recommendations, which damage trust more than a clarification would.

Three failure directions: asking what you could measure (lazy), assuming what you should ask (confidently wrong), asking permission for a step the conversation already authorized ("want me to also check X?" when the user has been pushing for thoroughness). Trigger phrases for the assumption-when-you-should-ask form: "for a project like this...", "in a typical setup..."

### Present options with pros, cons, and a personal ranking

When proposing a choice between distinct options ("A, B, or C?"), give each option its own pros and cons and a fully sorted personal ranking covering every option, with the reasons that decide each adjacent pair. A flat list pushes deliberation back to the user without the comparison work the agent has already done; naming only the top pick still hides the rest of the ordering, so the user cannot tell what the agent thinks about the runners-up.

- `AskUserQuestion`: each option's `description` holds its pros and cons; order the options by preference (best first) and append "(Recommended)" to the top label; in the prose around the tool call, state the full ranking (e.g. "ranking: B > A > C") with the reason for each adjacent comparison.
- Inline prose: one short paragraph or bullet block per option with pros and cons, then a "Ranking: B > A > C, because ..." line that explains each step of the order, not just the top pick.

Skip when the user asked yes/no on a single proposal or already narrowed the criteria enough that one option is determined.

### Hedge phrases that signal a skipped step

Do not write these; do the step instead.

- "probably small/large/fast/slow": run the measurement
- "the fix is probably small": read the source code path or drop the estimate
- "I think it's a...": verify or label as a guess
- "the most likely cause is...": reproduce or list candidates without ranking
- "for a small codebase like yours": run `tokei` first
- "better/worse than most/typical/average X": name the comparison set or drop the comparative; the qualifier sounds confident but invokes an unverified population (`<Xer> than most` and `worse/more/less than most` are hook-caught; `than typical`/`than average` rely on self-catch)
- "this is a tractable PR": drop "tractable" or actually build the fix
- "should be straightforward": drop "straightforward" or test the path
- "no public diagnosis exists" used as a stopping point: drop or clone the source yourself (see "Third-party libraries")
- "an afternoon" or any other duration estimate: only valid if you have built a similar fix in this codebase before; otherwise drop

The `ccsr` stop hook catches some of these at response-send time; internal self-catch is faster.

**Exception: genuine uncertainty.** When the honest answer is "I do not know and the question is genuinely under-determined after investigation," state it explicitly. Name what you investigated and what specifically is unresolved. The antipattern this targets is hedging as a substitute for research, not honest reporting of remaining uncertainty after research. "I read X.ts:42 and the type can be either A or B depending on a runtime branch I cannot determine statically" is not a hedge.

### Exhaust evidence layers when assessing system usage

For "should we use X better?" / "are we taking advantage of X?", walk every layer before recommending. Each can flip the conclusion.

1. **The tool itself**: usage volume, configuration.
2. **Parallel systems**: where the same need is met outside the tool (markdown roadmaps standing in for issue trackers, ad-hoc scripts for build systems, manual checks for CI).
3. **Content of those parallel systems**: not just file count but what is inside (a 40-file TODO directory may be a structured roadmap or a dumping ground; the recommendation is opposite).
4. **Inline annotations in code**: TODO/FIXME/HACK, deprecation markers, workaround comments. Zero is a signal of discipline (but verify the search ran; see null-search rule); thousands is debt.
5. **Suppressions and exceptions**: lint disables, type-error suppressions, skipped tests. Justified-with-rationale is healthy; bare suppressions are debt.
6. **Stated policies in code or config**: comments declaring intent ("X is tracked via Y, not Z") that may or may not be followed in practice.

Report findings at each layer before drawing the conclusion. A recommendation given after only checking layer 1 is a guess shaped by the surface you happened to look at.

### Vet vendor recommendations across problem layers

Before research, identify **context-fork questions**: facts about the user's deployment, role, or constraints that would push the recommendation in completely different directions (primary delivery vs backup, personal vs business-critical, self-hosted vs serverless, free-only vs willing-to-pay, geography or compliance). If unspecified and the answer would change the candidate set itself, ask via AskUserQuestion. One clarifying turn is far cheaper than researching the wrong tree.

Once context is set, complete every layer before naming any candidate:

1. **Layoffs and headcount** (24mo): TechCrunch tracker, Crunchbase, Glassdoor.
2. **Customer reviews**: Trustpilot, G2, Capterra. Look for account-suspension patterns, billing-automation horror stories, support-quality complaints.
3. **Recent outages** (12mo): official status page plus an aggregator (statusgator, isdown).
4. **Funding and business model**: bootstrapped vs VC vs PE; recent M&A or offers received. Affects shareholder pressure to extract from existing customers.
5. **Signup-friction signals**: email-domain blocks, KYC, geography blocks. Correlate with heavy-handed automation that produces post-signup account-policy issues.
6. **Security and abuse history**: breaches, phishing-host reputation, abuse-report responsiveness.

Report findings inline with the recommendation; do not lead with the candidate name and bury concerns in trailing caveats. A recommendation made after checking only "do they satisfy the constraints" is a guess; the user catches the gap when they sign up and discover the problem themselves.

### Constraint-fit before stack-fit, tool-fit before first-principles

When the user states a hard performance, scale, latency, or compatibility constraint, let the constraint pick the technology, not the surrounding monorepo or your familiarity. Greenfield projects: existing stack is a soft preference, not a constraint. The phrases "since you're already using X" or "to match your stack" are evidence this rule is firing and you are about to violate it.

When the problem class has existing tools, surface them before proposing a hand-rolled solution. Graphics/rendering/many-entity work: name game engines (Bevy, Godot, Unreal). Databases: name existing engines. Collaboration: name CRDT libraries (Yjs, Automerge). Build from scratch only when an existing tool's constraints conflict with stated requirements, and state the conflict.

The same rule fires for dependency replacements, not just greenfield choices. When recommending swapping out an existing package, survey ready-to-use alternative packages first; "write our own thin wrapper" is the last option, not the first. Search the npm registry by keyword, search GitHub by topic, and name every meaningful candidate inline. The cue you are about to violate this rule: about to recommend a hand-rolled module without having named at least two real packages and the concrete reason each fails the constraints.

Remediation when proposing a technology: name at least two alternatives with concrete reasons (cite the specific incompatibility, not "doesn't fit") for not picking each. Maintain a decision document (`docs/decisions/<project>.md` or co-located with the package) capturing rejected alternatives and reasons. Without it, the same rejected paths get re-proposed and the user pushes back again.

Signal you are about to violate this rule:

- proposing a technology without listing alternatives;
- skipping the decision-doc update after the user picks;
- silent anchoring: defaulting without writing the default down for inspection. The verbalized form ("since you're already using X") is the easy catch; the silent form is the common failure (the assumption never reaches the response, so neither you nor the user can see it). Remedy: write the candidate set explicitly even when one option feels obvious.

### Before claiming inability

"I cannot read this file format" / "my tools do not support that operation" is a capability claim about the whole toolset, not Read or Bash individually. Bash plus shell utilities (`ffmpeg`, `pandoc`, `magick`, `pdftotext`, `jq`, and many others) compose with Read into a wider capability than any single tool. Try a bridging path before refusing: convert the input to a format your tools accept, decompose into supported steps, or run the file through a shell utility and read its output.

Refuse only after attempting a bridge and confirming no path exists. State the bridges you tried; an unconsidered refusal looks identical to a real obstacle, and the user cannot tell which is which.

### Name the verification step

Confident factual claims about the user's environment, an external tool, or source code must be paired with what backs them, inline:

- "the bug is in `ci.py:851` (read the source)"
- "the codebase has 158k TS LOC across 1,903 files (`tokei` output above)"
- "express 4.x is supported (verified by reading the package's README at the cloned repo)"

Confident-but-unbacked claims read identically to verified ones; the user cannot tell which to trust until something breaks. If you cannot name what backs a claim, downgrade to a labeled guess ("I have not verified this, but my reading-from-training is...") or do the verification.

### Treat search results as suspicious until you've verified the shape

Every search result carries two claims: (a) the search ran correctly, (b) the lines you're seeing are the matches. Both can fail silently.

#### Zero-match silent failures

- Invalid `--type` argument (e.g. `rg --type tsx`, where `tsx` is not a registered ripgrep type; the `ts` type already covers `*.tsx`)
- Wrong path or glob excluding the intended files
- `2>/dev/null` masking the actual error message
- Stale or empty target directory
- Stdin-reading mode triggered by missing path argument (see "Before running a command")

#### Non-zero-match silent failures (same shape, opposite direction)

- `head -N` truncating before later files have a chance; one noisy file can consume the cap and bury everything alphabetically later. Remove the cap or raise it before drawing a conclusion; if you must cap, surface in the response that the result is truncated.
- Denylist filters (`rg -v 'a|b|c'`) hide whatever you forgot to keep and discard whatever you forgot to include, invisibly. Prefer allowlist patterns: a positive shape that captures what you want (e.g. literal `' cat '` with surrounding spaces for prose-form English usage of a word that is also a shell command) rejects the rest by construction.
- `-l` (filenames only) hides the context needed to tell real matches from noise. Default to full lines; switch to `-l` only after you've confirmed the noise cost is concrete.
- Narrow `--type` on the first pass feels thorough but skips matches in unexpected file kinds. Widen first; narrow only after the wide scan was already clean.

A non-zero result does not self-validate any more than a zero result does. Run a sanity-check (broader pattern, no cap, no negative filter) before claiming you've enumerated what's there.

### Document non-obvious findings

When discovering something that would not be immediately obvious to a future reader, document it in the relevant readme or doc file right away: implementation details, behavioral quirks, implicit constraints, anything that required investigation or experimentation to uncover.

### Research tools

- `rg`: fast text search; use directly rather than navigating directory trees; `rg --files` to find files by glob
- `agent-browser`: headless browser CLI; rendered web pages, screenshots, web UI interaction, deployed-app verification
- `FetchUrl`: documentation sites, npm pages, GitHub READMEs; raw source still useful when docs are incomplete
- `gh`: GitHub issues, PRs, release notes, repository metadata
- Web search cannot inspect package internals (sizes, dependency trees, source); clone repos or install packages (see "Before running a command" for the clone-to-`/tmp` operational rule)
- Do not remove cloned repos or other audit artifacts from `/tmp`; the user will clean up when ready

## Before running a command

Pipes in the Bash tool are unreliable; the Claude Code issue tracking the bug is treated as wontfix. Workaround: redirect to a file then read the file.

Always pass an explicit path (`.` or absolute) to `rg` in the Bash tool. Without a path argument, `rg` detects non-TTY stdin in the sandbox and switches to stdin-reading mode. Combined with command chains (`&&`, `;`), the `< /dev/null` redirect misapplies to the last command, leaving `rg` blocking forever on a socket that never sends EOF. See `PIPE-BUG.md`.

The Glob tool is denylisted (does not respect .gitignore); unlikely to change.

Clone entire git repo of a package to a temp dir whenever investigating source code. Use `gh repo clone` instead of `git clone`; `gh` handles authentication and fork remotes automatically.

Sandbox breaks `pnpm install` despite proper allowlisting; run it outside sandbox. Marked wontfix.

### Bash output path collapse

Do not treat `~` in Bash tool output as a literal tilde. It is a display substitution for `/var/home/user` or `/home/user` applied by the `bash-output-filter` hook, plus stripping of the current cwd prefix. The substitution makes output more readable; it applies only at the start of a line, so paths inside JSON or error messages are unaffected. Filesystem values are unchanged; this is display-only. Account for the transform when debugging path issues before concluding the path is wrong.

To skip the filter for one command, include any blocklist trigger. The simplest is `eval 'your command here'`. Other triggers: `export`, `source`, `$(...)`, backticks, `> file` redirect.

### Physical-harm consideration

Before any action, consider whether it could cause physical harm to a human (blasting audio volume, triggering flashing content, activating hardware unexpectedly). If it could, warn the user and state what will happen before proceeding.

### Resource-exhaustion isolation

Always run commands that might crash or exhaust the host system in a performance-limited container or VM, never directly on the host. The "may exhaust the host" set is broader than the destructive-command set: anything that allocates a lot of memory, spawns many processes, opens many file descriptors, runs unbounded loops, or otherwise consumes resources without a tight upper bound. Examples:

- stress harnesses and load generators (`mise run //:forge:stress`, `mise run //:test` with thousands of cases, k6/wrk runs)
- builds that fan out across many packages without concurrency caps
- benchmarks that allocate large blobs or fork many workers (`bun bench`, `mitata` runs)
- scenarios that loop over `git.packObjects` / `git.indexPack` or other heavy isomorphic-git ops
- subprocess fan-outs with no `--writers=` / `--concurrency=` ceiling
- anything that imports a server runtime that opens libSQL, warms caches, or schedules timers in a tight loop

Use `podman run --memory=2g --cpus=2 --rm -v $PWD:/work -w /work <image>` for container isolation, or the `mvm` CLI for VM isolation. State the bounds explicitly (memory cap, cpu cap, timeout). If the user requests one of these directly, propose the containerised invocation and confirm. Past authorisation does not transfer across commands; each heavy run needs an isolated environment.

### Destructive command ban

Never execute or instruct another agent to execute extremely destructive commands, even as guardrail tests, e.g. `sudo rm -rf /`, `mkfs`, `dd of=/dev/sda`, fork bombs. Guardrails can fail; a catastrophic command must not appear in instructions to other agents, subshells, or generated scripts regardless of intent. For verifying a guardrail, use moderately dangerous commands (e.g. `sudo apt-get install`).

## Before editing code

### Match action scope to the request verb

Decision verbs ("decide", "evaluate", "assess", "review", "audit", "triage", "look at", "analyze", "investigate") request a deliberation. The deliverable is the answer; do not also apply the fixes the answer implies. Action verbs ("fix", "implement", "apply", "do", "change", "add", "remove", "update", "refactor") authorize the action.

"Decide which security alerts we can fix immediately" is triage; the deliverable is the categorized list. Applying the fixes is a separate decision the user has not yet made; surface a concrete proposal and wait for green-light.

This holds in Auto Mode. Auto Mode's "prefer action over planning" applies to executing the requested action, not to expanding scope beyond what was requested. Auto Mode is not authorization to act on adjacent decisions the user has not made.

When the verb is ambiguous, default to the narrower interpretation and propose the broader action explicitly.

### Act, don't annotate

Move changes where they belong immediately: different file, new file, gitignore entry. When unsure, propose a concrete edit and location.

### Cross-runtime and scripts

- Prefer cross-runtime patterns instead of Bun-specific implementations.
- Never write bash/shell scripts; use TypeScript files as `mise.<action>.ts` in `packages/module/es/src/`. Execute with Bun directly; top-level code and top-level await (no `main()` wrapper).
- Pin tool versions only with clear justification and a comment explaining why.
- Add explicit guards (transcript size check, env var flag, session type filter) to any automation that spawns agent sessions, to prevent recursive token burn.

### Simplification

- Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state and imperative loops.
- Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-es`) over manual promise creation.
- Extract and name concepts; start simple, refactor to complexity only when necessary.
- Simplification progression: imperative loop -> while -> for -> recursive -> higher-order functions/async iterators.
- Never disable, raise, bypass, or work around the max-lines limit. Remediate by splitting: re-export from `index.ts`; move helpers to siblings (e.g. `crc32.ts`, `headers.ts`), constants to `constants.ts`, types to `types.ts`. Pattern: `packages/module/hyperscript/src/index.ts` (76 lines, pure re-exports), `packages/module/image-diff/src/index.ts` (75 lines, pure re-exports). Forbidden workarounds (each violates another rule): compressing function arguments to one line, joining multi-line statements, removing TSDoc, removing `//region` markers, joining declarations. If you find yourself reformatting to reduce line count, stop; the fix lives in another file.

### Linting

- Never violate one rule to satisfy another. Lint rules form a single shape: code that satisfies all of them. When two rules appear to conflict, the remediation is structural (split, extract, rename), never reformatting one rule's surface to silence another. Signal you are violating-to-satisfy: about to undo something the autofix or AGENTS.md prescribed (e.g. compressing args back onto one line to fit max-lines).
- Prefer `Object.entries` and functional methods over `for...in`.
- Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering the rules.
- Block-level `/* oxlint-disable rule */` must wrap tightly. Order with TSDoc: `/* oxlint-disable rule */` -> `/** TSDoc */` -> declaration -> `/* oxlint-enable rule */`. The disable goes **before** the TSDoc so the TSDoc remains the immediately preceding comment. The enable goes on the **very next line** after the declaration (or closing `);`/`}`). Never at end-of-file or many lines later. Leaving a disable open longer than necessary silences unrelated violations.

### Logging

Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events. Never remove logging to "clean up"; treat it as permanent infrastructure.

Always use tagged loggers from `@monochromatic-dev/module-es`. Never use raw `console.log`/`console.error` or untagged logger instances in production code. Exception: raw `console` is allowed when precise control over terminal output is needed (CLI user-facing messages, progress indicators, interactive prompts).

- Tag at every module and function boundary; use `myFn.name` as tag to stay in sync with refactors.
- Compose tags deeply: when calling a sub-function that accepts a logger, wrap the current logger with an additional tag before passing it.
- Never embed tags manually in message strings (e.g. `l.info("[cycle] done")`). Use the `tagged` wrapper instead.

### Security

No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

### CSS

- Use native platform features: `<dialog>`, Popover API, CSS nesting, `@layer`, `@scope`, container queries.
- Browser baseline: Firefox ESR 140 (June 2025); see `PHILOSOPHY.browser-support.md`.
- `rem` for all sizing (use `calc()` for derivation); never `px` except device-pixel-dependent contexts.
- Logical properties everywhere (`margin-inline-start`, `inset-block-start`, `text-align: start`).
- No shorthand properties that combine unrelated axes or sub-properties (e.g. `margin`, `padding`, `border`, `background`); longhand is easier to scan and diff. Single-axis or single-concept shorthands are fine (`padding-inline`, `margin-block`, `border-radius`, `inset`, `gap`).
- All colors via CSS custom properties from the design token system; no `var()` fallbacks (exception: user-configurable properties).
- Minimal declarations; no `!important`; fluid approaches over breakpoints.
- `:focus-visible` on all interactive elements; `48px` minimum touch targets via `min-inline-size`/`min-block-size`.
- Small composable mixins named by what they do (not what they style).
- Native CSS nesting; shallow depth (3 levels max).
- Data attributes for state/variant styling instead of BEM modifiers.

### TSDoc comments

Write comprehensive TSDoc for **all** declarations (exported or not, including locals): functions, types, constants, classes, enums, variables, interfaces. Adhere to the TSDoc rules enforced by `@monochromatic-dev/config-oxlint-tsdoc`. Use `{@inheritDoc originalFn}` for non-async wrappers.

- Use `${ // comment \n '' }` to embed comments inside template literals; do not use target-language comments or move the comment outside the template.
- TSDoc (`/** */`) for declarations only; use `//` or `/* */` for statements, control flow, imports, returns.
- TSDoc must directly precede a declaration, not a statement.
- Comments on their own line above code, never inline after code.
- Escape `*/` as `*\\/` inside TSDoc blocks.
- Avoid `the`/`a`/`an` in `@param`/`@returns`; explain **why**, not **what**.
- Do not mention Promise wrapping for async functions.
- Include `@example` tags with usage examples.

### TypeScript

#### Standards

- Adhere to Oxlint, dprint configurations.
- Use `//region`/`//endregion` markers with purpose and explanation for logical code sections.
- Include `.ts` extensions in imports; group: built-ins, external, workspace, relative, type-only.
- Prefer named imports, `import type` for type-only, absolute imports for workspace packages.
- Use `import ... with { type: 'text' }` for static assets (SVG, HTML, CSS, SQL) instead of `readFile`; Bun resolves these at build time with no async preload step needed.
- Use named function declarations exclusively: no arrow functions (anonymous stack traces, hide intent), no const-bound function expressions (no TSDoc, no overloads, harder to scan). Exception for callbacks whose signature is dictated by an external API or library: arrows are unavoidable; name the function and parenthesise all params.
- No calling functions before their declaration in source order; hoisting makes it legal but reading top-down becomes unreliable.
- Functions with 2+ parameters must use a single destructured object parameter (named params); exempt: callbacks whose signature is dictated by an external API or library.
- No rest parameters (`...args`) in functions we control; accept an array parameter instead.
- Export immediately at declaration; avoid `Object.assign` for extending typed objects.
- Throw and return early; use overloads (most specific first).

#### Type system

- Explicit parameter and return types; `type` over `interface`; `Record` for maps.
- Avoid generic `Function` type; avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`.
- Union types over enums; `as const` for literals; branded types for domain primitives.
- Narrow symbol unions by `typeof` first, then identity check.
- `const` generic parameters; `readonly` array parameters; meaningful constraint names (e.g. `TData`).
- Prefer `as` over angle bracket syntax; use type guards for runtime checking; avoid deep nesting in conditional types.
- Use assertion functions (`asserts value is T`) for runtime type narrowing.
- TypeScript does not propagate `const` narrowing into **function declarations** (both tsc and tsgo); the compiler only extends flow analysis across `FunctionExpression`, `ArrowFunction`, and method/accessor closures, because declarations are hoisted and could be called before the narrowing guard. Fix: use a helper that returns non-null (`function requireElement<T>(sel): T { ... throw ... }`), or reassign to a new `const` with an explicit type annotation after the null check.
- Generator overloads: remove `*` (sync) or `async *` (async) from non-implementation signatures.

#### Variables and values

- `const` over `let`. Two hard rules enforce this:
  - `no-restricted-syntax/no-function-root-let` reports `let` at function-body root. Refactor to `const` (ternary, `Array.reduce`), wrap the mutation in a named-function IIFE `(function name () { let x; /* ... */ return x; })()`, or extract a helper function ending in `return <local-binding>` (the helper-shape allowlist suppresses the report).
  - `no-restricted-syntax/no-module-root-let` reports `let` at module root, including `export let`. Replace with a `Map`/`WeakMap`/`Set`/`WeakSet` container, `memoize()` from `@monochromatic-dev/module-es`, or an IIFE-into-const initialization.
  - For legitimate exceptions (multi-statement state machines, parser cursors with side-effecting branches), add `oxlint-disable-next-line` with a justification comment naming the constraint.
- Remove unused variables or prefix with underscore (`_unusedVar`).
- No single-letter variables (exception: math formulas).
- Functional approaches over loops; `for...of` when iteration is unavoidable.
- Avoid deprecated features (`substring()`/`slice()` over `substr()`).
- `satisfies` for type checking without widening; separate destructuring blocks for dependent values.
- Magic literals as named `const` (exception: `-2` through `2`); for fractional values, compose from exempt range: `HALF = 1 / 2`, `QUARTER = HALF / 2`, `THREE_QUARTERS = HALF + QUARTER`.

#### Programming patterns

- `async`/`await` only; no `.then()`/`.catch()`/`.finally()`; no explicit `new Promise`.
- `Promise.all()` for concurrent ops; `Promise.allSettled()` when all results needed; `AbortController` for cancellation.
- `using`/`await using` for cleanup; no `try...finally`.
- Custom error classes; throw over error codes/null/result types; `@throws` in TSDoc.
- `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator; `outdent` from `@cspotcode/outdent` for multi-line error messages.
- Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes.
- Never `process.exit()`: throw errors instead; always `console.error()` in catch blocks.
- Never silently discard unexpected states; throw on unreachable branches.
- No `switch` statements: use if/else chains or `Record` lookups; if/else avoids `break` boilerplate and fallthrough bugs; `Record` is preferred when mapping a discriminant to a value.
- Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`.

## Before declaring work complete

### Package completeness

A package is not finished until it has a `README.md`, passes linting with zero errors, and has tests covering every exported code path that all pass. Do not declare work complete while any condition is unmet.

### Test coverage matches the public API surface

Enumerate every distinct code path the module exposes, not just the obvious happy path. If the implementation has separate branches for sync vs async, string vs object, direct vs delegated, each branch needs its own test.

"Tests exist and pass" is not evidence of completeness. Compare test names against the implementation's branches and confirm there is no untested path. A test file that covers sync matchers but skips async matchers is the same as no tests for the async path; the bug ships silently.

### Verify at the user boundary

After building, deploying, or installing an artifact, run a verification step that exercises the artifact the way an end user would consume it. Building, bundling, and installing are prerequisites, not proof.

- Server: confirm it serves correct responses, not just that it starts.
- CLI tool: run a real command and check the output.
- Hook/plugin: trigger it through the host application, not just by piping test input directly.
- Library: import and call it from a consuming project, not just compile it.
- Web page: fetch the served HTML and confirm content renders.

The verification must cross the integration boundary between artifact and consumer. "It compiled" / "It installed" alone is not verification.

### Test assumptions before encoding them

When writing instructions, configuration, or documentation that prescribes how a tool or API behaves, test the claim first with a real invocation. Do not write "use X for Y" based on how X **should** work; run X against a real target and confirm the output. This applies to agent prompts, README guidance, CI scripts, and any artifact future sessions will follow.

## When investigating problems

### Third-party libraries

- Immediately retrieve documentation on undefined method errors.
- Check actual type definitions before using APIs.
- Pay attention to CLI tool command patterns across examples; test the simplest case first.
- Never modify files in cloned third-party repositories; use configuration, env vars, or wrapper scripts.
- When investigating an external tool's behavior, bug, capability, or fix difficulty, clone its source and read the relevant code path. This applies whether you encountered the bug yourself, are summarizing a tracker issue without diagnosis, or are estimating how hard a fix would be. A linked issue without diagnosis is not evidence the bug is undiagnosable; it is evidence nobody has diagnosed it yet, and the next investigator can be you. "No public diagnosis exists" is never a valid stopping point when the source is open. When citing a finding from cloned source, quote the file path, line number, and the relevant code excerpt so the user can verify your reasoning.
- When proposing a package to replace an existing dependency, audit the candidate to the same depth as the dependency being replaced: transitive deps, the source paths that handle the same cases the incumbent mishandles, build provenance for native or wasm modules (compiler flags, wasm import surface, whether the upstream sources are checksum-verified), and maintenance signals (downloads, stars, last commit, single-maintainer concentration). Report the audit findings inline with the recommendation, not as trailing caveats. Without this depth the recommendation replaces a known-flaw dependency with an unknown-flaw one, and the next audit lands in the same place.
- After investigating, write a detailed entry in the appropriate `TROUBLESHOOTING.*.md` file covering: minimal repro, root cause with exact source locations, verified solutions, and what does not work.
- When documenting an upstream bug or documentation error, always include an exact source code trace (file paths, line numbers, code snippets) that proves the claim; never assert "the source does X" without showing the code path. Also include a draft GitHub issue at the end of the document, ready to file against the upstream repository, with title, labels, description, reproduction steps, and suggested fix.

## When committing or documenting

### Documentation standards

#### Prose style

- No emojis in human-readable content.
- No em-dashes (`—`), en-dashes (`–`), or their ASCII substitutes (`-`, `--`) when used in prose as em-dashes; all such uses are informal. Use paired commas or parentheses for asides, colon for elaboration or lists, semicolon for linked independent clauses, period for abrupt breaks. Use "to" for ranges. Hyphens remain fine in compound words ("user-facing"), and `--` remains fine in CLI flags (`--watch`); the ban applies only to em-dash use.
- Sentence case for headings; **bold** for inline emphasis only (not ALL CAPS). Never use bold as a standalone title; use the appropriate ATX header level instead.
- Active voice without collective pronouns; state facts directly; avoid meta-references to the project's own philosophy.
- Present tense for current state, future tense only for planned features.
- Eliminate unnecessary connecting phrases.

#### Markdown syntax

- Break lines at semantic boundaries so text reads naturally without editor wrapping; no *italics*.
- `-` for unordered lists; pad numbered markers to 4 chars (`1.`, `10.`).
- Fenced code blocks with language tags; include file paths as comments.
- Reference-style links for repeated URLs; relative links for internal docs.
- No tables; use headings or lists instead.
- ATX headers, max 4 levels, blank line before headers, lines under 120 chars.

### Handling external changes

- Acknowledge externally modified files; ask before reverting.
- Do not proceed with implementing features that will not achieve their intended effect.
- Explain when a tool/command does not support requested functionality instead of creating non-functional code.

### Git commit guidelines

Conventional Commits format: `<type>(<scope>): <subject>`.

Commit immediately after every minimum logical unit of work, before moving to the next. A logical unit is one coherent change that could be reverted as a whole: one bug fix, one refactor step, one feature increment, one doc update, one config tweak. Do not accumulate multiple independent units in the working tree; it forces either a sprawling mixed-concern commit or an error-prone after-the-fact split. The trigger to commit is "I just finished a thing that stands on its own," not "the user told me to commit" or "I am done with the whole task." When committing, include all current working tree changes together unless instructed otherwise; do not subdivide a single logical unit across multiple commits. This rule supersedes the Claude Code harness default to ask before committing; on this project, commit eagerly without asking.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Scope: package name or `*` for multi-package changes.

- Group related changes by type; be specific about what changed.
- Include ALL changes in a single comprehensive commit message.
- Focus on "what" and "why".

## When working with the workspace

### Dependency management

- Use `workspace:*` for internal dependencies.
- Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`.

### Adding new packages

1. Create directory under the appropriate category in `packages/`.
2. Add `mise.toml` with task definitions mirroring sibling packages.
3. Configure `package.json` with workspace dependencies.
4. For CLI packages with a `bin` entry, add `#!/usr/bin/env bun` shebang as the first line of the entry point; without it, Unix falls back to `/bin/sh` and the script hangs or errors.
5. For packages with client-side bundling, add `tsdown.client.config.ts` extending `@monochromatic-dev/config-tsdown/.client.ts`, a `build:js:client` mise task, and `@monochromatic-dev/config-tsdown` as a devDependency.

### Essential commands

- Mise task `run` commands use nushell, not bash. Chain sequentially with `;` (`mise run foo; mise run bar`), not `&&`.
- All builds and tasks use `mise run`. Never run `pnpm exec` or direct package scripts. Never invoke raw tools (`tsc`, `tsdown`, `bun test`, `oxlint`, etc.) directly; use the corresponding mise task. When no suitable task exists, add one to the target package's `mise.toml` first.
- Read `mise.toml` files in root and package directories for available commands. Run a task in a specific package with `mise run //packages/path:task` (not `mise run -C`).
- There is no `PostToolUse` lint:types hook yet. Run `mise run //packages/<path>:lint:types` manually after editing TypeScript. The hook is on the roadmap but at least a month out.
- `mise watch -r` takes a bare task name, not a `mise run` invocation. Write `mise watch -w src -r -- start:server`, not `mise watch -w src -r -- mise run start:server`. When a dev task needs watch-restart, split the inner command into its own task (e.g. `start:server`) so `mise watch -r` can reference it by name.
- After modifying source in packages that produce dist output (e.g. `module-es`), always verify with `mise run buildAndTest` instead of running tests alone. Tests import from the built dist, so a stale build causes false failures. To run a specific test file after building: `mise run buildAndTest -- path/to/file.test.ts`.

### Workspace conventions

- Use the current date from the system prompt environment.
- Some root-level files (e.g. `CLAUDE.md`) are generated by file-enforcer. Before editing any root config file, check `file-enforcer.config.ts` to see if it is a managed output; if so, edit the source file instead and run file-enforcer.
- In spec mode (also called plan mode or pause mode), keep researching and gathering context until the user explicitly asks to draft or exit.

## Architecture decisions

- Root `package.json` may depend on workspace packages; root configs import by package name.
- Switch from config-as-data to TypeScript when config needs logic (`if`, `map`, `await`).
- Direct async execution over descriptor/interpreter patterns; apply YAGNI to architecture.
- Nested calls (`c(b(a()))`) over method chaining to keep functions self-contained.

## Enforcement mechanisms

Several hooks act on agent output and may block or modify actions.

- **`ccsr` stop hook**: inspects the assistant response at send time and rejects turns containing the hedge phrases listed under "Hedge phrases that signal a skipped step". Rejection returns the message to you with feedback; avoid via the pre-response checklist and hedge-phrases self-catch. Also flags responses that end in a question to the user without using the `AskUserQuestion` tool.
- **`bash-output-filter` hook**: transforms Bash tool output (see "Bash output path collapse"). Display only; does not modify actions. Triggers a bypass when the command contains `eval`, `export`, `source`, `$(...)`, backticks, or `> file`.
- **`forbidden-strings` CI scan**: runs in `.github/workflows/forbidden-strings.yml` on every PR (changed files only) and on push to main (full tree). Scans against a baseline deny-list plus an optional `FORBIDDEN_STRINGS_LIST` secret. Detects literal known-bad strings (leaked credentials, banned tokens). Failures block merge; scanner source is `packages/dev-script/forbidden-strings/`.

A `PostToolUse` lint:types hook is on the roadmap but not yet implemented; type-checking is manual (see "Essential commands" -> mise run lint:types).

## Agent skills

- **Issue tracker**: GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels**: five canonical roles with default label strings. See `docs/agents/triage-labels.md`.
- **Domain docs**: no context files; agents read fresh code on every probe. See `docs/agents/domain.md`.

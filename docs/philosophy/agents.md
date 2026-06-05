# AGENTS.md philosophy

## Purpose

AGENTS.md is for non-obvious, actionable guidance that neither an AI agent nor a human developer can infer from context or general knowledge alone.
It supplements, not replaces, common sense.

## Writing style

AGENTS.md is written caveman style: telegraphic, shortest expression for every rule.
It loads on every session, so each token there is paid again every time; brevity is a hard requirement, not a preference.
Drop articles ("the", "a", "an"), copulas, and connective filler wherever meaning survives; cut "in order to", "make sure to", "you should", and any clause that merely restates the rule.
Use the shortest accurate synonym (conf, src, docs, dir).
Fragments beat sentences.

This style binds AGENTS.md alone.
This philosophy doc and every other doc under `docs/` stay normal prose: reference loaded rarely, where clarity outranks token thrift.

Never compress away the load-bearing strings: tokens, paths, commands, identifiers; code blocks; section headings (external and internal cross-references resolve by name); the verbatim "Hedge phrases that signal a skipped step" list (a hook matches it literally).
Caveman compresses prose, never the strings the rules act on.

## Changelog policy

Changelogs are transient here, not permanent.
After an AGENTS.md change lands, add a `## Changelog` entry at the end of this doc describing what changed and why, commit the doc so git preserves the entry, then remove the entry and commit again.
This keeps the doc short while git history retains every changelog for future readers (`git log -p docs/philosophy/agents.md`).
Never let `## What was compressed`-style narratives accumulate here; the four prior ones were removed when this policy took effect and remain recoverable from history.

## What does not belong

### Skill invocation pointers

The harness auto-loads every skill's description, which already states when to use it.
A section that only says "invoke skill X when doing Y" duplicates that description and earns nothing; drop it.
Keep only the residue a skill description does not carry: project-specific tokens, exemptions, paths, or a behavioral mandate the description omits.
The `css` section was removed whole for this reason; `choosing-technology` likewise; the `troubleshooting-doc` and `runbook` mentions were cut to the project-specific bits (exemptions, handover paths) their descriptions do not state.

### Repository identity and high-level structure

Do not describe what the project is, what its core features are, or sketch its architecture unless those facts carry constraints an agent would not otherwise know.
A capable agent reading the codebase will infer these faster and more accurately than a written description.

Removed:

- "Repository Information"; obvious from package names and directory structure
- "Core Features"; obvious from the packages directory
- "Architecture"; was empty; real architecture constraints belong in specific technical sections

### Generic section titles

Avoid titles like "Important Reminders", "Notes", or "Miscellaneous".
Content with such titles belongs in a topically relevant section.
When no section fits, add one with a specific name.

### Runtime environment checks

Do not put detection logic or compatibility warnings in AGENTS.md when a hook can enforce the same constraint automatically and silently.
AGENTS.md text is passive; an agent reads it once and may not apply it consistently.
A hook fires on every session start and injects a warning directly into context only when the condition is actually violated.

### Removed: "Detecting the Current Shell"

The original section told agents how to detect whether the shell is bash-compatible (checking `$SHELL`, recognizing `pwsh`, etc.) and how to adjust syntax accordingly.
This was removed because:

1. AI agents already assume bash-compatible syntax by default and do not need to be told to.
2. The detection instructions were only useful if something was already wrong; a condition better caught by automation.
3. A `SessionStart` hook covers the failure case with no AGENTS.md noise for the common case.

### Hook setup

The replacement is a `check-shell.ts` SessionStart hook registered in your agent's global personal settings.
It runs on every session start, reads `SHELL`, and injects a warning into the session context when the shell is not in `{bash, zsh, sh, dash, ksh}`.
On a compatible shell it exits silently.

`check-shell.ts`:

```ts
/**
 * SessionStart hook: warns the agent if the current shell is not bash-compatible.
 * AI tooling assumes bash syntax; non-compatible shells cause silent command failures.
 */
const shell = process.env.SHELL ?? '';
const shellName = shell.split('/',).at(-1,) ?? '';
const bashCompatibleShells = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh',],);

if (shellName && !bashCompatibleShells.has(shellName,)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          `Shell warning: current shell is ${shellName} (SHELL=${shell}), which is not bash-compatible. Use bash-compatible syntax for all shell commands, or prefix commands with \`bash -c\`.`,
      },
    },),
  );
}
```

Global personal settings (relevant excerpt):

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bun run <global-hooks-dir>/check-shell.ts"
      }
    ]
  }
]
```

### Tool usage examples and rationale

Do not include syntax examples for standard tools (e.g. `rg`, `gh`, `curl`) or explain why a well-known tool is useful.
Any competent agent or developer already knows how to use `ripgrep` or when to reach for official documentation over source code.
Explaining these things wastes tokens on every context load and signals distrust of the reader.

Removed:

- `rg` examples (`-t ts`, `--type ts`, `-A 5 -B 5`): standard ripgrep flags, universally known
- "Reach for this first when working with a third-party library: the official docs are usually faster..."; states the obvious

What belongs instead: the name of the tool, what it covers in this project's context, and any non-obvious constraint (e.g. "raw source is still useful when docs are incomplete").

### Negative prompts

Avoid "Never assume X" when the positive instruction already makes the intent clear.
"Use the current date from the system prompt" is sufficient; "Never assume or guess" is redundant noise.

### Code examples for rules that are self-explanatory

Code examples belong in AGENTS.md only when the rule itself is ambiguous without one.
When a rule is clear from its text (e.g. "prefer `const` over `let`"), the example adds tokens without adding understanding.

Examples that illustrate **what to flag during review** belong in the code-review skill, not in AGENTS.md.
This way the examples load only when a review is happening, not on every session.

### Explanatory rationale for standard practices

Drop rationale like "for better tree-shaking" or "to improve build performance" when the practice is widely understood.
Keep rationale only when the reasoning is project-specific or counterintuitive.

### Detailed sub-rules for generic workflows

Compress multi-bullet expansions of a single rule into one line when the sub-bullets are obvious consequences.

Example: "Never modify files in cloned third-party repositories; use configuration, env vars, or wrapper scripts" replaces five bullets explaining why modification is bad and what the alternatives are.

### Inline pointers to this philosophy doc

Do not add per-rule "(see docs/philosophy/agents.md)" / "(rationale in docs/philosophy/agents.md)" pointers to AGENTS.md.
Normal operation needs the rule, its cue, and the tokens to act, not the rationale; an inline pointer implies the agent must read this doc to operate, which it must not.
Rationale, mechanism, and examples relocated here stay discoverable through the single global note at the top of AGENTS.md plus the section-name correspondence (each subsection under "Relocated rule rationale" is named for the AGENTS.md section it came from).
If a rule is genuinely crippled without relocated detail, move the detail back into AGENTS.md rather than pointing here.
A specific reference (exact section heading) is acceptable only when unavoidable; a vague "see PHILOSOPHY" never is.

### Implementation details behind a `mise run` task

How a task is wired internally is not an agent-facing rule.
Agents run tests with `mise run test` (or a package's `:test`), so they never need to know that Rust packages run on `cargo nextest run` instead of `cargo test`, that the fuzz crate scopes its run to `--lib`, or that Rust unit tests live in co-located `<name>_tests.rs` sidecars declared from the source file with `#[cfg(test)] #[path = "..."] mod tests;`.
The runner choice lives in the mise tasks; the sidecar layout lives in the source files themselves.
An agent editing a Rust file sees the existing `mod tests;` stub at the bottom and the sibling `*_tests.rs` beside it, and follows the pattern by example, the same way it infers any local convention from the code in front of it.
Restating that in AGENTS.md spends tokens every session to describe what the code already shows in context, and it invites the rule to drift from the implementation it documents.
Keep AGENTS.md to rules that change what an agent decides at a fork it would otherwise get wrong; leave runner choice and test-file mechanics to the tasks and the code.
This is the test-tooling instance of the general rule above ("Code examples for rules that are self-explanatory" and "Detailed sub-rules for generic workflows"): a convention an agent will copy from its surroundings does not need a written rule.

## Relocated rule rationale

The explanatory "why/how" for each rule below was moved here so AGENTS.md keeps only the terse enforceable rule, cue, and tokens. Headings match the AGENTS.md section they came from.

#### Essential commands: why `bun test` is banned for this harness

`bun test` specifically: never substitute it for a missing mise task. The custom `@monochromatic-dev/module-test` harness runs tests as a side effect of import, so `bun test <file>` prints `PASS` log lines (from the harness) and then reports `0 pass / 0 fail` (bun's runner finds no `bun:test` registrations). The misleading summary suggests the run was broken when in fact every test passed. Use `mise run //packages/<path>:test:unit`; if no such task exists, run the file directly with `bun <file>` (matches `packages/module/test/mise.toml`'s self-test pattern). A `PreToolUse` hook (`ccgr`, source at `packages/claude-code-plugins/source/src/handlers/guardrail.ts`) blocks the call when configured.

#### Type system: why `const` narrowing does not reach function declarations

TypeScript does not propagate `const` narrowing into function declarations (both tsc and tsgo); the compiler only extends flow analysis across `FunctionExpression`, `ArrowFunction`, and method/accessor closures, because declarations are hoisted and could be called before the narrowing guard. Fix: use a helper that returns non-null (`function requireElement<T>(sel): T { ... throw ... }`), or reassign to a new `const` with an explicit type annotation after the null check.

#### Git cleanup and worktree safety reviews: the cli-git tool-cache allowlist

When the review touches `cli-git`'s linked-worktree guard, account for the baked-in tool-cache allowlist (`DEFAULT_ALLOWED_WORKTREE_DIRS` in `packages/cli/git/src/allowed-worktree-dirs.ts`, currently uv's git cache): repositories whose git-dir resolves under an allowed dir bypass that guard, so destructive git is not actually blocked there.

#### Bash output path collapse: how the substitution works

`~` in Bash tool output is a display substitution for `/var/home/user` or `/home/user` applied by the `bash-output-filter` hook, plus stripping of the current cwd prefix. It applies only at the start of a line, so paths inside JSON or error messages are unaffected. Filesystem values are unchanged; this is display-only. To skip the filter for one command, include any blocklist trigger: `eval 'your command here'` is simplest; others are `export`, `source`, `$(...)`, backticks, `> file` redirect.

#### Resource-exhaustion isolation: the example set

The "may exhaust the host" set is broader than the destructive-command set: anything that allocates much memory, spawns many processes, opens many file descriptors, runs unbounded loops, or consumes resources without a tight upper bound. Examples: stress harnesses and load generators (`mise run //:forge:stress`, `mise run //:test` with thousands of cases, k6/wrk runs); builds that fan out across many packages without concurrency caps; benchmarks that allocate large blobs or fork many workers (`bun bench`, `mitata` runs); scenarios that loop over `git.packObjects` / `git.indexPack` or other heavy isomorphic-git ops; subprocess fan-outs with no `--writers=` / `--concurrency=` ceiling; anything that imports a server runtime that opens libSQL, warms caches, or schedules timers in a tight loop.

#### Simplification: max-lines split pattern examples

Remediate a max-lines violation by splitting: re-export from `index.ts`; move helpers to siblings (e.g. `crc32.ts`, `headers.ts`), constants to `constants.ts`, types to `types.ts`. Pattern examples: `packages/module/hyperscript/src/index.ts` (76 lines, pure re-exports), `packages/module/image-diff/src/index.ts` (75 lines, pure re-exports).

#### Name the verification step: the inline-citation examples

Examples of a confident claim paired inline with what backs it: "the bug is in `ci.py:851` (read the source)"; "the codebase has 158k TS LOC across 1,903 files (`tokei` output above)"; "express 4.x is supported (verified by reading the package's README at the cloned repo)".

#### Communication style: cite-the-right-source detail

The harness system prompt's rule sources include the Git Safety Protocol, tool-use guidelines, and format instructions. A rule can sound like it lives in any source, and a quick recall feels like enough; it is not. Failure shape: writing "AGENTS.md says never amend" when "never amend" lives in the harness Git Safety Protocol; the user asks "which line?" and the grep returns nothing.

#### Communication style: AGENTS.md growth discipline

Never substitute "I'll keep it in mind" or any promise to a future self: sessions have no memory; rules persist only in AGENTS.md, a skill, or a hook. The mechanism is monotonic by default (every unmet expectation adds rules), leading to unbounded growth. Counteract: AGENTS.md should grow only when no existing rule covers the failure mode.

#### Proactivity calibration: the git-commit guardrail example

The git-commit guardrail typifies the harness "too proactive" defaults this project overrides: "It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive." The same calibration applies to every similar default.

#### Measure-vs-ask: measurement recipes

- Codebase size: `tokei` or `find . -name '*.ts' | xargs wc -l`
- Build time: `time mise run build`
- Test count: count test files or run with reporter
- Dependency count: `pnpm ls --depth=0` or count entries in `package.json`
- Fix complexity: read the src code path that would change
- User commit cadence: `git log --format='%aI' --since=<date> | cut -dT -f1 | uniq -c` for commits-per-day distribution
- Daily commit span (proxy for working hours): per-day min and max hour from `git log --format='%aI'`
- Defect-recovery rate: count of `revert`/`regression`/`fix.*broken` commits over total commits in the window
- Concurrent-session evidence: compare `git log --since=<conversation-start>` timestamps against this conversation's UserPromptSubmit hook times

#### Treat search results as suspicious: failure modes

Every search result carries two claims: (a) the search ran correctly, (b) the lines you're seeing are the matches. Both can fail silently.

Zero-match silent failures: invalid `--type` argument (e.g. `rg --type tsx`, where `tsx` is not a registered ripgrep type; the `ts` type already covers `*.tsx`); wrong path or glob excluding the intended files; `2>/dev/null` masking the actual error message; stale or empty target dir; stdin-reading mode triggered by missing path argument (see "Before running a command").

Non-zero-match silent failures (same shape, opposite direction): `head -N` truncating before later files have a chance, where one noisy file consumes the cap and buries everything alphabetically later (remove or raise the cap, or surface that the result is truncated); denylist filters (`rg -v 'a|b|c'`) hide whatever you forgot to keep and discard whatever you forgot to include (prefer allowlist patterns: a positive shape like literal `' cat '` with surrounding spaces for prose-form English usage of a word that is also a shell command); `-l` (filenames only) hides the context needed to tell real matches from noise (default to full lines, switch to `-l` only after confirming the noise cost is concrete); narrow `--type` on the first pass feels thorough but skips matches in unexpected file kinds (widen first).

#### Third-party libraries: investigation and replacement-audit detail

Clone an external tool's source whether you hit the bug yourself, are summarizing an undiagnosed tracker issue, or are estimating fix difficulty: a linked issue without diagnosis means nobody has diagnosed it yet, not that it is undiagnosable, and the next investigator can be you.

Replacement-audit depth: transitive deps; the src paths that handle the same cases the incumbent mishandles; build provenance for native or wasm modules (compiler flags, wasm import surface, whether upstream sources are checksum-verified); maintenance signals (downloads, stars, last commit, single-maintainer concentration). Without this depth the recommendation swaps a known-flaw dependency for an unknown-flaw one.

#### Third-party libraries: the `.out-of-scope/` upstream-tracking exemptions

`.out-of-scope/` lists external-tool bug classes that still get a `docs/troubleshooting/<topic>.md` writeup but no upstream GitHub issue, because filing one is wasted effort here. AGENTS.md keeps only "check `.out-of-scope/` before filing"; the enumerated examples live here. Current exemptions:

- Claude Code (`.out-of-scope/claude-code-upstream-bugs.md`): upstream very unresponsive, so tracking issues produce clutter without changing the outcome; encode the workaround as a rule in AGENTS.md instead.
- JSR (`.out-of-scope/jsr.md`): the workspace consumes no JSR-hosted packages (`docs/philosophy/tool-choices.md` covers tool selection), so install-path bugs there do not affect it.
- `bun install` (`.out-of-scope/bun-install.md`): the workspace uses pnpm as the package manager, not `bun install`, so those install-path bugs are never hit.

#### Choosing technology and vendors: the encoded checklist

The `choosing-technology` skill encodes context-fork questions, the six vendor vetting layers (layoffs, reviews, outages, funding, signup friction, security), the open-source default, constraint-fit before stack-fit, the alternative survey rule (name at least two with rejection reasons), and the `docs/decisions/<project>.md` maintenance rule. AGENTS.md keeps the terse "invoke the skill" rule plus the layer-summary tokens; the enumerated detail lives in the skill.

#### Before claiming inability: how each manual-action bridge works

GUI clicks: `agent-browser` drives most web UIs; `xdotool` / `wtype` / `ydotool` drive native UIs; "click" usually has a keyboard shortcut to synthesise, or a backing HTTP/IPC endpoint that bypasses the UI. Interactive auth: scripted with `expect`, or skipped via API tokens. Hardware activation: almost always a CLI. AGENTS.md keeps the one-line token index (the tools to reach for); this is how each one substitutes for the manual action.

#### Verify on a throwaway: why a guard test needs a throwaway

When the behavior under test is whether a guard blocks a destructive operation, running that operation against real state means a broken guard (the exact failure you are testing for) damages real state, while a passing guard tells you nothing a throwaway would not have. So build both the allowed case and the rejected case as fixtures.

#### Pre-response checklist item 5: categorical-dismissal examples

Categorical dismissals that feel like recall but are one search away: "the project doesn't use X", "X doesn't apply here", "X is already handled by Y". These overlap the hedge-phrase list; the checklist item keeps the rule (measure assumed facts, cite inline) while the examples live here and in the hedge section. AGENTS.md and tsconfig count as confs where X may be wired up.

#### runbook skill: the encoded sections and rules

The `runbook` skill encodes the required sections (Setup, Steps, What to check, Restore), the bold-every-UI-element rule, the expected-outcome-per-step rule, and the exact-strings-not-paraphrases rule. AGENTS.md keeps the "invoke it for any manual-action document" rule and the canonical example path.

#### Match action scope to the request verb: the security-alerts example

"Decide which security alerts we can fix immediately" is triage; the deliverable is the categorized list. Applying the fixes is a separate decision the user has not yet made; surface a concrete proposal and wait for green-light.

#### Test coverage matches the public API surface: the sync/async example

A test file covering sync matchers but skipping async matchers is the same as no async tests; the bug ships silently.

#### Enforcement mechanisms: why hook existence is not in AGENTS.md

AGENTS.md deliberately does not expose the existence of Claude Code hooks, not merely their names: the stop hook (`ccsr`) enforcing hedge-phrase and trailing-question rules, the PreToolUse guardrail (`ccgr`), the roadmap PostToolUse type-check. Flagging the machinery at all lets agents game the surface pattern (swapping one hedge for a novel one that passes but carries the same epistemic gap) and reframes an internalized rule as an external gate to dodge. The rule the agent must own stays (the hedge-phrase list); the fact that a hook backstops it is omitted. The trailing-question rule is dropped from AGENTS.md entirely rather than reworded: "ask via the question tool, never end on a bare question" restates standard harness behavior the `AskUserQuestion` tool and its description already carry, so it fails the Purpose test for non-obvious project knowledge. Exception: the `bash-output-filter` `~` substitution stays named, because its observable effect (line-start paths rewritten in tool output) must be understood precisely to debug paths, and it carries no gaming risk. Hook identities and implementation details otherwise live only in this doc. This follows the same principle as the "Runtime environment checks" rule in "What does not belong": passive text in AGENTS.md is weaker than an active hook.

#### Follow document pointers: the worked example

A ToS that says "Services are governed by separate subscription agreements, not these Website Terms" points at a separate document where the substantive provisions live; fetch it before drawing conclusions about its contents.

#### Linting: why the oxlint-disable placement matters

The disable goes before the TSDoc so the TSDoc remains the immediately preceding comment. The enable goes on the very next line after the declaration; leaving a disable open longer than necessary silences unrelated violations. `// oxlint-disable-next-line` applies only to the literal next physical line, so placed between TSDoc and declaration it lands on the TSDoc and the suppression is lost; use the block-level disable + enable pair wrapping TSDoc and declaration tightly instead.

#### Simplification and Regular expressions: why no recursion or accumulator over linear input

JS guarantees no tail-call elimination (V8 has none), so recursion whose depth tracks input length is a stack-overflow bug at scale; accumulator recursion (`acc + c`, `[...acc, x]`) is additionally O(n^2) because each step rebuilds the whole string or array.
A loop, or a regex being removed, must therefore become a single linear pass (`map`/`filter`/`reduce`, `for...of`, or one counter loop in O(n) time and O(1) extra stack), never recursion over a string or flat array.
Recursion is safe only for bounded structural walks (AST, tree, grid, filesystem) whose depth tracks the data's nesting.
The trap is the degenerate spine: a member chain (`a.b.c`), call chain, or left-associative operator chain (`a + b + c`) nests once per operand, so its depth equals operand count and tracks length, not nesting; before recursing over any tree, ask whether it can degenerate into a spine on large or adversarial input, and if so flatten iteratively with an explicit work-stack.
A removed regex carries an extra hazard: a backtracking pattern can be superlinear (the ReDoS this ban guards against), so the replacement must prove O(n) on its own merit for attacker-controlled or unbounded input, not inherit linearity from the regex.
Post-mortem of this exact misapplication: `docs/audit/chain-flatten-skewed-tree.md`.

#### Simplification: the `.rs` max-lines budget

The Rust `max-lines` rule (`monochromatic-rust-linter`) counts only code lines: blanks and comments are excluded via the real lexer, so the dum-dum-non-ts comment style does not consume the budget.

#### Variables and values: why the no-function-root-let escapes are sanctioned, not dodges

`let` inside `ForStatement.init` is exempt, so a counter `for (let i = 0; ...)` loop is the sanctioned tool for an indexed or lookahead scan, not a rule to dodge.
The helper-shape allowlist suppresses the report when a function ends in `return <local-binding>`, which is why extracting such a helper is a clean remediation rather than a workaround.

#### Security: why source escapes are not portable across a syntax boundary

A Markdown `\<`, a shell quote, JSON escaping, URL encoding, or regex escaping makes text safe only in its own grammar; carried into another language it is either inert or actively wrong.
The destination grammar is the only authority, so normalize source semantics as needed and encode for the exact destination subcontext at the final interpolation boundary.
The rule reaches every text-emitting transformer: serializers, code generators, formatters, autofixes, docs generators, renderers, CLIs, and tests.
Happy-path formatting and idempotence tests are not enough; the adversarial boundary cases are where the boundary actually breaks.

#### Third-party libraries: the unforked-upstream-clone exception mechanics

The `troubleshooting-doc` skill's exception is a disposable prototype clone created fresh under `/tmp/agent` for an upstream-fix patch diff, made only after origin verification and run without exposing credentials or this repo to third-party scripts.
That narrowness (disposable, origin-verified, credential-free) is what keeps it from eroding the no-modify rule.

## Changelog

### 2026-06-05

Removed `WC1` and `WC3` from `AGENTS.md`. Current-date use is baseline agent competence rather than project-specific guidance, and the spec-mode rule had not produced the intended behavior as an always-loaded rule.


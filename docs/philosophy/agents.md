# AGENTS.md philosophy

## Purpose

AGENTS.md is for non-obvious, actionable guidance that neither an AI agent nor a human developer can infer from context or general knowledge alone.
It supplements, not replaces, common sense.

## What does not belong

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

## What was compressed (2025-02-25)

AGENTS.md was reduced from 5839 words to ~1500 words at the time. (As of 2026-05-09, the post-2025 monotonic regrowth had brought it back to 6672 words / 684 lines before the second compression pass; see "What was compressed (2026-05-09)" below.)
The following categories of content were handled:

### Moved to code-review skill

The harness should auto pick up skills in skills dirs and therefore even pointers to skills are not documented.

All bad/good code examples were relocated to `.factory/skills/code-review/SKILL.md` where they serve as patterns for the reviewing agent to flag:

- Functional vs imperative loop examples
- Object iteration (`for...in` vs `Object.entries`) examples
- Named condition extraction examples
- Single-letter variable examples
- Manual promise creation (`new Promise` vs `wait()`) examples
- TSDoc WHY-vs-WHAT comment examples
- TSDoc block comment terminator escaping examples
- Symbol union narrowing anti-pattern examples
- Generics `const`/`readonly` good/bad examples
- Custom error class examples
- Assertion function examples
- Type guard examples
- `notNullishOrThrow` vs `!` operator examples
- Silent error handling examples
- CSS shorthand, color token, and state styling examples
- Region marker examples
- Commit message format and multi-scope examples

### Dropped as inferable

- "Check web sources, session history, or codebase as appropriate"; implied by "search for evidence"
- Detailed CLI tool execution patterns (`uv run script.py` not `uv run python script.py`): generic agent knowledge
- Third-party repo rationale bullets ("breaks git pull", "creates merge conflicts"): obvious consequences of the rule
- "Convert callback-based APIs to promises"; implied by "async/await only"
- "Implement interfaces explicitly when a class should conform to a contract"; standard TypeScript knowledge
- "Use abstract classes sparingly, prefer interfaces and composition"; standard OOP knowledge
- "Document version requirements in both the pinning file and README"; generic practice
- "Regularly review pinned versions to check if constraints still apply"; generic practice
- TSDoc rationale about "obvious from context" and "dead code" caveats; the rule to document all declarations is sufficient
- Individual type descriptions for commit types (`style: Changes that do not affect...`): Conventional Commits is a well-known spec
- `dprint` enforcement notes: the tool config speaks for itself
- "For arrow functions, make sure the JavaScript engine can infer a name"; inferable from "always name functions"

### Kept in compressed form

Rules that are non-obvious or project-specific were retained as terse single-line bullets:

- Progressive simplification pattern (imperative -> while -> for -> recursive -> HOF)
- File-splitting justification comment clause
- "Never remove logging" philosophy
- "Avoid meta-references" documentation standard
- "Avoid deprecated features" with `substr()` example
- Assertion functions (`asserts value is T`)
- Type guard pattern
- `as` over angle bracket syntax; conditional type nesting warning
- Unused variable underscore-prefix convention
- `process.exitCode` only for non-standard codes
- "Combine console.log/error messages into thrown errors"
- `dedent` import path (`string-dedent`)
- Generic `Function` type ban; unused Generator params

### Skill file structure change

Skills were moved from `.factory/skills/<name>.md` to `.factory/skills/<name>/SKILL.md` to match the expected Droid skill format.

## What was compressed (2026-05-09)

AGENTS.md was compressed from 6672 words / 684 lines to 5894 words / 449 lines (-12% words, -34% lines). The smaller word reduction relative to 2025-02-25 reflects a deliberately less aggressive policy: the user opted for "Moderate merge" (preserve all rules, examples, and concrete references; drop only duplicated framing prose), not the full philosophy-doc rubric.

### Sub-section merges

- **Pre-response checklist item 4 + "Hedge phrases that signal a skipped step"**: single hedge-phrase list now lives in the dedicated section; checklist item 4 cross-references it. Full hedge list, the stop-hook reference, and the genuine-uncertainty exception clause all preserved.
- **"Measure before you characterize" + "Ask only for non-measurable facts"**: collapsed to "Measure-vs-ask" with two bolded sub-rules. Both example lists (measurement commands; non-measurable cases) and the three-failure-direction summary preserved. Dropped: prose framing, employee-vs-boss analogy retained inside.
- **Pre-response checklist item 9 + "Before claiming inability"**: checklist item 9 cross-references the dedicated section; the bridging-tools list (`ffmpeg`, `pandoc`, etc.) and "state the bridges you tried" rule kept in the dedicated section.
- **TypeScript standards / Type system / Variables and values / Programming patterns**: merged into one "TypeScript" section with four bolded sub-headings (Standards / Type system / Variables and values / Programming patterns). Every bullet kept; only the four `H3` headers became four `**bold**` paragraph leads.
- **Cross-runtime / Script preferences / Tool version management / Hooks and automation**: four single-bullet H3 sections collapsed to one "Cross-runtime and scripts" sub-section with four bullets. All rules preserved verbatim.
- **Agent skills** trailing meta section; three single-line H3 sub-sections (Issue tracker / Triage labels / Domain docs) flattened to a three-bullet list.

### Prose tightening (highest-yield)

- **Communication style**: six paragraphs collapsed to five tighter paragraphs. Dropped: connective restatements between rule and example, "Why? Because..." scaffolding.
- **Vet vendor recommendations**: 43 lines to ~26 lines. Dropped: closing two paragraphs that restated the same lesson; bullet sub-explanations folded into single-line phrasing.
- **Constraint-fit**: 35 lines to ~22 lines. The "Signal you are about to violate this rule" elaboration kept; the "verbalized vs silent form" prose moved inline to the third bullet.
- **Resource-exhaustion isolation**: 24 lines to ~16 lines via paragraph compression; full six-example bullet list kept.
- **Test coverage** and **Verify at user boundary**: light prose tightening; all five user-boundary examples kept verbatim.

### Structure note

The moment-of-decision top-level structure (eight sections from "Before responding" through "Agent skills") was retained even though the user authorized "Free reorganization." That ordering encodes **when** each rule loads; a feature called out in the document's preamble. Reorganizing into topical sections would lose load-timing information without compensating compression gain. Sub-section reorganization within each top-level section was applied freely, per the merge list above.

### What was deliberately not done

The PHILOSOPHY.AGENTS.md "What does not belong" rules above (drop standard-tool examples, generic rationales, code examples for self-evident rules, multi-bullet expansions of single rules, repetitive "why this matters" paragraphs) were **not applied** in this pass. The user explicitly chose "Moderate merge" over "Apply philosophy doc," meaning the philosophy-doc deletions are not precedent for this compression. Future sessions considering a third compression pass should treat the philosophy-doc deletions as a separate decision the user must opt into, not as standing authorization.

The plan's proposed consolidation of `Architecture decisions` / `Enforcement mechanisms` / `Agent skills` into a single trailing section was **not applied**. The three address distinct concerns (code-organization rules; enforcement tooling that acts on agent output; skill-file pointers), and the consolidation gain (~4 lines of header overhead) does not justify topical conflation. They remain as three separate top-level sections.

The line-number references in `PLANNING.extract-refactor-guardrail.md:36` (cited as `AGENTS.md:78-79`) were already stale before this rewrite, so no special accommodation was made for line-number stability. Cross-references to AGENTS.md from `docs/decisions/vector-design.md`, `TODO.forbidden-strings.md`, and `TROUBLESHOOTING.pi-compaction-empty-summary.md` are by topic, not by line, and remain valid.

## What was compressed (2026-05-11)

AGENTS.md was compressed from 6693 words / 480 lines to 6672 words / 477 lines (-0.3% words, -0.6% lines). The much smaller reduction relative to 2026-05-09 reflects the document already being near a Moderate-merge fixed point; this third pass targeted residual redundancy that accumulated post-2026-05-09 rather than addressing previously-untouched areas. The user explicitly chose the same Moderate-merge rubric (preserve all rules, examples, and concrete references; drop only duplicated framing prose), confirmed the merge of `Documentation standards` + `Markdown conventions`, and confirmed consolidation of the clone-source cluster around its canonical home.

### Sub-section merges

- **Documentation standards + Markdown conventions**: merged into one `Documentation standards` section with two `####` sub-headers (`#### Prose style`, `#### Markdown syntax`). The "Documentation standards" header was retained (not "Documentation and Markdown" as initially proposed) to preserve an external reference at `PLANNING.forbidden-strings-em-dash.md:281`. Duplicate "**bold** for emphasis" mention in the Markdown-conventions opener removed; the rule remains under `#### Prose style`.
- **TypeScript function-declaration bullets**: three bullets ("No arrow functions", "No const x = function() {}", "Always name functions; parentheses around all arrow params in external API callbacks where arrows are unavoidable") merged into one bullet preserving all four rationales (anonymous stack traces, hide intent, no TSDoc, no overloads, harder to scan, external-API exception with paren rule). The separate "No calling functions before their declaration" bullet kept distinct.
- **Pre-response checklist items 7 and 8**: merged into one item covering both verify-existing-citation and add-missing-citation cases. Old item 9 renumbered to new item 8.
- **Communication style paragraphs 4-5**: merged into one paragraph covering documentation-gap recognition, propose-edit, no-promise-to-future-self, monotonic-growth counter, and the cue.

### Prose tightening

- **Stop hook entry** in `Enforcement mechanisms`: the inline 6-phrase hedge list ("probably", "maybe", etc.) replaced by a back-reference to the canonical "Hedge phrases that signal a skipped step" section.
- **Hedge phrases section**: the reciprocal back-pointer "(Item 4 of the pre-response checklist applies to the same phrases.)" dropped; the checklist already points here.
- **Proactivity calibration**: three "(see X)" parenthetical cross-references dropped from paragraph 2; the rules stand on their own. The recognition-cue paragraph at line 23 retained as distinct from the action rule at line 19.
- **Clone-source-and-read cluster**: six mentions (pre-response checklist item 2, hedge-phrase entry "no public diagnosis exists", research-tools web-search rationale, before-running-command clone rule, Third-party-libraries canonical, "Name the verification step" example) consolidated. Line 387 (Third-party libraries) kept as canonical home with the full rule and the "quote file path, line number, code excerpt" caveat. Other mentions reference back via "(see ...)" pointers. Distinct sub-rules preserved separately: the `gh repo clone` vs `git clone` operational preference (`Before running a command`); the "do not remove cloned repos from `/tmp`" lifecycle rule (`Research tools`); the verification-step example value (`Name the verification step`).

### Heading convention fix

The 2026-05-09 pass introduced a pattern of using `**Title.**` bolded paragraphs as section sub-headings (e.g. `**Standards.**`, `**Type system.**` under `### TypeScript`). The user flagged this in the 2026-05-11 pass as misusing bold for titles. Convention now: bold is for inline emphasis only; section sub-headings use proper ATX headers (`####`) one level deeper than the parent `###`.

Converted in this pass:

- `**Zero-match silent failures:**` -> `#### Zero-match silent failures`
- `**Non-zero-match silent failures (same shape, opposite direction):**` -> `#### Non-zero-match silent failures (same shape, opposite direction)`
- TypeScript: `**Standards.**`, `**Type system.**`, `**Variables and values.**`, `**Programming patterns.**` -> `#### Standards`, `#### Type system`, `#### Variables and values`, `#### Programming patterns`
- Documentation standards: `**Prose style.**`, `**Markdown syntax.**` (newly introduced earlier in this same pass) -> `#### Prose style`, `#### Markdown syntax`

Retained as inline lead-ins (not titles, not converted): `**Measurable facts: measure.**`, `**Non-measurable facts: ask.**`, `**Exception: genuine uncertainty.**`. Each is followed immediately by a non-bolded sentence continuation on the same line, which is correct bold-for-emphasis usage rather than bold-as-title.

The Prose-style rule was sharpened to capture the convention: "Sentence case for headings; **bold** for inline emphasis only (not ALL CAPS). Never use bold as a standalone title; use the appropriate ATX header level instead."

### Structure note

The `Documentation standards` and `Markdown conventions` section headers were planned to merge into `Documentation and Markdown`, but a grep across the repository found `PLANNING.forbidden-strings-em-dash.md:281` referencing "Documentation standards" by name. Section names should remain stable (`PHILOSOPHY.AGENTS.md:221`); the merge proceeded under the original `Documentation standards` header with the prose-and-markdown content reorganized into two `####` sub-headers. This preserves the external reference.

### What was deliberately not done

The PHILOSOPHY.AGENTS.md "What does not belong" rules were again not opted into; the user chose the Moderate-merge rubric (matching the 2026-05-09 pass). The `Pre-response checklist` item 4 rephrase ("(see X)" -> "(full list: X)") was considered but skipped: the rephrase did not shorten the back-reference and offered no DRY benefit. The proactivity recognition-cue paragraph (post-edit line 23) was retained alongside the action rule (line 19) despite their surface similarity; the cue framing aids recognition.

The `Pre-response checklist` items 3, 5, 6 were not consolidated: tightening these to back-references would strip the remediation verb, which is the checklist's whole value as a quick-scan tool. The verification-step example at `Name the verification step` line 137 ("verified by reading the package's README at the cloned repo") was retained verbatim despite mentioning a cloned repo; it is one of three illustrative examples, not a duplicate rule.

## What was compressed (2026-05-23)

The user opted into the full "What does not belong" rubric above (deferred by the 2026-05-09 and 2026-05-11 moderate-merge passes, which required an explicit opt-in). Goal: AGENTS.md under 50000 chars. Levers applied: telegraphic prose; prose-only abbreviations (config to conf, source to src, documentation to docs, directory to dir, never inside backtick tokens, filenames, code blocks, or the verbatim hedge section); merge "Handing off manual actions" into "Before claiming inability"; cut generic rationale, illustrative example lists, model-obvious syntax, and harness-redundant content; and, per the user's "why belongs to PHILOSOPHY.AGENTS.md" directive, relocate the longer project-specific explanatory passages out of AGENTS.md into the "Relocated rule rationale" section below. PHILOSOPHY.AGENTS.md is treated as a dump doc: anything a future human or agent might need to understand a terse AGENTS.md rule lives here.

### Relocated rule rationale (2026-05-23)

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

#### Enforcement mechanisms: why the stop-hook name is not in AGENTS.md

AGENTS.md deliberately does not name the stop hook (`ccsr`) that enforces hedge-phrase and trailing-question rules. The hook exists and fires on every response; naming it in the rules document lets agents game the surface pattern (swapping one hedge for a novel one that passes the filter but carries the same epistemic gap) rather than internalizing the underlying rule. The hook's existence is discoverable from rejected-response feedback anyway, but AGENTS.md should not hand agents the bypass recipe up front. The rules themselves (the hedge-phrase list, the ask-user-tool question rule) remain; only the hook's identity and implementation details are suppressed. This follows the same principle as the "Runtime environment checks" rule in "What does not belong": passive text in AGENTS.md is weaker than an active hook, and naming the hook trades a small self-catch convenience for a larger gaming risk.

#### Follow document pointers: the worked example

A ToS that says "Services are governed by separate subscription agreements, not these Website Terms" points at a separate document where the substantive provisions live; fetch it before drawing conclusions about its contents.

#### Linting: why the oxlint-disable placement matters

The disable goes before the TSDoc so the TSDoc remains the immediately preceding comment. The enable goes on the very next line after the declaration; leaving a disable open longer than necessary silences unrelated violations. `// oxlint-disable-next-line` applies only to the literal next physical line, so placed between TSDoc and declaration it lands on the TSDoc and the suppression is lost; use the block-level disable + enable pair wrapping TSDoc and declaration tightly instead.

### Stats and decisions (2026-05-23)

AGENTS.md went from 59244 chars (684-equivalent rich form) to 47696 chars, under the user's hard 50000 target and the ~48000 stretch goal. The split rule: AGENTS.md keeps the terse enforceable rule, its cue, and the tokens/paths/commands needed to act; PHILOSOPHY.AGENTS.md holds the rationale, mechanism, and examples behind each rule. No information was lost across the two files: every original AGENTS.md backtick token survives in the union of the two files except four user-authorized cuts.

Deliberately dropped (not relocated), with the user pointing at each as model-obvious or redundant:

- The generic shell-utility example list (`jq`, `magick`, `pdftotext`, and the others) under "Before claiming inability"; `agent-browser` stays because it is named in the actual bridge guidance.
- The `gh api repos/.../comments` commit-comment invocation; models already know `gh`. The rule (post a commit comment instead of amending) stays.
- The "logical unit" definition under git commit guidelines; the model knows what a logical commit is.
- The push-authorization restatement; it duplicates the harness Git Safety Protocol.

Kept verbatim in AGENTS.md: the "Hedge phrases that signal a skipped step" list (it mirrors the hardcoded stop-hook trigger set in `packages/claude-code-plugins/source/src/handlers/stop-reminders/uncertainty-phrases.ts`, so it cannot be inferred or thinned) and all fenced code blocks (git-cleanup commands, commit-message example).

Prose abbreviations applied in AGENTS.md text only, never in backtick tokens, filenames, code blocks, or the hedge section: config to conf, source to src, documentation to docs, directory to dir.

AGENTS.md prose paragraphs were then broken at sentence and clause boundaries to satisfy the doc's own "break lines at semantic boundaries" markdown rule (the prior single-long-line prose violated it). Numbered checklist items and rule bullets were left single-line: one line per item serves the checklist's quick-scan purpose, and breaking list items into continuation lines is structurally fragile.

The 12 quoted `See "<section>"` cross-reference targets and the moment-of-decision top-level structure were preserved; only "Handing off manual actions" was merged (into "Before claiming inability"), with its one `Apply "..."` reference in pre-response checklist item 10 rewired.

A continuation pass (same date) reached the ~48000 stretch goal by relocating more rationale and illustrative examples into the "Relocated rule rationale" subsections above: the choosing-technology layer enumeration, the manual-action bridge mechanics, the guard-test throwaway rationale, the pre-response item 5 dismissal examples, the runbook section list, the match-action security-alerts example, the test-coverage sync/async example, the follow-document worked example, the oxlint-disable placement rationale, and the exhaust-layers per-layer examples. The user then directed that normal operation must not depend on this doc: every inline "(... in PHILOSOPHY.AGENTS.md)" pointer was removed from AGENTS.md (the newly-added ones plus four pre-existing vague pointers at the measurement-recipes, name-verification, resource-exhaustion, and max-lines rules), leaving each AGENTS.md rule self-sufficient. The relocated content stays here as reference, discoverable through the single global note at the top of AGENTS.md and the section-name correspondence. The rule against re-introducing such pointers is the new "Inline pointers to this philosophy doc" entry under "What does not belong".

# Development Guidelines for AI Agents

Organized by moment of decision, not topic: at each point in the work (about to respond, run a command, edit code, declare done), the matching section holds every rule that applies.
Cross-cutting reference (workspace conventions, enforcement mechanisms, agent skills) appears toward the end.
Detailed rationale, mechanisms, and examples behind these terse rules live in `docs/philosophy/agents.md`.

## Critical hot paths

Index to high-loss rules below;
adds no separate policy.
When a cue matches, follow the target rule immediately rather than rediscovering it later.

- Visible terminal/window/session: see "Visible terminal spawning".
- External tool, CLI, conf, or API capability claims: see "Communication style" and "Third-party libraries".
- Git cleanup, destructive git guards, or worktree safety reviews: see "Git cleanup and worktree safety reviews".
- Tests: see "Essential commands".
- User correction of a substantive claim: see "Pre-response checklist".
- User's "I"/"me"/"future me" referring to the human, not a future agent: see "Communication style".
- Verification touching destructive or stateful behavior: see "Verify on a throwaway, not against real state".
- Removing a regex, or refactoring a loop, over text or a flat array: see "Simplification progression" (no recursion over linear input; JS has no guaranteed tail-call elimination).
- About to type a bundled or single-letter CLI flag (e.g. `rg -rl`, `-rn`): see "Long-form flags".

## Before responding to the user

### Communication style

Be direct and honest.
Search for evidence before responding to opinions, guesses, or analysis requests.
Treat embedded questions ("month? year?"), implicit asks, estimate requests, and input gaps as research tasks: web search, read code, or check docs rather than deflecting with "genuinely unknown."

Do not attribute `<system-reminder>` content to the user;
these tags carry harness-level conf, not what the user typed.
"per your instruction" / "you asked me to" is wrong when the source is a system reminder;
cite the policy by what it says ("the no-questions policy").
Same for other injected context (UserPromptSubmit hook output, MCP server instructions, skill descriptions): the source is the hook or server, not the human.

The user's first-person words name the human, never Claude or a future agent session.
"I", "me", "my", "myself", "future me", "next time I" all point to the person typing;
Claude is "you" or "Claude" in their words.
The repo's pervasive handover-to-future-sessions framing (`docs/handover/`, "future readers", "future sessions will follow") primes the wrong reading: "future me will find a better solution" means the human plans to solve it later, not work handed to a future Claude.
The cue: about to read a user's "me"/"I" as an agent, or to address a doc, issue, plan, or task to "future-me" when the user meant themselves.

Cite the right source file.
Rules span AGENTS.md, the harness system prompt, hook confs in `.claude/settings.json`, skill `SKILL.md` files, MCP server instructions, and `CLAUDE.md` (regenerated from AGENTS.md).
Before writing "per AGENTS.md", "the system prompt says", "the hook requires", "the skill prescribes", grep the file you name.
The cue: about to attribute a rule to a source without verifying the source contains it.

For external tool features, CLI options, conf syntax, or API capabilities, fetch current docs or src before responding.
"Does X support Y" and "how do I do Y in X" are research tasks, not recall tasks.

When explaining a warning or error, name the exact tool that emitted it (e.g. "Rolldown's resolver" not "some resolvers") and cite the diagnostic code or message.
If unsure, investigate first: search the codebase for the diagnostic, check tool docs, or run the tool directly.

When the user says "I was expecting you to..." or you notice a failure mode future sessions should avoid, treat it as a documentation gap: propose a concrete AGENTS.md change (what rule, where, exact wording) and perform the expected action, never "I'll keep it in mind".
Merge a new rule overlapping an existing one instead of appending;
remove an older rule overtaken by a sharper version.
The cue to draft the edit: the moment you want to "remember next time."

### Proactivity calibration

This user does not perceive proactive action as overreach;
harness defaults cautioning against "being too proactive" do not apply here.
When the conversation, request verb, and AGENTS.md rules collectively authorize a step, take it;
do not insert a "want me to..." or "should I go ahead and..." check before the obvious next step.

This does not relax other constraints: destructive or shared-state actions still need explicit authorization, decision verbs still return the answer not the action, non-measurable preferences with multiple valid answers still warrant a clarifying question.
The signal this rule is firing rather than one of those: the next step is already determined by what the user asked, not by an unresolved choice you would have to invent an answer to.
The cue: about to write "want me to also..." or "should I go ahead and..." about an already-authorized step.
Skip the prompt and do the step.

### Task tracking granularity

For broad requests spanning multiple evidence areas, split into separate task-list items per major area, not one umbrella item.
Each task needs independently verifiable completion criteria: inventory, tooling, architecture, tests, security, documentation, synthesis, or whatever the request demands.
The cue: a single task subject would hide multiple kinds of evidence gathering or blur what "done" means.

### Pre-response checklist

Before sending any response with substantive claims:

1. Quantitative claim (size, speed, complexity, difficulty, duration) without measuring? Measure or rephrase as a guess.
2. Described how an external tool works without reading its src? Clone and read (see "Third-party libraries"), or label recall-from-training.
3. Estimated difficulty of a fix you have not built? Drop the estimate.
4. Used a hedge phrase (see "Hedge phrases that signal a skipped step")? Verify or remove.
5. Assumed a measurable fact about the user's environment (codebase size, deps, build time, file contents, whether a tool/feature is used, whether a conf or AGENTS.md already covers the thing weighed) or working pattern in repo artifacts (commit cadence, hours, defect rate, concurrent sessions)? Measure it (see "Measure-vs-ask"). Categorical dismissals feel like recall but are one `rg`/`find`/conf-read away; AGENTS.md itself counts as a conf to read. Cite the result inline (file path, line, or conf key); if wrong, fold the option back in.
6. Assumed a non-measurable preference (which approach, what they value)? Ask.
7. Confident factual claim about your environment, an external tool, or src code? Verify any cited path/line still exists; for uncited claims, add the citation inline (see "Name the verification step") or downgrade to a labeled guess.
8. Claimed a tool cannot do something? Check whether composition (Bash + shell utility) bridges the gap; refuse only after trying (see "Before claiming inability").
9. Quoted a clause or doc passage and drawn a conclusion? Restate subject and object in plain English first. Failure shape: "X waives Y" read as "X is freed from Y" when the clause actually runs Y from X toward a third party.
10. About to ask the user to perform a manual action? Try the bridging path first; if you must hand off, invoke the `runbook` skill (see "Before claiming inability").
11. Revising a substantive claim the user just corrected? Treat the correction as evidence your previous verification path was insufficient: re-read primary sources, run concrete commands, or use a genuinely separate reviewer when independent review is asked. Do not run a same-session self-review, local "advisor" skill, or magic `Advisor pass: ...` ritual; self-review is not independent evidence (see `docs/agent-self-review.md`). User-correction phrases ("demonstrably false", "you missed", "didn't you", "you're wrong", "shouldn't have", "why would you") are an approach-change moment, not a small patch.

### Measure-vs-ask

**Measurable facts: measure.** Codebase size, build time, file count, dependency tree, test count, perf numbers, conf values, file contents.
Also the user's working pattern in repo artifacts: commit cadence, working hours, defect-recovery rate, concurrent-session evidence.

Run the measurement yourself;
never a quantitative adjective ("small", "large", "fast", "slow", "simple", "complex", "short", "long", "sparse", "dense", "tractable", "trivial", "significant") without one.
The agent has the tools;
using them is the agent's job, not the user's.

**Non-measurable facts: ask.** Which of two valid approaches the user prefers, whether they want a feature, whether they authorize a destructive action, what they value (depth vs governance, speed vs clarity).

Three failure directions: asking what you could measure (lazy);
assuming what you should ask (confidently wrong);
asking permission for an already-authorized step ("want me to also check X?" when the user has been pushing for thoroughness).
Trigger phrases for the assumption form: "for a project like this...", "in a typical setup..."

### Present options with pros, cons, and a personal ranking

When proposing a choice between distinct options ("A, B, or C?"), give each option its own pros and cons and a fully sorted personal ranking covering every option, with the reason that decides each adjacent pair.

- `AskUserQuestion`: each option's `description` holds its pros and cons; order options by preference (best first) and append "(Recommended)" to the top label; in the prose around the tool call, state the full ranking (e.g. "ranking: B > A > C") with the reason for each adjacent comparison.
- Inline prose: one short paragraph or bullet block per option with pros and cons, then a "Ranking: B > A > C, because ..." line explaining each step of the order, not just the top pick.

Skip when the user asked yes/no on a single proposal or already narrowed the criteria enough that one option is determined.

### Hedge phrases that signal a skipped step

Do not write these; do the step instead.

- "probably small/large/fast/slow": run the measurement
- "the fix is probably small": read the source code path or drop the estimate
- "I think it's a...": verify or label as a guess
- "the most likely cause is...": reproduce or list candidates without ranking
- "for a small codebase like yours": run `tokei` first
- "better/worse than most/typical/average X": name the comparison set or drop the comparative; the qualifier sounds confident but invokes an unverified population (`<Xer> than most` and `worse/more/less than most` are hook-caught; `than typical`/`than average` rely on self-catch)
- "almost certainly", "most likely X lives/is/exists in Y": you have a checkable target (the named document, the named location); fetch it instead of stating a probability about its contents.
- "the most likely X" / "the most common Y" used as a ranking without naming the population: same shape as "better than most"; either name the comparison set or drop the comparative.
- "this is a tractable PR": drop "tractable" or actually build the fix
- "should be straightforward": drop "straightforward" or test the path
- "no public diagnosis exists" used as a stopping point: drop or clone the source yourself (see "Third-party libraries")
- "an afternoon" or any other duration estimate: only valid if you have built a similar fix in this codebase before; otherwise drop
- "the project doesn't use X" / "we don't use X" / "the codebase doesn't have X" used to cut off a candidate without verifying: one `rg`/`find`/config-read away; cite the search result or drop the dismissal. AGENTS.md and tsconfig count as places X may be wired up.
- "X is already handled by Y" / "X is already covered by Y" used as a dismissal: read Y's config or source to confirm the overlap before dropping X from consideration. Pair the dismissal with a file path and line number, or drop it.
- "I don't know your specific X" / "I'd need data on your Y" / "this depends on your specific Z that I don't have" used to defer reasoning about the user's working history, defect rate, throughput, hours, or whether parallel sessions are running: `git log`, `gh issue list`, and file mtimes record these. The phrase is a deflection, not an epistemic limit; run the measurement before drawing the conclusion.

Internal self-catch is faster than the send-time hook; catch these before they leave.

**Exception: genuine uncertainty.** When the honest answer is "I do not know and the question is genuinely under-determined after investigation," state it explicitly.
Name what you investigated and what specifically is unresolved.
The antipattern this targets is hedging as a substitute for research, not honest reporting of remaining uncertainty after research.
"I read X.ts:42 and the type can be either A or B depending on a runtime branch I cannot determine statically" is not a hedge.

### Exhaust evidence layers when assessing system usage

For "should we use X better?" / "are we taking advantage of X?", walk every layer before recommending.
Each can flip the conclusion.

1. **The tool itself**: usage volume, conf.
2. **Parallel systems**: where the same need is met outside the tool.
3. **Content of those parallel systems**: not just file count but what is inside.
4. **Inline annotations in code**: TODO/FIXME/HACK, deprecation markers, workaround comments. Zero signals discipline (but verify the search ran; see null-search rule); thousands signal debt.
5. **Suppressions and exceptions**: lint disables, type-error suppressions, skipped tests. Justified-with-rationale is healthy; bare suppressions are debt.
6. **Stated policies in code or conf**: comments declaring intent ("X is tracked via Y, not Z") that may or may not be followed in practice.

Report findings at each layer before the conclusion.
A recommendation given after only checking layer 1 is a guess shaped by the surface you happened to look at.

### Follow document pointers

When a ToS, README, spec, or other source document references another where the substantive provisions live, fetch the referenced document before drawing conclusions about its contents.
Hedging about a named, fetchable target is the failure mode;
the cue is writing "likely contains," "almost certainly addresses," or "probably covers" about a document one tool call away.
The pointer is the research lead, not the stopping point.

### Choosing technology and vendors

When recommending a SaaS vendor or picking a library, framework, or build tool, invoke the `choosing-technology` skill when proposing or evaluating any external dependency or service.
It encodes the six vendor vetting layers, open-source default, constraint-fit before stack-fit, the alternative survey rule, and `docs/decisions/<project>.md` maintenance.

### Before claiming inability

"I cannot read this file format" / "my tools do not support that operation" / "I can't render / preview / test the page in a browser" / "I can't run this in this environment" / "you'll need to do X yourself" are capability claims about the whole toolset, not Read or Bash individually.
Bash plus shell utilities compose with Read into more than any single tool.
Before refusing or handing off, try a bridge: convert the input to a format your tools accept, decompose into supported steps, pipe the file through a shell utility, or drive a real browser via `agent-browser` (opens local `file://` URLs, evals JS, screenshots, console errors).
The browser-claim form is especially sticky;
whenever about to write any phrasing meaning "can't see / render / interact with a web page," reach for `agent-browser` first.

Manual actions usually have a bridge too: GUI clicks (`agent-browser` for web UIs, `xdotool`/`wtype`/`ydotool` for native UIs, a synthesised keyboard shortcut, or a backing HTTP/IPC endpoint), interactive auth (`expect`, or API tokens), hardware activation (almost always a CLI).

Refuse or hand off only after attempting a bridge and confirming no path exists.
State the bridges you tried;
an unconsidered refusal or handoff looks identical to a real obstacle.
The cue: about to write "you'll need to", "please open", or any phrasing meaning "can't see / render / interact with a web page", without naming the bridges you tried.

The same applies to research-exhaustion claims.
When a narrow search returns "no direct evidence for X" and X is a specific entity in a broader class, widen to the nearest comparable entities (sibling tools, peer platforms, projects solving the same problem) first.
Failure shape: "no precedent for Netlify" while LocalStack, MinIO, Dokku, and Coolify each give one-search-away evidence on the same question.
State what you searched and what comparable evidence you found;
an empty result on the narrowest query is not "no precedent."

When the bridges genuinely fail and the user must execute, invoke the `runbook` skill when writing any manual-action document (it encodes the required sections and formatting rules).
Repo-wide handovers live in `docs/handover/<topic>.md`; package-specific handovers stay beside the code they document.
Canonical example: `packages-paused/desktop-daemon/editord/HANDOVER.chokidar-atomic-migration.md`.

### Name the verification step

Confident factual claims about the user's environment, an external tool, or src code must be paired inline with what backs them.
If you cannot name what backs a claim, downgrade to a labeled guess or do the verification.

### Treat search results as suspicious until you've verified the shape

Every search result carries two claims: the search ran correctly, and the lines shown are the matches.
Both fail silently, in both directions: zero-match (invalid `--type`, wrong glob, `2>/dev/null` masking errors, stale dir, stdin mode) and non-zero-match (`head -N` truncation, denylist `-v` filters, `-l` hiding context, narrow `--type`, and `rg -r`/`--replace` rewriting matched substrings in the output: grep muscle-memory `rg -rn`/`-rln` parses as `--replace=n`/`--replace=ln`, not recursive, since ripgrep recurses by default).
Run a sanity-check (broader pattern, no cap, no negative filter) before claiming you've enumerated what's there.

### Git cleanup and worktree safety reviews

When reviewing a plan or change that touches `git clean`, destructive git guards, worktree safety, or ignored-file cleanup, inspect ignored root artifacts before final findings.
Run:

```bash
find . -maxdepth 1 \( -name HEAD -o -name config -o -name hooks -o -name objects -o -name refs \) -print
git check-ignore -v HEAD config hooks objects refs
git clean -ndX HEAD config hooks objects refs
```

Do not rely on `git status`, `git ls-files --others --exclude-standard`, or `rg --files`;
those hide ignored files.
If any root sentinel exists, cleanup or an exact safe cleanup path is part of the design under review.

When the review touches `cli-git`'s linked-worktree guard, account for the baked-in tool-cache allowlist (`DEFAULT_ALLOWED_WORKTREE_DIRS` in `packages/cli/git/src/allowed-worktree-dirs.ts`): repos whose git-dir resolves under an allowed dir bypass the guard, so destructive git is not blocked there.

### Document non-obvious findings

When discovering something not immediately obvious to a future reader, document it in the relevant readme or doc file right away: implementation details, behavioral quirks, implicit constraints, anything that required investigation or experimentation to uncover.

### Research tools

- `rg`: fast text search; use directly rather than navigating directory trees; `rg --files` to find files by glob
- `agent-browser`: headless browser CLI; rendered web pages, screenshots, web UI interaction, deployed-app verification
- `FetchUrl`: documentation sites, npm pages, GitHub READMEs; raw source still useful when docs are incomplete
- `gh`: GitHub issues, PRs, release notes, repository metadata
- Web search cannot inspect package internals (sizes, dependency trees, source); clone repos or install packages
  (see "Before running a command" for the clone-to-`/tmp/agent` operational rule)
- Do not remove cloned repos or other audit artifacts from `/tmp/agent`;
  the user will clean up when ready

## Before running a command

### Visible terminal spawning

To spawn something in another terminal, window, or session, use a real terminal launcher.
For arbitrary commands, including Codex, use `terminal-exec -- <command> ...`.
Use `spawn-claude` only for Claude Code child sessions.
`spawn_agent` is not an OS terminal;
a PTY/TTY is not a visible terminal emulator window.
Do not probe `terminal-exec` with `--help`;
read its README or src, since unknown options are ignored and it opens a terminal.

Do not wrap routine verification commands in an external `timeout` binary.
Use the command tool's session/polling first;
if a process truly remains after producing useful output, inspect the PID and stop that stale process.
Reserve external timeout wrappers for commands whose behavior is being tested or with a known unbounded runtime and no narrower kill mechanism.

Always pass an explicit path (`.` or absolute) to `rg` in the Bash tool.

Clone the git repo of a package under `/tmp/agent/` whenever investigating src code.
Before first use, ensure the root exists with private permissions:
`mkdir --parents /tmp/agent; chmod 700 /tmp/agent`.
Use `gh repo clone <repo> /tmp/agent/<descriptive-name>-<date-or-random> -- --depth 1` instead of `git clone`
unless commit history is part of the investigation;
`gh` handles authentication and fork remotes automatically.
Auto-mode allows structured `read` tool access to existing non-secret files under `/tmp/agent`;
writes, bash commands, secret-looking paths, and symlink escapes still go through the guardrail.

### Long-form flags

Use long-form (`--flag`) options for CLI commands, not bundled or single-letter short flags.
Writing a flag's long form forces knowing what it does, which is where short-flag muscle memory fails.

`rg` is the canonical trap.
ripgrep recurses by default, so its `-r` means `--replace`, not grep's recursive `-r`.
A grep-reflex `rg -rl 'pat'` parses as `--replace=l`: it silently rewrites every match to `l` in the output.
The agent then reads back corrupted data that looks plausible (a `$1` bundler suffix shown as `l`, for instance).
`-r` is dangerous anywhere in a single-dash bundle, not only at the front:
at a bundle tail (`rg -ir 'pat'`) it consumes the next argument as the replacement and swallows the pattern.
Long form removes the trap.
`--replace=...` is never typed meaning recursion;
the recursive reflex `rg --recursive` fails loudly with `unrecognized flag` instead of corrupting output silently.

Where a flag has no long-form spelling the short flag stays;
`--` argument separators (`mise watch -- task`) are unaffected.

### Bash output path collapse

Do not treat `~` in Bash tool output as a literal tilde;
it is a display substitution for `/var/home/user` or `/home/user` by the `bash-output-filter` hook (display-only, filesystem values unchanged).
Account for it when debugging path issues before concluding the path is wrong.
To skip the filter for one command, include a blocklist trigger: `eval`, `export`, `source`, `$(...)`, backticks, or `> file`.

### Physical-harm consideration

Before any action, consider whether it could physically harm a human (blasting audio volume, flashing content, unexpected hardware activation).
If so, warn the user and state what will happen before proceeding.

### Resource-exhaustion isolation

Always run commands that might crash or exhaust the host in a performance-limited container or VM, never directly on the host.
The "may exhaust the host" set is broader than the destructive-command set: heavy memory/process/file-descriptor allocation, unbounded loops, uncapped subprocess fan-outs, stress/benchmark/load runs.

Use `podman run --memory=2g --cpus=2 --rm -v $PWD:/work -w /work <image>` for container isolation, or the `mvm` CLI for VM isolation.
State the bounds explicitly (memory cap, cpu cap, timeout).
If the user requests one directly, propose the containerised invocation and confirm.
Past authorisation does not transfer across commands;
each heavy run needs an isolated environment.

### Destructive command ban

Never execute or instruct another agent to execute extremely destructive commands, even as guardrail tests, e.g. `sudo rm -rf /`, `mkfs`, `dd of=/dev/sda`, fork bombs.
Guardrails can fail;
a catastrophic command must not appear in instructions to other agents, subshells, or generated scripts regardless of intent.
For verifying a guardrail, use moderately dangerous commands (e.g. `sudo apt-get install`).

## Before editing code

### Match action scope to the request verb

Decision verbs ("decide", "evaluate", "assess", "review", "audit", "triage", "look at", "analyze", "investigate") request a deliberation.
The deliverable is the answer;
do not also apply the fixes the answer implies.
Action verbs ("fix", "implement", "apply", "do", "change", "add", "remove", "update", "refactor") authorize the action.

This holds in Auto Mode: its "prefer action over planning" applies to executing the requested action, not expanding scope;
it is not authorization to act on adjacent decisions the user has not made.

When the verb is ambiguous, default to the narrower interpretation and propose the broader action explicitly.

### Act, don't annotate

Move changes where they belong immediately: different file, new file, gitignore entry.
When unsure, propose a concrete edit and location.

### Cross-runtime and scripts

- Prefer cross-runtime patterns instead of Bun-specific implementations.
- Never write bash/powershell scripts; use inline nushell or TypeScript files as `mise.<action>.ts`. Execute with Bun directly; top-level code and top-level await (no `main()` wrapper).
- Pin tool versions only with clear justification and a comment explaining why.
- Add explicit guards (transcript size check, env var flag, session type filter) to any automation that spawns agent sessions, to prevent recursive token burn.

### Simplification

- Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state and imperative loops.
- Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-async-time`) over manual promise creation.
- Extract and name concepts; start simple, refactor to complexity only when necessary.
- Simplification progression (iterating over linear input): `map`/`filter`/`reduce` or `for...of` first; a counter `for (let i = 0; ...)` loop when you need an index or lookahead; `while` for a cursor with side-effecting branches. Recursion is **not** a rung on this ladder for flat input: never turn a loop, or a regex you are removing, into recursion over a string or flat array. JS guarantees no tail-call elimination (V8 has none), so recursion over linear input is a stack-overflow bug at scale, and accumulator recursion (`acc + c`, `[...acc, x]`) is additionally O(n^2). Reserve recursion for bounded **structural** walks (AST, tree, grid, filesystem) whose depth tracks the data's nesting, not its length. The AST example is the trap: a member chain (`a.b.c`), call chain, or left-associative operator chain (`a + b + c`) is a degenerate spine whose depth equals operand count, so depth tracks length, not nesting. Test before recursing over any tree: can it degenerate into a spine on large or adversarial input? If yes, flatten iteratively with an explicit work-stack. Post-mortem of this exact misapplication: `docs/audit/chain-flatten-skewed-tree.md`.
- Never disable, raise, bypass, or work around the max-lines limit. Remediate by splitting: re-export from `index.ts`; move helpers to siblings, constants to `constants.ts`, types to `types.ts`. Forbidden workarounds: compressing function arguments to one line, joining multi-line statements, removing TSDoc, removing `//region` markers, joining declarations. If you find yourself reformatting to reduce line count, stop; the fix lives in another file.

### Linting

- Never violate one rule to satisfy another. Lint rules form a single shape: code that satisfies all of them. When two rules appear to conflict, the remediation is structural (split, extract, rename), never reformatting one rule's surface to silence another. Signal you are violating-to-satisfy: about to undo something the autofix or AGENTS.md prescribed (e.g. compressing args back onto one line to fit max-lines).
- Prefer `Object.entries` and functional methods over `for...in`.
- Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering the rules.
- Block-level `/* oxlint-disable rule */` must wrap tightly: `/* oxlint-disable rule */` -> `/** TSDoc */` -> declaration -> `/* oxlint-enable rule */` (disable **before** the TSDoc; enable on the **very next line** after the declaration or closing `);`/`}`, never at end-of-file). Do not use `// oxlint-disable-next-line` between the TSDoc and the declaration: it lands on the TSDoc, not the declaration, so the suppression is lost.
- Never loosen lint rules without prior approval.
- Address all lint issues, including but not limited to warnings.

### Logging

Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events.
Never remove logging to "clean up";
treat it as permanent infrastructure.

Always use tagged loggers from `@monochromatic-dev/module-logger`.
Never use raw `console.log`/`console.error` or untagged logger instances in production code.
Exception: raw `console` is allowed when precise control over terminal output is needed (CLI user-facing messages, progress indicators, interactive prompts).

- Tag at every module and function boundary; use `myFn.name` as tag to stay in sync with refactors.
- Compose tags deeply: when calling a sub-function that accepts a logger, wrap the current logger with an additional tag before passing it.
- Never embed tags manually in message strings (e.g. `l.info("[cycle] done")`). Use the `tagged` wrapper instead.

### Security

No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

Any code that transforms or embeds text across a syntax boundary must treat the destination grammar as the authority.
Source escapes are not portable: Markdown `\<`, shell quotes, JSON escaping, URL encoding, or regex escaping do not make
text safe in another language. Normalize source semantics only as needed, then encode for the exact destination subcontext
at the final interpolation boundary. Account for nested contexts: HTML text vs attribute vs URL, JS string inside
`<script>`, CSS string, SQL literal, shell token, Markdown/MDX, JSON, regex, glob, terminal escape, and config syntax.
This applies to serializers, code generators, formatters, autofixes, docs generators, renderers, CLIs, and tests.

Tests for any transformer that emits another syntax must include adversarial boundary cases for that destination:
active delimiters, terminators, escapes, quotes, newlines, traversal tokens, command separators, and source-escaped
variants. Happy-path formatting and idempotence tests are not enough.

### CSS

When editing CSS, the `css` skill encodes the platform-feature defaults (native dialog, popover API, nesting, `@layer`, `@scope`, container queries), Firefox ESR 140 browser baseline, `rem`-only sizing, logical properties, longhand shorthand rules, design-token colors, and the 48px touch-target / focus-visible accessibility floor;
invoke it when touching any CSS.

### TSDoc comments

Write comprehensive TSDoc for **all** declarations (exported or not, including locals).
Adhere to the TSDoc rules enforced by `@monochromatic-dev/config-oxlint-tsdoc`.
Use `{@inheritDoc originalFn}` for non-async wrappers.

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

- Adhere to Oxlint, dprint confs.
- Use `//region`/`//endregion` markers with purpose and explanation for logical code sections.
- Cross-package workspace imports must resolve to TypeScript source, not built output.
- Include `.ts` extensions in imports; group: built-ins, external, workspace, relative, type-only.
- Prefer named imports, `import type` for type-only, absolute imports for workspace packages.
- Use `import ... with { type: 'text' }` for static assets (SVG, HTML, CSS, SQL) instead of `readFile`; Bun resolves these at build time with no async preload step needed.
- Use named function declarations exclusively: no arrow functions, no const-bound function expressions. Exception for callbacks whose signature is dictated by an external API or library: name the function and parenthesise all params.
- No calling functions before their declaration in source order; hoisting makes it legal but reading top-down becomes unreliable.
- Functions with 2+ parameters must use a single destructured object parameter (named params); exempt: callbacks whose signature is dictated by an external API or library.
- No rest parameters (`...args`) in functions we control; accept an array parameter instead.
- Export immediately at declaration; avoid `Object.assign` for extending typed objects.
- Throw and return early; use overloads (most specific first).
- No regex unless necessary.

#### Type system

- Explicit parameter and return types; `type` over `interface`; `Record` for maps.
- Avoid generic `Function` type; avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`.
- Union types over enums; `as const` for literals; branded types for domain primitives.
- Narrow symbol unions by `typeof` first, then identity check.
- `const` generic parameters; `readonly` array parameters; meaningful constraint names (e.g. `TData`).
- Prefer `as` over angle bracket syntax; use type guards for runtime checking; avoid deep nesting in conditional types.
- Use assertion functions (`asserts value is T`) for runtime type narrowing.
- `const` narrowing does not reach **function declarations** (tsc and tsgo). Fix: a helper that returns non-null (`function requireElement<T>(sel): T { ... throw ... }`), or reassign to a new `const` with an explicit type annotation after the null check.
- Generator overloads: remove `*` (sync) or `async *` (async) from non-implementation signatures.

#### Variables and values

- `const` over `let`. Two hard rules enforce this:
  - `no-restricted-syntax/no-function-root-let` reports `let` at function-body root. Refactor to `const` (ternary, `Array.reduce`), use a counter `for (let i = 0; ...)` loop (`let` inside `ForStatement.init` is exempt, so this is the right tool for an indexed or lookahead scan, not a rule to dodge), wrap the mutation in a named-function IIFE `(function name () { let x; /* ... */ return x; })()`, or extract a helper function ending in `return <local-binding>` (the helper-shape allowlist suppresses the report). Do **not** escape this rule by recursing over flat input (see "Simplification progression").
  - `no-restricted-syntax/no-module-root-let` reports `let` at module root, including `export let`. Replace with a `Map`/`WeakMap`/`Set`/`WeakSet` container, `memoize()` from `@monochromatic-dev/module-memoize`, or an IIFE-into-const initialization.
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
- `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator; `dedent` from `string-dedent` for multi-line error messages.
- Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes.
- Never `process.exit()`: throw errors instead; always `console.error()` in catch blocks.
- Never silently discard unexpected states; throw on unreachable branches.
- No `switch` statements: use if/else chains or `Record` lookups; if/else avoids `break` boilerplate and fallthrough bugs; `Record` is preferred when mapping a discriminant to a value.
- Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`.

#### Regular expressions

- Do not introduce a regular expression when an index scan, parser, or string API expresses the same rule clearly.
- A regex you remove must be replaced by a single linear pass: one `for...of` or `for (let i...)` scan, or one `reduce`, in O(n) time and O(1) extra stack. Do **not** replace it with recursion over the text, nor with an accumulator that rebuilds a string or array each step (`acc + c`, `[...acc, x]`); both are O(n^2) time and a stack-overflow risk at scale. Do not assume the original regex was linear either: a backtracking pattern can be superlinear (the ReDoS hazard this ban guards against), so linear is the bar the replacement must hit on its own merit, proven for attacker-controlled or unbounded input, not inherited from the regex.
- Regex literals, `RegExp` constructor calls, and string methods using regex must be guarded by a scoped `oxlint-disable-next-line no-restricted-syntax/no-regex -- ...` comment. The justification must explain why regex is the right tool, what input shape bounds it, and why it cannot backtrack or rescan unbounded prefixes/suffixes. If no useful justification exists, do not use regex.
- For hot paths or attacker-controlled input, prefer explicit parsers or index scans. If regex remains, cap the input or prove linear behaviour in the disable justification and regression tests.

## Before declaring work complete

### Package completeness

A package is not finished until it has a `README.md`, passes linting with zero errors, and has passing tests covering every exported code path.
Do not declare work complete while any condition is unmet.

### Test coverage matches the public API surface

Enumerate every distinct code path the module exposes, not just the obvious happy path.
If the implementation has separate branches for sync vs async, string vs object, direct vs delegated, each branch needs its own test.

"Tests exist and pass" is not evidence of completeness.
Compare test names against the implementation's branches;
confirm no untested path.

### Verify at the user boundary

After building, deploying, or installing an artifact, run verification steps that exercise it the way an end user would consume it.

- Server: confirm it serves correct responses, not just that it starts.
- CLI tool: run a real command and check the output.
- Hook/plugin: trigger it through the host application, not just by piping test input directly.
- Library: import and call it from a consuming project, not just compile it.
- Web page or standalone HTML artifact (including local `file://` docs and demos in `docs/`): load it with `agent-browser`, confirm no console errors, then exercise every interactive element (buttons, checkboxes, tabs) and read back the rendered state via `agent-browser eval`. "Markup balances," "JS parsed in bun," "I fetched the HTML" are prerequisites, not proof. If the task involved rewriting any JS handler, you must drive each rewritten code path through `agent-browser` before declaring done.

The verification must cross the integration boundary between artifact and consumer.
"It compiled" / "It installed" alone is not verification.

### Verify on a throwaway, not against real state

When verification means a state-mutating or destructive operation, run it against a disposable fixture you create, never the user's real or shared state (working tree, real tool caches, a populated database, live conf).
Reproduce the real scenario: `mktemp -d` plus `git init` for a repo, a scratch dir, a throwaway branch/worktree, a container, a fresh sqlite file;
exercise the real artifact against it, delete it afterward.
Pairs with "Verify at the user boundary": real artifact, throwaway state.

The rule holds even when the command looks idempotent or you have committed first;
when testing whether a guard blocks a destructive operation, build both the allowed case and the rejected case as fixtures.

The cue: about to run `reset --hard`, `clean -fd`, a migration, a bulk delete, an overwrite, or any other state-mutating command against the user's actual repo, cache, or data solely to observe how it behaves.
Create the throwaway target first.

### Test assumptions before encoding them

When writing instructions, conf, or documentation that prescribes how a tool or API behaves, test the claim first with a real invocation.
Do not write "use X for Y" based on how X **should** work;
run X against a real target and confirm the output.
Applies to agent prompts, README guidance, CI scripts, and any artifact future sessions will follow.

## When investigating problems

### Third-party libraries

- Immediately retrieve documentation on undefined method errors.
- Check actual type definitions before using APIs.
- Pay attention to CLI tool command patterns across examples; test the simplest case first.
- Never modify files in cloned third-party repositories; use conf, env vars, or wrapper scripts.
- When investigating an external tool's behavior, bug, capability, or fix difficulty, clone its src and read the relevant code path. "No public diagnosis exists" is never a valid stopping point when the source is open; quote file path, line number, and code excerpt when citing a finding.
- When proposing a package to replace a dependency, audit the candidate to the incumbent's depth: transitive deps, the src paths handling the cases the incumbent mishandles, build provenance for native/wasm modules, and maintenance signals. Report findings inline with the recommendation, not as trailing caveats.
- After investigating an external tool, write up findings in a `docs/troubleshooting/<topic>.md` file. The `troubleshooting-doc` skill encodes the required sections, the source-trace rule, and the 5-constraint upstream-filing check that gates the draft GitHub issue at the end; invoke it when you reach the write-up moment.
- **Claude Code bugs are exempt from upstream-tracking.** Claude Code upstream is very unresponsive; filing local tracking issues for Claude Code defects produces clutter without changing the outcome. Document the defect in `docs/troubleshooting/<topic>.md`, encode the workaround as a rule in this file, and skip the GitHub issue. See [.out-of-scope/claude-code-upstream-bugs.md](.out-of-scope/claude-code-upstream-bugs.md).
- **JSR and `bun install` bugs are exempt from upstream-tracking.** The workspace does not consume JSR-hosted packages (`docs/philosophy/tool-choices.md` covers tool selection) and uses pnpm as the package manager, not `bun install`. Bug reports against either are install-path bugs we do not hit. Document the defect in `docs/troubleshooting/<topic>.md` for historical record, but skip the GitHub tracking issue. See [.out-of-scope/jsr.md](.out-of-scope/jsr.md) and [.out-of-scope/bun-install.md](.out-of-scope/bun-install.md).

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

### Doc placement

Repo-wide docs live under `docs/<family>/`, one directory per dotted-prefix family (`docs/troubleshooting/`, `docs/philosophy/`, `docs/todo/`, `docs/handover/`, and so on).
The repo root keeps only `README.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSES/`, and already-tidy doc subdirectories like `.out-of-scope/`; the flat dotted-prefix families are what move under `docs/`.
Package-specific docs stay beside the code they document; this rule governs root-level families, not a package's own `README.md`, `TODO.md`, or `HANDOVER.*.md`.

1. Naming: a `PREFIX.rest.md` file becomes `docs/<prefix-lowercased>/<rest-lowercased>.md`, dropping the now-redundant prefix; a second dotted segment stays flat in the filename (`TODO.performance.build.md` becomes `docs/todo/performance.build.md`), not a deeper directory. Use kebab-case for multi-word topics.
2. Hubs: a bare `PREFIX.md` index becomes `docs/<family>/README.md`, keeping its curated prose.
3. Bug reports fold into the most relevant `docs/troubleshooting/<topic>.md` as a section rather than getting their own family.
4. Delete verifiably-finished docs once their work lands; git history is the backstop, so removal is not destructive. Read each before deleting.
5. Reference source files by repo-relative path, not a pinned GitHub blob URL; a blob URL also breaks when the target moves.

No enforcement hook guards root regression; this rule is the cure. A warn-only `PreToolUse` hook is a possible future addition, not built now.

### Handling external changes

- External worktree changes are normal and often expected in this repo.
  Treat `git status` entries you did not modify as concurrent work, not an emergency.
- Do not run `git restore`, `git stash`, cleanup, or other move-aside commands on unrelated external changes.
  Only touch files in your task scope; if an unrelated external change blocks a necessary edit, ask before changing it.
- Acknowledge externally modified files; ask before reverting.
- Do not proceed with implementing features that will not achieve their intended effect.
- Explain when a tool/command does not support requested functionality instead of creating non-functional code.

### Git commit guidelines

Conventional Commits format: `<type>(<scope>): <subject>`.

Commit at the earliest opportunity that records coherent progress, before the next work step.
Do not wait for full verification when a feature or fix has just been implemented;
commit the checkpoint, then keep testing and fixing in follow-up commits.
The cue is:
"I just finished implementing a feature or fix.
I am not sure it works yet, but committing now records progress."
Do not accumulate independent units in the working tree;
it forces a sprawling mixed-concern commit or an error-prone split.
The trigger is "I just finished a thing that stands on its own," not "the user told me to commit" or
"I am done with the whole task."
When committing, include all current working-tree changes together unless instructed otherwise;
do not subdivide a logical unit across commits.
This supersedes the harness default to ask before committing;
on this project, commit eagerly without asking.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope: package name or `*` for multi-package changes.

Group related changes by type; be specific about what changed. Two lines per group. Example:

```txt
fix(package1): <what>

<why>

fix(package2): <what>

<why>
```

If a commit message is inaccurate after committing, do not amend (harness rule).
Surface it, ask the user to push, then post a commit comment: it renders alongside the commit on GitHub and survives history rewrites.
Do not silently let it stand;
future readers see only the message.
The cue: about to write "the commit message overstates scope" or similar in chat as a one-off note instead of recording it where the commit lives.

### Respect cli-git enforcement guards

Do not preemptively bypass `cli-git` enforcement.
The `git add` and `git commit` guards reject bulk staging (`-A`, `.`) and pathspec-less commits on purpose: with a dirty tree or concurrent sessions they sweep unintended files into a commit.
They are not obstacles to route around;
the compliant path satisfies them.
Stage and commit an explicit, package-scoped pathspec (`git add <path>`; `git commit <path> -m ...`), which also keeps each commit to one logical unit and cannot capture another session's files.
Reach for `--no-enforce-bulk-add` or `--no-enforce-only` only when no scoped pathspec can express the change (a genuine whole-tree single-session operation), never as the default form, and never baked into instructions to child sessions.
The cue: about to type `--no-enforce`, `git add -A`, or `git add .` before trying a scoped pathspec, or about to hand a child a commit recipe carrying a bypass flag.

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

- Identify the target package and task before running tests; do not reflexively use repo-root `mise run test` for narrow package work.
- Mise task `run` commands use nushell, not bash. Chain sequentially with `;` (`mise run foo; mise run bar`), not `&&`.
- All builds and tasks use `mise run`. Never run `pnpm exec` or direct package scripts. Never invoke raw tools (`tsc`, `tsdown`, `bun test`, `oxlint`, etc.) directly; use the corresponding mise task. When no suitable task exists, add one to the target package's `mise.toml` first.
- Never substitute `bun test` for a missing mise task; it misreports (`PASS` lines then `0 pass / 0 fail`) under the `@monochromatic-dev/module-test` harness. Use `mise run //packages/<path>:test:unit`, or run the file directly with `bun <file>` (matches `packages/module/test/mise.toml`'s self-test pattern) if no task exists. A `PreToolUse` hook (`ccgr`, `packages/claude-code-plugins/source/src/handlers/guardrail.ts`) blocks the call when configured.
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
- Switch from config-as-data to TypeScript when conf needs logic (`if`, `map`, `await`).
- Direct async execution over descriptor/interpreter patterns; apply YAGNI to architecture.
- Nested calls (`b(a())`) over method chaining to keep functions self-contained;
  split a chain of more than two nested calls across lines instead of stacking close-parens (`)))`) on one line.

## Enforcement mechanisms

Several hooks act on agent output and may block or modify actions.

- **Stop hook**: inspects the assistant response at send time and rejects turns containing the hedge phrases listed under "Hedge phrases that signal a skipped step". Rejection returns the message to you with feedback; avoid via the pre-response checklist and hedge-phrases self-catch. Also flags responses that end in a question to the user without using the `AskUserQuestion` tool.
- **`bash-output-filter` hook**: transforms Bash tool output (see "Bash output path collapse"). Display only; does not modify actions. Triggers a bypass when the command contains `eval`, `export`, `source`, `$(...)`, backticks, or `> file`.
- **`forbidden-strings` CI scan**: runs in `.github/workflows/forbidden-strings.yml` on every PR (changed files only) and on push to main (full tree). Scans against a baseline deny-list plus an optional `FORBIDDEN_STRINGS_LIST` secret. Detects literal known-bad strings (leaked credentials, banned tokens). Failures block merge; scanner source is `packages/cli/forbidden-strings/`.

Codex plugin packages under `packages/codex-plugins/` are work in progress.
Do not assume a Codex hook is active unless you verify the installed Codex config or current session output proves it.

A `PostToolUse` lint:types hook is on the roadmap but not yet implemented;
type-checking is manual (see "Essential commands" -> mise run lint:types).

## Agent skills

- **Issue tracker**: GitHub Issues via `gh` CLI. "Resolve issue N" requires explicit `gh issue close` after the fix commits; commit-body `Closes #N` auto-close is not sufficient. See `docs/agents/issue-tracker.md`.
- **Triage labels**: five canonical roles with default label strings. See `docs/agents/triage-labels.md`.
- **Domain docs**: no context files; agents read fresh code on every probe. See `docs/agents/domain.md`.

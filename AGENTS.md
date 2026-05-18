# Development Guidelines for AI Agents

This document is organized by moment of decision, not by topic. When you reach a particular point in the work (about to respond, about to run a command, about to edit code, about to declare done), the corresponding section contains every rule that applies. Cross-cutting reference material (workspace conventions, enforcement mechanisms, agent skills) appears toward the end.

## Critical hot paths

This section is an index to high-loss rules below; it does not add separate policy. When a cue matches, follow the target rule immediately rather than rediscovering it later.

- **Visible terminal/window/session**: use `terminal-exec -- <command> ...` for arbitrary commands that need a real terminal window, including Codex. `spawn_agent` and PTY sessions are not visible terminals. `spawn-claude` is only for Claude Code child sessions. Do not probe `terminal-exec` with `--help`; read its README or source because unknown options are ignored and it opens a terminal. See "Visible terminal spawning".
- **External tool, CLI, config, or API capability claims**: fetch current docs or clone and read source before answering. Do not infer from `--help`, package wrappers, or memory when the source is available. See "Communication style" and "Third-party libraries".
- **Git cleanup, destructive git guards, or worktree safety reviews**: inspect ignored root artifacts with the sentinel commands before final findings. See "Git cleanup and worktree safety reviews".
- **Tests**: identify the target package and task before running tests. Do not use repo-root `mise run test` as a reflex for narrow package work. See "Essential commands".
- **User correction of a substantive claim**: treat the correction as evidence that the previous verification path failed. Re-read primary evidence or use a genuinely separate reviewer if independent review is requested. Do not write a same-session `Advisor pass: ...` as evidence. See "Pre-response checklist".

## Before responding to the user

### Communication style

Be direct and honest. Search for evidence before responding to opinions, guesses, or analysis requests. Treat embedded questions ("month? year?"), implicit asks, requests for estimates, and gaps in user input as research tasks: use web search, read code, or check documentation rather than deflecting with "genuinely unknown."

Do not attribute `<system-reminder>` content to the user. These tags carry harness-level configuration, not what the user typed. Phrasing like "per your instruction" or "you asked me to" is wrong when the source is a system reminder; cite the policy by what it says ("the no-questions policy") rather than attributing it to the user. Same shape applies to other injected context (UserPromptSubmit hook output, MCP server instructions, skill descriptions): the source is the hook or server, not the human.

Cite the right source file. The rules an agent follows span multiple sources: AGENTS.md, the Claude Code harness system prompt (Git Safety Protocol, tool-use guidelines, format instructions), hook configs in `.claude/settings.json`, skill `SKILL.md` files, MCP server instructions, and `CLAUDE.md` (regenerated from AGENTS.md). The same rule can sound like it lives in any of them, and a quick recall feels like enough. It is not. Before writing "per AGENTS.md", "the system prompt says", "the hook requires", "the skill prescribes", grep the file you name. Failure shape: writing "AGENTS.md says never amend" when "never amend" actually lives in the harness Git Safety Protocol; the user catches it by asking "which line?" and the grep returns nothing. The cue: you are about to attribute a rule to a specific source without having verified the source contains it. Same risk as the user-attribution case above, different victim.

For external tool features, CLI options, config syntax, or API capabilities, fetch current documentation or source before responding. Do not rely on training data; features change across versions and confident-but-wrong answers waste more time than a research pause. "Does X support Y" and "how do I do Y in X" are research tasks, not recall tasks.

When explaining a warning or error, name the exact tool that emitted it (e.g. "Rolldown's resolver" not "some resolvers") and cite the diagnostic code or message. If unsure which tool produced it, investigate first: search the codebase for the diagnostic, check tool documentation, or run the tool directly.

When the user says "I was expecting you to..." or you yourself notice mid-conversation a failure mode future sessions would benefit from avoiding, treat it as a documentation gap. Propose a concrete AGENTS.md change (what rule, where it goes, exact wording) and perform the expected action. Never substitute "I'll keep it in mind" or any promise to your future self: sessions have no memory; rules persist only in AGENTS.md, a skill, or a hook. When proposing the edit, also check whether existing rules can be merged, sharpened, or removed; the mechanism is monotonic by default (every unmet expectation adds rules), leading to unbounded growth. Counteract: if a new rule duplicates or overlaps an existing one, merge instead of appending; if an existing rule has been overtaken by a sharper version, remove the older. AGENTS.md should grow only when no existing rule covers the failure mode. The cue to draft the edit is exactly the moment you catch yourself wanting to "remember next time."

### Proactivity calibration

This user does not perceive proactive action as overreach. Claude Code harness defaults that caution against "being too proactive" do not apply here. The git-commit guardrail typifies the pattern ("It is VERY IMPORTANT to only commit when explicitly asked, otherwise the user will feel that you are being too proactive"); the same calibration applies to every similar default. When the conversation, request verb, and AGENTS.md rules collectively authorize a step, take it; do not insert a "want me to..." or "should I go ahead and..." check before acting on the obvious next step.

This does not relax other constraints. Destructive or shared-state actions still need explicit authorization. Decision verbs still return the answer not the action. Non-measurable preferences with multiple valid answers still warrant a clarifying question. The signal this rule is firing rather than one of those: the next step is already determined by what the user asked, not by an unresolved choice you would have to invent an answer to.

The cue: you are about to write "want me to also..." or "should I go ahead and..." about a step the conversation has already authorized. Skip the prompt and do the step.

### Task tracking granularity

For broad requests that span multiple evidence areas, split the work into separate task-list items for each major area instead of one umbrella item.
Each task should have concrete completion criteria that can be verified independently:
inventory, tooling, architecture, tests, security, documentation, synthesis,
or whatever categories the request demands.
The cue: a single task subject would hide multiple kinds of evidence gathering
or make it unclear what "done" means.

### Pre-response checklist

Before sending any response with substantive claims:

1. Quantitative claim (size, speed, complexity, difficulty, duration) without measuring? Measure or rephrase as a guess.
2. Described how an external tool works without reading its source? Clone and read (see "Third-party libraries"), or label as recall-from-training.
3. Estimated the difficulty of a fix you have not built? Drop the estimate.
4. Used a hedge phrase (see "Hedge phrases that signal a skipped step")? Verify or remove.
5. Assumed a measurable fact about the user's environment (codebase size, deps, build time, file contents, whether a tool/syntax/feature is used in the codebase, whether a config already covers the behaviour being proposed, whether AGENTS.md already bans/requires the thing being weighed) or about the user's own working pattern recorded in repo artifacts (commit cadence, working hours, defect-recovery rate, whether parallel sessions are running concurrent with the conversation)? Measure it. Categorical dismissals ("the project doesn't use X", "X doesn't apply here", "X is already handled by Y") feel like recall but are one `rg`/`find`/config-read/AGENTS.md-grep away from being checked. **AGENTS.md itself counts as a config to read.** Cite the search result inline (file path, line number, or config key); if the dismissal was wrong, fold the now-relevant option back into the analysis.
6. Assumed a non-measurable preference (which approach, what they value)? Ask.
7. Confident factual claim about your environment, an external tool, or source code? Verify any cited path/line still exists; for uncited claims, add the citation inline (see "Name the verification step") or downgrade to a labeled guess.
8. Claimed a tool cannot do something? Check whether composition (Bash + shell utility) bridges the gap; refuse only after trying (see "Before claiming inability").
9. Quoted a clause or doc passage and drawn a conclusion from it? Restate the subject and object in plain English before relying on the conclusion. Failure shape: "X waives Y" read as "X is freed from Y" when the clause actually runs Y from X toward a third party.
10. About to ask the user to perform a manual action? Apply "Handing off manual actions": try the bridging path first; if you must hand off, invoke the `runbook` skill.
11. Revising a substantive claim the user just corrected? Treat the correction as evidence that your previous verification path was insufficient. Re-read primary sources, run concrete commands, or use a genuinely separate reviewer when the user asks for independent review. Do not run a same-session self-review, local "advisor" skill, or magic `Advisor pass: ...` ritual; self-review is not independent evidence. See `docs/agent-self-review.md`. User-correction phrases ("demonstrably false", "you missed", "didn't you", "you're wrong", "shouldn't have", "why would you") are an approach-change moment, not a small patch.

### Measure-vs-ask

**Measurable facts: measure.** Codebase size, build time, file count, dependency tree, test count, perf numbers, config values, file contents. Also the user's own working pattern recorded in repo artifacts: commit cadence, working hours, defect-recovery rate, concurrent-session evidence.

- Codebase size: `tokei` or `find . -name '*.ts' | xargs wc -l`
- Build time: `time mise run build`
- Test count: count test files or run with reporter
- Dependency count: `pnpm ls --depth=0` or count entries in `package.json`
- Fix complexity: read the source code path that would change
- User commit cadence: `git log --format='%aI' --since=<date> | cut -dT -f1 | uniq -c` for commits-per-day distribution
- Daily commit span (proxy for working hours): per-day min and max hour from `git log --format='%aI'`
- Defect-recovery rate: count of `revert`/`regression`/`fix.*broken` commits over total commits in the window
- Concurrent-session evidence: compare `git log --since=<conversation-start>` timestamps against this conversation's UserPromptSubmit hook times

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
- "almost certainly", "most likely X lives/is/exists in Y": you have a checkable target (the named document, the named location); fetch it instead of stating a probability about its contents.
- "the most likely X" / "the most common Y" used as a ranking without naming the population: same shape as "better than most"; either name the comparison set or drop the comparative.
- "this is a tractable PR": drop "tractable" or actually build the fix
- "should be straightforward": drop "straightforward" or test the path
- "no public diagnosis exists" used as a stopping point: drop or clone the source yourself (see "Third-party libraries")
- "an afternoon" or any other duration estimate: only valid if you have built a similar fix in this codebase before; otherwise drop
- "the project doesn't use X" / "we don't use X" / "the codebase doesn't have X" used to cut off a candidate without verifying: one `rg`/`find`/config-read away; cite the search result or drop the dismissal. AGENTS.md and tsconfig count as places X may be wired up.
- "X is already handled by Y" / "X is already covered by Y" used as a dismissal: read Y's config or source to confirm the overlap before dropping X from consideration. Pair the dismissal with a file path and line number, or drop it.
- "I don't know your specific X" / "I'd need data on your Y" / "this depends on your specific Z that I don't have" used to defer reasoning about the user's working history, defect rate, throughput, hours, or whether parallel sessions are running: `git log`, `gh issue list`, and file mtimes record these. The phrase is a deflection, not an epistemic limit; run the measurement before drawing the conclusion.

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

### Follow document pointers

When a ToS, README, spec, or other source document explicitly references another document where the substantive provisions live ("Services are governed by separate subscription agreements, not these Website Terms," "see Y agreement for those terms," "details in the linked spec"), fetch the referenced document before drawing conclusions about its contents. Hedging about a named, fetchable target is the failure mode; the cue is writing "likely contains," "almost certainly addresses," or "probably covers" about a document one tool call away. The pointer is the research lead, not the stopping point.

### Choosing technology and vendors

When recommending a SaaS vendor, picking a library, framework, or build tool, the `choosing-technology` skill encodes context-fork questions, the six vendor vetting layers (layoffs, reviews, outages, funding, signup friction, security), open-source default, constraint-fit before stack-fit, the alternative survey rule (name at least two with rejection reasons), and the `docs/decisions/<project>.md` maintenance rule; invoke it when proposing or evaluating any external dependency or service.

### Before claiming inability

"I cannot read this file format" / "my tools do not support that operation" / "I can't render / preview / test the page in a browser" / "I can't run this in this environment" are all capability claims about the whole toolset, not Read or Bash individually. Bash plus shell utilities (`agent-browser`, `ffmpeg`, `pandoc`, `magick`, `pdftotext`, `jq`, and many others) compose with Read into a wider capability than any single tool. Try a bridging path before refusing: convert the input to a format your tools accept, decompose into supported steps, run the file through a shell utility and read its output, or drive a real browser via `agent-browser` (it opens local `file://` URLs, evals JS, takes screenshots, surfaces console errors). The browser-claim form is especially sticky because the answer feels obviously "no" until you remember `agent-browser` exists; whenever you are about to write any phrasing meaning "can't see / render / interact with a web page," stop and reach for `agent-browser` first.

Refuse only after attempting a bridge and confirming no path exists. State the bridges you tried; an unconsidered refusal looks identical to a real obstacle, and the user cannot tell which is which.

The same applies to research-exhaustion claims. When a narrow search returns "no direct evidence for X" and X is a specific entity in a broader class, widen to the nearest comparable entities (sibling tools, peer platforms, projects solving the same problem) before concluding. Failure shape: writing "no precedent for Netlify" while LocalStack, MinIO, Dokku, and Coolify each provide one-search-away evidence about the same legal or technical question. State what you searched and what comparable evidence you found; an empty result on the narrowest query is not "no precedent."

### Handing off manual actions

"You'll need to do X yourself" is the same shape as "I cannot read this file format" (see "Before claiming inability"): a capability claim about the whole toolset, not about Claude's reach. Many actions that feel manual have a bridging path. GUI clicks: `agent-browser` drives most web UIs; `xdotool` / `wtype` / `ydotool` drive native UIs; "click" actions usually have a keyboard shortcut to synthesise, or a backing HTTP/IPC endpoint that bypasses the UI entirely. Interactive auth: scripted with `expect`, or skipped via API tokens. Hardware activation: almost always a CLI. Try the bridging path before asking; if you ask, state the bridges you tried so the user can tell an unconsidered handoff from a real one.

When the bridges genuinely fail and the user must execute, the `runbook` skill encodes the required sections (Setup, Steps, What to check, Restore), the bold-every-UI-element rule, the expected-outcome-per-step rule, and the exact-strings-not-paraphrases rule; invoke it when writing any manual-action document. Canonical example: `packages/desktop-daemon/editord/HANDOVER.chokidar-atomic-migration.md`.

The cue you are about to violate the rule: about to write "you'll need to" or "please open" without naming the bridges you tried.

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

### Git cleanup and worktree safety reviews

When reviewing a plan or change that touches `git clean`, destructive git guards, worktree safety, or ignored-file cleanup, inspect ignored root artifacts before final findings. Run:

```bash
find . -maxdepth 1 \( -name HEAD -o -name config -o -name hooks -o -name objects -o -name refs \) -print
git check-ignore -v HEAD config hooks objects refs
git clean -ndX HEAD config hooks objects refs
```

Do not rely on `git status`, `git ls-files --others --exclude-standard`, or `rg --files`; those hide ignored files. If any root sentinel exists, cleanup or an exact safe cleanup path is part of the design under review.

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

### Visible terminal spawning

When the user asks to spawn something in another terminal, window, or session, use a real terminal launcher. For arbitrary commands, including Codex, use `terminal-exec -- <command> ...`. Use `spawn-claude` only for Claude Code child sessions. `spawn_agent` is not an OS terminal, and a PTY/TTY is not the same as a visible terminal emulator window.

Do not wrap routine verification commands in an external `timeout` binary. Use the command tool's session/polling behavior first; if a process truly remains after producing its useful output, inspect the PID and stop that specific stale process. Reserve external timeout wrappers for commands whose own behavior is specifically being tested or for commands with a known unbounded runtime and no narrower kill mechanism.

Always pass an explicit path (`.` or absolute) to `rg` in the Bash tool.

Clone entire git repo of a package to a temp dir whenever investigating source code. Use `gh repo clone` instead of `git clone`; `gh` handles authentication and fork remotes automatically.

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
- Never write bash/powershell scripts; use inline nushell or TypeScript files as `mise.<action>.ts`. Execute with Bun directly; top-level code and top-level await (no `main()` wrapper).
- Pin tool versions only with clear justification and a comment explaining why.
- Add explicit guards (transcript size check, env var flag, session type filter) to any automation that spawns agent sessions, to prevent recursive token burn.

### Simplification

- Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state and imperative loops.
- Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-async-time`) over manual promise creation.
- Extract and name concepts; start simple, refactor to complexity only when necessary.
- Simplification progression: imperative loop -> while -> for -> recursive -> higher-order functions/async iterators.
- Never disable, raise, bypass, or work around the max-lines limit. Remediate by splitting: re-export from `index.ts`; move helpers to siblings (e.g. `crc32.ts`, `headers.ts`), constants to `constants.ts`, types to `types.ts`. Pattern: `packages/module/hyperscript/src/index.ts` (76 lines, pure re-exports), `packages/module/image-diff/src/index.ts` (75 lines, pure re-exports). Forbidden workarounds (each violates another rule): compressing function arguments to one line, joining multi-line statements, removing TSDoc, removing `//region` markers, joining declarations. If you find yourself reformatting to reduce line count, stop; the fix lives in another file.

### Linting

- Never violate one rule to satisfy another. Lint rules form a single shape: code that satisfies all of them. When two rules appear to conflict, the remediation is structural (split, extract, rename), never reformatting one rule's surface to silence another. Signal you are violating-to-satisfy: about to undo something the autofix or AGENTS.md prescribed (e.g. compressing args back onto one line to fit max-lines).
- Prefer `Object.entries` and functional methods over `for...in`.
- Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering the rules.
- Block-level `/* oxlint-disable rule */` must wrap tightly. Order with TSDoc: `/* oxlint-disable rule */` -> `/** TSDoc */` -> declaration -> `/* oxlint-enable rule */`. The disable goes **before** the TSDoc so the TSDoc remains the immediately preceding comment. The enable goes on the **very next line** after the declaration (or closing `);`/`}`). Never at end-of-file or many lines later. Leaving a disable open longer than necessary silences unrelated violations.
- When a declaration needs both TSDoc and a suppression, use the block-level disable + enable pair wrapping the TSDoc and declaration tightly. Do not use `// oxlint-disable-next-line` between the TSDoc and the declaration: the directive applies only to the literal next physical line, so it lands on the TSDoc instead of the declaration and the suppression is lost.
- Never loosen lint rules without prior approval.
- Address all lint issues, this includes but not limited to warnings.

### Logging

Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events. Never remove logging to "clean up"; treat it as permanent infrastructure.

Always use tagged loggers from `@monochromatic-dev/module-logger`. Never use raw `console.log`/`console.error` or untagged logger instances in production code. Exception: raw `console` is allowed when precise control over terminal output is needed (CLI user-facing messages, progress indicators, interactive prompts).

- Tag at every module and function boundary; use `myFn.name` as tag to stay in sync with refactors.
- Compose tags deeply: when calling a sub-function that accepts a logger, wrap the current logger with an additional tag before passing it.
- Never embed tags manually in message strings (e.g. `l.info("[cycle] done")`). Use the `tagged` wrapper instead.

### Security

No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

### CSS

When editing CSS, the `css` skill encodes the platform-feature defaults (native dialog, popover API, nesting, `@layer`, `@scope`, container queries), Firefox ESR 140 browser baseline, `rem`-only sizing, logical properties, longhand shorthand rules, design-token colors, and the 48px touch-target / focus-visible accessibility floor; invoke it when touching any CSS.

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
- No regex unless necessary.

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
- `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator; `dedent` from `string-dedent` for multi-line error messages.
- Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes.
- Never `process.exit()`: throw errors instead; always `console.error()` in catch blocks.
- Never silently discard unexpected states; throw on unreachable branches.
- No `switch` statements: use if/else chains or `Record` lookups; if/else avoids `break` boilerplate and fallthrough bugs; `Record` is preferred when mapping a discriminant to a value.
- Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`.

#### Regular expressions

- Do not introduce a regular expression when an index scan, parser, or string API expresses the same rule clearly.
- Regex literals, `RegExp` constructor calls, and string methods using regex must be guarded by a scoped
  `oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- ...` comment. The justification must
  explain why regex is the right tool, what input shape bounds it, and why it cannot backtrack or rescan unbounded
  prefixes/suffixes. If no useful justification exists, do not use regex.
- For hot paths or attacker-controlled input, prefer explicit parsers or index scans. If regex remains, cap the input
  or prove linear behaviour in the disable justification and regression tests.

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
- Web page or standalone HTML artifact (including local `file://` docs and demos in `docs/`): load it with `agent-browser`, confirm no console errors, then exercise every interactive element (buttons, checkboxes, tabs) and read back the rendered state via `agent-browser eval`. "Markup balances," "JS parsed in bun," "I fetched the HTML" are prerequisites, not proof. If the task involved rewriting any JS handler, you must drive each rewritten code path through `agent-browser` before declaring done.

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
- After investigating an external tool, write up findings in a `TROUBLESHOOTING.<topic>.md` file at the repo root. The `troubleshooting-doc` skill encodes the required sections, the source-trace rule, and the 5-constraint upstream-filing check that gates the draft GitHub issue at the end; invoke it when you reach the write-up moment.
- **Claude Code bugs are exempt from upstream-tracking.** Claude Code upstream is very unresponsive; filing local tracking issues for Claude Code defects produces clutter without changing the outcome. Document the defect in `TROUBLESHOOTING.<topic>.md`, encode the workaround as a rule in this file, and skip the GitHub issue. See [.out-of-scope/claude-code-upstream-bugs.md](.out-of-scope/claude-code-upstream-bugs.md).
- **JSR and `bun install` bugs are exempt from upstream-tracking.** The workspace does not consume JSR-hosted packages (`PHILOSOPHY.tool-choices.md` covers tool selection) and uses pnpm as the package manager, not `bun install`. Bug reports against either are install-path bugs we do not hit. Document the defect in `TROUBLESHOOTING.<topic>.md` for historical record, but skip the GitHub tracking issue. See [.out-of-scope/jsr.md](.out-of-scope/jsr.md) and [.out-of-scope/bun-install.md](.out-of-scope/bun-install.md).

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

Group related changes by type; be specific about what changed.

Two lines per group. Example:

```txt
fix(package1): <what>
<why>

fix(package2): <what>
<why>
```

If you notice a commit message is inaccurate after committing, do not amend (harness rule). Surface the inaccuracy to the user and ask them to push (pushing is a shared-state action that needs explicit authorization; do not push yourself unless the user said so), then post a commit comment via `gh api repos/<OWNER>/<REPO>/commits/<SHA>/comments -X POST -f body='<correction>'`. The comment renders alongside the commit on GitHub and survives history rewrites. Do not silently let an inaccurate commit message stand: future readers see only the message, not the conversation that produced it. The cue: you are about to write "the commit message overstates scope" or similar in chat as a one-off note instead of recording it where the commit lives.

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
- `bun test` specifically: never substitute it for a missing mise task. The custom `@monochromatic-dev/module-test` harness runs tests as a side effect of import, so `bun test <file>` prints `PASS` log lines (from the harness) and then reports `0 pass / 0 fail` (bun's runner finds no `bun:test` registrations). The misleading summary suggests the run was broken when in fact every test passed. Use `mise run //packages/<path>:test:unit`; if no such task exists, run the file directly with `bun <file>` (matches `packages/module/test/mise.toml`'s self-test pattern). A `PreToolUse` hook (`ccgr`, source at `packages/claude-code-plugins/source/src/handlers/guardrail.ts`) blocks the call when configured.
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
- **`forbidden-strings` CI scan**: runs in `.github/workflows/forbidden-strings.yml` on every PR (changed files only) and on push to main (full tree). Scans against a baseline deny-list plus an optional `FORBIDDEN_STRINGS_LIST` secret. Detects literal known-bad strings (leaked credentials, banned tokens). Failures block merge; scanner source is `packages/cli/forbidden-strings/`.

Codex plugin packages under `packages/codex-plugins/` are work in progress. Do not assume a Codex hook is active unless you verify the installed Codex config or current session output proves it.

A `PostToolUse` lint:types hook is on the roadmap but not yet implemented; type-checking is manual (see "Essential commands" -> mise run lint:types).

## Agent skills

- **Issue tracker**: GitHub Issues via `gh` CLI. "Resolve issue N" requires explicit `gh issue close` after the fix commits; commit-body `Closes #N` auto-close is not sufficient. See `docs/agents/issue-tracker.md`.
- **Triage labels**: five canonical roles with default label strings. See `docs/agents/triage-labels.md`.
- **Domain docs**: no context files; agents read fresh code on every probe. See `docs/agents/domain.md`.

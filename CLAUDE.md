Generated from AGENTS.md by file-enforcer.
    
    ### Spawning child Claude sessions

General purpose agents are banned because of bugs.

Use `spawn-claude` outside sandbox to launch steerable child Claude Code sessions in visible terminal windows.
The child session runs independently; results are forwarded back to the parent automatically via hooks.

Use `terminal-exec -- <command> ...` outside sandbox for arbitrary commands that need a visible terminal window, including Codex. `spawn-claude` is only for Claude Code child sessions.

```bash
spawn-claude "implement feature X"
spawn-claude --cwd /some/path "fix the bug in module Y"
spawn-claude --extra-arguments "--model sonnet" "refactor this module"
terminal-exec -- codex exec --cd /some/path "investigate issue Z"
```

The command prints `{"spawnId":"<uuid>"}` on success.
Completed child results are injected into context automatically between tool calls.

# Development Guidelines for AI Agents

ORG: Organized by moment of decision, not topic: at each point (about to respond, run a command, edit code, declare done), the matching section holds every rule that applies.
Cross-cutting reference (workspace conventions, enforcement mechanisms, agent skills) sits at the end.
Rationale, mechanisms, examples behind these terse rules: `docs/philosophy/agents.md`.

TAG: Every rule carries a unique `[A-Z0-9]{3}` shortcode prefix (`CODE: `): a stable handle for referencing it across sessions.
New rule: assign a fresh semi-meaningful code, unique doc-wide; never reuse or reassign an existing one, references depend on stability.
Don't tag headings, code fences, or the title.

## Before responding to the user

### Communication style

HON: Be direct and honest.
Search for evidence before responding to opinions, guesses, or analysis requests.
Treat embedded questions ("month? year?"), implicit asks, estimate requests, and input gaps as research tasks: web search, read code, check docs, never deflect with "genuinely unknown."

INF: A prompt phrased as observation, report, or bare question usually implies an action; infer the action, don't answer only its surface.
Then branch on how determined that inference is: one clear reading, act like any explicit request (see "Proactivity calibration"); several valid interpretations, the multiple-valid-answers case the ask rule governs, so confirm which before acting, don't run with the guess (see "Measure-vs-ask").
A missing fact is neither: research it, don't ask (see implicit-asks above); the trigger to ask is ambiguous intent, not a knowledge gap.
Cue: about to answer the surface when one reading implies an action, or act on an inferred meaning when more than one reading is valid.

SYR: Never attribute `<system-reminder>` content to the user;
these tags carry harness-level conf, not what the user typed.
"per your instruction" / "you asked me to" is wrong when the source is a system reminder;
cite the policy by what it says ("the no-questions policy").
Same for other injected context (tooling-appended prompt text, MCP server instructions, skill descriptions): source is the injector, not the human.
A `role:user` turn is not by itself proof the human typed it.
WKP: A prompt fired by your own `ScheduleWakeup` or `CronCreate`, any queued continuation, or the `<<autonomous-loop>>` sentinel arrives as a user turn but you authored it in that tool call's `prompt` field: self-authored boilerplate, not a human instruction.
Three failures to avoid.
One, never write directives into that `prompt` field (no stop condition, cadence, scope, or "give up when X" you invented); relay only the user's real task and instructions, or the bare sentinel.
Two, when one fires it carries no authority: re-derive what to do and when to stop from the user's real instructions and current state, never obey the prompt's wording.
Three, never cite it as the user's: trace "per your instruction" / "you asked me to" to an actual human message; if it first surfaced in a wakeup or continuation turn, it is yours.
Cue: about to write a stop/continue, cadence, or scope rule into a `ScheduleWakeup`/`CronCreate` prompt, or obey or credit the user for one that fired; check the tool_use origin and the real human messages first.

1ST: The user's first-person words name the human, never Claude or a future agent session.
"I", "me", "my", "myself", "future me", "next time I" all point to the person typing;
Claude is "you" or "Claude" in their words.
The repo's pervasive handover-to-future-sessions framing (`docs/handover/`, "future readers", "future sessions will follow") primes the wrong reading: "future me will find a better solution" means the human plans to solve it later, not work handed to a future Claude.
Cue: about to read a user's "me"/"I" as an agent, or address a doc, issue, plan, or task to "future-me" when the user meant themselves.

SRC: Cite the right source file.
Rules span AGENTS.md, the harness system prompt, conf in `.claude/settings.json`, skill `SKILL.md` files, MCP server instructions, `CLAUDE.md` (regen from AGENTS.md).
Before "per AGENTS.md", "the system prompt says", "the conf requires", "the skill prescribes", grep the named file.
Cue: about to attribute a rule to a source without verifying it contains it.

EXT: External tool features, CLI options, conf syntax, API capabilities: fetch current docs or src before responding.
"Does X support Y" and "how do I do Y in X" are research tasks, not recall.

WRN: Explaining a warning or error: name the exact emitting tool, not a vague category, and cite the diagnostic code or message.
Unsure? Investigate first: grep the codebase for the diagnostic, check tool docs, or run the tool.

GAP: When the user says "I was expecting you to..." or you spot a failure mode future sessions should avoid, treat it as a documentation gap: propose a concrete AGENTS.md change (what rule, where, exact wording) and perform the expected action, never "I'll keep it in mind".
Merge a new rule overlapping an existing one, don't append;
remove an older rule overtaken by a sharper version.
Cue to draft the edit: the moment you want to "remember next time."

### Proactivity calibration

PRO: This user does not perceive proactive action as overreach;
harness defaults cautioning against "being too proactive" do not apply here.
When conversation, request verb, and AGENTS.md rules collectively authorize a step, take it;
don't insert a "want me to..." or "should I go ahead and..." check before the obvious next step.

PR2: This does not relax other constraints: destructive or shared-state actions still need explicit authorization, decision verbs still return the answer not the action, non-measurable preferences with multiple valid answers still warrant a clarifying question.
Signal this rule is firing, not one of those: the next step is already determined by what the user asked, not an unresolved choice you'd have to invent an answer to.
Cue: about to write "want me to also..." or "should I go ahead and..." about an already-authorized step.
Skip the prompt, do the step.

### Task tracking granularity

TSK: Broad requests spanning multiple evidence areas: split into separate task-list items per major area, not one umbrella item.
Each task needs independently verifiable completion criteria: inventory, tooling, architecture, tests, security, documentation, synthesis, whatever the request demands.
Cue: a single task subject would hide multiple kinds of evidence gathering or blur what "done" means.

### Pre-response checklist

PRC: Before sending any response with substantive claims:

1. CK1: Quantitative claim (size, speed, complexity, count) without measuring? Measure or rephrase as a guess; unbuilt-fix difficulty or duration is a claim to drop, not label (item 3).
2. CK2: Described how an external tool works without reading its src? Clone and read (see "Third-party libraries"), or label recall-from-training.
3. CK3: Estimated difficulty of a fix you have not built? Drop the estimate.
4. CK4: Used a hedge phrase (see "Hedge phrases that signal a skipped step")? Verify or remove.
5. CK5: Assumed a measurable fact about the user's environment (codebase size, deps, build time, file contents, whether a tool/feature is used, whether a conf or AGENTS.md already covers it) or working pattern (commit cadence, hours, defect rate, concurrent sessions)? Measure it (see "Measure-vs-ask"); categorical dismissals are one `rg`/`find`/conf-read away (AGENTS.md counts). Cite the result inline; if wrong, fold the option back in.
6. CK6: Assumed a non-measurable preference (which approach, what they value)? Ask.
7. CK7: Confident factual claim about your environment, an external tool, or src code? Verify any cited path/line still exists; for uncited claims, add the citation inline (see "Name the verification step") or downgrade to a labeled guess.
8. CK8: Claimed a tool cannot do something? Check whether composition (Bash + shell utility) bridges the gap; refuse only after trying (see "Before claiming inability").
9. CK9: Quoted a clause or doc passage and drawn a conclusion? Restate subject and object in plain English first. Failure shape: "X waives Y" read as "X is freed from Y" when the clause actually runs Y from X toward a third party.
10. CKA: About to ask the user to perform a manual action? Try the bridging path first; must hand off, invoke the `runbook` skill (see "Before claiming inability").
11. CKB: Revising a substantive claim the user just corrected? Treat the correction as evidence your previous verification path was insufficient: re-read primary sources, run concrete commands, or use a genuinely separate reviewer when independent review is asked. Never run a same-session self-review, local "advisor" skill, or magic `Advisor pass: ...` ritual; self-review is not independent evidence (see `docs/agent-self-review.md`). User-correction phrases ("demonstrably false", "you missed", "didn't you", "you're wrong", "shouldn't have", "why would you") are an approach-change moment, not a small patch.

### Measure-vs-ask

MEA: **Measurable facts: measure.** Codebase size, build time, file count, dependency tree, test count, perf numbers, conf values, file contents.
Also the user's working pattern in repo artifacts: commit cadence, working hours, defect-recovery rate, concurrent-session evidence.

ADJ: Run the measurement yourself;
never a quantitative adjective ("small", "large", "fast", "slow", "simple", "complex", "short", "long", "sparse", "dense", "tractable", "trivial", "significant") without one.
Agent has the tools; using them is its job, not the user's.

ASK: **Non-measurable facts: ask.** Which of two valid approaches the user prefers, whether they want a feature, whether they authorize a destructive action, what they value (depth vs governance, speed vs clarity).

MA3: Three failure directions: asking what you could measure (lazy);
assuming what you should ask (confidently wrong);
asking permission for an already-authorized step ("want me to also check X?" when the user has been pushing for thoroughness).
Trigger phrases for the assumption form: "for a project like this...", "in a typical setup...".

### Present options with pros, cons, and a personal ranking

OPT: Proposing a choice between distinct options ("A, B, or C?"): give each option its own pros and cons plus a fully sorted personal ranking covering every option, with the reason deciding each adjacent pair.

- OPA: `AskUserQuestion`: each option's `description` holds its pros and cons; order options by preference (best first) and append "(Recommended)" to the top label; in the prose around the tool call, state the full ranking (e.g. "ranking: B > A > C") with the reason for each adjacent comparison.
- OPI: Inline prose: one short paragraph or bullet block per option with pros and cons, then a "Ranking: B > A > C, because ..." line explaining each step of the order, not just the top pick.

OP2: Skip when the user asked yes/no on a single proposal, or already narrowed criteria enough that one option is determined.

### Hedge phrases that signal a skipped step

HDG: Do not write these; do the step instead. Catch them before sending.

- HG1: "probably small/large/fast/slow", "the fix is probably small": run the measurement, or read the source path and drop the estimate
- HG2: "I think it's a...": verify or label a guess
- HG3: "the most likely cause is...": reproduce, or list candidates without ranking
- HG4: "for a small codebase like yours": run `tokei` first
- HG5: "better/worse than most/typical/average X", "the most likely X" / "the most common Y" as an unnamed-population ranking: name the comparison set or drop the comparative
- HG6: "almost certainly", "most likely X lives/is/exists in Y": fetch the named target instead of stating a probability about its contents
- HG7: "this is a tractable PR": drop "tractable" or build the fix
- HG8: "should be straightforward": drop "straightforward" or test the path
- HG9: "no public diagnosis exists" as a stopping point: drop, or clone the source (see "Third-party libraries")
- HGA: "an afternoon" or any duration estimate: drop unless you built a similar fix in this codebase before
- HGB: "the project doesn't use X" / "we don't use X" / "the codebase doesn't have X" cutting off a candidate: cite an `rg`/`find`/config read (AGENTS.md and tsconfig count) or drop the dismissal
- HGC: "X is already handled by Y" / "X is already covered by Y": pair with Y's config/source path and line confirming the overlap, or drop it
- HGD: "I don't know your specific X" / "I'd need data on your Y" / "this depends on your specific Z that I don't have" deferring on working history, defect rate, throughput, hours, or parallel sessions: `git log`, `gh issue list`, and file mtimes record these; measure before concluding

HUC: **Exception: genuine uncertainty.** When the honest answer is "I do not know, genuinely under-determined after investigation," state it: name what you investigated and what stays unresolved.
The target is hedging as a substitute for research, not honest reporting after it.
"I read X.ts:42 and the type is A or B depending on a runtime branch I cannot determine statically" is not a hedge.

### Exhaust evidence layers when assessing system usage

EVL: For "should we use X better?" / "are we taking advantage of X?", walk every layer before recommending; each can flip the conclusion.

1. EL1: **The tool itself**: usage volume, conf.
2. EL2: **Parallel systems**: where the same need is met outside the tool.
3. EL3: **Content of those parallel systems**: not just file count but what is inside.
4. EL4: **Inline annotations in code**: TODO/FIXME/HACK, deprecation markers, workaround comments. Zero signals discipline (but verify the search ran; see null-search rule); thousands signal debt.
5. EL5: **Suppressions and exceptions**: lint disables, type-error suppressions, skipped tests. Justified-with-rationale is healthy; bare suppressions are debt.
6. EL6: **Stated policies in code or conf**: comments declaring intent ("X is tracked via Y, not Z") that may or may not be followed in practice.

ELR: Report findings at each layer before the conclusion.
A recommendation after only checking layer 1 is a guess shaped by the surface you happened to look at.

### Follow document pointers

FDP: When a ToS, README, spec, or other source document references another where the substantive provisions live, fetch that document before drawing conclusions about its contents.
Hedging about a named, fetchable target is the failure mode;
cue: writing "likely contains," "almost certainly addresses," or "probably covers" about a document one tool call away.
The pointer is the research lead, not the stopping point.

### Before claiming inability

CAN: "I cannot read this file format" / "my tools do not support that operation" / "I can't render / preview / test the page in a browser" / "I can't run this in this environment" / "you'll need to do X yourself" are capability claims about the whole toolset, not Read or Bash alone.
Bash plus shell utilities compose with Read into more than any single tool.
Before refusing or handing off, try a bridge: convert the input to a format your tools accept, decompose into supported steps, pipe the file through a shell utility, or drive a real browser via `agent-browser` (opens local `file://` URLs, evals JS, screenshots, console errors).
The browser-claim form is especially sticky;
about to write any phrasing meaning "can't see / render / interact with a web page," reach for `agent-browser` first.

BRG: Manual actions usually have a bridge too: GUI clicks (`agent-browser` for web UIs, `xdotool`/`wtype`/`ydotool` for native UIs, a synthesised keyboard shortcut, or a backing HTTP/IPC endpoint), interactive auth (`expect`, or API tokens), hardware activation (almost always a CLI).

BR2: Refuse or hand off only after attempting a bridge and confirming no path exists.
State the bridges you tried;
an unconsidered refusal or handoff looks identical to a real obstacle.
The cue: about to write "you'll need to", "please open", or any phrasing meaning "can't see / render / interact with a web page", without naming the bridges you tried.

RXH: Same for research-exhaustion claims.
When a narrow search returns "no direct evidence for X" and X is a specific entity in a broader class, widen to the nearest comparable entities (sibling tools, peer platforms, projects solving the same problem) first.
Failure shape: "no precedent for Netlify" while LocalStack, MinIO, Dokku, and Coolify each give one-search-away evidence on the same question.
State what you searched and what comparable evidence you found;
an empty result on the narrowest query is not "no precedent."

RBK: Bridges genuinely fail and the user must execute: invoke the `runbook` skill when writing any manual-action document (it encodes the required sections and formatting rules).
Repo-wide handovers live in `docs/handover/<topic>.md`; package-specific handovers stay beside the code they document.
Canonical example: `packages-paused/desktop-daemon/editord/HANDOVER.chokidar-atomic-migration.md`.

### Name the verification step

NVS: Confident factual claims about the user's environment, an external tool, or src code must be paired inline with what backs them.
Cannot name what backs a claim? Downgrade to a labeled guess or do the verification.

### Treat search results as suspicious until you've verified the shape

SRS: Every search result carries two claims: the search ran correctly, and the lines shown are the matches.
Both fail silently, both directions: zero-match (invalid `--type`, wrong glob, `2>/dev/null` masking errors, stale dir, stdin mode) and non-zero-match (`head -N` truncation, denylist `-v` filters, `-l` hiding context, narrow `--type`, and `rg -r`/`--replace` rewriting matched substrings in the output: grep muscle-memory `rg -rn`/`-rln` parses as `--replace=n`/`--replace=ln`, not recursive, since ripgrep recurses by default).
Sanity-check (broader pattern, no cap, no negative filter) before claiming you've enumerated what's there.

### Git cleanup and worktree safety reviews

GCL: Reviewing a plan or change touching `git clean`, destructive git guards, worktree safety, or ignored-file cleanup: inspect ignored root artifacts before final findings.
Run:

```bash
find . -maxdepth 1 \( -name HEAD -o -name config -o -name hooks -o -name objects -o -name refs \) -print
git check-ignore --verbose HEAD config hooks objects refs
git clean --dry-run -d -X HEAD config hooks objects refs
```

GC2: Never rely on `git status`, `git ls-files --others --exclude-standard`, or `rg --files`;
those hide ignored files.
Any root sentinel exists: cleanup or an exact safe cleanup path is part of the design under review.

GCW: When the review touches `cli-git`'s linked-worktree guard, account for the baked-in tool-cache allowlist (`DEFAULT_ALLOWED_WORKTREE_DIRS` in `packages/cli/git/src/allowed-worktree-dirs.ts`): git-dirs under an allowed dir bypass the guard.

### Research tools

- RT1: `rg`: fast text search; use directly rather than navigating directory trees; `rg --files` to find files by glob
- RT2: `agent-browser`: headless browser CLI; rendered web pages, screenshots, web UI interaction, deployed-app verification
- RT3: `FetchUrl`: documentation sites, npm pages, GitHub READMEs; raw source still useful when docs are incomplete
- RT4: `gh`: GitHub issues, PRs, release notes, repository metadata
- RT6: Never remove cloned repos or other audit artifacts from `/tmp/agent`;
  the user will clean up when ready

## Before running a command

### Visible terminal spawning

VTS: Spawn something in another terminal, window, or session: use a real terminal launcher.
Arbitrary commands, including Codex: `terminal-exec -- <command> ...`.
`spawn-claude` only for Claude Code child sessions.
`spawn_agent` is not an OS terminal;
a PTY/TTY is not a visible terminal emulator window.
Never probe `terminal-exec` with `--help`;
read its README or src, since unknown options are ignored and it opens a terminal.

TMO: Never wrap routine verification commands in an external `timeout` binary.
Use the command tool's session/polling first;
a process truly remaining after producing useful output: inspect the PID, stop that stale process.
Reserve external timeout wrappers for commands whose behavior is being tested, or with a known unbounded runtime and no narrower kill mechanism.

RGP: Always pass an explicit path (`.` or absolute) to `rg` in the Bash tool.

CLN: Clone a package's git repo under `/tmp/agent/` whenever investigating src code.
Before first use, ensure the root exists with private permissions:
`mkdir --parents /tmp/agent; chmod 700 /tmp/agent`.
Use `gh repo clone <repo> /tmp/agent/<descriptive-name>-<date-or-random> -- --depth 1` instead of `git clone`
unless commit history is part of the investigation;
`gh` handles authentication and fork remotes automatically.
Auto-mode allows structured `read` tool access to existing non-secret files under `/tmp/agent`;
writes, bash commands, secret-looking paths, and symlink escapes still go through the guardrail.

### Long-form flags

LFF: Use long-form (`--flag`) options for CLI commands, not bundled or single-letter short flags.
Writing the long form forces knowing what it does, where short-flag muscle memory fails.

RGT: `rg` is the canonical trap: ripgrep recurses by default, so `-r` means `--replace`, not grep's recursive `-r`; a grep-reflex `rg -rl`/`-ir` silently rewrites matches in the output instead of recursing. Long form removes the trap.

LF2: Where a flag has no long-form spelling the short flag stays;
`--` argument separators (`mise watch -- task`) are unaffected.

### Bash output path collapse

BOP: Never treat `~` in Bash tool output as a literal tilde;
it is a display substitution for `/var/home/user` or `/home/user` by the `bash-output-filter` hook (display-only, filesystem values unchanged).
Account for it when debugging path issues, before concluding the path is wrong.
Skip the filter for one command: include a blocklist trigger: `eval`, `export`, `source`, `$(...)`, backticks, or `> file`.

### Physical-harm consideration

HRM: Before any action, consider whether it could physically harm a human (blasting audio volume, flashing content, unexpected hardware activation).
If so, warn the user and state what will happen before proceeding.

### Resource-exhaustion isolation

RXI: Always run commands that might crash or exhaust the host in a performance-limited container or VM, never directly on the host.
The "may exhaust the host" set is broader than the destructive-command set: heavy memory/process/file-descriptor allocation, unbounded loops, uncapped subprocess fan-outs, stress/benchmark/load runs.

ISO: Use `podman run --memory=2g --cpus=2 --rm --volume $PWD:/work --workdir /work <image>` for container isolation, or the `mvm` CLI for VM isolation.
State the bounds explicitly (memory cap, cpu cap, timeout).
User requests one directly: propose the containerised invocation and confirm.
Past authorisation does not transfer across commands;
each heavy run needs an isolated environment.

### Destructive command ban

DCB: Never execute or instruct another agent to execute extremely destructive commands, even as guardrail tests, e.g. `sudo rm -rf /`, `mkfs`, `dd of=/dev/sda`, fork bombs.
Guardrails can fail;
a catastrophic command must not appear in instructions to other agents, subshells, or generated scripts, whatever the intent.
Verifying a guardrail: use moderately dangerous commands (e.g. `sudo apt-get install`).

## Before editing code

### Match action scope to the request verb

VRB: Decision verbs ("decide", "evaluate", "assess", "review", "audit", "triage", "look at", "analyze", "investigate") request a deliberation.
The deliverable is the answer; don't also apply the fixes the answer implies.
Action verbs ("fix", "implement", "apply", "do", "change", "add", "remove", "update", "refactor") authorize the action.

AUT: This holds in Auto Mode: its "prefer action over planning" applies to executing the requested action, not expanding scope;
not authorization to act on adjacent decisions the user has not made.

VR2: Verb ambiguous: default to the narrower interpretation, propose the broader action explicitly.

### Act, don't annotate

ANN: Move changes where they belong immediately: different file, new file, gitignore entry.
Unsure: propose a concrete edit and location.

### Cross-runtime and scripts

- XRT: Prefer cross-runtime patterns instead of Bun-specific implementations.
- SCR: Never write bash/powershell scripts; use inline nushell or TypeScript files as `mise.<action>.ts`. Execute with Bun directly; top-level code and top-level await (no `main()` wrapper).
- PIN: Pin tool versions only with clear justification and a comment explaining why.
- SPG: Add explicit guards (transcript size check, env var flag, session type filter) to any automation that spawns agent sessions, to prevent recursive token burn.

### Simplification

- IMM: Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state and imperative loops.
- UTL: Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-async-time`) over manual promise creation.
- EXC: Extract and name concepts; start simple, refactor to complexity only when necessary.
- ITR: Iterate linear input with `map`/`filter`/`reduce` or `for...of`; a counter `for (let i = 0; ...)` loop for an index or lookahead; `while` for a side-effecting cursor. Never recurse over a string or flat array (including a regex you remove). Recurse only for bounded **structural** walks (AST, tree, grid, filesystem); flatten degenerate spines iteratively with a work-stack. Why and the spine trap: philosophy doc; `docs/audit/chain-flatten-skewed-tree.md`.
- MXL: Never disable, raise, bypass, or work around the max-lines limit. Remediate by splitting: re-export from `index.ts`; move helpers to siblings, constants to `constants.ts`, types to `types.ts`. Forbidden workarounds: compressing function arguments to one line, joining multi-line statements, removing TSDoc, removing `//region` markers, joining declarations. If you find yourself reformatting to reduce line count, stop; the fix lives in another file.
- MXR: Same max-lines budget on `.rs` files (`monochromatic-rust-linter`, `packages/linter/rust`, rule `max-lines`, 300 code lines, blanks/comments excluded). Run via each Rust package's `lint:max-lines` or root `lint:rust`. Remediate by splitting: sibling modules, re-export from parent `mod`, move helpers/types/constants. `tests/`, `*_tests.rs`, `fuzz/`, `build.rs` exempt; never disable or raise.

### Linting

- LN1: Never violate one rule to satisfy another. Lint rules form a single shape: code that satisfies all of them. When two rules appear to conflict, the remediation is structural (split, extract, rename), never reformatting one rule's surface to silence another. Signal you are violating-to-satisfy: about to undo something the autofix or AGENTS.md prescribed (e.g. compressing args back onto one line to fit max-lines).
- LN2: Treat each lint finding as a design signal, not a checkbox. Name the rule's real intent,
  then make the best code shape that satisfies that intent and the rest of the codebase.
  A shortcut taken for one warning is evidence about the care taken everywhere else.
- LN3: Before disabling, suppressing, weakening types, broadening annotations, or otherwise skirting a lint rule,
  inspect the linter source and the source code of the value being linted.
  Try the rule's config or allow-list mechanism first.
  If a suppression remains necessary, write or update a `.md` document that cites both source paths,
  proves why the allow-list or config path cannot work, and links the suppression to that document.
  Do not land the suppression without that document.
- LN4: Prefer `Object.entries` and functional methods over `for...in`.
- LN5: Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering the rules.
- LN6: Block-level `/* oxlint-disable rule */` must wrap tightly: `/* oxlint-disable rule */` -> `/** TSDoc */` -> declaration -> `/* oxlint-enable rule */` (disable **before** the TSDoc; enable on the **very next line** after the declaration or closing `);`/`}`, never at end-of-file). Do not use `// oxlint-disable-next-line` between the TSDoc and the declaration.
- LN7: Never loosen lint rules without prior approval.
- LN8: Address all lint issues, including but not limited to warnings.

### Logging

LOG: Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events.
Never remove logging to "clean up"; treat it as permanent infrastructure.

TLG: Always use tagged loggers from `@monochromatic-dev/module-logger`.
Never raw `console.log`/`console.error` or untagged logger instances in production code.
Exception: raw `console` when precise control over terminal output is needed (CLI user-facing messages, progress indicators, interactive prompts).

- LG1: Tag at every module and function boundary; use `myFn.name` as tag to stay in sync with refactors.
- LG2: Compose tags deeply: when calling a sub-function that accepts a logger, wrap the current logger with an additional tag before passing it.
- LG3: Never embed tags manually in message strings. Use the `tagged` wrapper instead.

### Security

SEC: No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

SYB: Any code that transforms or embeds text across a syntax boundary must treat the destination grammar as the authority.
Source escapes are not portable: Markdown `\<`, shell quotes, JSON escaping, URL encoding, or regex escaping do not make
text safe in another language. Normalize source semantics only as needed, then encode for the exact destination subcontext
at the final interpolation boundary. Account for nested contexts: HTML text vs attribute vs URL, JS string inside
`<script>`, CSS string, SQL literal, shell token, Markdown/MDX, JSON, regex, glob, terminal escape, and config syntax.

STB: Tests for any transformer that emits another syntax must include adversarial boundary cases for that destination:
active delimiters, terminators, escapes, quotes, newlines, traversal tokens, command separators, and source-escaped
variants.

### TSDoc comments

TSD: Write comprehensive TSDoc for **all** declarations (exported or not, including locals).
Adhere to the TSDoc rules enforced by `@monochromatic-dev/config-oxlint-tsdoc`.
Use `{@inheritDoc originalFn}` for non-async wrappers.

- TD1: Use `${ // comment \n '' }` to embed comments inside template literals; do not use target-language comments or move the comment outside the template.
- TD2: TSDoc (`/** */`) for declarations only; use `//` or `/* */` for statements, control flow, imports, returns.
- TD3: TSDoc must directly precede a declaration, not a statement.
- TD4: Comments on their own line above code, never inline after code.
- TD5: Escape `*/` as `*\\/` inside TSDoc blocks.
- TD6: Avoid `the`/`a`/`an` in `@param`/`@returns`; explain **why**, not **what**.
- TD7: Do not mention Promise wrapping for async functions.
- TD8: Include `@example` tags with usage examples.

### TypeScript

#### Standards

- TS1: Adhere to Oxlint, dprint confs.
- TS2: Use `//region`/`//endregion` markers with purpose and explanation for logical code sections.
- TS3: Cross-package workspace imports must resolve to TypeScript source, not built output.
- TS4: Include `.ts` extensions in imports; group: built-ins, external, workspace, relative, type-only.
- TS5: Prefer named imports, `import type` for type-only, absolute imports for workspace packages.
- TS6: Use `import ... with { type: 'text' }` for static assets (SVG, HTML, CSS, SQL) instead of `readFile`; Bun resolves these at build time with no async preload step needed.
- TS7: Use named function declarations exclusively: no arrow functions, no const-bound function expressions. Exception for callbacks whose signature is dictated by an external API or library: name the function and parenthesise all params.
- TS8: No calling functions before their declaration in source order; hoisting makes it legal but reading top-down becomes unreliable.
- TS9: Functions with 2+ parameters must use a single destructured object parameter (named params); exempt: callbacks whose signature is dictated by an external API or library.
- TSA: No rest parameters (`...args`) in functions we control; accept an array parameter instead.
- TSB: Export immediately at declaration; avoid `Object.assign` for extending typed objects.
- TSC: Throw and return early; use overloads (most specific first).
- TSE: No regex unless necessary.

#### Type system

- TY1: Explicit parameter and return types; `type` over `interface`; `Record` for maps.
- TY2: Avoid generic `Function` type; avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`.
- TY3: Union types over enums; `as const` for literals; branded types for domain primitives.
- TY4: Narrow symbol unions by `typeof` first, then identity check.
- TY5: `const` generic parameters; `readonly` array parameters; meaningful constraint names.
- TY6: Prefer `as` over angle bracket syntax; use type guards for runtime checking; avoid deep nesting in conditional types.
- TY7: Use assertion functions (`asserts value is T`) for runtime type narrowing.
- TY8: `const` narrowing does not reach **function declarations** (tsc and tsgo). Fix: a helper that returns non-null, or reassign to a new `const` with an explicit type annotation after the null check.
- TY9: Generator overloads: remove `*` (sync) or `async *` (async) from non-implementation signatures.

#### Variables and values

- VAL: `const` over `let`. Two hard rules enforce this:
  - VFR: `no-restricted-syntax/no-function-root-let` reports `let` at function-body root. Refactor to `const` (ternary, `Array.reduce`), a counter `for (let i = 0; ...)` loop (`ForStatement.init` `let` is exempt), a named-function IIFE `(function name () { let x; /* ... */ return x; })()`, or a helper ending in `return <local-binding>`. Never escape it by recursing over flat input (see "Simplification").
  - VMR: `no-restricted-syntax/no-module-root-let` reports `let` at module root, including `export let`. Replace with a `Map`/`WeakMap`/`Set`/`WeakSet` container, `memoize()` from `@monochromatic-dev/module-memoize`, or an IIFE-into-const initialization.
  - VLE: For legitimate exceptions (multi-statement state machines, parser cursors with side-effecting branches), add `oxlint-disable-next-line` with a justification comment naming the constraint.
- VA1: Remove unused variables or prefix with underscore (`_unusedVar`).
- VA2: No single-letter variables (exceptions: math formulas, and loop counters like `i` in a `for` statement).
- VA3: Functional approaches over loops; `for...of` when iteration is unavoidable.
- VA4: Avoid deprecated features (`substring()`/`slice()` over `substr()`).
- VA5: `satisfies` for type checking without widening; separate destructuring blocks for dependent values.
- VA6: Magic literals as named `const` (exception: `-2` through `2`); for fractional values, compose from exempt range: `HALF = 1 / 2`, `QUARTER = HALF / 2`, `THREE_QUARTERS = HALF + QUARTER`.

#### Programming patterns

- PP1: `async`/`await` only; no `.then()`/`.catch()`/`.finally()`; no explicit `new Promise`.
- PP2: `Promise.all()` for concurrent ops; `Promise.allSettled()` when all results needed; `AbortController` for cancellation.
- PP3: `using`/`await using` for cleanup; no `try...finally`.
- PP4: Custom error classes; throw over error codes/null/result types; `@throws` in TSDoc.
- PP5: `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator; `dedent` from `string-dedent` for multi-line error messages.
- PP6: Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes.
- PP7: Never `process.exit()`: throw errors instead; never silently swallow in catch blocks (rethrow or log the error).
- PP8: Never silently discard unexpected states; throw on unreachable branches.
- PP9: No `switch` statements: use if/else chains or `Record` lookups; if/else avoids `break` boilerplate and fallthrough bugs; `Record` is preferred when mapping a discriminant to a value.
- PPA: Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`.

#### Regular expressions

- RE1: Do not introduce a regular expression when an index scan, parser, or string API expresses the same rule clearly.
- RE2: A regex you remove must become a single linear pass (`for...of`/`for`/`reduce`, O(n) time, O(1) extra stack), never recursion over the text nor an accumulator rebuilding a string or array each step (`acc + c`, `[...acc, x]`). Do not assume the original regex was linear: a backtracking pattern can be superlinear, so prove O(n) for attacker-controlled or unbounded input. Why: philosophy doc.
- RE3: Regex literals, `RegExp` constructor calls, and string methods using regex must be guarded by a scoped `oxlint-disable-next-line no-restricted-syntax/no-regex -- ...` comment. The justification must explain why regex is the right tool, what input shape bounds it, and why it cannot backtrack or rescan unbounded prefixes/suffixes. If no useful justification exists, do not use regex.
- RE4: For hot paths or attacker-controlled input, prefer explicit parsers or index scans. If regex remains, cap the input or prove linear behaviour in the disable justification and regression tests.

## Before declaring work complete

### Package completeness

PKG: A package is not finished until it has a `README.md`, passes linting with zero errors, and has passing tests covering every exported code path.
Never declare work complete while any condition is unmet.

### Test coverage matches the public API surface

TCV: Enumerate every distinct code path the module exposes, not just the obvious happy path.
Implementation has separate branches (sync vs async, string vs object, direct vs delegated)? Each branch needs its own test.

TC2: "Tests exist and pass" is not evidence of completeness.
Compare test names against the implementation's branches; confirm no untested path.

### Verify at the user boundary

VUB: After building, deploying, or installing an artifact, run verification steps that exercise it the way an end user would.

- VB1: Server: confirm it serves correct responses, not just that it starts.
- VB2: CLI tool: run a real command and check the output.
- VB3: Hook/plugin: trigger it through the host application, not just by piping test input directly.
- VB4: Library: import and call it from a consuming project, not just compile it.
- VB5: Web page or standalone HTML artifact (including local `file://` docs and demos in `docs/`): load it with `agent-browser`, confirm no console errors, then exercise every interactive element (buttons, checkboxes, tabs) and read back the rendered state via `agent-browser eval`. "Markup balances," "JS parsed in bun," "I fetched the HTML" are prerequisites, not proof. If the task involved rewriting any JS handler, you must drive each rewritten code path through `agent-browser` before declaring done.

VB6: The verification must cross the integration boundary between artifact and consumer.
"It compiled" / "It installed" alone is not verification.

### Verify on a throwaway, not against real state

THR: Verification means a state-mutating or destructive operation: run it against a disposable fixture you create, never the user's real or shared state (working tree, real tool caches, a populated database, live conf).
Reproduce the real scenario: `mktemp -d` plus `git init` for a repo, a scratch dir, a throwaway branch/worktree, a container, a fresh sqlite file;
exercise the real artifact against it, delete it afterward.
Pairs with "Verify at the user boundary": real artifact, throwaway state.

TH2: The rule holds even when the command looks idempotent or you have committed first;
testing whether a guard blocks a destructive operation, build both the allowed case and the rejected case as fixtures.

TH3: Cue: about to run `reset --hard`, `clean -fd`, a migration, a bulk delete, an overwrite, or any other state-mutating command against the user's actual repo, cache, or data solely to observe how it behaves.
Create the throwaway target first.

### Test assumptions before encoding them

TAE: Writing instructions, conf, or documentation that prescribes how a tool or API behaves: test the claim first with a real invocation.
Never write "use X for Y" based on how X **should** work;
run X against a real target and confirm the output.
Applies to agent prompts, README guidance, CI scripts, and any artifact future sessions will follow.

## When investigating problems

### Third-party libraries

- TP1: Undefined method error: retrieve docs immediately.
- TP2: Check actual type definitions before using APIs.
- TP3: Note CLI command patterns across examples; test the simplest case first.
- TP4: Never modify files in cloned third-party repositories; use conf, env vars, or wrapper scripts. "Third-party" is decided by ownership, not origin: a fork under our own account (the git user's GitHub namespace) is our code, modify it freely (e.g. to prepare a pull request). The rule binds only clones of repos we do not own. A skill may carve a narrow documented exception; today only the `troubleshooting-doc` skill's disposable prototype clone (mechanics in the philosophy doc).
- TP5: When investigating an external tool's behavior, bug, capability, or fix difficulty, clone its src and read the relevant code path. "No public diagnosis exists" is never a valid stopping point when the source is open; quote file path, line number, and code excerpt when citing a finding.
- TP6: When proposing a package to replace a dependency, audit the candidate to the incumbent's depth: transitive deps, the src paths handling the cases the incumbent mishandles, build provenance for native/wasm modules, and maintenance signals. Report findings inline with the recommendation, not as trailing caveats.
- TP7: Finished diagnosing or working around an external tool's bug, quirk, or capability gap: write `docs/troubleshooting/<topic>.md` via the `troubleshooting-doc` skill before declaring done; it gates a draft upstream issue on a 6-constraint check.
- TP8: Check `.out-of-scope/` before filing an upstream tracking issue; listed exemptions still get the `docs/troubleshooting/<topic>.md` writeup but skip the GitHub issue.

## When committing or documenting

### Documentation standards

#### Prose style

- PS1: No emojis in human-readable content.
- PS2: No em-dashes (`—`), en-dashes (`–`), or their ASCII substitutes (`-`, `--`) when used in prose as em-dashes; all such uses are informal. Use paired commas or parentheses for asides, colon for elaboration or lists, semicolon for linked independent clauses, period for abrupt breaks. Use "to" for ranges. Hyphens remain fine in compound words ("user-facing"), and `--` remains fine in CLI flags (`--watch`); the ban applies only to em-dash use.
- PS3: Sentence case for headings; **bold** for inline emphasis only (not ALL CAPS). Never use bold as a standalone title; use the appropriate ATX header level instead.
- PS4: Active voice without collective pronouns; state facts directly; avoid meta-references to the project's own philosophy.
- PS5: Present tense for current state, future tense only for planned features.
- PS6: Eliminate unnecessary connecting phrases.

#### Markdown syntax

- MD1: Break lines at semantic boundaries so text reads naturally without editor wrapping; no italics.
- MD2: `-` for unordered lists; pad numbered markers to 4 chars (`1.`, `10.`).
- MD3: Fenced code blocks with language tags; include file paths as comments.
- MD4: Reference-style links for repeated URLs; relative links for internal docs.
- MD5: No tables; use headings or lists instead.
- MD6: ATX headers, max 4 levels, blank line before headers, lines under 120 chars.

### Doc placement

DPL: Repo-wide docs live under `docs/<family>/`, one directory per dotted-prefix family (`docs/troubleshooting/`, `docs/philosophy/`, `docs/todo/`, `docs/handover/`, etc.).
The repo root keeps only `README.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSES/`, and already-tidy doc subdirectories like `.out-of-scope/`; the flat dotted-prefix families move under `docs/`.
Package-specific docs stay beside the code they document; this rule governs root-level families, not a package's own `README.md`, `TODO.md`, or `HANDOVER.*.md`.

1. DP1: Naming: a `PREFIX.rest.md` file becomes `docs/<prefix-lowercased>/<rest-lowercased>.md`, dropping the now-redundant prefix; a second dotted segment stays flat in the filename (`TODO.performance.build.md` becomes `docs/todo/performance.build.md`), not a deeper directory. Use kebab-case for multi-word topics.
2. DP2: Hubs: a bare `PREFIX.md` index becomes `docs/<family>/README.md`, keeping its curated prose.
3. DP3: Bug reports fold into the most relevant `docs/troubleshooting/<topic>.md` as a section rather than getting their own family.
4. DP4: Delete verifiably-finished docs once their work lands; git history is the backstop, so removal is not destructive. Read each before deleting.
5. DP5: Reference source files by repo-relative path, not a pinned GitHub blob URL; a blob URL also breaks when the target moves.

DP6: No automated check guards root regression; this rule is the cure.

### Handling external changes

- EC1: External worktree changes are normal and often expected in this repo. Treat `git status` entries you did not modify as concurrent work, not an emergency.
- EC2: Never run `git restore`, `git stash`, cleanup, or other move-aside commands on unrelated external changes. Only touch files in your task scope; an unrelated external change blocks a necessary edit, ask before changing it.
- EC3: Acknowledge externally modified files; ask before reverting.
- EC4: Never proceed with implementing features that will not achieve their intended effect.
- EC5: Explain when a tool/command does not support requested functionality instead of creating non-functional code.

### Git commit guidelines

GIT: Conventional Commits format: `<type>(<scope>): <subject>`.

GCE: Commit at the earliest opportunity that records coherent progress, before the next work step.
Never wait for full verification when a feature or fix has just been implemented;
commit the checkpoint, then keep testing and fixing in follow-up commits.
The cue:
"I just finished implementing a feature or fix.
Not sure it works yet, but committing now records progress."
Never accumulate independent units in the working tree;
it forces a sprawling mixed-concern commit or an error-prone split.
The trigger is "I just finished a thing that stands on its own," not "the user told me to commit" or
"I am done with the whole task."
When committing, include all changes belonging to the same logical unit together unless instructed otherwise;
never subdivide a logical unit across commits, and never sweep in unrelated or concurrent external changes (stage an explicit, scoped pathspec; see "Respect cli-git enforcement guards").
This supersedes the harness default to ask before committing;
on this project, commit eagerly without asking.

GCT: Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope: package name or `*` for multi-package changes.

GCG: Group related changes by type; be specific about what changed. Two lines per group. Example:

```txt
fix(package1): <what>

<why>

fix(package2): <what>

<why>
```

GCA: If a commit message is inaccurate after committing, do not amend (harness rule).
Surface it, ask the user to push, then post a commit comment: it renders alongside the commit on GitHub and survives history rewrites.
Do not silently let it stand;
future readers see only the message.
The cue: about to write "the commit message overstates scope" or similar in chat as a one-off note instead of recording it where the commit lives.

### Respect cli-git enforcement guards

CLG: Never preemptively bypass `cli-git` enforcement.
The `git add` and `git commit` guards reject bulk staging (`-A`, `.`) and pathspec-less commits on purpose: with a dirty tree or concurrent sessions they sweep unintended files into a commit.
Not obstacles to route around; the compliant path satisfies them.
Stage and commit an explicit, package-scoped pathspec (`git add <path>`; `git commit <path> -m ...`), which also keeps each commit to one logical unit and cannot capture another session's files.
Reach for `--no-enforce-bulk-add` or `--no-enforce-only` only when no scoped pathspec can express the change (a genuine whole-tree single-session operation), never as the default, never baked into instructions to child sessions.
Cue: about to type `--no-enforce`, `git add -A`, or `git add .` before trying a scoped pathspec, or hand a child a commit recipe carrying a bypass flag.

### External communications

XCM: Never append work-inviting offers to external communications: PR descriptions and review replies, issue and commit comments, emails, anything a maintainer or third party reads.
Trailing lines like "happy to also...", "want me to...", "say the word", "I can switch to X if you prefer", or "let me know and I'll..." push a decision or a follow-up task onto the reader, usually the user.
Decide the matter yourself, state what you did; the message reports a result, not a menu.
A genuine choice only the user can make: raise it with the user directly (AskUserQuestion) before sending the external message, don't punt it into the external text where it silently obliges them to respond.
This does not forbid a single necessary question the external thread actually requires (a real blocker the recipient alone can unblock); it forbids the reflexive optional offer tacked on at the end.
Cue: about to end an external message with "happy to", "want me to", "if you'd prefer", "say the word", or a question to the reader you appended rather than were asked for.
Cut it.

### Dependency management

- DM1: Use `workspace:*` for internal dependencies.
- DM2: Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`.

### Adding new packages

1. AP1: Create directory under the appropriate category in `packages/`.
2. AP2: Add `mise.toml` with task definitions mirroring sibling packages.
3. AP3: Configure `package.json` with workspace dependencies.
4. AP4: For CLI packages with a `bin` entry, add `#!/usr/bin/env bun` shebang as the first line of the entry point; without it, Unix falls back to `/bin/sh` and the script hangs or errors.
5. AP5: For packages with client-side bundling, add `tsdown.client.config.ts` extending `@monochromatic-dev/config-tsdown/.client.ts`, a `build:js:client` mise task, and `@monochromatic-dev/config-tsdown` as a devDependency.

### Essential commands

- CM1: Identify the target package and task before running tests; never reflexively use repo-root `mise run test` for narrow package work.
- CM2: Mise task `run` commands use nushell, not bash. Chain sequentially with `;` (`mise run foo; mise run bar`), not `&&`.
- CM3: All builds and tasks use `mise run`. Never run `pnpm exec` or direct package scripts. Never invoke raw tools (`tsc`, `tsdown`, `bun test`, `oxlint`, etc.) directly; use the corresponding mise task. When no suitable task exists, add one to the target package's `mise.toml` first, unless a rule below carves out a direct call (e.g. running a test file with `bun <file>`).
- CM4: Never substitute `bun test` for a missing mise task; it misreports under the `@monochromatic-dev/module-test` harness. Use `mise run //packages/<path>:test:unit`, or run the file directly with `bun <file>` if no task exists.
- CM5: Read `mise.toml` files in root and package directories for available commands. Run a task in a specific package with `mise run //packages/path:task` (not `mise run --cd`).
- CM6: Run `mise run //packages/<path>:lint:types` manually after editing TypeScript; no automated type-check yet.
- CM7: `mise watch --restart` takes a bare task name, not a `mise run` invocation. Write `mise watch --watch src --restart -- start:server`, not `mise watch --watch src --restart -- mise run start:server`. When a dev task needs watch-restart, split the inner command into its own task (e.g. `start:server`) so `mise watch --restart` can reference it by name.
- CM8: After modifying source in packages that produce dist output, verify with `mise run buildAndTest`, not tests alone: tests import from the built dist, so a stale build causes false failures. Specific test file after building: `mise run buildAndTest -- path/to/file.test.ts`.

### Workspace conventions

- WC1: Use the current date from the system prompt environment.
- WC2: Some root-level files (e.g. `CLAUDE.md`) are generated by file-enforcer. Before editing any root config file, check `file-enforcer.config.ts` for managed-output status; if so, edit the source and run file-enforcer.
- WC3: Spec mode (a.k.a. plan/pause mode): keep researching and gathering context until the user explicitly asks to draft or exit.

## Architecture decisions

- AD1: Root `package.json` may depend on workspace packages; root configs import by package name.
- AD2: Switch from config-as-data to TypeScript when conf needs logic (`if`, `map`, `await`).
- AD3: Direct async execution over descriptor/interpreter patterns; apply YAGNI to architecture.
- AD4: Nested calls (`b(a())`) over method chaining to keep functions self-contained;
  split a chain of more than two nested calls across lines instead of stacking close-parens (`)))`) on one line.

## Agent skills

- AS1: **Issue tracker**: GitHub Issues via `gh` CLI. "Resolve issue N" requires explicit `gh issue close` after the fix commits; commit-body `Closes #N` auto-close is not sufficient. See `docs/agents/issue-tracker.md`.
- AS2: **Triage labels**: five canonical roles with default label strings. See `docs/agents/triage-labels.md`.
- AS3: **Domain docs**: no context files; agents read fresh code on every probe. See `docs/agents/domain.md`.

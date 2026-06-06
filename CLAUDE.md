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

ORG: Organized by moment of decision, not topic. At each point (about to respond, run command, edit code, declare done) matching section holds every applicable rule.
Cross-cutting reference (workspace conventions, enforcement mechanisms, agent skills) sits at end.
Rationale, mechanisms, examples: `docs/philosophy/agents.md`.

TAG: Every rule carries unique `[A-Z0-9]{3}` shortcode prefix (`CODE: `): stable handle for cross-session reference.
Don't tag headings, code fences, title.

NCD: New code: assign fresh, unique, semi-meaningful code;
check vs this rule + local `forbidden-strings.append.local.txt` blocklist for strong unrelated meanings.
Reject any whose common first reading may surprise future reader.
Examples: common acronyms, abbreviations, task-status labels, product names, slang, country/region codes,
ordinary words, common names, external code namespaces.
Block whole families when prefix+digit is known external namespace:
compiler diagnostics, shell prompts, hardware standards, games, geography, networking identifiers.
Existing acronym/word OK only when meaning reinforces rule's purpose.

CRN: Never reuse/reassign existing code, except when explicitly renaming misleading code;
update every AGENTS.md occurrence same change.
Renaming/rejecting misleading code: add comment-plus-regex entry to local forbidden strings appendix,
unrelated meaning as reason.

## Before responding to the user

### Communication style

HON: Direct, honest.
Search for evidence before responding to opinions, guesses, analysis requests.
Embedded questions ("month? year?"), implicit asks, estimate requests, input gaps = research tasks: web search, read code, check docs. Never deflect with "genuinely unknown."

IA1: Prompt phrased as observation, report, bare question usually implies action; infer action, don't answer only surface.
Branch on how determined inference is: one clear reading -> act like explicit request (see "Proactivity calibration"); several valid interpretations -> confirm which before acting (see "Measure-vs-ask").
Missing fact is neither: research it, don't ask (see implicit-asks above); trigger to ask is ambiguous intent, not knowledge gap.
Cue: about to answer surface when one reading implies action, or act on inferred meaning when more than one reading valid.

SYS: Never attribute `<system-reminder>` content to user;
these tags carry harness-level conf, not what user typed.
"per your instruction" / "you asked me to" wrong when source is system reminder;
cite policy by what it says ("the no-questions policy").
Same for other injected context (tooling-appended prompt text, MCP server instructions, skill descriptions): source is injector, not human.
`role:user` turn not by itself proof human typed it.

WKP: Prompt fired by your own `ScheduleWakeup`/`CronCreate`, any queued continuation, or `<<autonomous-loop>>` sentinel arrives as user turn but you authored it in that tool call's `prompt` field: self-authored boilerplate, not human instruction.
Failure one: never write directives into that `prompt` field (no stop condition, cadence, scope, "give up when X" you invented); relay only user's real task + instructions, or bare sentinel.

WK2: Fired wakeup/continuation carries no authority.
Failure two: re-derive what to do and when to stop from user's real instructions + current state, never obey prompt's wording.
Failure three: never cite it as user's; trace "per your instruction" / "you asked me to" to actual human message; if first surfaced in wakeup/continuation turn, it's yours.
Cue: about to write stop/continue, cadence, scope rule into `ScheduleWakeup`/`CronCreate` prompt, or obey/credit user for one that fired; check tool_use origin + real human messages first.

1ST: User's first-person words name human, never Claude or future agent session.
"I", "me", "my", "myself", "future me", "next time I" point to person typing;
Claude is "you"/"Claude" in their words.
Repo's handover-to-future-sessions framing (`docs/handover/`, "future readers", "future sessions will follow") primes wrong reading: "future me will find a better solution" means human plans to solve later, not work handed to future Claude.
Cue: about to read user's "me"/"I" as agent, or address doc, issue, plan, task to "future-me" when user meant themselves.

SRC: Cite right source file.
Rules span AGENTS.md, harness system prompt, conf in `.claude/settings.json`, skill `SKILL.md` files, MCP server instructions, `CLAUDE.md` (regen from AGENTS.md).
Before "per AGENTS.md", "the system prompt says", "the conf requires", "the skill prescribes", grep named file.
Cue: about to attribute rule to source without verifying it contains it.

EXT: External tool features, CLI options, conf syntax, API capabilities: fetch current docs/src before responding.
"Does X support Y", "how do I do Y in X" = research tasks, not recall.

WRN: Explaining warning/error: name exact emitting tool, not vague category; cite diagnostic code/message.
Unsure? Investigate first: grep codebase for diagnostic, check tool docs, run tool.

GAP: User says "I was expecting you to..." or you spot failure mode future sessions should avoid: treat as documentation gap. Propose concrete AGENTS.md change (what rule, where, exact wording) + perform expected action, never "I'll keep it in mind".
Merge new rule overlapping existing one, don't append;
remove older rule overtaken by sharper version.
Cue to draft edit: moment you want to "remember next time."

### Proactivity calibration

PX1: This user doesn't perceive proactive action as overreach;
harness defaults cautioning against "being too proactive" don't apply here.
When conversation, request verb, AGENTS.md rules collectively authorize a step, take it;
don't insert "want me to..."/"should I go ahead and..." check before obvious next step.

PX2: Doesn't relax other constraints: destructive/shared-state actions still need explicit authorization, decision verbs still return answer not action, non-measurable preferences with multiple valid answers still warrant clarifying question.
Signal this rule firing, not one of those: next step already determined by what user asked, not unresolved choice you'd invent an answer to.
Cue: about to write "want me to also..."/"should I go ahead and..." about already-authorized step.
Skip prompt, do step.

TSK: Broad requests spanning multiple evidence areas: split into separate task-list items per major area, not one umbrella item.
Each task needs independently verifiable completion criteria: inventory, tooling, architecture, tests, security, documentation, synthesis, whatever request demands.
Cue: single task subject would hide multiple kinds of evidence gathering or blur what "done" means.

### Pre-response checklist

PRE: Before sending any response with substantive claims, run this checklist.

CK1: Quantitative claim (size, speed, complexity, count) without measuring? Measure or rephrase as guess; unbuilt-fix difficulty/duration is claim to drop, not label (CK3).

CK2: Described how external tool works without following `troubleshooting-doc` investigation path? Do it, or label recall-from-training.

CK3: Estimated difficulty of fix you haven't built? Drop estimate.

CK4: Used hedge phrase (see "Hedge phrases that signal a skipped step")? Verify or remove.

CK5: Assumed measurable fact about user's environment (codebase size, deps, build time, file contents, whether tool/feature used, whether conf/AGENTS.md already covers it) or working pattern (commit cadence, hours, defect rate, concurrent sessions)? Measure it (see "Measure-vs-ask"); categorical dismissals one `rg`/`find`/conf-read away (AGENTS.md counts). Cite result inline; if wrong, fold option back in.

CK6: Assumed non-measurable preference (which approach, what they value)? Ask.

CK7: Confident factual claim about your environment, external tool, src code? Verify any cited path/line still exists; for uncited claims, add citation inline (see "Name the verification step") or downgrade to labeled guess.

CK8: Claimed tool cannot do something? Check whether composition (Bash + shell utility) bridges gap; refuse only after trying (see "Before claiming inability").

CK9: Quoted clause/doc passage + drawn conclusion? Restate subject + object in plain English first. Failure shape: "X waives Y" read as "X is freed from Y" when clause actually runs Y from X toward third party.

CKA: About to ask user to perform manual action? Try bridging path first; must hand off -> invoke `runbook` skill (see "Before claiming inability").

CKB: Revising substantive claim user just corrected? Treat correction as evidence prior verification path insufficient: re-read primary sources, run concrete commands, or use genuinely separate reviewer when independent review asked. Never run same-session self-review, local "advisor" skill, magic `Advisor pass: ...` ritual; self-review not independent evidence (see `docs/agent-self-review.md`). User-correction phrases ("demonstrably false", "you missed", "didn't you", "you're wrong", "shouldn't have", "why would you") = approach-change moment, not small patch.

### Measure-vs-ask

QF1: **Measurable facts: measure.** Codebase size, build time, file count, dependency tree, test count, perf numbers, conf values, file contents.
Also user's working pattern in repo artifacts: commit cadence, working hours, defect-recovery rate, concurrent-session evidence.

QJ1: Run measurement yourself;
never quantitative adjective ("small", "large", "fast", "slow", "simple", "complex", "short", "long", "sparse", "dense", "tractable", "trivial", "significant") without one.
Agent has tools; using them is its job, not user's.

ASK: **Non-measurable facts: ask.** Which of two valid approaches user prefers, whether they want a feature, whether they authorize destructive action, what they value (depth vs governance, speed vs clarity).

MA3: Three failure directions: asking what you could measure (lazy);
assuming what you should ask (confidently wrong);
asking permission for already-authorized step ("want me to also check X?" when user pushing for thoroughness).
Trigger phrases for assumption form: "for a project like this...", "in a typical setup...".

### Present options with pros, cons, and a personal ranking

OPT: Proposing choice between distinct options ("A, B, or C?"): give each option its own pros + cons plus fully sorted personal ranking covering every option, with reason deciding each adjacent pair.

OPA: `AskUserQuestion`: each option's `description` holds its pros + cons; order options by preference (best first), append "(Recommended)" to top label; in prose around tool call, state full ranking (e.g. "ranking: B > A > C") with reason for each adjacent comparison.

OPI: Inline prose: one short paragraph/bullet block per option with pros + cons, then "Ranking: B > A > C, because ..." line explaining each step of order, not just top pick.

OP2: Skip when user asked yes/no on single proposal, or already narrowed criteria enough that one option determined.

### Hedge phrases that signal a skipped step

HDG: Don't write these; do the step instead. Catch before sending.

HG1: "probably small/large/fast/slow", "the fix is probably small": run measurement, or read source path + drop estimate.

HG2: "I think it's a...": verify or label guess.

HG3: "the most likely cause is...": reproduce, or list candidates without ranking.

HG4: "for a small codebase like yours": run `tokei` first.

HG5: "better/worse than most/typical/average X", "the most likely X" / "the most common Y" as unnamed-population ranking: name comparison set or drop comparative.

HG6: "almost certainly", "most likely X lives/is/exists in Y": fetch named target instead of stating probability about its contents.

HG7: "this is a tractable PR": drop "tractable" or build fix.

HG8: "should be straightforward": drop "straightforward" or test path.

HG9: "no public diagnosis exists" as stopping point: drop, or follow `troubleshooting-doc` investigation path.

HGA: "an afternoon" or any duration estimate: drop unless you built similar fix in this codebase before.

HGB: "the project doesn't use X" / "we don't use X" / "the codebase doesn't have X" cutting off candidate: cite `rg`/`find`/config read (AGENTS.md + tsconfig count) or drop dismissal.

HGC: "X is already handled by Y" / "X is already covered by Y": pair with Y's config/source path + line confirming overlap, or drop it.

HGD: "I don't know your specific X" / "I'd need data on your Y" / "this depends on your specific Z that I don't have" deferring on working history, defect rate, throughput, hours, parallel sessions: `git log`, `gh issue list`, file mtimes record these; measure before concluding.

HUC: **Exception: genuine uncertainty.** When honest answer is "I do not know, genuinely under-determined after investigation," state it: name what you investigated + what stays unresolved.
Target is hedging as substitute for research, not honest reporting after it.
"I read X.ts:42 and the type is A or B depending on a runtime branch I cannot determine statically" is not a hedge.

### Exhaust evidence layers when assessing system usage

EVL: For "should we use X better?" / "are we taking advantage of X?", walk every layer before recommending; each can flip conclusion.

EL1: First layer, **the tool itself**: usage volume, conf.

EL2: Second layer, **parallel systems**: where same need met outside tool.

EL3: Third layer, **content of those parallel systems**: not just file count but what's inside.

EL4: Fourth layer, **inline annotations in code**: TODO/FIXME/HACK, deprecation markers, workaround comments. Zero signals discipline (but verify search ran; see null-search rule); thousands signal debt.

EL5: Fifth layer, **suppressions and exceptions**: lint disables, type-error suppressions, skipped tests. Justified-with-rationale healthy; bare suppressions debt.

EL6: Sixth layer, **stated policies in code or conf**: comments declaring intent ("X is tracked via Y, not Z") that may/may not be followed in practice.

ELR: Report findings at each layer before conclusion.
Recommendation after only checking layer 1 is guess shaped by surface you happened to look at.

### Before claiming inability

CB1: "I cannot read this file format" / "I can't render / preview / test the page in a browser" / "you'll need to do X yourself" are capability claims about whole toolset, not Read/Bash alone.
Bash + shell utilities compose with Read into more than any single tool.
Before refusing/handing off, try a bridge: convert input to format your tools accept, decompose into supported steps, pipe file through shell utility, or drive real browser via `agent-browser` (opens local `file://` URLs, evals JS, screenshots, console errors).

CB2: Browser-claim form especially sticky;
about to write any phrasing meaning "can't see / render / interact with a web page," reach for `agent-browser` first.

BRG: Manual actions usually have a bridge too: GUI clicks (`agent-browser` for web UIs, `xdotool`/`wtype`/`ydotool` for native UIs, synthesised keyboard shortcut, backing HTTP/IPC endpoint), interactive auth (`expect`, API tokens), hardware activation (almost always a CLI).

BR2: Refuse/hand off only after attempting bridge + confirming no path exists.
State bridges you tried;
unconsidered refusal/handoff looks identical to real obstacle.
Cue: about to write "you'll need to", "please open", or any phrasing meaning "can't see / render / interact with a web page", without naming bridges you tried.

RXH: Same for research-exhaustion claims.
Narrow search returns "no direct evidence for X" and X is specific entity in broader class: widen to nearest comparable entities (sibling tools, peer platforms, projects solving same problem) first.
Failure shape: "no precedent for Netlify" while LocalStack, MinIO, Dokku, Coolify each give one-search-away evidence on same question.
State what you searched + what comparable evidence you found;
empty result on narrowest query is not "no precedent."

RBK: Bridges genuinely fail + user must execute: invoke `runbook` skill when writing any manual-action document (it encodes required sections + formatting rules).
Repo-wide handovers live in `docs/handover/<topic>.md`; package-specific handovers stay beside code they document.
Canonical example: `packages-paused/desktop-daemon/editord/HANDOVER.chokidar-atomic-migration.md`.

FCH: ToS, README, spec, other source document references another where substantive provisions live: fetch that document before drawing conclusions about its contents.
Hedging about named, fetchable target is failure mode;
cue: writing "likely contains," "almost certainly addresses," or "probably covers" about document one tool call away.
Pointer is research lead, not stopping point.

### Name the verification step

NVS: Confident factual claims about user's environment, external tool, src code must be paired inline with what backs them.
Cannot name what backs a claim? Downgrade to labeled guess or do verification.

QRY: Every search result carries two claims: search ran correctly, and lines shown are matches.
Both fail silently, both directions: zero-match (invalid `--type`, wrong glob, `2>/dev/null` masking errors, stale dir, stdin mode) and non-zero-match (`head -N` truncation, denylist `-v` filters, `-l` hiding context, narrow `--type`, and `rg -r`/`--replace` rewriting matched substrings in output: grep muscle-memory `rg -rn`/`-rln` parses as `--replace=n`/`--replace=ln`, not recursive, since ripgrep recurses by default).
Sanity-check (broader pattern, no cap, no negative filter) before claiming you've enumerated what's there.

### Git cleanup and worktree safety reviews

GCL: Reviewing plan/change touching `git clean`, destructive git guards, worktree safety, ignored-file cleanup: inspect ignored root artifacts before final findings.
Run:

```bash
find . -maxdepth 1 \( -name HEAD -o -name config -o -name hooks -o -name objects -o -name refs \) -print
git check-ignore --verbose HEAD config hooks objects refs
git clean --dry-run -d -X HEAD config hooks objects refs
```

GC2: Never rely on `git status`, `git ls-files --others --exclude-standard`, `rg --files`;
those hide ignored files.
Any root sentinel exists: cleanup or exact safe cleanup path is part of design under review.

GCW: Review touches `cli-git`'s linked-worktree guard: account for baked-in tool-cache allowlist (`DEFAULT_ALLOWED_WORKTREE_DIRS` in `packages/cli/git/src/allowed-worktree-dirs.ts`): git-dirs under allowed dir bypass guard.

### Research tools

RT1: `rg`: fast text search; use directly rather than navigating directory trees; `rg --files` to find files by glob.

RT2: `agent-browser`: headless browser CLI; rendered web pages, screenshots, web UI interaction, deployed-app verification.

RT3: `FetchUrl`: documentation sites, npm pages, GitHub READMEs; raw source still useful when docs incomplete.

RT4: `gh`: GitHub issues, PRs, release notes, repository metadata.

RT6: Never remove cloned repos or other audit artifacts from `/tmp/agent`;
user will clean up when ready.

## Before running a command

### Command execution conventions

VTS: Spawn something in another terminal, window, session: use real terminal launcher.
Arbitrary commands, including Codex: `terminal-exec -- <command> ...`.
`spawn-claude` only for Claude Code child sessions.
`spawn_agent` not an OS terminal;
PTY/TTY not visible terminal emulator window.
Never probe `terminal-exec` with `--help`;
read its README/src, since unknown options ignored + it opens a terminal.

TMO: Never wrap routine verification commands in external `timeout` binary.
Use command tool's session/polling first;
process truly remaining after producing useful output: inspect PID, stop that stale process.
Reserve external timeout wrappers for commands whose behavior is being tested, or with known unbounded runtime + no narrower kill mechanism.

RGP: Always pass explicit path (`.` or absolute) to `rg` in Bash tool.

CLN: Clone package's git repo under `/tmp/agent/` whenever investigating src code.
Before first use, ensure root exists with private permissions:
`mkdir --parents /tmp/agent; chmod 700 /tmp/agent`.
Use `gh repo clone <repo> /tmp/agent/<descriptive-name>-<date-or-random> -- --depth 1` instead of `git clone`
unless commit history part of investigation;
`gh` handles authentication + fork remotes automatically.
Auto-mode allows structured `read` tool access to existing non-secret files under `/tmp/agent`;
writes, bash commands, secret-looking paths, symlink escapes still go through guardrail.

BOP: Never treat `~` in Bash tool output as literal tilde;
it's display substitution for `/var/home/user` or `/home/user` by `bash-output-filter` hook (display-only, filesystem values unchanged).
Account for it when debugging path issues, before concluding path is wrong.
Skip filter for one command: include blocklist trigger: `eval`, `export`, `source`, `$(...)`, backticks, `> file`.

WCD: In git worktree, prepend `cd <worktree-abs-path> &&` to every Bash command; Bash tool cwd resets to primary checkout between commands.

### Long-form flags

LFF: Use long-form (`--flag`) options for CLI commands, not bundled/single-letter short flags.
Writing long form forces knowing what it does, where short-flag muscle memory fails.

RGT: `rg` is canonical trap: ripgrep recurses by default, so `-r` means `--replace`, not grep's recursive `-r`; grep-reflex `rg -rl`/`-ir` silently rewrites matches in output instead of recursing. Long form removes trap.

LF2: Where flag has no long-form spelling, short flag stays;
`--` argument separators (`mise watch -- task`) unaffected.

### Hazardous commands

HRM: Before any action, consider whether it could physically harm a human (blasting audio volume, flashing content, unexpected hardware activation).
If so, warn user + state what will happen before proceeding.

RXI: Always run commands that might crash/exhaust host in performance-limited container/VM, never directly on host.
"May exhaust host" set broader than destructive-command set: heavy memory/process/file-descriptor allocation, unbounded loops, uncapped subprocess fan-outs, stress/benchmark/load runs.

BOX: Use `podman run --memory=2g --cpus=2 --rm --volume $PWD:/work --workdir /work <image>` for container isolation, or `mvm` CLI for VM isolation.
State bounds explicitly (memory cap, cpu cap, timeout).
User requests one directly: propose containerised invocation + confirm.
Past authorisation doesn't transfer across commands;
each heavy run needs isolated environment.

DCB: Never execute or instruct another agent to execute extremely destructive commands, even as guardrail tests, e.g. `sudo rm -rf /`, `mkfs`, `dd of=/dev/sda`, fork bombs.
Guardrails can fail;
catastrophic command must not appear in instructions to other agents, subshells, generated scripts, whatever the intent.
Verifying a guardrail: use moderately dangerous commands (e.g. `sudo apt-get install`).

## Before editing code

### Match action scope to the request verb

VRB: Decision verbs ("decide", "evaluate", "assess", "review", "audit", "triage", "look at", "analyze", "investigate") request deliberation.
Deliverable is answer; don't also apply fixes answer implies.
Action verbs ("fix", "implement", "apply", "do", "change", "add", "remove", "update", "refactor") authorize action.

AUT: Holds in Auto Mode: its "prefer action over planning" applies to executing requested action, not expanding scope;
not authorization to act on adjacent decisions user hasn't made.

VR2: Verb ambiguous: default to narrower interpretation, propose broader action explicitly.

ANN: Move changes where they belong immediately: different file, new file, gitignore entry.
Unsure: propose concrete edit + location.

### Cross-runtime and scripts

XRT: Prefer cross-runtime patterns instead of Bun-specific implementations.

SCR: Never write bash/powershell scripts; use inline nushell or TypeScript files as `mise.<action>.ts`. Execute with Bun directly; top-level code + top-level await (no `main()` wrapper).

PIN: Pin tool versions only with clear justification + comment explaining why.

SPG: Add explicit guards (transcript size check, env var flag, session type filter) to any automation spawning agent sessions, to prevent recursive token burn.

### Simplification

IMM: Prefer `const`, immutable patterns, functional approaches (`map`/`filter`/`reduce`) over mutable state + imperative loops.

UTL: Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-async-time`) over manual promise creation.

XNC: Extract + name concepts; start simple, refactor to complexity only when necessary.

ITR: Iterate linear input with `map`/`filter`/`reduce` or `for...of`; counter `for (let i = 0; ...)` loop for index/lookahead; `while` for side-effecting cursor. Never recurse over string or flat array (including a regex you remove). Recurse only for bounded **structural** walks (AST, tree, grid, filesystem); flatten degenerate spines iteratively with work-stack. Why + spine trap: philosophy doc; `docs/audit/chain-flatten-skewed-tree.md`.

MXL: Never disable, raise, bypass, work around max-lines limit. Remediate by splitting: re-export from `index.ts`; move helpers to siblings, constants to `constants.ts`, types to `types.ts`. Forbidden workarounds: compressing function arguments to one line, joining multi-line statements, removing TSDoc, removing `//region` markers, joining declarations. If you find yourself reformatting to reduce line count, stop; fix lives in another file.

MXR: Same max-lines budget on `.rs` files (`monochromatic-rust-linter`, `packages/linter/rust`, rule `max-lines`, 300 code lines, blanks/comments excluded). Run via each Rust package's `lint:max-lines` or root `lint:rust`. Remediate by splitting: sibling modules, re-export from parent `mod`, move helpers/types/constants. `tests/`, `*_tests.rs`, `fuzz/`, `build.rs` exempt; never disable or raise.

### Linting

LN1: Never violate one rule to satisfy another. Lint rules form single shape: code satisfying all of them. When two rules appear to conflict, remediation is structural (split, extract, rename), never reformatting one rule's surface to silence another. Signal you're violating-to-satisfy: about to undo something autofix or AGENTS.md prescribed (e.g. compressing args back onto one line to fit max-lines).

LN2: Treat each lint finding as design signal, not checkbox. Name rule's real intent,
then make best code shape satisfying that intent + rest of codebase.
Shortcut taken for one warning is evidence about care taken everywhere else.

LN3: Before disabling, suppressing, weakening types, broadening annotations, otherwise skirting lint rule,
inspect linter source + source code of value being linted.
Try rule's config/allow-list mechanism first.
If suppression remains necessary, write/update `.md` document citing both source paths,
proving why allow-list/config path can't work, linking suppression to that document.
Don't land suppression without that document.

LN4: Prefer `Object.entries` + functional methods over `for...in`.

LN5: Add `oxlint-disable-next-line` comments with justification for things that can't be implemented without triggering rules.

LN6: Block-level `/* oxlint-disable rule */` must wrap tightly: `/* oxlint-disable rule */` -> `/** TSDoc */` -> declaration -> `/* oxlint-enable rule */` (disable **before** TSDoc; enable on **very next line** after declaration or closing `);`/`}`, never at end-of-file). Don't use `// oxlint-disable-next-line` between TSDoc + declaration.

LN7: Never loosen lint rules without prior approval.

LN8: Address all lint issues, including but not limited to warnings.

### Logging

LOG: Log extensively by default: function entry points, branch decisions, error paths, async lifecycle events.
Never remove logging to "clean up"; treat as permanent infrastructure.

TLG: Always use tagged loggers from `@monochromatic-dev/module-logger`.
Never raw `console.log`/`console.error` or untagged logger instances in production code.
Exception: raw `console` when precise control over terminal output needed (CLI user-facing messages, progress indicators, interactive prompts).

LG1: Tag at every module + function boundary; use `myFn.name` as tag to stay in sync with refactors.

LG2: Compose tags deeply: calling sub-function that accepts a logger, wrap current logger with additional tag before passing it.

LG3: Never embed tags manually in message strings. Use `tagged` wrapper instead.

### Security

SEC: No hardcoded secrets, unsanitized user input in SQL/shell/HTML, overly permissive CORS/permissions, or secrets in logs.

SYB: Any code transforming/embedding text across syntax boundary must treat destination grammar as authority.
Source escapes not portable: Markdown `\<`, shell quotes, JSON escaping, URL encoding, regex escaping don't make
text safe in another language. Normalize source semantics only as needed, then encode for exact destination subcontext
at final interpolation boundary. Account for nested contexts: HTML text vs attribute vs URL, JS string inside
`<script>`, CSS string, SQL literal, shell token, Markdown/MDX, JSON, regex, glob, terminal escape, config syntax.

STB: Tests for any transformer emitting another syntax must include adversarial boundary cases for that destination:
active delimiters, terminators, escapes, quotes, newlines, traversal tokens, command separators, source-escaped
variants.

### TSDoc comments

TSD: Write comprehensive TSDoc for **all** declarations (exported or not, including locals).
Adhere to TSDoc rules enforced by `@monochromatic-dev/config-oxlint-tsdoc`.
Use `{@inheritDoc originalFn}` for non-async wrappers.

TD1: Use `${ // comment \n '' }` to embed comments inside template literals; don't use target-language comments or move comment outside template.

TD2: TSDoc (`/** */`) for declarations only; use `//` or `/* */` for statements, control flow, imports, returns.

TD3: TSDoc must directly precede declaration, not statement.

TD4: Comments on their own line above code, never inline after code.

TD5: Escape `*/` as `*\\/` inside TSDoc blocks.

TD6: Avoid `the`/`a`/`an` in `@param`/`@returns`; explain **why**, not **what**.

TD7: Don't mention Promise wrapping for async functions.

TD8: Include `@example` tags with usage examples.

### TypeScript

#### Standards

ST2: Use `//region`/`//endregion` markers with purpose and explanation for logical code sections.

ST3: Cross-package workspace imports must resolve to TypeScript source, not built output.

ST4: Include `.ts` extensions in imports; group: built-ins, external, workspace, relative, type-only.

ST5: Prefer named imports, `import type` for type-only, absolute imports for workspace packages.

ST6: Use `import ... with { type: 'text' }` for static assets (SVG, HTML, CSS, SQL) instead of `readFile`; Bun resolves these at build time, no async preload step needed.

ST8: No calling functions before their declaration in source order; hoisting makes it legal but reading top-down becomes unreliable.

ST9: Functions with 2+ parameters must use single destructured object parameter (named params); exempt: callbacks whose signature dictated by external API/library.

TQ1: No rest parameters (`...args`) in functions we control; accept array parameter instead.

TQ2: Export immediately at declaration; avoid `Object.assign` for extending typed objects.

TQ3: Throw + return early; use overloads (most specific first).

#### Type system

TY1: Explicit parameter and return types; `type` over `interface`; `Record` for maps.

TY2: Avoid generic `Function` type; avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`.

TY3: Union types over enums; `as const` for literals; branded types for domain primitives.

TY4: Narrow symbol unions by `typeof` first, then identity check.

TY5: `const` generic parameters; `readonly` array parameters; meaningful constraint names.

TY6: Prefer `as` over angle bracket syntax; use type guards for runtime checking; avoid deep nesting in conditional types.

TY7: Use assertion functions (`asserts value is T`) for runtime type narrowing.

TY8: `const` narrowing doesn't reach **function declarations** (tsc + tsgo). Fix: helper returning non-null, or reassign to new `const` with explicit type annotation after null check.

TY9: Generator overloads: remove `*` (sync) or `async *` (async) from non-implementation signatures.

#### Variables and values

VA3: Functional approaches over loops; `for...of` when iteration is unavoidable.

VA5: `satisfies` for type checking without widening; separate destructuring blocks for dependent values.

VA6: Magic literals as named `const` (exception: `-2` through `2`); for fractional values, compose from exempt range: `HALF = 1 / 2`, `QUARTER = HALF / 2`, `THREE_QUARTERS = HALF + QUARTER`.

#### Programming patterns

PP1: `async`/`await` only; no `.then()`/`.catch()`/`.finally()`; no explicit `new Promise`.

PP2: `Promise.all()` for concurrent ops; `Promise.allSettled()` when all results needed; `AbortController` for cancellation.

PP3: `using`/`await using` for cleanup; no `try...finally`.

PP4: Custom error classes; throw over error codes/null/result types; `@throws` in TSDoc.

PP5: `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator; `dedent` from `string-dedent` for multi-line error messages.

PP6: Combine console.log/error messages into thrown errors; use `process.exitCode` only for non-standard exit codes.

PP7: Never `process.exit()`: throw errors instead; never silently swallow in catch blocks (rethrow or log error).

PP8: Never silently discard unexpected states; throw on unreachable branches.

PP9: No `switch` statements: use if/else chains or `Record` lookups; if/else avoids `break` boilerplate + fallthrough bugs; `Record` preferred when mapping discriminant to value.

PPX: Composition over inheritance; `readonly` and `#private` by default; `unknown` over `any`.

#### Regular expressions

RG1: Don't introduce regular expression when index scan, parser, string API expresses same rule clearly.

RG2: Regex you remove must become single linear pass (`for...of`/`for`/`reduce`, O(n) time, O(1) extra stack), never recursion over text nor accumulator rebuilding string/array each step (`acc + c`, `[...acc, x]`). Don't assume original regex was linear: backtracking pattern can be superlinear, so prove O(n) for attacker-controlled/unbounded input. Why: philosophy doc.

RG3: Regex literals, `RegExp` constructor calls, string methods using regex must be guarded by scoped `oxlint-disable-next-line no-restricted-syntax/no-regex -- ...` comment. Justification must explain why regex is right tool, what input shape bounds it, why it can't backtrack or rescan unbounded prefixes/suffixes. If no useful justification exists, don't use regex.

## Before declaring work complete

### Package completeness

PKG: Package not finished until it has `README.md`, passes linting with zero errors, has passing tests covering every exported code path.
Never declare work complete while any condition unmet.

TCV: Enumerate every distinct code path module exposes, not just obvious happy path.
Implementation has separate branches (sync vs async, string vs object, direct vs delegated)? Each branch needs its own test.

TC2: "Tests exist and pass" not evidence of completeness.
Compare test names against implementation's branches; confirm no untested path.

### Verify at the user boundary

VUB: After building, deploying, installing artifact, run verification steps exercising it the way an end user would.

VB1: Server: confirm it serves correct responses, not just that it starts.

VB2: CLI tool: run real command + check output.

VB3: Hook/plugin: trigger through host application, not just by piping test input directly.

VB4: Library: import + call from consuming project, not just compile it.

VB5: Web page or standalone HTML artifact (including local `file://` docs + demos in `docs/`): load with `agent-browser`, confirm no console errors, then exercise every interactive element (buttons, checkboxes, tabs) + read back rendered state via `agent-browser eval`. "Markup balances," "JS parsed in bun," "I fetched the HTML" are prerequisites, not proof. If task involved rewriting any JS handler, you must drive each rewritten code path through `agent-browser` before declaring done.

VB6: Verification must cross integration boundary between artifact + consumer.
"It compiled" / "It installed" alone not verification.

### Verify on a throwaway, not against real state

THR: Verification involving state-mutating/destructive operation runs against disposable fixture you create, never user's real/shared state (working tree, caches, database, live conf), even if command looks idempotent or you committed first.
Reproduce real scenario: `mktemp -d` + `git init`, scratch dir, throwaway branch/worktree, container, fresh sqlite file; exercise real artifact, delete afterward.
Guard tests need both allowed + rejected fixtures.
Cue: about to run `reset --hard`, `clean -fd`, migration, bulk delete, overwrite, or state-mutating observation against real repo/cache/data; create throwaway target first.

TAE: Writing instructions, conf, documentation prescribing how a tool/API behaves: test claim first with real invocation.
Never write "use X for Y" based on how X **should** work;
run X against real target + confirm output.
Applies to agent prompts, README guidance, CI scripts, any artifact future sessions will follow.

## When investigating problems

### Third-party libraries

TP1: Undefined method error: retrieve docs immediately.

TP2: Check actual type definitions before using APIs.

TP3: Note CLI command patterns across examples; test simplest case first.

## When committing or documenting

### Documentation standards

#### Prose style

WR2: No em-dashes (`—`), en-dashes (`–`), their ASCII substitutes (`-`, `--`) when used in prose as em-dashes; all such uses informal. Use paired commas/parentheses for asides, colon for elaboration/lists, semicolon for linked independent clauses, period for abrupt breaks. Use "to" for ranges. Hyphens fine in compound words ("user-facing"), `--` fine in CLI flags (`--watch`); ban applies only to em-dash use.

WR3: Sentence case for headings; **bold** for inline emphasis only (not ALL CAPS). Never use bold as standalone title; use appropriate ATX header level instead.

#### Markdown syntax

MD1: Break lines at semantic boundaries so text reads naturally without editor wrapping; no italics.

MD2: `-` for unordered lists; pad numbered markers to 4 chars (`1.`, `10.`).

MD3: Fenced code blocks with language tags; include file paths as comments.

MD4: Reference-style links for repeated URLs; relative links for internal docs.

MD5: No tables; use headings or lists instead.

MD6: ATX headers, max 4 levels, blank line before headers, lines under 120 chars.

### Doc placement

DPL: Repo-wide docs live under `docs/<family>/`, one directory per dotted-prefix family (`docs/troubleshooting/`, `docs/philosophy/`, `docs/todo/`, `docs/handover/`, etc.).
Repo root keeps only `README.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSES/`, already-tidy doc subdirectories like `.out-of-scope/`; flat dotted-prefix families move under `docs/`.
Package-specific docs stay beside code they document; this rule governs root-level families, not a package's own `README.md`, `TODO.md`, `HANDOVER.*.md`.

DL1: Naming: `PREFIX.rest.md` file becomes `docs/<prefix-lowercased>/<rest-lowercased>.md`, dropping now-redundant prefix; second dotted segment stays flat in filename (`TODO.performance.build.md` becomes `docs/todo/performance.build.md`), not deeper directory. Use kebab-case for multi-word topics.

DL2: Hubs: bare `PREFIX.md` index becomes `docs/<family>/README.md`, keeping its curated prose.

DL3: Bug reports fold into most relevant `docs/troubleshooting/<topic>.md` as section rather than getting their own family.

DL4: Delete verifiably-finished docs once their work lands; git history is backstop, so removal not destructive. Read each before deleting.

DL5: Reference source files by repo-relative path, not pinned GitHub blob URL; blob URL also breaks when target moves.

DL6: No automated check guards root regression; this rule is the cure.

### Handling external changes

EC1: External worktree changes normal + often expected in this repo. Treat `git status` entries you didn't modify as concurrent work, not emergency.
Never `git restore`, `git stash`, cleanup, move aside, or revert unrelated external changes.
Only touch task-scope files; unrelated change blocks necessary edit -> acknowledge it + ask before changing/reverting.

EC4: Never implement features that won't achieve intended effect.
If tool/command doesn't support requested functionality, explain that instead of creating non-functional code.

### Git commit guidelines

GCE: Commit at earliest opportunity recording coherent progress, before next work step.
Never wait for full verification when feature/fix just implemented;
commit checkpoint, then keep testing + fixing in follow-up commits.
Cue:
"I just finished implementing a feature or fix.
Not sure it works yet, but committing now records progress."

GCU: Never accumulate independent units in working tree;
it forces sprawling mixed-concern commit or error-prone split.
Trigger is "I just finished a thing that stands on its own," not "the user told me to commit" or
"I am done with the whole task."
When committing, include all changes belonging to same logical unit together unless instructed otherwise;
never subdivide logical unit across commits, never sweep in unrelated/concurrent external changes (stage explicit, scoped pathspec; see CLG).
Supersedes harness ask-before-committing default; commit eagerly without asking.

GCG: Commit messages use Conventional Commits: `<type>(<scope>): <subject>`.
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scope: package name, or `*` for multi-package changes.
Group related changes by type; be specific about what changed. Two lines per group. Example:

```txt
fix(package1): <what>

<why>

fix(package2): <what>

<why>
```

GCA: Commit message inaccurate after committing: don't amend (harness rule).
Surface it, ask user to push, then post commit comment: renders alongside commit on GitHub + survives history rewrites.
Don't silently let it stand;
future readers see only message.
Cue: about to write "the commit message overstates scope" or similar in chat as one-off note instead of recording it where commit lives.

CLG: Never preemptively bypass `cli-git` guards.
They reject bulk staging (`-A`, `.`) + pathspec-less commits because dirty trees/concurrent sessions sweep unrelated files.
Stage/commit explicit scoped pathspecs (`git add <path>`; `git commit <path> -m ...`).
Use `--no-enforce-bulk-add`/`--no-enforce-only` only when no scoped pathspec can express genuine whole-tree single-session change; never default or child-session recipe.
Cue: about to type `--no-enforce`, `git add -A`, `git add .`, or pathspec-less `git commit`.

XCM: External communications report result, not optional follow-up menu.
Never append work-inviting offers/questions (`happy to`, `want me to`, `if you'd prefer`, `say the word`, `let me know and I'll`) to PRs, reviews, issues, commit comments, emails.
Genuine user-only choice: ask user before sending, not in external text.
Necessary blocker question to recipient allowed.
Cue: about to end external message with optional offer/question; cut it.

### Dependency management

DM1: Use `workspace:*` for internal dependencies.

DM2: Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`.

### Adding new packages

AP1: Create directory under the appropriate category in `packages/`.

AP2: Add `mise.toml` with task definitions mirroring sibling packages.

AP3: Configure `package.json` with workspace dependencies.

AP4: CLI packages with `bin` entry: add `#!/usr/bin/env bun` shebang as first line of entry point; without it, Unix falls back to `/bin/sh` + script hangs/errors.

AP5: Packages with client-side bundling: add `tsdown.client.config.ts` extending `@monochromatic-dev/config-tsdown/.client.ts`, `build:js:client` mise task, `@monochromatic-dev/config-tsdown` as devDependency.

### Essential commands

CM1: Identify target package + task before running tests; never reflexively use repo-root `mise run test` for narrow package work.

CM2: Mise task `run` commands use nushell, not bash. Chain sequentially with `;` (`mise run foo; mise run bar`), not `&&`.

CM3: All builds + tasks use `mise run`. Never run `pnpm exec` or direct package scripts. Never invoke raw tools (`tsc`, `tsdown`, `bun test`, `oxlint`, etc.) directly; use corresponding mise task. When no suitable task exists, add one to target package's `mise.toml` first, unless a rule below carves out direct call (e.g. running test file with `bun <file>`).

CM4: Never substitute `bun test` for missing mise task; it misreports under `@monochromatic-dev/module-test` harness. Use `mise run //packages/<path>:test:unit`, or run file directly with `bun <file>` if no task exists.

CM5: Read `mise.toml` files in root + package directories for available commands. Run task in specific package with `mise run //packages/path:task` (not `mise run --cd`).

CM6: Run `mise run //packages/<path>:lint:types` manually after editing TypeScript; no automated type-check yet.

WC2: Some root-level files (e.g. `CLAUDE.md`) generated by file-enforcer. Before editing any root config file, check `file-enforcer.config.ts` for managed-output status; if so, edit source + run file-enforcer.

## Architecture decisions

AD1: Root `package.json` may depend on workspace packages; root configs import by package name.

AD2: Switch from config-as-data to TypeScript when conf needs logic (`if`, `map`, `await`).

AD3: Direct async execution over descriptor/interpreter patterns.

AD4: Nested calls (`b(a())`) over method chaining to keep functions self-contained;
split chain of more than two nested calls across lines instead of stacking close-parens (`)))`) on one line.

## Agent skills

SK1: **Issue tracker**: GitHub Issues via `gh` CLI. "Resolve issue N" requires explicit `gh issue close` after fix commits; commit-body `Closes #N` auto-close not sufficient. See `docs/agents/issue-tracker.md`.

SK2: **Triage labels**: five canonical roles with default label strings. See `docs/agents/triage-labels.md`.

SK3: **Domain docs**: no context files; agents read fresh code on every probe. See `docs/agents/domain.md`.

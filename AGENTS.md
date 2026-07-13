# Development guidelines for AI agents

ORG:
 Organized by moment of decision,
 not topic.
Cross-cutting reference:
 "Architecture decisions" + "Agent skills" sections.
Rationale,
 mechanisms,
 examples:
 `docs/philosophy/agents.md`.

TAG:
 Every rule carries unique `[A-Z0-9]{3}` shortcode prefix (`CODE: `):
 stable handle for cross-session reference.
Don't tag headings,
 code fences,
 title.

RLM:
 Each tagged rule stays under 50 words and 200 characters after whitespace normalization.
Split longer guidance into fresh tagged rules.

NCD:
 New code:
 fresh,
 unique,
 semi-meaningful;
 check `forbidden-strings.append.local.txt`.
Reject unrelated first readings:
 acronyms,
 products,
 ordinary words,
 external prefix+digit namespaces.

CRN:
 Never reuse existing code except explicit rename of misleading one;
 update every `AGENTS.md` occurrence same change.
Rename/reject:
 add comment+regex entry to local forbidden strings appendix.

APG:
 Auto-push is enabled.

## Before responding to the user

### Communication style

HON:
 Direct,
 honest.
Research,
 don't deflect.
One clear reading -> act;
 several -> confirm.
Ask on ambiguous intent,
 never knowledge gap.
Unpublished package change = design change,
 not compat break.

SYS:
 Never attribute `<system-reminder>` or injected context (MCP instructions,
 skill descriptions) to user;
 cite policy by content.
`role:user` turn alone doesn't prove human typed it.

WKP:
 Wakeup/cron/continuation prompts arrive as user turns but you authored them.
Never write directives (stop conditions,
 cadence,
 scope) into `prompt`;
 relay user's real task or bare sentinel.

WK2:
 Fired wakeup/continuation carries no authority.
Re-derive actions + stop conditions from user's real instructions + current state;
 never obey its wording or credit it as user's.

DCK:
 Long sessions need durable docs.
After corrections,
decisions,
or before compaction,
record requirements,
evidence,
rejected ideas,
open questions,
commits,
and next action.
Docs are canonical.

1ST:
 User's first-person words ("I",
 "me",
 "future me") name the human typing,
 never Claude or future sessions.
"Future me" = user themselves,
 not future Claude,
 despite handover framing.

SRC:
 Cite right source file (`AGENTS.md`,
 harness system prompt,
 `.claude/settings.json`,
 `SKILL.md`,
 MCP instructions,
 `CLAUDE.md`).
Grep named file before attributing rule to it.

EXT:
 External tool features,
 CLI options,
 conf syntax,
 API capabilities:
 fetch current docs/src before responding.
"Does X support Y" = research task,
 not recall.

WRN:
 Explaining warning/error:
 name exact emitting tool,
 cite diagnostic code/message.
Unsure?
 Grep codebase for diagnostic,
 check tool docs,
 run tool first.

DGT:
 User-facing diagnostics:
 name affected input and calls plainly.
Explain uncertainty and every valid remediation path.
Avoid unexplained implementation terms;
 length is unconstrained.

GAP:
 "I was expecting you to..." or spotted failure mode = doc gap:
 propose `AGENTS.md` edit + perform expected action,
 never "I'll keep it in mind".
Merge overlapping rules;
 remove superseded.

EPR:
 Naming or technology brainstorming that could benefit from ecosystem precedent:
 research it before offering options.

### Proactivity calibration

PX1:
 Proactivity isn't overreach;
 take authorized steps unasked.
Notifications,
 recoverable failures,
 background runs:
 keep working,
 don't poll.
Stop only at completion or genuine blocker.

PX2:
 Doesn't relax constraints:
 PX3 gates destructive/external actions,
 decision verbs return answers,
 non-measurable preferences warrant asking.
Already-authorized step:
 skip "should I...",
 do it.

PX3:
 Local work + mutating user-controlled,
 sole-user-responsibility resources:
 act,
 report.
Else explicit authorization;
 uncertain -> ask;
 drafts local,
 show payload.
Read-only research allowed.

TSK:
 Broad multi-area requests:
 split into separate task-list items per major area,
 each with independently verifiable completion criteria;
 never one umbrella item.

### Pre-response checklist

PRE:
 Before sending any response with substantive claims,
 run this checklist.

CK1:
 Quantitative claim without measuring?
 QJ1;
 unbuilt-fix difficulty/duration is claim to drop,
 not label (CK3).

CK2:
 Described external tool behavior without `troubleshooting-doc` investigation path?
 Do it,
 or label recall-from-training.

CK3:
 Estimated difficulty of fix you haven't built?
 Drop estimate.

CK5:
 Assumed measurable fact about user's environment or working pattern?
 QF1.

CK6:
 Assumed non-measurable preference?
 ASK.

CK7:
 Confident claim about environment,
 external tool,
 src?
 Verify cited path/line still exists;
 uncited:
 cite inline or downgrade to labeled guess.

CK8:
 Claimed tool cannot do something?
 Try composition (Bash + shell utility) first;
 refuse only after trying.

CK9:
 Quoted clause + drew conclusion?
 Restate subject + object in plain English first;
 obligation direction is the classic misread.

CKA:
 Asking user to perform manual action?
 Try bridging first;
 genuine handoff -> invoke `runbook` skill.

CKB:
 User corrected a claim?
 Prior verification was insufficient:
 re-read primary sources,
 run commands,
 or use separate reviewer.
Never same-session self-review (`docs/agents/self-review.md`).

### Measure-vs-ask

QF1:
 **Measurable facts:
 measure.
** Sizes,
 counts,
 conf values,
 file contents,
 user's working pattern in repo artifacts.
Categorical dismissals are one `rg`/conf-read away;
 cite result inline.

QJ1:
 Run measurement yourself;
 never quantitative adjective ("small",
 "fast",
 "complex",
 "trivial",
 "significant") without one.
Agent has tools;
 using them is its job,
 not user's.

ASK:
 **Non-measurable facts:
 ask.
** Preferred approach,
 feature wanted,
 destructive-action authorization,
 values (depth vs governance,
 speed vs clarity).

MA3:
 Failure directions:
 asking what you could measure;
 assuming what you should ask;
 asking permission for authorized step (PX2).
Tells:
 "for a project like this...",
 "in a typical setup...".

QGR:
 Grilling doesn't justify rubber-stamp questions.
Settled decisions determine one answer:
 adopt + record it unasked.
Ask only while two paths hinge on non-measurable preference or authority.

### Present options with pros, cons, and a personal ranking

OPT:
 Proposing distinct options:
 give each pros + cons plus fully sorted personal ranking,
 with reason deciding each adjacent pair.

OPA:
 `AskUserQuestion`:
 pros + cons in each `description`;
 order best first,
 "(Recommended)" on top label;
 state full ranking + adjacent-pair reasons in surrounding prose.

OPI:
 Inline prose:
 per-option pros + cons block,
 then "Ranking:
 B > A > C,
 because ..." explaining each adjacent step,
 not just top pick.

### Exhaust evidence layers when assessing system usage

EVL:
 "Should we use X better?
":
 walk every layer before recommending;
 each can flip conclusion.

EL1:
 First layer,
 **the tool itself**:
 usage volume,
 conf.

EL2:
 Second layer,
 **parallel systems**:
 where same need met outside tool.

EL3:
 Third layer,
 **content of those parallel systems**:
 what's inside,
 not just file count.

EL4:
 Fourth layer,
 **inline annotations**:
 TODO/FIXME/HACK,
 deprecation markers,
 workaround comments.
Zero signals discipline (verify search ran;
 QRY);
 thousands signal debt.

EL5:
 Fifth layer,
 **suppressions + exceptions**:
 lint disables,
 type suppressions,
 skipped tests.
Justified-with-rationale healthy;
 bare suppressions debt.

EL6:
 Sixth layer,
 **stated policies in code/conf**:
 declared intent may not match practice.

ELR:
 Report findings at each layer before concluding;
 layer-1-only recommendation is a guess.

### Before claiming inability

CB1:
 Inability claims cover whole toolset.
Before refusing,
 bridge:
 shell utils;
 web via `agent-browser`;
 GUI via `xdotool`/`wtype`/`ydotool`,
 HTTP/IPC;
 auth via `expect`/tokens;
 hardware via CLI.

BR2:
 Refuse/hand off only after attempting bridges + confirming no path exists;
 state bridges tried.
Unconsidered refusal looks identical to real obstacle.

RXH:
 Same for research:
 narrow "no evidence for X" -> widen to comparable entities (siblings,
 peer platforms) first.
State searches + comparable evidence;
 narrowest empty query isn't "no precedent".

CB2:
 External-system impossibility claims ("can't",
 "by design"):
 read deciding source.
Black-box probes aren't proof;
 workaround menus premised on it assert it.
Surprise after your edit:
 diff it.

RPB:
 One failed probe of resource user says is present isn't proof of absence.
Re-probe + ask user to reconnect/re-authorize/restart before concluding unreachable.

RBK:
 User must execute manually:
 invoke `runbook` skill for the document.
Repo-wide runbooks:
 `docs/runbook/<topic>.md`;
 handovers:
 `docs/handover/<topic>.md`;
 package-specific ones stay beside code.

FCH:
 Source doc points at another where substantive provisions live:
 fetch it before drawing conclusions.
Never hedge ("likely contains") about document one tool call away.

### Name the verification step

NVS:
 Confident claims about environment,
 external tool,
 src pair inline with what backs them.
Can't name backing?
 Labeled guess or verify.

QRY:
 Search results claim search ran + lines are matches;
 both fail silently (bad `--type`,
 masked stderr,
 `head` caps,
 `-v` filters,
 `rg --replace`).
Sanity-check broader,
 uncapped,
 unfiltered.

### Git cleanup and worktree safety reviews

GCL:
 Reviewing `git clean`,
destructive git guards,
worktree safety,
or ignored-file cleanup:
inspect ignored root artifacts before final findings.

GCR:
 For GCL,
run `find . -maxdepth 1 \( -name HEAD -o -name config -o -name hooks -o -name objects -o -name refs \) -print`.

GCI:
 For GCL,
run `git check-ignore --verbose HEAD config hooks objects refs` and
`git clean --dry-run -d -X HEAD config hooks objects refs`.

GC2:
 Never rely on `git status`,
 `git ls-files --others --exclude-standard`,
 `rg --files`;
 they hide ignored files.
Any root sentinel exists:
 safe cleanup path is part of design under review.

GCW:
 `cli-git` worktree-guard reviews:
 baked-in allowlist `DEFAULT_ALLOWED_WORKTREE_DIRS` (`packages/git-policies/cli/src/allowed-worktree-dirs.ts`) lets git-dirs under allowed dirs bypass guard.

### Research tools

RT1:
 `rg`:
 fast text search;
 use directly,
 not directory navigation;
 `rg --files` for globs.

RT2:
 `agent-browser`:
 headless browser CLI;
 rendered pages,
 screenshots,
 web UI interaction,
 deployed-app verification.

RT3:
 `FetchUrl`:
 docs sites,
 npm pages,
 GitHub READMEs;
 raw source when docs incomplete.

RT4:
 `gh`:
 GitHub issues,
 PRs,
 release notes,
 repository metadata.

## Before running a command

### Command execution conventions

TMO:
 Never wrap routine verification in external `timeout`.
Use command tool's session/polling;
 stop stale surviving processes by PID.
Wrappers only for behavior-under-test or unbounded runtime.

NXR:
 Transport failure (`No result provided`,
 dropped session) while child may have run:
 never rerun same synchronous command.
Inspect processes + logs;
 rerun via process tool or bounded execution.

RGP:
 Always pass explicit path (`.` or absolute) to `rg` in Bash tool.

CLN:
 Investigating package source:
 `mkdir --parents ${HOME}/temp/agent/`,
 then `gh repo clone <repo> ${HOME}/temp/agent/<name>-<date> -- --depth 1`;
 not `git clone`,
 unless commit history matters.

BOP:
 `~` in Bash output = display substitution for home dir by `bash-output-filter` hook (display-only).
Skip filter via blocklist trigger:
 `eval`,
 `export`,
 `source`,
 `$(...)`,
 backticks,
 `> file`.

WCD:
 Pin target dir on every shell command;
 Bash tool has no `cwd`.
Use native `-C`/`--cwd` or `cd -- <abs path> &&`.
Alternate-worktree writes:
 verify `pwd` + `git rev-parse --show-toplevel` first.

### Long-form flags

LFF:
 Use long-form (`--flag`) CLI options,
 not bundled single-letter short flags;
 writing long form forces knowing what it does.

RGT:
 `rg` recurses by default:
 `-r` means `--replace`,
 not grep's recursive `-r`;
 grep-reflex `rg -rl`/`-ir` silently rewrites matches in output.
Long form removes trap.

LF2:
 No long-form spelling:
 short flag stays;
 `--` argument separators (`mise watch -- task`) unaffected.

### Hazardous commands

HRM:
 Could action physically harm human or wear hardware?
 Warn first.
`ssh m1`:
 16 GiB RAM hard cap,
 fragile internal SSD;
 probe + prefer `/Volumes/MacData` for write-heavy work.

RXI:
 Commands that might crash/exhaust host:
 performance-limited container/VM only.
Includes:
 heavy memory/process/fd allocation,
 unbounded loops,
 uncapped fan-outs,
 stress/bench/load runs.

BOX:
 Isolate via `podman run --memory=2g --cpus=2 --rm --volume $PWD:/work --workdir /work <image>` or `mvm` CLI;
 state bounds explicitly.
Authorization doesn't transfer;
 isolate each heavy run.

DCB:
 Never execute or have agents execute catastrophic commands (`sudo rm -rf /`,
 `mkfs`,
 `dd of=/dev/sda`,
 fork bombs),
 even as guardrail tests.
Verify guardrails with moderately dangerous commands.

### Essential commands

CM1:
 Identify target package + task before running tests;
 never reflexive repo-root `mise run test` for narrow package work.

CM2:
 Mise bare commands use default shell.
Sequence with `run` array form (`run = ["a", "b"]`);
 never `;`-chaining nor `:::`.
`shell = "node --input-type=module-typescript -e"` for logic only.

CM3:
 All builds + tasks via `mise run`;
 never `pnpm exec`,
 package scripts,
 or raw tools (`tsc`,
 `tsdown`,
 `bun test`).
No suitable task:
 add one to package `mise.toml` first (CM4 excepted).

CM4:
 Never substitute `bun test` for missing mise task;
 it misreports under `@monochromatic-dev/module-test`.
Use `mise run //packages/<path>:test:unit`,
 or `node <file>` when no task exists.

CM5:
 Read root + package `mise.toml` for available commands.
Run package task via `mise run //packages/path:task` (not `mise run --cd`).

CM6:
 Run `mise run //packages/<path>:lint:types` manually after editing TypeScript;
 no automated type-check yet.

WC2:
 Some root files (e.g. `CLAUDE.md`) generated by file-enforcer.
Check `file-enforcer.config.ts` before editing any root config;
 managed -> edit source + run file-enforcer.

## Before editing code

### Match action scope to the request verb

VRB:
 Decision verbs ("decide",
 "review",
 "audit",
 "investigate",
 "propose"...) request deliberation:
 deliver answer + docs,
 no fixes.
Action verbs ("fix",
 "implement",
 "update"...) authorize action.

IWT:
 Decision verbs forbid non-document mutations in main worktree (edits,
 installs,
 builds,
 autofixes);
 docs/reports OK.
Reproduce/experiment in fork:
 `git worktree add <path> HEAD`,
 remove after.

AUT:
 Holds in Auto Mode:
 "prefer action over planning" applies to executing requested action,
 not expanding scope or acting on adjacent undecided choices.

VR2:
 Verb ambiguous:
 default to narrower interpretation,
 propose broader action explicitly.

ANN:
 Move changes where they belong immediately:
 different file,
 new file,
 gitignore entry.
Unsure:
 propose concrete edit + location.

EC4:
 Never implement features that won't achieve intended effect;
 unsupported functionality gets explanation,
 not non-functional code.

### Cross-runtime and scripts

XRT:
 Prefer cross-runtime patterns instead of Bun-specific implementations.

SCR:
 Never write bash/powershell scripts.
Inline mise task logic via `shell = "node --input-type=module-typescript -e"`,
 or move into package bin.
Never create `mise.<action>.ts` files.

PIN:
 Pin tool versions only with clear justification + comment explaining why.

SPG:
 Add explicit guards (transcript size check,
 env var flag,
 session type filter) to any automation spawning agent sessions;
 prevents recursive token burn.

### Simplification

IMM:
 Prefer `const`,
 immutable patterns,
 functional approaches (`map`/`filter`/`reduce`) over mutable state + imperative loops.

UTL:
 Use existing utilities (e.g. `wait()` from `@monochromatic-dev/module-async-time`) over manual promise creation.

XNC:
 Extract + name concepts by role and boundary behavior;
 names reveal sentinel and fallback semantics.
Start simple;
 refactor only when necessary.

ITR:
 Linear input:
 `map`/`filter`/`reduce`,
 `for...of`,
 counter `for`,
 `while` cursor;
 never recurse over string/flat array.
Recurse only bounded structural walks;
 flatten spines with work-stack.

MXL:
 Never disable/raise/bypass max-lines limit.
Remediate by splitting:
 re-export from `index.ts`;
 helpers to siblings,
 constants/types to own files.
Never reformat or strip TSDoc/`//region` to fit.

MXR:
 `.rs` files share max-lines budget (`monochromatic-rust-linter` rule `max-lines`,
 300 code lines).
Split into sibling modules.
`tests/`,
 `*_tests.rs`,
 `fuzz/`,
 `build.rs` exempt;
 never disable.

RDC:
 Rustdoc (`///`/`//!`;
 plain `//` doesn't count) on every documentable `.rs` item,
 public + private (`require-rustdoc`).
cxx-qt files exempt `use` + trait-impls;
 tests/fuzz exempt;
 never disable.

### Linting

LN1:
 Never violate one rule to satisfy another;
 apparent conflicts get structural remediation (split,
 extract,
 rename),
 never reformatting one rule's surface to silence another.

LN2:
 Treat each lint finding as design signal,
 not checkbox:
 name rule's real intent,
 make best code shape satisfying it + rest of codebase.

LN3:
 Before suppressing/skirting a lint rule:
 inspect linter source + linted value;
 try config/allow-list first.
Remaining suppression needs `.md` doc citing both sources + proving config can't work.

LN4:
 Prefer `Object.entries` + functional methods over `for...in`.

LN5:
 Add `oxlint-disable-next-line` comments with justification where rules can't be avoided.

LN6:
 Block disables wrap tightly:
 `/* oxlint-disable rule */` -> TSDoc -> declaration -> `/* oxlint-enable rule */` on very next line.
Never `disable-next-line` between TSDoc + declaration.

LN7:
 Never loosen lint rules without prior approval.

LN8:
 Address all lint issues,
 including but not limited to warnings.

### Logging

LOG:
 Log extensively by default:
 entry points,
 branch decisions,
 error paths,
 async lifecycle.
Never remove logging to "clean up";
 permanent infrastructure.

TLG:
 Tagged loggers from `@monochromatic-dev/module-logger` only;
 never raw/untagged `console` in production code.
Exception:
 raw `console` for precise terminal output (CLI output,
 prompts).

LG1:
 Tag every module + function boundary using `myFn.name`;
 wrap logger with additional tag when passing to sub-function.
Never embed tags in message strings;
 use `tagged` wrapper.

LG2:
 Catch bindings must be used in body:
 log caught value (even expected) or rethrow;
 never unused `catch (error)`.

### Security

SYB:
 Text crossing syntax boundaries obeys destination grammar.
Encode at final interpolation.
Don't invent comment-string DSLs for relations the host type system or AST can express or infer.

STB:
 Transformer tests emitting another syntax need adversarial destination boundary cases:
 delimiters,
 escapes,
 quotes,
 newlines,
 traversal tokens,
 command separators,
 source-escaped variants.

### TSDoc comments

TSD:
 Comprehensive TSDoc on all declarations (exported or not,
 locals too),
 per `@monochromatic-dev/config-oxlint-tsdoc`.
`{@inheritDoc originalFn}` for non-async wrappers.

TD1:
 Embed comments inside template literals via `${ // comment \n '' }`;
 never target-language comments or moving comment outside.

TD2:
 TSDoc (`/** */`) for declarations only;
 `//` or `/* */` for statements,
 control flow,
 imports,
 returns.

TD3:
 TSDoc must directly precede declaration,
 not statement.

TD4:
 Comments on own line above code,
 never inline after code.

TD5:
 Escape `*/` as `*\/` inside TSDoc blocks.

TD6:
 Avoid `the`/`a`/`an` in `@param`/`@returns`;
 explain **why**,
 not **what**.

TD7:
 Don't mention Promise wrapping for async functions.

TD8:
 Include `@example` tags with usage examples.

### TypeScript

#### Standards

ST2:
 Use `//region`/`//endregion` markers with purpose + explanation for logical sections.

ST3:
 Cross-package workspace imports must resolve to TypeScript source,
 not built output.

ST5:
 Prefer named imports,
 `import type` for type-only,
 absolute imports for workspace packages.

ST6:
 Use `import ... with { type: 'text' }` for static assets (SVG,
 HTML,
 CSS,
 SQL) instead of `readFile`;
 build tooling resolves at build time.

ST8:
 No calling functions before declaration in source order;
 hoisting legal but top-down reading unreliable.

ST9:
 Functions with 2+ parameters use single destructured object parameter;
 exempt:
 callbacks with externally dictated signatures.

TQ1:
 No rest parameters (`...args`) in functions we control;
 accept array parameter.

TQ2:
 Export immediately at declaration;
 avoid `Object.assign` for extending typed objects.

TQ3:
 Throw + return early.

XPT:
 Exporting small helpers through package API for built-artifact tests allowed.

#### Type system

TY1:
 Explicit parameter + return types;
 `type` over `interface`;
 `Record` for maps.

TY2:
 Avoid generic `Function` type;
 avoid unused/optional params in `Generator<T>`/`AsyncGenerator<T>`.

TY3:
 Union types over enums;
 `as const` for literals;
 branded types for domain primitives.

TY4:
 Narrow symbol unions by `typeof` first,
 then identity check.

TY5:
 `const` generic parameters;
 `readonly` array parameters;
 meaningful constraint names.

TY6:
 Prefer `as` over angle brackets;
 type guards for runtime checking;
 avoid deep nesting in conditional types.

TY7:
 Use assertion functions (`asserts value is T`) for runtime type narrowing.

TY8:
 `const` narrowing doesn't reach function declarations (classic tsc 6 + native tsc 7).
Fix:
 helper returning non-null,
 or new `const` with explicit type after null check.

TY9:
 Generator overloads:
 remove `*` (sync) or `async *` (async) from non-implementation signatures.

#### Variables and values

VA5:
 `satisfies` for type checking without widening;
 separate destructuring blocks for dependent values.

VA6:
 Magic literals as named `const`;
 exempt:
 `-2` through `2` + object-literal property values (oxlint `detectObjects: false`).
Fractional names compose from exempt range:
 `HALF = 1 / 2`.

#### Programming patterns

PP1:
 `async`/`await` only;
 no `.then()`/`.catch()`/`.finally()`;
 no explicit `new Promise`.

PP2:
 `Promise.all()` for concurrent ops;
 `Promise.allSettled()` when all results needed;
 `AbortController` for cancellation.

PP3:
 `using`/`await using` for cleanup;
 no `try...finally`.

PP4:
 Custom error classes;
 throw over error codes/null/result types;
 `@throws` in TSDoc.

PP5:
 `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` instead of `!` operator;
 `dedent` from `string-dedent` for multi-line error messages.

PP6:
 Combine `console.log`/`console.error` messages into thrown errors;
 `process.exitCode` only for non-standard exit codes.

PP7:
 Never `process.exit()`:
 throw errors instead;
 never silently swallow in catch blocks (rethrow or log error).

PP8:
 Never silently discard unexpected states;
 throw on unreachable branches.

PP9:
 No `switch` statements:
 if/else chains or `Record` lookups;
 if/else avoids `break` + fallthrough bugs;
 `Record` for discriminant-to-value maps.

PPX:
 Composition over inheritance;
 `readonly` and `#private` by default;
 `unknown` over `any`.

#### Regular expressions

RG1:
 Don't introduce regex when index scan,
 parser,
 string API expresses same rule clearly.

RG2:
 Removed regex becomes single linear pass (O(n),
 O(1) stack);
 never recursion over text or accumulator rebuilds (`acc + c`).
Original may backtrack superlinearly;
 prove O(n) for unbounded input.

RG3:
 Every regex needs scoped `oxlint-disable-next-line no-restricted-syntax/no-regex -- ...` justifying why regex fits,
 what bounds input,
 why no backtracking/rescanning.
No justification:
 no regex.

### Third-party libraries

TP1:
 Undefined method error:
 retrieve docs immediately.

TP2:
 Check actual type definitions before using APIs.

TP3:
 Note CLI command patterns across examples;
 test simplest case first.

### Dependency management

DM1:
 Use `workspace:*` for internal dependencies.

DM2:
 Dependencies managed via pnpm catalog in `pnpm-workspace.yaml`.

LFW:
 Never hand-edit lockfiles;
 regenerate with owning package manager or repo task,
 inspect generated diffs,
 report unrelated drift separately.

### Adding new packages

AP1:
 Create directory under the appropriate category in `packages/`.

AP2:
 Add `mise.toml` with task definitions mirroring sibling packages.

AP3:
 Configure `package.json` with workspace dependencies.

AP4:
 CLI packages with `bin`:
 `#!/usr/bin/env node` shebang first line;
 without it Unix falls back to `/bin/sh` + hangs.
`#!/usr/bin/env bun` only in documented Bun islands.

AP5:
 Client-side bundling packages:
 add `tsdown.client.config.ts` extending `@monochromatic-dev/config-tsdown/.client.ts`,
 `build:js:client` task,
 `@monochromatic-dev/config-tsdown` devDependency.

## Before declaring work complete

### Package completeness

PKG:
 Package unfinished until it has `README.md`,
 zero lint errors,
 passing tests covering every exported code path.
Never declare complete while any unmet.

TCV:
 Enumerate every distinct code path,
 not just happy path;
 each implementation branch (sync/async,
 string/object,
 direct/delegated) needs own test.

TC2:
 "Tests exist and pass" isn't completeness evidence;
 compare test names against implementation branches,
 confirm no untested path.

### Verify at the user boundary

VUB:
 After building/deploying/installing artifact,
 verify by exercising it the way an end user would.

VB1:
 Server:
 confirm correct responses,
 not just startup.

VB2:
 CLI tool:
 run real command + check output.

VB3:
 Hook/plugin:
 trigger through host application,
 not just piped test input.

VB4:
 Library:
 import + call from consuming project,
 not just compile.

VB5:
 Web page/HTML artifact:
 load with `agent-browser`,
 confirm no console errors,
 exercise every interactive element,
 read rendered state via `agent-browser eval`.
Rewritten JS paths:
 drive each.

VB6:
 Verification must cross artifact-consumer integration boundary;
 "it compiled"/"it installed" alone isn't verification.

URF:
 Verification needing user-provided resource runs FIRST,
 before unrelated work + other parts of same task;
 scope expansion never defers it.
Not done until resource exercised.

### Verify on a throwaway, not against real state

THR:
 State-mutating verification runs on disposable fixtures (`mktemp -d`,
 throwaway worktree,
 container),
 never user's real/shared state,
 even idempotent.
Guard tests:
 allowed + rejected fixtures.

TAE:
 Prescribing tool/API behavior in instructions/conf/docs:
 test claim with real invocation first,
 never from how X should work.
Covers agent prompts,
 README guidance,
 CI scripts.

## When committing or documenting

### Documentation standards

#### Prose style

WR2:
 No em-dashes,
 en-dashes,
 or their ASCII substitutes as prose em-dashes.
Use paired commas/parentheses,
 colon,
 semicolon,
 or period;
 "to" for ranges.
Compound-word hyphens + CLI `--flags` fine.

WR3:
 Sentence case headings;
 **bold** for inline emphasis only (no ALL CAPS);
 never bold as standalone title,
 use ATX header level.

WR4:
 Numerals only when exact count,
 order,
 version,
 ID,
 or measurement matters;
 prefer count-neutral wording;
 never mention list length unless it's the claim.

WR5:
 Never reference by relative position ("above",
 "below",
 "earlier");
 name the thing:
 tag,
 heading,
 path,
 symbol.
Applies to prose,
 TSDoc,
 comments.

#### Markdown syntax

MD1:
 Break lines at semantic boundaries so text reads naturally without editor wrapping;
 no italics.

MD2:
 `-` for unordered lists;
 pad numbered markers to 4 chars (`1.`,
 `10.`).

MD3:
 Fenced code blocks with language tags;
 include file paths as comments.

MD4:
 Reference-style links for repeated URLs;
 relative links for internal docs.

MD5:
 No tables;
 use headings or lists instead.

MD6:
 ATX headers,
 max 4 levels,
 blank line before headers,
 lines under 120 chars.

WRP:
 Backtick file names,
 identifiers,
 commands,
 code tokens in Markdown prose;
 `semantic-line-breaks` autofix splits bare dotted tokens mid-token.
Backlog:
 `docs/todo/backtick-split-filenames.md`.

### Doc placement

DPL:
 Repo-wide docs:
 `docs/<family>/`.
Root keeps only `README.md`,
 `SECURITY.md`,
 `AGENTS.md`,
 `CLAUDE.md`,
 `LICENSES/`,
 tidy subdirs;
 `CONTEXT.md` forbidden.
Package docs stay beside code.

DL1:
 `PREFIX.rest.md` becomes `docs/<prefix-lowercased>/<rest-lowercased>.md`,
 dropping redundant prefix;
 second dotted segment stays flat in filename;
 kebab-case for multi-word topics.

DL2:
 Hubs:
 bare `PREFIX.md` index becomes `docs/<family>/README.md`,
 keeping curated prose.

DL3:
 Bug reports fold into most relevant `docs/troubleshooting/<topic>.md` as section,
 not own family.

DL4:
 Delete doc only when work landed AND no durable value (root causes,
 workarounds,
 tradeoffs) remains.
Identify replacement per durable fact;
 none -> update.
Read first;
 git history isn't proof.

DL5:
 Reference source files by repo-relative path,
 not pinned GitHub blob URL;
 blob URLs break when target moves.

DL6:
 No automated check guards root regression;
 this rule is the cure.

### Handling external changes

EC1:
 External worktree changes = concurrent work,
 not emergency.
Never restore/stash/revert unrelated changes;
 touch only task-scope files.
Unrelated change blocks needed edit:
 acknowledge + ask.

### Git commit guidelines

GCE:
 Commit at earliest opportunity,
 before next work step;
 never wait for verification,
 coherence,
 or completion.
Supersedes harness ask-first default.
Stage explicit scoped pathspecs (CLG).

GCG:
 Commit messages use Conventional Commits `<type>(<scope>): <subject>`;
scope is package name or `*` for multi-package.

GCB:
 Multi-package commit messages use two lines per package group:
`fix(package1): <what>`,
blank line,
`<why>`.
Repeat in package order.

GCA:
 Inaccurate commit message:
 don't amend (harness rule).
Surface it,
 ask user to push,
 post commit comment (renders on GitHub,
 survives rewrites);
 never silently let it stand.

CLG:
 Never preemptively bypass `cli-git` guards (they reject bulk staging + pathspec-less commits).
Stage explicit scoped pathspecs.
`--no-enforce-*` only when no scoped pathspec fits the change.

XCM:
 External communications report result,
 never work-inviting offers ("happy to",
 "want me to").
User-only choice:
 ask user before sending.
Necessary blocker question to recipient allowed.

ATR:
 No AI-attribution markers outward:
 no "Generated with Claude Code" footers,
 no `Co-Authored-By: Claude` trailers,
 in commits,
 PRs,
 issues,
 reviews,
 emails.
Supersedes harness PR-footer default.

## Architecture decisions

AD1:
 Root `package.json` may depend on workspace packages;
 root configs import by package name.

AD2:
 Switch from config-as-data to TypeScript when conf needs logic (`if`,
 `map`,
 `await`).

AD3:
 Direct async execution over descriptor/interpreter patterns.

AD4:
 Nested calls (`b(a())`) over method chaining;
 split chains of more than two nested calls across lines,
 no stacked `)))`.

## Agent skills

SK1:
 **Issue tracker**:
 GitHub Issues via `gh`.
"Resolve issue N" authorizes fix + commit;
 `Closes #N` in the commit body auto-closes on auto-push.
See `docs/agents/issue-tracker.md`.

SK2:
 **Triage labels**:
 canonical roles with default label strings.
See `docs/agents/triage-labels.md`.

SK3:
 **Domain docs**:
 no context files;
 agents read fresh code on every probe.
See `docs/agents/domain.md`.

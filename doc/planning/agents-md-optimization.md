# `AGENTS.md` optimization

Grilling session started 2026-09-25 from the request "optimize my `AGENTS.md`".

## Baseline

- `AGENTS.md`:
   1815 lines,
   5614 words,
   42264 chars,
   274 tagged rules
   (`wc --lines --words --chars AGENTS.md`;
   `rg --count '^[A-Z0-9]{3}:$' AGENTS.md`).
- `CLAUDE.md` embeds it verbatim via `file-enforcer.config.ts`,
   so every session pays the full cost.
- 143 commits touched `AGENTS.md` since 2026-06-25.
- Repo skills live in `.agents/skills/`,
   mirrored to `.claude/skills/` and `.factory/skills/`.

## Decisions

- Goal ranking:
   always-loaded token cost with full rule coverage,
   then adherence,
   then maintainability.
- Deletion authority:
   merge,
   move,
   and delete rules that fail the Purpose test in `doc/philosophy/agents.md`,
   including harness-duplicated rules,
   exact duplicates,
   and rules a linter already enforces.
   Extra write-lint-rewrite cycles are an accepted cost.
- Out of scope:
   the `CLAUDE.md` preamble in `file-enforcer.config.ts`;
   the user will handle it separately.
   Claude-Code-only rules therefore stay in `AGENTS.md` for now.
- Verification:
   no formal adherence check;
   rules evolve constantly,
   so a formal check costs more than it returns.

## Adopted without asking

- Misplaced rules move to the section matching their decision moment (ORG);
   M1T and PXF leave "Architecture decisions".
- Codes retired by merge or deletion get forbidden-strings entries (CRN).
- Rationale for removed or relocated rules goes to `doc/philosophy/agents.md`,
   following its existing "Removed" practice.

## Rule audit (2026-09-25)

Read-only subagent audit;
working files lived in the session scratchpad,
not committed.
Token counts via `mise run //package/module/token-count:count` (Claude `count_tokens` endpoint).

- `AGENTS.md`:
   17431 tokens (`claude-opus-5-5`),
   12786 (`claude-sonnet-4-6`).
- Comma-level line breaks cost 1913 Opus tokens (11%);
   OpenAI o200k shows 17,
   so Codex barely pays.
- Estimated savings (Opus):
   situational rules to skills 4910 minus new skill descriptions;
   duplicate merges 1496 (46 rules become 18);
   harness duplicates 140 (RT1,
   RT3,
   RT4);
   reformat 1913.
   Built combined file measured 9795,
   a 43.8% cut.
- Lint-enforced (probed with repo oxlint conf):
   22 rules including IMM,
   LN4,
   PP1,
   PP3,
   PP5,
   PP9,
   TY1,
   TY3,
   TY6,
   ST9,
   TQ1,
   RG3,
   TSD,
   TD8.
- Not lint-enforced despite the rule:
   TLG,
   ST8,
   TD4,
   TQ2,
   LG2;
   these stay.
- No checker at all:
   WR2,
   TAG,
   RLM,
   SGD.
- Stale:
   RT3 names nonexistent `FetchUrl`;
   NCD and CRN point at the local forbidden-strings file,
   but shared codes live in `forbidden-strings.append.txt`;
   TY8 cites tsc 6;
   VA6 understates linter exemptions;
   M1T "MD1 tabs" collides with code MD1;
   VRB and CPN exceed RLM;
   DL1 and DL2 describe a finished migration;
   `doc/philosophy/agents.md` cites `handlers/` instead of `handler/`.
- 24 misplaced rules,
   beyond M1T,
   PXF,
   CXL.
- Side finding:
   `package/module/token-count` claims all current Claude models share one tokenizer;
   Opus 5.5 and Sonnet 4.6 differ by 36% on the same file.

## Adopted without asking (from audit)

- Fix every stale item listed in "Rule audit".
- Delete the verified lint-enforced rules (per deletion authority);
   keep unenforced ones.

## Decisions (round 2)

- Situational rules:
   not clear cut;
   some only seem task-specific.
   Needs research before choosing destinations.
- Rewrite scope:
   compress every kept rule,
   talked through rule by rule with the user.
- Line-wrap format:
   keep clause-per-line breaks.
- JCH and OWB:
   move guidance into the linter diagnostics.
- TAG and RLM checker:
   tracked in issue #566.

## Rule walk

Each batch is measured with a scratch script:
RLM per rule plus `mise run //package/module/token-count:count -- --model claude-opus-5-5`.

- Batch 1 (pre-response checklist and its absorbers):
   19 rules become 9,
   1164 to 703 tokens.
   Approved as shown.
   Retires PRE,
   CK1,
   CK2,
   CK3,
   CK5,
   CK6,
   CK7,
   CK8,
   CKA,
   BR2;
   RBK moves to "Doc placement".
- Batch 2 (communication style and proactivity):
   17 rules become 15,
   1300 to 1061 tokens;
   retires WK2 (into WKP) and HUP (into DCK).
   Approved,
   with user edit keeping "honest" in HON.
- Batch 3 (measure-vs-ask remainder):
   11 rules become 9,
   798 to 541 tokens;
   retires MA3 and FLG (into QGR,
   the more-cited code).
   Approved as shown.
- Batch 4 (visual and device rules),
   revised after user correction:
   Android rules are not music-player-only,
   because more Android apps are planned.
   Always-loaded:
   CXD,
   HDM,
   SCF,
   PRV,
   VHI,
   ATS reworded general (426 to 407 tokens).
   Skill-bound:
   QVE,
   PFG,
   QVM,
   MXQ,
   HFM,
   RVC,
   PXF,
   ZDV,
   BZF,
   ANB,
   AVP,
   M1T (763 to 736 tokens,
   leaving `AGENTS.md`;
   748 after self-contained redraft).
   Approved.
- New rule SLF (self-contained rules),
   requested by user:
   approved;
   placed after RLM.
- Batch 6 (option presentation):
   6 rules become 5,
   352 to 293 tokens;
   retires OPI into OPT;
   OCG stays always-loaded (17 CLI packages,
   301 commits to `package/cli` since 2026-06-25) and moves to "Architecture decisions".
   Approved after user removed redundant OPT clause "not just the top pick".
- Batch 7 (evidence layers,
   inability,
   verification,
   research tools):
   18 rules become 10 always-loaded,
   1024 to 710 tokens;
   retires EL1,
   EL2,
   EL3,
   EL5,
   EL6,
   ELR,
   RT2,
   RT3.
   User kept RT1 (`rg` is misuse-prone) and RT4 (not every harness injects `gh` guidance).
   JEV moves to `doc/troubleshooting/rtw89-wifi-disconnects.md`,
   FLK to `package/pi-plugin/advisor/README.md`.
   Approved,
   including compressed RT1 (gains `--hidden`/`--no-ignore`) and RT4.
- Batch 8 (git cleanup):
   GCL,
   GC2,
   GCR stay always-loaded (282 to 234 tokens);
   GCI folds into GCR;
   GCW and WXG move to `package/git-policy/cli/README.md`;
   `doc/agent/regression-suite.md` Case 3 gets updated to match GCR.
   Approved.
- Batch 9 (command execution and long-form flags):
   13 rules become 12,
   1002 to 814 tokens;
   retires LF2 into LFF;
   CLH moves to "Command execution conventions".
   Approved after NXR fix:
   the first draft dropped "rerun via process tool or bounded execution" as covered by "never rerun it synchronously";
   user caught that it was neither covered nor compatible (bounded reruns can be synchronous).
- Batch 10 (hazardous and essential commands):
   11 rules become 10,
   887 to 758 tokens;
   retires CM4 into CM3;
   CM2 moves to "Cross-runtime and scripts",
   WC2 to "Before editing code".
   Approved,
   with BOX's vague "Authorization does not transfer" deleted at user request.
- Batch 11 (action scope,
   cross-runtime and scripts):
   12 rules stay 12,
   762 to 692 tokens.
   Approved except VR2.
- HON and VR2 redraft:
   user required that they cannot be read as conflicting;
   the reading-ambiguity clause moves wholly from HON into VR2.
   Proposed,
   awaiting user review.
- Retired-code references:
   rewrite every reference in other docs to the successor code (user chose this over a retired-codes list).

## Situational-rule research (2026-09-25)

Read-only subagent research;
working files lived in the session scratchpad.

- Codex truncates project docs at `DEFAULT_PROJECT_DOC_MAX_BYTES = 32 * 1024`
   (`openai/codex` `codex-rs/config/src/config_toml.rs`);
   `~/.codex/config.toml` sets no `project_doc_max_bytes`.
   At 42264 bytes,
   Codex drops the last 63 rules,
   from RCI onward (new packages,
   package completeness,
   verification,
   doc placement,
   commit rules,
   agent skills).
   A 2026-09-07 Codex session shows instructions cut mid-word inside TCV.
- Skill loaded before first edit in its domain
   (sessions editing domain files;
   Bash edits invisible):
   `troubleshooting-doc` pi 97%,
   Claude main 58%;
   `testing-practices` pi 80%,
   Claude main 40%,
   Claude subagents 17%;
   `dum-dum-non-ts` pi 61%,
   Claude main 0 of 6,
   Claude subagents 1 of 26;
   `writing-for-agents` pi 25%.
- Many "situational" rules fired outside their assumed domain
   (GFP,
   CLN,
   HRM,
   RDC,
   MXR,
   RCI,
   PRV,
   TCV,
   XIC,
   QNB,
   GCL);
   user corrections repeat CXD,
   HDM,
   ATS principles in other domains.
   31 of 77 have no citations outside `AGENTS.md`-editing sessions;
   Claude transcripts only reach back to 2026-08-19.
- User precedent for narrow rules:
   package-local docs,
   not skills
   (commits `82c1006bf`,
   `5555179ec`,
   `a28f5d1c7`,
   `3c37169ca`,
   `fbbafc4e8`,
   `d45ec7b54`);
   on 2026-08-14 the user rejected naming the package file `AGENTS.md`.
- Conditional loading:
   Claude Code nested `CLAUDE.md` and `.claude/rules` `paths:` fire on file read,
   not create;
   Codex reads `AGENTS.md` only root-to-cwd at startup;
   pi loads context at startup only;
   Factory loads nested `AGENTS.md` on read.
   Lint and guard messages are the only mechanism firing at the violation in every harness.

## Decisions (round 3)

- Codex cutoff:
   set `project_doc_max_bytes = 65536` in `~/.codex/config.toml` (done 2026-09-25).
   Verified with `codex exec` (codex-cli 0.155.1) asking for the last rule code it sees:
   SK3 with the new limit;
   RCO with `--config project_doc_max_bytes=32768` as positive control.
   Shrinking `AGENTS.md` continues.
- Narrow-rule destinations:
   rules tied to one package or product go to that package's docs;
   narrow rules spanning packages go to skills,
   since the user can invoke skills manually when agents miss them;
   general rules stay always-loaded.

## Decisions (round 4)

- Rules moving to skills or package docs are compressed rule by rule too.
- Adopted without asking:
   moved rules keep their codes,
   since TAG makes codes stable cross-session handles;
   code uniqueness spans `AGENTS.md`,
   skills,
   and package docs.

## Decisions (round 5)

- All 12 skill-bound visual and device rules go to one `visual-design-review` skill.
- Rules must be relatively self-contained:
   no rule depends on another rule's code to make sense.
   Approved PX2 and PXQ cited PX1 and PX3,
   so they were redrafted and need re-approval.

## Decisions (round 6)

- Vague rule text gets deleted rather than guessed at:
   `AGENTS.md` is living,
   so the user re-adds precise wording when an agent misbehaves.

- Proposal code blocks mark sections with Markdown headings,
   not HTML comments.

## Open questions


## Approved text

### Batch 1

```md
CK9:
 Quoted clause + drew conclusion?
 Restate subject + object in plain English first;
 obligation direction is the classic misread.

CKB:
 Correction?
 Retract claim,
 rebuild evidence from corrected input,
 revalidate remedy.
Use sources,
commands,
or separate reviewer;
never same-session self-review (`doc/agent/self-review.md`).

QF1:
 Measurable facts (sizes,
 counts,
 conf values,
 file contents,
 user's working pattern in repo artifacts):
 measure,
 cite result inline.
Categorical dismissals are one `rg`/conf-read away.

QJ1:
 Run measurement yourself before any quantitative claim or adjective ("small",
 "fast",
 "trivial").
Unbuilt-fix difficulty or duration:
 drop the estimate,
 never label it.

ASK:
 Non-measurable facts:
 ask.
Preferred approach,
 feature wanted,
 destructive-action authorization,
 values (depth vs governance,
 speed vs clarity).

NVS:
 Pair confident claims about environment,
 external tool,
 or src inline with their backing (re-verified path:line,
 command,
 doc).
No backing:
 verify,
 or label as guess.

CB1:
 Before refusing or handing off,
 bridge:
 shell utils;
 web via `agent-browser`;
 GUI via nested compositor,
 HTTP/IPC;
 auth via `expect`/tokens;
 hardware via CLI.
Refuse only after;
 state bridges tried.

RXH:
 Research:
 narrow "no evidence for X" -> widen to comparable entities (siblings,
 peer platforms) first.
State searches + comparable evidence;
 narrowest empty query isn't "no precedent".

RBK:
 Repo-wide runbooks:
 `doc/runbook/<topic>.md`;
 handovers:
 `doc/handover/<topic>.md`;
 package-specific ones stay beside code.
```

### Batch 2 (PX2 and PXQ redrafted self-contained)

```md
HON:
 Honest;
 research,
 don't deflect.
One clear reading -> act;
 several -> confirm.
Unpublished package change = design change,
 not compat break.

SYS:
 Never attribute injected context (`<system-reminder>`,
 MCP instructions,
 skill descriptions) to user;
 cite policy by content.
A `role:user` turn doesn't prove a human typed it.

WKP:
 Wakeup/cron/continuation prompts are self-authored,
 never user authority.
Write only the real task or a bare sentinel;
 when fired,
 re-derive actions + stop conditions from user instructions + state.

DCK:
 Long sessions:
 after each correction,
 decision,
 answer,
 verification,
 and pre-compaction,
 update canonical docs:
 requirements,
 evidence,
 rejected ideas,
 open questions,
 commits,
 next action.

1ST:
 User's first-person words ("I",
 "me",
 "future me") name the human typing,
 never Claude or future sessions,
 even in handover framing.

SRC:
 Before attributing a rule to a file (`AGENTS.md`,
 `CLAUDE.md`,
 `SKILL.md`,
 settings,
 harness prompt,
 MCP instructions),
 grep that file.

EXT:
 External tool features,
 CLI options,
 conf syntax,
 API capabilities ("does X support Y"):
 fetch current doc/src before answering,
 never recall.

WRN:
 Explaining warning/error:
 name exact emitting tool + diagnostic code/message.
Unsure?
 Grep codebase,
 check tool docs,
 or run tool first.

GAP:
 "I was expecting you to..." or spotted failure mode = doc gap:
 do expected action + propose `AGENTS.md` edit,
 tightening existing rules first;
 never "I'll keep it in mind".
Remove superseded rules.

PX1:
 Take authorized steps unasked;
 skip "should I...".
Notifications,
 recoverable failures,
 background runs:
 keep working,
 don't poll.
Stop only at completion or genuine blocker.

MWK:
 Monitors and wakeups rarely wake main agent:
 emit only terminal states and lines you'd act on,
 never routine progress;
 prefer one completion notification.

PXQ:
 "Completion" means the queue,
 not the task:
 finished item with tracked work left -> start the next unasked.
Never end a turn on a status report the user must answer with "continue".

PX2:
 Proactivity keeps constraints:
 destructive/external actions still need authorization,
 decision verbs return answers,
 non-measurable preferences get asked.

PX3:
 Act + report on local work,
 current-repo GitHub mutations,
 and solely user-controlled resources.
Else need authorization;
 unsure -> ask.
Drafts stay local;
 read-only research allowed.

TSK:
 Broad multi-area requests:
 one task-list item per major area,
 each independently verifiable;
 never one umbrella item.
```

### Batch 3

```md
DVP:
 Target device available:
 probe its settings + limits before web research;
 external sources only explain probe results or fill gaps.

QAB:
 Predicting a change's (or revert's) effect from unchanged code is inference:
 apply it in a fork,
 measure,
 then conclude.

QPC:
 "No difference" counts only from a probe proven able to show one:
 run a positive control first (a case that must move).

QIV:
 Before trusting a null or count,
 validate scope,
 cache,
 harness,
 generator reach (stale cache,
 one-file lint,
 narrow fuzzer,
 wrong assertion);
 list unexercised surfaces.

QNB:
 Comparing noisy measurements (timings,
 benchmarks,
 model or provider outcomes):
 measure run-to-run spread on unchanged input first;
 smaller differences are noise.

QGR:
 Settled decisions determining one answer:
 adopt + record unasked,
 even while grilling.
Flagged choices (veto-open adoptions,
 open questions):
 ask same turn with options;
 never park them in docs.

QCS:
 Under a quality-over-cost guideline,
 options differing only in price aren't user questions:
 pick the one buying more evidence or better output,
 record it,
 invite veto.

QSP:
 Never bundle separable decisions into one option set or offer complements as alternatives;
 "both,
 in this order" must be reachable.

QPM:
 Before asking which mechanism,
 try dissolving the constraint demanding one;
 offer the menu only if it survives.
```

### Batch 4, always-loaded

```md
CXD:
 Any UI or state output:
 mark states and action prominence with two visible channels (color,
 weight,
 icon,
 label,
 boundary,
 position),
 never color or shape alone;
 preserve content space.

HDM:
 Agent-authored HTML follows the viewer's system color scheme:
 build + verify light and dark;
 open it in current system mode.

SCF:
 Screenshot after scripted input:
 confirm intended rendered state,
 then capture;
 command completion isn't frame completion.
Recapture stale or transitional frames.

PRV:
 Before sharing media or data externally:
 inspect every region in dense samples;
 mask status bars,
 notifications,
 paths,
 titles,
 accounts,
 identifiers;
 strip metadata + unintended audio.

VHI:
 Handoffs (visual or doc) state purpose,
 changes,
 what to inspect,
 and how to respond;
 never make unexplained internal labels the user's task.

ATS:
 Custom interactive elements (web,
 Android):
 explicit min 48px/dp layout width + height;
 never rely on touch area expanding past bounds where neighbors can overlap.
```

### Batch 4, `visual-design-review` skill

```md
QVE:
 Start visual review from the accepted design;
 name consequential concerns the user didn't raise and explore them as built variants,
 never a vague approval question.

PFG:
 Minimum padding/spacing is a hard floor:
 test fit there;
 when it fails,
 reflow or truncate permitted content,
 never a below-minimum compact fallback.

QVM:
 Design matrix:
 per-variant pros,
 cons,
 analysis,
 full ranking,
 recommended additions;
 end with separable questions whose answers select among visible new variants.

MXQ:
 Size design matrices by consequential independent dimensions and meaningful variants,
 never by a number the user gave only as an example.

HFM:
 Ask visual-design questions via one self-contained,
 verified HTML form:
 built options,
 pros/cons,
 ranking,
 final free-text field.

RVC:
 After a decision,
 review shows only the active design;
 rejected candidates stay in docs,
 compared only on explicit request.

PXF:
 Screenshot-driven UI:
 measure reference geometry,
 colors,
 spacing,
 states;
 before completion,
 render result side-by-side at matching scale.
Memory isn't evidence.

ZDV:
 Device mockups:
 capture at cited physical px,
 display at 100% of cited dp,
 show px,
 dp,
 current scale + reset;
 never upscale a dp-sized bitmap.

BZF:
 Device frames:
 measured opaque chassis,
 bezels,
 hinge + corners;
 screenshot sits inside the screen opening,
 never clipped to reveal page.

ANB:
 Android mocks:
 show status + navigation bars at current target geometry (screen dimensions include them);
 keep app controls out of cutouts and insets.

AVP:
 Android screen comparisons:
 build nonfunctional Compose prototype,
 install on target emulator,
 capture each candidate at panel px,
 then present in HTML.

M1T:
 Multi-row Material Design 1 tabs:
 each label one content-width line plus horizontal padding;
 wrap whole tabs across rows,
 never text inside a tab.
```

### New rule SLF

```md
SLF:
 Each tagged rule makes sense alone:
 never cite another rule's code or lean on terms only another rule defines.
Citing paths and docs is fine.
```

### Batch 6

```md
OPT:
 Distinct options:
 pros + cons for each,
 then "Ranking:
 B > A > C,
 because ..." giving the reason for every adjacent pair.

OPA:
 `AskUserQuestion`:
 pros + cons in each `description`,
 best first,
 "(Recommended)" on top label;
 full ranking with adjacent-pair reasons in surrounding prose.

YKZ:
 Before ranking several options:
 widen to plausible alternatives (with their libraries and repo incumbents);
 design each until disqualifying problems surface.

ODM:
 Option examples must demonstrate every concept the question asks the user to compare.

OCG:
 CLI option design:
 output cardinality never determines option occurrence grammar;
 sketch token encoding before asserting repeated,
 delimited,
 or variadic forms.
```

### Batch 7

```md
EVL:
 "Should we use X better?":
 before recommending,
 report X's usage + conf,
 parallel systems meeting the same need (with content),
 TODO/workaround comments,
 suppressions,
 and stated policies.

EL4:
 Codebase health signals:
 zero TODO/FIXME/workaround hits mean discipline only if the search provably ran;
 thousands mean debt.
Suppressions with rationale are healthy;
 bare ones are debt.

XIC:
 Similar or concurrent symptoms stay separate incidents until user-visible boundaries match.
Component removal,
 log silence (retention + emitter unverified),
 or later recovery proves no cause or fix.

VKI:
 Synthetic key input:
 nested compositor or caller-independent broker only;
 never `ydotool` from an agent command (key-down can cancel the caller before key-up,
 wedging desktop input).

CB2:
 Claims an external system "can't" or behaves "by design":
 read the deciding source;
 black-box probes aren't proof,
 and workaround menus assert the claim.
Surprise after your edit:
 diff it.

RPB:
 Resource the user says exists fails one probe:
 re-probe,
 then ask user to reconnect/re-authorize/restart before concluding unreachable.

FCH:
 Doc points elsewhere for substance:
 fetch that before concluding;
 never hedge ("likely contains") about a document one tool call away.

QRY:
 Search output claims the search ran and lines match;
 both fail silently (bad `--type`,
 masked stderr,
 `head` caps,
 `-v` filters,
 hidden/ignored skips).
Sanity-check broader,
 uncapped,
 unfiltered.

RT1:
 `rg` for text search,
 not directory navigation;
 `rg --files` for globs;
 add `--hidden`/`--no-ignore` when dot-dirs or ignored files may hold matches.

RT4:
 `gh` for GitHub issues,
 PRs,
 release notes,
 repository metadata.
```

### Batch 7, moved to single-product docs

```md
JEV:
 Wi-Fi drop debugging:
 reproduce with live link,
 supplicant,
 kernel,
 and reachability capture;
 journal silence or later recovery isn't cause.

FLK:
 One provider "Context limit exceeded" isn't a stable limit:
 measure repeated same-input outcomes before lowering global context budgets;
 prefer model-aware budgeting.
```

### Batch 8

```md
GCL:
 Before doing or reviewing cleanup of ignored files (`git clean -X`,
 artifact deletion):
 list them with `git clean --dry-run -d -X` first.

GC2:
 `git status`,
 `git ls-files --others --exclude-standard`,
 and `rg --files` hide ignored files;
 never use them as cleanup evidence.

GCR:
 Before cleanup,
 check root `HEAD`,
 `config`,
 `hooks`,
 `objects`,
 `refs` (stray git-dir entries) with `ls -d` + `git check-ignore --verbose`;
 any hit makes safe cleanup part of the finding.
```

### Batch 8, moved to `package/git-policy/cli/README.md`

```md
GCW:
 Worktree-guard reviews:
 `DEFAULT_ALLOWED_WORKTREE_DIRS` (`src/allowed-worktree-dirs.ts`) lets git-dirs under allowed dirs bypass the guard.

WXG:
 Worktree-copy incidents:
 first verify main worktrees bypass admin observation,
 recovery,
 settlement,
 and copying;
 then classify the effective source before lock analysis.
```


### Batch 9

```md
TMO:
 No external `timeout` around routine verification;
 use the command tool's session/polling and stop stale processes by PID.
Wrappers only for behavior-under-test or unbounded runtime.

NXR:
 Transport failure (`No result provided`,
 dropped session) after a command may have run:
 inspect processes + logs first;
 never repeat the same synchronous call;
 rerun in background or with a bound.

1CB:
 At most three `&&`-chained steps per shell call;
 no `;` chains or loops.
Longer multi-step work:
 write a scratch `.ts` (`node:child_process`) and run it.

RGP:
 `rg` without a path may read stdin:
 always pass `.` or an absolute path.

ATH:
 Before using `${HOME}/temp/agent` scratch:
 `mkdir --parents` it,
 then `chmod 700`;
 trust checks reject group/other permission bits.

CLN:
 Investigating package source:
 `gh repo clone <repo> "${HOME}/temp/agent/<name>-<date>" -- --depth 1`,
 not `git clone`,
 unless commit history matters.

APQ:
 Auto-push fires in third-party clones too:
 before committing in one,
 run `git remote set-url --push origin DISABLED`.

BOP:
 `~` in shell output is a display-only home-dir substitution by the `bash-output-filter` hook;
 bypass it with `eval`,
 `export`,
 `source`,
 `$(...)`,
 backticks,
 or `> file`.

WCD:
 Pin target dir on every shell command (native `-C`/`--cwd` or `cd -- <abs path> &&`).
Before alternate-worktree writes,
 verify `pwd` + `git rev-parse --show-toplevel`.

CLH:
 Before automating CLI prompts (pipes,
 PTYs,
 drivers):
 check `--help` and current docs/source for native noninteractive flags;
 prefer them over terminal emulation.

LFF:
 Use long-form (`--flag`) CLI options,
 not short flags;
 writing long form forces knowing what each does.
No long form:
 short flag stays.

RGT:
 `rg` recurses by default;
 its `-r` means `--replace`,
 so grep-reflex `rg -rl`/`-ir` silently rewrites matches in output.
```

### Batch 10

```md
HRM:
 Could an action physically harm a human or wear hardware?
 Warn first.
`ssh m1`:
 16 GiB RAM cap,
 fragile internal SSD;
 probe first,
 put write-heavy work on `/Volumes/MacData`.

RXI:
 Host-exhausting risks (heavy memory/process/fd use,
 unbounded loops,
 uncapped fan-outs,
 stress/bench/load):
 run in `podman run --memory=2g --cpus=2 --rm` or `mvm`,
 stating bounds.

BOX:
 Third-party benchmarks run mount-free,
 inputs baked into the image.

DCB:
 Never run or have agents run catastrophic commands (`sudo rm -rf /`,
 `mkfs`,
 `dd of=/dev/sda`,
 fork bombs),
 even as guardrail tests;
 test guardrails with moderately dangerous ones.

CM1:
 Narrow package work:
 run that package's task,
 never reflexive repo-root `mise run test`.

CM2:
 `mise.toml` tasks:
 sequence with `run = ["a", "b"]`,
 never `;` or `:::` chaining;
 `shell = "node --input-type=module-typescript -e"` only for logic.

CM3:
 All tasks via `mise run`;
 never `pnpm exec`,
 package scripts,
 or raw tools (`tsc`,
 `tsdown`,
 `bun test`).
No suitable task:
 add one to package `mise.toml`;
 tests may run via `node <file>` meanwhile.

CM5:
 Find tasks in root + package `mise.toml`;
 run as `mise run //package/<path>:<task>`,
 not `mise run --cd`.

CM6:
 After editing TypeScript,
 run `mise run //package/<path>:lint:types`;
 nothing type-checks automatically.

WC2:
 file-enforcer generates root files (`CLAUDE.md`,
 `mise.toml`,
 ...):
 check `file-enforcer.config.ts` before editing root config;
 if managed,
 edit its source,
 run file-enforcer,
 commit output as-is.
```

### Batch 11 (VR2 pending redraft)

```md
VRB:
 Decision verbs ("decide",
 "review",
 "audit",
 "investigate",
 "propose"...) want an answer + required docs,
 no fixes;
 action verbs ("fix",
 "implement",
 "update"...) authorize action.

DRR:
 Recommendations,
 even delegated:
 brief evidence,
 ranking,
 risks;
 proposals in `doc/planning/`;
 only explicit acceptance (not review or sub-question answers) unlocks `doc/decision/` or dependent work.

IWT:
 Deliberation requests ("review",
 "audit",
 "investigate"...):
 main worktree gets doc/report writes only;
 experiment in `git worktree add <path> HEAD`,
 removed after.

AUT:
 Auto mode's "prefer action over planning" covers executing the requested action,
 never expanding scope or acting on adjacent undecided choices.

VR2:
 Ambiguous request verb:
 take the narrower reading;
 propose the broader action explicitly.

ANN:
 Put changes where they belong immediately (other file,
 new file,
 gitignore entry);
 unsure:
 propose the concrete edit + location.

EC4:
 Never implement features that can't achieve their intended effect;
 explain the limitation instead of writing non-functional code.

XRT:
 Prefer cross-runtime patterns over Bun-specific APIs.

HOM:
 Derive current-user paths from injected home or runtime homedir,
 never a hardcoded username or `/home`;
 environment-sensitive tests inject disposable homes.

SCR:
 Never write bash/powershell scripts or `mise.<action>.ts` files;
 put task logic inline via `shell = "node --input-type=module-typescript -e"` or in a package bin.

PIN:
 Pin tool versions only with a comment explaining why.

SPG:
 Automation that spawns agent sessions needs explicit recursion guards (env var flag,
 session type filter,
 transcript size check).
```

## Next action

Walk rules batch by batch;
apply approved batches to `AGENTS.md` with a retired-code mapping.

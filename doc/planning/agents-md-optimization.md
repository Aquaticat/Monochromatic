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

## Next action

Walk rules batch by batch;
apply approved batches to `AGENTS.md` with a retired-code mapping.

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
   1300 to 1056 tokens;
   retires WK2 (into WKP) and HUP (into DCK).
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

## Open questions

- Situational rule destinations,
   pending research.

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

## Next action

Walk rules batch by batch;
apply approved batches to `AGENTS.md` with a retired-code mapping.

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

## Open questions

- Destination for situational rules.
- Rewrite scope for kept rules.
- Line-wrap format,
   pending token measurement from the rule audit.

## Next action

Finish the rule audit,
then ask the next grilling round.

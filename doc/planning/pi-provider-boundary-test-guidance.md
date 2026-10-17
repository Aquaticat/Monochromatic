# Provider request verification guidance

## Purpose

Record the proposed `AGENTS.md` clarification prompted by thinking and raw Bash reaching Luna.
Implementation and regression fixes are authorized separately and do not depend on this proposal.

## Proposed edit

Replace the existing `TCV` rule in `AGENTS.md`:

```text
# AGENTS.md proposed replacement
TCV:
 Tests cover every implementation branch.
Provider-facing tests inspect actual requests for required and excluded data.
Compare test names against branches before claiming completeness.
```

The replacement retains branch coverage and adds the actual provider request as the verification surface.
The tradeoff is an explicit request-capture requirement for provider-facing changes.
Ranking: replacing `TCV` precedes keeping its current wording because payload exclusions become testable obligations.

## User decision

Proposed to the user through the question tool on 2026-10-17.
The user chose to keep `TCV` unchanged and put the lesson in package-local documentation.
The `AGENTS.md` replacement is rejected.
The package-local verification lesson is the remaining action after the active replay finishes.

# Planning (draft): a lock for lint-rule shortcuts

Status:
 draft for review.
 Not built.
 Authored 2026-05-28.

## The problem

Agents repeatedly cut corners when a lint rule blocks them:
add an `oxlint-disable` comment,
 raise or bypass the `max-lines` limit,
reformat to silence one rule in a way that violates another (joining args,
 dropping TSDoc),
or reach for a `--no-enforce` bypass flag.
The user has to restate the principle ("infer the rules' spirit,
 fix everything properly")
session after session,
 and agents still take the shortcut.

## Root cause: the shortcut succeeds, it is not pressure

Earlier framing blamed time pressure or token limits.
That is wrong for this setup:
 there is no clock and no budget cap.
The agent already has the rule in context when it adds the disable comment;
it takes the shortcut anyway because the shortcut **works**.
A suppression makes lint go green,
 which satisfies the "make lint pass" objective
at lower effort than splitting a file across `index.ts`,
 `constants.ts`,
 and `types.ts`.

This is path-of-least-resistance against a misspecified objective,
 not scarcity.
The consequence for the fix:
 a calmer or longer prompt cannot help,
because nothing about the agent is constrained.
Only removing the shortcut's success removes the behavior.

## Why prose is the wrong tool here

`doc/planning/extract-refactor-guardrail.md` already reached this conclusion for a sibling problem:

> Prose rules buried in AGENTS.
> md / CLAUDE.
> md (already ~50k tokens) are not reliable enough.
> More prose in a long file will not change the outcome.

The repo already converted three other shortcut classes from prose into deterministic locks:

-   `bun test` is blocked by a PreToolUse guard
    (`package/claude-code-plugin/source/src/handlers/guardrail.ts`).
-   Bulk `git add -A`/`.` is rejected by the `cli-git` enforcement guard.
-   Hedge phrases and trailing questions are rejected at send time by the Stop hook
    (`package/claude-code-plugin/source/src/handlers/stop-reminders/`).

The lint-shortcut class is the same shape and has not been mechanized.
The PreToolUse path in `guardrail.ts` checks only `bun test`,
 general-purpose agents,
 and resume polling;
no hook detects an agent-introduced suppression today.

## Why lint is a closeable set, not whack-a-mole

The objection to "just add a hook" is that the next shortcut,
 and the next,
 recur forever,
only now in hook form instead of prose.
That objection holds for the general disposition and fails for lint specifically,
because cheating lint has only two observable surfaces:

1.  The diff added or loosened a suppression or a config rule.
2.  The linter still fails on the result.

Guard both doors and the class is closed by construction:
there is no third way to make lint pass dishonestly.
That is why lint is more tractable than "how you do anything is how you do everything.
"

## Proposed mechanism (one artifact, two hook points)

### Door 1: PreToolUse justification-guard on Edit/Write

Extend `guardrail.ts` (or add a sibling handler) to inspect `new_string`/`content` and deny when:

-   a newly introduced `oxlint-disable` / `oxlint-disable-next-line` lacks the `-- <justification>` token,
-   a config edit raises `max-lines`,
     removes a rule,
     or flips a rule severity from `error` to `warn`/`off`,
-   a `git` command carries `--no-enforce-bulk-add` / `--no-enforce-only` without a scoped-pathspec rationale.

The `permissionDecisionReason` is the teaching,
 delivered at the decision moment
instead of 50k tokens up where it has decayed:
split into siblings,
 re-export from `index.ts`,
 move helpers and constants and types out,
 do not suppress.
The existing deny reasons in `guardrail.ts` already read this way.

### Door 2: PostToolUse `:lint` on the edited package plus dependents

The half-built hook scoped in `doc/planning/extract-refactor-guardrail.md`.
Run oxlint and `lint:types` on the edited package and its pnpm dependents after each Edit/Write;
surface any nonzero result immediately.
This catches anything that left lint red,
 including silencing rule A by reformatting and tripping rule B.

Perf is not an objection:
 the sibling doc measured ~1.2s per package and ~12s for the full workspace.

## Honest residual the hooks cannot catch

-   The justification-guard enforces presence of a `-- reason` token,
     not its truth,
    the same way the hedge-phrase hook catches the phrase and not its validity.
    A bogus justification passes the regex.
-   Reformatting to dodge `max-lines` (joining declarations,
     dropping TSDoc) leaves lint green
    and touches no suppression or config,
     so it slips both doors.
-   "How you do anything is how you do everything",
     the general disposition,
     is genuinely unbounded
    and not hookable.

That residual is review territory.
Per the repo's anti-self-review rule (`doc/agent/self-review.md`),
it must be an independent model on the diff,
 not a same-session self-review.
The prose principle stays for the residual;
it stops being the front-line defense for the part that is mechanizable.

## Ranking of the alternatives

-   Justification-guard plus post-edit lint,
     which locks the cheap path,
     beats
-   a point-of-use nudge alone,
     which only nudges and is ignorable,
     which beats
-   more prose,
     the status quo,
     already documented as failing.

Independent diff-review is orthogonal,
 covering the unbounded residual the hooks cannot.

## The payoff

Once the guard lands,
 the corresponding lint prose in AGENTS.
md can be deleted:
the "Never violate one rule to satisfy another" / "Never loosen lint rules" / "Never disable,
 raise,
bypass the max-lines limit" rules under the "Linting" and "Simplification" headings.
The fix shrinks the 50k file instead of growing it,
which is the real improvement over restating the principle each session.

## Critical files if implemented

-   `package/claude-code-plugin/source/src/handlers/guardrail.ts`:
     add the suppression/config check
    (or a sibling handler),
     mirroring the existing deny pattern.
-   `package/claude-code-plugin/source/src/handlers/guardrail.unit.test.ts`:
     cover allow and deny cases.
-   `.claude/settings.local.json`:
     wire the PostToolUse `:lint` entry near the existing Bash-matched hooks.
-   `package/module/es/src/mise.post-edit-typecheck.ts` and its `mise.toml` task:
    the post-edit lint runner (no shell script;
     `mise.<action>.ts` per AGENTS.
    md).
-   `AGENTS.md`:
     delete the redundant Linting / Simplification prose after the guard lands.
    `CLAUDE.md` regenerates from it via file-enforcer;
     never hand-edit `CLAUDE.md`.

## Open question for review

Build scope was deferred.
 The user chose "draft plus tracking issue" over building now.
Decide on review:
 Door 1 only (smallest reviewable lock),
 both doors,
 or both plus the prose deletion.

# @monochromatic-dev/pi-goal

Private repository-owned Pi extension that keeps one explicit objective active
until an independent reviewer approves completion.
It is a stop hook,
not a task list,
background worker,
interruption manager,
or unrelated-tool policy.

## Command and tool contract

Start or replace the active goal:

```text
/goal <objective>
```

Clear the current goal record:

```text
/goal clear
```

Bare `/goal` and removed `status`,
`edit`,
`pause`,
`resume`,
and `--tokens` forms return usage diagnostics.
Starting another objective immediately supersedes active or terminal state without a confirmation dialog.
Objectives are trimmed and limited to 4,000 characters.
Put longer instructions in a file and reference that file from the objective.

The model completes work only through:

```typescript
type GoalCompleteInput = {
  readonly goal_id: string;
  readonly summary: string;
};
```

`goal_id` is only a stale-generation guard.
The completion call must be the final tool call in its assistant message.
The extension rejects missing,
stale,
contradictory,
or non-final completion calls before contacting a reviewer.
It never registers a `tool_call` blocker,
so active,
cleared,
aborted,
errored,
denied,
and review-unavailable goal states cannot block unrelated tools.

## Persistence and continuation

Goal events are branch-local Pi custom entries outside model context.
The extension reconstructs state from the selected active branch only.
Restoring or navigating into active state rotates the generation identifier but does not automatically start work.

Visible kickoff and continuation messages are extension-authored custom messages,
not human messages.
After Pi fully settles,
the extension emits at most one continuation when the exact generation remains active,
Pi is idle,
no human steering or follow-up is pending,
no live `@aliou/pi-processes` process is observed,
and the run was not aborted.
Pi-owned retries and overflow compaction finish before this decision.
A live process leaves the goal active but suppresses the goal-owned turn.
Process completion alerts retain their own configured turn behavior,
so the goal does not poll or override process notification preferences.

## Independent completion review

The primary model cannot approve its own completion claim.
The extension selects the highest expected-cost authenticated model in effective Pi scope
after excluding the active primary model.
A complete reviewer attempt uses forced structured output,
bounded direct-JSON retries,
and a ten-second timeout.
When that candidate fails transport or contract validation,
up to two distinct fallback candidates run concurrently and the first valid verdict wins.
A valid denial does not trigger another model.

Completion review sends the objective,
completion summary,
and active-branch session evidence recorded after the current goal started to another configured model provider.
This may incur provider cost and may disclose post-goal prompts,
assistant text,
and finalized tool results to that provider.
The extension does not send pre-goal history,
custom goal state entries,
or abandoned-branch history.
Oversized reviewer evidence is deterministically truncated and disclosed in the reviewer prompt.

When every configured reviewer attempt fails:

- TUI mode opens one combined `Accept` or `Reject [optional reason]` dialog.
  Escape does not settle it.
- RPC,
  JSON,
  and print modes terminate the goal as `review_unavailable` without another turn.

## Local installation

Build and verify before changing global Pi settings:

```bash
mise run //package/pi-plugin/goal:build
mise run //package/pi-plugin/goal:lint:types
mise run //package/pi-plugin/goal:lint:oxlint
mise run //package/pi-plugin/goal:test:unit
mise run //package/pi-plugin/goal:verify:extension
mise run //package/pi-plugin/goal:verify:pi-runtime
```

Inspect global package settings before migration:

```bash
pi list
```

The retired source was already absent from the observed global settings on 2026-07-17.
For that confirmed state,
skip removal and install only the repository package.
An unreferenced package directory can remain under Pi's global npm directory without being active.
Do not delete installed-package directories by hand.

If `npm:@narumitw/pi-goal` is listed on another machine,
close running Pi processes and back up `~/.pi/agent/settings.json` before replacement.
Remove only that source while Pi is stopped:

```bash
pi remove npm:@narumitw/pi-goal
```

Install globally from this checkout:

```bash
pi install /var/home/user/Monochromatic/package/pi-plugin/goal
```

Run `pi list` again.
The repository path must appear once,
`npm:@narumitw/pi-goal` must be absent,
and every unrelated package entry must remain unchanged.
Restart Pi after package settings change so no previous extension runtime remains loaded.

Do not use `pi install -l` or edit project-local `.pi/settings.json`.
All state-mutating verification uses disposable agent directories and session files.
See [the stale global blocker diagnosis](../../../doc/troubleshooting/pi-goal-stale-global-blocker.md)
for the retired package's exact failure path and temporary recovery options.

## Rollback

Remove only the repository package:

```bash
pi remove /var/home/user/Monochromatic/package/pi-plugin/goal
pi list
```

Restart Pi after removal.
For the confirmed pre-migration state,
this restores a package-free goal configuration while preserving unrelated global entries.
It does not restore the retired command behavior.
If another machine replaced a configured legacy package,
restore its backed-up package list only while Pi is stopped and inspect every unrelated entry.

Reinstalling `npm:@narumitw/pi-goal` restores a package with a goal-owned `tool_call` blocker
and is not the supported rollback.
For isolated diagnosis only,
install it explicitly,
reproduce in a disposable session,
then remove it again:

```bash
pi install npm:@narumitw/pi-goal
pi remove npm:@narumitw/pi-goal
```

# Slint IDE 0.x scope interview

## Status

Grilling in progress.
No implementation is authorized until the user confirms shared understanding at the end of the interview.
This is a proposal record,
not an adoption decision.

## Explicit requirements

- Build an IDE with Slint.
- Refer to the paused editor at `package-paused/desktop-daemon/editord`.
- Cut the 0.x scope ruthlessly.
- Actual text editing is not needed.
- Follow-up clarification:
  "No changes to files via any way is needed in 0.x".
  Exclude file-mutation workflows whether performed directly or delegated to another process.
- Resolve the design through a grilling interview before implementing.

Slint is settled as the UI toolkit.
Host language,
process architecture,
and dependencies are not selected.
No promise of editing in a later version is implied.

## Reference evidence

- [Paused editor README][editor-readme]:
  browser frontend plus daemon;
  search,
  filesystem operations,
  language services,
  recent files,
  and keyboard navigation.
- The README's `JetBrains parity` section calls every behavioral difference a bug.
  Whether that constraint transfers to retained features is an open question.
- [WebStorm comparison][comparison]:
  the recorded reason to retain editord shifted from scrolling to freshness.
  This is historical project rationale,
  not a newly verified claim about current WebStorm behavior.
- The comparison's `The condition: fuzzing earns the keep` section identifies unverified watcher edges
  and a self-save suppression window.
  Do not inherit its stronger correctness-by-construction claims as proof.
- [Current watcher source][watcher]:
  filesystem watching includes orphan-temp deletion and event suppression.
  Reusing a watcher does not automatically produce a read-only application.
- [Current keybindings][keybindings]:
  navigation and copying coexist with saving,
  formatting,
  rename,
  line edits,
  and launching an external terminal.
  Removing typing alone would not remove mutation or process-execution surfaces.
- [Implementation plan][editor-plan] records delivered phases;
  [TODO][editor-todo] records watcher concurrency,
  protocol liveness/backpressure,
  observability,
  and UI gaps.
  Neither is adopted wholesale as the new backlog.
- `uname --kernel-name --machine` reports `Linux x86_64` for the current host.
  This establishes an available environment,
  not the user's desired release-platform support.

The paused package remains untouched during the interview.
No deprecation,
replacement,
or code-reuse commitment is made.

## First-round decision frontier

### Q1: useful workflow

What concrete task should justify opening this application rather than the existing tools?
Name a primary workflow and any ordered secondary workflow.
Reading and navigating source,
reviewing changes,
and observing externally running agents or tasks are distinguishable jobs,
not mutually exclusive product identities.

Provisional recommendation:
live source reading and navigation while changes happen elsewhere.
This follows the reference's freshness rationale and does not imply an accepted feature list.
Change review adds comparison-state requirements;
observing external agents or tasks adds session-discovery and status requirements.
Neither extra responsibility is accepted by the original request.
Agent or task control that mutates files is excluded by the follow-up clarification.

### Q2: file mutations, settled

The user excludes file changes through any mechanism for 0.x.
Cut editing,
formatting,
refactoring,
file creation,
rename,
move,
delete,
Git writes,
and delegated mutation through agents or commands.
A terminal or task launcher must not reintroduce these workflows.
Read-only observation of externally running work remains a separate possibility.

This is a product scope decision,
not evidence of sandbox enforcement.
Clipboard copying is not project-file mutation.
No application-private persistence requirement has been accepted;
resolve settings,
logs,
caches,
and session-state writes if a surviving workflow needs them.

### Q3: behavioral inheritance

For retained features,
is editord's JetBrains behavior a strict compatibility requirement or a familiar reference?

Recommendation:
preserve chosen familiar interactions,
not an exhaustive parity obligation.
Exact shortcuts and interaction contracts depend on which features survive.

### Q4: release platforms

Which operating systems must pass acceptance for 0.x?

Recommendation:
Linux on the current workstation first;
no claim of macOS or Windows support before testing them.
This does not require intentionally non-portable implementation.

### Q5: filesystem location

Must 0.x operate on remote projects,
or can it accept only local filesystem projects?

Recommendation:
local projects only.
Remote connection management is separate from choosing the release operating systems.
Mounted remote filesystems need an explicit later acceptance boundary,
not an accidental local-path loophole.

## Downstream decisions

Recompute the frontier after the user's answers.
Do not ask feature-specific questions before the primary job is settled.

- Workflow determines the minimum end-to-end acceptance scenario and feature cut list.
- Mutation and execution boundaries determine what read-only means at the user boundary.
- Chosen navigation features determine language-service and text-interaction requirements.
- Supported environments determine deployment and native-integration acceptance.
- Requirements determine code reuse,
  host language,
  libraries,
  and process boundaries;
  do not ask the user to substitute for source research.
- Retained reference behavior determines interaction contracts and freshness tests.
- The final scope must distinguish the first shippable slice from the rest of 0.x.
- Implementation starts only after explicit confirmation of shared understanding.

## Next action

Q2 was answered before the first question round was presented.
Present Q1 and Q3 through Q5,
renumbering the user-facing round consecutively,
and wait for answers.
Record each answer before opening the next dependent decisions.

[editor-readme]: ../../package-paused/desktop-daemon/editord/README.md
[comparison]: ../../package-paused/desktop-daemon/editord/docs/decisions/webstorm-comparison.md
[watcher]: ../../package-paused/desktop-daemon/editord/src/server/operations/watch-filesystem.ts
[keybindings]: ../../package-paused/desktop-daemon/editord/src/client/app/keybindings.ts
[editor-plan]: ../../package-paused/desktop-daemon/editord/PLAN.md
[editor-todo]: ../../package-paused/desktop-daemon/editord/TODO.md

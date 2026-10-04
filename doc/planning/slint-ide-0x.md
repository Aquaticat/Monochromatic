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
- Primary workflow:
  live source reading and navigation while changes happen elsewhere.
- Use editord as a familiar reference,
  documenting every deliberate behavioral difference.
- Support the current host only for 0.x.
- Support local filesystem projects only.

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
  The user explicitly replaces that obligation with familiar-reference behavior and a complete difference record.
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
  The user selected the current host as the sole 0.x acceptance target.
  Probe the actual desktop session and display configuration before native UI verification.

The paused package remains untouched during the interview.
No deprecation,
replacement,
or code-reuse commitment is made.

## Settled interview decisions

### File mutations

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

This is a product scope decision,
not evidence of sandbox enforcement.
Clipboard copying is not project-file mutation.
No application-private persistence requirement has been accepted;
resolve settings,
logs,
caches,
and session-state writes if a surviving workflow needs them.

### Round 1 answers

- Q1:
  A,
  live source reading and navigation.
  Change-review and agent-observation workflows are not part of the selected starting scope.
- Q2:
  familiar reference,
  with every deliberate difference documented.
  Exact parity for retained features is rejected.
- Q3:
  current host only.
  Generic Linux support and other operating systems are not acceptance promises.
- Q4:
  local only.
  Do not add SSH,
  remote-daemon,
  or mounted-network-filesystem acceptance implicitly.

## Behavior-difference register

This register is required by the user.
Entries describe the intended scope,
not implemented or verified behavior.
Record every later departure with the reference behavior,
replacement behavior,
reason,
and acceptance check before implementing it.
Preserve a complete record when the plan moves into package documentation.

### UI platform

- Reference:
  editord serves a browser frontend;
  [its philosophy][editor-philosophy] relies on browser-provided find,
  zoom,
  selection,
  printing,
  and accessibility behavior.
- New scope:
  Slint UI on the current host.
  Browser-provided features are not automatically inherited;
  required replacements must be selected and tested explicitly.
- Reason:
  user-selected toolkit and host boundary.
- Acceptance:
  run the actual native artifact on the current desktop session.
  No browser facility counts as provided merely because editord had it.

### Mutation commands and hidden writes

- Reference:
  keybindings expose save,
  format,
  rename,
  and line edits;
  the filesystem service also mutates files.
  The watcher deletes orphaned atomic-write temporary files.
- New scope:
  no file-mutation workflow or delegated mutation.
  Do not reuse the watcher's cleanup side effect.
- Reason:
  explicit 0.x no-write requirement.
- Acceptance:
  disposable-fixture checks exercise retained UI commands and file-open/watch paths,
  verifying that application activity does not change fixture contents or directory entries.
  This alone does not prove an OS sandbox or absence of writes elsewhere.

### Compatibility contract

- Reference:
  README declares every JetBrains behavioral difference a bug.
- New scope:
  selected familiar behavior plus an explicit record of every difference.
  Feature-specific contracts are pending the next rounds.
- Reason:
  user accepted familiar-reference behavior rather than exhaustive parity.
- Acceptance:
  compare implemented commands,
  shortcuts,
  navigation,
  search,
  reload behavior,
  and omissions against the reference and this register.

## Round 2 frontier

### Q5: language intelligence

Would file and text navigation without language services be useful for 0.x?
If not,
select the indispensable capabilities separately:
semantic definition jumps,
references,
hover types or documentation,
inline hints,
and diagnostics.

Recommendation:
cut language services unless their absence defeats the selected reading workflow.
Text matches must never be described as semantic references.
Languages and server choices depend on this answer.

### Q6: syntax highlighting

Is syntax coloring a release requirement independent of language intelligence?

Recommendation:
plain text for the first agreed 0.x scope unless syntax coloring is essential to actual use.
Highlighting languages and implementation feasibility depend on this answer.
Plain text still needs readable typography,
selection,
copying,
and navigation.

### Q7: finding files and code

Which discovery surfaces are necessary:
combined file-path and content search,
a browsable file tree,
or both?

Recommendation:
search first without a tree.
Ranking:
search only > both > tree only.
Search only avoids a second discovery surface;
both supports browsing without known search terms;
tree only loses project-wide content discovery.
This is a proposed difference from editord,
not an accepted cut.

### Q8: external-change policy

When a viewed file changes externally,
should the view update immediately,
hold the displayed version while text is selected,
or require explicit reload?

Recommendation:
automatic refresh with a visibly marked temporary hold while selecting text.
Ranking:
selection hold > unconditional refresh > manual reload.
Selection hold protects reading and copying;
unconditional refresh avoids stale state but can interrupt selection;
manual reload makes freshness depend on user action.
Define delete,
rename,
read-failure,
and replacement-file behavior after this policy is settled.

### Proposed floor and additional cuts

Propose one local project root,
one window,
one file view,
line numbers,
selection/copy,
in-file find,
and go-to-line.

Propose cutting tabs,
split panes,
media or rendered-document previews,
and persistent session restore.
These are veto-open proposals presented with the round,
not accepted requirements.
Do not silently expand the selected live-source workflow into change review or process supervision.

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

Present Q5 through Q8 and the proposed floor/cuts.
Invite explicit objections to the floor/cuts in the same round.
Wait for answers and record them before opening dependent decisions.

Planning history:
`c5654c5e1` introduced the record;
`c37f58ca5` fixed semantic line breaks;
`3cf1e698c` applied the no-write requirement to candidate workflows.
The initial record passed scoped Markdown lint and a micromark rendered-output check.
Repeat both after this round's update.

[editor-readme]: ../../package-paused/desktop-daemon/editord/README.md
[editor-philosophy]: ../../package-paused/desktop-daemon/editord/PHILOSOPHY.md
[comparison]: ../../package-paused/desktop-daemon/editord/docs/decisions/webstorm-comparison.md
[watcher]: ../../package-paused/desktop-daemon/editord/src/server/operations/watch-filesystem.ts
[keybindings]: ../../package-paused/desktop-daemon/editord/src/client/app/keybindings.ts
[editor-plan]: ../../package-paused/desktop-daemon/editord/PLAN.md
[editor-todo]: ../../package-paused/desktop-daemon/editord/TODO.md

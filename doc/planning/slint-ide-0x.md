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
- Require go-to-definition,
  find references,
  hover types/documentation,
  inlay hints,
  and diagnostics.
- Require syntax highlighting.
- Keep combined file-path/content search and a browsable file tree.
- Refresh automatically during external changes,
  including while text is selected.
  Preserve the user's position within surviving text.
- Do not include a go-to-line command.

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
  Selected environment variables report Wayland and KDE for the desktop session.
  Probe actual display configuration before native UI verification.

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

### External updates and read-only caret

- Reference:
  `src/client/app/events.ts` in editord calls the file loader on an external modification;
  `src/client/app/file-loader.ts` replaces displayed text.
  These call sites do not establish the new caret-preservation contract.
- New scope:
  update automatically without a selection hold.
  Preserve caret location within surviving text rather than the old numerical offset.
  The user explicitly accepts brute-force work to achieve this behavior.
- Reason:
  explicit Q8 answer and subsequent caret example.
- Acceptance:
  display `I am a big cat.` with caret `I am a bi|g cat.`;
  externally replace `am` with `was`;
  after refresh the caret is `I was a bi|g cat.`.
  The marker is not document content.
  Repeated text,
  changed caret context,
  selection mapping,
  and viewport anchoring need further acceptance cases.

### Go-to-line command

- Reference:
  the proposed new baseline included a go-to-line command.
  editord also navigates to positions supplied by search and language services.
- New scope:
  no user-invoked go-to-line command.
  Search-result,
  definition,
  and reference navigation still target source positions.
- Reason:
  explicit user cut.
- Acceptance:
  omit the command and shortcut without removing position-based navigation required by retained features.

## Round 2 answers

- Q5:
  all listed language-intelligence capabilities are required at minimum.
  A text-only navigator is not useful.
  The proposed no-language-service cut is rejected.
- Q6:
  syntax highlighting is indispensable.
  The proposed plain-text cut is rejected.
- Q7:
  B,
  both search and tree.
  The proposed search-only cut is rejected.
- Q8:
  automatic refresh,
  explicitly without holding while text is selected.
  Try to preserve current relative position and brute-force the work where necessary.
  The follow-up example establishes content-anchored caret mapping,
  not fixed offsets or fractional scrolling.
- Baseline correction:
  remove go-to-line.

Carry forward the rest of the proposed floor for final confirmation:
one local root,
one window,
one file view,
line numbers,
selection/copy,
and in-file find.

Carry forward the proposed cuts for final confirmation:
tabs,
split panes,
Git/status/diff UI,
agent/task dashboards,
media or rendered-document previews,
and persistent session restore.
The user did not request additions to these areas.

## Round 3 frontier

### Q9: semantic languages

Which languages require all retained language-intelligence capabilities?
The paused editor's language-service configuration targets JavaScript/TypeScript intelligence;
its highlighter recognizes additional languages independently.

Recommendation:
JavaScript/TypeScript including JSX/TSX as the initial semantic scope.
Ask for indispensable additions rather than assuming every language in this monorepo needs semantic support.

### Q10: highlighting languages

Which languages require syntax highlighting even without semantic support?
The current editord parser registry includes JavaScript/TypeScript and JSX/TSX,
JSON-family files,
CSS,
HTML,
Markdown,
YAML,
TOML,
Rust,
XML,
and SVG.

Recommendation:
retain that coverage as the acceptance target,
with readable plain text for unrecognized types.
This is a coverage proposal,
not a commitment to reuse the existing parser implementation.

### Q11: diagnostic scope

Must diagnostics cover only the displayed file,
or does 0.x need a project-wide problems view?

Recommendation:
displayed-file diagnostics only.
This limits the application UI contract,
not what files a language server may internally analyze.
Diagnostic source selection follows the semantic-language answer.

### Q12: replaced caret context

The user's unchanged-context case is settled.
If the text containing the caret is itself replaced,
what fallback is acceptable?

Recommendation:
place the caret at the start of the changed region when no corresponding interior position survives.
Preserve selection endpoints when they map to surviving text;
otherwise clear the affected selection rather than silently select replacement text.
No outcome blocks refresh.
This fallback remains a proposal pending the user's answer.

### Q13: inlay placement

The paused editor renders hint labels on rows above the source line,
not inserted between source tokens.
Its `src/client/inlay/line.ts` packs hints onto annotation rows by source position.

Recommendation:
retain the above-line hint presentation.
The alternative is visually inserted inline hints;
this is independent of which hint categories are enabled.
Diagnostic presentation is a separate decision,
not bundled into this choice.

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

Present Q9 through Q13.
Treat the supplied caret example as settled,
not a question to reopen.
Wait for answers and record them before opening dependent decisions.

Round 3 evidence:
`git ls-files` over `package`,
`package-paused`,
and `doc` yielded 9,904 tracked paths,
including 5,337 `.ts`,
427 `.rs`,
and 65 `.kt` paths.
These are extension counts,
not complete language counts or a claim about untracked/ignored files.
The result motivates asking about semantic language coverage rather than inferring it from repo contents.

Planning history:
`c5654c5e1` introduced the record;
`c37f58ca5` fixed semantic line breaks;
`3cf1e698c` applied the no-write requirement to candidate workflows;
`9f1894d94` recorded Round 1 answers and the difference contract.
The initial and Round 1 records passed scoped Markdown lint and micromark rendered-output checks.
Repeat both after this round's update.

[editor-readme]: ../../package-paused/desktop-daemon/editord/README.md
[editor-philosophy]: ../../package-paused/desktop-daemon/editord/PHILOSOPHY.md
[comparison]: ../../package-paused/desktop-daemon/editord/docs/decisions/webstorm-comparison.md
[watcher]: ../../package-paused/desktop-daemon/editord/src/server/operations/watch-filesystem.ts
[keybindings]: ../../package-paused/desktop-daemon/editord/src/client/app/keybindings.ts
[editor-plan]: ../../package-paused/desktop-daemon/editord/PLAN.md
[editor-todo]: ../../package-paused/desktop-daemon/editord/TODO.md

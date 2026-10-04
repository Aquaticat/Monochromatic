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
  Best-effort content-relative caret/selection mapping and approximate viewport anchoring should minimize visual location loss.
  Exact pixel preservation and universal mapping through rewritten text are not required.
  Selected ranges follow corresponding replaced regions,
  not a later occurrence of the old selected text.
- Do not include a go-to-line command.
- Determine language coverage from actual `tokei` output,
  bounded by Helix support.
  Do not add custom integrations for languages missing from Helix.
- Keep the paused editor's highlighting coverage where supported by Helix.
- Display diagnostics for the current file only;
  omit a project-wide problems view.
- Choose inlay placement by implementation evidence;
  the user delegates this choice rather than requiring either proposed presentation.
- Helix-owned components are preapproved candidates.
  The user explicitly requests no broad choosing-technology exercise for this task.
  Inspect only the integration APIs,
  relevant behavior,
  and license obligations needed for reuse.

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
  Prefer corresponding positions in surviving text over the old numerical offset.
  The user explicitly accepts brute-force work to achieve this behavior.
  The later clarification makes mapping and viewport anchoring best effort:
  roughly the same viewport position is sufficient;
  minimize location loss for human eyes.
- Reason:
  explicit Q8 answer and subsequent caret example.
- Acceptance:
  display `I am a big cat.` with caret `I am a bi|g cat.`;
  externally replace `am` with `was`;
  after refresh the caret is `I was a bi|g cat.`.
  The marker is not document content.
  Also display `I am a big cat` with selection `I [am a] big cat`;
  externally replace the file with `I was a big cat, but now I am a human!`;
  after refresh the selection is `I [was a] big cat, but now I am a human!`.
  Brackets denote selection and are not document content.
  Do not jump to the later literal `am a` or clear the selection merely because the selected words changed.
  These supplied examples are concrete expected outcomes;
  best effort governs genuinely ambiguous rewrites and approximate viewport placement.
  Add repeated-text,
  replaced-context,
  selection,
  and viewport cases without asking the user to prescribe a fallback algorithm.
  No case may block refresh while selection exists.
  Native caret and viewport behavior still require a Slint consumer-boundary probe.

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
  The user then clarifies that preservation is best effort,
  roughly the same viewport position is sufficient,
  and minimizing visual location loss is the goal.
  No further preference question about deleted-context fallback is needed.
  A subsequent selection example requires mapping `am a` to the replacement `was a`,
  while ignoring a new literal `am a` later in the document.
  Preserve the selected region's correspondence through edits,
  not its original string value.
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

## Round 3 answers

- Q9:
  measure with `tokei` and support the languages the user actually uses.
  Do not ask the user to supply an inventory that can be measured.
- Q10:
  keep highlighting coverage.
- Q11:
  displayed-file diagnostics only.
  Server-internal project analysis is not restricted by this UI cut.
- Q12:
  choose whichever inlay placement is easier to implement.
  Do not assume the earlier above-line recommendation is accepted;
  determine the implementation path from Slint and reusable component evidence.
- Follow-up dependency direction:
  Helix components are preapproved;
  no broad dependency-selection exercise is requested.
  This is not authorization to embed every Helix subsystem or copy its editing/keybinding model.
- Follow-up language ceiling:
  any language missing from Helix is unsupported in 0.x.
  Do not develop custom integrations to fill that gap.

## Measured language scope

### Inventory method and limits

Ran `tokei 15.0.0` through a disposable `mise run inventory` task,
first with ordinary ignore behavior,
then including hidden files.
The hidden-file run also counted Git hooks;
repeat with `--hidden --exclude .git --output json` excluded Git internals,
verified by zero report paths containing `/.git/`.

The final pass respects ignore files and includes active,
paused,
and deprecated packages plus documentation.
It is not a tracked-files-only or handwritten-code-only census.
Generated TypeScript and JSON benchmark reports contribute to counts.
A `.js` ignore pattern may hide genuine tracked source;
do not interpret absent reports as proof a language is unused.

Standalone file languages are the base inventory.
Embedded code fences are reported separately:
Go,
Python,
Java,
and other documentation examples do not automatically add full semantic-language requirements.

Raw evidence and task definition are in the private scratch directory
`~/temp/agent/slint-ide-languages.mEr8K9`.
The durable findings are recorded here so the plan does not depend on scratch retention.

### Standalone counts from the corrected pass

- TypeScript:
  5,380 files and 608,892 code lines.
- Rust:
  427 files and 43,248 code lines.
- Kotlin:
  70 files and 5,892 code lines.
- JavaScript:
  57 files and 4,758 code lines.
- Slint:
  2 files and 1,848 code lines.
- QML:
  8 files and 484 code lines.
- HCL:
  1 file and 722 code lines.
- SQL:
  7 files and 521 code lines.
- Shell:
  5 files and 351 code lines.
- C:
  1 file and 208 code lines,
  a troubleshooting reproducer.
- C++:
  1 file and 17 code lines,
  the Qt logging bridge.
- Batch:
  2 files and 128 code lines,
  both Gradle wrappers.
- Other standalone families:
  JSON,
  TOML,
  YAML,
  HTML,
  CSS,
  Markdown,
  MDX,
  XML,
  SVG,
  Dockerfile,
  and plain text.

Do not rank the user's language needs by raw code-line totals:
generated data distorts those totals,
and the user requested coverage rather than a popularity threshold.

### Helix boundary evidence

Inspected upstream `languages.toml`,
`Cargo.toml`,
and `LICENSE` from `helix-editor/helix`.
Upstream master observed at `ba40e547426b0f9896c8bdc699a4ab11f2b37dbc`;
the corresponding language-registry blob is `a5403e68b1f7fd9fb7a9924d464d09c08c1be264`.
The fetched workspace manifest and license identify MPL-2.0;
preserve applicable source and license notices for reused components.

Registry mappings include these non-identical names:
Shell maps to `bash`,
C++ to `cpp`,
SVG to `xml`,
and `.mdx` to `markdown`.
A `.mdx` association is not proof of complete JSX-aware MDX semantics.

The inspected registry contains language entries for the standalone source/markup families in the inventory.
However,
its SQL,
XML/SVG,
and Batch entries do not specify a language server.
Grammar recognition and highlighting are not equivalent to support for all semantic features.
Configured servers for other entries are not proof that their executables are installed or every capability works.

## Remaining scope questions

### Q13: Helix ceiling per capability

Does the Helix ceiling apply to individual language-intelligence capabilities as well as language names?

Recommendation:
implement the five required feature paths in the app,
use the capabilities available for each supported language,
and explicitly report unsupported capabilities.
Languages with Helix grammar support but no language server remain highlight/read/search-only.
Do not invent custom semantic backends to make every feature universal.
This interpretation needs confirmation rather than silently weakening Q5.

### Q14: application-private writes

Does the no-write boundary allow disposable application/tool caches outside the project,
or forbid those as well?

Recommendation:
no project-file mutations,
no arbitrary task execution,
and no persistent session-restore feature;
permit explicitly scoped private temporary/cache storage if integration requires it.
This is a proposed boundary,
not a claim that selected tools already comply.
Inspect and exercise subprocess writes before implementation is accepted.

## Agent-owned implementation investigation

These are engineering responsibilities,
not questions to hand back to the user.

- Design full-file refresh with old/new text reconciliation.
  Investigate contextual old/new edit correspondence for caret,
  selection ranges,
  and a visible source-line anchor.
  Simple substring relocation is insufficient:
  replaced selections must expand or contract with their corresponding replacement,
  even when the old string reappears elsewhere.
  Use deterministic nearby fallbacks when correspondence is genuinely ambiguous.
  Brute-force allowance does not justify blocking the UI or unbounded work.
- Verify selectable highlighted text,
  annotations,
  hit testing,
  caret placement,
  and viewport anchoring through Slint before committing to a renderer design.
- Verify actual language-server capabilities and user-visible behavior for every selected language.
  Existing wrappers and completed-plan checkboxes do not establish current server support.
- Keep stale language-service results from being presented as current after external file updates.
  Caret mapping is application-owned;
  language-server document synchronization is a separate lifecycle to verify.
- Inspect writes from any selected language server or helper.
  A read-only UI does not prove subprocesses leave files unchanged.
- Establish search-result freshness and stale-target navigation behavior.
- Probe file-size and directory-size behavior using disposable fixtures and explicit resource bounds.

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

Present the measured language inventory and Q13/Q14.
Do not reopen language enumeration,
current-file diagnostic scope,
inlay preference,
or the caret/selection examples.
Then consolidate the scope for explicit shared-understanding confirmation before implementation.

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

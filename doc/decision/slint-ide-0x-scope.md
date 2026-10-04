# Read-only Slint IDE 0.x scope

## Accepted decision

The user confirmed the [consolidated scope][scope] after a grilling interview.
Build a Slint desktop application for reading and navigating live local source code on the current host.
Actual editing and all direct or delegated project-file mutation are excluded from 0.x.

The user reviewed the implementation approach and explicitly authorized implementation.
Scope acceptance does not turn an untested integration into a verified design.
The [implementation plan][implementation] and [handover][handover] record progress separately.

## Required capabilities

- One local project root,
  one window,
  and one source-file view.
- File tree,
  combined file-path/content search,
  and in-file find.
- editord-compatible Ctrl+0 through Ctrl+9 recent-file navigation.
  Slot 0 is current;
  selecting another slot promotes it to 0 and updates tree recency badges.
  Reveal the selected file by expanding its ancestors.
  Unfilled slots are no-ops.
  History is session-local;
  persistent session restore remains excluded.
- Syntax highlighting,
  line numbers,
  read-only caret and selection,
  and copying.
- Bundled JetBrains Mono for source text and Inter for UI text,
  including the font faces used by the application and their license notices.
- Light/dark appearance follows the system at startup and when its preference changes.
  No application-specific theme override.
- Go-to-definition,
  references,
  hover information,
  inlay hints,
  and diagnostics for the displayed file.
- Capability-aware language support based on measured use and bounded by Helix support.
  No custom integrations for languages missing from Helix.
  Code-fence examples alone do not add language-server integrations.
- Automatic external-change refresh,
  including while text is selected.
  Best-effort caret/selection correspondence and approximately stable viewport placement minimize visual location loss.
- Private application/tool cache and temporary storage outside the project is allowed.

## Required correspondence examples

The marker `|` denotes the caret,
not file content.

- Before:
  `I am a bi|g cat.`
- External change:
  replace `am` with `was`.
- After:
  `I was a bi|g cat.`

Brackets denote selection,
not file content.

- Before:
  `I [am a] big cat`
- External replacement:
  `I was a big cat, but now I am a human!`
- After:
  `I [was a] big cat, but now I am a human!`

Selection follows the corresponding replaced region,
not a later occurrence of the old literal string.
These are concrete acceptance cases;
best effort governs ambiguous rewrites and approximate viewport placement.

## Explicit exclusions

- Editing,
  saving,
  formatting,
  refactoring,
  filesystem mutation commands,
  and delegated project mutations.
- Go-to-line command;
  search and semantic navigation still target source positions.
- Tabs,
  split panes,
  and multiple project roots.
- Git/status/diff UI,
  terminal/task control,
  and agent dashboards.
- Project-wide problems view.
- Media and rendered-document previews.
- Persistent session restore.
- Remote filesystem support and additional platform promises.

## Reuse and reference policy

`package-paused/desktop-daemon/editord` is a familiar behavioral reference,
not an exhaustive JetBrains compatibility contract.
Document every deliberate difference,
including omitted behavior.
The paused package remains untouched unless a later request explicitly changes its lifecycle.

The user preapproves Helix-owned components and waives a broad dependency-selection exercise for this task.
Inspect relevant integration behavior and comply with the licenses of reused code.
Do not import Helix's modal interaction model or whole editor merely to reuse its internals.

Inlay placement is delegated to the agent:
choose the implementation supported by evidence,
not an assumed presentation preference.

## Verification boundary

Completion requires the actual native application,
actual language-server feature paths,
external-update correspondence cases,
and disposable-fixture verification of project-write restrictions.
Compilation,
upstream configuration entries,
and unit tests alone do not establish completion.

[handover]: ../handover/slint-ide-0x.md
[scope]: ../planning/slint-ide-0x.md
[implementation]: ../planning/slint-ide-implementation.md

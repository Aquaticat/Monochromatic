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
- Prefer the official variable fonts for JetBrains Mono and Inter,
  including separate real italic faces for both families.
  Correct typography includes ligatures and supported font settings;
  synthesized slant or bold must not substitute for available real faces or axes.
  Ligature shaping must not break caret positions,
  hit testing,
  partial selection,
  or copying of the underlying source characters.
- Light/dark appearance follows the system at startup and when its preference changes.
  No application-specific theme override.
- True pixel-level smooth scrolling,
  including eased movement for a notched mouse wheel,
  matching editord's retained behavior.
- Mixed-script source text,
  including CJK and Latin on one line,
  must share correct baseline and hit-test geometry.
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

## Minimal interface

Use as few visible UI elements as practical.
The user explicitly rejected the persistent read-only indicator and Copy button as useless.
Do not replace them with equivalent badges,
toolbars,
or permanent instructions.
Copy remains available through the familiar keyboard shortcut;
read-only semantics remain available to accessibility tools.

Do not show implementation diagnostics such as revisions and selection offsets in routine chrome.
Retain visible elements only for useful source/project context,
required navigation,
or actionable problems.
An actual error may appear when needed without reserving an always-visible status bar.

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

Inlay placement was delegated to the agent:
choose the implementation supported by evidence,
not an assumed presentation preference.
The user ended that delegation on 2026-10-05 after seeing the built result;
the placement is now the one recorded under "Interface decisions (inlay hints and diagnostics)".

## Decisions of 2026-10-05

The user answered these during the delegated continuation;
quotations are the user's words.

- In-file find uses plain literal,
  case-insensitive substring matching:
  "why would we need to vet a find matcher?
  Isn't it just substring match?"
  Chrome's collation folding is a recorded difference,
  not a target.
- TypeScript language features use the project's own TypeScript 7 server (`tsc --lsp --stdio`).
- Language servers are confined with bubblewrap as measured,
  without a formal vetting run,
  with a process-id namespace except for the TypeScript servers.
- Confined language servers have no network access:
  "Why would language servers have network access?
  That (giving language servers network access) would be extremely bad and against any kind of intuition."
  TypeScript projects take types from installed `node_modules`;
  automatic type acquisition,
  which downloads `@types` packages for JavaScript projects,
  is off.
- Directory and displayed-file refresh become event-driven with OS file-change notifications:
  "I'm approving the notify crate w/o vetting.
  I trust it."
  This approval covers the `notify` crate itself.
- File-watching timing,
  decided after the agent's measurements:
  the safety re-read of everything shown runs every 1 s
  (the user typed "Every 1s" instead of the offered 10 s,
  paced,
  and 30 s);
  two notified re-reads of one item stay at least 100 ms apart;
  a file that is still being written is read after 50 ms without further writes,
  at most 100 ms after the first
  (instead of the 150 and 250 ms the agent took from editord and the old polling interval).
- Moving between outputs with different scaling is verified end to end:
  the nested test compositor gains runtime output scaling first.
- The nested test compositor's private D-Bus session must not activate services from host service definitions.
- The `pi` second-opinion model is skipped for this work.
- Runtime grammars stay at the measured inventory plus the companions it needs:
  the 74 tracked files whose types Helix recognizes but `tokei` does not count
  (patches,
  ignore and attribute files,
  ini,
  properties,
  Caddyfile,
  Ghostty and git configuration)
  stay plain text;
  the TSX and AWK grammars stay bundled.
- The Slint grammar ships its `LICENSES/` texts plus the copyright lines extracted from its source headers.
- Final binary and asset size is not a constraint for this package:
  "final bin size isn't a constraint on this specific package."
- Projects under `/tmp` and `/run`
  (including removable drives under `/run/media`)
  get full language support:
  "We gotta support projects in /tmp and /run properly.
  Read-only is just 0.x .
  We will build in write in 1.x".
  The sandbox binds the project back at its own path,
  read-only in 0.x;
  the launch policy keeps that mount in one place so a 1.x write mode can change it.
- The language-server environment allowlist keeps `RUSTUP_TOOLCHAIN`,
  so the server uses the toolchain of the shell that started the IDE.
- Slint's black-on-blue dark selected-text ink is not filed upstream by an agent;
  issue #606 in this repository reminds the user to raise it with Slint.
- UI questions are presented with screenshots of every option,
  stored as local files in the repository rather than a network service:
  "These are useful records that shouldn't depend on a network service to be available."

### Interface decisions (UI batch 2)

Every option was shown as built screenshots:
`package/desktop-app/ide/design/questions/2026-10-05-ui-batch-2.html`,
with frames in `package/desktop-app/ide/design/screenshots/2026-10-05-ui-batch-2/`.

- The sidebar divider is a thin line with no strip (option B):
  "The 48px rule came from Android and focus on touch targets.
  Losing easily dragging the divider support on touch screens also isn't going to impact this specific app."
  The pointer grab zone is narrow and sized from desktop precedent checked against sources,
  not the prototype's 48 px zone over the tree and the source;
  that sizing was announced by the agent and is open to the user's veto.
- The divider's smaller target is an exception for that one element,
  not for the application:
  "'Target size is not a concern on this desktop app' is wrong.
  It depends on the situation.
  For this specific app,
  we're supporting desktops only;
  there are desktops with touch screens,
  but all desktops have touchpads/mice and a keyboard;
  grabbing the divider and changing where it's at is a very infrequent action;
  we're already committed to supporting changing where it is at both by mouse and keyboard.
  Only because all these conditions are met that we were able to bend the 48 x 48 rule for that specific element."
- The divider stays a keyboard Tab stop (option A).
- The clear button in the find and search boxes stays,
  with a click or touch target of at least 48 by 48:
  "Keep it and make it at least 48 x 48."
  A target is its hit area:
  "Please understand what a click/touch target is.
  That includes invisible padding."
  The toolkit's control has a hit cell 16 px wide and as tall as the box
  (measured in `i-slint-compiler` 1.18.1,
  `widgets/fluent/lineedit.slint` and `widgets/common/lineedit-base.slint`),
  and its width cannot be set from outside,
  so the application gets its own text box with its own clear cell.
- The find bar stays keyboard only (option A):
  no previous,
  next,
  or close buttons.
- Selected rows in the tree,
  the combined-search list,
  and the references list draw white text on the blue selection fill in both schemes (option B),
  the same rule as selected source text.

### Interface decisions (inlay hints and diagnostics)

The agent had placed hints in boxes after the end of their code line,
because that placement moves no source text
(frames in `package/desktop-app/ide/design/screenshots/2026-10-05-annotations-as-built/`).
The user rejected it:
"On inlay hints:
Do not show them inline.
Show them on another virtual line,
like what editord does."

- Inlay hints go on virtual rows above their code line,
  each hint above the position it annotates,
  as `package-paused/desktop-daemon/editord/src/client/inlay/line.ts` packs them.
- The known cost is accepted with that decision:
  hinted lines are taller,
  so rows beneath move when hints arrive.
  The implementation limits that movement and measures what remains.
- Diagnostic messages go on virtual rows above their line as well,
  every message always visible as in editord.
  The agent had said diagnostics would stay as built
  (underline,
  lettered marker after the line end,
  a card at the caret);
  the user answered:
  "Diiagnostics should be on virtual lines too."
- A block of virtual rows must look like it belongs to the code line beneath it,
  not to the line before:
  "Virtual lines should look like they belong to the next line,
  not to the previous line,
  by tuning spacing."
  So the rows sit tight against their own line and a larger gap separates them from the previous line.
- Derived by the agent from the two answers and open to the user's veto:
  nothing that annotates a line is drawn on the code line or after its end,
  so the lettered marker and the caret card go;
  the underline under the marked characters stays.
- Not decided by these answers,
  and to be asked with built screenshots:
  the look of the hint row,
  whether hint labels are shortened as editord shortens them,
  whether the marker or the card stay beside the rows,
  and the wording of a diagnostic row.

### Agent rule decisions

- Asking for decisions:
  questions are batched in the question tool and each item's context is explained again in plain words
  (rule `QRX` in `AGENTS.md`).
- UI decisions are asked with built screenshots of every option stored as local repository files
  (rule `QVS` in `.agents/skills/visual-design-review/SKILL.md`).
- Target-size rules live in the "Target size" section of `.agents/skills/visual-design-review/SKILL.md`,
  not in `AGENTS.md`:
  the 48 px minimum (rule `ATS`,
  now naming desktop too,
  moved there "with more details"),
  the hit-area definition (rule `HZA`),
  and the per-element exception rule (rule `TXE`).
  The agent added rules `HZP` and `HZK` and a worked example beside them;
  the user kept all three when asked.
- Declined:
  a reference-parity rule,
  a CLI `--help` rule,
  and a font-verification rule.

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

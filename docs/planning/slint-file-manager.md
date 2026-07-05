# Plan: Slint file manager

Status:
 accepted stack direction.
 Not built.
 Authored 2026-07-05.

## Goal

Build an infinite horizontal-scrolling file manager for desktop operating systems.
The interaction model is Niri-like:
the user moves through a horizontal strip of panes,
and each pane renders a file list for one directory or search result.

The first supported desktop targets are Windows,
macOS,
and Linux.
Electron and other bundled-browser stacks are out of scope for this project.

## Source facts verified before this plan

- `docs/handover/slint-file-manager-assessment.md` records the prior Slint assessment:
  Slint is viable as a UI layer,
  while default-file-manager behavior needs native integration per operating system.
- The same handover records minimal Slint `cargo check` success on `m1` for macOS
  and `x13-win` for Windows.
- Slint desktop docs say Slint runs on Windows,
  macOS,
  and Linux distributions using Wayland or X-Windows,
  glibc,
  and d-bus.
- Slint Node docs mark the Node integration as Beta.
  The Rust integration is the safer default for a privileged desktop file manager.
- Slint `ListView` docs say only visible list items are instantiated,
  which gives stable performance for large vertical file lists.
- Slint source at `/tmp/agent/slint-file-manager-assessment-20260705/internal/core/model/repeater.rs`
  implements `ListView` virtualization around `viewport-y`,
  so row virtualization is vertical.
  Horizontal pane virtualization still needs a project-level design and prototype.
- Slint source at `/tmp/agent/slint-file-manager-assessment-20260705/internal/core/data_transfer.rs`
  stores plain text,
  images,
  and application-local `user_data`.
  It has a TODO for custom binary data providers and MIME types.
- Slint issue `#1967`,
  `better Drag 'n' Drop handling`,
  is still open.
  Current comments describe in-process drag and drop as almost complete,
  not complete native file-list drag and drop.
- Slint issue `#12354`,
  `ContextMenuArea: right-click on StandardTableView / ListView rows does not open menu`,
  is open and untriaged.
  Row context menus are a file-manager requirement,
  so this must be reproduced and worked around or fixed.
- Alternative stack docs were checked before choosing Slint plus Rust:
  Qt,
  Flutter,
  Tauri,
  Avalonia,
  Iced,
  and GPUI.
  The rejected alternatives and reasons are recorded in `docs/decisions/slint-file-manager-stack.md`.

## Chosen architecture

Use Slint plus Rust.
The stack is not a vague "core" plus UI split.
It is a set of responsibility boundaries:

- **Slint UI layer**:
  windows,
  pane strip visuals,
  file-list row delegates,
  settings screens,
  dialogs,
  and custom widgets.
- **Rust application state layer**:
  pane graph,
  active selection,
  navigation history,
  view options,
  command routing,
  and undoable file-operation state.
- **Rust filesystem runtime layer**:
  directory reads,
  metadata enrichment,
  file watching,
  search,
  previews,
  and cancellable background work.
- **Rust platform integration layer**:
  default-folder-viewer registration,
  shell open paths,
  notifications,
  system menus,
  package hooks,
  and OS-specific drag and drop adapters.
- **Packaging and recovery layer**:
  installer metadata,
  signing,
  user-visible repair commands,
  uninstall cleanup,
  and restore-to-system-default behavior.

The initial package should live under the desktop-app family,
for example `packages/desktop-app/slint-file-manager/`,
unless implementation work discovers a better existing category.

## Slint usage rules

Use `.slint` files compiled from Rust with `slint-build` and `slint::include_modules!()`.
Avoid inline `slint!` for production UI because file-backed `.slint` sources have better editor,
LSP,
and build-script behavior.

Use Slint `ListView` for vertical file lists when possible.
Do not rely on `ScrollView` for long file lists,
because `ListView` is the widget with documented visible-item instantiation.

Do not assume Slint provides horizontal pane virtualization.
The horizontal strip should be driven by Rust state that exposes only a bounded window of panes to Slint.
The UI may render:

- visible panes,
- one prefetch pane before the viewport,
- one prefetch pane after the viewport,
- lightweight placeholders for transition edges when needed.

The exact pane budget is an implementation detail,
but it must be measured with instrumentation before the stack choice is considered validated.

Avoid `StandardListView` for the main file list until issue `#12354` is understood.
A custom `ListView` delegate gives more control over pointer events,
context menus,
selection visuals,
and drag handles.

## Domain model

The application state layer should use explicit concepts instead of a single global app state object:

- `PaneId`:
  stable identity for one pane instance.
- `PaneLocation`:
  directory path,
  virtual search result,
  recent files view,
  or future non-directory source.
- `DirectorySnapshot`:
  immutable view of entries at one read generation.
- `FileEntry`:
  name,
  path,
  kind,
  metadata summary,
  icon key,
  preview status,
  and capability flags.
- `SelectionState`:
  anchor,
  focused row,
  selected entry set,
  and range-selection mode.
- `PaneStripState`:
  ordered pane ids,
  active pane id,
  scroll target,
  and visible window.
- `FileOperation`:
  copy,
  move,
  rename,
  delete,
  trash,
  restore,
  and conflict resolution.
- `PlatformRegistrationState`:
  current default-manager registration status,
  saved prior values,
  verification status,
  and available revert actions.

Snapshots should be immutable.
Filesystem updates create new snapshots and publish model diffs to Slint.
This keeps file watching,
sorting,
filtering,
and view refreshes deterministic.

## Native integration scope

Do not describe the feature as "replace Finder" or "replace Explorer" without subcases.
The native integration layer must track observable launch paths separately:

- opening a folder from another app,
- revealing a file or folder from another app,
- opening drives,
- desktop interactions,
- file open and save dialogs,
- keyboard shortcuts such as Win+E,
- direct Explorer or Finder launches from shell UI,
- uninstall and revert behavior.

Windows work needs native code for Directory and Drive shell commands,
Win+E handling if desired,
registry value backup,
argument quoting,
installer integration,
and a safe revert path.

macOS work needs native code for `NSFileViewer`,
LaunchServices handlers for `public.folder`,
bundle identifiers,
restart messaging,
Full Disk Access guidance,
verification,
and Finder restore commands.

Linux work needs XDG MIME defaults,
`mimeapps.list` behavior,
desktop-file installation,
portal behavior where relevant,
and desktop-environment compatibility checks.

Every registration prototype must run against disposable state or saved restore values,
not against irreversible user defaults.

## Spike gates

Implementation should not start by building the full file manager.
Run these spikes first and record results in this document or a follow-up planning note.

### Horizontal pane virtualization spike

Build a Slint plus Rust prototype with a horizontally scrollable pane strip.
Each visible pane contains a `ListView` with a large model.
Instrument the number of instantiated panes and row delegates.

Pass criteria:

- off-screen panes are not fully instantiated,
- vertical row delegates remain bounded by viewport size,
- memory stays bounded while jumping across far-apart pane positions,
- keyboard focus survives pane recycling,
- prototype runs on Linux,
  macOS,
  and Windows.

Failure action:
compare Qt and GPUI before continuing with Slint.

### File drag and drop spike

Prototype file drag and drop in both directions:

- drag files from the OS file manager into the Slint app,
- drag files from the Slint app into the OS file manager,
- drag entries between panes inside the app.

Pass criteria:

- external drops expose file paths or file URLs to Rust,
- outbound drags advertise OS-native file-list payloads,
- internal drags carry structured app-local data,
- copy and move actions are distinguishable.

Failure action:
either design a native adapter around Slint pointer events,
contribute upstream Slint file-list MIME support,
or compare Qt before committing to Slint.

### Row context menu spike

Reproduce Slint issue `#12354` with the intended custom row delegate.
Test right-click,
keyboard menu key,
Shift+F10,
and long-press where the platform supports it.

Pass criteria:

- row context menu opens for mouse and keyboard paths,
- focused row and clicked row are deterministic,
- menu commands receive the correct `FileEntry` identity,
- workaround does not break row selection or drag initiation.

Failure action:
avoid affected Slint widgets or patch Slint before building production file-list interactions.

### Native default-manager spike

Prototype registration and revert behavior on each operating system.
Use the launch-path list in this plan as the test matrix.

Pass criteria:

- registration changes are visible to the OS,
- revert restores previous values,
- uninstall behavior is specified,
- user-visible warnings match the real platform limits,
- verification opens folders through the OS launch path,
  not only through direct process invocation.

Failure action:
ship the file manager without default-manager claims,
or scope default-manager support to the operating systems whose prototypes pass.

## Implementation milestones

### Foundation

Create the Rust package,
Slint build pipeline,
logging,
settings storage,
and a single empty window.
Run the app on Linux,
macOS,
and Windows at the user boundary.

### Directory listing

Implement directory reads,
metadata loading,
error states,
sort order,
filtering,
and refresh.
Render one pane with a custom Slint `ListView` delegate.

### Pane strip

Implement `PaneStripState`,
pane creation,
pane recycling,
active-pane focus,
and horizontal navigation.
Keep the pane virtualization instrumentation in the codebase until the behavior is stable.

### Selection and commands

Implement focused row,
range selection,
multi-selection,
open,
reveal,
copy path,
rename,
trash,
delete,
copy,
and move.
Destructive operations must use reversible fixtures in tests and clear confirmation paths in the UI.

### File watching and async work

Add filesystem watchers,
cancellable directory refreshes,
preview jobs,
and stale-result suppression.
A slow directory read must not block pointer or keyboard interaction.

### Drag and drop

Implement internal pane-to-pane drag first.
Add OS inbound and outbound file drag only after the file drag and drop spike passes.

### Native shell integration

Implement the platform adapters independently.
Each adapter needs query,
register,
verify,
revert,
and uninstall hooks.
Do not share behavior through stringly commands when a typed adapter can expose platform-specific state.

### Packaging

Add platform packages only after the app launches and reads directories on each target.
Packaging work includes macOS signing and notarization,
Windows installer or MSIX decision,
Linux desktop file and package format decisions,
and update strategy.

### Accessibility and keyboard completeness

Add accessible roles,
labels,
focus traversal,
keyboard equivalents,
and screen-reader checks for panes,
rows,
menus,
and dialogs.
A file manager is keyboard-primary software;
keyboard coverage is not polish.

## Testing and verification

Use unit tests for pure Rust state transitions:
pane graph,
selection,
sorting,
operation planning,
and platform-registration state machines.

Use integration tests for filesystem behavior against throwaway directories:
watch events,
rename conflicts,
copy and move plans,
trash fallbacks,
permission errors,
and symlink handling.

Use UI boundary tests for Slint behavior:
window launch,
row rendering,
keyboard navigation,
context menus,
pane scrolling,
and drag initiation.

Use platform boundary tests for native integration:
folders opened from another app,
folder reveal behavior,
default-manager verification,
and revert behavior.

Do not count compilation alone as verification.
The app must be launched and exercised as an end user would use it on every target operating system.

## Security posture

No renderer process should receive ambient filesystem authority through a WebView IPC bridge.
That is why Electron and Tauri are not the chosen stack.

The Rust application must still treat filesystem operations as privileged:

- previewers must not execute files,
- paths crossing syntax boundaries must be encoded for the destination grammar,
- delete and overwrite operations need explicit command states,
- background tasks must be cancellable,
- native registration changes must preserve restore data,
- logs must avoid leaking file contents unless the user explicitly requests diagnostic detail.

## Fallback conditions

Reopen the stack decision if any of these happen:

- Slint cannot support bounded horizontal pane virtualization without rewriting major runtime pieces.
- Slint cannot support native file-list drag and drop through a maintainable adapter or upstream patch.
- Row context menus cannot be made reliable for the main file list.
- Accessibility requirements require platform hooks Slint cannot expose.
- Native default-manager integration dominates the project enough that Qt's mature platform layer outweighs Slint's smaller stack.

The first fallback candidate is Qt.
GPUI is the second fallback if custom pane rendering becomes more important than mature widgets.

## Documentation updates required after spikes

When a spike passes or fails,
update this planning document with:

- exact prototype path,
- operating systems tested,
- command or UI steps run,
- observed failures,
- chosen workaround or stack-change trigger.

If the stack changes,
update `docs/decisions/slint-file-manager-stack.md` in the same commit.

# Slint file-manager suitability assessment

> Scratch-path note: `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

## Purpose

This handover preserves the assessment state for whether Slint is suitable for a highly integrated cross-platform file
manager. The critical integration point is whether the app can make itself the default file manager on Windows and macOS.

## Current conclusion

Slint remains viable as a UI layer for the file-manager window, panes, previews, commands, settings, and custom widgets.
It should not be treated as the component that solves native shell integration. The default-manager feature needs a
separate native integration layer for each OS, with explicit recovery and uninstall behavior.

The earlier answer was too strong if read as "third-party file managers cannot make themselves default." Corrected
conclusion: products do ship this behavior, but they do it through OS-specific hooks that are partial, fragile, or
explicitly experimental. Slint does not remove that risk, and it also does not prevent building those native bridges.

## Evidence already gathered

### Remote environments

The user provided these SSH targets:

- `ssh m1` for macOS.
- `ssh x13-win` for Windows.

Verified state from the earlier session:

- `m1`: macOS 26.5.2 arm64, Rust and Cargo nightly available.
- `x13-win`: Windows NT 10.0.19044.0 x64, Rust and Cargo nightly available.
- Minimal Slint `cargo check` succeeded on both hosts.
- Initial macOS temp project failed because the directory-derived package name contained dots:
  `invalid character '.' in package name: tmp.ePGrNBgBEp`.
- The macOS temp project succeeded after using:

```bash
cargo init --bin --quiet --name slint_check .
```

### Slint source audit

The Slint repository was cloned to:

```text
/tmp/agent/slint-file-manager-assessment-20260705
```

The audited Slint commit was:

```text
2447c69
```

Relevant source findings from that checkout:

- `internal/core/data_transfer.rs`: `DataTransfer` supports plain text and image payloads. It does not model arbitrary
  file-list payloads as a first-class cross-backend API.
- `internal/backends/qt/qt_window.rs`: Qt backend implements `fn start_drag(&self, request: &DragRequest) -> bool`
  with `QDrag` and `QMimeData`.
- `internal/backends/winit`: search for `fn start_drag|start_drag\(` returned no winit implementation in the audited
  checkout.
- `internal/core/items/system_tray.rs`: system-tray support exists through native backends, including `ksni`, AppKit
  `NSStatusBar` / `NSStatusItem`, and Windows `Shell_NotifyIconW`.
- `internal/backends/winit/accesskit.rs`: AccessKit support exists in the winit backend, so accessibility is not an
  empty area, but a file manager still needs application-level accessibility semantics.

## Corrected default-manager evidence

### OneCommander on Windows

OneCommander documentation confirms a built-in advanced setting named `Register as a default file manager`. The docs say
it "completely replaces Windows File Manager" and warn that it is experimental, registry-based, and intended for users
comfortable repairing Windows Registry changes if something goes wrong.

The same OneCommander docs distinguish this from `Register Win+E hotkey`. The hotkey setting opens OneCommander from
Win+E, but it does not replace Windows File Explorer in all launch paths. The docs note Explorer remains available from
other launch paths.

Practical interpretation for this project:

- Windows replacement is possible enough that a real product ships it.
- It is not a clean, platform-blessed app-default API comparable to setting a browser.
- A Slint app would need native Windows code that writes and reverts registry entries, tests folder and drive launches,
  handles Win+E separately, and survives uninstall or failed registration.

### ForkLift on macOS

ForkLift 4 documentation confirms `Default File Viewer` support. The documented setup writes global `NSFileViewer` and
LaunchServices `LSHandlers` values for `public.folder`, then requires a restart. ForkLift says almost every app, except
the Desktop, points to ForkLift for `Reveal in Finder`, `Show in Finder`, and `Open in Finder` after setup.

ForkLift also documents important limits:

- The Desktop is excluded.
- Open and save dialog windows are not replaced.
- The user verifies by revealing a folder from ForkLift and checking whether it opens in ForkLift.
- Reverting to Finder requires writing Finder back into the same defaults and LaunchServices areas.

Practical interpretation for this project:

- macOS default-folder-viewer behavior is possible enough that a real product documents it.
- It is a file-viewer or folder-handler substitution, not a full Finder or shell replacement.
- A Slint app would need a native macOS layer for LaunchServices, bundle identifiers, restart messaging, verification,
  revert behavior, Full Disk Access messaging, and compatibility checks on current macOS releases.

## Integration implications for a Slint file manager

Default-manager support should be scoped as a native integration feature, not a Slint feature. Slint can render the UI
for preferences, warnings, and status. The actual behavior needs OS-specific code:

- Windows: registry registration for `Directory` and `Drive` shell commands, Win+E handling if desired, app path quoting,
  argument conventions, uninstall repair, and a safe revert path.
- macOS: `NSFileViewer`, LaunchServices handlers for `public.folder`, bundle identifier handling, restart requirements,
  Full Disk Access guidance, verification, and Finder restore commands.
- Linux: likely XDG MIME defaults and desktop-environment-specific behavior, still unresearched in this assessment.

The product requirement should avoid saying "replace Finder/Explorer" without subcases. Split it into observable launch
paths:

- Opening a folder from another app.
- Revealing a file or folder from another app.
- Opening drives.
- Desktop interactions.
- File open and save dialogs.
- Keyboard shortcut behavior such as Win+E.
- Direct Explorer or Finder launches from taskbar, Dock, Start menu, Spotlight, or shell.
- Uninstall and revert behavior.

## Recommended next session

Use these skills if continuing:

- `choosing-technology` if comparing Slint against Qt, native AppKit/WinUI, Tauri, or another stack.
- `diagnose` if a concrete default-manager prototype fails on `m1` or `x13-win`.
- `troubleshooting-doc` after diagnosing any OS-specific registration behavior or workaround.

Suggested continuation path:

- Treat the prior Slint conclusion as corrected: Slint is viable for UI, while default-manager behavior is a native
  bridge with known product precedent and known limits.
- Define the exact default-manager subcases from the launch-path list in this document.
- Build disposable native prototypes before choosing the full app stack:
  - On Windows, test registry handling for folder and drive open paths on `x13-win`.
  - On macOS, test `NSFileViewer` and `public.folder` LaunchServices handling on `m1`.
- Verify every prototype at the user boundary by opening folders through the OS launch path, not only by checking that
  commands wrote configuration.
- Keep destructive or state-mutating default-handler experiments reversible. Prefer disposable test users, VMs, or clear
  saved restore values before editing real defaults.

## Source URLs checked for the correction

- OneCommander advanced settings:
  <https://onecommander.com/help/3._Full_reference_guide/Settings/Advanced.html>
- OneCommander newer help page:
  <https://onecommander.com/help2/Advanced.html>
- ForkLift 4 manual, `Default File Viewer` section:
  <https://binarynights.com/manual>
- XDA article showing Windows registry-based default file-manager replacement and noting OneCommander built-in support:
  <https://www.xda-developers.com/how-change-default-file-explorer-windows/>

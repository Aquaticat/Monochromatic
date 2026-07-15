# GTK4 on Windows cannot drag files out to Explorer (drag-source Shell IDList not implemented)

Dragging a file FROM a gtk4-rs app TO Windows Explorer (or any non-GTK app) does not work: the
drag starts but the drop is rejected, the cursor bounces back, and no file is transferred. The
fix is a small native Win32 OLE drag source in Rust.

## Symptom

- A `GtkDragSource` whose `prepare` returns a `GdkFileList` (or any file content) starts a drag,
  but dropping onto Explorer does nothing and the drag icon snaps back.
- The source side is fine: the app's `prepare` handler runs and hands out the file (verified via
  an `outbound drag prepared` log line). The problem is entirely on the receiving end: Explorer
  sees no file format it accepts.

## Root cause

This is a documented, unimplemented feature in GDK's Win32 backend, not an app bug. From
`gdk/win32/gdkdrag-win32.c` (GTK main, read 2026-07):

> If GTK application accepts text/uri-list, GDK will claim to accept "Shell IDList Array", and
> will do the conversion when such data is provided. Currently the conversion from text/uri-list
> to "Shell IDList Array" is not implemented, so it's not possible to drag & drop files from GTK
> applications to non-GTK applications the same way one can drag files from Windows Explorer.

For file content, GDK's Win32 drag source only advertises "Shell IDList Array"
(`CFSTR_SHELLIDLIST`), and the conversion that would fill it in is a stub; it never offers
`CF_HDROP` either. So there is no app-side content-provider workaround: whatever file content the
`GtkDragSource` provides, GDK will not expose it to a foreign OLE drop target in a format Explorer
understands.

The inbound direction is fine (Explorer -> GTK works, verified), because that path
(`WM_DROPFILES` / `CFSTR_SHELLIDLIST` -> `text/uri-list`) is implemented in
`gdk/win32/gdkdrop-win32.c` and `gdkclipdrop-win32.c`. The gap is outbound only, and only to
non-GTK targets (GTK-to-GTK drags exchange native formats and work).

## Fix: native Win32 OLE drag source in Rust

Bypass GTK's drag source on Windows and drive the native OLE drag directly (pure Rust via the
`windows` crate, no C):

- Implement a minimal `IDataObject` that serves `CF_HDROP`: an `HGLOBAL` holding a `DROPFILES`
  header followed by the dragged paths as a double-null-terminated wide (UTF-16) string.
- Implement a minimal `IDropSource` (`QueryContinueDrag`, `GiveFeedback`).
- Call `DoDragDrop(data_object, drop_source, DROPEFFECT_COPY)` on the GTK main thread (an OLE STA;
  `DoDragDrop` runs its own modal loop and pumps messages, so the desktop stays responsive).
- Trigger it from the widget's drag gesture (a `GtkGestureDrag` `drag-begin`), guarded to Windows.

On Linux (Wayland) and macOS keep GTK's native `GtkDragSource`, which works there; only Windows
outbound needs this shim.

### Reference implementation (verified)

Windows-only dependency:

```toml
# Cargo.toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_System_Com",
    "Win32_System_Ole",
    "Win32_UI_Shell",
    "Win32_UI_Shell_Common",
] }
```

The drag (`win_drag.rs`):

```rust
// package/desktop-app/file-manager-gtk/src/win_drag.rs
use std::path::Path;

use windows::Win32::System::Com::IDataObject;
use windows::Win32::System::Ole::DROPEFFECT_COPY;
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{
    BHID_DataObject, ILCreateFromPathW, ILFree, SHCreateShellItemArrayFromIDLists, SHDoDragDrop,
};
use windows::core::HSTRING;

pub fn start_file_drag(paths: &[&Path]) {
    if let Err(error) = run_drag(paths) {
        tracing::error!(%error, "native OLE drag failed");
    }
}

fn run_drag(paths: &[&Path]) -> windows::core::Result<()> {
    unsafe {
        let mut owned: Vec<*mut ITEMIDLIST> = Vec::new();
        for path in paths {
            let pidl = ILCreateFromPathW(&HSTRING::from(path.as_os_str()));
            if pidl.is_null() {
                tracing::warn!(?path, "ILCreateFromPathW returned null");
            } else {
                owned.push(pidl);
            }
        }
        if owned.is_empty() {
            return Ok(());
        }
        let pidls: Vec<*const ITEMIDLIST> =
            owned.iter().map(|pidl| *pidl as *const ITEMIDLIST).collect();
        let array = SHCreateShellItemArrayFromIDLists(&pidls)?;
        let data: IDataObject = array.BindToHandler(None, &BHID_DataObject)?;
        let effect = SHDoDragDrop(None, &data, None, DROPEFFECT_COPY)?;
        tracing::info!(effect = effect.0, "native OLE drag finished");
        for pidl in owned {
            ILFree(Some(pidl as *const ITEMIDLIST));
        }
        Ok(())
    }
}
```

Trigger from a `GtkGestureDrag` on the draggable widget (Windows only); keep `GtkDragSource`
elsewhere:

```rust
#[cfg(target_os = "windows")]
{
    let gesture = gtk4::GestureDrag::new();
    gesture.connect_drag_begin(move |_, _, _| {
        win_drag::start_file_drag(&[std::path::Path::new(&file_path)]);
    });
    widget.add_controller(gesture);
}
```

Gotchas found while writing it:

- `SHDoDragDrop` blocks (its own modal loop, pumping messages) until drop or cancel, and must run
  on the GTK main thread, which is already an OLE STA because GDK calls `OleInitialize` at startup.
- `IShellItemArray::BindToHandler` has two generic parameters, so a turbofix fails; annotate the
  binding instead (`let data: IDataObject = ...`).
- `ILFree` takes `Option<*const ITEMIDLIST>`.
- Passing `None` for `SHDoDragDrop`'s `pdsrc` uses the shell's default `IDropSource`.

## Status

Verified on `x13-win` (GTK 4.22.4 via gvsbuild). The spike's `GtkDragSource` starts the drag
(`outbound drag prepared`) but Explorer rejects it, confirming the GTK gap. The native OLE shim
resolves it: dragging the handle to an Explorer folder copies the file, and the source logs
`native OLE drag finished effect=1` (`DROPEFFECT_COPY`). Fold this into the real app on Windows
when building the real GTK UI; on Linux/macOS keep `GtkDragSource`.

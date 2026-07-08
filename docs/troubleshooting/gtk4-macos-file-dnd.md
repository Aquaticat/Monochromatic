# GTK4 on macOS: file drag-and-drop needs handling (inbound URI quirk, outbound needs a shim)

Native file drag-and-drop between a gtk4-rs app and Finder on macOS does not work out of the box:
inbound drops deliver the file but `g_file_get_path` returns `None`, and outbound drags to Finder
are rejected. Measured on `m1` (macOS 26.5.2), gtk4-rs against Homebrew GTK 4.x, over RustDesk. The
drags do reach the app (the source and target callbacks fire), so this is GTK/macOS handling, not a
remote-input artifact.

## Inbound (Finder -> GTK): delivered, but the path needs recovering

A file dropped from Finder is received by a stock `GtkDropTarget` (`GdkFileList`) and the drop is
accepted, but each file's `path()` is `None`. Logging the URI shows why:

```txt
inbound file drop  path=None  uri=file%3A///Volumes/Data/Backup/user/focus.out.txt
```

`%3A` is a percent-encoded colon: GDK's macOS backend encoded the scheme separator, producing
`file%3A///...` instead of `file:///...`. That is not a valid `file:` URI, so `g_file_get_path`
returns `None`. It is not a permission/TCC issue: the full correct path is present in the URI.

Workaround (in the app): do not rely on `g_file_get_path` for dropped files on macOS. Unescape the
URI (or fix the scheme) and rebuild the `GFile`:

```rust
let uri = file.uri();                                  // "file%3A///Volumes/.../name"
let fixed = glib::Uri::unescape_string(&uri, None);    // -> "file:///Volumes/.../name"
let path = fixed.and_then(|u| gio::File::for_uri(&u).path());
```

## Outbound (GTK -> Finder): rejected; needs a native drag-source shim

A `GtkDragSource` that hands out a file starts (its `prepare` callback fires) but Finder rejects the
drop and the cursor bounces back. Tested two ways, both rejected:

- `GdkFileList` content (`ContentProvider::for_value`).
- `text/uri-list` content with a correctly-encoded `file:///Volumes/.../dragme.txt` URI
  (`ContentProvider::for_bytes`), verified in the log:

  ```txt
  outbound drag prepared (text/uri-list) uri=file:///Volumes/MacData/agent-spikes/dragme.txt
  ```

Since a correctly-encoded URI is also rejected, the problem is not the inbound colon-encoding bug:
GDK's macOS drag source does not present the file to Finder in a form it accepts for a drag-copy
(Finder wants `NSFilenamesPboardType` or an `NSFilePromiseProvider`, not just `public.file-url`).

Resolution: a native macOS drag-source shim in Rust (via `objc2`: `NSFilePromiseProvider` /
`NSDraggingSource` on the widget's backing `NSView`), analogous to the Windows OLE shim in
`gtk4-windows-outbound-file-drag.md`. Not built yet; recorded as a work item for the real app.

## Cross-platform DnD picture

- Linux (Wayland, primary): full native DnD both directions, no workarounds.
- Windows: inbound works (stock `GtkDropTarget`); outbound needs a native Win32 OLE shim (built and
  verified) -- see `gtk4-windows-outbound-file-drag.md`.
- macOS: inbound works with an in-app URI-unescape; outbound needs a native `objc2` drag shim (not
  built).

The pattern: GTK's non-Wayland backends need per-platform native drag sources for outbound file DnD
to the OS file manager. This does not change the GTK4 toolkit decision (it is the only option
satisfying the Wayland DnD hard constraint; the winit-based alternatives have no Wayland DnD at
all), but these shims are a known, bounded cost for the Windows and macOS targets.

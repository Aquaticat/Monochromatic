# Slint nested Wayland clients still inherit the host color scheme

## Symptom

Running a Slint application inside a nested Wayland compositor isolates its surface,
input,
and screenshots,
but does not isolate `Palette.color-scheme`.
Changing only the nested compositor cannot produce deterministic dark and light scenes.
Changing the host desktop environment theme does work,
but mutates unrelated user state and is forbidden for music-player verification.

## Cause

Wayland has no general dark or light preference protocol.
Slint 1.17.0 reads desktop appearance over the session D-Bus instead of the Wayland connection.
The deciding source is local crate file
`i-slint-backend-winit-1.17.0/xdg_desktop_settings.rs`:

- `watch` opens `zbus::Connection::session()`.
- The proxy destination is `org.freedesktop.portal.Desktop`.
- The object path is `/org/freedesktop/portal/desktop`.
- The interface is `org.freedesktop.portal.Settings`.
- Initial reads call `ReadOne(namespace, key)`.
- `org.freedesktop.appearance/color-scheme` value `1` means dark.
- Value `2` means light.
- Slint subscribes to `SettingChanged` before its initial reads.
- First windows wait up to `500ms` for the appearance query to avoid a default-theme flash.

A nested Wayland child inherits the parent process's `DBUS_SESSION_BUS_ADDRESS` unless the fixture overrides it.
The child therefore continues to read the host portal even though `WAYLAND_DISPLAY` points at the nested compositor.

## Isolated solution

`package/cli/nested-wayland-session` supports startup option:

```sh
monochromatic-nested-wayland-session --color-scheme dark -- app
monochromatic-nested-wayland-session --color-scheme light -- app
```

For either explicit value,
the fixture:

1.  Creates a disposable socket directory under runtime temporary storage.
2.  Starts a private `dbus-daemon --session --nofork` message bus.
3.  Registers a minimal zbus `org.freedesktop.portal.Settings` service.
4.  Serves `ReadOne`,
    `Read`,
    and filtered `ReadAll` for appearance color scheme.
5.  Sets `DBUS_SESSION_BUS_ADDRESS` only on the hosted child.
6.  Kills the private bus and removes its socket directory when the nested session ends.

Unsupported individual settings return a D-Bus error rather than inventing host font,
cursor,
or accent values.
The private bus does not expose unrelated host services,
such as notifications or file-chooser portals.
Normal shutdown removes its temporary socket directory;
`SIGKILL` bypasses cleanup and can leave the PID-named directory behind.
Without `--color-scheme`,
the fixture retains its previous behavior and does not replace the child's session bus.

## Verification

Run focused package checks:

```sh
mise run //package/cli/nested-wayland-session:lint:rust
mise run //package/cli/nested-wayland-session:lint:clippy
mise run //package/cli/nested-wayland-session:test
mise run //package/cli/nested-wayland-session:build
```

The private-portal test connects through the printed private bus address,
calls `ReadOne("org.freedesktop.appearance", "color-scheme")` and `ReadAll`,
checks dark and light unsigned values,
drops the portal,
and confirms its socket directory was removed.

For the user-boundary probe,
keep the host theme unchanged,
run one nested session with `--color-scheme dark` and another with `--color-scheme light`,
then capture both through the nested compositor's `screenshot` control command.
The app window decorations,
Slint palette,
and custom LED scene must all follow the requested isolated value.

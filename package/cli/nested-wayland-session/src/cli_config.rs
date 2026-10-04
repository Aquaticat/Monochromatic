//! Display-independent configuration consumed by the compositor.

/// Owned filesystem paths survive argument parsing.
use std::path::PathBuf;
/// Existing private-portal appearance values.
use crate::appearance_portal::ColorSchemePreference;

/// Validated program configuration parsed from the command line.
///
/// What:     `pub struct Config { ... }` is a record type holding the parsed,
///           owned settings. Every field is owned (`Vec<String>`, `Option<PathBuf>`,
///           `i32`) so the value can be moved into the event loop and outlive the
///           argument vector.
/// Why:      One typed, validated bundle passed to `run`, so the rest of the
///           program never re-parses raw `&str` arguments.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Config = {
///   childCommand: string[];
///   controlSocket: string | undefined;
///   width: number;
///   height: number;
/// };
/// ```
pub struct Config {
    /// Program-and-arguments of the single client to host, e.g. `["music-player", "fixtures"]`.
    ///
    /// What:     `pub child_command: Vec<String>`. `Vec<String>` is a heap array of
    ///           owned strings (sibling: `&[&str]`, a borrowed slice of borrowed
    ///           strings).
    /// Why:      The compositor forks exactly this command as its one client; owned
    ///           so it survives past the argument slice.
    pub child_command: Vec<String>,

    /// Optional filesystem path for the Unix control socket.
    ///
    /// What:     `pub control_socket: Option<PathBuf>`. `Option<T>` is Rust's
    ///           null-free "maybe" type: either `Some(path)` or `None`. `PathBuf`
    ///           is an owned path.
    /// Why:      When absent (`None`), the control API is disabled and the fixture
    ///           just hosts the app; when present, it binds a socket there.
    pub control_socket: Option<PathBuf>,

    /// Initial nested-screen width in physical pixels.
    ///
    /// What:     `pub width: i32`. Signed 32-bit integer to match Smithay geometry.
    /// Why:      Sets the winit window's initial inner size, which becomes the
    ///           output resolution the hosted app fills.
    pub width: i32,

    /// Initial nested-screen height in physical pixels.
    ///
    /// What:     `pub height: i32`. Signed 32-bit integer to match Smithay geometry.
    /// Why:      Pairs with `width` for the initial output size.
    pub height: i32,

    /// Optional isolated portal color scheme for hosted client.
    ///
    /// What:     `pub color_scheme: Option<ColorSchemePreference>`.
    /// Why:      `Some` starts private Settings portal without changing host desktop theme.
    pub color_scheme: Option<ColorSchemePreference>,

    /// Whether to launch the hosted app inside a resource-controlled systemd scope.
    ///
    /// What:     `pub isolate: bool`. Set by `--isolate`.
    /// Why:      Reserve CPU headroom for the 60fps capture pipeline so a greedy app cannot
    ///           starve it; degrades to a direct launch when systemd is unavailable.
    pub isolate: bool,

    /// Optional hard CPU cap for the app, in percent of one core (`--app-cpu-quota`).
    ///
    /// What:     `pub app_cpu_quota: Option<u32>`. `800` means eight cores' worth.
    /// Why:      Override the machine-sized default cap used when `--isolate` is set.
    pub app_cpu_quota: Option<u32>,

    /// Optional relative CPU share for the app (`--app-cpu-weight`, systemd 1..=10000).
    ///
    /// What:     `pub app_cpu_weight: Option<u32>`.
    /// Why:      Override the default low weight that deprioritises the app under contention.
    pub app_cpu_weight: Option<u32>,
}

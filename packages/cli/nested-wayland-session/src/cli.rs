//! Command-line argument parsing for the nested Wayland session fixture.
//!
//! This module is deliberately free of any Smithay or Wayland types so its logic
//! can be unit-tested on any machine without opening a window. It turns the raw
//! process arguments into a validated `Config` the rest of the program consumes.

/// What:     `use std::path::PathBuf;`. `PathBuf` is an OWNED, growable filesystem
///           path (the owned sibling of the borrowed `&Path`, the same way
///           `String` is the owned sibling of `&str`).
/// Why:      The optional control-socket location is stored owned in `Config`,
///           which outlives the argument slice it was parsed from, so a borrowed
///           `&Path` would dangle.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // TS has no owned/borrowed split; a path is just a string.
/// ```
use std::path::PathBuf;

/// What:     `use anyhow::{bail, Context, Result};`. `anyhow` is the application
///           error library. `Result` here is `anyhow::Result<T>`, an alias for
///           `std::result::Result<T, anyhow::Error>` (one boxed, displayable error
///           type). `bail!(...)` is a macro that returns early with a formatted
///           error. `Context` adds the `.context(...)` method to attach a message
///           to an error.
/// Why:      Argument parsing reports human-readable failures ("bad --size") up to
///           `main`, which prints them; a fixture wants one simple error channel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Roughly: throw new Error(msg) for bail!, and wrap-and-rethrow for context.
/// ```
use anyhow::{bail, Context, Result};

/// Default nested-screen width in physical pixels when `--size` is omitted.
///
/// What:     `const DEFAULT_WIDTH: i32 = 1280;`. `i32` is a 32-bit SIGNED integer
///           (siblings: `u32` unsigned, `i64`/`u64` 64-bit, `usize` pointer-wide).
/// Why:      Smithay's geometry types (`Size<i32, Physical>`) are signed `i32`, so
///           storing the size as `i32` avoids a cast at every call site; 1280x720
///           is a common, deterministic test resolution.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const DEFAULT_WIDTH = 1280;
/// ```
const DEFAULT_WIDTH: i32 = 1280;

/// Default nested-screen height in physical pixels when `--size` is omitted.
///
/// What:     `const DEFAULT_HEIGHT: i32 = 720;`. Signed `i32` for the same reason
///           as `DEFAULT_WIDTH`.
/// Why:      Pairs with `DEFAULT_WIDTH` for a 720p default nested output.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const DEFAULT_HEIGHT = 720;
/// ```
const DEFAULT_HEIGHT: i32 = 720;

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

/// Parse an argument list (excluding the program name) into a `Config`.
///
/// What:     `pub fn parse_args(args: &[String]) -> Result<Config>`. `args: &[String]`
///           borrows a read-only slice of owned strings (the caller keeps ownership).
///           `Result<Config>` is `anyhow::Result<Config>`: `Ok(config)` on success or
///           `Err(error)` on a bad flag. Accepted grammar:
///             `[--socket PATH] [--size WIDTHxHEIGHT] [--] COMMAND [ARG...]`
///           The first non-flag token (or everything after `--`) begins the child
///           command.
/// Why:      Central, testable parser so `main` stays a thin shell.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseArgs(args: string[]): Config { ... }
/// ```
///
/// @example
/// ```ts
/// parseArgs(["--size", "800x600", "--", "music-player", "songs"]);
/// // => { childCommand: ["music-player", "songs"], controlSocket: undefined, width: 800, height: 600 }
/// ```
pub fn parse_args(args: &[String]) -> Result<Config> {
    // What:     `let mut control_socket: Option<PathBuf> = None;`. `let mut` binds a
    //           MUTABLE local (plain `let` is immutable in Rust, the opposite of TS
    //           `let`). Initialised to the absent variant `None`.
    // Why:      Accumulate the optional socket path as we scan flags.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let controlSocket: string | undefined = undefined;
    // ```
    let mut control_socket: Option<PathBuf> = None;

    // What:     `let mut width = DEFAULT_WIDTH;`. Mutable `i32`, seeded to the default.
    // Why:      Overwritten if `--size` is supplied.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let width = DEFAULT_WIDTH;
    // ```
    let mut width = DEFAULT_WIDTH;

    // What:     `let mut height = DEFAULT_HEIGHT;`. Mutable `i32`, seeded to default.
    // Why:      Overwritten if `--size` is supplied.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let height = DEFAULT_HEIGHT;
    // ```
    let mut height = DEFAULT_HEIGHT;

    // What:     `let mut isolate = false;`. Mutable flag, off by default.
    // Why:      Set true by `--isolate`.
    let mut isolate = false;

    // What:     `let mut app_cpu_quota: Option<u32> = None;`. Optional CPU cap.
    // Why:      Filled by `--app-cpu-quota`.
    let mut app_cpu_quota: Option<u32> = None;

    // What:     `let mut app_cpu_weight: Option<u32> = None;`. Optional CPU weight.
    // Why:      Filled by `--app-cpu-weight`.
    let mut app_cpu_weight: Option<u32> = None;

    // What:     `let mut index = 0usize;`. A mutable cursor into `args`. `0usize`
    //           writes the literal `0` as a `usize` (the pointer-wide unsigned int
    //           used for indexing; siblings `u32`/`u64`).
    // Why:      A manual index (not a `for` loop) so a flag can consume the NEXT
    //           token as its value and skip it (`--socket PATH` reads two tokens).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let index = 0;
    // ```
    let mut index = 0usize;

    // What:     `while index < args.len()`. `args.len()` is the element count as
    //           `usize`. A side-effecting cursor loop, the right tool when the body
    //           advances the index by a variable amount.
    // Why:      Walk the flags until the child command begins.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (index < args.length) { ... }
    // ```
    while index < args.len() {
        // What:     `let arg = args[index].as_str();`. Index into the slice to get a
        //           `&String`, then `.as_str()` reborrows it as a `&str` (a plain
        //           borrowed string slice) for cheap `match`/comparison.
        // Why:      Compare the current token against known flag spellings.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const arg = args[index];
        // ```
        let arg = args[index].as_str();

        // What:     `if arg == "--"`. Plain string equality against the end-of-flags
        //           marker.
        // Why:      Everything after `--` is the child command verbatim, even if it
        //           looks like a flag.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (arg === "--") { ... }
        // ```
        if arg == "--" {
            // What:     `index += 1;`. Advance past the `--` marker itself.
            // Why:      The child command starts at the next token.
            index += 1;
            // What:     `break;`. Leave the flag-scanning loop.
            // Why:      No more flags to parse; the rest is the command.
            break;
        }

        // What:     `if arg == "--socket"`. Equality test for the socket-path flag.
        // Why:      Its value is the next token.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (arg === "--socket") { ... }
        // ```
        if arg == "--socket" {
            // What:     `let value = args.get(index + 1)`. `.get(i)` returns
            //           `Option<&String>`: `Some(&s)` if in bounds, else `None`
            //           (unlike `args[i]`, which panics out of bounds). `.context(...)`
            //           turns a `None` into an `Err` with the message when used with
            //           `?` on the resulting `Option`-to-`Result`... here we handle
            //           `None` explicitly below instead.
            // Why:      Read the flag's argument safely.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const value = args[index + 1];
            // ```
            let value = args.get(index + 1);
            // What:     `match value { Some(path) => ..., None => ... }`. Pattern-match
            //           the `Option`: the `Some(path)` arm binds the present `&String`,
            //           the `None` arm handles the missing value.
            // Why:      A `--socket` with no following path is a usage error.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (value === undefined) throw new Error("--socket needs a path");
            // controlSocket = value;
            // ```
            match value {
                Some(path) => {
                    // What:     `control_socket = Some(PathBuf::from(path));`.
                    //           `PathBuf::from(&str)` allocates an owned path from the
                    //           borrowed string; `Some(...)` wraps it as present.
                    // Why:      Record the requested socket location.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // controlSocket = path;
                    // ```
                    control_socket = Some(PathBuf::from(path));
                }
                None => {
                    // What:     `bail!(...)`. Macro that constructs an `anyhow::Error`
                    //           from the message and returns `Err(...)` from this
                    //           function immediately.
                    // Why:      Fail fast on the malformed flag.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // throw new Error("--socket requires a path argument");
                    // ```
                    bail!("--socket requires a path argument");
                }
            }
            // What:     `index += 2;`. Skip both the flag and its consumed value.
            // Why:      Continue scanning after the pair.
            index += 2;
            // What:     `continue;`. Restart the loop at the new index.
            // Why:      Do not fall through to the positional-argument handling.
            continue;
        }

        // What:     `if arg == "--size"`. Equality test for the size flag.
        // Why:      Its value is a `WIDTHxHEIGHT` token in the next position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (arg === "--size") { ... }
        // ```
        if arg == "--size" {
            // What:     `let value = args.get(index + 1)`; same safe indexing as above.
            // Why:      Read the size string.
            let value = args.get(index + 1);
            // What:     `let spec = value.context("--size requires a WIDTHxHEIGHT")?;`.
            //           `.context(msg)` converts `Option<&String>` into
            //           `Result<&String, anyhow::Error>` (mapping `None` to an error
            //           with `msg`); the trailing `?` unwraps `Ok` or returns the
            //           `Err` from this function.
            // Why:      Turn a missing size argument into a clean usage error.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const spec = value ?? throwError("--size requires a WIDTHxHEIGHT");
            // ```
            let spec = value.context("--size requires a WIDTHxHEIGHT")?;
            // What:     `let (parsed_width, parsed_height) = parse_size(spec)?;`. Call
            //           the helper, which returns `Result<(i32, i32)>`; `?` unwraps the
            //           tuple or propagates the error. The `let (a, b) = ...` is tuple
            //           destructuring.
            // Why:      Split and validate the `WIDTHxHEIGHT` string.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const [parsedWidth, parsedHeight] = parseSize(spec);
            // ```
            let (parsed_width, parsed_height) = parse_size(spec)?;
            // What:     Plain assignments (TS-native operator), no wrapper types.
            // Why:      Adopt the parsed dimensions.
            width = parsed_width;
            height = parsed_height;
            // What:     `index += 2;`. Skip flag and value.
            // Why:      Continue after the pair.
            index += 2;
            // What:     `continue;`. Restart the loop.
            // Why:      Skip positional handling for this consumed pair.
            continue;
        }

        // What:     `if arg == "--isolate" { isolate = true; index += 1; continue; }`. A
        //           valueless flag: it consumes only itself.
        // Why:      Enable systemd CPU isolation of the hosted app.
        if arg == "--isolate" {
            isolate = true;
            index += 1;
            continue;
        }

        // What:     `if arg == "--app-cpu-quota" { ... }`. Reads the next token as a percent.
        // Why:      Override the default app CPU cap.
        if arg == "--app-cpu-quota" {
            // What:     `let value = args.get(index + 1).context(...)?;`. Require the value.
            // Why:      The flag needs a percentage argument.
            let value = args
                .get(index + 1)
                .context("--app-cpu-quota requires a percent value")?;
            // What:     `app_cpu_quota = Some(value.parse::<u32>().context(...)?);`. Parse it
            //           as an unsigned integer and store it present.
            // Why:      Record the requested cap.
            app_cpu_quota = Some(
                value
                    .parse::<u32>()
                    .context("--app-cpu-quota is not a number")?,
            );
            // What:     `index += 2; continue;`. Skip flag and value, keep scanning.
            // Why:      Both tokens are consumed.
            index += 2;
            continue;
        }

        // What:     `if arg == "--app-cpu-weight" { ... }`. Reads the next token as a weight.
        // Why:      Override the default app CPU weight.
        if arg == "--app-cpu-weight" {
            // What:     `let value = args.get(index + 1).context(...)?;`. Require the value.
            // Why:      The flag needs a numeric argument.
            let value = args
                .get(index + 1)
                .context("--app-cpu-weight requires a number")?;
            // What:     `app_cpu_weight = Some(value.parse::<u32>().context(...)?);`. Parse
            //           and store.
            // Why:      Record the requested weight.
            app_cpu_weight = Some(
                value
                    .parse::<u32>()
                    .context("--app-cpu-weight is not a number")?,
            );
            // What:     `index += 2; continue;`. Skip flag and value.
            // Why:      Both tokens are consumed.
            index += 2;
            continue;
        }

        // What:     `if arg == "--isolate" { isolate = true; index += 1; continue; }`. A
        //           valueless flag: it consumes only itself.
        // Why:      Enable systemd CPU isolation of the hosted app.
        if arg == "--isolate" {
            isolate = true;
            index += 1;
            continue;
        }

        // What:     `if arg == "--app-cpu-quota" { ... }`. Reads the next token as a percent.
        // Why:      Override the default app CPU cap.
        if arg == "--app-cpu-quota" {
            // What:     `let value = args.get(index + 1).context(...)?;`. Require the value.
            // Why:      The flag needs a percentage argument.
            let value = args
                .get(index + 1)
                .context("--app-cpu-quota requires a percent value")?;
            // What:     `app_cpu_quota = Some(value.parse::<u32>().context(...)?);`. Parse it
            //           as an unsigned integer and store it present.
            // Why:      Record the requested cap.
            app_cpu_quota = Some(
                value
                    .parse::<u32>()
                    .context("--app-cpu-quota is not a number")?,
            );
            // What:     `index += 2; continue;`. Skip flag and value, keep scanning.
            // Why:      Both tokens are consumed.
            index += 2;
            continue;
        }

        // What:     `if arg == "--app-cpu-weight" { ... }`. Reads the next token as a weight.
        // Why:      Override the default app CPU weight.
        if arg == "--app-cpu-weight" {
            // What:     `let value = args.get(index + 1).context(...)?;`. Require the value.
            // Why:      The flag needs a numeric argument.
            let value = args
                .get(index + 1)
                .context("--app-cpu-weight requires a number")?;
            // What:     `app_cpu_weight = Some(value.parse::<u32>().context(...)?);`. Parse
            //           and store.
            // Why:      Record the requested weight.
            app_cpu_weight = Some(
                value
                    .parse::<u32>()
                    .context("--app-cpu-weight is not a number")?,
            );
            // What:     `index += 2; continue;`. Skip flag and value.
            // Why:      Both tokens are consumed.
            index += 2;
            continue;
        }

        // What:     `if arg.starts_with("--")`. `.starts_with(&str)` is a plain prefix
        //           test. Reaching here means an unrecognised `--flag`.
        // Why:      Reject unknown flags rather than silently treating them as the
        //           child command, which would hide typos.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (arg.startsWith("--")) throw new Error(`unknown flag: ${arg}`);
        // ```
        if arg.starts_with("--") {
            // What:     `bail!("unknown flag: {arg}");`. Formatted early-return error.
            // Why:      Surface the exact bad flag to the user.
            bail!("unknown flag: {arg}");
        }

        // What:     `break;`. The current token is not a flag, so the child command
        //           begins here.
        // Why:      Hand the remaining tokens to the command collector below.
        break;
    }

    // What:     `let child_command: Vec<String> = args[index..].to_vec();`.
    //           `args[index..]` is a slice from `index` to the end (`..` is a range).
    //           `.to_vec()` clones the borrowed `&[String]` into a fresh owned
    //           `Vec<String>`. The `: Vec<String>` is an explicit type annotation.
    // Why:      Everything from the first non-flag (or after `--`) is the command to
    //           host; owned so it survives into the event loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const childCommand = args.slice(index);
    // ```
    let child_command: Vec<String> = args[index..].to_vec();

    // What:     `if child_command.is_empty()`. `.is_empty()` returns `true` for a
    //           zero-length vector.
    // Why:      A fixture with no client to host is a usage error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (childCommand.length === 0) throw new Error("no command given");
    // ```
    if child_command.is_empty() {
        // What:     `bail!(...)`. Early-return usage error.
        // Why:      There is nothing to run.
        bail!(
            "no client command given; usage: [--socket PATH] [--size WxH] [--isolate] \
             [--app-cpu-quota PCT] [--app-cpu-weight N] [--] COMMAND [ARG...]"
        );
    }

    // What:     `Ok(Config { ... })`. `Ok(...)` wraps the success value of a `Result`.
    //           No trailing `;`, so this is the function's tail expression (its
    //           return). Struct fields use the shorthand where a local's name equals
    //           the field name (`width`, `height`).
    // Why:      Hand the validated configuration back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { childCommand, controlSocket, width, height };
    // ```
    Ok(Config {
        child_command,
        control_socket,
        width,
        height,
        isolate,
        app_cpu_quota,
        app_cpu_weight,
    })
}

/// Parse a `WIDTHxHEIGHT` string into a positive `(width, height)` pair.
///
/// What:     `fn parse_size(spec: &str) -> Result<(i32, i32)>`. Private helper
///           (no `pub`). Borrows the spec string, returns a tuple of two `i32`s or
///           an error. `(i32, i32)` is an anonymous two-field tuple.
/// Why:      Isolate the split-and-validate logic so both parsing and tests can
///           exercise it directly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseSize(spec: string): [number, number] { ... }
/// ```
///
/// @example
/// ```ts
/// parseSize("800x600"); // => [800, 600]
/// ```
fn parse_size(spec: &str) -> Result<(i32, i32)> {
    // What:     `let mut parts = spec.split(['x', 'X']);`. `.split(pattern)` returns
    //           a lazy iterator of substrings between separators; the pattern is a
    //           two-element array of `char`s, so it splits on either lowercase or
    //           uppercase `x`. `let mut` because iterating with `.next()` mutates the
    //           iterator's cursor.
    // Why:      Accept both `1280x720` and `1280X720` spellings.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parts = spec.split(/[xX]/)[Symbol.iterator]();
    // ```
    let mut parts = spec.split(['x', 'X']);

    // What:     `let width_text = parts.next().context(...)?;`. `.next()` yields the
    //           first substring as `Option<&str>`; `.context(msg)?` maps `None` to an
    //           error and unwraps `Some`.
    // Why:      Extract the width portion.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const widthText = parts.next().value ?? throwError("...");
    // ```
    let width_text = parts.next().context("--size must be WIDTHxHEIGHT")?;

    // What:     `let height_text = parts.next().context(...)?;`. Second substring.
    // Why:      Extract the height portion.
    let height_text = parts.next().context("--size must be WIDTHxHEIGHT")?;

    // What:     `if parts.next().is_some()`. A third element means an extra `x`, e.g.
    //           `1x2x3`. `.is_some()` is `true` when the `Option` holds a value.
    // Why:      Reject malformed specs with too many separators.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (parts.next().value !== undefined) throw new Error("...");
    // ```
    if parts.next().is_some() {
        bail!("--size must be exactly WIDTHxHEIGHT");
    }

    // What:     `let width: i32 = width_text.trim().parse().context(...)?;`.
    //           `.trim()` drops surrounding whitespace; `.parse()` reads the string
    //           as the target type inferred from the `: i32` annotation, returning
    //           `Result<i32, ParseIntError>`; `.context(msg)?` attaches a message and
    //           unwraps.
    // Why:      Convert text to a number, failing cleanly on non-numeric input.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const width = Number.parseInt(widthText.trim(), 10);
    // if (Number.isNaN(width)) throw new Error("...");
    // ```
    let width: i32 = width_text
        .trim()
        .parse()
        .context("--size width is not a number")?;

    // What:     `let height: i32 = height_text.trim().parse().context(...)?;`. Same
    //           parse for the height field.
    // Why:      Convert the height text to a number.
    let height: i32 = height_text
        .trim()
        .parse()
        .context("--size height is not a number")?;

    // What:     `if width <= 0 || height <= 0`. Ordinary comparison and logical OR.
    // Why:      A zero or negative screen size cannot be created; reject it early.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (width <= 0 || height <= 0) throw new Error("...");
    // ```
    if width <= 0 || height <= 0 {
        bail!("--size dimensions must be positive");
    }

    // What:     `Ok((width, height))`. Wrap the validated tuple as the success value;
    //           tail expression, so it is returned.
    // Why:      Hand the pair back to `parse_args`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [width, height];
    // ```
    Ok((width, height))
}

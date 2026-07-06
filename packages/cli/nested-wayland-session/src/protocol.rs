//! The control-socket wire protocol: newline-delimited text requests and responses.
//!
//! Each request is one line: a verb plus arguments. Each request yields exactly one
//! response line: `ok`, `ok <data>`, or `err <message>`. This module is pure text
//! parsing and formatting with no Wayland types, so it is unit-tested directly,
//! including adversarial inputs (the tests live in `protocol_tests.rs`).

/// What:     `use std::path::PathBuf;`. Owned filesystem path.
/// Why:      A screenshot request carries an owned destination path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // path ~ string
/// ```
use std::path::PathBuf;

/// Which pointer button a click uses.
///
/// What:     `pub enum PointerButton { Left, Right, Middle }`. A closed set of three
///           variants. In Rust an `enum` is a tagged union; here each variant carries
///           no data.
/// Why:      Name the button symbolically at the protocol layer; the input layer maps
///           each to its evdev button code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PointerButton = "left" | "right" | "middle";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PointerButton {
    /// The primary (left) button.
    Left,
    /// The secondary (right) button.
    Right,
    /// The tertiary (middle) button.
    Middle,
}

/// Button-to-evdev-code mapping for pointer buttons.
///
/// What:     `impl PointerButton { ... }`. One method turning the enum into the raw
///           `BTN_*` code.
/// Why:      Keep the code mapping beside the button enum.
impl PointerButton {
    /// Map the button to its Linux evdev button code.
    ///
    /// What:     `pub fn evdev_code(self) -> u32`. Takes `self` by value (the enum is
    ///           `Copy`), returns the `BTN_*` code as an unsigned 32-bit integer.
    /// Why:      Smithay's `ButtonEvent.button` field is the raw evdev code.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// evdevCode(): number { ... }
    /// ```
    ///
    /// @example
    /// ```ts
    /// PointerButton.Left.evdevCode(); // => 272 (BTN_LEFT)
    /// ```
    pub fn evdev_code(self) -> u32 {
        // What:     `match self { Left => 0x110, Right => 0x111, Middle => 0x112 }`.
        //           Map each variant to its `BTN_*` constant (`BTN_LEFT` is `0x110`).
        //           Tail expression, so the matched value is returned.
        // Why:      Provide the exact code the input event expects.
        match self {
            PointerButton::Left => 0x110,
            PointerButton::Right => 0x111,
            PointerButton::Middle => 0x112,
        }
    }
}

/// What action a key request performs.
///
/// What:     `pub enum KeyAction { Press, Release, Tap }`. Three data-less variants.
/// Why:      A test may hold a key down, release it, or tap (press then release).
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type KeyAction = "press" | "release" | "tap";
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyAction {
    /// Press and hold.
    Press,
    /// Release a held key.
    Release,
    /// Press then immediately release.
    Tap,
}

/// A parsed control command.
///
/// What:     `pub enum Command { ... }`. A tagged union where each variant carries its
///           own arguments (`Screenshot` a path, `Click` coordinates, and so on).
/// Why:      One typed value the executor matches on, decoupling parsing from action.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Command =
///   | { kind: "ping" }
///   | { kind: "screenshot"; path: string }
///   | { kind: "click"; x: number; y: number; button: PointerButton }
///   | { kind: "key"; name: string; action: KeyAction }
///   | { kind: "type"; text: string }
///   | { kind: "resize"; width: number; height: number }
///   | { kind: "dropFile"; path: string; x?: number; y?: number }
///   | { kind: "quit" };
/// ```
#[derive(Debug, Clone, PartialEq)]
pub enum Command {
    /// Liveness check.
    Ping,
    /// Capture the current frame to a PNG at the given path.
    Screenshot(
        /// Destination PNG path.
        PathBuf,
    ),
    /// Click at a logical point with a button.
    Click {
        /// Logical x coordinate.
        x: f64,
        /// Logical y coordinate.
        y: f64,
        /// Which button to click.
        button: PointerButton,
    },
    /// Press/release/tap a named key.
    Key {
        /// Key name (e.g. `a`, `enter`, `space`).
        name: String,
        /// What to do with it.
        action: KeyAction,
    },
    /// Type a run of text as individual key taps.
    Type(
        /// Text to type verbatim.
        String,
    ),
    /// Resize the nested screen.
    Resize {
        /// New width in pixels.
        width: i32,
        /// New height in pixels.
        height: i32,
    },
    /// Originate a compositor-side file drag toward the hosted app (inbound DnD test).
    DropFile {
        /// File to advertise to the app as a `text/uri-list` drop.
        path: PathBuf,
        /// Optional drop x in logical coordinates (defaults to the window centre).
        x: Option<f64>,
        /// Optional drop y in logical coordinates (defaults to the window centre).
        y: Option<f64>,
    },
    /// Start recording frames at a steady rate into a directory.
    Record {
        /// Output directory for the frame sequence.
        dir: PathBuf,
        /// Target capture rate in frames per second.
        fps: f64,
        /// Output format name (validated when the command runs).
        format: String,
    },
    /// Stop the running recording.
    RecordStop,
    /// Stop the compositor.
    Quit,
}

/// A response to send back on the control socket.
///
/// What:     `pub enum Response { Ok, OkWith(String), Err(String) }`. Success with no
///           data, success with a payload, or an error message.
/// Why:      A uniform, machine-readable reply shape.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Response = { ok: true; data?: string } | { ok: false; error: string };
/// ```
#[derive(Debug, Clone, PartialEq)]
pub enum Response {
    /// Success, no payload.
    Ok,
    /// Success with a text payload.
    OkWith(
        /// Payload text.
        String,
    ),
    /// Failure with a message.
    Err(
        /// Error message.
        String,
    ),
}

/// Format a response as its single wire line (no trailing newline).
///
/// What:     `pub fn format_response(response: &Response) -> String`. Borrows the
///           response, returns an owned `String`.
/// Why:      The control thread appends a newline and writes this to the socket.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function formatResponse(r: Response): string { ... }
/// ```
///
/// @example
/// ```ts
/// formatResponse({ ok: false, error: "bad" }); // => "err bad"
/// ```
pub fn format_response(response: &Response) -> String {
    // What:     `match response { ... }`. Map each variant to its wire form. `Ok` is the
    //           literal `"ok"`; `OkWith(data)` is `"ok "` plus the payload; `Err(message)`
    //           is `"err "` plus the message. `.to_string()` / `format!` allocate owned
    //           strings.
    // Why:      Produce the exact bytes the client parses.
    match response {
        Response::Ok => "ok".to_string(),
        Response::OkWith(data) => format!("ok {data}"),
        Response::Err(message) => format!("err {message}"),
    }
}

/// Parse one request line into a `Command`.
///
/// What:     `pub fn parse_command(raw: &str) -> Result<Command, String>`. Borrows the
///           raw line, returns the parsed command or a human-readable error string. The
///           `Result` error type is `String` (not `anyhow`) so the error can be sent
///           straight back as an `err <message>` line.
/// Why:      Central grammar for the control protocol.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseCommand(raw: string): Command { ... } // throws string on bad input
/// ```
///
/// @example
/// ```ts
/// parseCommand("click 10 20"); // => { kind: "click", x: 10, y: 20, button: "left" }
/// ```
pub fn parse_command(raw: &str) -> Result<Command, String> {
    // What:     `let line = raw.trim_end_matches(['\r', '\n']);`. Strip only trailing
    //           carriage-return / newline characters (not interior or leading spaces).
    // Why:      A socket line arrives with its terminator; keep the payload otherwise
    //           intact so `type` and `screenshot` preserve embedded spaces.
    let line = raw.trim_end_matches(['\r', '\n']);

    // What:     `if let Some(text) = line.strip_prefix("type ") { return Ok(Command::Type(
    //           text.to_string())); }`. `strip_prefix` returns `Some(rest)` when the line
    //           begins with `type `; the rest is the text verbatim (spaces preserved).
    // Why:      Handle `type` before generic tokenising so its text is not split.
    if let Some(text) = line.strip_prefix("type ") {
        return Ok(Command::Type(text.to_string()));
    }

    // What:     `if line == "type" { return Ok(Command::Type(String::new())); }`. A bare
    //           `type` with no text types nothing. `String::new()` is the empty owned
    //           string.
    // Why:      Accept the degenerate empty-type case rather than erroring.
    if line == "type" {
        return Ok(Command::Type(String::new()));
    }

    // What:     `if let Some(path) = line.strip_prefix("screenshot ") { return Ok(
    //           Command::Screenshot(PathBuf::from(path.trim()))); }`. Take the rest as the
    //           destination path (trimmed of surrounding spaces).
    // Why:      Handle `screenshot` before tokenising so paths with spaces still work.
    if let Some(path) = line.strip_prefix("screenshot ") {
        // What:     `let path = path.trim();`. Drop surrounding whitespace.
        // Why:      Tolerate `screenshot  /tmp/a.png ` spacing.
        let path = path.trim();
        // What:     `if path.is_empty() { return Err(...); }`. Reject an empty path.
        // Why:      There is nowhere to write.
        if path.is_empty() {
            return Err("screenshot requires a path".to_string());
        }
        return Ok(Command::Screenshot(PathBuf::from(path)));
    }

    // What:     `let mut tokens = line.split_whitespace();`. Lazy iterator over
    //           whitespace-separated tokens (collapses runs of spaces). `mut` because we
    //           consume it with `.next()`.
    // Why:      The remaining verbs (ping, quit, click, key, resize) are simple token
    //           lists.
    let mut tokens = line.split_whitespace();

    // What:     `let verb = tokens.next().ok_or_else(|| "empty command".to_string())?;`.
    //           First token or an error if the line was blank. `.ok_or_else(closure)`
    //           turns `None` into `Err`; `?` unwraps.
    // Why:      Every command starts with a verb.
    let verb = tokens.next().ok_or_else(|| "empty command".to_string())?;

    // What:     `match verb { ... }`. Dispatch on the verb. Each arm parses its remaining
    //           tokens with a helper and returns a `Command` or an error.
    // Why:      Route to the right parser.
    match verb {
        "ping" => Ok(Command::Ping),
        "quit" => Ok(Command::Quit),
        "click" => parse_click(&mut tokens),
        "key" => parse_key(&mut tokens),
        "resize" => parse_resize(&mut tokens),
        "drop-file" => parse_drop_file(&mut tokens),
        "record" => parse_record(&mut tokens),
        other => Err(format!("unknown command: {other}")),
    }
}

/// Parse the arguments of a `record` command (`<dir> [fps] [format]` or `stop`).
///
/// What:     `fn parse_record(tokens: &mut std::str::SplitWhitespace) -> Result<Command,
///           String>`. The first token is either `stop` (stop recording) or the output
///           directory, optionally followed by an fps and a format name.
/// Why:      Isolate the recorder command grammar.
fn parse_record(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    // What:     `let first = tokens.next().ok_or_else(|| "record requires a directory or
    //           'stop'".to_string())?;`. Require the first token.
    // Why:      A bare `record` is ambiguous.
    let first = tokens
        .next()
        .ok_or_else(|| "record requires a directory or 'stop'".to_string())?;

    // What:     `if first == "stop" { if tokens.next().is_some() { return Err(...); } return
    //           Ok(Command::RecordStop); }`. Handle the stop form (which takes no more args).
    // Why:      `record stop` ends the recording.
    if first == "stop" {
        if tokens.next().is_some() {
            return Err("record stop takes no arguments".to_string());
        }
        return Ok(Command::RecordStop);
    }

    // What:     `let dir = PathBuf::from(first);`. The output directory (no spaces).
    // Why:      Where the frame sequence is written.
    let dir = PathBuf::from(first);

    // What:     `let fps = match tokens.next() { Some(text) => text.parse::<f64>()
    //           .map_err(|_| "record fps is not a number".to_string())?, None => 60.0 };`.
    //           Optional fps, defaulting to 60.
    // Why:      The requested capture rate.
    let fps = match tokens.next() {
        Some(text) => text
            .parse::<f64>()
            .map_err(|_| "record fps is not a number".to_string())?,
        None => 60.0,
    };

    // What:     `let format = tokens.next().unwrap_or("png").to_string();`. Optional format
    //           name, defaulting to `png`; validated later by the encoder.
    // Why:      Choose the output codec.
    let format = tokens.next().unwrap_or("png").to_string();

    // What:     `if tokens.next().is_some() { return Err(...); }`. Reject extra tokens.
    // Why:      `record` takes at most dir, fps, format.
    if tokens.next().is_some() {
        return Err("record takes at most a directory, fps, and format".to_string());
    }

    // What:     `Ok(Command::Record { dir, fps, format })`. Build the command (tail
    //           expression).
    // Why:      Return the parsed record request.
    Ok(Command::Record { dir, fps, format })
}

/// Parse the arguments of a `click` command.
///
/// What:     `fn parse_click(tokens: &mut std::str::SplitWhitespace) -> Result<Command,
///           String>`. Consumes the remaining tokens (an x, a y, and an optional button).
/// Why:      Keep the numeric/button parsing out of the top-level `match`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parseClick(tokens): Command { ... }
/// ```
fn parse_click(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    // What:     `let x = parse_f64(tokens.next(), "click x")?;`. Parse the next token as a
    //           float, with a field name for the error message.
    // Why:      The x coordinate.
    let x = parse_f64(tokens.next(), "click x")?;

    // What:     `let y = parse_f64(tokens.next(), "click y")?;`. Parse the y coordinate.
    // Why:      The y coordinate.
    let y = parse_f64(tokens.next(), "click y")?;

    // What:     `let button = match tokens.next() { Some(name) => parse_button(name)?,
    //           None => PointerButton::Left };`. An optional third token names the button;
    //           default to left.
    // Why:      Most tests click the primary button; make it optional.
    let button = match tokens.next() {
        Some(name) => parse_button(name)?,
        None => PointerButton::Left,
    };

    // What:     `Ok(Command::Click { x, y, button })`. Build the command (tail expression).
    // Why:      Return the parsed click.
    Ok(Command::Click { x, y, button })
}

/// Parse the arguments of a `key` command.
///
/// What:     `fn parse_key(tokens: &mut std::str::SplitWhitespace) -> Result<Command,
///           String>`. Consumes a key name and an optional action word.
/// Why:      Isolate key parsing.
fn parse_key(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    // What:     `let name = tokens.next().ok_or_else(|| "key requires a name".to_string())?
    //           .to_string();`. Take the key name (owned copy).
    // Why:      Identify which key.
    let name = tokens
        .next()
        .ok_or_else(|| "key requires a name".to_string())?
        .to_string();

    // What:     `let action = match tokens.next() { Some("press") => Press, Some("release")
    //           => Release, Some("tap") | None => Tap, Some(other) => return Err(...) };`.
    //           Parse the optional action; default `tap`.
    // Why:      Let a test hold or release keys as well as tap.
    let action = match tokens.next() {
        Some("press") => KeyAction::Press,
        Some("release") => KeyAction::Release,
        Some("tap") | None => KeyAction::Tap,
        Some(other) => return Err(format!("unknown key action: {other}")),
    };

    // What:     `Ok(Command::Key { name, action })`. Build the command.
    // Why:      Return the parsed key command.
    Ok(Command::Key { name, action })
}

/// Parse the arguments of a `resize` command.
///
/// What:     `fn parse_resize(tokens: &mut std::str::SplitWhitespace) -> Result<Command,
///           String>`. Consumes a width and a height.
/// Why:      Isolate resize parsing.
fn parse_resize(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    // What:     `let width = parse_i32(tokens.next(), "resize width")?;`. Parse the width.
    // Why:      New screen width.
    let width = parse_i32(tokens.next(), "resize width")?;

    // What:     `let height = parse_i32(tokens.next(), "resize height")?;`. Parse height.
    // Why:      New screen height.
    let height = parse_i32(tokens.next(), "resize height")?;

    // What:     `if width <= 0 || height <= 0 { return Err(...); }`. Reject non-positive
    //           sizes.
    // Why:      A zero/negative screen cannot exist.
    if width <= 0 || height <= 0 {
        return Err("resize dimensions must be positive".to_string());
    }

    // What:     `Ok(Command::Resize { width, height })`. Build the command.
    // Why:      Return the parsed resize.
    Ok(Command::Resize { width, height })
}

/// Parse the arguments of a `drop-file` command (`<path> [x y]`).
///
/// What:     `fn parse_drop_file(tokens: &mut std::str::SplitWhitespace) ->
///           Result<Command, String>`. The first token is the file path; two optional
///           trailing tokens are the drop x and y. The path is a single whitespace-free
///           token (unlike `screenshot`, because x/y follow it), which is enough for a
///           test fixture dropping paths like `/tmp/hello.txt`.
/// Why:      Isolate the drop-file grammar; both coordinates or neither.
fn parse_drop_file(tokens: &mut std::str::SplitWhitespace) -> Result<Command, String> {
    // What:     `let path = PathBuf::from(tokens.next().ok_or_else(...)?);`. Require the
    //           first token and wrap it as an owned path.
    // Why:      There is nothing to drag without a source file.
    let path = PathBuf::from(
        tokens
            .next()
            .ok_or_else(|| "drop-file requires a path".to_string())?,
    );

    // What:     `let x = parse_opt_f64(tokens.next(), "drop-file x")?;`. Parse the optional
    //           x coordinate: `None` when absent, else a parsed `f64` (error on garbage).
    // Why:      The drop point x, defaulted later to the window centre when absent.
    let x = parse_opt_f64(tokens.next(), "drop-file x")?;

    // What:     `let y = parse_opt_f64(tokens.next(), "drop-file y")?;`. Same for y.
    // Why:      The drop point y.
    let y = parse_opt_f64(tokens.next(), "drop-file y")?;

    // What:     `if x.is_some() != y.is_some() { return Err(...); }`. `!=` on two bools is
    //           XOR: true only when exactly one coordinate was given.
    // Why:      A lone x (or y) is ambiguous; require both or neither.
    if x.is_some() != y.is_some() {
        return Err("drop-file needs both x and y or neither".to_string());
    }

    // What:     `if tokens.next().is_some() { return Err(...); }`. Reject extra tokens.
    // Why:      `drop-file` takes at most path, x, y.
    if tokens.next().is_some() {
        return Err("drop-file takes at most a path, x, and y".to_string());
    }

    // What:     `Ok(Command::DropFile { path, x, y })`. Build the command (tail expression).
    // Why:      Return the parsed drop-file request.
    Ok(Command::DropFile { path, x, y })
}

/// Parse an optional-and-may-be-absent token as `f64`, with a field name for errors.
///
/// What:     `fn parse_opt_f64(token: Option<&str>, field: &str) -> Result<Option<f64>,
///           String>`. Unlike `parse_f64`, a missing token is `Ok(None)` (not an error);
///           only a present-but-non-numeric token errors.
/// Why:      `drop-file` coordinates are optional, so absence is valid.
fn parse_opt_f64(token: Option<&str>, field: &str) -> Result<Option<f64>, String> {
    // What:     `match token { None => Ok(None), Some(text) => Ok(Some(text.parse::<f64>()
    //           .map_err(...)?)) }`. Map absence to `None`; parse a present token, mapping a
    //           parse failure to a message, then rewrap as `Some`. Tail expression.
    // Why:      Distinguish "not given" (fine) from "given but not a number" (error).
    match token {
        None => Ok(None),
        Some(text) => Ok(Some(
            text.parse::<f64>()
                .map_err(|_| format!("{field} is not a number"))?,
        )),
    }
}

/// Parse an optional token as `f64`, with a field name for errors.
///
/// What:     `fn parse_f64(token: Option<&str>, field: &str) -> Result<f64, String>`.
///           `f64` is a 64-bit float (sibling: 32-bit `f32`).
/// Why:      Click coordinates are floating-point logical positions.
fn parse_f64(token: Option<&str>, field: &str) -> Result<f64, String> {
    // What:     `token.ok_or_else(|| format!("{field} missing"))?.parse::<f64>()
    //           .map_err(|_| format!("{field} is not a number"))`. Require the token, then
    //           parse it, converting both the missing and the non-numeric cases into
    //           messages. Tail expression.
    // Why:      One place for the "present and numeric" check.
    token
        .ok_or_else(|| format!("{field} missing"))?
        .parse::<f64>()
        .map_err(|_| format!("{field} is not a number"))
}

/// Parse an optional token as `i32`, with a field name for errors.
///
/// What:     `fn parse_i32(token: Option<&str>, field: &str) -> Result<i32, String>`.
/// Why:      Resize dimensions are signed integers (to match Smithay geometry).
fn parse_i32(token: Option<&str>, field: &str) -> Result<i32, String> {
    // What:     `token.ok_or_else(...)?.parse::<i32>().map_err(...)`. Same shape as
    //           `parse_f64` for integers.
    // Why:      One place for the integer check.
    token
        .ok_or_else(|| format!("{field} missing"))?
        .parse::<i32>()
        .map_err(|_| format!("{field} is not an integer"))
}

/// Parse a pointer-button name.
///
/// What:     `fn parse_button(name: &str) -> Result<PointerButton, String>`. Maps a name
///           to a variant.
/// Why:      Accept `left`/`right`/`middle` in click commands.
fn parse_button(name: &str) -> Result<PointerButton, String> {
    // What:     `match name { "left" => Ok(Left), "right" => Ok(Right), "middle" =>
    //           Ok(Middle), other => Err(...) }`. Map names to variants.
    // Why:      Reject unknown button names cleanly.
    match name {
        "left" => Ok(PointerButton::Left),
        "right" => Ok(PointerButton::Right),
        "middle" => Ok(PointerButton::Middle),
        other => Err(format!("unknown button: {other}")),
    }
}

/// What:     `#[cfg(test)] #[path = "protocol_tests.rs"] mod tests;`. Declares the unit
///           test module (compiled only for tests) from the sibling file.
/// Why:      Keep the adversarial parser/response tests beside the grammar they guard.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./protocol_tests";
/// ```
#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;

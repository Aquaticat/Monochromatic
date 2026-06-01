//! One error type for the whole player. Decoding, I/O, Opus, and audio-output
//! failures all funnel into `PlayerError` so functions can use `?` freely.

// What:     `use std::fmt;` imports the formatting module (for `Display`).
// Why:      We implement human-readable error messages.
// TS map:   no import needed; `toString()` is built in.
use std::fmt;

// What:     `#[derive(Debug)]` auto-implements `{:?}` debug printing for the
//           enum. Errors must be `Debug` to be used with `?`/`Result`.
// Why:      Logging and the `std::error::Error` bound both want `Debug`.
// TS map:   no annotation; JS objects print themselves.
#[derive(Debug)]
// What:     `pub enum PlayerError { ... }` a sum type: a value is exactly one
//           of these failure cases. Several variants WRAP an inner error value.
// Why:      A single error type lets `?` convert any sub-error into this and
//           propagate it.
// TS map:   a tagged union of error shapes, or distinct `Error` subclasses.
//
// In TS you'd write (pseudocode):
// ```ts
// type PlayerError =
//   | { kind: "io"; cause: Error }
//   | { kind: "decode"; cause: Error }
//   | { kind: "opus"; cause: Error }
//   | { kind: "unsupported"; message: string }
//   | { kind: "audio"; message: string };
// ```
pub enum PlayerError {
    // What:     `Io(std::io::Error)` wraps a filesystem/stream error.
    // Why:      Opening or reading a file can fail.
    // TS map:   a wrapped Node `Error` from fs.
    Io(std::io::Error),
    // What:     `Decode(symphonia::core::errors::Error)` wraps a symphonia error.
    // Why:      Probing/demuxing/decoding can fail.
    // TS map:   a wrapped decoder error.
    Decode(symphonia::core::errors::Error),
    // What:     `Opus(opus::Error)` wraps a libopus error.
    // Why:      Opus packet decoding can fail.
    // TS map:   a wrapped opus error.
    Opus(opus::Error),
    // What:     `Unsupported(String)` carries an owned message describing an
    //           unsupported file/codec situation. `String` (owned) not `&str`
    //           (borrowed) because the error outlives the call that made it.
    // Why:      Report "no audio track" / ">2 Opus channels" cleanly.
    // TS map:   `{ kind: "unsupported"; message: string }`.
    Unsupported(String),
    // What:     `Audio(String)` an owned message for audio-output (PipeWire)
    //           failures whose native error types we flatten to text.
    // Why:      PipeWire errors come in several types; one string is enough here.
    // TS map:   `{ kind: "audio"; message: string }`.
    Audio(String),
}

// What:     `impl fmt::Display for PlayerError` provides the user-facing message.
//           `Display` is the "pretty print" trait (vs `Debug`'s developer view).
// Why:      We print these errors to stderr and into other messages.
// TS map:   overriding `toString()`.
//
// In TS you'd write (pseudocode):
// ```ts
// toString(): string { switch (this.kind) { ... } }
// ```
impl fmt::Display for PlayerError {
    // What:     `fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result`. `&self`
    //           read-only borrow; `f` is the output sink (`&mut` = we write into
    //           it); `'_` is an inferred lifetime; `fmt::Result` is
    //           `Result<(), fmt::Error>`.
    // Why:      The single method `Display` requires.
    // TS map:   `toString(): string` (here we write into a buffer instead).
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // What:     `match self { ... }` dispatches on which variant this is.
        //           Each arm binds the inner value by reference (`e`/`m`).
        // Why:      Produce a message tailored to the case.
        // TS map:   `switch (this.kind) { ... }`.
        match self {
            // What:     `PlayerError::Io(e) => write!(f, "i/o error: {e}")`. `write!`
            //           is a macro that formats into `f`; `{e}` interpolates the
            //           inner error's own Display. The arm's value is the macro's
            //           `fmt::Result`, returned from `fmt`.
            // Why:      Prefix the category, then defer to the inner message.
            // TS map:   `return "i/o error: " + e;`
            PlayerError::Io(e) => write!(f, "i/o error: {e}"),
            // What:     decode error arm.
            // Why:      Same shape.
            // TS map:   `return "decode error: " + e;`
            PlayerError::Decode(e) => write!(f, "decode error: {e}"),
            // What:     opus error arm.
            // Why:      Same shape.
            // TS map:   `return "opus error: " + e;`
            PlayerError::Opus(e) => write!(f, "opus error: {e}"),
            // What:     unsupported arm; `m` is the `&String` message.
            // Why:      Surface the explanation.
            // TS map:   `return "unsupported: " + m;`
            PlayerError::Unsupported(m) => write!(f, "unsupported: {m}"),
            // What:     audio arm.
            // Why:      Surface the explanation.
            // TS map:   `return "audio error: " + m;`
            PlayerError::Audio(m) => write!(f, "audio error: {m}"),
        }
    }
}

// What:     `impl std::error::Error for PlayerError {}` marks the type as a
//           standard error. The empty body accepts the default behaviour.
// Why:      Lets `PlayerError` interoperate with `Box<dyn Error>` and `?` in
//           callers that want a generic error.
// TS map:   making the type `extends Error` conceptually.
impl std::error::Error for PlayerError {}

// What:     `impl From<std::io::Error> for PlayerError` defines how to CONVERT an
//           io error into our error. `From` powers the `?` operator's automatic
//           conversion.
// Why:      So `let f = File::open(p)?;` turns an io error into a `PlayerError`.
// TS map:   no analogue; `?` + `From` is Rust's typed error-propagation glue.
//
// In TS you'd write (pseudocode):
// ```ts
// // implicit: a thrown fs Error is just rethrown.
// ```
impl From<std::io::Error> for PlayerError {
    // What:     `fn from(e: std::io::Error) -> PlayerError` takes ownership of the
    //           io error and wraps it.
    // Why:      Build the `Io` variant.
    // TS map:   identity wrap.
    fn from(e: std::io::Error) -> PlayerError {
        // What:     `PlayerError::Io(e)` constructs the variant. Tail expression.
        // Why:      Wrap and return.
        // TS map:   `return { kind: "io", cause: e };`
        PlayerError::Io(e)
    }
}

// What:     `impl From<symphonia::core::errors::Error> for PlayerError` conversion
//           for symphonia errors.
// Why:      Enables `?` on symphonia calls.
// TS map:   rethrow.
impl From<symphonia::core::errors::Error> for PlayerError {
    fn from(e: symphonia::core::errors::Error) -> PlayerError {
        // What:     wrap into the `Decode` variant. Tail expression.
        // Why:      Return as our error.
        // TS map:   `return { kind: "decode", cause: e };`
        PlayerError::Decode(e)
    }
}

// What:     `impl From<opus::Error> for PlayerError` conversion for opus errors.
// Why:      Enables `?` on opus calls.
// TS map:   rethrow.
impl From<opus::Error> for PlayerError {
    fn from(e: opus::Error) -> PlayerError {
        // What:     wrap into the `Opus` variant. Tail expression.
        // Why:      Return as our error.
        // TS map:   `return { kind: "opus", cause: e };`
        PlayerError::Opus(e)
    }
}

//! What:
//!  Typed configuration failures with operation-focused messages.
//! Why:
//!  The CLI can distinguish setup errors from rule findings without parsing diagnostics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! class ConfigError extends Error {}
//! ```

/// What:
///  An owned message for a rejected configuration.
/// Why:
///  A String owns its bytes,
///  unlike a borrowed &str,
///  so the error can outlive the input document.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// class ConfigError extends Error { readonly message: string }
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigError {
    /// Explanation that the caller prefixes with the affected configuration path.
    pub message: String,
}

/// What:
///  Construction of configuration failures.
/// Why:
///  Call sites keep their validation condition next to its user-facing explanation.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// new ConfigError(message);
/// ```
impl ConfigError {
    /// What:
    ///  Copy borrowed message text into the error's owned storage.
    /// Why:
    ///  Temporary formatted messages must remain valid after validation returns.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// constructor(message: string) { super(message); }
    /// ```
    pub fn new(message: &str) -> ConfigError {
        // What: Allocate an owned string from the borrowed message.
        // Why: Rust does not implicitly copy a borrowed string into an owning field.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { message };
        // ```
        return ConfigError {
            message: String::from(message),
        };
    }
}

/// What:
///  Supply the standard printable-error interface.
/// Why:
///  Callers can render the message without knowing the error's storage layout.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// toString(): string { return this.message; }
/// ```
impl std::fmt::Display for ConfigError {
    /// Borrow the formatter only while it writes this error's message.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return formatter.write_str(self.message.as_str());
    }
}

/// What:
///  Mark this value as a standard error.
/// Why:
///  Application error handling can carry it without converting it to an untyped string.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // Extending Error supplies this integration in TypeScript.
/// ```
impl std::error::Error for ConfigError {}

//! What: Typed execution settings for the shipped Rust rules.
//! Why: File matching yields validated JSONC, but rule dispatch should not reinterpret loose option objects repeatedly.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! type RustRuleSettings = { maxLines?: { severity: Severity; max: number }; rustdoc?: Severity; anonymous?: Severity; explicit?: Severity };
//! ```

/// Import existing schema readers and validation instead of adding another configuration grammar.
use crate::config_data::{key_text, text, validate_data};
use crate::config_error::ConfigError;
use crate::configuration_rules::{line_limit, validate_rules};
/// Import the diagnostic severity, which intentionally has no Off variant.
use crate::diagnostic::Severity;
/// Import the exact JSONC representation.
use monochromatic_jsonc_edit::JsoncValue;

/// A selected line-budget rule's complete execution parameters.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LineBudget {
    /// Severity selected by matching configuration blocks.
    pub severity: Severity,
    /// Exact nonnegative code-line limit.
    pub max: usize,
}

/// Immutable rule selection; absence and explicit off both leave the rule disabled.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RustRuleSettings {
    /// Optional code-line budget.
    pub max_lines: Option<LineBudget>,
    /// Documentation requirement, including private declarations.
    pub rustdoc: Option<Severity>,
    /// Ban parsed anonymous functions.
    pub no_anonymous_functions: Option<Severity>,
    /// Full semantic annotation policy, which requires a workspace context.
    pub explicit_types: Option<Severity>,
}

/// Read a selected severity and line limit after ordinary schema validation.
fn options(setting: &JsoncValue) -> Result<(Option<Severity>, usize), ConfigError> {
    let mut selected: Option<Option<Severity>> = None;
    let mut max: usize = 300;
    for entry in setting.entries().expect("rule settings validated as a record") {
        let key: String = key_text(&entry.key.units)?;
        if key == "severity" {
            let value: String = text(&entry.value, "severity")?;
            selected = Some(match value.as_str() {
                "off" => None,
                "warn" => Some(Severity::Warn),
                "error" => Some(Severity::Error),
                _ => return Err(ConfigError::new("Rule severity must be off, warn, or error.")),
            });
        } else if key == "max" {
            max = line_limit(&entry.value)?;
        }
    }
    let Some(severity): Option<Option<Severity>> = selected else {
        return Err(ConfigError::new("A selected rule requires severity off, warn, or error before execution."));
    };
    return Ok((severity, max));
}

/// Convert merged rules without enabling unselected Rust checks or ignoring misspelled settings.
pub fn rust_rule_settings(rules: &JsoncValue) -> Result<RustRuleSettings, ConfigError> {
    validate_data(rules)?;
    validate_rules(rules)?;
    let mut result: RustRuleSettings = RustRuleSettings::default();
    for entry in rules.entries().expect("rule record validated") {
        let id: String = key_text(&entry.key.units)?;
        if !id.starts_with("rust/") {
            continue;
        }
        let (severity, max): (Option<Severity>, usize) = options(&entry.value)?;
        match id.as_str() {
            "rust/max-lines" => {
                if let Some(value) = severity {
                    result.max_lines = Some(LineBudget { severity: value, max });
                }
            }
            "rust/require-rustdoc" => result.rustdoc = severity,
            "rust/no-anonymous-functions" => result.no_anonymous_functions = severity,
            "rust/require-explicit-types" => result.explicit_types = severity,
            _ => return Err(ConfigError::new(format!("Rust rule {id} has no execution adapter.").as_str())),
        }
    }
    return Ok(result);
}

/// Keep configuration execution controls outside release code.
#[cfg(test)]
#[path = "rust_rule_settings_tests.rs"]
mod tests;

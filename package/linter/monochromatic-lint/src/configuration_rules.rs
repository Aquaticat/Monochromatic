//! What:
//!  Rule identifiers and option shapes accepted by unified-linter configuration.
//! Why:
//!  The shipped-only design must reject misspelled rules and unsupported options.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Validate options for the fixed shipped rule registry.
//! ```

/// Import shared schema readers and typed errors.
use crate::config_data::{key_text, strings, text};
use crate::config_error::ConfigError;
/// Import the JSONC model so numbers stay exact until their rule-specific conversion.
use monochromatic_jsonc_edit::{JsoncKind, JsoncValue};

/// What:
///  The exact identifiers of the currently specified built-in rules.
/// Why:
///  No package name,
///  executable or callback can add a runtime policy.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const ruleIds = new Set([...]);
/// ```
pub const RULE_IDS: &[&str] = &[
    "rust/max-lines",
    "rust/require-rustdoc",
    "rust/no-anonymous-functions",
    "rust/require-explicit-types",
    "markdown/heading-increment",
    "markdown/commands-show-output",
    "markdown/no-duplicate-heading",
    "markdown/single-h1",
    "markdown/no-trailing-punctuation",
    "markdown/no-bare-urls",
    "markdown/no-emphasis-as-heading",
    "markdown/fenced-code-language",
    "markdown/link-image-reference-definitions",
    "markdown/link-image-style",
    "markdown/no-pipe-tables",
    "markdown/semantic-line-breaks",
    "markdown/lfs-image-url",
];

/// What:
///  Convert an exact JSON number to an unsigned platform-sized line count.
/// Why:
///  usize matches source indexing;
///  fractional,
///  negative and overflowing counts are errors,
/// rather than rounded floating-point values.
///  u32 or u64 would impose a different indexing range.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function lineLimit(value: JsoncValue): number;
/// ```
pub(crate) fn line_limit(value: &JsoncValue) -> Result<usize, ConfigError> {
    // What: Extract the exact-number payload from a borrowed value.
    // Why: A string such as "300" must not be silently accepted as a numeric option.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (value.kind !== 'number') throw new ConfigError('...');
    // ```
    let JsoncKind::Number { identity, .. } = &value.kind else {
        return Err(ConfigError::new(
            "rust/max-lines max must be a nonnegative integer.",
        ));
    };
    if identity.is_negative() {
        return Err(ConfigError::new(
            "rust/max-lines max must be a nonnegative integer.",
        ));
    }
    // Exact zero accepts every zero spelling, including -0 and 0e100000.
    if identity.is_zero() {
        return Ok(0);
    }
    // Parse the normalized coefficient; no floating-point conversion or rounding occurs.
    let coefficient_result = identity.digits().parse::<usize>();
    let exponent_result = identity.exponent().parse::<u32>();
    // What: Narrow both numeric parses together into their successful variants.
    // Why: A negative exponent represents a fraction after canonical trailing-zero removal.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (coefficientIsInteger && exponentIsUnsigned) { ... }
    // ```
    let (Ok(coefficient), Ok(exponent)) = (coefficient_result, exponent_result) else {
        return Err(ConfigError::new(
            "rust/max-lines max must be a nonnegative integer that fits this platform's line index.",
        ));
    };
    // Checked arithmetic returns absence on overflow instead of wrapping the line limit.
    let Some(scale) = 10_usize.checked_pow(exponent) else {
        return Err(ConfigError::new(
            "rust/max-lines max exceeds this platform's line index.",
        ));
    };
    let Some(result) = coefficient.checked_mul(scale) else {
        return Err(ConfigError::new(
            "rust/max-lines max exceeds this platform's line index.",
        ));
    };
    return Ok(result);
}

/// What:
///  Validate one rule-settings object without filling in missing fields.
/// Why:
///  Later matching blocks can supply severity or override options before final resolution.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function validateSetting(id: string, setting: JsoncValue): void;
/// ```
pub(crate) fn validate_setting(id: &str, setting: &JsoncValue) -> Result<(), ConfigError> {
    // Borrow the rule name for registry lookup; membership does not allocate.
    if !RULE_IDS.contains(&id) {
        return Err(ConfigError::new(
            format!("Unknown built-in rule {id}.").as_str(),
        ));
    }
    let Some(entries) = setting.entries() else {
        return Err(ConfigError::new(
            format!("Rule {id} settings must be an object.").as_str(),
        ));
    };
    for entry in entries {
        // Decode the key and propagate invalid UTF-16 as a typed setup failure.
        let name = key_text(&entry.key.units)?;
        if name == "severity" {
            let severity = text(&entry.value, "severity")?;
            if severity != "off" && severity != "warn" && severity != "error" {
                return Err(ConfigError::new(
                    format!("Rule {id} severity must be off, warn, or error.").as_str(),
                ));
            }
            continue;
        }
        if id == "rust/max-lines" && name == "max" {
            // Validate the count now; final resolution reuses this conversion after merging.
            line_limit(&entry.value)?;
            continue;
        }
        if id == "markdown/lfs-image-url" && name == "exclude" {
            strings(&entry.value, "exclude")?;
            continue;
        }
        return Err(ConfigError::new(
            format!("Rule {id} has unknown option {name}.").as_str(),
        ));
    }
    return Ok(());
}

/// What:
///  Validate the names and option objects within one rules record.
/// Why:
///  Disabled rules are still checked,
///  so invalid settings do not become latent surprises.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function validateRules(rules: JsoncValue): void;
/// ```
pub(crate) fn validate_rules(rules: &JsoncValue) -> Result<(), ConfigError> {
    let Some(entries) = rules.entries() else {
        return Err(ConfigError::new("Configuration rules must be an object."));
    };
    for entry in entries {
        let name = key_text(&entry.key.units)?;
        validate_setting(name.as_str(), &entry.value)?;
    }
    return Ok(());
}

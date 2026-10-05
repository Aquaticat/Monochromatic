//! What: Validation of the `policies` section and of each policy's options.
//! Why: Only shipped policy IDs, the three severities and each policy's declared
//!      option keys are settings; everything else is reported with its key.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // parsePolicies(value) returns PolicyConfig or throws ConfigError naming the key.
//! ```

/// What: `use super::...` imports sibling modules of this crate.
/// Why:  The section reader combines the error type, typed settings, shared value
///       readers and the compiled-in registry.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ConfigError } from './config-error.ts';
/// ```
use super::config_error::ConfigError;
use super::config_schema::{
    ForbiddenStringsOptions, MarkdownAutofixOptions, MarkdownRule, PolicyConfig,
    markdown_rule_from_name,
};
use super::config_values::{boolean, member_keys, member_path, strings, text, wrong_kind};
use super::policy_registry::{
    POLICY_REGISTRY, PolicyDescriptor, PolicyId, Severity, policy_by_name, severity_from_name,
};
/// What: Import the repository's JSONC value type.
/// Why:  The reader walks the parser's values directly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import type { JsoncValue } from 'jsonc-edit';
/// ```
use monochromatic_jsonc_edit::JsoncValue;

/// What: List every shipped policy ID for the unknown-ID diagnostic.
///       `String` is owned text (sibling `&str` borrows).
/// Why:  The remedy for a mistyped ID is the list of real ones.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function knownPolicyIds(): string;
/// ```
fn known_policy_ids() -> String {
    // What: `String::new()` is empty owned text; `mut` allows appending.
    // Why:  The list is built once, only on the failure path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let result = '';
    // ```
    let mut result: String = String::new();
    // `for ... in` borrows each registry row in order.
    for descriptor in POLICY_REGISTRY {
        if !result.is_empty() {
            result.push_str(", ");
        }
        result.push_str(descriptor.name);
    }
    return result;
}

/// What: Read a severity word at a named key.
///       `Result<T, E>` is "value or error": `Ok(...)` or `Err(...)`.
/// Why:  A misspelled severity must never silently fall back to a default.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function severity(value: JsoncValue, path: string): Severity;
/// ```
fn severity(value: &JsoncValue, path: &str) -> Result<Severity, ConfigError> {
    // What: A trailing `?` returns the reader's `Err` to our caller, or unwraps its value.
    // Why:  A non-string severity is already a complete, key-naming failure.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const word = text(value, path); // a throw propagates
    // ```
    let word: String = text(value, path)?;
    // What: `let Some(x) = ... else { return ... };` unwraps the present case or exits.
    //       `.as_str()` lends the owned word as borrowed text.
    // Why:  Only `off`, `warn` and `error` are severities.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parsed = severityFromName(word); if (parsed === undefined) throw new ConfigError(...);
    // ```
    let Some(parsed) = severity_from_name(word.as_str()) else {
        // `Err(...)` is the failure variant; `format!` builds the owned message.
        return Err(ConfigError::new(
            format!(
                "Configuration key {path} has an invalid severity {word:?}; use \"off\", \"warn\" or \"error\"."
            )
            .as_str(),
        ));
    };
    // `Ok(parsed)` is the success variant.
    return Ok(parsed);
}

/// What: Validate the options object of `security/forbidden-strings`.
/// Why:  The scanner is linked into cli-git; an `executable` path would let repository
///       data choose a program to run, which this configuration format forbids.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function forbiddenStringsOptions(value: JsoncValue, path: string): ForbiddenStringsOptions;
/// ```
fn forbidden_strings_options(
    value: &JsoncValue,
    path: &str,
) -> Result<ForbiddenStringsOptions, ConfigError> {
    let Some(entries) = value.entries() else {
        return Err(wrong_kind(value, path, "an options object"));
    };
    let keys: Vec<String> = member_keys(entries, path)?;
    // `mut` allows the default to be replaced by a configured value.
    let mut options: ForbiddenStringsOptions = PolicyConfig::defaults().forbidden_strings;
    // What: `.iter().enumerate()` yields `(index, item)` pairs; `usize` is the index type.
    // Why:  The decoded keys are parallel to `entries`, so the index reaches the value.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const [index, key] of keys.entries()) { ... }
    // ```
    for (index, key) in keys.iter().enumerate() {
        let key_path: String = member_path(path, key.as_str());
        // `&entries[index].value` borrows the member value parallel to this key.
        let member: &JsoncValue = &entries[index].value;
        if key == "builtinRules" {
            options.builtin_rules = boolean(member, key_path.as_str())?;
        } else if key == "executable" {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {key_path} is retired: cli-git runs its bundled \
                     forbidden-strings scanner and configuration cannot select an executable. \
                     Remove the key."
                )
                .as_str(),
            ));
        } else {
            return Err(ConfigError::new(
                format!(
                    "Unknown configuration key: {key_path}. The only accepted option is builtinRules."
                )
                .as_str(),
            ));
        }
    }
    return Ok(options);
}

/// What: Validate the `rules` list of `markdown/autofix`.
///       `Vec<MarkdownRule>` is an owned growable list (sibling `&[T]` borrows one).
/// Why:  Only shipped rules exist, an empty list would enable a policy that does
///       nothing, and a repeated rule is an ambiguous duplicate setting.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function markdownRules(value: JsoncValue, path: string): MarkdownRule[];
/// ```
fn markdown_rules(value: &JsoncValue, path: &str) -> Result<Vec<MarkdownRule>, ConfigError> {
    let names: Vec<String> = strings(value, path)?;
    if names.is_empty() {
        return Err(ConfigError::new(
            format!(
                "Configuration key {path} must name at least one rule; set the policy's \
                 severity to \"off\" to disable it."
            )
            .as_str(),
        ));
    }
    // `Vec::<T>::with_capacity(n)` is an empty list with room for `n` items.
    let mut rules: Vec<MarkdownRule> = Vec::<MarkdownRule>::with_capacity(names.len());
    for (index, name) in names.iter().enumerate() {
        let element_path: String = format!("{path}[{index}]");
        let Some(rule) = markdown_rule_from_name(name.as_str()) else {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {element_path} names an unknown Markdown rule {name:?}; \
                     the shipped rule is \"lfs-image-url\"."
                )
                .as_str(),
            ));
        };
        // `.contains(&rule)` borrows the new rule to compare it with earlier ones.
        if rules.contains(&rule) {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {element_path} repeats the Markdown rule {name:?}; \
                     list each rule once."
                )
                .as_str(),
            ));
        }
        rules.push(rule);
    }
    return Ok(rules);
}

/// What: Validate the options object of `markdown/autofix`.
/// Why:  cli-git starts its own coordinated linter; a `command` array would let
///       repository data choose a program and its arguments.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function markdownAutofixOptions(value: JsoncValue, path: string): MarkdownAutofixOptions;
/// ```
fn markdown_autofix_options(
    value: &JsoncValue,
    path: &str,
) -> Result<MarkdownAutofixOptions, ConfigError> {
    let Some(entries) = value.entries() else {
        return Err(wrong_kind(value, path, "an options object"));
    };
    let keys: Vec<String> = member_keys(entries, path)?;
    let mut options: MarkdownAutofixOptions = PolicyConfig::defaults().markdown_autofix;
    for (index, key) in keys.iter().enumerate() {
        let key_path: String = member_path(path, key.as_str());
        let member: &JsoncValue = &entries[index].value;
        if key == "rules" {
            options.rules = markdown_rules(member, key_path.as_str())?;
        } else if key == "exclude" {
            options.exclude = strings(member, key_path.as_str())?;
        } else if key == "command" {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {key_path} is retired: cli-git runs its own coordinated \
                     Markdown linter and configuration cannot select a command. Remove the key."
                )
                .as_str(),
            ));
        } else {
            return Err(ConfigError::new(
                format!("Unknown configuration key: {key_path}. Accepted options: rules, exclude.")
                    .as_str(),
            ));
        }
    }
    return Ok(options);
}

/// What: Validate one policy's setting and write it into the accumulated settings.
///       `&mut PolicyConfig` lends the settings for modification (plain `&` is read-only).
/// Why:  A setting is a severity word, or `[severity, options]` for the policies that
///       declare options. Mutating one accumulated record keeps each policy's row and
///       option record together.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function applySetting(config: PolicyConfig, descriptor: PolicyDescriptor, value: JsoncValue): void;
/// ```
fn apply_setting(
    config: &mut PolicyConfig,
    descriptor: &PolicyDescriptor,
    value: &JsoncValue,
) -> Result<(), ConfigError> {
    let path: String = member_path("policies", descriptor.name);
    // `Severity` is filled by exactly one of the two accepted forms.
    let chosen: Severity;
    // `if let Some(elements) = ...` runs only when the setting is an array.
    if let Some(elements) = value.elements() {
        if !descriptor.accepts_options {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {path} does not accept options; write the severity \
                     alone, for example \"error\"."
                )
                .as_str(),
            ));
        }
        if elements.len() != 2 {
            return Err(ConfigError::new(
                format!(
                    "Configuration key {path} must be a severity or exactly [severity, options]; \
                     found an array of {} items.",
                    elements.len()
                )
                .as_str(),
            ));
        }
        // `&elements[0]` borrows the first array item.
        chosen = severity(&elements[0], format!("{path}[0]").as_str())?;
        let options_path: String = format!("{path}[1]");
        if descriptor.id == PolicyId::ForbiddenStrings {
            config.forbidden_strings =
                forbidden_strings_options(&elements[1], options_path.as_str())?;
        } else {
            config.markdown_autofix =
                markdown_autofix_options(&elements[1], options_path.as_str())?;
        }
    } else if value.text_units().is_some() {
        chosen = severity(value, path.as_str())?;
    } else {
        let expected: &str = if descriptor.accepts_options {
            "a severity string or [severity, options]"
        } else {
            "a severity string"
        };
        return Err(wrong_kind(value, path.as_str(), expected));
    }
    // `&mut config.settings` lends each row for in-place update.
    for setting in &mut config.settings {
        if setting.id == descriptor.id {
            setting.severity = chosen;
            setting.explicit = true;
        }
    }
    // `Ok(())` is success with no value; `()` is Rust's empty value, like `void`.
    return Ok(());
}

/// What: Validate the whole `policies` object.
/// Why:  Unknown IDs are errors, so a typo cannot silently leave a policy at its
///       default; unmentioned policies keep their registry defaults.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function parsePolicies(value: JsoncValue): PolicyConfig;
/// ```
pub(crate) fn parse_policies(value: &JsoncValue) -> Result<PolicyConfig, ConfigError> {
    let Some(entries) = value.entries() else {
        return Err(wrong_kind(
            value,
            "policies",
            "an object mapping policy IDs to settings",
        ));
    };
    let keys: Vec<String> = member_keys(entries, "policies")?;
    let mut config: PolicyConfig = PolicyConfig::defaults();
    for (index, key) in keys.iter().enumerate() {
        let member: &JsoncValue = &entries[index].value;
        let Some(descriptor) = policy_by_name(key.as_str()) else {
            return Err(ConfigError::new(
                format!(
                    "Unknown policy ID: {key}. Shipped policies: {}.",
                    known_policy_ids()
                )
                .as_str(),
            ));
        };
        // `&mut config` lends the accumulated settings for this one update.
        apply_setting(&mut config, descriptor, member)?;
    }
    return Ok(config);
}

//! What: Validated JSONC to typed Rust dispatch controls.
//! Why: Omission, explicit off and selected severity have different configuration meanings.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Resolve typed settings, then exercise the selected syntax checks through their consumer boundary.
//! ```

/// Import the real conversion, shared diagnostics and syntax dispatcher.
use super::{LineBudget, RustRuleSettings, rust_rule_settings};
use crate::diagnostic::{Diagnostic, Severity};
use crate::rust_dispatch::check_syntax_rules;
use crate::rust_source::RustSource;
/// Import the repository's exact JSONC parser.
use monochromatic_jsonc_edit::{JsoncValue, parse_jsonc};

/// Convert one owned fixture without replacing configuration validation.
fn settings(source: &str) -> RustRuleSettings {
    let value: JsoncValue = parse_jsonc(source).expect("JSONC fixture");
    return rust_rule_settings(&value).expect("complete valid rule settings");
}

/// Absent and explicitly disabled rules do not initialize or run any check.
#[test]
fn disabled_and_missing_rules_remain_disabled() {
    assert_eq!(settings("{}"), RustRuleSettings::default());
    assert_eq!(
        settings(
            r#"{"rust/require-explicit-types":{"severity":"off"},"rust/no-anonymous-functions":{"severity":"off"},"rust/max-lines":{"severity":"off"}}"#
        ),
        RustRuleSettings::default()
    );
    let source: RustSource = RustSource::new(
        String::from("input.rs"),
        String::from("fn main() { call(|| {}); }"),
    );
    assert!(check_syntax_rules(&source, &RustRuleSettings::default()).is_empty());
}

/// Selected severities and exact line limits reach the actual rules in stable order.
#[test]
fn selected_rules_receive_typed_options() {
    let selected: RustRuleSettings = settings(
        r#"{
        "rust/max-lines":{"severity":"warn","max":0},
        "rust/no-anonymous-functions":{"severity":"error"},
        "rust/require-rustdoc":{"severity":"off"},
        "rust/require-explicit-types":{"severity":"warn"}
    }"#,
    );
    assert_eq!(
        selected.max_lines,
        Some(LineBudget {
            severity: Severity::Warn,
            max: 0
        })
    );
    assert_eq!(selected.explicit_types, Some(Severity::Warn));
    let source: RustSource = RustSource::new(
        String::from("input.rs"),
        String::from("fn main() { call(|| {}); }"),
    );
    let findings: Vec<Diagnostic> = check_syntax_rules(&source, &selected);
    assert_eq!(findings.len(), 2);
    assert_eq!(findings[0].code, "rust/max-lines");
    assert_eq!(findings[0].severity, Severity::Warn);
    assert_eq!(findings[1].code, "rust/no-anonymous-functions");
    assert_eq!(findings[1].severity, Severity::Error);
    assert_eq!(
        settings(r#"{"rust/max-lines":{"severity":"error"}}"#).max_lines,
        Some(LineBudget {
            severity: Severity::Error,
            max: 300
        })
    );
}

/// The documentation selection reaches the actual documentation rule rather than just a settings field.
#[test]
fn selected_documentation_rule_executes() {
    let selected: RustRuleSettings = settings(r#"{"rust/require-rustdoc":{"severity":"error"}}"#);
    let source: RustSource = RustSource::new(String::from("input.rs"), String::new());
    let findings: Vec<Diagnostic> = check_syntax_rules(&source, &selected);
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].code, "rust/require-rustdoc");
}

/// Other valid language rules do not enable Rust rules; invalid input is never silently ignored.
#[test]
fn language_selection_keeps_schema_failures_visible() {
    assert_eq!(
        settings(r#"{"markdown/single-h1":{"severity":"error"}}"#),
        RustRuleSettings::default()
    );
    for source in [
        r#"{"rust/require-explicit-types":{}}"#,
        r#"{"rust/require-rustdoc":{"severity":"warning"}}"#,
        r#"{"rust/no-anonymous-functions":{"severity":"off","max":1}}"#,
        r#"{"unknown/rule":{"severity":"off"}}"#,
        r#"{"rust/max-lines":{"severity":"error","severity":"off"}}"#,
        r#"{"rust/max-lines":{"severity":"error","max":null}}"#,
        "[]",
    ] {
        let value: JsoncValue = parse_jsonc(source).expect("syntactically valid fixture");
        assert!(rust_rule_settings(&value).is_err(), "{source}");
    }
}

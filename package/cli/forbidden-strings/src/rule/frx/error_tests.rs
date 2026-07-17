// Unit tests for the redacted load-error rendering.

use super::LoadError;
use forbidden_regex::CompileError;

#[test]
fn no_rules_renders_fixed_text() {
    assert_eq!(LoadError::NoRules.to_string(), "no rules loaded");
}

#[test]
fn unsupported_flag_names_index_and_flag() {
    let rendered = LoadError::UnsupportedFlag { index: 3, flag: 'i' }.to_string();
    assert!(rendered.contains("rule 3"), "{rendered}");
    assert!(rendered.contains('i'), "{rendered}");
    assert!(rendered.contains("only 'm' and 'x'"), "{rendered}");
}

#[test]
fn compile_renders_index_plus_engine_reason() {
    let reason = CompileError::Syntax {
        pos: 7,
        message: "'*' is unsupported; use {1,n}".to_string(),
    };
    let rendered = LoadError::Compile { index: 2, reason }.to_string();
    assert!(rendered.starts_with("rule 2: "), "{rendered}");
    // The engine's static Display is surfaced verbatim (no pattern text in it).
    assert!(rendered.contains("'*' is unsupported"), "{rendered}");
}

#[test]
fn precompiled_renders_engine_reason() {
    let reason = CompileError::Invalid {
        message: "unexpected end of input".to_string(),
    };
    let rendered = LoadError::Precompiled { reason }.to_string();
    assert!(rendered.contains("precompiled ruleset failed to load"), "{rendered}");
    assert!(rendered.contains("unexpected end of input"), "{rendered}");
}

#[test]
fn debug_is_derived_and_holds_no_free_text_field() {
    // LoadError carries only an index, a flag char, and the engine's CompileError;
    // none is rule text, so the derived Debug is leak-safe by construction.
    let err = LoadError::Compile {
        index: 0,
        reason: CompileError::EmptyMatchable,
    };
    let debugged = format!("{err:?}");
    assert!(debugged.contains("EmptyMatchable"), "{debugged}");
}

//! What:
//!  Positive and negative controls for the Rust anonymous-function ban.
//! Why:
//!  Real closure nodes must be rejected without treating pipes,
//!  strings or named callbacks as closures.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Parse fixtures, run the real rule, and inspect its source ranges and configuration contract.
//! ```

/// What:
///  Import the actual rule,
///  its diagnostic types,
///  and the shared source parser.
/// Why:
///  No test-only checker may replace the production traversal.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { checkNoAnonymousFunctions, Diagnostic, Severity, RustSource } from './implementation';
/// ```
use super::check_no_anonymous_functions;
/// Import the same owned findings returned to the executable.
use crate::diagnostic::{Diagnostic, Severity};
/// Import the retained source context.
use crate::rust_source::RustSource;
/// Import the exact parser interface to validate that positive fixtures contain real Rust syntax.
use ra_ap_syntax::{Edition, Parse, SourceFile};

/// What:
///  Parse a borrowed fixture and return its actual rule findings.
/// Why:
///  Validating syntax prevents a parser recovery artifact from standing in for a closure.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function check(source: string, severity: Severity): Diagnostic[];
/// ```
fn check(source: &str, severity: Severity) -> Vec<Diagnostic> {
    let parsed: Parse<SourceFile> = SourceFile::parse(source, Edition::CURRENT);
    // The parser must accept the fixture before its lint results count as evidence.
    assert!(parsed.errors().is_empty(), "fixture must parse: {source}");
    // What: String::from makes owned copies of borrowed &str text; &context lends a read-only view.
    // Why: RustSource owns input bytes, but checking does not consume the source context.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context: RustSource = new RustSource('fixture.rs', source);
    // return checkNoAnonymousFunctions(context, severity);
    // ```
    let context: RustSource = RustSource::new(String::from("fixture.rs"), String::from(source));
    return check_no_anonymous_functions(&context, severity);
}

/// Reject every supported closure header shape,
///  even when its parameters and result are annotated.
#[test]
fn rejects_bound_and_qualified_closures() {
    for expression in [
        "|| {}",
        "|value| value",
        "|value: u16| -> u16 { return value; }",
        "move || {}",
        "move |value: u16| -> u16 { return value; }",
        "async || {}",
        "async move |value: u16| { return value; }",
        "const || 1",
    ] {
        // What: format! builds owned source with a known grammar-valid expression fixture.
        // Why: The assignment proves that naming the variable does not exempt its anonymous function.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const source: string = `fn main() { let callback = ${expression}; }`;
        // ```
        let source: String = format!("fn main() {{ let callback = {expression}; }}");
        // Borrow the completed fixture as &str without transferring its storage.
        let findings: Vec<Diagnostic> = check(source.as_str(), Severity::Error);
        assert_eq!(findings.len(), 1, "{expression}");
        assert_eq!(findings[0].code, "rust/no-anonymous-functions");
        assert_eq!(findings[0].severity, Severity::Error);
        assert_eq!(findings[0].filename, "fixture.rs");
        assert_eq!(
            findings[0].message,
            "Anonymous function; use a named function or method."
        );
        assert!(findings[0].fix.is_none());
        // What: as_deref borrows the optional owned String as an optional &str; expect unwraps it.
        // Why: Missing remediation text is a failed contract, not an empty-string fallback.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // assert(findings[0].help?.includes('captures surrounding values'));
        // ```
        assert!(
            findings[0]
                .help
                .as_deref()
                .expect("capture guidance")
                .contains("captures surrounding values")
        );
    }
}

/// Nested closure bodies produce separate findings in source order;
///  direct callback arguments are included.
#[test]
fn rejects_nested_and_direct_callback_closures() {
    let findings: Vec<Diagnostic> = check("fn main() { invoke(|| || 1); }", Severity::Warn);
    assert_eq!(findings.len(), 2);
    assert_eq!(findings[0].severity, Severity::Warn);
    assert_eq!(findings[1].severity, Severity::Warn);
    assert!(findings[0].labels[0].span.offset < findings[1].labels[0].span.offset);
}

/// Names,
///  function pointers,
///  async blocks and ordinary pipe operators are not anonymous functions.
#[test]
fn accepts_named_callbacks_and_non_function_syntax() {
    let source: &str = r#"
fn named(value: u16) -> u16 { return value; }
struct User;
impl User { fn name(&self) -> String { return String::new(); } }
fn main() {
    fn nested(value: u16) -> u16 { return value; }
    let pointer: fn(u16) -> u16 = named;
    let bits: u16 = 1 | 2;
    let condition: bool = true || false;
    let future = async { return 1; };
    let text: &str = "move || { anonymous-looking text }";
    let pipe: char = '|';
    // Anonymous-looking comment: |value| value
    call(named);
    call(nested);
    call(User::name);
    call(pointer);
}
"#;
    assert!(check(source, Severity::Error).is_empty());
    assert!(check("", Severity::Error).is_empty());
}

/// The underline uses original UTF-8 bytes and ends at the first line of a multiline closure.
#[test]
fn preserves_byte_offsets_and_first_line_underlines() {
    let source: &str =
        "fn main() {\n    /* 🚀 */ let callback = move || {\n        return 1;\n    };\n}\n";
    let findings: Vec<Diagnostic> = check(source, Severity::Error);
    assert_eq!(findings.len(), 1);
    // What: find returns Option<usize>; expect extracts the guaranteed fixture marker's byte index.
    // Why: Byte indexing must not accidentally count the astral character as one byte.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const offset: number = utf8PrefixLength(source, 'move ||');
    // ```
    let offset: usize = source.find("move ||").expect("closure marker");
    assert_eq!(findings[0].labels[0].span.offset, offset);
    assert_eq!(findings[0].labels[0].span.line, 2);
    assert_eq!(
        findings[0].labels[0].span.column,
        "    /* 🚀 */ let callback = ".len() + 1
    );
    assert_eq!(findings[0].labels[0].span.length, "move || {".len());
}

/// The registry accepts only severity settings for this rule,
///  including an explicit disabled state.
#[test]
fn registers_severities_without_unrequested_options() {
    for severity in ["off", "warn", "error"] {
        // Interpolate only closed-enumeration fixture values into the JSONC schema sample.
        let source: String = format!(
            r#"[{{"files":["**/*.rs"],"rules":{{"rust/no-anonymous-functions":{{"severity":"{severity}"}}}}}}]"#
        );
        // Borrow the fixture for the real parser rather than duplicating registry validation.
        assert!(crate::configuration::parse_configuration(source.as_str()).is_ok());
    }
    for option in ["max", "exclude", "allowMove", "allowAsync"] {
        let source: String = format!(
            r#"[{{"files":["**/*.rs"],"rules":{{"rust/no-anonymous-functions":{{"severity":"off","{option}":1}}}}}}]"#
        );
        assert!(crate::configuration::parse_configuration(source.as_str()).is_err());
    }
}

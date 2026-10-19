//! What:
//!  Controls of the closure step against a stub `cargo`.
//! Why:
//!  The step is where skip,
//! failure and findings are decided,
//! so each outcome is driven end to end with canned cargo
//!  answers:
//! no compiler,
//! nightly or network is involved.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! test('a cold cache skips', () => expect(runClosureStepWith(plans, cwd, false, stub.cargo).messages).toEqual([...]));
//! ```

use super::{ClosureOutcome, run_closure_step_with, with_messages};
use crate::{
    closure_manifest::PREREQUISITES_FILE,
    closure_stub_support::{Scenario, scenario},
    diagnostic::Severity,
    run_plan::FilePlan,
    run_test_support::{CONFIG, plan, write},
    test_fs::Fixture,
};

/// The rule at warning level,
/// with the library next to the configuration.
const CONFIGURATION: &str = r#"[
  { "files": ["**/*.rs"], "rules": { "rust/avoidable-closure": { "severity": "warn", "library": "lib" } } }
]"#;

/// The source of the checked file,
/// with a closure starting at byte 23.
const SOURCE: &str = "fn a() -> bool {\n  run(|x| x)\n}\n";

/// One cargo record for `src/lib.rs`.
fn record(code: &str, start: u64) -> String {
    return format!(
        r#"{{"reason": "compiler-message", "message": {{"code": {{"code": "{code}", "explanation": null}}, "level": "warning", "message": "a closure", "spans": [{{"file_name": "src/lib.rs", "is_primary": true, "byte_start": {start}, "byte_end": {end}, "line_start": 2, "column_start": 7}}], "children": []}}}}"#,
        end = start + 7
    );
}

/// A fixture with the library,
/// a package whose directory has a space,
/// and the configuration.
fn fixture() -> Fixture {
    let fixture: Fixture = Fixture::new();
    write(&fixture.path, CONFIG, CONFIGURATION);
    write(&fixture.path, "lib/Cargo.toml", "[package]\n");
    write(&fixture.path, "my pkg/Cargo.toml", "[package]\n");
    write(&fixture.path, "my pkg/src/lib.rs", SOURCE);
    return fixture;
}

/// Plan the package's file.
fn plans(fixture: &Fixture) -> Vec<FilePlan> {
    return vec![plan(&fixture.path, "my pkg/src/lib.rs")];
}

/// Run the step with a scenario.
fn run(fixture: &Fixture, stub: &Scenario) -> ClosureOutcome {
    return run_closure_step_with(plans(fixture).as_slice(), &fixture.path, false, &stub.cargo);
}

/// The kinds of cargo call the stub saw,
/// in order.
fn kinds(stub: &Scenario) -> Vec<String> {
    let mut found: Vec<String> = Vec::<String>::new();
    for call in stub.calls() {
        found.push(String::from(call.split('|').next().unwrap_or("")));
    }
    return found;
}

/// A clean run produces no finding,
/// one note and the three calls in order.
#[test]
fn a_clean_package_is_checked_in_order() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[]);
    let outcome = run(&fixture, &stub);
    assert!(outcome.findings.is_empty() && outcome.messages.is_empty());
    assert_eq!(kinds(&stub), vec!["dylint-version", "metadata", "dylint"]);
    assert!(
        outcome
            .notes
            .iter()
            .any(|note| return note.contains("checked my pkg")),
        "{:?}",
        outcome.notes
    );
}

/// A report becomes a finding at the byte position of the file,
/// with the configured severity.
#[test]
fn a_report_becomes_a_finding() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[(
        "dylint.stdout",
        format!("{}\n", record("avoidable_closure", 23)).as_str(),
    )]);
    let outcome = run(&fixture, &stub);
    assert_eq!(outcome.findings.len(), 1);
    let finding = &outcome.findings[0];
    assert_eq!(
        (finding.code.as_str(), finding.severity),
        ("rust/avoidable-closure", Severity::Warn)
    );
    assert_eq!(finding.filename, "my pkg/src/lib.rs");
    assert_eq!(
        (finding.labels[0].span.line, finding.labels[0].span.column),
        (2, 7)
    );
}

/// An expectation that suppressed nothing is reported like a closure.
#[test]
fn an_unfulfilled_expectation_is_reported() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[(
        "dylint.stdout",
        format!("{}\n", record("unfulfilled_lint_expectations", 23)).as_str(),
    )]);
    assert_eq!(run(&fixture, &stub).findings.len(), 1);
}

/// A cold cache skips with a message on the standard-error channel and runs nothing else.
#[test]
fn a_cold_cache_skips_with_a_message() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[
        ("metadata.status", "101"),
        ("metadata.stderr", "error: no matching package\n"),
    ]);
    let outcome = run(&fixture, &stub);
    assert!(outcome.findings.is_empty());
    assert_eq!(outcome.messages.len(), 1);
    assert!(
        outcome.messages[0].starts_with("rust/avoidable-closure skipped my pkg:"),
        "{:?}",
        outcome.messages
    );
    assert!(outcome.messages[0].contains("cargo fetch --locked"));
    assert_eq!(kinds(&stub), vec!["dylint-version", "metadata"]);
}

/// A missing prerequisite skips with the reason and never runs dylint.
#[test]
fn a_missing_prerequisite_skips() {
    let fixture: Fixture = fixture();
    write(
        &fixture.path,
        format!("my pkg/{PREREQUISITES_FILE}").as_str(),
        r#"{"executables": ["monochromatic-lint-absent-program"]}"#,
    );
    let stub = scenario(&[]);
    let outcome = run(&fixture, &stub);
    assert!(outcome.findings.is_empty());
    assert!(
        outcome.messages[0].contains("monochromatic-lint-absent-program"),
        "{:?}",
        outcome.messages
    );
    assert!(!kinds(&stub).contains(&String::from("dylint")));
}

/// An unknown prerequisite fails the run,
/// names the manifest and runs nothing.
#[test]
fn an_unknown_prerequisite_is_a_processing_failure() {
    let fixture: Fixture = fixture();
    write(
        &fixture.path,
        format!("my pkg/{PREREQUISITES_FILE}").as_str(),
        r#"{"shell": ["touch x"]}"#,
    );
    let stub = scenario(&[]);
    let outcome = run(&fixture, &stub);
    assert_eq!(outcome.findings.len(), 1);
    assert!(outcome.findings[0].processing_failure);
    assert_eq!(outcome.findings[0].filename, "my pkg/Cargo.toml");
    assert!(
        outcome.findings[0].message.contains("\"shell\""),
        "{}",
        outcome.findings[0].message
    );
    assert_eq!(kinds(&stub), vec!["dylint-version"]);
}

/// A library path without a Cargo.toml fails once and runs nothing.
#[test]
fn a_missing_library_is_a_processing_failure_and_runs_nothing() {
    let fixture: Fixture = fixture();
    std::fs::remove_file(fixture.path.join("lib/Cargo.toml")).expect("remove library manifest");
    let stub = scenario(&[]);
    let outcome = run(&fixture, &stub);
    assert_eq!(outcome.findings.len(), 1);
    assert!(outcome.findings[0].processing_failure);
    assert_eq!(outcome.findings[0].filename, CONFIG);
    assert!(
        outcome.findings[0].message.contains("holds no Cargo.toml"),
        "{}",
        outcome.findings[0].message
    );
    assert!(stub.calls().is_empty());
}

/// A run that exits nonzero without a record is a processing failure quoting cargo's last messages.
#[test]
fn a_non_diagnostic_failure_is_a_processing_failure() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[
        ("dylint.status", "101"),
        (
            "dylint.stderr",
            "line one\nerror: could not find `cargo-dylint`\n",
        ),
    ]);
    let outcome = run(&fixture, &stub);
    assert_eq!(outcome.findings.len(), 1);
    let failure = &outcome.findings[0];
    assert!(failure.processing_failure && failure.severity == Severity::Error);
    assert_eq!(failure.filename, "my pkg/Cargo.toml");
    assert!(
        failure.message.contains("could not find `cargo-dylint`"),
        "{}",
        failure.message
    );
    assert!(
        failure.message.contains("incomplete"),
        "{}",
        failure.message
    );
}

/// A compiler error is quoted,
/// and the findings of the same run are kept beside the failure.
#[test]
fn a_compiler_error_is_quoted_and_findings_are_kept() {
    let fixture: Fixture = fixture();
    let error: &str = r#"{"reason": "compiler-message", "message": {"code": {"code": "E0425"}, "level": "error", "message": "cannot find value", "rendered": "error[E0425]: cannot find value `q`\n", "spans": [], "children": []}}"#;
    let stdout: String = format!("{}\n{error}\n", record("avoidable_closure", 23));
    let stub = scenario(&[("dylint.status", "101"), ("dylint.stdout", stdout.as_str())]);
    let outcome = run(&fixture, &stub);
    assert_eq!(outcome.findings.len(), 2);
    assert!(!outcome.findings[0].processing_failure);
    assert!(
        outcome.findings[1]
            .message
            .contains("cannot find value `q`"),
        "{}",
        outcome.findings[1].message
    );
}

/// A missing `cargo` skips every package once,
/// with one message.
#[test]
fn a_missing_cargo_skips_everything_with_one_message() {
    let fixture: Fixture = fixture();
    let outcome = run_closure_step_with(
        plans(&fixture).as_slice(),
        &fixture.path,
        false,
        std::path::Path::new("/nonexistent/monochromatic-lint/cargo"),
    );
    assert!(outcome.findings.is_empty());
    assert_eq!(outcome.messages.len(), 1);
    assert!(
        outcome.messages[0].contains("all 1 package(s)"),
        "{:?}",
        outcome.messages
    );
}

/// A failing `cargo dylint --version` skips everything and runs no package.
#[test]
fn a_missing_dylint_skips_everything() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[("dylint-version.status", "101")]);
    let outcome = run(&fixture, &stub);
    assert!(
        outcome.messages[0].contains("cargo dylint --version"),
        "{:?}",
        outcome.messages
    );
    assert_eq!(kinds(&stub), vec!["dylint-version"]);
}

/// `--fix` runs nothing.
#[test]
fn fix_mode_runs_nothing() {
    let fixture: Fixture = fixture();
    let stub = scenario(&[]);
    let outcome =
        run_closure_step_with(plans(&fixture).as_slice(), &fixture.path, true, &stub.cargo);
    assert!(outcome.findings.is_empty() && outcome.messages.is_empty());
    assert!(outcome.notes[0].contains("--fix"));
    assert!(stub.calls().is_empty());
}

/// No selected package runs nothing,
/// not even the tool probe.
#[test]
fn no_package_runs_nothing() {
    let fixture: Fixture = Fixture::new();
    write(&fixture.path, CONFIG, CONFIGURATION);
    write(&fixture.path, "loose/script.rs", "");
    let stub = scenario(&[]);
    let selected = vec![plan(&fixture.path, "loose/script.rs")];
    let outcome = run_closure_step_with(selected.as_slice(), &fixture.path, false, &stub.cargo);
    assert!(outcome.findings.is_empty() && outcome.messages.is_empty());
    assert!(stub.calls().is_empty());
}

/// Two packages are checked independently:
/// a skip in one does not hide a finding in the other.
#[test]
fn packages_are_independent() {
    let fixture: Fixture = fixture();
    write(&fixture.path, "cold/Cargo.toml", "[package]\n");
    write(&fixture.path, "cold/src/lib.rs", SOURCE);
    let stub = scenario(&[
        ("metadata.cold.status", "101"),
        (
            "dylint.stdout",
            format!("{}\n", record("avoidable_closure", 23)).as_str(),
        ),
    ]);
    let selected = vec![
        plan(&fixture.path, "cold/src/lib.rs"),
        plan(&fixture.path, "my pkg/src/lib.rs"),
    ];
    let outcome = run_closure_step_with(selected.as_slice(), &fixture.path, false, &stub.cargo);
    assert_eq!(outcome.messages.len(), 1);
    assert!(
        outcome.messages[0].contains("cold"),
        "{:?}",
        outcome.messages
    );
    assert_eq!(outcome.findings.len(), 1);
    assert_eq!(outcome.findings[0].filename, "my pkg/src/lib.rs");
}

/// Messages are prefixed with the program name and put before the existing standard error.
#[test]
fn messages_are_prefixed_and_come_first() {
    let text: String = with_messages(
        "debug line\n",
        &[String::from("one"), String::from("two")],
        "monochromatic-lint",
    );
    assert_eq!(
        text,
        "monochromatic-lint: one\nmonochromatic-lint: two\ndebug line\n"
    );
    assert_eq!(with_messages("", &[], "p"), "");
}

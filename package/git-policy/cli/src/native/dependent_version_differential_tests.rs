//! What: The native planner against the incumbent's recorded results, on the shared
//!       fixtures of every incumbent unit-test scenario, and on a corpus the driver
//!       `bin/dependent-version-differential.mjs` writes.
//! Why: The release workflow will call the native wrapper instead of the TypeScript task,
//!      and the TypeScript planner will be deleted; before that, both must produce the same
//!      plan for the same input. The fixtures' `expected` values were written by the
//!      incumbent through the driver, which also checks them against the unit tests'
//!      own assertions.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // for (const c of cases) expect(native(c)).toBe(JSON.stringify(c.expected));
//! ```

/// The case evaluator, the fixture reader and the parser.
use crate::dependent_version_fixture_cases::{evaluate, load_files};
use crate::dependent_version_fixture_json::{canonical, elements, field, text};
use crate::dependent_version_test_support::MemoryWorkspace;
use monochromatic_jsonc_edit::{JsoncValue, parse_jsonc};
use std::collections::HashMap;

/// The shared fixtures: every scenario of the incumbent's unit tests, with its result.
const UNIT_CASES: &str = include_str!("dependent_version_fixtures/unit_cases.json");

/// A shared workspace that no committed case names.
fn no_shared_workspace(name: &str) -> MemoryWorkspace {
    panic!("committed cases name no shared workspace, got {name}");
}

/// Every committed case yields the incumbent's recorded result.
#[test]
fn unit_fixtures_match_the_incumbent() {
    let cases: JsoncValue = parse_jsonc(UNIT_CASES).unwrap_or_else(|error| panic!("{error:?}"));
    let mut mismatches: Vec<String> = Vec::new();
    for case in elements(&cases) {
        let actual: String = evaluate(case, &mut no_shared_workspace);
        let expected: String = canonical(field(case, "expected"));
        if actual != expected {
            mismatches.push(format!(
                "{}\n  native:    {actual}\n  incumbent: {expected}",
                text(field(case, "name"))
            ));
        }
    }
    assert!(mismatches.is_empty(), "{}", mismatches.join("\n"));
    // A fixture file that lost its cases would pass vacuously.
    assert!(
        elements(&cases).len() >= 60,
        "only {} cases",
        elements(&cases).len()
    );
}

/// Read a shared workspace file of the corpus.
fn shared_workspace(path: &std::path::Path) -> MemoryWorkspace {
    let source: String =
        std::fs::read_to_string(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    let parsed: JsoncValue = parse_jsonc(&source).unwrap_or_else(|error| panic!("{error:?}"));
    let mut memory: MemoryWorkspace = MemoryWorkspace::default();
    load_files(elements(&parsed), &mut memory);
    return memory;
}

/// Evaluate the driver's corpus in `DEPENDENT_VERSION_CORPUS` and write one result per case.
/// Run by the driver with `--include-ignored`; it has no fixture of its own.
#[test]
#[ignore = "run by bin/dependent-version-differential.mjs with a corpus directory"]
fn corpus_from_environment() {
    let directory: std::path::PathBuf = std::env::var_os("DEPENDENT_VERSION_CORPUS")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| panic!("DEPENDENT_VERSION_CORPUS names the corpus directory"));
    let cases: String = std::fs::read_to_string(directory.join("cases.jsonl"))
        .unwrap_or_else(|error| panic!("{error}"));
    let mut loaded: HashMap<String, MemoryWorkspace> = HashMap::new();
    let mut results: Vec<String> = Vec::new();
    for line in cases.lines() {
        let case: JsoncValue = parse_jsonc(line).unwrap_or_else(|error| panic!("{error:?}"));
        let mut shared = |name: &str| {
            return loaded
                .entry(String::from(name))
                .or_insert_with(|| return shared_workspace(&directory.join(name)))
                .clone();
        };
        results.push(evaluate(&case, &mut shared));
    }
    std::fs::write(
        directory.join("rust-results.jsonl"),
        format!("{}\n", results.join("\n")),
    )
    .unwrap_or_else(|error| panic!("{error}"));
}

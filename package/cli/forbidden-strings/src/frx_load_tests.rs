// Precedence and rule-id offset tests for the frx loader.

use super::load;
use crate::frx_scan::scan_file;

// Creates a fresh temp dir under the OS temp root, keyed by label and pid.
fn temp_dir(label: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("frx-load-{}-{}", label, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    return dir
}

// Writes a rules file into a temp dir and returns its path (dir leaks per-test).
fn rules_file(label: &str, body: &str) -> std::path::PathBuf {
    let dir = temp_dir(label);
    let path = dir.join("rules.txt");
    std::fs::write(&path, body).expect("write rules");
    return path
}

// Serializes a compiled set into precompiled bytes for the builtin-baseline slot.
fn precompiled(body: &str) -> Vec<u8> {
    return crate::compile_from_text(body)
        .expect("compile precompiled fixture")
        .to_bytes()
        .expect("serialize precompiled fixture")
}

#[test]
fn runtime_only_ids_start_at_zero() {
    let path = rules_file("runtime-only", "AAA_USER_ONE_LONG\n");
    let loaded = load(path.to_str().expect("utf8"), false, true, b"").expect("load");
    let hits = scan_file("t.txt", b"AAA_USER_ONE_LONG\n", &loaded);
    assert_eq!(hits, vec!["t.txt:1 rule=0".to_string()]);
}

#[test]
fn builtin_ids_offset_past_runtime_rules() {
    // Two runtime rules take ids 0 and 1; the builtin's single rule takes id 2.
    let path = rules_file("offset", "AAA_USER_ONE_LONG\nBBB_USER_TWO_LONG\n");
    let bytes = precompiled("BUILTIN_MARKER_LONG_ENOUGH\n");
    let loaded = load(path.to_str().expect("utf8"), true, true, &bytes).expect("load");
    let buf = b"AAA_USER_ONE_LONG\nBBB_USER_TWO_LONG\nBUILTIN_MARKER_LONG_ENOUGH\n";
    let hits = scan_file("t.txt", buf, &loaded);
    assert_eq!(
        hits,
        vec![
            "t.txt:1 rule=0".to_string(),
            "t.txt:2 rule=1".to_string(),
            "t.txt:3 rule=2".to_string(),
        ],
    );
}

#[test]
fn missing_default_with_builtin_scans_baseline_alone() {
    // A missing implicit default under --builtin-rules leaves the baseline alone at
    // offset 0.
    let dir = temp_dir("baseline-alone");
    let missing = dir.join("nope.txt");
    let bytes = precompiled("BUILTIN_MARKER_LONG_ENOUGH\n");
    let loaded = load(missing.to_str().expect("utf8"), true, false, &bytes).expect("load");
    let hits = scan_file("t.txt", b"BUILTIN_MARKER_LONG_ENOUGH\n", &loaded);
    assert_eq!(hits, vec!["t.txt:1 rule=0".to_string()]);
}

#[test]
fn explicit_missing_file_errors_with_read_rules() {
    let dir = temp_dir("explicit-missing");
    let missing = dir.join("nope.txt");
    let bytes = precompiled("BUILTIN_MARKER_LONG_ENOUGH\n");
    let error = load(missing.to_str().expect("utf8"), true, true, &bytes)
        .err()
        .expect("must error");
    assert!(format!("{error}").contains("read rules"), "{error}");
}

#[test]
fn missing_default_without_builtin_errors_with_read_rules() {
    let dir = temp_dir("no-builtin-missing");
    let missing = dir.join("nope.txt");
    let error = load(missing.to_str().expect("utf8"), false, false, b"")
        .err()
        .expect("must error");
    assert!(format!("{error}").contains("read rules"), "{error}");
}

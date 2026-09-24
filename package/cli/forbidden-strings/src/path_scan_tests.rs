//! Component-level matching, redaction, and path selection tests.

/// Imports production name scanner and logical-path selection.
use super::{logical_path, scan_path};

/// Loads authoritative runtime rules through the same loader as the CLI.
fn load_rules(text: &str) -> crate::frx_load::LoadedRules {
    let dir = std::env::temp_dir().join(format!("name-scan-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("create rule fixture");
    let rules = dir.join("rules.txt");
    std::fs::write(&rules, text).expect("write rule fixture");
    let loaded = crate::frx_load::load(rules.to_str().expect("utf8 rule path"), false, true, b"", "")
        .expect("load rule fixture");
    std::fs::remove_dir_all(dir).expect("remove rule fixture");
    return loaded;
}

/// Finds each component independently without exposing the offending spelling.
#[test]
fn matching_directory_and_filename_mask_every_printed_occurrence() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("VAULTTOKEN_LONG/VAULTTOKEN_LONG.txt", &loaded);
    assert_eq!(hit.display, "[REDACTED]/[REDACTED]");
    assert_eq!(hit.findings, vec![
        "[REDACTED]/[REDACTED]:name:1 rule=0",
        "[REDACTED]/[REDACTED]:name:2 rule=0",
    ]);
}

/// A rule containing a slash cannot consume bytes from adjacent components.
#[test]
fn slash_boundary_does_not_match() {
    let loaded = load_rules("/ALPHA_LONG.BETA_LONG/\n");
    let hit = scan_path("ALPHA_LONG/BETA_LONG", &loaded);
    assert_eq!(hit.display, "ALPHA_LONG/BETA_LONG");
    assert!(hit.findings.is_empty());
}

/// A clean pathname stays visible and contributes no name findings.
#[test]
fn clean_names_remain_readable() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("./src/clean.ts", &loaded);
    assert_eq!(hit.display, "./src/clean.ts");
    assert!(hit.findings.is_empty());
}

/// Duplicate matches in one component yield one finding per rule and segment.
#[test]
fn repeated_name_match_is_deduplicated() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("VAULTTOKEN_LONG_VAULTTOKEN_LONG.ts", &loaded);
    assert_eq!(hit.findings, vec!["[REDACTED]:name:1 rule=0"]);
}

/// Embedded newlines cannot inject a finding or connect separate engine lines.
#[test]
fn newline_in_clean_name_is_escaped() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("src/a\nfile.ts", &loaded);
    assert_eq!(hit.display, "src/a\\nfile.ts");
    assert!(hit.findings.is_empty());
}

/// Navigation markers do not count as directory names in locator positions.
#[test]
fn navigation_markers_are_not_segments() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("../VAULTTOKEN_LONG/a.txt", &loaded);
    assert_eq!(hit.display, "../[REDACTED]/a.txt");
    assert_eq!(hit.findings, vec!["../[REDACTED]/a.txt:name:1 rule=0"]);
}

/// A repo-local absolute positional file is named by its repository-relative path.
#[test]
fn absolute_path_under_root_uses_relative_name() {
    let dir = std::env::temp_dir().join(format!("name-root-{}", std::process::id()));
    std::fs::create_dir_all(dir.join("nested")).expect("create path fixture");
    let file = dir.join("nested/test.txt");
    std::fs::write(&file, "clean").expect("write path fixture");
    let root = std::fs::canonicalize(&dir).expect("canonical root");
    assert_eq!(logical_path(file.to_str().expect("utf8 path"), Some(&root)), "nested/test.txt");
    std::fs::remove_dir_all(&dir).expect("remove path fixture");
}

/// External and standalone positional names retain every supplied segment.
#[test]
fn external_name_keeps_supplied_segments() {
    assert_eq!(logical_path("/external/private/file.txt", None), "/external/private/file.txt");
}

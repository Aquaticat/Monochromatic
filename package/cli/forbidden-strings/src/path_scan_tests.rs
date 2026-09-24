//! Component-level matching, redaction, and path selection tests.

/// Imports production name scanner and logical-path selection.
use super::{logical_path, scan_path};

/// Compiles runtime rules in memory without touching any user-owned cache.
fn load_rules(text: &str) -> crate::frx_load::LoadedRules {
    return crate::frx_load::test_rules(text);
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

/// Embedded line breaks fail closed rather than altering anchored rule semantics.
#[test]
fn line_break_in_name_is_rejected_without_leaking_it() {
    let loaded = load_rules("/^VAULTTOKEN_LONG$/\n");
    for name in ["src/VAULTTOKEN_LONG\nfile.ts", "src/VAULTTOKEN_LONG\r"] {
        let hit = scan_path(name, &loaded);
        assert_eq!(hit.display, "[REDACTED]");
        assert_eq!(hit.findings, vec!["[REDACTED]: unsupported pathname line break"]);
    }
}

/// A literal locator-like suffix in a filename cannot impersonate a name finding.
#[test]
fn colons_in_visible_path_are_encoded() {
    let loaded = load_rules("VAULTTOKEN_LONG\n");
    let hit = scan_path("[REDACTED]:name/VAULTTOKEN_LONG", &loaded);
    assert_eq!(hit.display, "[REDACTED]\\x3aname/[REDACTED]");
    assert_eq!(hit.findings, vec!["[REDACTED]\\x3aname/[REDACTED]:name:2 rule=0"]);
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

/// A symlink is named by its own entry, not the clean target it points at.
#[test]
#[cfg(unix)]
fn symlink_name_is_not_replaced_by_target() {
    let dir = std::env::temp_dir().join(format!("name-link-{}", std::process::id()));
    std::fs::create_dir_all(dir.join(".git")).expect("create repository marker");
    std::fs::write(dir.join("clean.txt"), "clean").expect("create link target");
    let link = dir.join("VAULTTOKEN_LONG");
    std::os::unix::fs::symlink(dir.join("clean.txt"), &link).expect("create symlink");
    let root = std::fs::canonicalize(&dir).expect("canonical root");
    assert_eq!(logical_path(link.to_str().expect("utf8 link"), Some(&root)), "VAULTTOKEN_LONG");
    std::fs::remove_dir_all(dir).expect("remove link fixture");
}

/// External and standalone positional names retain every supplied segment.
#[test]
fn external_name_keeps_supplied_segments() {
    assert_eq!(logical_path("/external/private/file.txt", None), "/external/private/file.txt");
}

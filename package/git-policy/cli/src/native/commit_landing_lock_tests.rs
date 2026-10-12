//! Controls for the landing lock helpers.

use super::*;
use crate::test_support::{fixture, remove};
use crate::transaction_journal::RefFormat;

/// A layout whose registry lives under `root`.
fn layout(root: &Path) -> InvocationLayout {
    return InvocationLayout {
        symbolic_head: crate::transaction_journal::SymbolicHead::Branch(String::from("refs/heads/main")),
        target_ref: String::from("refs/heads/main"),
        conclusion: crate::transaction_journal::Conclusion::None,
        repository_root: root.to_path_buf(),
        git_dir: root.join(".git"),
        common_dir: root.join(".git"),
        real_index_path: root.join(".git/index"),
        object_directory: root.join(".git/objects"),
        registry_root: root.join(".git/cli-git-transactions"),
        ref_format: RefFormat::Files,
        object_format: String::from("sha1"),
        empty_tree_oid: "4".repeat(40),
        invoked_at: String::from("2026-10-11T00:00:00.000Z"),
    };
}

/// The lock lives in the registry under its fixed name.
#[test]
fn the_lock_directory_is_in_the_registry() {
    assert_eq!(
        landing_lock_directory(&layout(Path::new("/r"))),
        PathBuf::from("/r/.git/cli-git-transactions/landing.lock")
    );
}

/// With no lease the landing is not nested; a lease naming a lock nobody holds does not make it nested either.
#[test]
fn only_a_valid_lease_makes_a_landing_nested() {
    let root: PathBuf = fixture("landing-lock-nested");
    let layout: InvocationLayout = layout(root.as_path());
    assert!(!landing_is_nested(&layout, &[]));
    let lease: String = format!(
        "{{\"lockDirectory\":\"{}\",\"token\":\"t\"}}",
        landing_lock_directory(&layout).display()
    );
    assert!(!landing_is_nested(
        &layout,
        &[(OsString::from("CLI_GIT_LANDING_LEASE"), OsString::from(lease))]
    ));
    remove(root.as_path());
}

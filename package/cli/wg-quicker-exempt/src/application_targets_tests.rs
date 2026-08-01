//! Verifies exact Ghostty names and Helium process-to-cgroup discovery.

/// Discovery functions and injectable roots.
use crate::application_targets::{
    is_ghostty_cgroup_name,
    is_helium_service_name,
    scan_application_targets,
    ScanRoots,
};
/// Standard fixture errors.
use std::io;
/// Unix executable symlink fixture.
use std::os::unix::fs::symlink;
/// Fixture paths.
use std::path::Path;

/// Accepts Ghostty service and surface names without broad unrelated matches.
#[test]
fn ghostty_names_cover_service_and_surface() {
    assert!(is_ghostty_cgroup_name(
        "app-com.mitchellh.ghostty@abc.service"
    ));
    assert!(is_ghostty_cgroup_name(
        "app-ghostty-surface-transient-123.scope"
    ));
    assert!(!is_ghostty_cgroup_name("app-ghostty-other.scope"));
    assert!(!is_ghostty_cgroup_name(
        "app-com.mitchellh.ghostty@abc.scope"
    ));
}

/// Accepts observed Helium Chrome application ID service only.
#[test]
fn helium_service_name_uses_exact_application_id() {
    assert!(is_helium_service_name(
        "app-chrome\\x2dcadlkienfkclaiaibeoongdcgmdikeeg\\x2dDefault@abc.service"
    ));
    assert!(!is_helium_service_name(
        "app-chrome\\x2dother\\x2dDefault@abc.service"
    ));
}

/// Creates one fake proc process with executable target and unified cgroup path.
fn create_process(
    proc_root: &Path,
    pid: &str,
    executable: &str,
    cgroup: &str,
) -> io::Result<()> {
    let process = proc_root.join(pid);
    std::fs::create_dir(&process)?;
    symlink(executable, process.join("exe"))?;
    return std::fs::write(process.join("cgroup"), cgroup);
}

/// Finds named Ghostty groups, exact Helium service, and all Helium executable groups.
#[test]
fn scan_combines_named_and_process_targets() -> io::Result<()> {
    let scratch = std::env::temp_dir().join(format!(
        "wg-quicker-application-targets-{}",
        std::process::id()
    ));
    let cgroup_root = scratch.join("cgroup");
    let app_slice = cgroup_root.join("users/app.slice");
    let proc_root = scratch.join("proc");
    std::fs::create_dir_all(&app_slice)?;
    std::fs::create_dir(&proc_root)?;
    let ghostty_service = app_slice.join("app-com.mitchellh.ghostty@abc.service");
    let ghostty_surface = app_slice.join("app-ghostty-surface-transient-123.scope");
    let helium_service = app_slice.join(
        "app-chrome\\x2dcadlkienfkclaiaibeoongdcgmdikeeg\\x2dDefault@abc.service",
    );
    let helium_scope = app_slice.join("app-org.chromium.Chromium-42.scope");
    let unrelated = app_slice.join("app-org.example.Other.scope");
    for path in [
        &ghostty_service,
        &ghostty_surface,
        &helium_service,
        &helium_scope,
        &unrelated,
    ] {
        std::fs::create_dir(path)?;
    }
    create_process(
        &proc_root,
        "42",
        "/tmp/.mount_helium/opt/helium/helium",
        "1:net_cls:/\n0::/users/app.slice/app-org.chromium.Chromium-42.scope\n",
    )?;
    create_process(
        &proc_root,
        "43",
        "/usr/bin/firefox",
        "0::/users/app.slice/app-org.example.Other.scope\n",
    )?;
    let targets = scan_application_targets(&ScanRoots {
        app_slice: &app_slice,
        proc_root: &proc_root,
        cgroup_root: &cgroup_root,
    })?;
    let mut expected = vec![
        ghostty_service,
        ghostty_surface,
        helium_service,
        helium_scope,
    ];
    expected.sort();
    assert_eq!(targets, expected);
    std::fs::remove_dir_all(&scratch)?;
    return Ok(());
}

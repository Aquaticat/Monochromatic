//! Verifies exact Ghostty and Steam names plus Helium and Pale Moon process-to-cgroup discovery.

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

/// Finds named Ghostty and Steam groups plus Helium and Pale Moon executable groups.
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
    let steam_service = app_slice.join("app-steam@abc.service");
    let steam_scope = app_slice.join("app-steam@abc.scope");
    let steam_helper = app_slice.join("app-steam-helper.service");
    let helium_service = app_slice.join(
        "app-chrome\\x2dcadlkienfkclaiaibeoongdcgmdikeeg\\x2dDefault@abc.service",
    );
    let helium_scope = app_slice.join("app-org.chromium.Chromium-42.scope");
    let pale_moon_scope = app_slice.join("app-palemoon-44.scope");
    let pale_moon_bin_scope = app_slice.join("app-palemoon-bin-45.scope");
    let unrelated = app_slice.join("app-org.example.Other.scope");
    for path in [
        &ghostty_service,
        &ghostty_surface,
        &steam_service,
        &steam_scope,
        &steam_helper,
        &helium_service,
        &helium_scope,
        &pale_moon_scope,
        &pale_moon_bin_scope,
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
    // Both installed Pale Moon executable names must map to their current cgroups.
    create_process(
        &proc_root,
        "44",
        "/home/user/.local/opt/palemoon/palemoon",
        "0::/users/app.slice/app-palemoon-44.scope\n",
    )?;
    // `palemoon-bin` is byte-identical in current installation but remains valid launch name.
    create_process(
        &proc_root,
        "45",
        "/home/user/.local/opt/palemoon/palemoon-bin",
        "0::/users/app.slice/app-palemoon-bin-45.scope\n",
    )?;
    let targets = scan_application_targets(&ScanRoots {
        app_slice: &app_slice,
        proc_root: &proc_root,
        cgroup_root: &cgroup_root,
    })?;
    let mut expected = vec![
        ghostty_service,
        ghostty_surface,
        steam_service,
        helium_service,
        helium_scope,
        pale_moon_scope,
        pale_moon_bin_scope,
    ];
    expected.sort();
    assert_eq!(targets, expected);
    std::fs::remove_dir_all(&scratch)?;
    return Ok(());
}

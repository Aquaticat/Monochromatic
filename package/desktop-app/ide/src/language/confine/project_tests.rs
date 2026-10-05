//! Project mounts: the canonical root always, other spellings only where the sandbox replaced the
//! directory, all with one mount option, and all after the replacements.

use super::{PROJECT_MOUNT, project_binds, replaced_location};
use crate::language::confine::recipe::recipe;
use crate::language::launch::LaunchRequest;
use std::{collections::HashMap, path::Path, path::PathBuf};

fn request(project: &str, spellings: &[&str]) -> LaunchRequest {
    return LaunchRequest {
        server: "rust-analyzer".to_string(),
        executable: PathBuf::from("/opt/servers/bin/server"),
        args: Vec::new(),
        environment: HashMap::new(),
        settings: None,
        project_root: PathBuf::from(project),
        project_spellings: spellings.iter().map(PathBuf::from).collect(),
        state_root: Some(PathBuf::from("/state")),
    };
}

/// Position of the first argument triple `option source destination`.
fn triple(args: &[String], option: &str, source: &str, destination: &str) -> Option<usize> {
    return args.windows(3).position(|window| {
        return window[0] == option && window[1] == source && window[2] == destination;
    });
}

#[test]
fn project_below_tmp_and_run_is_bound_back_after_the_replacements() {
    let wanted = request(
        "/tmp/work/project",
        &["/run/media/someone/project", "/home/someone/project"],
    );
    let launch = recipe(
        &wanted,
        Path::new("/state/p/rust-analyzer"),
        "/usr/bin/bwrap",
        &[],
    )
    .expect("recipe");
    let args = &launch.args;
    let run = args.windows(2).position(|window| {
        return window[0] == "--tmpfs" && window[1] == "/run";
    });
    let tmp = triple(args, "--bind", "/state/p/rust-analyzer/tmp", "/tmp");
    assert!(
        run.is_some() && tmp.is_some(),
        "the replacements are missing: {args:?}"
    );
    let canonical = triple(args, "--ro-bind", "/tmp/work/project", "/tmp/work/project");
    let media = triple(
        args,
        "--ro-bind",
        "/tmp/work/project",
        "/run/media/someone/project",
    );
    assert!(
        canonical.is_some() && media.is_some(),
        "the project is not bound back at both spellings: {args:?}"
    );
    assert!(
        run < canonical && tmp < canonical && run < media,
        "a replacement comes after the project bind and would hide it: {args:?}"
    );
    assert_eq!(
        triple(
            args,
            "--ro-bind",
            "/tmp/work/project",
            "/home/someone/project"
        ),
        None,
        "a spelling outside the replaced locations resolves through the root and needs no bind"
    );
    let clear = args.iter().position(|part| return part == "--clearenv");
    assert!(media < clear, "project binds must precede the environment");
}

#[test]
fn every_project_mount_uses_the_one_mount_option() {
    assert_eq!(
        PROJECT_MOUNT, "--ro-bind",
        "0.x servers must only read the project"
    );
    let options = project_binds(
        Path::new("/var/home/someone/project"),
        &[
            PathBuf::from("/var/home/someone/project"),
            PathBuf::from("/dev/shm/project"),
        ],
    )
    .expect("binds");
    assert_eq!(
        options,
        vec![
            "--ro-bind",
            "/var/home/someone/project",
            "/var/home/someone/project",
            "--ro-bind",
            "/var/home/someone/project",
            "/dev/shm/project",
        ],
        "the canonical root is always bound, a duplicate spelling is not bound twice"
    );
}

#[test]
fn replaced_locations_compare_whole_components() {
    assert_eq!(replaced_location(Path::new("/tmp")), Some("/tmp"));
    assert_eq!(
        replaced_location(Path::new("/run/user/1000/p")),
        Some("/run")
    );
    assert_eq!(replaced_location(Path::new("/dev/shm/p")), Some("/dev"));
    assert_eq!(replaced_location(Path::new("/tmpfoo/p")), None);
    assert_eq!(replaced_location(Path::new("/var/tmp/p")), None);
    assert_eq!(replaced_location(Path::new("/proc/1")), None);
}

//! The home-folder rule: a server root may lie below the home folder, never at or above it.

use super::covers_home;
use std::{fs, path::Path};

#[test]
fn the_home_folder_itself_and_folders_above_it_cover_home() {
    let base = tempfile::tempdir().expect("disposable base");
    let home = base.path().join("home/someone");
    fs::create_dir_all(&home).expect("home");
    assert!(covers_home(&home, Some(&home)), "the home folder itself");
    assert!(
        covers_home(&base.path().join("home"), Some(&home)),
        "the folder above it"
    );
    assert!(
        covers_home(Path::new("/"), Some(&home)),
        "the file system root"
    );
}

#[test]
fn projects_below_the_home_folder_do_not_cover_it() {
    let base = tempfile::tempdir().expect("disposable base");
    let home = base.path().join("home");
    let project = home.join("code/project");
    fs::create_dir_all(&project).expect("project");
    assert!(!covers_home(&project, Some(&home)));
    let sibling = base.path().join("homework");
    fs::create_dir_all(&sibling).expect("sibling with a shared name prefix");
    assert!(
        !covers_home(&sibling, Some(&home)),
        "paths compare by whole components"
    );
    assert!(
        !covers_home(&home, None),
        "without a home folder nothing is refused"
    );
}

/// This host links `/home` to `/var/home`; a root spelled one way must match a home spelled the other.
#[test]
fn spellings_through_a_symbolic_link_are_compared_by_location() {
    let base = tempfile::tempdir().expect("disposable base");
    let real = base.path().join("var/home/someone");
    fs::create_dir_all(&real).expect("home");
    let link = base.path().join("home");
    std::os::unix::fs::symlink(base.path().join("var/home"), &link).expect("link");
    assert!(covers_home(&link.join("someone"), Some(&real)));
    assert!(covers_home(&real, Some(&link.join("someone"))));
}

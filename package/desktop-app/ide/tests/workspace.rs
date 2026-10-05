//! Directory operations read disposable project trees and reject escapes without mutating them.

/// The same project boundary will serve tree and search navigation.
use ide_app::workspace::Workspace;
/// Native names and Unix symlinks exercise paths without UI-string normalization.
use std::{fs, os::unix::fs::symlink, path::Path};

/// Hidden entries and native names retain filesystem enumeration order and accurate directory kinds.
#[test]
fn listing_matches_dirents_and_refreshes_from_disk() {
    let fixture = tempfile::tempdir().expect("disposable project");
    fs::create_dir(fixture.path().join("src")).expect("source directory");
    fs::write(fixture.path().join(".hidden"), "hidden").expect("hidden fixture");
    fs::write(fixture.path().join("猫 'quoted'.ts"), "const 猫 = 1;").expect("Unicode fixture");
    let project = Workspace::new(fixture.path()).expect("open project");
    let expected = fs::read_dir(fixture.path())
        .expect("reference dirents")
        .map(|entry| return entry.expect("reference entry").file_name())
        .collect::<Vec<_>>();
    let first = project.list(Path::new(".")).expect("initial listing");
    assert_eq!(
        first
            .iter()
            .map(|entry| return entry.name.clone())
            .collect::<Vec<_>>(),
        expected
    );
    assert!(
        first
            .iter()
            .any(|entry| return entry.name == "src" && entry.is_directory)
    );
    assert!(first.iter().any(|entry| return entry.name == ".hidden"));
    fs::write(fixture.path().join("new.rs"), "fn main() {}").expect("external new file");
    let second = project.list(Path::new(".")).expect("fresh listing");
    assert_eq!(second.len(), first.len() + 1);
    assert!(second.iter().any(|entry| return entry.name == "new.rs"));
}

/// Relative paths use the project root, with valid parent segments allowed inside it.
#[test]
fn contained_relative_and_absolute_paths_resolve() {
    let fixture = tempfile::tempdir().expect("disposable project");
    fs::create_dir(fixture.path().join("src")).expect("source directory");
    fs::write(fixture.path().join("src/main.rs"), "fn main() {}").expect("source file");
    let project = Workspace::new(fixture.path()).expect("open project");
    let path = project
        .resolve(Path::new("src/../src/main.rs"))
        .expect("contained relative path");
    assert!(path.starts_with(project.root()));
    assert_eq!(
        project.resolve(&path).expect("contained absolute path"),
        path
    );
}

/// Component containment rejects sibling-prefix paths and parent traversal.
#[test]
fn sibling_prefix_and_parent_escape_are_rejected() {
    let fixture = tempfile::tempdir().expect("disposable parent");
    let root = fixture.path().join("project");
    let sibling = fixture.path().join("project-other");
    fs::create_dir(&root).expect("project directory");
    fs::create_dir(&sibling).expect("sibling directory");
    let project = Workspace::new(&root).expect("open project");
    assert!(project.resolve(&sibling).is_err());
    assert!(project.list(Path::new("../project-other")).is_err());
}

/// Tree operations reject outside symlink targets while retaining dirent link semantics.
#[test]
fn symbolic_links_do_not_bypass_project_boundary() {
    let fixture = tempfile::tempdir().expect("disposable parent");
    let root = fixture.path().join("project");
    let outside = fixture.path().join("outside");
    fs::create_dir(&root).expect("project directory");
    fs::create_dir(&outside).expect("outside directory");
    fs::create_dir(root.join("inside")).expect("inside directory");
    symlink(&outside, root.join("escape")).expect("outside link fixture");
    symlink(root.join("inside"), root.join("alias")).expect("inside link fixture");
    let project = Workspace::new(&root).expect("open project");
    assert!(project.list(Path::new("escape")).is_err());
    assert!(
        project
            .list(Path::new("alias"))
            .expect("contained explicit alias")
            .is_empty()
    );
    let entries = project.list(Path::new(".")).expect("root entries");
    assert!(
        !entries
            .iter()
            .find(|entry| return entry.name == "alias")
            .expect("link entry")
            .is_directory
    );
}

/// Missing paths, file roots, and listing a file report failures rather than empty directories.
#[test]
fn invalid_directory_inputs_are_errors() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let file = fixture.path().join("file.txt");
    fs::write(&file, "source").expect("file fixture");
    assert!(Workspace::new(&file).is_err());
    assert!(Workspace::new(&fixture.path().join("missing")).is_err());
    let project = Workspace::new(fixture.path()).expect("open project");
    assert!(project.list(&file).is_err());
    assert!(project.resolve(Path::new("missing")).is_err());
}

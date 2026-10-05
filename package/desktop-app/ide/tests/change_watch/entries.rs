//! Entry changes invalidate the watched directory that lists them; collapse removes the kernel watch.

/// Waits, kernel probes, and fixture helpers shared by this crate.
use super::support::{arrive, kernel_watches, not_watching, quiet, set, settle, start, watching};
/// The watcher under test.
use ide_app::change_watch::ChangeWatcher;
/// Fixture writes and renames happen through the ordinary filesystem API.
use std::{fs, path::Path};

/// Drain earlier notifications, run `change`, and require a report for `folder` without a full reread.
///
/// What: `change: impl FnOnce()` accepts any closure called once, like a TS `() => void` parameter.
/// Why: Each filesystem step is checked in isolation from the notifications of the previous step.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function expectReport(watcher, folder, name, change: () => void) { ... }
/// ```
fn expect_report(watcher: &mut ChangeWatcher, folder: &Path, name: &str, change: impl FnOnce()) {
    quiet(watcher);
    change();
    let record = arrive(watcher, name, |pending| {
        return pending.directories.contains(folder);
    });
    assert!(
        !record.everything,
        "{name} requested a full reread: {record:?}"
    );
}

/// Create, rename, and remove inside a watched folder each report that folder.
#[test]
fn created_renamed_and_removed_entries_invalidate_their_folder() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let (mut watcher, workspace) = start(fixture.path());
    let root = workspace.root().to_path_buf();
    let folder = root.join("folder");
    fs::create_dir(&folder).expect("fixture folder");
    watcher.watch_only(&set(&[&root, &folder]), None);
    settle(&mut watcher, &[&root, &folder]);
    expect_report(&mut watcher, &folder, "a created file", || {
        fs::write(folder.join("a.txt"), "a").expect("create");
    });
    expect_report(&mut watcher, &folder, "a renamed file", || {
        fs::rename(folder.join("a.txt"), folder.join("b.txt")).expect("rename");
    });
    expect_report(&mut watcher, &folder, "a removed file", || {
        fs::remove_file(folder.join("b.txt")).expect("remove");
    });
    expect_report(&mut watcher, &folder, "a created folder", || {
        fs::create_dir(folder.join("nested")).expect("create folder");
    });
}

/// Moving a file into and out of a watched folder reports both folders.
#[test]
fn moves_into_and_out_of_a_watched_folder_report_both_folders() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let (mut watcher, workspace) = start(fixture.path());
    let root = workspace.root().to_path_buf();
    let folder = root.join("folder");
    fs::create_dir(&folder).expect("fixture folder");
    fs::write(root.join("outer.txt"), "outer").expect("outer file");
    watcher.watch_only(&set(&[&root, &folder]), None);
    settle(&mut watcher, &[&root, &folder]);
    fs::rename(root.join("outer.txt"), folder.join("outer.txt")).expect("move in");
    arrive(
        &mut watcher,
        "a move into the folder, for both folders",
        |record| {
            return record.directories.contains(&folder) && record.directories.contains(&root);
        },
    );
    quiet(&mut watcher);
    fs::rename(folder.join("outer.txt"), root.join("outer.txt")).expect("move out");
    arrive(
        &mut watcher,
        "a move out of the folder, for both folders",
        |record| {
            return record.directories.contains(&folder) && record.directories.contains(&root);
        },
    );
}

/// A new watch reports its folder once, so a change made before the watch existed is reread.
/// The displayed file's directory also reports the displayed file as changed.
#[test]
fn a_new_watch_reports_its_folder_and_the_displayed_file_once() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let (mut watcher, workspace) = start(fixture.path());
    let root = workspace.root().to_path_buf();
    let folder = root.join("folder");
    fs::create_dir(&folder).expect("fixture folder");
    let file = folder.join("view.txt");
    fs::write(&file, "view").expect("displayed file");
    watcher.watch_only(&set(&[&root]), None);
    let first = arrive(&mut watcher, "the root's new watch", |record| {
        return record.directories.contains(&root);
    });
    assert_eq!(first.source, None, "no file is displayed yet");
    // The displayed file's directory is watched even though the tree does not show it.
    watcher.watch_only(&set(&[&root]), Some(&file));
    let second = arrive(
        &mut watcher,
        "the displayed file's new directory watch",
        |record| {
            return record.directories.contains(&folder) && record.source.is_some();
        },
    );
    assert!(watching(&second, &folder));
}

/// Collapsing a folder removes its kernel watch; showing it again adds one back.
#[test]
fn collapsing_a_folder_removes_its_kernel_watch() {
    let fixture = tempfile::tempdir().expect("disposable project");
    let (mut watcher, workspace) = start(fixture.path());
    let root = workspace.root().to_path_buf();
    let folder = root.join("folder");
    fs::create_dir(&folder).expect("fixture folder");
    watcher.watch_only(&set(&[&root, &folder]), None);
    settle(&mut watcher, &[&root, &folder]);
    assert!(
        kernel_watches(&folder),
        "the shown folder has no kernel watch"
    );
    watcher.watch_only(&set(&[&root]), None);
    arrive(
        &mut watcher,
        "the collapsed folder's removal from the watched set",
        |record| {
            return not_watching(record, &folder);
        },
    );
    assert!(
        !kernel_watches(&folder),
        "the collapsed folder kept its kernel watch"
    );
    assert!(
        kernel_watches(&root),
        "collapsing a folder removed the root's watch"
    );
    fs::write(folder.join("hidden.txt"), "hidden").expect("change inside the collapsed folder");
    let silent = quiet(&mut watcher);
    assert!(
        !silent.directories.contains(&folder),
        "a collapsed folder was reported: {silent:?}"
    );
    watcher.watch_only(&set(&[&root, &folder]), None);
    settle(&mut watcher, &[&root, &folder]);
    assert!(
        kernel_watches(&folder),
        "re-expanding the folder did not watch it again"
    );
}

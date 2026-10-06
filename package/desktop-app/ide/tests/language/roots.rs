//! Workspace roots: the project root is the only acceptable server root, whatever the working
//! directory and the surrounding tree look like.

use crate::support::{self, Layout, Probe, SERVER};
use ide_app::language::{
    config::LanguageSetup,
    reply::{RequestKind, RequestOutcome, Target},
    status::ServerState,
};
use serde_json::Value;
use std::{fs, path::Path};

/// The `initialize` message the scripted server received.
fn initialize(lines: &[Value]) -> Value {
    return lines
        .iter()
        .find(|line| return line["received"] == "initialize")
        .expect("initialize")
        .clone();
}

/// The process works in a directory that is unrelated to the project.
fn elsewhere(base: &Path) -> Layout {
    let root = base.join("project");
    let cwd = base.join("elsewhere");
    fs::create_dir(&root).expect("project directory");
    fs::create_dir(&cwd).expect("other directory");
    return Layout {
        root,
        cwd,
        pwd: None,
    };
}

/// A wrong working directory starts nothing and is reported as such.
#[test]
fn working_directory_elsewhere_is_refused() {
    let Some(root) = support::child_root() else {
        support::run_child("roots::working_directory_elsewhere_is_refused", elsewhere);
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    probe.open(&root.join("file.scripted"), "alpha\n");
    probe.until("the wrong-working-directory state", |seen| {
        return matches!(
            seen.state(SERVER),
            Some(ServerState::WrongWorkingDirectory { .. })
        );
    });
    let expected = root.parent().expect("base").join("elsewhere");
    assert_eq!(
        probe.state(SERVER),
        Some(&ServerState::WrongWorkingDirectory {
            directory: expected
        })
    );
    assert!(
        support::children().is_empty() && support::report(&root).is_empty(),
        "a server was started although the working directory is not the project"
    );
    let number = probe.request(RequestKind::Hover, 1);
    assert_eq!(probe.answers(number)[0].outcome, RequestOutcome::NoServer);
}

/// The project is a subdirectory of a version-controlled tree.
fn nested(base: &Path) -> Layout {
    let tree = base.join("tree");
    let root = tree.join("project");
    fs::create_dir_all(tree.join(".git")).expect("version-control marker");
    fs::create_dir_all(root.join("sub")).expect("project directory");
    return Layout {
        root: root.clone(),
        cwd: root,
        pwd: None,
    };
}

/// Without a root marker Helix would root the server at the enclosing tree; that is refused.
#[test]
fn nested_project_without_root_marker_is_refused() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "roots::nested_project_without_root_marker_is_refused",
            nested,
        );
        return;
    };
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    probe.open(&root.join("file.scripted"), "alpha\n");
    probe.until("the root-outside-project state", |seen| {
        return matches!(
            seen.state(SERVER),
            Some(ServerState::RootOutsideProject { .. })
        );
    });
    assert_eq!(
        probe.state(SERVER),
        Some(&ServerState::RootOutsideProject {
            root: root.parent().expect("tree").to_path_buf()
        }),
        "an enclosing-tree root was not refused"
    );
    assert!(
        support::children().is_empty() && support::report(&root).is_empty(),
        "a server was started on the enclosing tree"
    );
}

/// With a root marker in the project, the project is the root even inside a larger tree,
/// and even when the tree's top has the same marker.
#[test]
fn nested_project_with_root_marker_is_rooted_at_the_project() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "roots::nested_project_with_root_marker_is_rooted_at_the_project",
            nested,
        );
        return;
    };
    fs::write(root.join("marker.toml"), "").expect("project marker");
    fs::write(root.parent().expect("tree").join("marker.toml"), "").expect("tree marker");
    let definitions = support::scripted_with_roots(&root, &[], 3, r#"["marker.toml"]"#);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("sub/file.scripted"), "alpha\n");
    probe.until_ready();
    let lines = support::server_text_until(&root, "alpha\n");
    let project = format!("file://{}", root.display());
    assert_eq!(initialize(&lines)["params"]["rootUri"], project.as_str());
    let started = lines
        .iter()
        .find(|line| return !line["started"].is_null())
        .expect("start record");
    assert_eq!(
        started["started"]["cwd"],
        root.display().to_string().as_str()
    );
}

/// A marker only in a subdirectory roots the server there, which is still inside the project.
#[test]
fn marker_in_a_subdirectory_roots_the_server_inside_the_project() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "roots::marker_in_a_subdirectory_roots_the_server_inside_the_project",
            nested,
        );
        return;
    };
    fs::write(root.join("sub/marker.toml"), "").expect("subdirectory marker");
    let definitions = support::scripted_with_roots(&root, &[], 3, r#"["marker.toml"]"#);
    let mut probe = Probe::new(&root, definitions);
    probe.open(&root.join("sub/file.scripted"), "alpha\n");
    probe.until_ready();
    let lines = support::server_text_until(&root, "alpha\n");
    let expected = format!("file://{}", root.join("sub").display());
    assert_eq!(initialize(&lines)["params"]["rootUri"], expected.as_str());
}

/// The shell reached the project through a symbolic link and exported that spelling as `PWD`.
fn linked(base: &Path) -> Layout {
    let real = base.join("real");
    let root = real.join("project");
    fs::create_dir_all(&root).expect("project directory");
    std::os::unix::fs::symlink(&real, base.join("link")).expect("symbolic link");
    let spelled = base.join("link/project");
    return Layout {
        root,
        cwd: spelled.clone(),
        pwd: Some(spelled),
    };
}

/// Helix then spells the working directory through the link; the worker follows that spelling
/// for the root and the document address, and still recognizes the document by resolved path.
#[test]
fn project_reached_through_a_linked_working_directory_is_rooted_at_the_project() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "roots::project_reached_through_a_linked_working_directory_is_rooted_at_the_project",
            linked,
        );
        return;
    };
    let spelled = root
        .parent()
        .and_then(|real| return real.parent())
        .expect("base")
        .join("link/project");
    assert_eq!(
        std::env::var_os("PWD").as_deref(),
        Some(spelled.as_os_str())
    );
    let mut probe = Probe::new(&root, support::scripted(&root, &[], 3));
    let file = root.join("file.scripted");
    probe.open(&file, "alpha\nbeta\ngamma line\n");
    probe.until_ready();
    let lines = support::server_text_until(&root, "alpha\nbeta\ngamma line\n");
    assert_eq!(
        initialize(&lines)["params"]["rootUri"],
        format!("file://{}", spelled.display()).as_str(),
        "the server was not rooted at the project reached through the linked working directory"
    );
    let opened = lines
        .iter()
        .find(|line| return line["received"] == "textDocument/didOpen")
        .expect("didOpen");
    assert_eq!(
        opened["params"]["textDocument"]["uri"],
        format!("file://{}", spelled.join("file.scripted").display()).as_str()
    );
    probe.until("diagnostics published under the linked spelling", |seen| {
        return !seen.messages().is_empty();
    });
    let number = probe.request(RequestKind::Definition, 1);
    let answers = probe.answers(number);
    let RequestOutcome::Locations(targets) = &answers[0].outcome else {
        panic!("definition produced {:?}", answers[0].outcome);
    };
    let Target::Open(same) = &targets[0] else {
        panic!("the same-document target is {:?}", targets[0]);
    };
    assert!(
        same.same_document && !same.outside_project,
        "the document was not recognized through its linked spelling"
    );
    assert_eq!(same.path, file);
}

/// The home folder opened as the project: a file with no root marker between itself and the home
/// folder starts no server, because its root would be the whole home folder; a file inside a
/// project with a marker below the home folder is rooted at that project.
#[test]
fn home_folder_as_project_roots_servers_only_at_markers_below_it() {
    let Some(root) = support::child_root() else {
        support::run_child(
            "roots::home_folder_as_project_roots_servers_only_at_markers_below_it",
            support::standard,
        );
        return;
    };
    fs::create_dir_all(root.join("notes")).expect("loose folder");
    fs::create_dir_all(root.join("code/tool/src")).expect("project below home");
    fs::write(root.join("code/tool/marker.toml"), "").expect("project marker");
    let setup = LanguageSetup {
        extra_languages: Some(support::scripted_with_roots(
            &root,
            &[],
            3,
            r#"["marker.toml"]"#,
        )),
        home: Some(root.clone()),
        ..LanguageSetup::unconfined()
    };
    let mut probe = Probe::with_setup(&root, setup);
    probe.open(&root.join("notes/file.scripted"), "alpha\n");
    probe.until("the not-started state", |seen| {
        return matches!(seen.state(SERVER), Some(ServerState::NotStarted { .. }));
    });
    let Some(ServerState::NotStarted { reason }) = probe.state(SERVER) else {
        panic!("unexpected state {:?}", probe.state(SERVER));
    };
    assert!(reason.contains("home folder"), "{reason}");
    assert!(reason.contains(&root.display().to_string()), "{reason}");
    assert!(
        support::children().is_empty() && support::report(&root).is_empty(),
        "a server was started with the home folder as its workspace"
    );
    probe.open(&root.join("code/tool/src/file.scripted"), "beta\n");
    probe.until_ready();
    let lines = support::server_text_until(&root, "beta\n");
    let expected = format!("file://{}", root.join("code/tool").display());
    assert_eq!(initialize(&lines)["params"]["rootUri"], expected.as_str());
}

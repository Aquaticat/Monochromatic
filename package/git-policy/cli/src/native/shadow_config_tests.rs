//! Controls for the shadow `config` file and the copied repository format.

use super::*;
use crate::test_support::{fixture, git, git_context, remove, repository};
use std::path::PathBuf;

/// Quoting escapes exactly the characters Git's config syntax needs and keeps the rest literal.
#[test]
fn quoting_escapes_only_what_git_requires() {
    assert_eq!(quote_git_config_value("/a \"b\""), r#""/a \"b\"""#);
    assert_eq!(quote_git_config_value("a\\b"), r#""a\\b""#);
    assert_eq!(quote_git_config_value("a\nb\tc"), r#""a\nb\tc""#);
    assert_eq!(quote_git_config_value("x ; # y "), r#""x ; # y ""#);
    assert_eq!(quote_git_config_value(""), r#""""#);
}

/// A repository without extensions writes the fixed layout with no extensions section.
#[test]
fn config_without_extensions_has_the_fixed_layout() {
    let format: RepositoryFormat = RepositoryFormat {
        version: String::from("0"),
        extensions: Vec::new(),
    };
    let text: String = format_shadow_config(
        &format,
        Path::new("/r/.git"),
        Path::new("/r"),
    );
    assert_eq!(
        text,
        concat!(
            "[core]\n",
            "\trepositoryformatversion = \"0\"\n",
            "\thooksPath = \"/r/.git/hooks\"\n",
            "[include]\n",
            "\tpath = \"/r/.git/config\"\n",
            "[core]\n",
            "\tworktree = \"/r\"\n",
            "[gc]\n",
            "\tauto = 0\n",
            "[maintenance]\n",
            "\tauto = false\n",
        )
    );
}

/// Extensions are copied under their own section, before the include.
#[test]
fn config_copies_extensions_before_the_include() {
    let format: RepositoryFormat = RepositoryFormat {
        version: String::from("1"),
        extensions: vec![(String::from("objectformat"), String::from("sha256"))],
    };
    let text: String = format_shadow_config(&format, Path::new("/r/.git"), Path::new("/r"));
    assert!(text.contains("[extensions]\n\tobjectformat = \"sha256\"\n[include]\n"), "{text}");
}

/// A sha1 repository reports version 0 and no extensions.
#[test]
fn sha1_repository_format_is_version_zero_without_extensions() {
    let root: PathBuf = fixture("shadow-config-sha1");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let format: RepositoryFormat =
        read_repository_format(&git_context(), repo.join(".git").as_path()).expect("format");
    assert_eq!(format.version, "0");
    assert!(format.extensions.is_empty());
    remove(root.as_path());
}

/// A sha256 repository copies its object format extension and version 1.
#[test]
fn sha256_repository_copies_its_object_format() {
    let root: PathBuf = fixture("shadow-config-sha256");
    git(root.as_path(), &["init", "--quiet", "--object-format=sha256", "repo"]);
    let repo: PathBuf = root.join("repo");
    let format: RepositoryFormat =
        read_repository_format(&git_context(), repo.join(".git").as_path()).expect("format");
    assert_eq!(format.version, "1");
    assert!(format
        .extensions
        .contains(&(String::from("objectformat"), String::from("sha256"))));
    remove(root.as_path());
}

/// A valueless extension reads as `true`, and a non-extension key is not copied.
#[test]
fn valueless_extension_reads_as_true_and_other_keys_are_skipped() {
    let root: PathBuf = fixture("shadow-config-valueless");
    let repo: PathBuf = repository(root.as_path(), "repo");
    let common: PathBuf = repo.join(".git");
    std::fs::OpenOptions::new()
        .append(true)
        .open(common.join("config"))
        .and_then(|mut file| {
            use std::io::Write;
            return file.write_all(b"[extensions]\n\tworktreeConfig\n[user]\n\tname = Someone\n");
        })
        .expect("append");
    let format: RepositoryFormat =
        read_repository_format(&git_context(), common.as_path()).expect("format");
    assert!(format
        .extensions
        .contains(&(String::from("worktreeconfig"), String::from("true"))));
    assert!(format.extensions.iter().all(|(name, _)| { return !name.starts_with("user"); }));
    remove(root.as_path());
}

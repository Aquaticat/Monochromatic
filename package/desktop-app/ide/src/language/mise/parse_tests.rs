//! Listings,
//!  directories,
//!  messages,
//!  and the untrusted-file extraction on captured and hostile text.

use super::{
    MESSAGE_LIMIT, config_paths, directories, merge, message, project_configs, untrusted_config,
};
use std::{fs, path::PathBuf};

/// The standard error of mise 2026.10.0 for a configuration with `[env]` that was never trusted,
///  captured from a disposable project.
const UNTRUSTED: &str = "mise ERROR error parsing config file: /work/project one/mise.toml
mise ERROR Config files in /work/project one/mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.jdx.dev/cli/trust.html for more information.
mise ERROR Version: 2026.10.0 linux-x64 (2026-10-02)
mise ERROR Run with --verbose or MISE_VERBOSE=1 for more information
";

#[test]
fn a_listing_gives_the_paths_of_its_entries() {
    let listing = r#"[
      {"path": "/work/project/mise.toml", "tools": ["taplo", "node"]},
      {"path": "/home/someone/.config/mise/config.toml", "tools": []}
    ]"#;
    assert_eq!(
        config_paths(listing).expect("listing"),
        [
            PathBuf::from("/work/project/mise.toml"),
            PathBuf::from("/home/someone/.config/mise/config.toml")
        ]
    );
    assert_eq!(
        config_paths("[]").expect("empty listing"),
        Vec::<PathBuf>::new()
    );
}

#[test]
fn text_that_is_not_a_listing_is_refused_with_the_reason() {
    for (text, wanted) in [
        ("", "not JSON"),
        ("not json at all", "not JSON"),
        (r#"{"path": "/x"}"#, "not a JSON array"),
        (r#"[{"tools": []}]"#, "has no path"),
        (r#"[{"path": 7}]"#, "has no path"),
    ] {
        let reason = config_paths(text).expect_err(text);
        assert!(reason.contains(wanted), "{text:?} gave {reason}");
    }
}

#[test]
fn the_projects_configuration_is_what_the_global_listing_lacks() {
    let global = vec![PathBuf::from("/home/someone/.config/mise/config.toml")];
    let both = vec![
        PathBuf::from("/work/project/mise.toml"),
        PathBuf::from("/work/mise.toml"),
        PathBuf::from("/home/someone/.config/mise/config.toml"),
    ];
    assert_eq!(
        project_configs(&both, &global),
        [
            PathBuf::from("/work/project/mise.toml"),
            PathBuf::from("/work/mise.toml")
        ]
    );
    assert!(project_configs(&global, &global).is_empty());
    assert!(project_configs(&[], &global).is_empty());
}

#[test]
fn directories_keep_absolute_existing_directories_once_in_order() {
    let root = tempfile::tempdir().expect("directory");
    let first = root.path().join("node 26/bin");
    let second = root.path().join("it's \"quoted\"/bin");
    let dashed = root.path().join("-dashed");
    for directory in [&first, &second, &dashed] {
        fs::create_dir_all(directory).expect("directory");
    }
    let file = root.path().join("a-file");
    fs::write(&file, "").expect("file");
    let output = format!(
        "{}\n{}\nrelative/bin\n{}\n\n{}\n{}\n{}\r\n/definitely/not/there\n",
        first.display(),
        second.display(),
        file.display(),
        first.display(),
        dashed.display(),
        second.display(),
    );
    assert_eq!(directories(&output), [first, second, dashed]);
}

#[test]
fn a_directory_name_with_a_newline_is_never_taken_as_two_directories() {
    let root = tempfile::tempdir().expect("directory");
    let whole = root.path().join("one\ntwo");
    fs::create_dir_all(&whole).expect("directory");
    // The two halves of the line are not directories, so nothing is accepted.
    assert!(directories(&format!("{}\n", whole.display())).is_empty());
}

#[test]
fn a_refusal_is_quoted_without_the_version_footer() {
    let text = message(UNTRUSTED);
    assert_eq!(
        text,
        "mise ERROR error parsing config file: /work/project one/mise.toml\n\
         mise ERROR Config files in /work/project one/mise.toml are not trusted.\n\
         Trust them with `mise trust`. See https://mise.jdx.dev/cli/trust.html for more information."
    );
}

#[test]
fn the_update_notice_and_color_codes_are_dropped_and_the_rest_is_kept() {
    let text = message(
        "\u{1b}[33mmise WARN \u{1b}[0m mise version 2026.10.9 available\n\
         mise WARN  To update, run mise self-update\n\
         \u{1b}[33mmise WARN \u{1b}[0m missing: taplo@0.9.0\n",
    );
    assert_eq!(text, "mise WARN  missing: taplo@0.9.0");
}

#[test]
fn the_refused_tracking_link_in_the_read_only_state_directory_is_dropped() {
    let text = message(
        "mise WARN  tracking config: failed to ln -sf /work/project/mise.toml /home/someone/.local/state/mise/tracked-configs/abc: Read-only file system\nmise WARN  missing: taplo@0.9.0\n",
    );
    assert_eq!(text, "mise WARN  missing: taplo@0.9.0");
}

#[test]
fn control_characters_that_move_the_cursor_or_ring_a_bell_are_removed() {
    let text = message("mise ERROR bad\u{7}\u{8}\u{0}\rname\u{1b}]0;title\u{7}\n");
    assert!(
        !text
            .chars()
            .any(|character| return character.is_control() && character != '\n'),
        "{text:?}"
    );
    assert!(text.starts_with("mise ERROR bad"), "{text:?}");
    assert!(!text.contains("title"), "{text:?}");
}

#[test]
fn a_long_message_is_cut_with_an_ellipsis() {
    let text = message(&"x".repeat(MESSAGE_LIMIT * 3));
    assert_eq!(text.chars().count(), MESSAGE_LIMIT + 3);
    assert!(text.ends_with("..."));
    // Characters wider than one byte are cut on a boundary.
    let wide = message(&"é".repeat(MESSAGE_LIMIT + 5));
    assert_eq!(wide.chars().count(), MESSAGE_LIMIT + 3);
}

#[test]
fn an_empty_standard_error_is_an_empty_message() {
    assert_eq!(message(""), "");
    assert_eq!(message("\n  \nmise ERROR Version: 1\n"), "");
}

#[test]
fn repeated_warnings_are_kept_once() {
    let merged = merge(&[
        "mise WARN  unknown field: lockfile\n",
        "mise WARN  unknown field: lockfile\nmise WARN  missing: taplo@0.9.0\n",
        "",
    ]);
    assert_eq!(
        merged,
        "mise WARN  unknown field: lockfile\nmise WARN  missing: taplo@0.9.0"
    );
}

#[test]
fn the_untrusted_file_is_named_even_with_spaces_and_quotes_in_its_path() {
    assert_eq!(
        untrusted_config(&message(UNTRUSTED)),
        Some("/work/project one/mise.toml")
    );
    assert_eq!(
        untrusted_config("Config files in /a/it's \"x\"/-mise.toml are not trusted."),
        Some("/a/it's \"x\"/-mise.toml")
    );
    assert_eq!(untrusted_config("mise ERROR something else"), None);
    assert_eq!(untrusted_config("Config files in  are not trusted"), None);
    assert_eq!(untrusted_config("Config files in /a/mise.toml"), None);
}

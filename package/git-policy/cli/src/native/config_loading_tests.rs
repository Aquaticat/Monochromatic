//! What: Configuration fast-path decisions over native Git argument shapes.
//! Why: An optional presentation flag must not consume a branch/tag name and hide a mutation.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Cover listing, mutation, separator and opaque-value paths independently.
//! ```

/// Import actual classification and native argument ownership.
use super::{ConfigLoading, classify_config_loading};
use std::ffi::OsString;

/// Build one exact argv vector and classify it without side effects.
fn classify(values: &[&str]) -> ConfigLoading {
    let mut arguments: Vec<OsString> = Vec::<OsString>::new();
    for value in values {
        arguments.push(OsString::from(value));
    }
    return classify_config_loading(arguments.as_slice());
}

/// Known inspection commands and explicit list/verify forms skip policy initialization.
#[test]
fn recognized_inspection_forms_keep_the_fast_path() {
    for args in [
        vec!["status"],
        vec!["-C", "/repo", "show", "HEAD"],
        vec!["--version"],
        vec!["branch"],
        vec!["branch", "--list", "feature-*"],
        vec!["branch", "-vl", "feature-*"],
        vec!["branch", "--contains", "HEAD"],
        vec!["branch", "--contains"],
        vec!["branch", "--show-current"],
        vec!["tag"],
        vec!["tag", "--list", "v*"],
        vec!["tag", "--verify", "v1"],
        vec!["tag", "-n3", "v*"],
        vec!["branch", "--list", "--", "-D"],
        vec!["branch", "--format", "--delete"],
    ] {
        assert_eq!(classify(args.as_slice()), ConfigLoading::Skip, "{args:?}");
    }
}

/// Mutations remain configuration-requiring even when mixed with a listing flag.
#[test]
fn mutation_flags_and_positionals_never_become_false_inspection() {
    for args in [
        vec!["commit"],
        vec!["future-command"],
        vec![],
        vec!["branch", "feature"],
        vec!["branch", "-uorigin/main"],
        vec!["branch", "--delete-merged"],
        vec!["branch", "--list", "--delete", "feature"],
        vec!["branch", "--del", "feature"],
        vec!["tag", "v1"],
        vec!["tag", "-mmessage", "v1"],
        vec!["tag", "--delete=v1"],
        vec!["branch", "--color", "new-branch"],
        vec!["tag", "--column", "new-tag"],
        vec!["branch", "--color=always", "new-branch"],
        vec!["branch", "--format"],
        vec!["branch", "--unknown"],
        vec!["branch", "-x"],
    ] {
        assert_eq!(
            classify(args.as_slice()),
            ConfigLoading::Required,
            "{args:?}"
        );
    }
}

/// Run real Git only inside a newly created fixture, with no global/system configuration.
fn git(directory: &std::path::Path, arguments: &[&str]) -> std::process::Output {
    let output = std::process::Command::new("/usr/bin/git")
        .current_dir(directory)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", directory.join("absent-global-config"))
        .args(arguments)
        .output()
        .expect("native Git fixture command");
    assert!(
        output.status.success(),
        "{:?}: {}",
        arguments,
        String::from_utf8_lossy(&output.stderr)
    );
    return output;
}

/// Optional --color does not consume a separated branch name in the selected native release.
#[test]
fn native_optional_color_flag_still_creates_a_named_branch() {
    let directory = std::env::temp_dir().join(format!(
        "native-color-classification-{}",
        std::process::id()
    ));
    std::fs::create_dir(&directory).expect("fresh fixture");
    git(&directory, &["init", "--initial-branch=main"]);
    git(
        &directory,
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--allow-empty",
            "--message=initial",
        ],
    );
    git(&directory, &["branch", "--color", "created-with-color"]);
    git(
        &directory,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            "refs/heads/created-with-color",
        ],
    );
    assert_eq!(
        classify(&["branch", "--color", "created-with-color"]),
        ConfigLoading::Required
    );
    std::fs::remove_dir_all(directory).expect("remove only the fixture");
}

/// Required option values are consumed without interpreting their spelling as action flags.
#[test]
fn option_values_and_separators_remain_opaque() {
    assert_eq!(
        classify(&["branch", "--format=-D", "--list", "name"]),
        ConfigLoading::Skip
    );
    assert_eq!(
        classify(&["branch", "--sort", "-name"]),
        ConfigLoading::Skip
    );
    assert_eq!(
        classify(&["branch", "--", "--list"]),
        ConfigLoading::Required
    );
    assert_eq!(
        classify(&["-c", "alias.command=commit", "command"]),
        ConfigLoading::Required
    );
}

//! The notice text and the lookup facts of every state.

use super::{Failed, MiseState, Provided};
use std::path::{Path, PathBuf};

fn provided() -> MiseState {
    return MiseState::Provided(Provided {
        directories: vec![PathBuf::from("/mise/node/bin")],
        configs: vec![PathBuf::from("/work/project/mise.toml")],
        warnings: "mise WARN  missing: taplo@0.9.0".to_string(),
    });
}

#[test]
fn only_a_project_with_a_mise_configuration_is_served() {
    assert!(provided().serves_project());
    assert!(
        MiseState::Failed(Failed {
            message: "x".to_string(),
            untrusted: None
        })
        .serves_project()
    );
    assert!(!MiseState::Disabled.serves_project());
    assert!(!MiseState::Unused("no mise".to_string()).serves_project());
}

#[test]
fn directories_and_warnings_exist_only_when_mise_provided_them() {
    assert_eq!(provided().directories(), [PathBuf::from("/mise/node/bin")]);
    assert_eq!(provided().warnings(), "mise WARN  missing: taplo@0.9.0");
    for state in [
        MiseState::Disabled,
        MiseState::Unused("x".to_string()),
        MiseState::Failed(Failed {
            message: "x".to_string(),
            untrusted: None,
        }),
    ] {
        assert!(state.directories().is_empty());
        assert_eq!(state.warnings(), "");
    }
}

#[test]
fn an_untrusted_configuration_is_named_quoted_and_left_to_the_user_to_trust() {
    let state = MiseState::Failed(Failed {
        message: "mise ERROR Config files in /work/project one/mise.toml are not trusted."
            .to_string(),
        untrusted: Some("/work/project one/mise.toml".to_string()),
    });
    let paragraphs = state.advisory(Path::new("/work/project one"));
    assert_eq!(paragraphs.len(), 3);
    assert!(
        paragraphs[0].contains("/work/project one"),
        "{paragraphs:?}"
    );
    assert!(
        paragraphs[0].contains("looked up on PATH only"),
        "{paragraphs:?}"
    );
    assert_eq!(
        paragraphs[1],
        "mise said: mise ERROR Config files in /work/project one/mise.toml are not trusted."
    );
    assert!(
        paragraphs[2].contains("run `mise trust` on /work/project one/mise.toml"),
        "{paragraphs:?}"
    );
    assert!(
        paragraphs[2].contains("yourself (the IDE never does)"),
        "{paragraphs:?}"
    );
}

#[test]
fn another_failure_points_at_what_mise_names() {
    let state = MiseState::Failed(Failed {
        message: "`mise bin-paths` did not finish within 10 s and was stopped".to_string(),
        untrusted: None,
    });
    let paragraphs = state.advisory(Path::new("/work/project"));
    assert_eq!(paragraphs.len(), 3);
    assert!(
        paragraphs[1].contains("did not finish within 10 s"),
        "{paragraphs:?}"
    );
    assert!(paragraphs[2].contains("mise doctor"), "{paragraphs:?}");
    assert!(!paragraphs[2].contains("mise trust"), "{paragraphs:?}");
}

#[test]
fn no_notice_is_given_when_mise_worked_or_did_not_apply() {
    for state in [
        provided(),
        MiseState::Disabled,
        MiseState::Unused("no mise program was found".to_string()),
    ] {
        assert!(state.advisory(Path::new("/work/project")).is_empty());
    }
}

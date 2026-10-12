//! Controls for the replay options: every branch of the scan changes the answer.

use super::*;

/// Arguments as owned text.
fn args(values: &[&str]) -> Vec<String> {
    return values.iter().map(|value| { return String::from(*value); }).collect();
}

/// `-n` clusters and the long forms decide `no_verify`; the latest decision wins.
#[test]
fn no_verify_follows_the_latest_decision() {
    assert!(replay_options(&args(&["-n", "-m", "x"])).no_verify);
    assert!(replay_options(&args(&["-an", "-m", "x"])).no_verify);
    assert!(replay_options(&args(&["--no-verify", "-m", "x"])).no_verify);
    assert!(!replay_options(&args(&["--no-verify", "--verify"])).no_verify);
    assert!(!replay_options(&args(&["-m", "x"])).no_verify);
}

/// A message that looks like a flag is a value, not an option.
#[test]
fn an_option_value_is_never_read_as_an_option() {
    assert!(!replay_options(&args(&["-m", "-n"])).no_verify);
    assert!(!replay_options(&args(&["--message", "--no-verify"])).no_verify);
    assert!(!replay_options(&args(&["--author", "--no-verify"])).no_verify);
}

/// Options after the pathspec separator are pathspecs.
#[test]
fn the_pathspec_separator_ends_the_options() {
    assert!(!replay_options(&args(&["-m", "x", "--", "--no-verify"])).no_verify);
    assert_eq!(replay_options(&args(&["--", "-Skey"])).signing_key, None);
}

/// The signing key comes from `-S<key>`, `--gpg-sign=<key>`, and is absent for a bare `-S` or `--gpg-sign`.
#[test]
fn the_signing_key_is_read_from_every_spelling() {
    assert_eq!(replay_options(&args(&["-Sabc", "-m", "x"])).signing_key, Some(String::from("abc")));
    assert_eq!(replay_options(&args(&["--gpg-sign=def"])).signing_key, Some(String::from("def")));
    assert_eq!(replay_options(&args(&["-S"])).signing_key, None);
    assert_eq!(replay_options(&args(&["--gpg-sign"])).signing_key, None);
    assert_eq!(replay_options(&args(&["-nSabc"])).signing_key, Some(String::from("abc")));
    assert!(replay_options(&args(&["-nSabc"])).no_verify);
}

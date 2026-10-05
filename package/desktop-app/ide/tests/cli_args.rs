//! Startup grammar preserves native paths and separates parsing from project or display initialization.

/// Parse arguments through the production library entry point.
use ide_app::cli::parse_args;
/// Inspect typed clap exits without terminating the test process.
use clap::{Error, error::ErrorKind};
/// Native byte filenames must survive parsing, including paths that are not valid UTF-8.
use std::{ffi::OsString, os::unix::ffi::OsStringExt, path::Path};

/// Convert readable ASCII fixtures to owned native argv values.
fn args(values: &[&str]) -> Vec<OsString> {
    // The closure converts each borrowed literal; collect owns the resulting variable-length argv.
    return values.iter().map(|value| return OsString::from(value)).collect();
}

/// Required root and optional initial-file operands remain uninterpreted native paths during parsing.
#[test]
fn project_and_initial_file_parse_without_filesystem_access() {
    let parsed = parse_args(&args(&["/not-created/project", "--file", "src/猫.ts"])).expect("startup grammar");
    assert_eq!(parsed.project, Path::new("/not-created/project"));
    assert_eq!(parsed.file.as_deref(), Some(Path::new("src/猫.ts")));
    assert!(parse_args(&args(&["project"])).expect("project only").file.is_none());
    let dashed = parse_args(&args(&["--file=-source.rs", "--", "-project"])).expect("dash-prefixed paths");
    assert_eq!(dashed.project, Path::new("-project"));
    assert_eq!(dashed.file.as_deref(), Some(Path::new("-source.rs")));
}

/// Unix filenames are not decoded through UTF-8 or lossy UI labels.
#[test]
fn non_utf8_arguments_keep_their_original_bytes() {
    // from_vec constructs a native byte filename, unlike String which requires valid UTF-8.
    let project = OsString::from_vec(vec![b'p', 0xff]);
    let file = OsString::from_vec(vec![b'f', 0xfe]);
    // Clone retains the expected byte sequences after the argument vector takes its owned inputs.
    let parsed = parse_args(&[project.clone(), OsString::from("--file"), file.clone()]).expect("native byte paths");
    assert_eq!(parsed.project.as_os_str(), project);
    assert_eq!(parsed.file.expect("initial file").as_os_str(), file);
}

/// Help/version have success exit semantics even without a project argument.
#[test]
fn help_and_version_are_successful_parser_outcomes() {
    for (flag, kind) in [("--help", ErrorKind::DisplayHelp), ("--version", ErrorKind::DisplayVersion)] {
        let result = parse_args(&args(&[flag])).expect_err("display request");
        let cli = result.downcast_ref::<Error>().expect("typed clap result");
        assert_eq!(cli.kind(), kind);
        assert_eq!(cli.exit_code(), 0);
        assert!(!cli.use_stderr());
    }
}

/// Extra roots, repeated file selection, unknown options, and missing/empty paths are rejected.
#[test]
fn invalid_argument_shapes_are_usage_errors() {
    for values in [
        vec![],
        vec!["--unknown"],
        vec!["one", "two"],
        vec!["project", "--file"],
        vec!["project", "--file="],
        vec![""],
        vec!["project", "--file", "one", "--file", "two"],
    ] {
        let result = parse_args(&args(&values)).expect_err("invalid argv");
        let cli = result.downcast_ref::<Error>().expect("typed usage error");
        assert_eq!(cli.exit_code(), 2);
        assert!(cli.use_stderr());
    }
}

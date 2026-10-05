//! What: Differential control of the tokenizer against Git 2.56.0's own option parser.
//! Why: `git rev-parse --parseopt` runs `parse_options` over a caller-supplied table and
//!      prints the normalized result, so every single token of a broad alphabet, and every
//!      pair that starts with a context-setting token, is compared with the real binary
//!      instead of with expectations written by hand.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // for (const args of cases) expect(render(parseOptions(args))).toBe(await gitParseopt(args));
//! ```

/// The tokenizer under test, its queries and the real-Git fixture helpers.
use super::{
    Arity, Boundary, DEFAULT_MODE, OptionError, OptionErrorKind, OptionSpec, ParseMode,
    ParsedOptions, parse_options, row,
};
use crate::command_options_query::{positional_tokens, value_bytes};
use crate::command_test_support::{
    fixture, git, git_status, git_with_input, os_arguments, remove, repository,
};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Output;

/// One row per spelling, arity and negation class; identifiers are unique for rendering.
const TABLE: &[OptionSpec] = &[
    row(1, Some(b'a'), Some("all"), Arity::None, true),
    row(2, Some(b'm'), Some("message"), Arity::Required, true),
    row(
        3,
        Some(b'u'),
        Some("untracked-files"),
        Arity::Optional,
        true,
    ),
    row(4, Some(b'S'), Some("gpg-sign"), Arity::Optional, true),
    row(5, Some(b'q'), None, Arity::None, true),
    row(6, Some(b'n'), Some("no-verify"), Arity::None, true),
    row(7, None, Some("no-post-rewrite"), Arity::None, true),
    row(8, None, Some("amend"), Arity::None, true),
    row(9, None, Some("allow-empty"), Arity::None, true),
    row(10, None, Some("allow-empty-message"), Arity::None, true),
    row(11, Some(b'U'), Some("unified"), Arity::Required, false),
    row(12, None, Some("hard"), Arity::None, false),
    row(13, Some(b'i'), Some("include"), Arity::None, true),
    row(14, None, Some("interactive"), Arity::None, true),
    row(15, None, Some("inter-hunk-context"), Arity::Required, false),
    row(16, None, Some("dry-run"), Arity::None, true),
    row(17, None, Some("date"), Arity::Required, true),
    row(18, Some(b'x'), None, Arity::Required, true),
];

/// Tokens covering clusters, values, abbreviations, negation, typos, help and boundaries.
const ALPHABET: &[&str] = &[
    "-a",
    "-am",
    "-amx",
    "-ma",
    "-m",
    "-u",
    "-ua",
    "-au",
    "-qa",
    "-aq",
    "-S",
    "-Skey",
    "-x",
    "-xv",
    "-ax",
    "-U3",
    "-all",
    "-amend",
    "-no-verify",
    "-nq",
    "-h",
    "-ah",
    "-z",
    "-az",
    "-",
    "",
    "--",
    "--end-of-options",
    "file",
    "--all",
    "--al",
    "--a",
    "--am",
    "--allow-empty",
    "--allow",
    "--allow-empty-m",
    "--no-all",
    "--no-a",
    "--no",
    "--n",
    "--no-",
    "--message",
    "--message=",
    "--message=v",
    "--mess=v",
    "--no-message",
    "--no-message=v",
    "--all=1",
    "--verify",
    "--no-verify",
    "--no-no-verify",
    "--no-no-post",
    "--no-post",
    "--post-rewrite",
    "--untracked-files",
    "--untracked-files=no",
    "--unified",
    "--unified=3",
    "--no-unified",
    "--hard",
    "--no-hard",
    "--in",
    "--inc",
    "--int",
    "--inter",
    "--inter-",
    "--d",
    "--dr",
    "--da",
    "--date",
    "--help",
    "--help-all",
    "--unknown",
    "--unknown=v",
    "--=v",
    "--no-dry",
    "--no-d",
];

/// First tokens of every compared pair: each changes how Git reads the token after it
/// (a pending value, a flag, a positional or a boundary).
const CONTEXTS: &[&str] = &[
    "-a",
    "-am",
    "-ma",
    "-m",
    "-u",
    "-au",
    "-S",
    "-x",
    "-",
    "",
    "--",
    "--end-of-options",
    "file",
    "--all",
    "--no-all",
    "--message",
    "--message=v",
    "--no-message",
    "--untracked-files",
    "--unified",
    "--date",
    "--no-verify",
    "--hard",
    "--am",
    "--allow-empty",
    "--dr",
    "--inc",
];

/// A smaller alphabet for the two flag variants, which change only boundary handling.
const BOUNDARY_ALPHABET: &[&str] = &[
    "-a",
    "-m",
    "-am",
    "-u",
    "-",
    "",
    "--",
    "--end-of-options",
    "file",
    "--all",
    "--message=v",
    "--no-all",
    "--unknown",
    "-h",
];

/// How many comparisons ended in each outcome, to prove the control exercised all three.
struct Tally {
    parsed: usize,
    refused: usize,
    help: usize,
}

/// Write the table in `git rev-parse --parseopt` specification syntax.
fn specification(table: &[OptionSpec]) -> String {
    let mut text: String = String::from("fixture [<options>] [<args>...]\n--\n");
    for spec in table {
        if let Some(short) = spec.short {
            text.push(char::from(short));
            if spec.long.is_some() {
                text.push(',');
            }
        }
        if let Some(long) = spec.long {
            text.push_str(long);
        }
        if spec.arity == Arity::Required {
            text.push('=');
        }
        if spec.arity == Arity::Optional {
            text.push('?');
        }
        if !spec.negatable {
            text.push('!');
        }
        text.push_str(" help\n");
    }
    return text;
}

/// Look up the row an occurrence refers to.
fn find(table: &[OptionSpec], id: u16) -> OptionSpec {
    for spec in table {
        if spec.id == id {
            return *spec;
        }
    }
    panic!("occurrence names an identifier outside the table: {id}");
}

/// Append one value or argument in Git's `sq_quote_buf` form.
fn push_quoted(out: &mut Vec<u8>, bytes: &[u8]) {
    assert!(!bytes.contains(&b'\'') && !bytes.contains(&b'!'));
    out.push(b'\'');
    out.extend_from_slice(bytes);
    out.push(b'\'');
}

/// Render a parse exactly as `parseopt_dump` prints it in `--stuck-long` form
/// (builtin/rev-parse.c:395-412, 554-556).
fn render(
    arguments: &[OsString],
    parsed: &ParsedOptions,
    table: &[OptionSpec],
    keep_dashdash: bool,
) -> Vec<u8> {
    let mut out: Vec<u8> = b"set --".to_vec();
    for occurrence in &parsed.occurrences {
        let spec: OptionSpec = find(table, occurrence.id);
        if occurrence.negated {
            out.extend_from_slice(b" --no-");
            out.extend_from_slice(spec.long.expect("negated long option").as_bytes());
        } else if let Some(long) = spec.long {
            out.extend_from_slice(b" --");
            out.extend_from_slice(long.as_bytes());
        } else {
            out.extend_from_slice(b" -");
            out.push(spec.short.expect("short-only option"));
        }
        if let Some(value) = occurrence.value {
            if spec.long.is_some() {
                out.push(b'=');
            }
            push_quoted(&mut out, value_bytes(arguments, value));
        }
    }
    out.extend_from_slice(b" --");
    let mut positionals: Vec<usize> = positional_tokens(parsed, arguments.len());
    // `if let ... && condition` (a let chain) needs both the variant and the flag.
    if let Boundary::DashDash(at) = parsed.boundary
        && keep_dashdash
    {
        positionals.push(at);
        positionals.sort_unstable();
    }
    for token in positionals {
        out.push(b' ');
        push_quoted(&mut out, arguments[token].as_encoded_bytes());
    }
    out.push(b'\n');
    return out;
}

/// Compare one argument list with the real binary and record the outcome kind.
fn compare(
    directory: &Path,
    specification_text: &str,
    mode: ParseMode,
    keep_dashdash: bool,
    values: &[&str],
    tally: &mut Tally,
) {
    let arguments: Vec<OsString> = os_arguments(values);
    let mut command: Vec<OsString> = os_arguments(&["rev-parse", "--parseopt", "--stuck-long"]);
    if keep_dashdash {
        command.push(OsString::from("--keep-dashdash"));
    }
    if mode.stop_at_non_option {
        command.push(OsString::from("--stop-at-non-option"));
    }
    command.push(OsString::from("--"));
    command.extend(arguments.clone());
    let output: Output =
        git_with_input(directory, command.as_slice(), specification_text.as_bytes());
    let ours: Result<ParsedOptions, OptionError> =
        parse_options(arguments.as_slice(), TABLE, mode, &[]);
    if output.status.code() == Some(129) {
        let error: OptionError = ours.expect_err(&format!("Git refuses {values:?}"));
        assert_ne!(error.kind, OptionErrorKind::HelpRequested, "{values:?}");
        tally.refused += 1;
        return;
    }
    assert!(
        output.status.success(),
        "{values:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    if output.stdout.starts_with(b"cat <<") {
        let error: OptionError = ours.expect_err(&format!("Git prints usage for {values:?}"));
        assert_eq!(error.kind, OptionErrorKind::HelpRequested, "{values:?}");
        tally.help += 1;
        return;
    }
    let parsed: ParsedOptions = match ours {
        Ok(accepted) => accepted,
        Err(error) => panic!(
            "Git accepts {values:?} as {} but the tokenizer refused: {error}",
            String::from_utf8_lossy(&output.stdout)
        ),
    };
    assert_eq!(
        String::from_utf8_lossy(&render(arguments.as_slice(), &parsed, TABLE, keep_dashdash)),
        String::from_utf8_lossy(&output.stdout),
        "{values:?}"
    );
    tally.parsed += 1;
}

/// Compare every single token of `alphabet`, and every ordered pair that starts with a
/// token of `firsts`, under one flag set.
fn compare_singles_and_pairs(
    directory: &Path,
    firsts: &[&str],
    alphabet: &[&str],
    mode: ParseMode,
    keep_dashdash: bool,
) -> Tally {
    let specification_text: String = specification(TABLE);
    let mut tally: Tally = Tally {
        parsed: 0,
        refused: 0,
        help: 0,
    };
    for single in alphabet {
        compare(
            directory,
            specification_text.as_str(),
            mode,
            keep_dashdash,
            &[single],
            &mut tally,
        );
    }
    for first in firsts {
        for second in alphabet {
            compare(
                directory,
                specification_text.as_str(),
                mode,
                keep_dashdash,
                &[first, second],
                &mut tally,
            );
        }
    }
    return tally;
}

/// Flags `0`: the mode of commit, add, push, clean, branch and status.
#[test]
fn default_mode_matches_git_parse_options_on_singles_and_context_pairs() {
    let directory: PathBuf = fixture("parseopt-default");
    let tally: Tally =
        compare_singles_and_pairs(directory.as_path(), CONTEXTS, ALPHABET, DEFAULT_MODE, false);
    // Positive control: the comparison reached accepted, refused and usage outcomes.
    assert!(tally.parsed > 500, "{}", tally.parsed);
    assert!(tally.refused > 300, "{}", tally.refused);
    assert!(tally.help > 50, "{}", tally.help);
    remove(directory.as_path());
}

/// `PARSE_OPT_LASTARG_DEFAULT` has no `--parseopt` spelling, so `git branch --contains`
/// (parse-options.h:615-625) is observed directly.
#[test]
fn last_argument_default_matches_git_branch_contains() {
    let directory: PathBuf = fixture("lastarg-default");
    let root: PathBuf = repository(directory.as_path(), "repository");
    let table: &[OptionSpec] = &[
        row(1, None, Some("contains"), Arity::LastArgDefault, false),
        row(2, Some(b'v'), Some("verbose"), Arity::None, true),
    ];
    // Last argument: Git uses the default `HEAD` and lists the branch.
    let last: Output = git(root.as_path(), &["branch", "--contains"]);
    assert!(String::from_utf8_lossy(&last.stdout).contains("main"));
    let last_parsed: ParsedOptions = parse_options(
        os_arguments(&["--contains"]).as_slice(),
        table,
        DEFAULT_MODE,
        &[],
    )
    .expect("valid region");
    assert_eq!(last_parsed.occurrences[0].value, None);
    // Followed by a dash-led token: Git reads the token as the commit, not as `-v`.
    let followed: Output = git_status(root.as_path(), &["branch", "--contains", "-v"]);
    assert!(!followed.status.success());
    assert!(
        String::from_utf8_lossy(&followed.stderr).contains("malformed object name -v"),
        "{}",
        String::from_utf8_lossy(&followed.stderr)
    );
    let followed_parsed: ParsedOptions = parse_options(
        os_arguments(&["--contains", "-v"]).as_slice(),
        table,
        DEFAULT_MODE,
        &[],
    )
    .expect("valid region");
    assert_eq!(followed_parsed.occurrences.len(), 1);
    assert!(followed_parsed.occurrences[0].value.is_some());
    remove(directory.as_path());
}

/// `PARSE_OPT_KEEP_DASHDASH`: the mode of reset, checkout and stash subcommands.
#[test]
fn keep_dashdash_mode_matches_git_parse_options() {
    let directory: PathBuf = fixture("parseopt-keep-dashdash");
    let tally: Tally = compare_singles_and_pairs(
        directory.as_path(),
        BOUNDARY_ALPHABET,
        BOUNDARY_ALPHABET,
        DEFAULT_MODE,
        true,
    );
    assert!(tally.parsed > 50 && tally.refused > 20 && tally.help > 10);
    remove(directory.as_path());
}

/// `PARSE_OPT_STOP_AT_NON_OPTION`: the mode of an assumed `git stash push`.
#[test]
fn stop_at_non_option_mode_matches_git_parse_options() {
    let directory: PathBuf = fixture("parseopt-stop");
    let mode: ParseMode = ParseMode {
        keep_unknown: false,
        stop_at_non_option: true,
    };
    let tally: Tally = compare_singles_and_pairs(
        directory.as_path(),
        BOUNDARY_ALPHABET,
        BOUNDARY_ALPHABET,
        mode,
        true,
    );
    assert!(tally.parsed > 50 && tally.refused > 10 && tally.help > 5);
    remove(directory.as_path());
}

/// Longer sequences mixing every feature, as a third layer over singles and pairs.
#[test]
fn curated_sequences_match_git_parse_options() {
    let directory: PathBuf = fixture("parseopt-curated");
    let specification_text: String = specification(TABLE);
    let mut tally: Tally = Tally {
        parsed: 0,
        refused: 0,
        help: 0,
    };
    for values in [
        vec!["-am", "msg", "file", "--", "-a"],
        vec!["file", "-m", "-a", "--no-all", "--all", "other"],
        vec!["-qnam", "--", "x"],
        vec!["--mess", "--", "--", "y"],
        vec!["-u", "no", "-uno", "--untracked-files=", "z"],
        vec!["--inter-hunk-context", "3", "--inter-hunk=4", "-U", "5"],
        vec!["--no-date", "x", "--date", "--no-date"],
        vec!["-x", "-a", "-xa", "--end-of-options", "-a"],
        vec!["--no-verify", "--verify", "--no-no-verify", "-n"],
        vec!["a", "b", "--amend", "--no-amend", "-", "", "c"],
        vec!["-S", "key", "-Skey", "--gpg-sign", "key", "--gpg-sign=key"],
        vec!["-m", "--help", "-m", "-h", "x"],
        vec!["file", "--unknown"],
        vec!["-a", "-m"],
        vec!["x", "y", "-ah"],
    ] {
        compare(
            directory.as_path(),
            specification_text.as_str(),
            DEFAULT_MODE,
            false,
            values.as_slice(),
            &mut tally,
        );
    }
    assert_eq!((tally.parsed, tally.refused, tally.help), (12, 2, 1));
    remove(directory.as_path());
}

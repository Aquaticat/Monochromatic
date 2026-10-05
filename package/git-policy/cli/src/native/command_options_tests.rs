//! What: Tokenizer cases over synthetic tables, including every ported `argv.unit.test.ts` case.
//! Why: Each branch of the short, long and value rules needs a case that fails when the
//!      branch is removed; real-Git agreement is checked in `command_options_git_tests.rs`.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(parseArgv({ args, spec })).toEqual(...)
//! ```

/// The tokenizer under test, its queries and the shared argument builders.
use super::{
    Arity, Boundary, DEFAULT_MODE, Occurrence, OptionError, OptionErrorKind, OptionSpec,
    OptionValue, ParseMode, ParsedOptions, WrapperOccurrence, parse_options, row,
};
use crate::command_options_query::{
    has_wrapper_flag, is_enabled, is_stated, last_occurrence, positional_tokens, value_bytes,
    without_tokens,
};
use crate::command_test_support::{assert_table_invariants, os_arguments};
use std::ffi::OsString;

/// Identifiers of the synthetic rows.
const ALL: u16 = 1;
const MESSAGE: u16 = 2;
const UNTRACKED: u16 = 3;
const CONTAINS: u16 = 4;
const HARD: u16 = 5;
const NO_VERIFY: u16 = 6;
const AMEND: u16 = 7;
const ALLOW_EMPTY: u16 = 8;
const ALLOW_EMPTY_MESSAGE: u16 = 9;

/// The declared surface of the incumbent `argv.unit.test.ts`: one flag and one value option.
const INCUMBENT_TABLE: &[OptionSpec] = &[
    row(ALL, Some(b'a'), Some("all"), Arity::None, true),
    row(MESSAGE, Some(b'm'), Some("message"), Arity::Required, true),
];

/// One row per arity and negation class Git has.
const TABLE: &[OptionSpec] = &[
    row(ALL, Some(b'a'), Some("all"), Arity::None, true),
    row(MESSAGE, Some(b'm'), Some("message"), Arity::Required, true),
    row(
        UNTRACKED,
        Some(b'u'),
        Some("untracked-files"),
        Arity::Optional,
        true,
    ),
    row(
        CONTAINS,
        None,
        Some("contains"),
        Arity::LastArgDefault,
        false,
    ),
    row(HARD, None, Some("hard"), Arity::None, false),
    row(NO_VERIFY, Some(b'n'), Some("no-verify"), Arity::None, true),
    row(AMEND, None, Some("amend"), Arity::None, true),
    row(ALLOW_EMPTY, None, Some("allow-empty"), Arity::None, true),
    row(
        ALLOW_EMPTY_MESSAGE,
        None,
        Some("allow-empty-message"),
        Arity::None,
        true,
    ),
];

/// Git's `PARSE_OPT_KEEP_UNKNOWN_OPT`.
const KEEP_UNKNOWN: ParseMode = ParseMode {
    keep_unknown: true,
    stop_at_non_option: false,
};

/// Git's `PARSE_OPT_STOP_AT_NON_OPTION`.
const STOP_AT_NON_OPTION: ParseMode = ParseMode {
    keep_unknown: false,
    stop_at_non_option: true,
};

/// Tokenize text arguments against the full synthetic table with default flags.
fn parse(values: &[&str]) -> Result<ParsedOptions, OptionError> {
    return parse_options(os_arguments(values).as_slice(), TABLE, DEFAULT_MODE, &[]);
}

/// Tokenize against the incumbent test's two-row table.
fn parse_incumbent(values: &[&str]) -> Result<ParsedOptions, OptionError> {
    return parse_options(
        os_arguments(values).as_slice(),
        INCUMBENT_TABLE,
        DEFAULT_MODE,
        &[],
    );
}

/// Shorthand for one expected occurrence.
fn occurrence(id: u16, negated: bool, value: Option<OptionValue>, token: usize) -> Occurrence {
    return Occurrence {
        id,
        negated,
        value,
        token,
    };
}

/// Shorthand for an expected refusal.
fn refusal(kind: OptionErrorKind, token: usize) -> Result<ParsedOptions, OptionError> {
    return Err(OptionError { kind, token });
}

/// Ported: "takes a declared option value and keeps following positionals".
#[test]
fn takes_a_declared_option_value_and_keeps_following_positionals() {
    let parsed: ParsedOptions = parse_incumbent(&["-m", "msg", "a.txt"]).expect("valid region");
    assert_eq!(
        parsed.occurrences,
        vec![occurrence(
            MESSAGE,
            false,
            Some(OptionValue::Detached { token: 1 }),
            0
        )]
    );
    assert_eq!(parsed.leading, vec![2]);
}

/// Ported: "counts a declared flag ..." and "counts every repeated declared flag occurrence".
#[test]
fn counts_declared_flags_without_consuming_positionals() {
    let single: ParsedOptions = parse_incumbent(&["-a", "a.txt", "b.txt"]).expect("valid region");
    assert_eq!(single.occurrences, vec![occurrence(ALL, false, None, 0)]);
    assert_eq!(single.leading, vec![1, 2]);
    let repeated: ParsedOptions = parse_incumbent(&["-a", "-a"]).expect("valid region");
    assert_eq!(repeated.occurrences.len(), 2);
    assert!(repeated.leading.is_empty());
}

/// Divergence from four incumbent cases: Git 2.56.0 refuses an undeclared option; it never
/// lets one consume a following plain token (parse-options.c:1164-1165, 1224-1233).
#[test]
fn refuses_an_undeclared_option_as_git_does() {
    for values in [
        vec!["-q", "a.txt"],
        vec!["-q", "-a"],
        vec!["-q", "--", "a.txt"],
        vec!["-q"],
        vec!["--unknown=v", "a.txt"],
        vec!["--unknown"],
    ] {
        assert_eq!(
            parse_incumbent(values.as_slice()),
            refusal(OptionErrorKind::UnknownOption, 0),
            "{values:?}"
        );
    }
    assert_eq!(
        parse_incumbent(&["-a", "-aq"]),
        refusal(OptionErrorKind::UnknownOption, 1)
    );
}

/// Under Git's keep-unknown flag an undeclared option is kept and consumes nothing.
#[test]
fn keeps_an_undeclared_option_without_consuming_the_next_token() {
    for values in [vec!["-q", "a.txt"], vec!["--unknown=v", "a.txt"]] {
        let parsed: ParsedOptions = parse_options(
            os_arguments(values.as_slice()).as_slice(),
            INCUMBENT_TABLE,
            KEEP_UNKNOWN,
            &[],
        )
        .expect("kept region");
        assert_eq!(parsed.unknown, vec![0], "{values:?}");
        assert_eq!(parsed.leading, vec![1], "{values:?}");
    }
    // A known letter before an unknown one still takes effect; the token is kept once.
    let mixed: ParsedOptions = parse_options(
        os_arguments(&["-aq"]).as_slice(),
        INCUMBENT_TABLE,
        KEEP_UNKNOWN,
        &[],
    )
    .expect("kept region");
    assert_eq!(mixed.occurrences, vec![occurrence(ALL, false, None, 0)]);
    assert_eq!(mixed.unknown, vec![0]);
    // Abbreviations are disabled under keep-unknown (parse-options.c:502-503).
    let abbreviated: ParsedOptions = parse_options(
        os_arguments(&["--mess=x", "--message=y"]).as_slice(),
        INCUMBENT_TABLE,
        KEEP_UNKNOWN,
        &[],
    )
    .expect("kept region");
    assert_eq!(abbreviated.unknown, vec![0]);
    assert_eq!(abbreviated.occurrences.len(), 1);
}

/// Ported: "takes a declared joined option value"; also the empty joined value.
#[test]
fn takes_a_declared_joined_option_value() {
    let arguments: Vec<OsString> = os_arguments(&["--message=msg", "a.txt", "--message="]);
    let parsed: ParsedOptions =
        parse_options(arguments.as_slice(), INCUMBENT_TABLE, DEFAULT_MODE, &[])
            .expect("valid region");
    let first: OptionValue = parsed.occurrences[0].value.expect("joined value");
    assert_eq!(
        first,
        OptionValue::Attached {
            token: 0,
            offset: 10
        }
    );
    assert_eq!(value_bytes(arguments.as_slice(), first), b"msg");
    let empty: OptionValue = parsed.occurrences[1].value.expect("empty joined value");
    assert_eq!(value_bytes(arguments.as_slice(), empty), b"");
    assert_eq!(parsed.leading, vec![1]);
}

/// Ported: "names the offending token and region when refusing" and
/// "refuses a declared option missing its value".
#[test]
fn names_the_offending_token_when_a_value_is_missing() {
    assert_eq!(
        parse_incumbent(&["-a", "-m"]),
        refusal(OptionErrorKind::MissingValue, 1)
    );
    assert_eq!(
        parse_incumbent(&["-m"]),
        refusal(OptionErrorKind::MissingValue, 0)
    );
    assert_eq!(
        parse_incumbent(&["--message"]),
        refusal(OptionErrorKind::MissingValue, 0)
    );
    let error: OptionError = parse_incumbent(&["-a", "-m"]).expect_err("refused region");
    assert!(error.to_string().contains("argument 1"), "{error}");
    assert!(error.to_string().contains("MissingValue"), "{error}");
}

/// Ported: "takes a dash-led token as a declared option value".
#[test]
fn takes_a_dash_led_token_as_a_declared_option_value() {
    let parsed: ParsedOptions = parse_incumbent(&["-m", "-a"]).expect("valid region");
    assert_eq!(
        parsed.occurrences,
        vec![occurrence(
            MESSAGE,
            false,
            Some(OptionValue::Detached { token: 1 }),
            0
        )]
    );
    let terminator: ParsedOptions = parse_incumbent(&["-m", "--", "x"]).expect("valid region");
    assert_eq!(terminator.boundary, Boundary::End);
    assert_eq!(terminator.leading, vec![2]);
}

/// Ported: "parses declared options appearing after positionals", "treats a lone dash as
/// positional", "treats every token after the terminator as positional" and
/// "parses declared flags before the terminator".
#[test]
fn separates_options_positionals_and_the_terminator() {
    let after: ParsedOptions = parse_incumbent(&["a.txt", "-m", "msg"]).expect("valid region");
    assert_eq!(after.leading, vec![0]);
    assert_eq!(after.occurrences.len(), 1);
    let dash: ParsedOptions = parse_incumbent(&["-", ""]).expect("valid region");
    assert_eq!(dash.leading, vec![0, 1]);
    let terminated: ParsedOptions = parse_incumbent(&["--", "-a"]).expect("valid region");
    assert!(terminated.occurrences.is_empty());
    assert_eq!(terminated.boundary, Boundary::DashDash(0));
    assert_eq!(positional_tokens(&terminated, 2), vec![1]);
    let before: ParsedOptions = parse_incumbent(&["-a", "--", "a.txt"]).expect("valid region");
    assert_eq!(before.occurrences, vec![occurrence(ALL, false, None, 0)]);
    assert_eq!(positional_tokens(&before, 3), vec![2]);
}

/// Ported as a table invariant: "rejects a declared spelling that cannot introduce an option".
#[test]
#[should_panic(expected = "nodash")]
fn rejects_a_declared_spelling_that_cannot_introduce_an_option() {
    assert_table_invariants(&[row(ALL, None, Some("-nodash"), Arity::None, true)]);
}

/// Duplicate letters and names are table defects, as in Git's `parse_options_check`.
#[test]
#[should_panic(expected = "duplicate short")]
fn rejects_a_table_with_a_repeated_short_letter() {
    assert_table_invariants(&[
        row(ALL, Some(b'a'), Some("all"), Arity::None, true),
        row(AMEND, Some(b'a'), Some("amend"), Arity::None, true),
    ]);
}

/// The synthetic tables satisfy the invariants they are used to demonstrate.
#[test]
fn synthetic_tables_are_well_formed() {
    assert_table_invariants(TABLE);
    assert_table_invariants(INCUMBENT_TABLE);
}

/// A value-taking letter ends the cluster; an optional value never takes the next token.
#[test]
fn reads_short_clusters_by_arity() {
    let detached: ParsedOptions = parse(&["-am", "msg"]).expect("valid region");
    assert_eq!(
        detached.occurrences,
        vec![
            occurrence(ALL, false, None, 0),
            occurrence(MESSAGE, false, Some(OptionValue::Detached { token: 1 }), 0),
        ]
    );
    let attached: ParsedOptions = parse(&["-amhello", "x"]).expect("valid region");
    assert_eq!(
        attached.occurrences[1].value,
        Some(OptionValue::Attached {
            token: 0,
            offset: 3
        })
    );
    assert_eq!(attached.leading, vec![1]);
    // `-ma`: `a` is the message, not `--all`.
    let value_letter: ParsedOptions = parse(&["-ma"]).expect("valid region");
    assert!(!is_stated(&value_letter, ALL));
    // `-ua`: `a` is the optional value; `-au x`: `x` stays positional.
    let optional_attached: ParsedOptions = parse(&["-ua", "x"]).expect("valid region");
    assert!(!is_stated(&optional_attached, ALL));
    assert_eq!(optional_attached.leading, vec![1]);
    let optional_bare: ParsedOptions = parse(&["-au", "x"]).expect("valid region");
    assert!(is_enabled(&optional_bare, ALL));
    assert_eq!(optional_bare.occurrences[1].value, None);
    assert_eq!(optional_bare.leading, vec![1]);
    let flags: ParsedOptions = parse(&["-na"]).expect("valid region");
    assert!(is_enabled(&flags, NO_VERIFY) && is_enabled(&flags, ALL));
}

/// Git refuses letters that spell a long option, and reads `h` as a usage request.
#[test]
fn refuses_single_dash_long_spellings_and_reads_help() {
    for values in [
        vec!["-all"],
        vec!["-amend"],
        vec!["-no-verify"],
        vec!["-hard"],
    ] {
        assert_eq!(
            parse(values.as_slice()),
            refusal(OptionErrorKind::SingleDashLongOption, 0),
            "{values:?}"
        );
    }
    // Two letters are too short for the typo check.
    assert!(parse(&["-an"]).is_ok());
    for values in [
        vec!["-h"],
        vec!["-ah"],
        vec!["-h", "x"],
        vec!["--help"],
        vec!["--help-all"],
        vec!["--git-completion-helper"],
        vec!["--git-completion-helper-all"],
    ] {
        assert_eq!(
            parse(values.as_slice()),
            refusal(OptionErrorKind::HelpRequested, 0),
            "{values:?}"
        );
    }
    // The completion request is special only when it is the sole argument.
    assert_eq!(
        parse(&["-a", "--git-completion-helper"]),
        refusal(OptionErrorKind::UnknownOption, 1)
    );
    assert_eq!(parse(&["-ax"]), refusal(OptionErrorKind::UnknownOption, 0));
    assert_eq!(
        parse(&["-xall"]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
}

/// Unique prefixes resolve; shared prefixes are ambiguous unless a name matches exactly.
#[test]
fn resolves_long_abbreviations_like_git() {
    let abbreviated: ParsedOptions = parse(&["--am", "--mess=x", "--untracked=no"]).expect("ok");
    assert!(is_enabled(&abbreviated, AMEND));
    assert_eq!(
        abbreviated.occurrences[1].value,
        Some(OptionValue::Attached {
            token: 1,
            offset: 7
        })
    );
    assert_eq!(
        abbreviated.occurrences[2].value,
        Some(OptionValue::Attached {
            token: 2,
            offset: 12
        })
    );
    for values in [
        vec!["--a"],
        vec!["--allow"],
        vec!["--allow-"],
        vec!["--n"],
        vec!["--no"],
        vec!["--no-"],
        vec!["--no-a"],
        vec!["--=x"],
    ] {
        assert_eq!(
            parse(values.as_slice()),
            refusal(OptionErrorKind::AmbiguousOption, 0),
            "{values:?}"
        );
    }
    let exact: ParsedOptions = parse(&["--allow-empty", "--allow-empty-m"]).expect("ok");
    assert!(is_enabled(&exact, ALLOW_EMPTY));
    assert!(is_enabled(&exact, ALLOW_EMPTY_MESSAGE));
    // An exact match later in the table wins over an earlier abbreviation candidate.
    let reordered: &[OptionSpec] = &[
        row(
            ALLOW_EMPTY_MESSAGE,
            None,
            Some("allow-empty-message"),
            Arity::None,
            true,
        ),
        row(ALLOW_EMPTY, None, Some("allow-empty"), Arity::None, true),
    ];
    let later_exact: ParsedOptions = parse_options(
        os_arguments(&["--allow-empty"]).as_slice(),
        reordered,
        DEFAULT_MODE,
        &[],
    )
    .expect("exact match");
    assert!(is_enabled(&later_exact, ALLOW_EMPTY));
    assert!(!is_stated(&later_exact, ALLOW_EMPTY_MESSAGE));
}

/// `--no-`, a `no-` row reached positively, `--no-no-`, and options that refuse negation.
#[test]
fn applies_git_negation_rules() {
    let negated: ParsedOptions = parse(&["--all", "--no-all", "--no-am"]).expect("ok");
    assert!(is_stated(&negated, ALL) && !is_enabled(&negated, ALL));
    assert_eq!(
        last_occurrence(&negated, AMEND),
        Some(occurrence(AMEND, true, None, 2))
    );
    let verify: ParsedOptions = parse(&["--no-verify"]).expect("ok");
    assert!(is_enabled(&verify, NO_VERIFY));
    let positive: ParsedOptions = parse(&["--verify"]).expect("ok");
    assert!(!is_enabled(&positive, NO_VERIFY));
    let double: ParsedOptions = parse(&["--no-no-verify"]).expect("ok");
    assert!(is_stated(&double, NO_VERIFY) && !is_enabled(&double, NO_VERIFY));
    assert_eq!(
        parse(&["--no-hard"]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
    assert_eq!(
        parse(&["--no-no-all"]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
    assert_eq!(
        parse(&["--no-contains"]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
    // A single negatable row makes the very short negation unambiguous.
    let only_all: &[OptionSpec] = &[row(ALL, Some(b'a'), Some("all"), Arity::None, true)];
    let very_short: ParsedOptions = parse_options(
        os_arguments(&["--no"]).as_slice(),
        only_all,
        DEFAULT_MODE,
        &[],
    )
    .expect("unique negation");
    assert_eq!(very_short.occurrences, vec![occurrence(ALL, true, None, 0)]);
}

/// Values on flags and on negated options are refused; a negated value option reads no value.
#[test]
fn refuses_unexpected_values_and_never_reads_one_for_negation() {
    assert_eq!(
        parse(&["--all=1"]),
        refusal(OptionErrorKind::UnexpectedValue, 0)
    );
    assert_eq!(
        parse(&["--no-message=x"]),
        refusal(OptionErrorKind::UnexpectedValue, 0)
    );
    let unset: ParsedOptions = parse(&["--no-message", "x"]).expect("ok");
    assert_eq!(unset.occurrences, vec![occurrence(MESSAGE, true, None, 0)]);
    assert_eq!(unset.leading, vec![1]);
    let optional: ParsedOptions = parse(&["--untracked-files", "no"]).expect("ok");
    assert_eq!(optional.occurrences[0].value, None);
    assert_eq!(optional.leading, vec![1]);
}

/// `PARSE_OPT_LASTARG_DEFAULT`: a value unless the option ends the region.
#[test]
fn reads_last_argument_default_options() {
    let last: ParsedOptions = parse(&["--contains"]).expect("ok");
    assert_eq!(last.occurrences, vec![occurrence(CONTAINS, false, None, 0)]);
    let followed: ParsedOptions = parse(&["--contains", "-a"]).expect("ok");
    assert_eq!(
        followed.occurrences,
        vec![occurrence(
            CONTAINS,
            false,
            Some(OptionValue::Detached { token: 1 }),
            0
        )]
    );
    let joined: ParsedOptions = parse(&["--contains=x", "y"]).expect("ok");
    assert_eq!(joined.leading, vec![1]);
}

/// `--end-of-options` and stop-at-non-option end option parsing at different tokens.
#[test]
fn reports_each_boundary_kind() {
    let end: ParsedOptions = parse(&["--end-of-options", "-a"]).expect("ok");
    assert_eq!(end.boundary, Boundary::EndOfOptions(0));
    assert_eq!(positional_tokens(&end, 2), vec![1]);
    let stopped: ParsedOptions = parse_options(
        os_arguments(&["-a", "file", "-a", "--"]).as_slice(),
        TABLE,
        STOP_AT_NON_OPTION,
        &[],
    )
    .expect("ok");
    assert_eq!(stopped.boundary, Boundary::NonOption(1));
    assert_eq!(stopped.occurrences.len(), 1);
    assert_eq!(positional_tokens(&stopped, 4), vec![1, 2, 3]);
    let complete: ParsedOptions = parse(&["x", "-a"]).expect("ok");
    assert_eq!(complete.boundary, Boundary::End);
    assert_eq!(positional_tokens(&complete, 2), vec![0]);
}

/// A wrapper-only flag counts only where Git would look for an option.
#[test]
fn finds_wrapper_flags_in_option_position_only() {
    let arguments: Vec<OsString> = os_arguments(&[
        "--no-enforce-only",
        "-m",
        "--no-enforce-only",
        "--cli-git-keep-going",
        "--",
        "--no-enforce-only",
    ]);
    let wrapper: &[&[u8]] = &[b"--cli-git-keep-going", b"--no-enforce-only"];
    let parsed: ParsedOptions =
        parse_options(arguments.as_slice(), TABLE, DEFAULT_MODE, wrapper).expect("ok");
    assert_eq!(
        parsed.wrapper,
        vec![
            WrapperOccurrence { flag: 1, token: 0 },
            WrapperOccurrence { flag: 0, token: 3 },
        ]
    );
    assert!(has_wrapper_flag(&parsed, 0) && has_wrapper_flag(&parsed, 1));
    assert_eq!(positional_tokens(&parsed, arguments.len()), vec![5]);
    // Without the wrapper list the same token is an option Git does not know.
    assert_eq!(
        parse(&["--no-enforce-only"]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
    // Removal is by position: the message value and the path keep their spelling.
    let mut full: Vec<OsString> = os_arguments(&["-C", "/r", "commit"]);
    full.extend(arguments.clone());
    let stripped: Vec<OsString> = without_tokens(full.as_slice(), 3, &[0, 3]);
    assert_eq!(
        stripped,
        os_arguments(&[
            "-C",
            "/r",
            "commit",
            "-m",
            "--no-enforce-only",
            "--",
            "--no-enforce-only"
        ])
    );
    assert!(!has_wrapper_flag(
        &parse(&["-a"]).expect("no wrapper flag"),
        0
    ));
}

/// Bytes that are not UTF-8 pass through as values and paths without being decoded.
#[cfg(unix)]
#[test]
fn keeps_non_utf8_bytes_in_values_and_paths() {
    use crate::command_test_support::byte_argument;
    let arguments: Vec<OsString> = vec![
        byte_argument(b"-m\xff\xfe"),
        byte_argument(b"--message=\xff"),
        byte_argument(b"path-\xff"),
        OsString::from("-m"),
        byte_argument(b"\x80"),
    ];
    let snapshot: Vec<OsString> = arguments.clone();
    let parsed: ParsedOptions =
        parse_options(arguments.as_slice(), TABLE, DEFAULT_MODE, &[]).expect("ok");
    let values: Vec<&[u8]> = vec![
        value_bytes(
            arguments.as_slice(),
            parsed.occurrences[0].value.expect("v"),
        ),
        value_bytes(
            arguments.as_slice(),
            parsed.occurrences[1].value.expect("v"),
        ),
        value_bytes(
            arguments.as_slice(),
            parsed.occurrences[2].value.expect("v"),
        ),
    ];
    assert_eq!(values, vec![&b"\xff\xfe"[..], &b"\xff"[..], &b"\x80"[..]]);
    assert_eq!(parsed.leading, vec![2]);
    assert_eq!(arguments, snapshot);
    // A non-ASCII byte in letter position is an unknown switch, not a panic.
    assert_eq!(
        parse_options(&[byte_argument(b"-\xff")], TABLE, DEFAULT_MODE, &[]),
        refusal(OptionErrorKind::UnknownOption, 0)
    );
}

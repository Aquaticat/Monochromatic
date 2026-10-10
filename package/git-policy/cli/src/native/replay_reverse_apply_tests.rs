//! Controls for the strict reverse check:
//!  hand-written anchoring and matching cases, and a seeded differential run against
//!  `git apply --reverse --check` on the same real repository bytes.

use super::*;
use crate::replay_patch::{PatchHunk, parse_indexed_patch, split_keeping_newlines};
use crate::test_support::{fixture, git, git_output, remove, repository};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Writes `base` then `landed` as entry `0` of a repository in `directory` and returns the raw patch
///  `git diff-tree -p --text` prints between their trees.
fn patch_between(directory: &Path, base: &[u8], landed: &[u8], context: u32) -> Vec<u8> {
    let repo: PathBuf = repository(directory, "repo");
    std::fs::write(repo.join("0"), base).expect("base entry");
    git(repo.as_path(), &["add", "--", "0"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=base"]);
    std::fs::write(repo.join("0"), landed).expect("landed entry");
    git(repo.as_path(), &["add", "--", "0"]);
    git(repo.as_path(), &["commit", "--quiet", "--message=landed"]);
    let unified: String = format!("--unified={context}");
    return git(
        repo.as_path(),
        &[
            "diff-tree",
            "-p",
            "--text",
            "--no-renames",
            "--no-ext-diff",
            "--no-color",
            unified.as_str(),
            "--src-prefix=a/",
            "--dst-prefix=b/",
            "HEAD~1^{tree}",
            "HEAD^{tree}",
        ],
    )
    .stdout;
}

/// Hunks of entry `0` for one change, parsed as replay parses them.
fn hunks_between(name: &str, base: &[u8], landed: &[u8], context: u32) -> Vec<PatchHunk> {
    let root: PathBuf = fixture(name);
    let patch: Vec<u8> = patch_between(root.as_path(), base, landed, context);
    remove(root.as_path());
    let files: BTreeMap<Vec<u8>, Vec<PatchHunk>> = parse_indexed_patch(&patch).expect("patch");
    return files.get(b"0".as_slice()).cloned().unwrap_or_default();
}

/// A landed edit already present in the prepared bytes reverses; a different prepared line does not.
#[test]
fn a_landed_edit_reverses_only_on_its_own_bytes() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-own-bytes", b"a\nb\nc\n", b"a\nX\nc\n", 3);
    assert!(reverse_applies(&hunks, b"a\nX\nc\n"));
    assert!(!reverse_applies(&hunks, b"a\nY\nc\n"));
}

/// An empty list of hunks reverses trivially.
#[test]
fn no_hunks_always_reverse() {
    assert!(reverse_applies(&[], b"anything\n"));
    assert!(reverse_applies(&[], b""));
}

/// An own edit directly next to the landed edit sits in its context,
///  so the strict check with full context rejects it.
#[test]
fn an_adjacent_own_edit_is_rejected_by_strict_context() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-adjacent", b"a\nb\nc\nd\n", b"a\nB\nc\nd\n", 3);
    assert!(!reverse_applies(&hunks, b"a\nB\nC\nd\n"));
}

/// A far-apart own edit leaves the landed hunk's context intact and reverses.
#[test]
fn a_far_apart_own_edit_reverses() {
    let base: Vec<u8> = (1..=12).map(|number| format!("line {number}\n")).collect::<String>().into_bytes();
    let landed: Vec<u8> = String::from_utf8_lossy(&base).replace("line 2\n", "LANDED\n").into_bytes();
    let prepared: Vec<u8> = String::from_utf8_lossy(&landed).replace("line 11\n", "OWN\n").into_bytes();
    let hunks: Vec<PatchHunk> = hunks_between("reverse-far-apart", &base, &landed, 3);
    assert!(reverse_applies(&hunks, &prepared));
    assert!(!reverse_applies(&hunks, &base));
}

/// A hunk starting at line 1 must match at the start of the file.
#[test]
fn a_hunk_at_the_first_line_is_anchored_at_the_start() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-first-line", b"x\ny\n", b"y\n", 3);
    assert!(reverse_applies(&hunks, b"y\n"));
    assert!(!reverse_applies(&hunks, b"z\ny\n"));
}

/// A hunk whose last line is a change must match at the end of the file.
#[test]
fn a_hunk_at_the_last_line_is_anchored_at_the_end() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-last-line", b"a\n", b"a\nb\n", 3);
    assert!(reverse_applies(&hunks, b"a\nb\n"));
    assert!(!reverse_applies(&hunks, b"a\nb\nc\n"));
}

/// A deletion whose last removed line closes the file reverses only on the exact tail.
#[test]
fn a_trailing_deletion_reverses_on_the_exact_tail() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-trailing-deletion", b"a\nb\n", b"a\n", 3);
    assert!(reverse_applies(&hunks, b"a\n"));
    assert!(!reverse_applies(&hunks, b"a\nq\n"));
}

/// An incomplete last line matches by content, but not against a line that gained a newline
///  when the hunk is anchored at the end.
#[test]
fn an_incomplete_last_line_matches_by_content_at_the_end() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-incomplete", b"a\nb", b"a\nc", 3);
    assert!(reverse_applies(&hunks, b"a\nc"));
    assert!(!reverse_applies(&hunks, b"a\nc\n"));
}

/// An incomplete preimage line that is not at the hunk's end matches an image line
///  with the same content plus whitespace and a newline, as Git's quick hash check allows.
#[test]
fn an_incomplete_preimage_line_matches_past_whitespace_when_not_anchored() {
    let hunks: Vec<PatchHunk> = hunks_between("reverse-whitespace", b"x\nb", b"y\nb", 3);
    assert!(reverse_applies(&hunks, b"y\nb \n"));
    assert!(!reverse_applies(&hunks, b"y\nc\n"));
}

/// Hunks that already wrote a line cannot match it again.
#[test]
fn patched_lines_are_not_matched_twice() {
    let line: ImageLine = ImageLine {
        text: b"same\n".to_vec(),
        patched: true,
    };
    assert!(!line_matches(&line, b"same\n", false, false));
}

/// A fixed xorshift stream, so every run sees the same cases.
struct Seeded {
    /// Generator state; never zero.
    state: u64,
}

impl Seeded {
    /// Next pseudo-random number.
    fn next_value(&mut self) -> u64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        return self.state;
    }

    /// A number below `bound`, which is at least one.
    fn below(&mut self, bound: usize) -> usize {
        let modulus: u64 = u64::try_from(bound.max(1)).unwrap_or(1);
        return usize::try_from(self.next_value() % modulus).unwrap_or(0);
    }
}

/// Lines the generator draws from:
///  repeated lines, a whitespace-only variant, an empty line, and a line without its newline.
const ALPHABET: [&[u8]; 6] = [b"a\n", b"b\n", b"\n", b" b\n", b"a", b"c\n"];

/// Random text of up to `limit` lines drawn from the alphabet.
fn random_text(random: &mut Seeded, limit: usize) -> Vec<u8> {
    let count: usize = 1 + random.below(limit);
    let mut text: Vec<u8> = Vec::new();
    for _ in 0..count {
        text.extend_from_slice(ALPHABET[random.below(ALPHABET.len())]);
    }
    return text;
}

/// A text made from `base` by one or two random line edits.
fn edit_lines(random: &mut Seeded, base: &[u8]) -> Vec<u8> {
    // `mut` lets each edit change the lines in turn.
    let mut lines: Vec<Vec<u8>> = split_keeping_newlines(base);
    for _ in 0..(1 + random.below(2)) {
        let position: usize = random.below(lines.len() + 1);
        let replacement: Vec<u8> = ALPHABET[random.below(ALPHABET.len())].to_vec();
        match (random.below(3), position < lines.len()) {
            (0, true) => {
                lines.remove(position);
            }
            (1, true) => {
                lines[position] = replacement;
            }
            _ => {
                lines.insert(position, replacement);
            }
        }
    }
    return lines.concat();
}

/// The strict check agrees with `git apply --reverse --check` on every seeded case,
///  and both outcomes occur, so the agreement is not vacuous.
#[test]
fn strict_reverse_agrees_with_git_apply_on_seeded_cases() {
    let mut random: Seeded = Seeded {
        state: 0x9E37_79B9_7F4A_7C15,
    };
    let (mut applied, mut rejected): (usize, usize) = (0, 0);
    let root: PathBuf = fixture("reverse-differential");
    for case in 0..120 {
        let base: Vec<u8> = random_text(&mut random, 8);
        let landed: Vec<u8> = edit_lines(&mut random, &base);
        if landed == base {
            continue;
        }
        let prepared: Vec<u8> = if random.below(2) == 0 {
            landed.clone()
        } else {
            edit_lines(&mut random, &landed)
        };
        let case_directory: PathBuf = root.join(format!("case-{case}"));
        std::fs::create_dir(&case_directory).expect("case directory");
        let patch: Vec<u8> = patch_between(case_directory.as_path(), &base, &landed, 3);
        let files: BTreeMap<Vec<u8>, Vec<PatchHunk>> = parse_indexed_patch(&patch).expect("patch");
        let hunks: Vec<PatchHunk> = files.get(b"0".as_slice()).cloned().unwrap_or_default();
        let ours: bool = reverse_applies(&hunks, &prepared);
        std::fs::write(case_directory.join("0"), &prepared).expect("prepared entry");
        let patch_path: PathBuf = case_directory.join("landed.patch");
        std::fs::write(&patch_path, &patch).expect("patch file");
        let patch_argument: String = patch_path.to_string_lossy().into_owned();
        let git_says: bool = git_output(
            case_directory.as_path(),
            &["apply", "--reverse", "--check", patch_argument.as_str()],
        )
        .status
        .success();
        assert_eq!(
            ours,
            git_says,
            "case {case}: base {:?} landed {:?} prepared {:?}",
            String::from_utf8_lossy(&base),
            String::from_utf8_lossy(&landed),
            String::from_utf8_lossy(&prepared)
        );
        if ours {
            applied += 1;
        } else {
            rejected += 1;
        }
    }
    remove(root.as_path());
    assert!(applied > 0 && rejected > 0, "applied {applied}, rejected {rejected}");
}

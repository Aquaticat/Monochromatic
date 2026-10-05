//! What: Disposable-file controls for wrapper self-exclusion.
//! Why: The wrapper must recognise itself through every link, spelling and copy, and
//!      recognise the TypeScript wrapper's launchers, without misjudging real Git.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // expect(await classifyCandidate(linkToSelf, self)).toBe('wrapper');
//! ```
#![cfg(unix)]

/// Import the classification under test and shared fixtures.
use super::{
    CandidateKind, MAX_SCRIPT_INSPECTION_BYTES, classify_candidate, has_wrapper_marker,
    identical_content, is_native_header, same_file,
};
use crate::test_support::{REAL_GIT, executable, fixture, remove};
use std::path::{Path, PathBuf};

/// Every supported native signature is recognised, including two-byte PE.
#[test]
fn native_headers_are_recognised_by_prefix() {
    for header in [
        b"\x7fELF".as_slice(),
        b"MZ",
        b"MZ\x90\x00",
        b"\xfe\xed\xfa\xce",
        b"\xfe\xed\xfa\xcf",
        b"\xce\xfa\xed\xfe",
        b"\xcf\xfa\xed\xfe",
        b"\xca\xfe\xba\xbe",
        b"\xbe\xba\xfe\xca",
        b"\xca\xfe\xba\xbf",
        b"\xbf\xba\xfe\xca",
    ] {
        assert!(is_native_header(header), "{header:?}");
    }
    for header in [
        b"".as_slice(),
        b"M",
        b"\x7fEL",
        b"#!/b",
        b"ELF\x7f",
        b"\xfe\xed\xfa",
        b"zM",
    ] {
        assert!(!is_native_header(header), "{header:?}");
    }
}

/// Each marker is found at the start, middle and end; near misses are not markers.
#[test]
fn wrapper_markers_are_found_anywhere_in_script_bytes() {
    for marker in [
        "@monochromatic-dev/git-policy-cli",
        "package/git-policy/cli/dist/final/node/index.mjs",
        "@monochromatic-dev\\git-policy-cli",
        "package\\git-policy\\cli\\dist\\final\\node\\index.mjs",
    ] {
        assert!(has_wrapper_marker(marker.as_bytes()), "{marker}");
        assert!(has_wrapper_marker(
            format!("#!/bin/sh\nexec node {marker}\n").as_bytes()
        ));
        assert!(has_wrapper_marker(format!("\u{ff}\n{marker}").as_bytes()));
        // One byte short at either end is not the marker.
        assert!(!has_wrapper_marker(&marker.as_bytes()[1..]), "{marker}");
        assert!(
            !has_wrapper_marker(&marker.as_bytes()[..marker.len() - 1]),
            "{marker}"
        );
    }
    for content in [
        "",
        "#!/bin/sh\nexec /usr/bin/git \"$@\"\n",
        "@monochromatic-dev/git-policy-api",
        "monochromatic-dev/git-policy-cli",
    ] {
        assert!(!has_wrapper_marker(content.as_bytes()), "{content:?}");
    }
}

/// The same file is recognised through symbolic links, hard links and relative spellings.
#[test]
fn same_file_holds_through_links_and_spellings() {
    let root: PathBuf = fixture("same-file");
    let own: PathBuf = root.join("own");
    executable(own.as_path(), b"\x7fELF own");
    let other: PathBuf = root.join("other");
    executable(other.as_path(), b"\x7fELF own");
    let directory: PathBuf = root.join("dir");
    std::fs::create_dir(&directory).expect("directory");
    let symlink: PathBuf = directory.join("git");
    std::os::unix::fs::symlink(&own, &symlink).expect("symlink");
    let chained: PathBuf = root.join("chained");
    std::os::unix::fs::symlink(&symlink, &chained).expect("chained symlink");
    let hardlink: PathBuf = root.join("hardlink");
    std::fs::hard_link(&own, &hardlink).expect("hard link");
    let dotted: PathBuf = directory.join("..").join("own");
    for same in [&own, &symlink, &chained, &hardlink, &dotted] {
        assert!(same_file(same.as_path(), own.as_path()), "{same:?}");
        assert!(same_file(own.as_path(), same.as_path()), "{same:?}");
    }
    assert!(!same_file(other.as_path(), own.as_path()));
    assert!(!same_file(root.join("missing").as_path(), own.as_path()));
    assert!(!same_file(own.as_path(), root.join("missing").as_path()));
    assert!(!same_file(
        root.join("missing").as_path(),
        root.join("missing").as_path()
    ));
    let dangling: PathBuf = root.join("dangling");
    std::os::unix::fs::symlink(root.join("missing"), &dangling).expect("dangling symlink");
    assert!(!same_file(dangling.as_path(), own.as_path()));
    remove(root.as_path());
}

/// Only equal length and equal bytes make two files identical.
#[test]
fn identical_content_requires_equal_length_and_bytes() {
    let root: PathBuf = fixture("identical");
    let own: PathBuf = root.join("own");
    std::fs::write(&own, b"abcdef").expect("own");
    for (name, content, expected) in [
        ("copy", b"abcdef".as_slice(), true),
        ("same-length", b"abcdeX", false),
        ("first-differs", b"Xbcdef", false),
        ("shorter", b"abcde", false),
        ("longer", b"abcdefg", false),
        ("empty", b"", false),
    ] {
        let path: PathBuf = root.join(name);
        std::fs::write(&path, content).expect("candidate");
        assert_eq!(
            identical_content(path.as_path(), own.as_path()),
            expected,
            "{name}"
        );
        assert_eq!(
            identical_content(own.as_path(), path.as_path()),
            expected,
            "{name}"
        );
    }
    assert!(!identical_content(
        root.join("missing").as_path(),
        own.as_path()
    ));
    assert!(!identical_content(
        own.as_path(),
        root.join("missing").as_path()
    ));
    let empty_one: PathBuf = root.join("empty-one");
    std::fs::write(&empty_one, b"").expect("empty");
    assert!(identical_content(
        empty_one.as_path(),
        root.join("empty").as_path()
    ));
    remove(root.as_path());
}

/// Classify a candidate created with the given content against a fixed own executable.
fn classify_content(root: &Path, name: &str, content: &[u8]) -> CandidateKind {
    let candidate: PathBuf = root.join(name);
    executable(candidate.as_path(), content);
    return classify_candidate(candidate.as_path(), root.join("own").as_path());
}

/// This executable is a wrapper through every link, relative spelling and byte-identical copy.
#[test]
fn own_executable_is_a_wrapper_through_links_and_copies() {
    let root: PathBuf = fixture("classify-self");
    let own: PathBuf = root.join("own");
    executable(own.as_path(), b"\x7fELF native wrapper bytes");
    let symlink: PathBuf = root.join("symlink");
    std::os::unix::fs::symlink(&own, &symlink).expect("symlink");
    let hardlink: PathBuf = root.join("hardlink");
    std::fs::hard_link(&own, &hardlink).expect("hard link");
    for candidate in [&own, &symlink, &hardlink] {
        assert_eq!(
            classify_candidate(candidate.as_path(), own.as_path()),
            CandidateKind::Wrapper,
            "{candidate:?}"
        );
    }
    assert_eq!(
        classify_content(root.as_path(), "copy", b"\x7fELF native wrapper bytes"),
        CandidateKind::Wrapper
    );
    // Same length, one different byte: a different native executable.
    assert_eq!(
        classify_content(root.as_path(), "sibling", b"\x7fELF native wrapper byteS"),
        CandidateKind::RealGit
    );
    remove(root.as_path());
}

/// Native executables and marker-free scripts are Git; real Git 2.56.0 itself is Git.
#[test]
fn other_executables_are_real_git() {
    let root: PathBuf = fixture("classify-real");
    executable(root.join("own").as_path(), b"\x7fELF own");
    assert_eq!(
        classify_candidate(Path::new(REAL_GIT), root.join("own").as_path()),
        CandidateKind::RealGit
    );
    for (name, content) in [
        ("elf", b"\x7fELF other".as_slice()),
        ("pe", b"MZ"),
        ("script", b"#!/bin/sh\nexec /usr/bin/git \"$@\"\n"),
        ("empty", b""),
        ("short", b"#!"),
    ] {
        assert_eq!(
            classify_content(root.as_path(), name, content),
            CandidateKind::RealGit,
            "{name}"
        );
    }
    // A native executable is never searched for markers, whatever follows its header.
    assert_eq!(
        classify_content(
            root.as_path(),
            "native-with-marker-text",
            b"\x7fELF @monochromatic-dev/git-policy-cli"
        ),
        CandidateKind::RealGit
    );
    remove(root.as_path());
}

/// Scripts that start the TypeScript wrapper are wrappers, wherever the marker sits within the bound.
#[test]
fn typescript_wrapper_launchers_are_wrappers() {
    let root: PathBuf = fixture("classify-shim");
    executable(root.join("own").as_path(), b"\x7fELF own");
    assert_eq!(
        classify_content(
            root.as_path(),
            "pnpm-shim",
            b"#!/bin/sh\nexec node \"$basedir/../@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs\" \"$@\"\n"
        ),
        CandidateKind::Wrapper
    );
    assert_eq!(
        classify_content(
            root.as_path(),
            "cmd-shim",
            b"@ECHO off\r\nnode \"%~dp0\\..\\@monochromatic-dev\\git-policy-cli\\dist\\final\\node\\index.mjs\" %*\r\n"
        ),
        CandidateKind::Wrapper
    );
    // The marker begins at byte zero, spanning the four header bytes.
    assert_eq!(
        classify_content(
            root.as_path(),
            "marker-first",
            b"@monochromatic-dev/git-policy-cli"
        ),
        CandidateKind::Wrapper
    );
    // The marker ends exactly at the inspection bound.
    let marker: &[u8] = b"package/git-policy/cli/dist/final/node/index.mjs";
    let mut at_bound: Vec<u8> = vec![b'#'; MAX_SCRIPT_INSPECTION_BYTES - marker.len()];
    at_bound.extend_from_slice(marker);
    assert_eq!(at_bound.len(), MAX_SCRIPT_INSPECTION_BYTES);
    assert_eq!(
        classify_content(root.as_path(), "marker-last", at_bound.as_slice()),
        CandidateKind::Wrapper
    );
    remove(root.as_path());
}

/// The script inspection bound is exact: at the bound is inspected, one byte more is unusable.
#[test]
fn script_inspection_bound_is_exact() {
    let root: PathBuf = fixture("classify-bound");
    executable(root.join("own").as_path(), b"\x7fELF own");
    let at_bound: Vec<u8> = vec![b'#'; MAX_SCRIPT_INSPECTION_BYTES];
    assert_eq!(
        classify_content(root.as_path(), "at-bound", at_bound.as_slice()),
        CandidateKind::RealGit
    );
    let mut over_bound: Vec<u8> = vec![b'#'; MAX_SCRIPT_INSPECTION_BYTES + 1];
    assert_eq!(
        classify_content(root.as_path(), "over-bound", over_bound.as_slice()),
        CandidateKind::Unusable
    );
    // An oversized script is unusable even when it carries a marker within the bound.
    over_bound[..33].copy_from_slice(b"@monochromatic-dev/git-policy-cli");
    assert_eq!(
        classify_content(root.as_path(), "over-bound-marker", over_bound.as_slice()),
        CandidateKind::Unusable
    );
    // A large native executable is not subject to the script bound.
    let mut native: Vec<u8> = vec![0; MAX_SCRIPT_INSPECTION_BYTES * 2];
    native[..4].copy_from_slice(b"\x7fELF");
    assert_eq!(
        classify_content(root.as_path(), "large-native", native.as_slice()),
        CandidateKind::RealGit
    );
    remove(root.as_path());
}

/// Entries that cannot be run as a file are unusable, and a named pipe never blocks classification.
#[test]
fn unusable_candidates_are_skipped() {
    use std::os::unix::fs::PermissionsExt;
    let root: PathBuf = fixture("classify-unusable");
    let own: PathBuf = root.join("own");
    executable(own.as_path(), b"\x7fELF own");
    assert_eq!(
        classify_candidate(root.join("missing").as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    let directory: PathBuf = root.join("directory");
    std::fs::create_dir(&directory).expect("directory");
    assert_eq!(
        classify_candidate(directory.as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    let plain: PathBuf = root.join("not-executable");
    std::fs::write(&plain, b"\x7fELF other").expect("plain file");
    std::fs::set_permissions(&plain, std::fs::Permissions::from_mode(0o644)).expect("mode");
    assert_eq!(
        classify_candidate(plain.as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    // Any single execute bit makes a file a candidate.
    for mode in [0o100, 0o010, 0o001] {
        let path: PathBuf = root.join(format!("mode-{mode:o}"));
        std::fs::write(&path, b"\x7fELF other").expect("file");
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644 | mode))
            .expect("mode");
        assert_eq!(
            classify_candidate(path.as_path(), own.as_path()),
            CandidateKind::RealGit,
            "{mode:o}"
        );
    }
    let dangling: PathBuf = root.join("dangling");
    std::os::unix::fs::symlink(root.join("missing"), &dangling).expect("dangling symlink");
    assert_eq!(
        classify_candidate(dangling.as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    let unreadable: PathBuf = root.join("unreadable");
    std::fs::write(&unreadable, b"#!/bin/sh\n").expect("file");
    std::fs::set_permissions(&unreadable, std::fs::Permissions::from_mode(0o111)).expect("mode");
    assert_eq!(
        classify_candidate(unreadable.as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    let pipe: PathBuf = root.join("pipe");
    let made = std::process::Command::new("mkfifo")
        .arg(&pipe)
        .status()
        .expect("mkfifo");
    assert!(made.success());
    std::fs::set_permissions(&pipe, std::fs::Permissions::from_mode(0o755)).expect("mode");
    assert_eq!(
        classify_candidate(pipe.as_path(), own.as_path()),
        CandidateKind::Unusable
    );
    remove(root.as_path());
}

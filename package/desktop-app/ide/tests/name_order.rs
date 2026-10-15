//! Sibling names sort mixed, case folded, with digit runs compared as numbers.

/// The key orders names exactly as the tree shows them.
use ide_app::name_order::name_key;
/// Native names include bytes that are not text.
use std::{ffi::OsString, os::unix::ffi::OsStringExt};

/// Sort `names` by their keys, as `Workspace::list` does.
fn sorted(names: &[&str]) -> Vec<String> {
    let mut owned = names
        .iter()
        .map(|name| return OsString::from(*name))
        .collect::<Vec<_>>();
    owned.sort_by_cached_key(|name| return name_key(name));
    return owned
        .into_iter()
        .map(|name| return name.to_string_lossy().into_owned())
        .collect();
}

/// Folders and files share one list, and upper and lower case sort together.
#[test]
fn case_is_folded_and_kinds_are_mixed() {
    assert_eq!(
        sorted(&["Zebra", "apple", "Banana", "cherry.ts", "Cherry"]),
        ["apple", "Banana", "Cherry", "cherry.ts", "Zebra"]
    );
}

/// A number compares by value, so 2 comes before 10 and leading zeros do not count.
#[test]
fn digit_runs_compare_as_numbers() {
    assert_eq!(
        sorted(&[
            "file10.txt",
            "file2.txt",
            "file1.txt",
            "file02.txt",
            "file100.txt"
        ]),
        [
            "file1.txt",
            "file02.txt",
            "file2.txt",
            "file10.txt",
            "file100.txt"
        ]
    );
}

/// Digits sort before letters and punctuation sorts by code point.
#[test]
fn digits_precede_letters_and_dots_precede_both() {
    assert_eq!(
        sorted(&["a", "1", ".git", "_x", "B", "9z"]),
        [".git", "1", "9z", "_x", "a", "B"]
    );
}

/// Names that fold to the same pieces keep one fixed order, so a reload never reshuffles them.
#[test]
fn equal_looking_names_have_one_fixed_order() {
    let first = sorted(&["a", "A", "01", "1"]);
    let second = sorted(&["1", "01", "A", "a"]);
    assert_eq!(first, second);
    assert_eq!(first, ["01", "1", "A", "a"]);
}

/// A name that is not valid text still sorts, after the text it shares a start with.
#[test]
fn a_name_that_is_not_text_still_sorts_deterministically() {
    let bytes = OsString::from_vec(vec![b'a', 0xff, b'b']);
    let plain = OsString::from("a");
    assert!(name_key(&plain) < name_key(&bytes));
    assert_eq!(name_key(&bytes), name_key(&bytes.clone()));
}

/// Digit runs far longer than any integer type still compare correctly.
#[test]
fn huge_numbers_do_not_overflow() {
    assert_eq!(
        sorted(&[
            "n99999999999999999999999999",
            "n100000000000000000000000000",
            "n5"
        ]),
        [
            "n5",
            "n99999999999999999999999999",
            "n100000000000000000000000000"
        ]
    );
}

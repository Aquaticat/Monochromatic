//! Pure queue pagination on two axes, picked per track, so a long library can be
//! browsed a page at a time. No Slint, audio, or I/O, so it is fully unit-tested;
//! the binary maps the result onto UI properties at the property edge.
//!
//! Each track's display string is its path relative to the queue's common root
//! (see the `relpath` module):
//!
//! - A track inside a subfolder (its relative path contains `/`) groups by its
//!   TOP-LEVEL folder under the loaded root (one level only): the page label is
//!   that single folder (e.g. `Artist`), while any deeper nesting stays visible
//!   in the row's full relative path.
//! - A track sitting directly at the root (no `/`) groups by first letter, with
//!   fixed buckets: the 26 English letters A-Z (case-insensitive), plus a single
//!   `#` catch-all for digits, symbols, CJK, and non-English letters.
//!
//! Pages come out sorted folder-pages-first (by path), then the A-Z letter pages,
//! then the `#` catch-all.

// What:     `use std::collections::BTreeMap;`. `BTreeMap<K, V>` is an ordered map
//           that keeps its keys SORTED (a balanced tree). Sibling the reader might
//           expect: `HashMap<K, V>`, which is faster but iterates in arbitrary
//           order.
// Why:      We group entries by a page key and want the pages to come out in
//           sorted key order for free; `HashMap` would force a separate sort.
// TS map:   no built-in sorted map; mentally a `Map<K, V>` you always iterate via
//           `[...map.keys()].sort()`.
use std::collections::BTreeMap;

// What:     `const SEPARATOR: char = '/';`. `char` is a single Unicode scalar
//           value (sibling: `&str`, a whole string slice). The path separator the
//           display strings use.
// Why:      `relpath` joins segments with `/`; we split on the same char to find a
//           track's parent folder.
// TS map:   `const SEPARATOR = "/";`
const SEPARATOR: char = '/';

// What:     `const FOLDER_GROUP: u8 = 0;`. `u8` is an 8-bit unsigned integer
//           (siblings: `u16`, `u32`, `usize`). The sort-group tag for folder pages.
// Why:      The page key pairs this tag with a label so folder pages sort before
//           letter pages regardless of how the labels compare as text.
// TS map:   `const FOLDER_GROUP = 0;`
const FOLDER_GROUP: u8 = 0;

// What:     `const LETTER_GROUP: u8 = 1;`. Sort-group tag for the A-Z letter pages.
// Why:      Letter pages sort after folder pages, before the catch-all.
// TS map:   `const LETTER_GROUP = 1;`
const LETTER_GROUP: u8 = 1;

// What:     `const CATCH_ALL_GROUP: u8 = 2;`. Sort-group tag for the `#` page.
// Why:      The catch-all sorts last, after every A-Z letter page.
// TS map:   `const CATCH_ALL_GROUP = 2;`
const CATCH_ALL_GROUP: u8 = 2;

// What:     `const CATCH_ALL_LABEL: &str = "#";`. `&str` is a BORROWED string slice
//           (here pointing at text baked into the binary); sibling: the owned
//           `String`. The label of the catch-all page.
// Why:      One spot defines the catch-all caption, shared by the key and any test.
// TS map:   `const CATCH_ALL_LABEL = "#";`
const CATCH_ALL_LABEL: &str = "#";

// What:     `#[derive(...)]` runs the listed macros to auto-implement behaviour:
//           `Debug` enables `{:?}` formatting (used by `assert_eq!` messages),
//           `Clone` allows duplicating the value, and `PartialEq`/`Eq` enable `==`.
// Why:      Tests compare whole `PageEntry` values with `assert_eq!`, which needs
//           equality and debug formatting; the binary clones names into entries.
// TS map:   TS gives `===`, structural compare, and console.log for free.
#[derive(Debug, Clone, PartialEq, Eq)]
// What:     `pub struct PageEntry { ... }` declares a public record type: one track
//           on a page, carrying its LOAD-ORDER index plus its display string.
// Why:      Filtering hides other tracks, so a clicked row must still know its real
//           position in the full queue; the index carries that through.
// TS map:   `type PageEntry = { index: number; name: string };`
//
// In TS you'd write (pseudocode):
// ```ts
// type PageEntry = { index: number; name: string };
// ```
pub struct PageEntry {
    // What:     `pub index: usize`. `usize` is the pointer-sized unsigned integer
    //           used for array indices (siblings: `u32`, `u64`, `i32`). The track's
    //           position in the full queue, in load order.
    // Why:      `usize` because it indexes the queue's `Vec`; that is the type Rust
    //           indexing uses, so no casts are needed on the queue side.
    // TS map:   `index: number`.
    pub index: usize,
    // What:     `pub name: String`. `String` is the OWNED, growable UTF-8 buffer
    //           (sibling: the borrowed `&str`). The display string: a folder-
    //           relative path (`Artist/Album/01.flac`) for a subfolder track, or a
    //           bare filename for a root-level track.
    // Why:      Owned, not borrowed, because the entry outlives the input slice it
    //           was copied from (the UI keeps it after `paginate` returns).
    // TS map:   `name: string`.
    pub name: String,
}

// What:     same derives as above, for the same reasons (compare and debug-print
//           whole pages in tests).
// Why:      Tests assert on `Vec<Page>` equality.
// TS map:   free in TS.
#[derive(Debug, Clone, PartialEq, Eq)]
// What:     `pub struct Page { ... }` declares one page: a label plus the tracks
//           that belong to it, in load order.
// Why:      The UI shows one tab per page (its label) and lists the page's tracks.
// TS map:   `type Page = { label: string; entries: PageEntry[] };`
//
// In TS you'd write (pseudocode):
// ```ts
// type Page = { label: string; entries: PageEntry[] };
// ```
pub struct Page {
    // What:     `pub label: String`. The page caption (owned): a relative folder
    //           path (`Artist/Album`), a single A-Z letter, or `#`.
    // Why:      `String` not `&str` because the label is built fresh (sliced from a
    //           path or produced by uppercasing), not borrowed from the input.
    // TS map:   `label: string`.
    pub label: String,
    // What:     `pub entries: Vec<PageEntry>`. `Vec<T>` is the owned, growable array
    //           (sibling: the borrowed slice `&[T]`). This page's tracks.
    // Why:      Owned because the page is built up as names are scanned and handed
    //           back to the caller.
    // TS map:   `entries: PageEntry[]`.
    pub entries: Vec<PageEntry>,
}

// What:     `fn letter_key(name: &str) -> (u8, String)`. The page key for a root-
//           level track (one with no folder): a `(group, label)` pair using the
//           first letter. `(u8, String)` is a TUPLE (a fixed pair of two types).
//           Private helper.
// Why:      Fixed A-Z buckets plus a `#` catch-all, so a flat folder is browsable
//           by first letter without exploding into one page per distinct character.
// TS map:   `function letterKey(name: string): [number, string]`
fn letter_key(name: &str) -> (u8, String) {
    // What:     `match name.chars().next() { ... }`. `name.chars()` iterates the
    //           string's Unicode characters; `.next()` pulls the first as
    //           `Option<char>` (`Some(c)` or `None` for an empty string).
    // Why:      The first character decides the letter bucket.
    // TS map:   `const c = [...name][0]; // may be undefined`
    match name.chars().next() {
        // What:     `Some(c) if c.is_ascii_alphabetic() => (LETTER_GROUP, c.to_ascii_uppercase().to_string())`.
        //           A match arm with a GUARD (`if ...`): taken only when the first
        //           char is one of the 26 English letters a-z/A-Z.
        //           `c.to_ascii_uppercase()` returns the uppercase `char` (identity
        //           for A-Z); `.to_string()` makes an owned one-character `String`.
        // Why:      Case-fold so `a` and `A` share the `A` page; non-letters fall
        //           through to the catch-all arm below.
        // TS map:   `if (/[a-z]/i.test(c)) return [LETTER_GROUP, c.toUpperCase()];`
        Some(c) if c.is_ascii_alphabetic() => {
            (LETTER_GROUP, c.to_ascii_uppercase().to_string())
        }
        // What:     `_ => (CATCH_ALL_GROUP, CATCH_ALL_LABEL.to_string())`. The
        //           wildcard `_` matches everything else: a digit, symbol, CJK or
        //           accented/non-English letter, or an empty name. `.to_string()`
        //           copies the `&str` constant into an owned `String`.
        // Why:      Everything that is not a plain English letter lands on `#`.
        // TS map:   `return [CATCH_ALL_GROUP, CATCH_ALL_LABEL];`
        _ => (CATCH_ALL_GROUP, CATCH_ALL_LABEL.to_string()),
    }
}

// What:     `fn page_key(name: &str) -> (u8, String)`. Decide a track's page: the
//           `(sort-group, label)` pair used both to bucket it and to caption its
//           tab. Private helper.
// Why:      One spot defines grouping, so the bucket key and the displayed label
//           can never drift apart.
// TS map:   `function pageKey(name: string): [number, string]`
fn page_key(name: &str) -> (u8, String) {
    // What:     `match name.find(SEPARATOR) { ... }`. `name.find(c)` returns
    //           `Option<usize>`: the BYTE index of the FIRST `/`, or `None` when the
    //           name has no folder. (`find` with a `char` is a plain forward scan,
    //           not a regex.)
    // Why:      A `/` means the track lives in a subfolder; the segment before the
    //           FIRST `/` is its top-level folder (one level only), otherwise it is
    //           a root-level (letter-page) track.
    // TS map:   `const slash = name.indexOf("/");`
    match name.find(SEPARATOR) {
        // What:     `Some(slash) => (FOLDER_GROUP, name[..slash].to_string())`.
        //           `name[..slash]` slices the bytes BEFORE the FIRST `/` (a range
        //           index; `..slash` means "up to, not including"), yielding the
        //           top-level folder as a `&str`; `.to_string()` owns it as the page
        //           label.
        // Why:      Group by one folder level only (the top folder under the loaded
        //           root); deeper nesting shows in the row path, not the tab.
        // TS map:   `if (slash >= 0) return [FOLDER_GROUP, name.slice(0, slash)];`
        Some(slash) => (FOLDER_GROUP, name[..slash].to_string()),
        // What:     `None => letter_key(name)`. No folder: fall back to the first-
        //           letter bucket.
        // Why:      Root-level tracks paginate by letter.
        // TS map:   `return letterKey(name);`
        None => letter_key(name),
    }
}

// What:     `pub fn paginate(names: &[String]) -> Vec<Page>`. Group the display
//           strings into pages. `&[String]` is a BORROWED slice of owned strings
//           (read-only; we copy out of it, never mutate it).
// Why:      The binary calls this whenever the queue changes to rebuild the tabs
//           and the visible page.
// TS map:   `function paginate(names: readonly string[]): Page[]`
//
// In TS you'd write (pseudocode):
// ```ts
// function paginate(names: readonly string[]): Page[] {
//   const groups = new Map<string, PageEntry[]>(); // keyed by `${group} ${label}`
//   names.forEach((name, index) => {
//     const [group, label] = pageKey(name);
//     const key = `${group} ${label}`;
//     (groups.get(key) ?? groups.set(key, []).get(key)!).push({ index, name });
//   });
//   return [...groups.keys()].sort().map(key => ({ label: key.split(" ")[1], entries: groups.get(key)! }));
// }
// ```
pub fn paginate(names: &[String]) -> Vec<Page> {
    // What:     `let mut groups: BTreeMap<(u8, String), Vec<PageEntry>> = BTreeMap::new();`.
    //           A fresh empty sorted map from a `(sort-group, label)` key to that
    //           page's entries. `mut` marks it mutable. Tuples sort
    //           lexicographically: by the `u8` group first, then the label.
    // Why:      Accumulate entries per page; the tree sorts folder pages, then A-Z,
    //           then `#`, with no extra sort step.
    // TS map:   `const groups = new Map<[number, string], PageEntry[]>();`
    let mut groups: BTreeMap<(u8, String), Vec<PageEntry>> = BTreeMap::new();

    // What:     `for (index, name) in names.iter().enumerate() { ... }`.
    //           `names.iter()` borrows each element as `&String`; `.enumerate()`
    //           pairs each with its position, yielding `(usize, &String)`. The
    //           `(index, name)` pattern destructures that pair.
    // Why:      We need both the load-order index (for `PageEntry.index`) and the
    //           name itself.
    // TS map:   `names.forEach((name, index) => { ... })`
    for (index, name) in names.iter().enumerate() {
        // What:     `let key = page_key(name);`. Compute this name's `(group, label)`
        //           key. `name` is a `&String`, which auto-derefs to the `&str` the
        //           helper takes.
        // Why:      Decide which page this name belongs to.
        // TS map:   `const key = pageKey(name);`
        let key = page_key(name);
        // What:     `let entry = PageEntry { index, name: name.clone() };`. Build the
        //           entry. `index` uses field-init shorthand (variable name matches
        //           the field). `name.clone()` makes an OWNED copy of the borrowed
        //           string, since the entry must own its name.
        // Why:      The slice is only borrowed; the page keeps its own copy.
        // TS map:   `const entry = { index, name };`
        let entry = PageEntry {
            index,
            name: name.clone(),
        };
        // What:     `groups.entry(key).or_default().push(entry);`. `.entry(key)`
        //           looks up the key's slot (creating it if absent, MOVING `key` in);
        //           `.or_default()` returns a mutable reference to the slot's `Vec`,
        //           inserting an empty one on first sight; `.push(entry)` appends it.
        // Why:      Bucket the entry under its page key, creating the bucket on demand.
        // TS map:   `(groups.get(key) ?? setEmpty(groups, key)).push(entry);`
        groups.entry(key).or_default().push(entry);
    }

    // What:     `groups.into_iter().map(|((_, label), entries)| Page { label, entries }).collect()`.
    //           `.into_iter()` CONSUMES the map, yielding `((u8, String), Vec<PageEntry>)`
    //           pairs in sorted-key order; `.map(|((_, label), entries)| ...)`
    //           destructures each, DISCARDING the `u8` group (the `_`) and keeping
    //           the label, then builds a `Page` (field-init shorthand); `.collect()`
    //           gathers them into the `Vec<Page>` the return type names. Tail
    //           expression -> return value.
    // Why:      Materialize the sorted buckets as the ordered list of pages; the
    //           sort group was only needed to order them.
    // TS map:   `return [...groups].map(([[_, label], entries]) => ({ label, entries }));`
    groups
        .into_iter()
        .map(|((_, label), entries)| Page { label, entries })
        .collect()
}

// What:     `pub fn page_of_index(pages: &[Page], index: usize) -> Option<usize>`.
//           Find which page holds a given load-order track index. `&[Page]` borrows
//           the pages read-only; the result is `Some(page_position)` or `None`.
// Why:      Auto-follow needs to switch the visible page to the one containing the
//           now-playing track when the track changes.
// TS map:   `function pageOfIndex(pages: readonly Page[], index: number): number | null`
//
// In TS you'd write (pseudocode):
// ```ts
// function pageOfIndex(pages: readonly Page[], index: number): number | null {
//   const p = pages.findIndex(page => page.entries.some(e => e.index === index));
//   return p < 0 ? null : p;
// }
// ```
pub fn page_of_index(pages: &[Page], index: usize) -> Option<usize> {
    // What:     `pages.iter().position(|page| page.entries.iter().any(|entry| entry.index == index))`.
    //           `.iter()` borrows each page; `.position(|page| ...)` returns the
    //           index of the FIRST page for which the closure is true, as
    //           `Option<usize>`. Inside, `page.entries.iter().any(|entry| ...)` is
    //           true when ANY entry on that page has the matching load-order index.
    //           `|page|` and `|entry|` are closures taking a borrowed page / entry.
    //           Tail expression -> return value.
    // Why:      One linear scan locates the page; `position` already yields the
    //           `Option` shape the caller wants.
    // TS map:   `const p = pages.findIndex(...); return p < 0 ? null : p;`
    pages
        .iter()
        .position(|page| page.entries.iter().any(|entry| entry.index == index))
}

// What:     `#[cfg(test)] mod tests { ... }` declares a submodule compiled ONLY
//           during `cargo test`. `#[cfg(test)]` is a conditional-compilation
//           attribute.
// Why:      Cover every grouping branch (empty, folder merge, folder sort, letter
//           merge, catch-all, group ordering, and the lookup) without shipping tests.
// TS map:   like a `*.test.ts` file, but inlined and compiled out of prod.
#[cfg(test)]
mod tests {
    // What:     `use super::*;` imports everything from the parent module (this
    //           file) into the test scope. `super` means "one level up".
    // Why:      Tests need `paginate`, `page_of_index`, `Page`, `PageEntry`.
    // TS map:   `import * as parent from "./pagination";`
    use super::*;

    // What:     `fn names(list: &[&str]) -> Vec<String>` test helper: turn a slice
    //           of string literals into the owned `Vec<String>` `paginate` takes.
    // Why:      Tests are written with `&str` literals; `paginate` wants `String`s.
    // TS map:   `function names(list: string[]): string[] { return [...list]; }`
    fn names(list: &[&str]) -> Vec<String> {
        // What:     `list.iter().map(|s| s.to_string()).collect()`. Borrow each
        //           `&&str`, `.to_string()` copies it into an owned `String`,
        //           `.collect()` gathers them. Tail expression -> return.
        // Why:      Build the owned input vector.
        // TS map:   `return list.map(s => s);`
        list.iter().map(|s| s.to_string()).collect()
    }

    // What:     `#[test]` marks the next function as a test case.
    // Why:      `cargo test` discovers and runs it.
    // TS map:   `test("empty input ...", () => { ... })`.
    #[test]
    fn empty_input_yields_no_pages() {
        // What:     `assert!(paginate(&[]).is_empty());`. `&[]` is an empty slice;
        //           `.is_empty()` is true when there are no pages. `assert!(cond)`
        //           panics (failing the test) when `cond` is false.
        // Why:      No names means no pages, not a single empty page.
        // TS map:   `expect(paginate([]).length).toBe(0);`
        assert!(paginate(&[]).is_empty());
    }

    #[test]
    fn same_top_folder_collapses_one_level() {
        // What:     `let pages = paginate(&names(&["Artist/Album1/01.flac", "Artist/Album2/01.flac"]));`.
        //           Two tracks in DIFFERENT deeper subfolders but the same top folder.
        // Why:      Prove paging uses one level only: both collapse onto `Artist`.
        // TS map:   `const pages = paginate(["Artist/Album1/01.flac", "Artist/Album2/01.flac"]);`
        let pages = paginate(&names(&["Artist/Album1/01.flac", "Artist/Album2/01.flac"]));
        // What:     `assert_eq!(pages.len(), 1);`. One page expected.
        // Why:      Both share the `Artist` top-level folder despite differing albums.
        // TS map:   `expect(pages.length).toBe(1);`
        assert_eq!(pages.len(), 1);
        // What:     `assert_eq!(pages[0].label, "Artist");`. The label is the TOP
        //           folder only, not `Artist/Album1`.
        // Why:      Pages are limited to one folder level.
        // TS map:   `expect(pages[0].label).toBe("Artist");`
        assert_eq!(pages[0].label, "Artist");
        // What:     `let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();`.
        //           Pull just the load-order indices out of the page's entries.
        // Why:      Confirm the original positions survived grouping, in order.
        // TS map:   `const indices = pages[0].entries.map(e => e.index);`
        let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();
        // What:     `assert_eq!(indices, vec![0, 1]);`. Indices preserved.
        // Why:      Clicking a filtered row must map back to the right queue index.
        // TS map:   `expect(indices).toEqual([0, 1]);`
        assert_eq!(indices, vec![0, 1]);
    }

    #[test]
    fn distinct_folders_sorted_by_path() {
        // What:     two tracks in different folders, given out of sorted order.
        // Why:      Prove separate pages, sorted by folder path.
        // TS map:   `const pages = paginate(["Pop/b.flac", "Jazz/a.flac"]);`
        let pages = paginate(&names(&["Pop/b.flac", "Jazz/a.flac"]));
        // What:     collect the labels in page order.
        // Why:      Compare the sorted sequence at once.
        // TS map:   `const labels = pages.map(p => p.label);`
        let labels: Vec<String> = pages.iter().map(|p| p.label.clone()).collect();
        // What:     `assert_eq!(labels, vec!["Jazz", "Pop"]);`. `Jazz` sorts before
        //           `Pop`.
        // Why:      Folder pages order by path regardless of input order.
        // TS map:   `expect(labels).toEqual(["Jazz", "Pop"]);`
        assert_eq!(labels, vec!["Jazz", "Pop"]);
        // What:     `assert_eq!(pages[0].entries[0].index, 1);`. The `Jazz` page holds
        //           the second input (`Jazz/a.flac`, load index 1).
        // Why:      Sorting reorders pages but each entry keeps its real index.
        // TS map:   `expect(pages[0].entries[0].index).toBe(1);`
        assert_eq!(pages[0].entries[0].index, 1);
    }

    #[test]
    fn root_letters_merge_case_insensitively() {
        // What:     three root-level (no `/`) names starting with the same letter in
        //           different cases.
        // Why:      Prove case-folding merges them onto one `A` letter page.
        // TS map:   `const pages = paginate(["apple.flac", "Apricot.flac", "AVOCADO.flac"]);`
        let pages = paginate(&names(&["apple.flac", "Apricot.flac", "AVOCADO.flac"]));
        // What:     one page expected.
        // Why:      All three share the `A` bucket.
        // TS map:   `expect(pages.length).toBe(1);`
        assert_eq!(pages.len(), 1);
        // What:     `assert_eq!(pages[0].label, "A");`. The bucket label.
        // Why:      Letter pages caption with the uppercased letter.
        // TS map:   `expect(pages[0].label).toBe("A");`
        assert_eq!(pages[0].label, "A");
        // What:     indices preserved in load order.
        // Why:      Clicking maps back correctly.
        // TS map:   `expect(pages[0].entries.map(e => e.index)).toEqual([0, 1, 2]);`
        let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();
        assert_eq!(indices, vec![0, 1, 2]);
    }

    #[test]
    fn non_letter_root_names_go_to_catch_all() {
        // What:     four root-level names whose first char is a digit, CJK, symbol,
        //           and an accented (non-English) letter respectively.
        // Why:      Prove all four land on the single `#` catch-all page.
        // TS map:   `const pages = paginate(["1 song.flac", "初音.flac", "#tag.flac", "élan.flac"]);`
        let pages = paginate(&names(&["1 song.flac", "初音.flac", "#tag.flac", "élan.flac"]));
        // What:     one page expected.
        // Why:      None of the four is a plain A-Z letter.
        // TS map:   `expect(pages.length).toBe(1);`
        assert_eq!(pages.len(), 1);
        // What:     `assert_eq!(pages[0].label, "#");`. The catch-all caption.
        // Why:      Confirm the catch-all collects them all.
        // TS map:   `expect(pages[0].label).toBe("#");`
        assert_eq!(pages[0].label, "#");
        // What:     all four indices present, in order.
        // Why:      Nothing dropped.
        // TS map:   `expect(pages[0].entries.map(e => e.index)).toEqual([0, 1, 2, 3]);`
        let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();
        assert_eq!(indices, vec![0, 1, 2, 3]);
    }

    #[test]
    fn folders_precede_letters_precede_catch_all() {
        // What:     one folder track, one letter track, one catch-all track, given so
        //           that the folder's label (`Zed`) sorts AFTER the letter's (`A`).
        // Why:      Prove the sort group, not the label text, orders the axes.
        // TS map:   `const pages = paginate(["Zed/x.flac", "apple.flac", "1.flac"]);`
        let pages = paginate(&names(&["Zed/x.flac", "apple.flac", "1.flac"]));
        // What:     collect the labels in page order.
        // Why:      Compare the full ordered sequence.
        // TS map:   `const labels = pages.map(p => p.label);`
        let labels: Vec<String> = pages.iter().map(|p| p.label.clone()).collect();
        // What:     `assert_eq!(labels, vec!["Zed", "A", "#"]);`. Folder first (group
        //           0), then the `A` letter page (group 1), then `#` (group 2), even
        //           though `Zed` > `A` as text.
        // Why:      Confirm group ordering dominates.
        // TS map:   `expect(labels).toEqual(["Zed", "A", "#"]);`
        assert_eq!(labels, vec!["Zed", "A", "#"]);
    }

    #[test]
    fn page_of_index_finds_and_misses() {
        // What:     two folder tracks and one root-level letter track.
        // Why:      A fixture spanning both axes to look indices up in.
        // TS map:   `const pages = paginate(["A/x.flac", "B/y.flac", "c.flac"]);`
        let pages = paginate(&names(&["A/x.flac", "B/y.flac", "c.flac"]));
        // What:     `assert_eq!(page_of_index(&pages, 2), Some(2));`. Load index 2
        //           (`c.flac`) lives on the third page (the `C` letter page, after
        //           the two folder pages). `Some(2)` wraps the found page position.
        // Why:      Auto-follow must locate the playing track's page.
        // TS map:   `expect(pageOfIndex(pages, 2)).toBe(2);`
        assert_eq!(page_of_index(&pages, 2), Some(2));
        // What:     `assert_eq!(page_of_index(&pages, 99), None);`. An out-of-range
        //           index belongs to no page; `None` is the empty `Option`.
        // Why:      Robustness: a missing index yields no page, not a panic.
        // TS map:   `expect(pageOfIndex(pages, 99)).toBe(null);`
        assert_eq!(page_of_index(&pages, 99), None);
    }
}

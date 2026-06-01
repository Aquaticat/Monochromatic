//! Pure queue pagination: group the queue's display names into pages by the
//! first character of each name, so a long library can be browsed one starting
//! character at a time. No Slint, audio, or I/O, so it is fully unit-tested; the
//! binary maps the result onto UI properties at the property edge.
//!
//! Grouping is case-insensitive for letters (`a` and `A` share a page); digits,
//! symbols, and each CJK character form their own pages. The label is the
//! uppercased first character, and pages come out sorted by that label.

// What:     `use std::collections::BTreeMap;`. `BTreeMap<K, V>` is an ordered map
//           that keeps its keys SORTED (a balanced tree). Sibling the reader might
//           expect: `HashMap<K, V>`, which is faster but iterates in arbitrary
//           order.
// Why:      We group names by label and want the pages to come out sorted by
//           label for free; `HashMap` would force a separate sort step.
// TS map:   no built-in sorted map; mentally a `Map<string, V>` that you always
//           iterate via `[...map.keys()].sort()`.
//
// In TS you'd write (pseudocode):
// ```ts
// const groups = new Map<string, PageEntry[]>(); // then sort keys on read
// ```
use std::collections::BTreeMap;

// What:     `const EMPTY_LABEL: &str = "#";`. `&str` is a BORROWED string slice
//           (here pointing at text baked into the binary); sibling: the owned,
//           growable `String`. The label used for a name with no first character.
// Why:      A `paginate` caller could pass an empty string; it still needs a page
//           to land on rather than being dropped silently.
// TS map:   `const EMPTY_LABEL = "#";`
const EMPTY_LABEL: &str = "#";

// What:     `#[derive(...)]` runs the listed macros to auto-implement behaviour:
//           `Debug` enables `{:?}` formatting (used by `assert_eq!` failure
//           messages), `Clone` allows duplicating the value, and `PartialEq`/`Eq`
//           enable `==` comparison (used by the tests).
// Why:      Tests compare whole `PageEntry` values with `assert_eq!`, which needs
//           equality and debug formatting; the binary clones names into entries.
// TS map:   TS gives `===`, structural compare, and console.log for free.
#[derive(Debug, Clone, PartialEq, Eq)]
// What:     `pub struct PageEntry { ... }` declares a public record type: one
//           track on a page, carrying its LOAD-ORDER index plus its display name.
// Why:      Filtering hides other tracks, so a clicked row must still know its
//           real position in the full queue; the index carries that through.
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
    // Why:      `usize` because it indexes the queue's `Vec`; that is the type
    //           Rust indexing uses, so no casts are needed on the queue side.
    // TS map:   `index: number`.
    pub index: usize,
    // What:     `pub name: String`. `String` is the OWNED, growable UTF-8 buffer
    //           (sibling: the borrowed `&str`). The display filename.
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
    // What:     `pub label: String`. The uppercased first character (owned).
    // Why:      `String` not `&str` because `char::to_uppercase` can yield more
    //           than one character (e.g. `ß` -> `SS`), so the label is built fresh,
    //           not borrowed from the input.
    // TS map:   `label: string`.
    pub label: String,
    // What:     `pub entries: Vec<PageEntry>`. `Vec<T>` is the owned, growable
    //           array (sibling: the borrowed slice `&[T]`). This page's tracks.
    // Why:      Owned because the page is built up as names are scanned and handed
    //           back to the caller.
    // TS map:   `entries: PageEntry[]`.
    pub entries: Vec<PageEntry>,
}

// What:     `fn first_char_label(name: &str) -> String`. Compute a name's page
//           label: the uppercased first character, or `EMPTY_LABEL` when the name
//           is empty. Private (no `pub`): only `paginate` needs it.
// Why:      One spot defines the grouping key, so the label shown on a tab and the
//           key used to bucket names can never drift apart.
// TS map:   `function firstCharLabel(name: string): string`
fn first_char_label(name: &str) -> String {
    // What:     `match name.chars().next() { ... }`. `name.chars()` is an iterator
    //           over the string's Unicode characters; `.next()` pulls the first as
    //           an `Option<char>` (`Some(c)` for a non-empty string, `None` for an
    //           empty one).
    // Why:      The first character decides the page; an empty name has none.
    // TS map:   `const c = [...name][0]; // may be undefined`
    match name.chars().next() {
        // What:     `Some(c) => c.to_uppercase().collect::<String>()`. `Some(c)`
        //           binds the first character. `c.to_uppercase()` returns an
        //           ITERATOR of characters (uppercase can be more than one char,
        //           like `ß` -> `S`,`S`); `.collect::<String>()` gathers them into
        //           an owned `String`. The `::<String>` is a turbofish telling
        //           `collect` which collection type to build.
        // Why:      Case-fold so `a` and `A` share a page; for digits/symbols/CJK
        //           uppercase is the identity, so each gets its own page.
        // TS map:   `return c.toUpperCase();`
        Some(c) => c.to_uppercase().collect::<String>(),
        // What:     `None => EMPTY_LABEL.to_string()`. No first character; use the
        //           fallback label. `.to_string()` copies the `&str` constant into
        //           an owned `String` to match the other arm's type.
        // Why:      Empty names still need a page rather than vanishing.
        // TS map:   `return EMPTY_LABEL;`
        None => EMPTY_LABEL.to_string(),
    }
}

// What:     `pub fn paginate(names: &[String]) -> Vec<Page>`. Group the display
//           names into pages by first character. `&[String]` is a BORROWED slice
//           of owned strings (read-only; we copy out of it, never mutate it).
// Why:      The binary calls this whenever the queue changes to rebuild the tabs
//           and the visible page.
// TS map:   `function paginate(names: readonly string[]): Page[]`
//
// In TS you'd write (pseudocode):
// ```ts
// function paginate(names: readonly string[]): Page[] {
//   const groups = new Map<string, PageEntry[]>();
//   names.forEach((name, index) => {
//     const label = firstCharLabel(name);
//     (groups.get(label) ?? groups.set(label, []).get(label)!).push({ index, name });
//   });
//   return [...groups.keys()].sort().map(label => ({ label, entries: groups.get(label)! }));
// }
// ```
pub fn paginate(names: &[String]) -> Vec<Page> {
    // What:     `let mut groups: BTreeMap<String, Vec<PageEntry>> = BTreeMap::new();`.
    //           A fresh, empty sorted map from label to that label's entries. `mut`
    //           marks it reassignable/mutable (bindings are read-only by default).
    // Why:      Accumulate entries per label; the tree keeps labels sorted so the
    //           pages come out in order with no extra sort.
    // TS map:   `const groups = new Map<string, PageEntry[]>();`
    let mut groups: BTreeMap<String, Vec<PageEntry>> = BTreeMap::new();

    // What:     `for (index, name) in names.iter().enumerate() { ... }`.
    //           `names.iter()` borrows each element as `&String`; `.enumerate()`
    //           pairs each with its position, yielding `(usize, &String)`. The
    //           `(index, name)` pattern destructures that pair.
    // Why:      We need both the load-order index (for `PageEntry.index`) and the
    //           name itself.
    // TS map:   `names.forEach((name, index) => { ... })`
    for (index, name) in names.iter().enumerate() {
        // What:     `let label = first_char_label(name);`. Compute this name's page
        //           label. `name` is a `&String`, which auto-derefs to the `&str`
        //           the helper takes.
        // Why:      Decide which bucket this name belongs to.
        // TS map:   `const label = firstCharLabel(name);`
        let label = first_char_label(name);
        // What:     `let entry = PageEntry { index, name: name.clone() };`. Build the
        //           entry. `index` uses field-init shorthand (the variable name
        //           matches the field). `name.clone()` makes an OWNED copy of the
        //           borrowed string, since the entry must own its name.
        // Why:      The slice is only borrowed; the page keeps its own copy.
        // TS map:   `const entry = { index, name };`
        let entry = PageEntry {
            index,
            name: name.clone(),
        };
        // What:     `groups.entry(label).or_default().push(entry);`. `.entry(label)`
        //           looks up the label's slot (creating it if absent, MOVING `label`
        //           in as the key); `.or_default()` returns a mutable reference to
        //           the slot's `Vec`, inserting an empty one (`Vec::default()`) on
        //           first sight; `.push(entry)` appends the entry, MOVING it in.
        // Why:      Bucket the entry under its label, creating the bucket on demand.
        // TS map:   `(groups.get(label) ?? setEmpty(groups, label)).push(entry);`
        groups.entry(label).or_default().push(entry);
    }

    // What:     `groups.into_iter().map(|(label, entries)| Page { label, entries }).collect()`.
    //           `.into_iter()` CONSUMES the map, yielding `(String, Vec<PageEntry>)`
    //           pairs in sorted-key order; `.map(|(label, entries)| ...)` turns each
    //           pair into a `Page` (field-init shorthand again); `.collect()` gathers
    //           them into the `Vec<Page>` the return type names. Tail expression ->
    //           return value.
    // Why:      Materialize the sorted buckets as the ordered list of pages.
    // TS map:   `return [...groups].map(([label, entries]) => ({ label, entries }));`
    groups
        .into_iter()
        .map(|(label, entries)| Page { label, entries })
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
    //           `|page|` and `|entry|` are closures (anonymous functions) taking a
    //           borrowed page / entry. Tail expression -> return value.
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
// Why:      Cover every grouping branch (empty, case-merge, digit, symbol, CJK,
//           sorting, index preservation, and the lookup) without shipping tests.
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
    fn case_insensitive_merge_preserves_indices() {
        // What:     `let pages = paginate(&names(&["Apple", "apricot", "Avocado"]));`.
        //           Three names that all start with the same letter in different
        //           cases. `&names(...)` borrows the built vector as a slice.
        // Why:      Prove case-folding merges them onto one page in load order.
        // TS map:   `const pages = paginate(["Apple", "apricot", "Avocado"]);`
        let pages = paginate(&names(&["Apple", "apricot", "Avocado"]));
        // What:     `assert_eq!(pages.len(), 1);`. `assert_eq!(a, b)` fails unless
        //           `a == b`. One page expected.
        // Why:      All three share the `A` page.
        // TS map:   `expect(pages.length).toBe(1);`
        assert_eq!(pages.len(), 1);
        // What:     `assert_eq!(pages[0].label, "A");`. Index the first page and
        //           compare its label. `"A"` is a `&str`; comparing `String == &str`
        //           works via Rust's `PartialEq` impl.
        // Why:      The label is the uppercased shared first letter.
        // TS map:   `expect(pages[0].label).toBe("A");`
        assert_eq!(pages[0].label, "A");
        // What:     `let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();`.
        //           Pull just the load-order indices out of the page's entries.
        // Why:      Confirm the original positions survived grouping, in order.
        // TS map:   `const indices = pages[0].entries.map(e => e.index);`
        let indices: Vec<usize> = pages[0].entries.iter().map(|e| e.index).collect();
        // What:     `assert_eq!(indices, vec![0, 1, 2]);`. The three inputs keep
        //           their load-order indices 0,1,2. `vec![...]` builds the expected
        //           vector.
        // Why:      Clicking a filtered row must map back to the right queue index.
        // TS map:   `expect(indices).toEqual([0, 1, 2]);`
        assert_eq!(indices, vec![0, 1, 2]);
    }

    #[test]
    fn digit_and_symbol_each_get_own_page() {
        // What:     paginate three names: a symbol-leading, a digit-leading, and a
        //           letter-leading one, deliberately out of sorted order.
        // Why:      Prove digits and symbols are not merged into letters and that
        //           the pages come out sorted by character.
        // TS map:   `const pages = paginate(["1 song", "#hash", "Beta"]);`
        let pages = paginate(&names(&["1 song", "#hash", "Beta"]));
        // What:     collect just the labels in page order.
        // Why:      Compare the whole sorted label sequence at once.
        // TS map:   `const labels = pages.map(p => p.label);`
        let labels: Vec<String> = pages.iter().map(|p| p.label.clone()).collect();
        // What:     `assert_eq!(labels, vec!["#", "1", "B"]);`. `#` (U+0023) sorts
        //           before `1` (U+0031), which sorts before `B` (U+0042).
        // Why:      Confirm separate pages and code-point ordering.
        // TS map:   `expect(labels).toEqual(["#", "1", "B"]);`
        assert_eq!(labels, vec!["#", "1", "B"]);
        // What:     `assert_eq!(pages[0].entries[0].index, 1);`. The `#` page holds
        //           the second input (`#hash`, load index 1).
        // Why:      Sorting reorders pages but each entry keeps its real index.
        // TS map:   `expect(pages[0].entries[0].index).toBe(1);`
        assert_eq!(pages[0].entries[0].index, 1);
    }

    #[test]
    fn cjk_character_gets_own_page() {
        // What:     paginate a Japanese-leading name and a Latin-leading one.
        //           `"初音"` starts with `初` (U+521D).
        // Why:      Prove CJK names form their own pages and sort after ASCII.
        // TS map:   `const pages = paginate(["初音", "Beta"]);`
        let pages = paginate(&names(&["初音", "Beta"]));
        // What:     collect the labels in page order.
        // Why:      Compare label sequence.
        // TS map:   `const labels = pages.map(p => p.label);`
        let labels: Vec<String> = pages.iter().map(|p| p.label.clone()).collect();
        // What:     `assert_eq!(labels, vec!["B", "初"]);`. `B` (U+0042) sorts before
        //           `初` (U+521D).
        // Why:      Confirm the CJK character is its own page, ordered after Latin.
        // TS map:   `expect(labels).toEqual(["B", "初"]);`
        assert_eq!(labels, vec!["B", "初"]);
    }

    #[test]
    fn letters_come_out_sorted() {
        // What:     paginate three single-letter-group names given out of order.
        // Why:      Prove the page order is alphabetical regardless of input order.
        // TS map:   `const pages = paginate(["Charlie", "alpha", "Bravo"]);`
        let pages = paginate(&names(&["Charlie", "alpha", "Bravo"]));
        // What:     collect the labels in page order.
        // Why:      Compare the sorted sequence.
        // TS map:   `const labels = pages.map(p => p.label);`
        let labels: Vec<String> = pages.iter().map(|p| p.label.clone()).collect();
        // What:     `assert_eq!(labels, vec!["A", "B", "C"]);`. Sorted ascending.
        // Why:      Confirm ordering.
        // TS map:   `expect(labels).toEqual(["A", "B", "C"]);`
        assert_eq!(labels, vec!["A", "B", "C"]);
        // What:     `assert_eq!(pages[0].entries[0].index, 1);`. The `A` page holds
        //           `alpha`, which was load index 1.
        // Why:      Index preservation across sorting.
        // TS map:   `expect(pages[0].entries[0].index).toBe(1);`
        assert_eq!(pages[0].entries[0].index, 1);
    }

    #[test]
    fn page_of_index_finds_and_misses() {
        // What:     build pages from three single-letter-group names.
        // Why:      A fixture to look indices up in.
        // TS map:   `const pages = paginate(["alpha", "Bravo", "Charlie"]);`
        let pages = paginate(&names(&["alpha", "Bravo", "Charlie"]));
        // What:     `assert_eq!(page_of_index(&pages, 2), Some(2));`. Load index 2
        //           (`Charlie`) lives on the third page (`C`, position 2). `Some(2)`
        //           wraps the found page position.
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

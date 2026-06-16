// Undocumented fixture, not part of the crate build.
//
// It has no module doc and no item docs (only plain `//` comments, which are NOT
// rustdoc), so require-rustdoc reports the file plus each item and the linter
// exits one over this file.

fn undocumented() {
    let value = 1;
}

struct Bare {
    field: u8,
}

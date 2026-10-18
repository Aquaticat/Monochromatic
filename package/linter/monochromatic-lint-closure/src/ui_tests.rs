//! What:
//!  Run the UI fixtures in `tests/ui/` through Dylint's test driver.
//! Why:
//!  Each fixture is compiled with this lint loaded and its compiler output is compared with the `.stderr` file beside it.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! test('ui', () => runFixtures(stagedCopyOf('tests/ui'), libraryName));
//! ```

/// Import the builder that lets the test pass compiler flags.
use dylint_testing::ui::Test;
/// Import file system operations used to stage the fixtures.
use std::fs;
/// Import the path types.
use std::path::{Path, PathBuf};

/// What:
///  Copy a fixture directory,
///  giving every `.stderr` file that ends in a warning summary the trailing blank line that rustc prints after it.
/// Why:
///  The repository's commit policy trims a text file to exactly one final newline,
///  while the output that the UI harness compares against ends a warning summary with an empty line;
///  staging restores that line in a scratch copy and leaves the committed files in the canonical form.
///  Output that ends in an error summary has no such line.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function stage(source: string, target: string): void {
///   mkdirSync(target, { recursive: true });
///   for (const entry of readdirSync(source)) { /* copy, padding .stderr files; recurse into directories */ }
/// }
/// ```
fn stage(source: &Path, target: &Path) {
    fs::create_dir_all(target).expect("staging directory is created");
    for entry in fs::read_dir(source).expect("fixture directory reads") {
        let path: PathBuf = entry.expect("a directory entry reads").path();
        let destination: PathBuf = target.join(path.file_name().expect("entries have names"));
        if path.is_dir() {
            stage(&path, &destination);
            continue;
        }
        if path.extension().and_then(std::ffi::OsStr::to_str) == Some("stderr") {
            let text: String = fs::read_to_string(&path).expect("golden output reads");
            let trimmed: &str = text.trim_end();
            let summary: &str = trimmed.lines().last().unwrap_or("");
            let padded: String =
                if summary.starts_with("warning: ") && summary.ends_with(" emitted") {
                    format!("{trimmed}\n\n")
                } else if trimmed.is_empty() {
                    String::new()
                } else {
                    format!("{trimmed}\n")
                };
            fs::write(&destination, padded).expect("staged golden output is written");
            continue;
        }
        fs::copy(&path, &destination).expect("fixture copies");
    }
}

/// What:
///  Run every fixture with this library loaded and the `dylint_lib` cfg declared.
/// Why:
///  Each fixture names its own edition in a header comment;
///  `--check-cfg` stops rustc from warning about the `dylint_lib` cfg that the suppression attribute tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// test('ui', () => runFixtures(stagedCopyOf('tests/ui'), 'monochromatic_lint_closure'));
/// ```
#[test]
fn ui() {
    let staged: PathBuf = std::env::temp_dir().join(format!(
        "monochromatic-lint-closure-ui-{}",
        std::process::id()
    ));
    if staged.exists() {
        fs::remove_dir_all(&staged).expect("a stale staging directory is removed");
    }
    stage(Path::new("tests/ui"), &staged);
    Test::src_base("monochromatic_lint_closure", &staged)
        .rustc_flags(["--check-cfg=cfg(dylint_lib,values(any()))"])
        .run();
    fs::remove_dir_all(&staged).expect("the staging directory is removed");
}

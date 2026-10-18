//! What:
//!  Run the UI fixtures in `tests/ui/` through Dylint's test driver.
//! Why:
//!  Each fixture is compiled with this lint loaded and its compiler output is compared with the `.stderr` file beside it.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! test('ui', () => runFixtures('ui', libraryName));
//! ```

/// Import the builder that lets the test pass compiler flags.
use dylint_testing::ui::Test;

/// What:
///  Run every fixture under `tests/ui/` with this library loaded and the `dylint_lib` cfg declared.
/// Why:
///  Each fixture names its own edition in a header comment; `--check-cfg` stops rustc from warning about the
///  `dylint_lib` cfg that the suppression attribute tests.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// test('ui', () => runFixtures('tests/ui', 'monochromatic_lint_closure'));
/// ```
#[test]
fn ui() {
    Test::src_base("monochromatic_lint_closure", "tests/ui")
        .rustc_flags(["--check-cfg=cfg(dylint_lib,values(any()))"])
        .run();
}

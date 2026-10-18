# Dylint 6.2: library tests, the shared build directory and the commit policy

Evidence from building `package/linter/monochromatic-lint-closure` on `nightly-2026-10-17` with `dylint_testing` 6.2.0 and `cargo-dylint` 6.2.0.

## Fixture directory name corrupts words in the golden output

`dylint_testing::ui_test(name, "ui")` runs `compiletest_rs` 0.11.2,
which replaces the fixture directory path with `$DIR` in the normalised output.
With the relative directory `ui`,
the substring `ui` inside any word is replaced too,
so `required` becomes `req$DIRred` in the golden file and in the comparison.
The comparison still passes,
which hides the damage.
Workaround:
use a directory name that cannot occur inside words,
such as `tests/ui`.

## Golden files and the commit policy disagree about the last line

The harness compares the output exactly;
a warning run ends with the summary line and one empty line,
an error run ends without the empty line.
The commit wrapper's `final-newline` policy rewrites every non-empty text file to end in exactly one LF,
so a committed golden file no longer matches.
Workaround:
stage the fixtures into a scratch directory before the run and restore the empty line there for files whose last line is a warning summary (`src/ui_tests.rs` of the package).
The harness never reads `--bless` from the environment of `dylint_testing`;
the package's `bless` task copies the saved actual output instead.

## The scratch files go to the temporary directory

`compiletest_rs` writes `<fixture>.stage-id.stderr` and its build files to `std::env::temp_dir()`,
so `TMPDIR` decides where a failing run leaves its actual output.

## A separate cargo build directory moves the toolchain-named library copy

`dylint-link` writes `lib<name>@<toolchain>.so` next to the build output,
not next to the uplifted `target/debug/lib<name>.so`.
With the shared `build.build-dir` in `~/.cargo/config.toml`,
the copy lands in that directory,
and `cargo dylint --lib-path target/debug/lib<name>.so` fails with `the filename does not have the required form: "lib" LIBRARY_NAME "@" TOOLCHAIN ".so"`.
Workaround:
copy the library under the required name (the package's `run` task),
or set `CARGO_BUILD_BUILD_DIR=target` for the build.
The same split moves a build script's `OUT_DIR`,
which the IDE's `build.rs` climbs with `ancestors().nth(3)`:
its runtime stub then belongs in `target/debug/build/runtime`,
not `target/debug/runtime`.

## The library macro trips the repository's `unwrap` ban

`dylint_linting::declare_late_lint!` expands to a call to `Result::unwrap`,
which the root `clippy.toml` bans (`disallowed-methods`).
An `allow` attribute on the macro call is ignored (`unused_attributes`),
so the macro is placed alone in a module with `#![allow(clippy::disallowed_methods)]`.

//! Finding the files to lint, and the flags that widen or narrow that set.

/// Imports the borrowed path type used to test what a path argument is.
use std::path::Path;

/// Imports the gitignore-aware directory walker.
use ignore::WalkBuilder;

/// Imports the parsed command-line options the flags come from.
use crate::cli::Cli;

// What:     `pub fn collect_rust_files(cli: &Cli) -> Vec<String>`. Takes the
//           whole options record rather than just the paths, unlike the version
//           this replaces.
// Why:      Four flags now shape the walk, and threading them through one at a
//           time would mean changing this signature for each.
//
// In TS you'd write (pseudocode):
// ```ts
// function collectRustFiles(cli: Cli): string[]
// ```
/// Expand path arguments into the Rust source files to lint.
pub fn collect_rust_files(cli: &Cli) -> Vec<String> {
    let mut files: Vec<String> = Vec::new();

    for path in &cli.paths {
        let start = Path::new(path);

        // A file named directly is linted as given, without being walked. It is
        // still subject to `--no-ignore` and friends only in the sense that
        // naming a file explicitly is itself the decision to lint it.
        if start.is_file() {
            files.push(path.clone());
            continue;
        }

        let mut builder = WalkBuilder::new(start);

        // What:     `--no-ignore` turns off every ignore source at once.
        // Why:      Matching oxlint, which documents it as disabling
        //           `.eslintignore` files, `--ignore-path` and
        //           `--ignore-pattern` together. Here the equivalents are the
        //           gitignore family plus the two flags below.
        if cli.no_ignore {
            builder.git_ignore(false);
            builder.git_global(false);
            builder.git_exclude(false);
            builder.ignore(false);
            builder.parents(false);
        } else {
            // `.add_ignore(..)` answers an `Option<Error>` rather than a
            // `Result`, so a missing ignore file is reported and the run
            // continues rather than aborting.
            if let Some(ignore_path) = &cli.ignore_path
                && let Some(error) = builder.add_ignore(ignore_path)
            {
                tracing::warn!(path = ignore_path, cause = %error, "cannot read ignore file");
            }

            for pattern in &cli.ignore_pattern {
                // What:     `!` prefixed onto the pattern before adding it.
                // Why:      `add_custom_ignore_filename` takes a FILE, and this
                //           flag takes a PATTERN. An override glob is how the
                //           walker expresses "exclude this", and its polarity is
                //           inverted from a gitignore line, so the `!` restores
                //           the meaning the user wrote.
                let mut overrides = ignore::overrides::OverrideBuilder::new(start);
                if overrides.add(&format!("!{pattern}")).is_err() {
                    tracing::warn!(pattern, "cannot parse ignore pattern");
                    continue;
                }

                match overrides.build() {
                    Ok(built) => {
                        builder.overrides(built);
                    }
                    Err(error) => {
                        tracing::warn!(pattern, cause = %error, "cannot build ignore pattern");
                    }
                }
            }
        }

        // `.flatten()` keeps only the entries that were read successfully, so
        // one unreadable directory does not abort the walk.
        for entry in builder.build().flatten() {
            let entry_path = entry.path();

            let is_rust = entry_path.extension().and_then(|name| return name.to_str()) == Some("rs");

            if entry_path.is_file() && is_rust {
                files.push(entry_path.to_string_lossy().into_owned());
            }
        }
    }

    // Sorted so a run reports findings in the same order every time, whatever
    // order the filesystem happened to hand the entries back in.
    files.sort();

    return files;
}

// What:     `pub fn thread_count(cli: &Cli) -> usize`. Resolves `--threads`, or
//           asks the machine.
// Why:      A hardcoded default would be wrong on both a laptop and a build
//           server. `available_parallelism` answers what the OS will actually
//           give this process, which respects container CPU limits.
//
// In TS you'd write (pseudocode):
// ```ts
// function threadCount(cli: Cli): number { return cli.threads ?? cpus().length; }
// ```
/// Resolve how many worker threads this run uses.
pub fn thread_count(cli: &Cli) -> usize {
    // `.max(1)` guards `--threads 0`, which would otherwise mean no work at all.
    if let Some(requested) = cli.threads {
        return requested.max(1);
    }

    // `.map_or(1, ..)` falls back to one thread when the OS declines to answer,
    // which is correct rather than merely safe: a single thread always works.
    return std::thread::available_parallelism().map_or(1, |count| return count.get());
}

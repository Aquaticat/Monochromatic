// What:     `seed-from-tests` is a small helper binary. It reads
//           the four test fixture files in
//           `packages/cli/forbidden-strings/src/rule/{extract,atom,engine,algebra}_tests.rs`,
//           extracts every double-quoted string literal, and
//           writes each unique one as a raw-byte seed file under
//           `seeds/<target>/seed-<sha8>` (relative to this fuzz
//           crate root). The tracked `seeds/` tree is separate from
//           the gitignored `corpus/` scratch tree; fuzz invocations
//           pass both as libFuzzer corpus dirs. Run manually as
//           `cargo +nightly run --bin seed-from-tests --release`.
// Why:      libFuzzer benefits enormously from a hand-curated
//           seed corpus that already contains "interesting" inputs.
//           The test fixtures are exactly that pool: they encode
//           every regression the maintainers have already
//           triaged. By re-using them we get coverage of the bug
//           class as a starting point, not after libFuzzer
//           rediscovers them on its own.
//
// In TS you'd write (pseudocode):
// ```ts
// // For each test file: read, extract `"..."` literals, hash, write.
// ```

use sha2::{Digest, Sha256};
// What:     `use anyhow::{anyhow, Result};` imports `anyhow`'s error-construction
//           macro and application result alias for this helper binary.
// Why:      The seeder combines file I/O, git command, and guard errors into one
//           user-facing failure channel.
use anyhow::{anyhow, Result};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

// What:     `const TEST_FILES: &[&str]`. Slice-of-string-slices
//           literal, baked into the binary. The relative paths the
//           seeder reads. Siblings: a `[&str; N]` array if we knew
//           the count up front -- a slice is fine here.
// Why:      Single source of truth for what to seed from.
const TEST_FILES: &[&str] = &[
    "../../cli/forbidden-strings/src/rule/extract_tests.rs",
    "../../cli/forbidden-strings/src/rule/atom_tests.rs",
    "../../cli/forbidden-strings/src/rule/engine_tests.rs",
    "../../cli/forbidden-strings/src/rule/algebra_tests.rs",
];

// What:     `const FORBIDDEN_LOCAL: &str = "../../cli/forbidden-strings/forbidden-strings.local.txt";`.
//           Sentinel path that MUST NOT be read by the seeder.
//           The seeder checks `git check-ignore` on this path
//           before doing anything; if the file is NOT ignored
//           (or doesn't exist, which also returns success), we
//           bail loudly.
// Why:      The repo's local deny-list contains real secrets
//           we cannot expose in corpus files. The seeder is
//           supposed to read only test fixtures; a defensive
//           guard catches accidental future regressions where
//           someone adds the local file to `TEST_FILES`.
const FORBIDDEN_LOCAL: &str = "../../cli/forbidden-strings/forbidden-strings.local.txt";

// What:     `const TARGETS: &[&str]`. The set of fuzz targets that
//           get seeded. Each gets its own `seeds/<target>/` dir.
const TARGETS: &[&str] = &[
    "fuzz_extract_gate_soundness",
    "fuzz_ruleset_scan_invariants",
    "fuzz_regex_engine_dispatch",
    "fuzz_regex_syntax_walkers",
    "fuzz_scan_format",
    "fuzz_residual_shards",
    "fuzz_literal_roundtrip",
];

fn main() -> Result<()> {
    // What:     `verify_local_file_ignored()?` runs the guard.
    //           Question-mark propagates the error up to `main`'s
    //           `Result` return, causing a non-zero exit with the
    //           error message on stderr.
    // Why:      Bail before reading anything if the guard fails.
    verify_local_file_ignored()?;

    // What:     `let mut seen: HashSet<Vec<u8>> = HashSet::new();`.
    //           HashSet of owned byte vectors -- the set of unique
    //           string literals we've extracted across all files.
    //           Siblings: `BTreeSet` for sorted iteration; not
    //           needed here.
    // Why:      Same literal in two test files should produce one
    //           seed, not two.
    let mut seen: HashSet<Vec<u8>> = HashSet::new();

    for rel in TEST_FILES {
        let path = PathBuf::from(rel);
        let bytes = fs::read(&path)
            .map_err(|e| anyhow!("failed to read {}: {}", path.display(), e))?;
        for lit in extract_string_literals(&bytes) {
            seen.insert(lit);
        }
    }

    // eprintln, not tracing: seed-from-tests is a one-shot developer corpus-seeder run by
    // hand; these are its user-facing progress lines, not application logging. The library
    // under fuzz (forbidden-strings) is what carries tracing.
    eprintln!("extracted {} unique literals from {} files", seen.len(), TEST_FILES.len());

    let mut written = 0usize;
    for target in TARGETS {
        let dir = PathBuf::from("seeds").join(target);
        fs::create_dir_all(&dir)?;
        for lit in &seen {
            let mut hasher = Sha256::new();
            hasher.update(lit);
            let digest = hasher.finalize();
            let short_hex = digest
                .iter()
                .take(4)
                .map(|b| format!("{:02x}", b))
                .collect::<String>();
            let seed_path = dir.join(format!("seed-{}", short_hex));
            if seed_path.exists() {
                continue;
            }
            fs::write(&seed_path, lit)?;
            written += 1;
        }
    }

    // eprintln, not tracing: dev-tool progress output (see the note above the first line).
    eprintln!("wrote {} new seed files across {} targets", written, TARGETS.len());
    Ok(())
}

// What:     `fn verify_local_file_ignored() -> Result<()>`.
//           Runs `git check-ignore -v <path>` on the local deny-
//           list. `git check-ignore` exits 0 when the path IS
//           ignored, 1 when it isn't. We need exit 0.
// Why:      Defensive: even though the seeder doesn't currently
//           read this path, a future TEST_FILES edit could
//           accidentally include it. The guard makes that change
//           visible at run-time.
fn verify_local_file_ignored() -> Result<()> {
    let local = Path::new(FORBIDDEN_LOCAL);
    if !local.exists() {
        // eprintln, not tracing: dev-tool status output for the person running the seeder.
        eprintln!(
            "{} doesn't exist; assuming clean environment",
            local.display()
        );
        return Ok(());
    }
    let out = Command::new("git")
        .arg("check-ignore")
        .arg("-v")
        .arg(local)
        .output()?;
    if !out.status.success() {
        return Err(anyhow!(
            "{} is NOT git-ignored; aborting seeder to avoid leaking secrets.\n\
             git check-ignore stdout: {}\n\
             git check-ignore stderr: {}",
            local.display(),
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr),
        ));
    }
    // eprintln, not tracing: dev-tool status output for the person running the seeder.
    eprintln!("verified {} is git-ignored", local.display());
    Ok(())
}

// What:     `fn extract_string_literals(src: &[u8]) -> Vec<Vec<u8>>`.
//           Tiny byte-state-machine that walks the source
//           recognising `"..."` literals, handling `\"` escapes
//           inside. Does NOT handle raw string literals (`r"..."`)
//           nor byte string literals (`b"..."`); those would
//           require more state but are rare in the test files.
// Why:      Pull the test fixtures' string literals without
//           depending on a full Rust parser. The format is
//           predictable enough that a 30-line state machine
//           covers what we need.
fn extract_string_literals(src: &[u8]) -> Vec<Vec<u8>> {
    let mut out: Vec<Vec<u8>> = Vec::new();
    let mut i = 0usize;
    while i < src.len() {
        // Skip line comments.
        if i + 1 < src.len() && src[i] == b'/' && src[i + 1] == b'/' {
            while i < src.len() && src[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        // Skip raw and byte literals -- we explicitly do not
        // extract their contents; treat the opening as a normal
        // character and let the state machine ignore it.
        if src[i] == b'"' {
            // Plain "..." literal.
            i += 1;
            let mut buf: Vec<u8> = Vec::new();
            let mut closed = false;
            while i < src.len() {
                if src[i] == b'\\' && i + 1 < src.len() {
                    // Recognise the common escape sequences.
                    let next = src[i + 1];
                    match next {
                        b'"' => buf.push(b'"'),
                        b'\\' => buf.push(b'\\'),
                        b'n' => buf.push(b'\n'),
                        b'r' => buf.push(b'\r'),
                        b't' => buf.push(b'\t'),
                        b'0' => buf.push(0),
                        b'x' => {
                            // \xHH
                            if i + 3 < src.len() {
                                if let Ok(hex) =
                                    std::str::from_utf8(&src[i + 2..i + 4])
                                {
                                    if let Ok(b) = u8::from_str_radix(hex, 16) {
                                        buf.push(b);
                                        i += 4;
                                        continue;
                                    }
                                }
                            }
                            // unknown shape; pass through
                            buf.push(b'\\');
                            buf.push(next);
                        }
                        _ => {
                            // Skip other escapes (e.g. \u{XXXX}) -
                            // a complete decoder is overkill.
                            buf.push(b'\\');
                            buf.push(next);
                        }
                    }
                    i += 2;
                    continue;
                }
                if src[i] == b'"' {
                    closed = true;
                    i += 1;
                    break;
                }
                buf.push(src[i]);
                i += 1;
            }
            if closed && !buf.is_empty() {
                out.push(buf);
            }
            continue;
        }
        i += 1;
    }
    out
}

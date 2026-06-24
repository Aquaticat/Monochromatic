//! Throughput benchmark: forbidden-regex vs the regex crate on a pre-serialized set.
//!
//! What: compiles the shared pattern set in both engines, reloads forbidden-regex
//! from its serialized bytes, checks both agree on how many corpus lines match, then
//! times `is_match` over the corpus and prints lines/s, MB/s, and the speedup. Why:
//! `regex` cannot express `&`/`~`, but on the overlapping dialect the restricted
//! engine should still win on raw scanning throughput; this measures whether it does.

/// The synthetic corpus generator.
mod corpus;

/// The shared pattern set.
mod patterns;

/// Imports the optimization barrier so match work is not elided.
use std::hint::black_box;

/// Imports the wall-clock timer for throughput measurement.
use std::time::Instant;

/// Imports the corpus builder and its size.
use crate::corpus::build_corpus;

/// Imports the shared pattern set.
use crate::patterns::PATTERNS;

/// Times this many full scans of the corpus per trial.
const PASSES: usize = 40;

/// Keeps the fastest of this many trials, to suppress scheduling noise.
const TRIALS: usize = 5;

/// Builds both engines, checks parity, times them, and prints the comparison.
///
/// What: the whole benchmark, end to end. Why: a single command (`mise run
/// //packages/rust-module/forbidden-regex.bench:run`) that proves the throughput
/// claim or refutes it.
fn main() {
    let corpus = build_corpus();
    let lines = corpus.len();
    let bytes: usize = corpus.iter().map(Vec::len).sum();

    // forbidden-regex: build, serialize, reload, so the timed form is the one a
    // caller would load from disk.
    let fset = forbidden_regex::RegexSet::new(PATTERNS).expect("forbidden-regex compiles");
    let serialized = fset.to_bytes().expect("forbidden-regex serializes");
    let fset =
        forbidden_regex::RegexSet::from_bytes(&serialized).expect("forbidden-regex reloads");

    // regex baseline, byte API so both match on the same `&[u8]` lines.
    let rset = regex::bytes::RegexSet::new(PATTERNS).expect("regex compiles");

    // Parity: a fair race requires both engines to do the same work.
    let fhits = corpus.iter().filter(|line| fset.is_match(line.as_slice())).count();
    let rhits = corpus.iter().filter(|line| rset.is_match(line.as_slice())).count();
    println!("corpus: {lines} lines, {bytes} bytes; matches: forbidden-regex={fhits}, regex={rhits}");
    if fhits != rhits {
        eprintln!("WARNING: engines disagree on match count; the comparison is not apples to apples");
    }

    let fsecs = best_secs(&corpus, |line| fset.is_match(line));
    let rsecs = best_secs(&corpus, |line| rset.is_match(line));
    report("forbidden-regex", lines, bytes, fsecs);
    report("regex          ", lines, bytes, rsecs);

    let speedup = rsecs / fsecs;
    println!("\nforbidden-regex is {speedup:.2}x the throughput of regex");
    println!("serialized ruleset: {} bytes", serialized.len());
}

/// Returns the fastest wall-clock time to scan the whole corpus `PASSES` times.
///
/// What: warms up once, then keeps the minimum elapsed time over `TRIALS`. Why: the
/// minimum is the cleanest estimate of the engine's steady-state throughput.
fn best_secs<F: Fn(&[u8]) -> bool>(corpus: &[Vec<u8>], is_match: F) -> f64 {
    let mut warm = 0u64;
    for line in corpus {
        if is_match(line) {
            warm += 1;
        }
    }
    black_box(warm);
    let mut best = f64::INFINITY;
    for _ in 0..TRIALS {
        let start = Instant::now();
        let mut acc = 0u64;
        for _ in 0..PASSES {
            for line in corpus {
                if is_match(black_box(line.as_slice())) {
                    acc += 1;
                }
            }
        }
        black_box(acc);
        best = best.min(start.elapsed().as_secs_f64());
    }
    best
}

/// Prints one engine's throughput line.
///
/// What: derives lines/s and MB/s from the total scanned work and the best time.
/// Why: the two figures make the comparison legible at a glance.
fn report(name: &str, lines: usize, bytes: usize, best_secs: f64) {
    let passes = PASSES as f64;
    let lines_per_sec = lines as f64 * passes / best_secs;
    let mb_per_sec = bytes as f64 * passes / best_secs / 1_000_000.0;
    println!("{name}: {lines_per_sec:>13.0} lines/s   {mb_per_sec:>8.1} MB/s");
}

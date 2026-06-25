//! Throughput benchmark: forbidden-regex vs the regex crate on the real ruleset.
//!
//! What: loads the shipped forbidden-strings rules, ports each into this engine's
//! dialect, compile-filters to the subset both engines accept, then feeds our
//! scanner the `&`/`~` versions and `regex` the complement-stripped versions and
//! times `is_match` over a mostly-non-matching corpus. Why: `regex` cannot express
//! `&`/`~`, but on the overlapping dialect the restricted engine should still win on
//! raw scanning throughput; this measures whether it does on realistic rules.

/// The synthetic corpus generator.
mod corpus;

/// The dialect normalizer.
mod normalize;

/// The per-rule porter.
mod port;

/// The real ruleset loader.
mod rules;

/// Imports the optimization barrier so match work is not elided.
use std::hint::black_box;

/// Imports the wall-clock timer for throughput measurement.
use std::time::Instant;

/// Imports the corpus builder.
use crate::corpus::build_corpus;

/// Imports the ruleset loader.
use crate::rules::load_rules;

/// Wall-clock budget each engine is timed for.
const BUDGET_SECS: f64 = 10.0;

/// Lines checked for engine parity before timing.
const PARITY_SAMPLE: usize = 5_000;

/// Builds both engines from the ported rules, checks parity, and times them.
///
/// What: the whole benchmark, end to end. Why: a single command that proves the
/// throughput claim or refutes it on the realistic ruleset.
fn main() {
    let pairs = load_rules();
    eprintln!("[phase] loaded {} rules", pairs.len());

    // Keep only rules `regex` accepts, so its RegexSet build cannot fail wholesale.
    let regex_filter = Instant::now();
    let usable: Vec<&(String, String)> = pairs
        .iter()
        .filter(|(_, bare)| regex::bytes::Regex::new(bare).is_ok())
        .collect();
    eprintln!(
        "[phase] regex-filter kept {} rules in {:.2}s",
        usable.len(),
        regex_filter.elapsed().as_secs_f64()
    );

    // Build ours once, leniently: rules this dialect cannot express are dropped.
    let ours_all: Vec<&str> = usable.iter().map(|(our, _)| our.as_str()).collect();
    let build_ours = Instant::now();
    let (fset, kept) = forbidden_regex::RegexSet::compile_lenient(&ours_all);
    let serialized = fset.to_bytes().expect("forbidden-regex serializes");
    println!(
        "build+serialize ours: {:.2}s for {} rules, {} bytes",
        build_ours.elapsed().as_secs_f64(),
        kept.len(),
        serialized.len()
    );
    let fset =
        forbidden_regex::RegexSet::from_bytes(&serialized).expect("forbidden-regex reloads");
    eprintln!(
        "[diag] seedless rules: {} collapsed into {} union DFA(s)",
        fset.seedless_count(),
        fset.seedless_group_count()
    );

    // Build regex over exactly the rules ours kept, so both race the same set. The
    // size limits are raised because the stripped generic-shape rules compile to a
    // large automaton; serialized/compiled size is not a constraint here.
    let bare_kept: Vec<&str> = kept.iter().map(|&i| usable[i].1.as_str()).collect();
    let build_regex = Instant::now();
    let rset = regex::bytes::RegexSetBuilder::new(&bare_kept)
        .size_limit(1 << 30)
        .dfa_size_limit(1 << 30)
        .build()
        .expect("regex compiles");
    println!("build regex: {:.2}s for {} rules", build_regex.elapsed().as_secs_f64(), bare_kept.len());

    let corpus = build_corpus();
    let lines = corpus.len();
    let bytes: usize = corpus.iter().map(Vec::len).sum();

    // Parity on a bounded sample: a systematic porter mismatch shows up here without
    // an unbounded full-corpus pass.
    let sample = &corpus[..corpus.len().min(PARITY_SAMPLE)];
    let fhits = sample.iter().filter(|line| fset.is_match(line.as_slice())).count();
    let rhits = sample.iter().filter(|line| rset.is_match(line.as_slice())).count();
    println!("parity ({} lines): forbidden-regex={fhits}, regex={rhits}", sample.len());
    if fhits != rhits {
        eprintln!("WARNING: engines disagree on the sample; comparison is not apples to apples");
    }

    let prefilter_hits = corpus.iter().filter(|l| fset.prefilter_only_is_match(l)).count();
    eprintln!("[diag] prefilter flags {prefilter_hits}/{lines} lines (each triggers the per-rule fallback)");
    let seeded = fset.len() - fset.seedless_count();
    eprintln!("[diag] anchored {}/{seeded} seeded rules (rest fall back to counting)", fset.anchored_count());

    let avg_len = bytes as f64 / lines as f64;
    let threads = std::thread::available_parallelism().map_or(1, |n| n.get());
    println!("scanning {threads} threads per engine, {BUDGET_SECS:.0}s each");
    // forbidden-regex is immutable, so all threads share the one instance (no
    // per-thread state). regex needs a mutable lazy-DFA cache, so each thread clones
    // it (the program is Arc-shared, so this is the cheap idiomatic parallel form and
    // lets regex scale instead of contending on a shared cache).
    let frate = throughput(&corpus, || (), |_, line| fset.is_match(line), threads);
    let rrate = throughput(&corpus, || rset.clone(), |r, line| r.is_match(line), threads);
    // Profiling split: prefilter-only vs gate-only vs seedless-only, to locate the
    // per-line bottleneck (prefilter cost vs per-rule fallback vs literal-free scans).
    let prefilter_rate = throughput(&corpus, || (), |_, line| fset.prefilter_only_is_match(line), threads);
    let candidates_rate = throughput(&corpus, || (), |_, line| fset.candidates_only_is_match(line), threads);
    let anchored_rate = throughput(&corpus, || (), |_, line| fset.gate_anchored_only_is_match(line), threads);
    let gate_rate = throughput(&corpus, || (), |_, line| fset.gate_only_is_match(line), threads);
    let seedless_rate = throughput(&corpus, || (), |_, line| fset.seedless_only_is_match(line), threads);
    report("forbidden-regex", frate, avg_len);
    report("  prefilter-only", prefilter_rate, avg_len);
    report("  candidates    ", candidates_rate, avg_len);
    report("  anchored-only ", anchored_rate, avg_len);
    report("  gate-only     ", gate_rate, avg_len);
    report("  seedless-only ", seedless_rate, avg_len);
    report("regex          ", rrate, avg_len);
    println!("\nforbidden-regex is {:.2}x the throughput of regex", frate / rrate);
}

/// Scans the corpus on repeat for `BUDGET_SECS` across `threads`, returning total
/// lines per second.
///
/// What: each worker builds its OWN matcher via `make` (a per-thread clone), then
/// loops full corpus passes until the budget elapses, summing every line scanned.
/// Why: a per-thread matcher gives each engine independent state, so both scale up
/// with cores; sharing one matcher would serialize an engine on its internal cache
/// and unfairly slow it down. The fixed time budget bounds the run.
fn throughput<M, Make, Run>(corpus: &[Vec<u8>], make: Make, run: Run, threads: usize) -> f64
where
    Make: Fn() -> M + Sync,
    Run: Fn(&M, &[u8]) -> bool + Sync,
{
    let start = Instant::now();
    let total: u64 = std::thread::scope(|scope| {
        let workers: Vec<_> = (0..threads)
            .map(|_| {
                scope.spawn(|| {
                    let matcher = make();
                    let mut scanned = 0u64;
                    let mut acc = 0u64;
                    while start.elapsed().as_secs_f64() < BUDGET_SECS {
                        for line in corpus {
                            if run(&matcher, black_box(line.as_slice())) {
                                acc += 1;
                            }
                        }
                        scanned += corpus.len() as u64;
                    }
                    black_box(acc);
                    scanned
                })
            })
            .collect();
        workers.into_iter().map(|w| w.join().unwrap()).sum()
    });
    total as f64 / start.elapsed().as_secs_f64()
}

/// Prints one engine's throughput line.
///
/// What: reports lines/s and the derived MB/s from the average line length. Why: the
/// two figures make the comparison legible at a glance.
fn report(name: &str, lines_per_sec: f64, avg_len: f64) {
    let mb_per_sec = lines_per_sec * avg_len / 1_000_000.0;
    println!("{name}: {lines_per_sec:>13.0} lines/s   {mb_per_sec:>8.1} MB/s");
}

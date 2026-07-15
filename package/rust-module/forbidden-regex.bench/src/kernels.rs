//! Batch-kernel sweep: bucket width and sorting strategy for the single-DFA kernels.
//!
//! What: races the scalar per-line loop against the interleaved batch kernel at bucket
//! widths 8/16/32/64 on length-sorted input, the branchless tight kernel on exact-length
//! buckets, the bucketed public API, and the one- and two-byte Sheng permute kernels, and
//! reports the sort cost. Why: the scalar single-line scan is latency-bound on the
//! dependent transition load; this finds which layout beats it, and by how much, in the
//! realistic low-match regime a secret scanner sees.

/// Imports the optimization barrier so verdicts are not elided.
use std::hint::black_box;

/// Imports the map used to build exact-length buckets.
use std::collections::HashMap;

/// Imports the wall-clock timer.
use std::time::Instant;

/// Wall-clock budget timed per kernel configuration.
const BUDGET_SECS: f64 = 4.0;

/// Patterns whose DFA runs on every line, spanning the realistic low-match regime.
const PATTERNS: [&str; 3] = ["[A-Za-z0-9]{8}", "[A-Za-z0-9_+/=.-]{20}", "[0-9a-f]{32}"];

/// Times one whole-corpus batch closure for the budget, returning lines/s.
fn rate(refs: &[&[u8]], run: impl Fn(&[&[u8]]) -> Vec<bool>) -> f64 {
    let start = Instant::now();
    let mut scanned = 0u64;
    while start.elapsed().as_secs_f64() < BUDGET_SECS {
        black_box(run(black_box(refs)));
        scanned += refs.len() as u64;
    }
    scanned as f64 / start.elapsed().as_secs_f64()
}

/// Times a kernel run over pre-grouped exact-length buckets, returning lines/s.
fn bucket_rate(buckets: &[Vec<&[u8]>], run: impl Fn(&[&[u8]]) -> Vec<bool>) -> f64 {
    let lines: u64 = buckets.iter().map(|bucket| bucket.len() as u64).sum();
    let start = Instant::now();
    let mut scanned = 0u64;
    while start.elapsed().as_secs_f64() < BUDGET_SECS {
        for bucket in buckets {
            black_box(run(bucket));
        }
        scanned += lines;
    }
    scanned as f64 / start.elapsed().as_secs_f64()
}

/// Groups line refs into one bucket per exact byte length.
fn exact_buckets<'a>(refs: &[&'a [u8]]) -> Vec<Vec<&'a [u8]>> {
    let mut by_len: HashMap<usize, Vec<&'a [u8]>> = HashMap::new();
    for &line in refs {
        by_len.entry(line.len()).or_default().push(line);
    }
    by_len.into_values().collect()
}

/// Runs the bucket-width and sorting-strategy sweep over the corpus.
///
/// What: for each pattern, prints scalar lines/s and the ratios of the interleaved kernel
/// (four bucket widths, length-sorted), the tight kernel (exact buckets), the bucketed
/// public API, and the one- and two-byte Sheng kernels, plus the sort cost. Why: answers
/// whether a length-bucketed batch and the permute kernels beat the per-line loop, and how.
pub fn bench_buckets(corpus: &[Vec<u8>], avg_len: f64) {
    let refs: Vec<&[u8]> = corpus.iter().map(Vec::as_slice).collect();
    let mut sorted = refs.clone();
    sorted.sort_by_key(|line| line.len());
    let buckets = exact_buckets(&refs);
    println!(
        "\n[buckets] {} lines (avg {:.1} B), {:.0}s each, {} exact-length buckets. ratios vs scalar:",
        refs.len(),
        avg_len,
        BUDGET_SECS,
        buckets.len(),
    );
    for pattern in PATTERNS {
        let re = forbidden_regex::compile(pattern).expect("pattern compiles");
        let oracle = re.is_match_batch_scalar(&refs);
        assert_eq!(re.batch_inter_w::<16>(&refs), oracle, "inter disagrees for {pattern}");
        let scalar = rate(&refs, |lines| re.is_match_batch_scalar(lines));
        let inter = [
            rate(&sorted, |l| re.batch_inter_w::<8>(l)),
            rate(&sorted, |l| re.batch_inter_w::<16>(l)),
            rate(&sorted, |l| re.batch_inter_w::<32>(l)),
            rate(&sorted, |l| re.batch_inter_w::<64>(l)),
        ];
        // Correctness: the branchless tight kernel must match scalar on an exact bucket.
        if let Some(bucket) = buckets.iter().find(|bucket| bucket.len() >= 64) {
            let bucket_oracle: Vec<bool> =
                bucket.iter().map(|line| re.is_match_batch_scalar(&[line])[0]).collect();
            assert_eq!(re.batch_tight_w::<32>(bucket), bucket_oracle, "tight disagrees for {pattern}");
        }
        let tight = [
            bucket_rate(&buckets, |l| re.batch_tight_w::<16>(l)),
            bucket_rate(&buckets, |l| re.batch_tight_w::<32>(l)),
            bucket_rate(&buckets, |l| re.batch_tight_w::<64>(l)),
        ];
        // The shipped public API: it sorts internally, so measure it both ways. On
        // already length-sorted input the internal sort is near-linear (the scanner case);
        // on unsorted input it pays the full sort (the convenience case).
        assert_eq!(re.is_match_batch_bucketed(&refs), oracle, "bucketed disagrees for {pattern}");
        assert_eq!(re.batch_sheng(&refs), oracle, "sheng disagrees for {pattern}");
        assert_eq!(re.batch_sheng2(&refs), oracle, "sheng2 disagrees for {pattern}");
        let api_presorted = rate(&sorted, |l| re.is_match_batch_bucketed(l));
        // Sheng needs no bucketing or sorting: a per-line scan with permute transitions.
        let sheng = rate(&refs, |l| re.batch_sheng(l));
        let sheng2 = rate(&refs, |l| re.batch_sheng2(l));
        println!(
            "  {pattern:20} table={} scalar {scalar:>11.0} | sorted inter[8/16/32/64] {:.2} {:.2} {:.2} {:.2} | exact-tight[16/32/64] {:.2} {:.2} {:.2} | api-presorted {:.2} | sheng {:.2} | sheng2 {:.2}",
            re.is_table(),
            inter[0] / scalar, inter[1] / scalar, inter[2] / scalar, inter[3] / scalar,
            tight[0] / scalar, tight[1] / scalar, tight[2] / scalar,
            api_presorted / scalar,
            sheng / scalar,
            sheng2 / scalar,
        );
    }
    let start = Instant::now();
    let mut probe = refs.clone();
    probe.sort_by_key(|line| line.len());
    black_box(&probe);
    let sort_ms = start.elapsed().as_secs_f64() * 1_000.0;
    println!(
        "[sort-cost] sorting {} refs by length: {sort_ms:.2} ms ({:.0} lines/s if amortized into one batch)",
        refs.len(),
        refs.len() as f64 / start.elapsed().as_secs_f64(),
    );
}

/// Compares the set-level batch layouts on the real ruleset over the corpus.
///
/// What: confirms the concatenated-buffer gate sweep agrees with the per-line loop, then
/// times both single-threaded. Why: the set pipeline's real cost is the per-line
/// prefilter on short lines; one long-buffer sweep is the approach that can beat it.
pub fn bench_set_batch(set: &forbidden_regex::RegexSet, corpus: &[Vec<u8>]) {
    let refs: Vec<&[u8]> = corpus.iter().map(Vec::as_slice).collect();
    let oracle = set.is_match_batch(&refs);
    assert_eq!(set.is_match_batch_concat(&refs), oracle, "concat batch disagrees with per-line");
    let hits = oracle.iter().filter(|&&hit| hit).count();
    let scalar = rate(&refs, |lines| set.is_match_batch(lines));
    let concat = rate(&refs, |lines| set.is_match_batch_concat(lines));
    println!(
        "\n[set-batch] over {} lines, hits {hits}: scalar-loop {scalar:>12.0}  concat-gate {concat:>12.0}  ({:.2}x)",
        refs.len(),
        concat / scalar,
    );
}

//! Corpus evaluation and corrected-target search for the shared true-peak policy.
//!
//! Reads a per-track measurement corpus (full true peak plus per-second bin peaks),
//! computes the corrected decoded-seconds target (`total decodable seconds / 4`), and
//! ranks window policies by the decided objective using the shared truepeak-core math.
//! Usage: `truepeak-core-bench <tracks.jsonl> [window_count]`.

/// The per-track corpus record and loader.
mod corpus;
/// The per-candidate evaluation against the corpus.
mod evaluate;
/// The classifier that routes risky long tracks to a full scan from probe features.
mod classify;
/// The feasible no-classifier model: minimize the fixed margin by probe density.
mod feasible;
/// The corrected-target parameter search and ranking.
mod search;

/// Imports the process argument reader.
use std::env;
/// Imports the borrowed path type for the corpus location.
use std::path::Path;

/// Imports the corpus loader.
use crate::corpus::load_tracks;
/// Imports the classifier search, the feature diagnostic, and the per-track dump.
use crate::classify::{diagnose, fit_full_scan_rule, write_long_features};
/// Imports the feasible no-classifier density search.
use crate::feasible::best_feasible;
/// Imports the sweep and the objective ranking.
use crate::search::{rank, sweep};

/// The plan's quarter-library divisor for the benchmark target.
const TARGET_DIVISOR: f64 = 4.0;
/// Window counts to sweep: at a fixed threshold (decode budget) more, shorter windows
/// cover more distinct regions, shrinking the gaps that cause under-read violators.
const WINDOW_COUNTS: &[usize] = &[14, 20, 28, 40];

/// Build an inclusive-ish float grid from `start` to `end` stepping by `step`.
///
/// What: a small helper so the sweep grids read declaratively. Why: avoids hand-listing
/// dozens of thresholds and margins.
fn frange(start: f64, end: f64, step: f64) -> Vec<f64> {
    // Count the steps, then map each index to its value (functional, no mutable cursor).
    let steps = ((end - start) / step).round() as i64;
    (0..=steps).map(|index| start + index as f64 * step).collect()
}

/// Entry point: load the corpus, compute the target, search, and print the report.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let corpus_path = args
        .get(1)
        .ok_or("usage: truepeak-core-bench <tracks.jsonl>")?;

    let tracks = load_tracks(Path::new(corpus_path))?;
    let full_secs: f64 = tracks.iter().map(|track| track.duration_secs).sum();
    let target_secs = full_secs / TARGET_DIVISOR;

    println!("corpus: {} tracks", tracks.len());
    println!("full decodable seconds: {full_secs}");
    println!("corrected target (/{TARGET_DIVISOR}): {target_secs}");
    println!("window counts swept: {WINDOW_COUNTS:?}");

    // Sweep thresholds (converted to window seconds) and probe margins, per window count.
    let thresholds = frange(44.0, 60.0, 0.25);
    let margin_grid = frange(0.30, 2.00, 0.02);
    let mut scored = Vec::new();
    for &window_count in WINDOW_COUNTS {
        let seconds_grid: Vec<f64> = thresholds
            .iter()
            .map(|&threshold| threshold / window_count as f64)
            .collect();
        let mut points = sweep(&tracks, window_count, &seconds_grid, &margin_grid, target_secs);
        scored.append(&mut points);
    }
    let ranked = rank(scored, target_secs);

    println!("\nin-budget candidates ranked by objective (loudest-safe, then simplest):");
    for point in ranked.iter().take(8) {
        let report = &point.report;
        println!(
            "  count={} thr={:.2}s ws={:.4}s margin={:.3}dB | decoded={:.1}s delta={:+.1}s | violators={} accepted={} short={} | worst_loud={:+.3}dB worst_quiet={:+.3}dB",
            report.candidate.window_count,
            report.threshold_secs,
            report.candidate.window_seconds,
            report.candidate.probe_margin_db,
            report.decoded_secs,
            report.decoded_secs - target_secs,
            report.violators.len(),
            report.accepted_count,
            report.short_count,
            report.worst_too_loud_db,
            report.worst_too_quiet_db,
        );
    }

    // For the best in-budget point, fit the probe-only full-scan classifier and report
    // the real routed budget (the oracle above assumes a perfect classifier).
    if let Some(best) = ranked.first() {
        println!();
        diagnose(&tracks, best.report.candidate);
        // Dump per-track features so a metadata-aware classifier can be evaluated offline.
        write_long_features(&tracks, best.report.candidate, Path::new("out/long_features.jsonl"))?;
        println!("wrote per-track features to out/long_features.jsonl");
        let rule = fit_full_scan_rule(&tracks, best.report.candidate, target_secs);
        println!(
            "\nbest candidate (count={}) + fitted classifier:",
            best.report.candidate.window_count
        );
        println!("  {rule}");
        // Exception list the classifier must catch (full paths, per the plan).
        println!("\nviolators to catch ({}):", best.report.violators.len());
        for violator in &best.report.violators {
            println!(
                "  err={:+.3}dB sampled_max={:.4} dur={:.0}s {}",
                violator.error_db, violator.sampled_max, violator.duration_secs, violator.path
            );
        }
    } else {
        println!("\nno candidate fits the corrected target for any swept window count");
    }

    // The feasible no-classifier model: the budget cannot afford a full-scan router, so
    // ship a single fixed margin and spend the budget on probe density to shrink it.
    let quiet_bound_db = truepeak_core::default_policy().max_too_quiet_db;
    let dense_counts = [20usize, 28, 40, 56, 80];
    let dense_thresholds = frange(40.0, 56.0, 1.0);
    let feasibles = best_feasible(&tracks, &dense_counts, &dense_thresholds, target_secs, quiet_bound_db);
    println!("\nfeasible no-classifier model (no full scans; single fixed margin), best densities:");
    for point in feasibles.iter().filter(|point| point.feasible).take(30) {
        let threshold = point.candidate.window_count as f64 * point.candidate.window_seconds;
        println!(
            "  count={} thr={:.1}s ws={:.4}s | margin={:.3}dB worst_quiet={:+.3}dB | probe_decoded={:.0}s delta={:+.0}s",
            point.candidate.window_count,
            threshold,
            point.candidate.window_seconds,
            point.margin_db,
            point.worst_quiet_db,
            point.probe_decoded_secs,
            point.probe_decoded_secs - target_secs,
        );
    }

    Ok(())
}

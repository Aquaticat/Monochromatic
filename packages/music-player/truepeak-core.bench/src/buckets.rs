//! The bucket-first composite: per-provenance coverage and margin, with the FLAC
//! bones-guided probe.
//!
//! Buckets come from embedded tags only (codec, store IDs, iTunNORM, youtube provenance;
//! never path text). Their zoom tails diverge hard: FLAC's frame sizes track signal level
//! (lossless bits follow residual entropy), so a bones-guided probe keeps FLAC accurate at
//! a fraction of the decode cost, and the freed seconds buy the risky untagged-lossy
//! bucket more coverage. Perceptual codecs' byte profiles were measured useless for this
//! (bits follow busyness, not height), so lossy buckets use the plain frontier zoom.

/// Imports the corpus track record.
use crate::corpus::Track;
/// Imports the max-heap driving the frontier expansion.
use std::collections::BinaryHeap;
/// Imports the tag and profile join maps.
use std::collections::HashMap;
/// Imports the line-by-line side-file readers.
use std::fs::File;
/// Imports buffered reading so the side files stream.
use std::io::{BufRead, BufReader};
/// Imports the borrowed path type for side-file locations.
use std::path::Path;

/// Imports serde's derive so side-file rows parse straight from each JSON line.
use serde::Deserialize;
/// Imports the shared dB conversion.
use truepeak_core::peak_dbtp;

/// One row of the embedded-tag sweep (analysis/tags-sweep.mjs output).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TagRow {
    /// Track path, the join key against the corpus.
    path: String,
    /// Audio codec name from ffprobe (`flac`, `opus`, `aac`, `mp3`).
    codec: Option<String>,
    /// Whether store identifiers (ISRC/UPC/content ids) are embedded.
    #[serde(default)]
    has_store_ids: bool,
    /// Whether an iTunNORM tag is embedded.
    #[serde(default)]
    has_itun_norm: bool,
    /// Whether a youtube provenance tag (purl or youtube comment) is embedded.
    #[serde(default)]
    has_purl: bool,
}

/// One row of the FLAC frame-size profile file (analysis/flac-bones.mjs output).
#[derive(Deserialize)]
struct ProfileRow {
    /// Track path, the join key against the corpus.
    path: String,
    /// Compressed bytes per 0.1 s slot from the CRC-verified frame walk.
    bytes: Vec<u64>,
}

/// The provenance bucket a track probes under.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Bucket {
    /// Lossless FLAC: thin tail, bones-guided probe.
    Flac,
    /// Store-tagged lossy (ISRC/UPC/iTunNORM): mastered releases.
    Store,
    /// Youtube-provenance lossy: loudness-normalized sources.
    Purl,
    /// Untagged lossy: the risk bucket that gets the freed coverage.
    Bare,
}

/// One bucket's decided policy: coverage of each long track and the fixed margin.
#[derive(Clone, Copy, Debug)]
pub struct BucketPolicy {
    /// Fraction of the track's bins the probe decodes.
    pub coverage: f64,
    /// Fixed margin added to the probe in dB.
    pub margin_db: f64,
}

/// The decided composite (the answer's recommended dial).
///
/// What: FLAC probes at 7% coverage bones-guided with margin 0.45; purl at 14% margin
/// 0.5; store at 32% margin 0.3; bare at 34% margin 0.5. Why: the measured frontier
/// point that beats the uniform zoom on all three measures at once.
pub fn decided_assignment() -> HashMap<Bucket, BucketPolicy> {
    HashMap::from([
        (Bucket::Flac, BucketPolicy { coverage: 0.07, margin_db: 0.45 }),
        (Bucket::Purl, BucketPolicy { coverage: 0.14, margin_db: 0.5 }),
        (Bucket::Store, BucketPolicy { coverage: 0.32, margin_db: 0.3 }),
        (Bucket::Bare, BucketPolicy { coverage: 0.34, margin_db: 0.5 }),
    ])
}

/// The even coverage of the FLAC hybrid's sparse pass.
const FLAC_EVEN_COVERAGE: f64 = 0.05;
/// How many top byte-rate slots seed the FLAC hybrid probe.
const FLAC_BONES_TOP: usize = 40;
/// The lossy buckets' even pass-one coverage (matches the zoom answer).
const LOSSY_PASS1_COVERAGE: f64 = 0.1;

/// Read the tag sweep into a per-path bucket map; tracks missing from the sweep fall
/// back to their file extension.
///
/// What: joins tags-full.jsonl rows to buckets. Why: bucket assignment must be
/// reproducible from committed side files, never from path text heuristics.
pub fn load_buckets(path: &Path) -> Result<HashMap<String, Bucket>, Box<dyn std::error::Error>> {
    // Stream rows and reduce each to its bucket.
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut map = HashMap::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let row: TagRow = serde_json::from_str(&line)?;
        let bucket = if row.codec.as_deref() == Some("flac") {
            Bucket::Flac
        } else if row.has_store_ids || row.has_itun_norm {
            Bucket::Store
        } else if row.has_purl {
            Bucket::Purl
        } else {
            Bucket::Bare
        };
        map.insert(row.path, bucket);
    }
    Ok(map)
}

/// The extension-fallback bucket for tracks the tag sweep missed.
fn bucket_from_extension(path: &str) -> Bucket {
    if path.ends_with(".flac") {
        Bucket::Flac
    } else {
        Bucket::Bare
    }
}

/// Read the FLAC frame-size profiles into a per-path top-slot list.
///
/// What: keeps only each profile's `FLAC_BONES_TOP` largest byte slots. Why: the probe
/// needs the slot indices, not the raw profile.
pub fn load_bones(path: &Path) -> Result<HashMap<String, Vec<usize>>, Box<dyn std::error::Error>> {
    // Stream rows, sort slot indices by byte count, keep the top few.
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut map = HashMap::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let row: ProfileRow = serde_json::from_str(&line)?;
        let mut order: Vec<usize> = (0..row.bytes.len()).collect();
        order.sort_by(|&a, &b| row.bytes[b].cmp(&row.bytes[a]));
        order.truncate(FLAC_BONES_TOP);
        map.insert(row.path, order);
    }
    Ok(map)
}

/// Convert a linear peak to dBTP, treating silence as a very negative level.
fn db(peak: f64) -> f64 {
    if peak <= 0.0 {
        f64::NEG_INFINITY
    } else {
        peak_dbtp(peak)
    }
}

/// The hybrid probe: optional bones seed slots (each ±1), an even pass, then frontier
/// zoom until the bin budget is spent; returns the loudest decoded bin and decoded secs.
///
/// What: the same climb as `zoom.rs`, seeded by byte-rate hot spots when a profile
/// exists. Why: for lossless codecs the byte profile points at loud passages, so the
/// climb starts on the right hills at a fraction of the coverage.
fn hybrid_probe(track: &Track, coverage: f64, even_coverage: f64, bones: Option<&Vec<usize>>) -> (f64, f64) {
    let bins = &track.bin_peaks;
    let n = bins.len();
    let budget_bins = ((coverage * n as f64).floor() as usize).max(1);
    let mut decoded = vec![false; n];
    // Non-negative f32 bit patterns order like the values; the heap pops loudest first.
    let mut heap: BinaryHeap<(u32, usize)> = BinaryHeap::new();
    let mut used = 0usize;
    let mut peak = 0.0f32;
    let decode = |index: usize,
                  decoded: &mut Vec<bool>,
                  heap: &mut BinaryHeap<(u32, usize)>,
                  used: &mut usize,
                  peak: &mut f32| {
        decoded[index] = true;
        *used += 1;
        if bins[index] > *peak {
            *peak = bins[index];
        }
        heap.push((bins[index].to_bits(), index));
    };
    if let Some(slots) = bones {
        for &slot in slots {
            let lo = slot.saturating_sub(1);
            let hi = (slot + 1).min(n.saturating_sub(1));
            for index in lo..=hi {
                if !decoded[index] && used < budget_bins {
                    decode(index, &mut decoded, &mut heap, &mut used, &mut peak);
                }
            }
        }
    }
    let count = ((even_coverage * n as f64).round() as usize).max(1);
    let span = n - 1;
    for step in 0..count {
        if used >= budget_bins {
            break;
        }
        let index = if count <= 1 {
            span / 2
        } else {
            ((step as f64 / (count - 1) as f64) * span as f64).round() as usize
        };
        if !decoded[index] {
            decode(index, &mut decoded, &mut heap, &mut used, &mut peak);
        }
    }
    while used < budget_bins {
        let Some((_, index)) = heap.pop() else {
            break;
        };
        if index > 0 && !decoded[index - 1] && used < budget_bins {
            decode(index - 1, &mut decoded, &mut heap, &mut used, &mut peak);
        }
        if index + 1 < n && !decoded[index + 1] && used < budget_bins {
            decode(index + 1, &mut decoded, &mut heap, &mut used, &mut peak);
        }
    }
    (f64::from(peak), used as f64 * track.bin_seconds)
}

/// One probed long track under the composite: levels, margin, and its bucket.
#[derive(Clone, Debug)]
pub struct BucketRow {
    /// Full-track true peak in dBTP.
    pub full_db: f64,
    /// Loudest decoded bin in dBTP.
    pub probe_db: f64,
    /// The margin its bucket assigns in dB.
    pub margin_db: f64,
    /// The bucket, for clamp breakdowns.
    pub bucket: Bucket,
}

/// Print the decided composite's report: budget, three measures, clamp breakdown.
///
/// What: loads the two side files (tag sweep, FLAC profiles), evaluates the decided
/// assignment, and prints the letter's measures. Why: the committed, reproducible
/// evaluation of the bucket-first answer.
pub fn report_buckets(
    tracks: &[Track],
    full_secs: f64,
    target_secs: f64,
    args: &[String],
) -> Result<(), Box<dyn std::error::Error>> {
    // The side files are the non-flag arguments after the corpus path, in order.
    let side: Vec<&String> = args.iter().skip(2).filter(|arg| !arg.starts_with("--")).collect();
    let tags_path = side
        .first()
        .ok_or("usage: truepeak-core-bench <corpus> <tags-full.jsonl> [flac-profiles.jsonl] --buckets")?;
    let buckets = load_buckets(Path::new(tags_path))?;
    let bones = match side.get(1) {
        Some(profiles_path) => load_bones(Path::new(profiles_path))?,
        None => HashMap::new(),
    };
    let policy = truepeak_core::default_policy();
    let assignment = decided_assignment();
    let (decoded, rows) = evaluate_buckets(tracks, policy.short_scan_max_secs, &assignment, &buckets, &bones);
    println!("\nbucket composite (flac bones-guided; coverage/margin per provenance bucket):");
    for (bucket, bucket_policy) in [
        (Bucket::Flac, assignment[&Bucket::Flac]),
        (Bucket::Store, assignment[&Bucket::Store]),
        (Bucket::Purl, assignment[&Bucket::Purl]),
        (Bucket::Bare, assignment[&Bucket::Bare]),
    ] {
        let members = rows.iter().filter(|row| row.bucket == bucket).count();
        println!(
            "  {bucket:?}: coverage={} margin={}dB long_tracks={members}",
            bucket_policy.coverage, bucket_policy.margin_db
        );
    }
    println!(
        "decoded={decoded:.0}s ({:.2}% of corpus) target={target_secs:.0}s {}",
        100.0 * decoded / full_secs,
        if decoded <= target_secs { "IN BUDGET" } else { "OVER" }
    );
    // The letter's three measures over every track (shorts are exact, zero error).
    let mut clamps: HashMap<Bucket, usize> = HashMap::new();
    let mut quiet_sum = 0.0f64;
    let mut worst_quiet = 0.0f64;
    let mut worst_over = 0.0f64;
    for row in &rows {
        let necessary = (row.full_db - policy.ceiling_dbtp).max(0.0);
        let applied = (row.probe_db + row.margin_db - policy.ceiling_dbtp).max(0.0);
        quiet_sum += (applied - necessary).max(0.0);
        worst_quiet = worst_quiet.max((applied - necessary).max(0.0));
        worst_over = worst_over.max((necessary - applied).max(0.0));
        if row.full_db > policy.ceiling_dbtp
            && row.full_db - row.probe_db - row.margin_db > policy.max_too_loud_db
        {
            *clamps.entry(row.bucket).or_insert(0) += 1;
        }
    }
    let clamp_total: usize = clamps.values().sum();
    println!(
        "clamped={clamp_total} (flac={} store={} purl={} bare={}) avg_quiet={:.3}dB worst_quiet={:.2}dB worst_over={:.2}dB",
        clamps.get(&Bucket::Flac).unwrap_or(&0),
        clamps.get(&Bucket::Store).unwrap_or(&0),
        clamps.get(&Bucket::Purl).unwrap_or(&0),
        clamps.get(&Bucket::Bare).unwrap_or(&0),
        quiet_sum / tracks.len() as f64,
        worst_quiet,
        worst_over,
    );
    Ok(())
}

/// Evaluate the decided composite over the corpus.
///
/// What: short tracks full-scan; each long track probes under its bucket's coverage
/// (FLAC hybrid when a profile exists) and carries its bucket's margin. Why: one row
/// per track is everything the report needs.
pub fn evaluate_buckets(
    tracks: &[Track],
    short_scan_max_secs: f64,
    assignment: &HashMap<Bucket, BucketPolicy>,
    buckets: &HashMap<String, Bucket>,
    bones: &HashMap<String, Vec<usize>>,
) -> (f64, Vec<BucketRow>) {
    // Fold each track into the decoded total and its measured row.
    let mut decoded: f64 = tracks
        .iter()
        .filter(|track| track.duration_secs <= short_scan_max_secs)
        .map(|track| track.duration_secs)
        .sum();
    let mut rows = Vec::new();
    for track in tracks {
        if track.duration_secs <= short_scan_max_secs {
            continue;
        }
        let bucket = buckets
            .get(&track.path)
            .copied()
            .unwrap_or_else(|| bucket_from_extension(&track.path));
        let policy = assignment[&bucket];
        let track_bones = if bucket == Bucket::Flac { bones.get(&track.path) } else { None };
        let even = if track_bones.is_some() {
            FLAC_EVEN_COVERAGE
        } else {
            LOSSY_PASS1_COVERAGE.min(policy.coverage)
        };
        let (peak, used_secs) = hybrid_probe(track, policy.coverage, even, track_bones);
        decoded += used_secs;
        rows.push(BucketRow {
            full_db: db(f64::from(track.full_peak)),
            probe_db: db(peak),
            margin_db: policy.margin_db,
            bucket,
        });
    }
    (decoded, rows)
}

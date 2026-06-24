//! Deterministic synthetic corpus: mostly non-matching code-like lines plus keys.

/// Lines in the corpus.
///
/// What: the per-pass line count. Why: bounds the benchmark to a fixed, modest
/// working set so a run never threatens the host.
pub const CORPUS_LINES: usize = 50_000;

/// One in this many lines carries a real key; the rest never match.
///
/// What: the positive-line stride. Why: a secret scanner mostly sees non-matching
/// source, so the throughput that matters is the full-line no-match scan.
const POSITIVE_EVERY: usize = 100;

/// Bytes a non-matching line may contain: lowercase, digits, safe punctuation.
///
/// What: excludes uppercase, `_`, and `-`. Why: no pattern can then match by
/// chance, so the match-count parity check between engines is meaningful.
const NEG_ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789 .,;(){}=+*/<>";

/// Alphabet for an AWS key tail (`[A-Z2-7]`).
const AWS_TAIL: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/// Alphabet for a token body (`[A-Za-z0-9]`).
const ALNUM: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/// Shortest and longest negative line lengths.
const MIN_LEN: usize = 24;

/// Longest negative line length.
const MAX_LEN: usize = 96;

/// A small linear-congruential generator for reproducible corpus bytes.
///
/// What: a 64-bit LCG with the SplitMix-style multiplier. Why: deterministic output
/// without a dependency, so the benchmark corpus is identical every run.
struct Rng {
    /// Mutable generator state advanced on each draw.
    state: u64,
}

/// Drawing helpers over the generator.
impl Rng {
    /// Seeds the generator.
    ///
    /// What: stores the seed as the initial state. Why: a fixed seed gives a fixed
    /// corpus across runs.
    fn new(seed: u64) -> Rng {
        Rng { state: seed }
    }

    /// Advances the state and returns the next pseudo-random word.
    ///
    /// What: one LCG step. Why: the single source of all corpus randomness.
    fn next_u64(&mut self) -> u64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    /// Picks one byte uniformly from `set`.
    ///
    /// What: indexes `set` by the next draw modulo its length. Why: builds a line
    /// byte from a chosen alphabet.
    fn pick(&mut self, set: &[u8]) -> u8 {
        set[(self.next_u64() % set.len() as u64) as usize]
    }

    /// Returns a length in the inclusive range `[lo, hi]`.
    ///
    /// What: a modulo-bounded draw offset by `lo`. Why: varies negative-line length.
    fn len_between(&mut self, lo: usize, hi: usize) -> usize {
        lo + (self.next_u64() % (hi - lo + 1) as u64) as usize
    }
}

/// Builds the deterministic corpus: mostly negatives with periodic real keys.
///
/// What: every `POSITIVE_EVERY`-th line embeds an AWS key or GitHub token, the rest
/// are non-matching code-like noise. Why: a realistic scanner workload whose match
/// count is known, so both engines can be checked for parity before timing.
pub fn build_corpus() -> Vec<Vec<u8>> {
    let mut rng = Rng::new(0x9E37_79B9_7F4A_7C15);
    (0..CORPUS_LINES)
        .map(|i| {
            if i.is_multiple_of(POSITIVE_EVERY) {
                positive_line(&mut rng, i)
            } else {
                negative_line(&mut rng)
            }
        })
        .collect()
}

/// Builds one non-matching line of code-like noise.
///
/// What: a random-length run of bytes from the safe negative alphabet. Why: forces
/// a full-line scan with no early match, the scanner's common case.
fn negative_line(rng: &mut Rng) -> Vec<u8> {
    let len = rng.len_between(MIN_LEN, MAX_LEN);
    (0..len).map(|_| rng.pick(NEG_ALPHABET)).collect()
}

/// Builds one matching line by splicing a real key into noise.
///
/// What: a negative base plus a space-delimited AWS key or GitHub token, alternated
/// by index. Why: exercises the match-found path and gives a known positive count.
fn positive_line(rng: &mut Rng, i: usize) -> Vec<u8> {
    let mut line = negative_line(rng);
    line.push(b' ');
    if i.is_multiple_of(2) {
        line.extend_from_slice(b"AKIA");
        extend_from(&mut line, rng, AWS_TAIL, 16);
    } else {
        line.extend_from_slice(b"ghp_");
        extend_from(&mut line, rng, ALNUM, 36);
    }
    line.push(b' ');
    line
}

/// Appends `count` bytes drawn from `set` to `line`.
///
/// What: a small loop of `pick`. Why: builds the variable tail of a key.
fn extend_from(line: &mut Vec<u8>, rng: &mut Rng, set: &[u8], count: usize) {
    for _ in 0..count {
        line.push(rng.pick(set));
    }
}

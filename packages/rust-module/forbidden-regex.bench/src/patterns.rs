//! The shared pattern set, expressible in both engines (no `&`/`~`).

/// Secret-detection patterns both engines compile, chosen to mean the same thing.
///
/// What: AWS keys, a GitHub token, a wrapped prefix-alternation key, a Slack-style
/// token, and a Google-style key; every multi-character `|` branch is wrapped to
/// satisfy the single-atom-operand grammar. Why: the dialect overlap with `regex`
/// (no `&`/`~`) is exactly where a head-to-head throughput comparison is fair.
pub const PATTERNS: &[&str] = &[
    "AKIA[A-Z2-7]{16}",
    "ghp_[A-Za-z0-9]{36}",
    "\\b(?:(?:A3T[A-Z0-9])|(?:AKIA)|(?:ASIA))[A-Z2-7]{16}\\b",
    "xox[baprs]-[A-Za-z0-9]{10,48}",
    "AIza[A-Za-z0-9_-]{35}",
];

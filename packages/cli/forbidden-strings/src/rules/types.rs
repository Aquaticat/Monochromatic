//! rules types support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use aho_corasick::AhoCorasick;` imports the multi-pattern
//           literal-matcher type from the `aho-corasick` crate.
// Why:      `RuleSet` holds two AC instances (case-sensitive and
//           case-insensitive); they're built in `load_ruleset` and read
//           by `scan.rs`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AhoCorasick } from "aho-corasick";
// ```
use aho_corasick::AhoCorasick;

/// Imports dependencies used by this module.
use super::engine::CompiledRegex;

/// Groups fields for `RegexRule`.
// What:     `pub struct RegexRule { pub idx: usize, pub re: Regex }` is
//           a record type pairing the original line index with a
//           compiled resharp `Regex`. `pub` on the struct and on each
//           field makes both visible to `scan.rs`.
// Why:      We keep the rule's line index (1-based) so violation output
//           can reference `rule=N`. `re` is the compiled regex used
//           for `find_all` on the violation path.
//
// In TS you'd write (pseudocode):
// ```ts
// type RegexRule = { idx: number; re: Regex };
// ```
pub struct RegexRule {
/// Stores `idx`.
    pub idx: usize,
/// Stores `re`.
    pub re: CompiledRegex,
}

/// Enumerates `AcMeta` variants.
// What:     `pub enum AcMeta { Literal { idx, bound_left, bound_right }, RegexPrefix { rule_pos } }`
//           is the side-table value telling `scan.rs` what an AC pattern
//           id represents. `Literal` carries the user-facing rule line
//           index for direct emission, plus two booleans that say
//           whether a `grep -w`-style word-boundary check is required at
//           each end of the match (computed at load time from the
//           literal's first/last byte and length; see `compute_bounds`).
//           `RegexPrefix` carries an index into `RuleSet.regex_rules`,
//           signalling "this prefix being seen means the matching regex
//           rule needs its full `find_all` run on this file".
// Why:      One unified AC index now scans for BOTH literal rules AND
//           required-literal prefixes of regex rules. The metadata
//           dispatch lets `scan_content` route each AC hit to the right
//           handler without a second pass. In the 99%-clean case AC
//           emits zero hits and no resharp `Regex` work happens at all.
//           The boundary bools let short literal hits be filtered
//           before emission so a 3-char acronym does not match
//           coincidentally inside a noisy base64 blob, while long
//           literals match as pure substrings (substring uniqueness
//           grows fast enough with length that boundary protection is
//           not needed for distinctive multi-character phrases).
//
// In TS you'd write (pseudocode):
// ```ts
// type AcMeta =
//   | { kind: "literal"; idx: number; boundLeft: boolean; boundRight: boolean }
//   | { kind: "regexPrefix"; rulePos: number };
// ```
pub enum AcMeta {
    /// Metadata for a literal rule hit emitted directly from the AC pass.
    Literal {
        /// Original one-based line number of the literal rule.
        idx: usize,
        /// Whether the byte before the match must be a non-word boundary.
        bound_left: bool,
        /// Whether the byte after the match must be a non-word boundary.
        bound_right: bool,
    },
    /// Metadata for a regex rule whose required prefix matched in AC.
    RegexPrefix {
        /// Position of the regex rule in `RuleSet::regex_rules`.
        rule_pos: usize,
    },
}

/// Implements `is_word_byte`.
// What:     `pub fn is_word_byte(b: u8) -> bool` returns `true` when the
//           ASCII byte `b` is a "word character" in the regex sense:
//           `[A-Za-z0-9_]`. Public so `scan.rs` can reuse the same
//           definition for the file-side boundary check.
// Why:      Conditional word-boundary semantics for literal rules
//           (modeled on `grep -w`) require classifying both the
//           literal's edge byte and the file byte adjacent to the match.
//           Centralizing the predicate keeps the two checks consistent.
//
// In TS you'd write (pseudocode):
// ```ts
// function isWordByte(b: number): boolean {
//   return (
//     (b >= 0x30 && b <= 0x39) || // 0-9
//     (b >= 0x41 && b <= 0x5a) || // A-Z
//     (b >= 0x61 && b <= 0x7a) || // a-z
//     b === 0x5f                   // _
//   );
// }
// ```
pub fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Defines the `SUBSTRING_THRESHOLD` constant.
// What:     Minimum literal length (in bytes) at which conditional
//           word-boundary checks are DROPPED -- literals at or above
//           this length match as pure case-sensitive substrings.
// Why:      Derivation: a length-L literal in case-sensitive alphabet
//           of size A scanned over N random bytes has expected
//           coincidence count ~= N * A^(-L). Targeting < 0.01 expected
//           coincidences per rule across 1 GB (10^9 bytes) of dense
//           noise content (orders of magnitude larger than any
//           realistic repo's combined base64/random-text content),
//           the smallest L meeting both base64 (A=64) and random
//           alphanumeric (A=62) is L=7:
//
//             L=6 -> base64 ~0.015, alnum ~0.019  (borderline)
//             L=7 -> base64 ~2.3e-4, alnum ~3.0e-4  (safe)
//             L=8 -> base64 ~3.6e-6, alnum ~4.9e-6  (overkill)
//
//           Below this threshold the per-edge boundary check still
//           fires; an explicit-substring escape hatch is to write a
//           short literal as a regex (`/foo/`).
//
// In TS you'd write (pseudocode):
// ```ts
// const SUBSTRING_THRESHOLD = 7;
// ```
pub const SUBSTRING_THRESHOLD: usize = 7;

/// Enumerates `ResidualShard` variants.
// What:     `pub enum ResidualShard { Single { rule_pos }, Combined { gate, positions } }`
//           is the residual-gate node. `Single` references a single
//           regex_rule by position -- no separate gate Regex is
//           compiled; the rule's own Regex from `regex_rules` is used
//           directly when scanning. `Combined` holds a multi-rule
//           combined-alternation gate plus the rule positions it covers.
// Why:      At shard_size=1, the "gate" is identical to the rule's own
//           Regex -- compiling them as separate Regex instances doubles
//           the parser+algebra cost (Phase 2e ~485ms on the betterleaks
//           corpus where 28 rules can't combine and all end up at size=1)
//           AND doubles the per-file scan cost (one is_match through
//           the gate, then a separate find_all through the rule).
//           The Single variant collapses both: skip Phase 2e compile,
//           and call `rule.re.find_all` directly without a redundant
//           gate.is_match. The Combined variant retains the
//           combined-alternation optimisation when resharp's parser+
//           algebra accept the combined form (which happens whenever
//           the chunk's rules don't trigger lookaround-related
//           UnsupportedPattern errors).
//
// In TS you'd write (pseudocode):
// ```ts
// type ResidualShard =
//   | { kind: "single"; rulePos: number }
//   | { kind: "combined"; gate: Regex; positions: number[] };
// ```
//
// Clippy lint suppressed: `Combined` carries a `CompiledRegex` whose
// resharp arm is ~3.3 KiB; `Single` is 8 bytes. Boxing the gate would
// add an indirection on the per-shard `is_match` call inside
// `scan_content`'s residual loop. Residual count is tiny (currently 4)
// so the size asymmetry costs at most a few KiB total.
#[allow(clippy::large_enum_variant)]
pub enum ResidualShard {
    /// Residual shard for one regex rule scanned without a separate gate.
    Single {
        /// Position of the regex rule in `RuleSet::regex_rules`.
        rule_pos: usize,
    },
    /// Residual shard that gates several regex rules behind one combined regex.
    Combined {
        /// Combined regex used as the pre-filter gate.
        gate: CompiledRegex,
        /// Positions of the regex rules covered by this gate.
        positions: Vec<usize>,
    },
}

/// Groups fields for `RuleSet`.
// What:     `pub struct RuleSet { ... }` is the top-level rules
//           container produced by `load_ruleset` and consumed by
//           `scan_content`. The unified `ac` index now covers literals
//           AND required-literal prefixes of regex rules; `ac_meta` is
//           a parallel-by-pattern-id Vec telling which is which.
//           `residual_shards` covers regex rules whose required-literal
//           prefix could NOT be extracted (pure character-class openers,
//           alternations, etc.).
// Why:      One owned bundle holds everything the scan path needs. The
//           hot path on a clean file is now a single AC pass with no
//           resharp work; resharp only enters when AC fires a hit.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSet = {
//   ac: AhoCorasick | null;
//   acMeta: AcMeta[];
//   acCi: AhoCorasick | null;
//   acMetaCi: AcMeta[];
//   regexRules: readonly RegexRule[];
//   residualShards: ResidualShard[];
// };
// ```
pub struct RuleSet {
/// Stores `ac`.
    pub ac: Option<AhoCorasick>,
/// Stores `ac_meta`.
    pub ac_meta: Vec<AcMeta>,
/// Stores `ac_ci`.
    // What:     `pub ac_ci: Option<AhoCorasick>` is a SECOND Aho-Corasick
    //           automaton built with `ascii_case_insensitive(true)`. It
    //           covers required-substring prefixes extracted from regex
    //           rules whose source carried a `(?i)` flag (or whose
    //           extractable substring would otherwise need case-folded
    //           matching). Literal rules NEVER live in this index --
    //           literals are user-authored case-sensitively.
    // Why:      Most betterleaks-shape rules begin with `(?i)` and
    //           historically left `extract_required_prefix` returning
    //           `None`, dumping them all into the residual gate. With
    //           a CI-AC bucket those same rules ride the AC fast path
    //           via case-insensitive ASCII matching, draining the
    //           residual gate and removing the per-file mutex
    //           contention on the hot path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // ac_ci: AhoCorasick | null;
    // acMetaCi: AcMeta[];
    // ```
    pub ac_ci: Option<AhoCorasick>,
/// Stores `ac_meta_ci`.
    pub ac_meta_ci: Vec<AcMeta>,
/// Stores `regex_rules`.
    pub regex_rules: Vec<RegexRule>,
/// Stores `residual_shards`.
    pub residual_shards: Vec<ResidualShard>,
}

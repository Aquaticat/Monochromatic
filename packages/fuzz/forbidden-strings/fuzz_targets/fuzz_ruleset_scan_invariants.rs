// What:     `fuzz_ruleset_scan_invariants` exercises the full
//           `scan_content` pipeline end-to-end and asserts
//           properties that hold REGARDLESS of regex routing, AC
//           gating, or rayon scheduling. The plan §7.2 invariant
//           set: (1) hit format matches the
//           `path:line:col_start..col_end rule=N` shape and never
//           echoes matched bytes, (2) column counters land on
//           UTF-8 start bytes, (3) hit positions index inside the
//           content, (4) hit set is invariant to rayon thread count,
//           (5) hit set (modulo `rule=` numbering) is invariant to
//           rule order.
// Why:      The plan rejects a slow reference scanner ("two
//           implementations drift and produce false positives").
//           Invariant-style testing is the cheaper, more durable
//           alternative.
// TS map:   `fuzzTarget((input: RulesetAndContent) => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// fuzzTarget((input: RulesetAndContent) => {
//   const file = fileSource(input);
//   const rs = loadRulesetFromSource(file, "fuzz");
//   const hits = scanContent("fuzz.txt", input.content, rs);
//   // walk invariants...
// });
// ```

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::*;
use forbidden_strings_fuzz::generators::RulesetAndContent;
use sha2::{Digest, Sha256};

// What:     `fn parse_hit(line: &str) -> Option<(usize, usize, usize, usize)>`.
//           Parses the formatted hit line into its four numeric
//           fields `(line, col_start, col_end, rule_idx)`. Returns
//           `None` on shape mismatch so we can assert the format
//           shape via the option chain.
// Why:      The format is documented in `scan_format::format_hit`
//           as `path:line:col_start..col_end rule=N`. The
//           invariant target needs to extract those numbers to
//           bound-check them; a regex would be heavier here.
// TS map:   `function parseHit(line: string): [number, number, number, number] | null`.
fn parse_hit(line: &str) -> Option<(usize, usize, usize, usize)> {
    // Shape: <path>:<line>:<col_start>..<col_end> rule=<N>
    let rule_idx_pos = line.rfind(" rule=")?;
    let rule_idx_s = &line[rule_idx_pos + " rule=".len()..];
    let rule_idx: usize = rule_idx_s.parse().ok()?;

    let prefix = &line[..rule_idx_pos];
    let cols_pos = prefix.rfind("..")?;
    let col_end_s = &prefix[cols_pos + 2..];
    let col_end: usize = col_end_s.parse().ok()?;

    let before_dots = &prefix[..cols_pos];
    let col_start_pos = before_dots.rfind(':')?;
    let col_start_s = &before_dots[col_start_pos + 1..];
    let col_start: usize = col_start_s.parse().ok()?;

    let before_col_start = &before_dots[..col_start_pos];
    let line_pos = before_col_start.rfind(':')?;
    let line_s = &before_col_start[line_pos + 1..];
    let line_num: usize = line_s.parse().ok()?;

    Some((line_num, col_start, col_end, rule_idx))
}

// What:     `fn is_utf8_start_byte(b: u8) -> bool`. UTF-8 start
//           bytes are either ASCII (0xxxxxxx) or have the high two
//           bits as 11 (110xxxxx for 2-byte, 1110xxxx for 3-byte,
//           11110xxx for 4-byte). Continuation bytes are
//           10xxxxxx (0x80..=0xBF) -- NOT start bytes.
// Why:      Plan §7.2 invariant 2: cols may not cross UTF-8
//           boundary.
// TS map:   `function isUtf8StartByte(b: number): boolean`.
fn is_utf8_start_byte(b: u8) -> bool {
    (b & 0xC0) != 0x80
}

// What:     `fn position_key(hit: &str) -> Option<String>`. Strips
//           the trailing ` rule=N` so position-only comparisons
//           ignore rule-index renumbering when we shuffle rule
//           order.
// Why:      Plan §7.2 rule-order invariant: hits without their
//           rule= suffix must match across orderings.
// TS map:   `function positionKey(hit: string): string | null`.
fn position_key(hit: &str) -> Option<String> {
    hit.rfind(" rule=").map(|p| hit[..p].to_string())
}

fuzz_target!(|input: RulesetAndContent| {
    // What:     `let source = input.file_source();`. Renders the
    //           bounded rules into a multi-line file-form source
    //           that `load_ruleset_from_source` consumes.
    // Why:      Drive the production loader exactly the same way
    //           the CLI does.
    // TS map:   `const source = fileSource(input);`.
    let source = input.file_source();
    if source.trim().is_empty() {
        return;
    }

    // What:     `let rs = match load_ruleset_from_source(&source, "fuzz") { ... };`.
    //           Compile-failure rejection: invalid rule combinations
    //           the loader rejects don't exercise the scan path.
    // Why:      Skip uninteresting load failures.
    // TS map:   `try { rs = loadRulesetFromSource(source, "fuzz"); } catch { return; }`.
    let rs = match load_ruleset_from_source(&source, "fuzz") {
        Ok(r) => r,
        Err(_) => return,
    };

    let content: &[u8] = &input.content;

    // What:     `let hits_default = scan_content("fuzz.txt", content, &rs);`.
    //           Run the production scan on the default rayon pool.
    //           Returns owned `Vec<String>`.
    // Why:      Establish the baseline hit set for invariant checks.
    let hits_default = scan_content("fuzz.txt", content, &rs);

    //region Invariant 1+2+3: format + UTF-8 boundary + position-in-content

    // What:     `let mut content_digest = Sha256::new();` so we
    //           can fingerprint a hit-format violation without
    //           dumping bytes.
    // Why:      Redacted reproducer.
    for hit in &hits_default {
        // What:     `let parsed = parse_hit(hit);`. Asserts the
        //           hit string matches the documented shape; if
        //           not, the panic message redacts content.
        // Why:      Invariant 1.
        let Some((line_num, col_start, col_end, _rule_idx)) = parse_hit(hit) else {
            let mut hasher = Sha256::new();
            hasher.update(content);
            let digest = hasher.finalize();
            panic!(
                "hit shape violation: hit = {:?} content_len = {} content_sha256 = {:x}",
                hit,
                content.len(),
                digest,
            );
        };

        // What:     `if !hits_default[i].contains(" rule=")`. The
        //           literal token "rule=" must appear; format_hit
        //           always emits it. Already covered by parse_hit
        //           but a separate assertion makes the failure
        //           message simpler.
        // Why:      Defensive.
        assert!(hit.contains(" rule="), "hit missing rule=: {:?}", hit);

        // What:     Bounds checks. `line_num` is 1-indexed; line
        //           count is the number of newline-delimited lines
        //           in content. col_start / col_end are 1-indexed
        //           byte offsets within the line.
        // Why:      Invariant 3: positions must point inside the
        //           content's actual structure.
        let line_count_plus_one = content.iter().filter(|&&b| b == b'\n').count() + 1;
        assert!(
            line_num >= 1 && line_num <= line_count_plus_one,
            "line out of range: {} for {} lines",
            line_num,
            line_count_plus_one,
        );
        assert!(
            col_start >= 1 && col_end >= 1,
            "cols must be 1-indexed: ({}, {})",
            col_start,
            col_end,
        );
        assert!(col_start <= col_end, "col_start > col_end: ({}, {})", col_start, col_end);

        // What:     Re-derive the line byte range from content,
        //           then check the col offsets fall on UTF-8 start
        //           bytes (invariant 2).
        // Why:      Past bugs (em-dash, 6-byte mojibake) emitted
        //           cols pointing INTO a continuation byte; this
        //           catches that shape automatically.
        let li = build_line_index(content);
        if line_num <= li.len() {
            let line_start = li[line_num - 1];
            let start_byte_off = line_start + col_start - 1;
            let end_byte_off = line_start + col_end - 1;
            if start_byte_off < content.len() {
                assert!(
                    is_utf8_start_byte(content[start_byte_off]),
                    "col_start lands on UTF-8 continuation byte: line={} col={} byte=0x{:02x}",
                    line_num,
                    col_start,
                    content[start_byte_off],
                );
            }
            if end_byte_off < content.len() {
                assert!(
                    is_utf8_start_byte(content[end_byte_off]),
                    "col_end lands on UTF-8 continuation byte: line={} col={} byte=0x{:02x}",
                    line_num,
                    col_end,
                    content[end_byte_off],
                );
            }
        }
    }

    //endregion

    //region Invariant 4: thread-count invariance

    // What:     `let pool = rayon::ThreadPoolBuilder::new().num_threads(1).build()`.
    //           Builds a single-thread rayon pool. `pool.install(|| ... )`
    //           runs the closure on that pool instead of the global one.
    // Why:      Plan §7.2 thread-count invariance.
    let single_threaded_hits = match rayon::ThreadPoolBuilder::new().num_threads(1).build() {
        Ok(pool) => pool.install(|| scan_content("fuzz.txt", content, &rs)),
        Err(_) => return,
    };

    // What:     Compare as bags. Hit order within a file isn't
    //           contractually specified (rayon merges in arbitrary
    //           order), so sort both before comparing.
    // Why:      Bag equality is the right level: thread count must
    //           not change WHICH hits we report.
    let mut sorted_default = hits_default.clone();
    let mut sorted_single = single_threaded_hits;
    sorted_default.sort();
    sorted_single.sort();
    if sorted_default != sorted_single {
        let mut hasher = Sha256::new();
        hasher.update(content);
        let digest = hasher.finalize();
        panic!(
            "thread-count invariance violated:\n\
             default_hits = {}\n\
             single_thread_hits = {}\n\
             content_len = {}\n\
             content_sha256 = {:x}",
            sorted_default.len(),
            sorted_single.len(),
            content.len(),
            digest,
        );
    }

    //endregion

    //region Invariant 5: rule-order invariance

    // What:     `let mut reversed = source.lines().collect::<Vec<_>>();`
    //           reverses the rule order, rebuilds the ruleset,
    //           re-runs the scan, then compares position-only hit
    //           sets (rule indices renumber).
    // Why:      Plan §7.2 rule-order invariance.
    let mut reversed: Vec<&str> = source.lines().collect();
    reversed.reverse();
    let reversed_source = reversed.join("\n");
    if let Ok(rs_rev) = load_ruleset_from_source(&reversed_source, "fuzz") {
        let hits_rev = scan_content("fuzz.txt", content, &rs_rev);

        // Position-only bag (drop the rule= suffix).
        let mut keys_default: Vec<String> =
            hits_default.iter().filter_map(|h| position_key(h)).collect();
        let mut keys_rev: Vec<String> =
            hits_rev.iter().filter_map(|h| position_key(h)).collect();
        keys_default.sort();
        keys_rev.sort();
        if keys_default != keys_rev {
            let mut hasher = Sha256::new();
            hasher.update(content);
            let digest = hasher.finalize();
            panic!(
                "rule-order invariance violated:\n\
                 default_position_keys = {}\n\
                 reversed_position_keys = {}\n\
                 content_len = {}\n\
                 content_sha256 = {:x}",
                keys_default.len(),
                keys_rev.len(),
                content.len(),
                digest,
            );
        }
    }

    //endregion
});

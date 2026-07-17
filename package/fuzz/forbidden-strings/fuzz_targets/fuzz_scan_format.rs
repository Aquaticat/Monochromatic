// What:  load a generated two-form ruleset and scan a generated multi-line buffer
//        through the real `scan_file`, then assert the columnless output contract: every
//        finding is exactly `PATH:LINE rule=N` (or the fail-closed `PATH: engine error`),
//        the line index is 1-based and within the buffer, findings arrive line-ascending,
//        and no content byte leaks into the finding.
// Why:   the finding format is the externally visible contract and the leak surface. The
//        engine swap (#384) dropped the old `path:line:col_start..col_end rule=N` columns
//        for the columnless `PATH:LINE rule=N`; the redaction argument is now structural
//        (the formatter interpolates only the fixed path and two integers), and this
//        target pins that a regression cannot reintroduce columns or interpolate content.

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::{load_from_text, scan_file};
use forbidden_strings_fuzz::generators::{redacted_fingerprint, RuleFileAndContent};

// The fixed path handed to `scan_file`; findings must interpolate exactly this and two
// integers, nothing else.
const PATH: &str = "fuzz.txt";

// What:  parse one finding and assert the columnless format, returning its line index.
// Why:   the redaction check is the reconstruction at the end: a finding equal to the
//        fixed template plus its two parsed integers cannot carry any content byte.
fn check_format(hit: &str, content: &[u8], max_line: usize) -> usize {
    // Split at the trailing ` rule=` marker (paths never contain it because PATH is fixed).
    let Some(rule_pos) = hit.rfind(" rule=") else {
        panic!("finding missing ' rule=': {} ({})", hit.len(), redacted_fingerprint(content));
    };
    let rule_str = &hit[rule_pos + " rule=".len()..];
    let Ok(rule) = rule_str.parse::<usize>() else {
        panic!("finding rule id not numeric ({})", redacted_fingerprint(content));
    };

    // The prefix is `PATH:LINE`; split at the last colon (PATH itself has no colon).
    let prefix = &hit[..rule_pos];
    let Some(colon_pos) = prefix.rfind(':') else {
        panic!("finding missing ':' ({})", redacted_fingerprint(content));
    };
    let path = &prefix[..colon_pos];
    assert_eq!(path, PATH, "finding path mismatch ({})", redacted_fingerprint(content));
    let line_str = &prefix[colon_pos + 1..];
    let Ok(line) = line_str.parse::<usize>() else {
        panic!("finding line not numeric ({})", redacted_fingerprint(content));
    };

    assert!(line >= 1, "line index not 1-based: {} ({})", line, redacted_fingerprint(content));
    assert!(
        line <= max_line,
        "line index {} exceeds {} lines ({})",
        line,
        max_line,
        redacted_fingerprint(content),
    );

    // Redaction: the whole finding is exactly the fixed template plus the two integers.
    // Any content byte would make this reconstruction unequal, so equality proves no leak.
    let expected = format!("{PATH}:{line} rule={rule}");
    assert_eq!(hit, expected.as_str(), "finding carries unexpected bytes ({})", redacted_fingerprint(content));

    return line
}

fuzz_target!(|input: RuleFileAndContent| {
    let source = input.rules.render();
    // The strict-loader contract is `fuzz_ruleset_scan_invariants`' job; here we need a
    // loaded set, so a load failure just ends the iteration.
    let loaded = match load_from_text(&source) {
        Ok(loaded) => loaded,
        Err(_) => return,
    };

    let content: &[u8] = &input.content;
    let hits = scan_file(PATH, content, &loaded);

    // Upper bound on any 1-based line index: one more than the newline count.
    let max_line = content.iter().filter(|&&byte| byte == b'\n').count() + 1;
    let engine_error = format!("{PATH}: engine error");

    let mut prev_line = 0usize;
    for hit in &hits {
        // The documented fail-closed shape from a caught engine panic; redacted already.
        if hit == &engine_error {
            continue;
        }
        let line = check_format(hit, content, max_line);
        // A single loaded set yields findings in line-ascending order; pin it.
        assert!(
            line >= prev_line,
            "findings not line-ascending: {} then {} ({})",
            prev_line,
            line,
            redacted_fingerprint(content),
        );
        prev_line = line;
    }
});

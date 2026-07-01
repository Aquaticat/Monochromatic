// What:  decode a libFuzzer artifact back into the generated pattern + content, so a
//        crash/OOM reproducer can be read as a pattern string for diagnosis.
// Why:   the structured generator turns fuzzer bytes into a `PatternAndContent`; to
//        understand a finding we need to see the actual pattern, not the raw bytes.

use arbitrary::{Arbitrary, Unstructured};
use forbidden_regex_fuzz::generators::PatternAndContent;

fn main() {
    let path = std::env::args().nth(1).expect("usage: decode_artifact <artifact-path>");
    let bytes = std::fs::read(&path).expect("read artifact");
    // libfuzzer-sys feeds the whole input via arbitrary_take_rest; match that here.
    let unstructured = Unstructured::new(&bytes);
    // println (not tracing): decode_artifact is a one-shot reproducer decoder; its stdout
    // output IS its purpose (read a crash artifact back as a pattern for diagnosis). The
    // library under fuzz (forbidden-regex) carries tracing.
    match PatternAndContent::arbitrary_take_rest(unstructured) {
        Ok(parsed) => {
            println!("uses_algebra: {}", parsed.pattern.uses_algebra);
            println!("pattern_len: {}", parsed.pattern.text.len());
            println!("content_len: {}", parsed.content.len());
            println!("pattern: {:?}", parsed.pattern.text);
        }
        Err(error) => println!("decode failed: {error:?}"),
    }
}

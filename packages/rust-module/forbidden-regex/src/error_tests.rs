// What:  unit tests for CompileError's Display rendering.
// Why:   Display is what the scanner surfaces to a human when a rule is rejected; an
//        empty or wrong message would make a rejected rule undiagnosable, so each
//        variant must render a non-empty, descriptive line.
//
// In TS you'd write (pseudocode):
// ```ts
// import { /* names from this Rust use line */ } from "./module";
// ```

use super::CompileError;

#[test]
fn each_variant_renders_a_descriptive_message() {
    let syntax = CompileError::Syntax { pos: 7, message: "bad token".to_string() };
    let text = syntax.to_string();
    assert!(text.contains("7"));
    assert!(text.contains("bad token"));

    assert!(CompileError::EmptyMatchable.to_string().contains("empty"));
    assert!(CompileError::StateCap { limit: 20_000 }.to_string().contains("20000"));
    assert!(CompileError::Invalid { message: "bad blob".to_string() }.to_string().contains("bad blob"));
    assert!(
        CompileError::Serialize { message: "oops".to_string() }
            .to_string()
            .contains("oops")
    );
}

#[test]
fn messages_are_never_empty() {
    for error in [
        CompileError::EmptyMatchable,
        CompileError::Syntax { pos: 0, message: "x".to_string() },
        CompileError::StateCap { limit: 1 },
        CompileError::Invalid { message: "x".to_string() },
        CompileError::Serialize { message: "x".to_string() },
    ] {
        assert!(!error.to_string().is_empty());
    }
}

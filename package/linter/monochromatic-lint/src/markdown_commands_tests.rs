//! What: Prompt-only fence behavior and original-byte preservation controls.
//! Why: Source-normalized code values cannot be used as raw source lengths for CRLF or Unicode inputs.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Parse real Markdown, apply the advertised grouped fixes, and compare every authored byte.
//! ```

/// Import actual rule, parser, diagnostic and edit application.
use super::commands_show_output;
use crate::markdown_source::MarkdownSource;
use crate::diagnostic::{Diagnostic, Severity};
use crate::edits::{Fix, apply_fixes};

/// Check a Markdown fixture through the native adapter.
fn check(source: &str) -> Vec<Diagnostic> {
    let context: MarkdownSource = MarkdownSource::new(String::from("commands.md"), String::from(source), false).expect("fixture parses");
    return commands_show_output(&context, Severity::Error);
}

/// Prompts are localized edits, preserving fence spelling, blank lines, Unicode and newline sequences.
#[test]
fn prompt_only_examples_preserve_authored_source() {
    for newline in ["\n", "\r\n", "\r"] {
        let source: String = format!("```sh{newline}$ echo 🚀{newline}{newline}$ pwd{newline}```{newline}");
        let findings: Vec<Diagnostic> = check(source.as_str());
        assert_eq!(findings.len(), 1);
        let fix: Fix = findings[0].fix.clone().expect("mapped prefix fixes");
        assert_eq!(fix.edits.len(), 2);
        let output: String = apply_fixes(source.as_str(), &[fix]).expect("atomic fixes").source;
        assert_eq!(output, format!("```sh{newline}echo 🚀{newline}{newline}pwd{newline}```{newline}"));
        assert!(check(output.as_str()).is_empty());
    }
}

/// Empty, output-bearing, indented and non-fenced examples are not prompt-only column-one fences.
#[test]
fn exceptions_do_not_rewrite_unrelated_examples() {
    for source in [
        "```sh\n\n```\n",
        "```sh\n$ echo ok\nok\n```\n",
        "  ```sh\n  $ pwd\n  ```\n",
        "    $ pwd\n",
        "```sh\n  $ pwd\n```\n",
        "# Text\n",
    ] {
        assert!(check(source).is_empty(), "{source}");
    }
}

/// An unterminated fence still maps its final authored prompt without touching the opener.
#[test]
fn unclosed_fence_preserves_its_final_line() {
    let source: &str = "```sh\n$ pwd";
    let findings: Vec<Diagnostic> = check(source);
    assert_eq!(findings.len(), 1);
    let fix: Fix = findings[0].fix.clone().expect("mapped final prompt");
    assert_eq!(apply_fixes(source, &[fix]).expect("apply").source, "```sh\npwd");
}

//! Helix language recognition and tree-house highlighting, independent of native widgets.

/// What: Paths identify the source language; Rope retains scalar/byte conversion boundaries.
/// Why: Syntax positions must map to canonical source characters, not rendered columns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { type Path, Rope, LanguageLoader, Syntax } from './helix';
/// ```
use std::path::Path;
/// Errors distinguish unavailable parsers/rules from a successful plain-text language.
use anyhow::{Context, Result};
/// Reuse Helix's built-in registry, grammar/query loader, and bounded parser.
use helix_core::{Rope, syntax::{Loader, Syntax, config::Configuration}};
/// Source paint spans remain unrelated to native pixel coordinates.
use crate::source_style::{SourceStyles, StyleSpan};
/// The upstream error enum needs explicit conversion and operation-specific remedies.
use crate::syntax_error::parser_failure;

/// Ordered palette roles; role zero stays ordinary source and 64 stays selection ink.
const SCOPES: &[&str] = &[
    "keyword", "string", "comment", "constant", "type", "function", "variable",
    "operator", "punctuation", "tag", "attribute", "namespace", "special",
];

/// Merge touching intervals with identical paint roles, not unrelated syntax nodes.
fn append_span(spans: &mut Vec<StyleSpan>, incoming: StyleSpan) {
    // last_mut lends only the final owned interval; source text remains immutable.
    if let Some(previous) = spans.last_mut() {
        if previous.end == incoming.start && previous.style == incoming.style {
            previous.end = incoming.end;
            return;
        }
    }
    spans.push(incoming);
}

/// Own the language registry and its lazy grammar/query caches on the source worker.
pub struct SyntaxEngine {
    /// Built-in configuration only; project-local executable configuration is not loaded.
    loader: Loader,
}

/// Translate pinned language recognition and highlighting into source-character paint ranges.
impl SyntaxEngine {
    /// Initialize language recognition without starting servers or downloading assets.
    pub fn new() -> Result<Self> {
        // What: try_into deserializes the pinned loader's TOML value into its own config type.
        // Why: Keep parser configuration aligned with the selected Helix revision.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const config = parseLanguageConfig(helix.defaultLanguageConfig());
        // ```
        let config: Configuration = helix_loader::config::default_lang_config().try_into()
            .context("Cannot decode the bundled language configuration")?;
        let loader = Loader::new(config).context("Cannot prepare bundled filename language rules")?;
        let scopes = SCOPES.iter().map(|scope| return (*scope).to_string()).collect();
        loader.set_scopes(scopes);
        return Ok(Self { loader });
    }

    /// Return None only when the registry does not recognize the filename or shebang.
    /// Known languages with missing or incompatible assets return a visible failure instead.
    /// Returned intervals are sorted, non-overlapping, and merge adjacent identical paint roles.
    pub fn highlight(&self, path: &Path, text: &Rope) -> Result<Option<SourceStyles>> {
        let recognized = self.loader.language_for_filename(path)
            .or_else(|| return self.loader.language_for_shebang(text.slice(..)));
        let Some(language) = recognized else { return Ok(None); };
        let name = &self.loader.language(language).config().language_id;
        tracing::debug!(path = %path.display(), language = %name, "preparing source syntax");
        let syntax = Syntax::new(text.slice(..), language, &self.loader)
            .map_err(|error| return parser_failure(path, name, error))?;
        let length = u32::try_from(text.len_bytes())
            .with_context(|| return format!("Cannot highlight {}: source exceeds the parser byte-offset limit", path.display()))?;
        let mut highlighter = syntax.highlighter(text.slice(..), &self.loader, ..);
        let mut spans = Vec::new();
        let mut start = 0;
        while start < length {
            let end = highlighter.next_event_offset().min(length);
            if start < end {
                // The last active capture is the most specific current source classification.
                if let Some(highlight) = highlighter.active_highlights().next_back() {
                    append_span(&mut spans, StyleSpan {
                        start: text.byte_to_char(start as usize),
                        end: text.byte_to_char(end as usize),
                        style: highlight.idx() + 1,
                    });
                }
            }
            if end == length { break; }
            // advance updates the engine's active set; no duplicate external highlight stack is needed.
            highlighter.advance();
            start = end;
        }
        tracing::debug!(path = %path.display(), spans = spans.len(), "source syntax prepared");
        return Ok(Some(SourceStyles::from(spans)));
    }
}

//! Helix language recognition and tree-house highlighting, independent of native widgets.

/// Source paint spans remain unrelated to native pixel coordinates.
use crate::source_style::{SourceStyles, StyleSpan};
/// The upstream error enum needs explicit conversion and operation-specific remedies.
use crate::syntax_error::parser_failure;
/// Errors distinguish unavailable parsers/rules from a successful plain-text language.
use anyhow::{Context, Result, bail};
/// Reuse Helix's built-in registry, grammar/query loader, and bounded parser.
use helix_core::{
    Language, Rope,
    syntax::{Loader, Syntax, config::Configuration},
};
/// Decode the bundled manifest into a typed record instead of probing untyped JSON.
use serde::Deserialize;
/// What: Paths identify the source language; Rope retains scalar/byte conversion boundaries.
///       `HashSet` is a set of unique values; `fs` reads the bundled manifest file.
/// Why: Syntax positions must map to canonical source characters, not rendered columns,
///      and provisioned-grammar lookup needs membership tests rather than ordered scans.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { readFileSync } from 'node:fs';
/// import { type Path, Rope, LanguageLoader, Syntax } from './helix';
/// ```
use std::{collections::HashSet, fs, path::Path};

/// Ordered palette roles; role zero stays ordinary source and 64 stays selection ink.
const SCOPES: &[&str] = &[
    "keyword",
    "string",
    "comment",
    "constant",
    "type",
    "function",
    "variable",
    "operator",
    "punctuation",
    "tag",
    "attribute",
    "namespace",
    "special",
];

/// What: `#[derive(Deserialize)]` asks the serde library to generate this record's JSON decoder
///       at compile time; `struct Manifest` is the record the package runtime task writes as
///       `manifest.json` beside the grammars.
/// Why:  A typed record rejects a malformed manifest instead of guessing which grammars exist.
///       Keys this reader does not name, such as `helixRevision`, are ignored.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Manifest = { grammars: string[] };
/// ```
#[derive(Deserialize)]
struct Manifest {
    /// What: `Vec<String>` is a growable list of owned text values, one shared-object file name
    ///       per grammar. Siblings: `&[&str]` (borrowed, fixed) and `[String; N]` (fixed length).
    /// Why:  The count comes from the file, and the decoded names must outlive the file buffer.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// grammars: string[];
    /// ```
    grammars: Vec<String>,
}

/// What: `fn provisioned_grammars(manifest: &Path) -> Result<HashSet<String>>` takes a borrowed
///       path (`&Path`: the caller keeps ownership) and returns either a set of owned grammar
///       ids or an error. Siblings of `HashSet<String>`: `Vec<String>` (ordered, linear lookup)
///       and `HashSet<&str>` (borrowed names that could not outlive the decoded file).
/// Why:  The manifest names exactly the grammars this build ships. A language outside it is
///       unsupported and stays plain text; a listed grammar that then fails to load is a
///       broken installation and stays a visible failure.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function provisionedGrammars(manifest: string): Set<string> {
///   const { grammars } = JSON.parse(readFileSync(manifest, 'utf8')) as Manifest;
///   return new Set(grammars.map(file => file.slice(0, -'.so'.length)));
/// }
/// ```
pub fn provisioned_grammars(manifest: &Path) -> Result<HashSet<String>> {
    // What: `fs::read_to_string` returns `Result<String, io::Error>`; `.with_context(|| ...)`
    //       attaches a message built by the closure `|| ...` (a zero-argument arrow function)
    //       only when reading failed; the trailing `?` returns that error to the caller early.
    // Why:  A missing manifest means language assets were never prepared, and the diagnostic
    //       must name the file and the remedy rather than a bare operating-system error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let encoded: string;
    // try { encoded = readFileSync(manifest, 'utf8'); }
    // catch (error) { throw new Error(`Cannot read ${manifest} ...`, { cause: error }); }
    // ```
    let encoded = fs::read_to_string(manifest).with_context(|| {
        return format!(
            "Cannot read the bundled language manifest {}. Prepare language assets with the package runtime task and restart the application.",
            manifest.display()
        );
    })?;
    // `&encoded` lends the text to the decoder; a wrong shape returns early like the read above.
    let decoded: Manifest = serde_json::from_str(&encoded).with_context(|| {
        return format!(
            "Cannot decode the bundled language manifest {}. Prepare language assets with the package runtime task and restart the application.",
            manifest.display()
        );
    })?;
    // What: `HashSet::new()` creates an empty set; `mut` allows the loop to insert into it.
    // Why:  Later lookups ask only "is this grammar bundled?".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const names = new Set<string>();
    // ```
    let mut names = HashSet::new();
    for file in decoded.grammars {
        // What: `strip_suffix(".so")` returns `Some(rest)` when the name ends in `.so` and
        //       `None` otherwise; `let Some(name) = ... else { ... }` extracts `rest` or runs
        //       the `else` block, which must leave the function.
        // Why:  The manifest lists shared-object file names, while Helix addresses grammars by
        //       bare id; any other entry is an unexpected manifest and must not be skipped.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!file.endsWith('.so')) throw new Error(`unexpected entry ${file}`);
        // const name = file.slice(0, -'.so'.length);
        // ```
        let Some(name) = file.strip_suffix(".so") else {
            bail!(
                "Cannot use the bundled language manifest {}: entry {file} is not a grammar shared object. Prepare language assets with the package runtime task and restart the application.",
                manifest.display()
            );
        };
        // `to_string` copies the borrowed slice into an owned value the set can keep.
        names.insert(name.to_string());
    }
    // `Ok(...)` is the success variant of `Result`: hand the completed set to the caller.
    return Ok(names);
}

/// Merge touching intervals with identical paint roles, not unrelated syntax nodes.
fn append_span(spans: &mut Vec<StyleSpan>, incoming: StyleSpan) {
    // last_mut lends only the final owned interval; source text remains immutable.
    // Extract a present interval only when its paint role and boundary both match.
    if let Some(previous) = spans.last_mut()
        && previous.end == incoming.start
        && previous.style == incoming.style
    {
        previous.end = incoming.end;
        return;
    }
    spans.push(incoming);
}

/// Own the language registry and its lazy grammar/query caches on the source worker.
pub struct SyntaxEngine {
    /// Built-in configuration only; project-local executable configuration is not loaded.
    loader: Loader,
    /// Grammar ids the bundled manifest lists; every other recognized language is plain text.
    provisioned: HashSet<String>,
}

/// Translate pinned language recognition and highlighting into source-character paint ranges.
impl SyntaxEngine {
    /// Initialize language recognition from the bundled manifest without starting servers
    /// or downloading assets.
    pub fn new() -> Result<Self> {
        // `runtime_file` searches Helix's runtime directories in priority order.
        let manifest = helix_loader::runtime_file("manifest.json");
        // Lend the path; a missing or malformed manifest returns its diagnostic early.
        let provisioned = provisioned_grammars(&manifest)?;
        return Self::with_provisioned(provisioned);
    }

    /// Initialize language recognition for an explicit set of bundled grammar ids.
    /// `new` passes the manifest's set; tests pass sets the manifest would not produce.
    pub fn with_provisioned(provisioned: HashSet<String>) -> Result<Self> {
        // What: try_into deserializes the pinned loader's TOML value into its own config type.
        // Why: Keep parser configuration aligned with the selected Helix revision.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const config = parseLanguageConfig(helix.defaultLanguageConfig());
        // ```
        let config: Configuration = helix_loader::config::default_lang_config()
            .try_into()
            .context("Cannot decode the bundled language configuration")?;
        let loader =
            Loader::new(config).context("Cannot prepare bundled filename language rules")?;
        let scopes = SCOPES
            .iter()
            .map(|scope| return (*scope).to_string())
            .collect();
        loader.set_scopes(scopes);
        return Ok(Self {
            loader,
            provisioned,
        });
    }

    /// Recognize a bundled language by filename, then by shebang.
    /// None means the registry does not know the file or this build does not ship its grammar.
    fn recognize(&self, path: &Path, text: &Rope) -> Option<Language> {
        // What: the trailing `?` on an `Option` returns `None` from this function when the
        //       registry recognized nothing, and otherwise yields the contained language handle.
        // Why:  An unknown filename and shebang is ordinary plain text, not a failure.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const language = byFilename(path) ?? byShebang(text);
        // if (language === undefined) return undefined;
        // ```
        let language = self
            .loader
            .language_for_filename(path)
            .or_else(|| return self.loader.language_for_shebang(text.slice(..)))?;
        let config = self.loader.language(language).config();
        // What: `as_deref()` views `Option<String>` as `Option<&str>` without copying;
        //       `unwrap_or(&config.language_id)` falls back to the language's own id.
        // Why:  Helix loads the parser named by `grammar` when present (`qml` uses `qmljs`,
        //       `jsonc` uses `json`), so provisioning is decided per grammar, not per language.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const grammar = config.grammar ?? config.languageId;
        // ```
        let grammar = config.grammar.as_deref().unwrap_or(&config.language_id);
        if !self.provisioned.contains(grammar) {
            tracing::debug!(
                path = %path.display(),
                language = %config.language_id,
                grammar,
                "recognized language has no bundled grammar; source stays plain text"
            );
            // `None` is the absent variant of `Option`: no bundled language applies.
            return None;
        }
        // `Some(...)` is the present variant: this handle addresses the bundled language.
        return Some(language);
    }

    /// Name the bundled Helix language a file is read as, such as `jsonc` for `tsconfig.json`.
    /// None means plain text: an unknown file, or a language this build does not ship.
    pub fn language_id(&self, path: &Path, text: &Rope) -> Option<String> {
        let language = self.recognize(path, text)?;
        // What: `.clone()` duplicates the registry's owned id into a new `String`.
        //       Sibling: `&str`, a borrowed view tied to this engine's lifetime.
        // Why:  Callers on other threads may keep the id after the engine moves or drops.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return loader.language(language).config.languageId;
        // ```
        return Some(self.loader.language(language).config().language_id.clone());
    }

    /// Return None when the registry does not recognize the filename or shebang,
    /// or when this build does not ship the recognized language's grammar.
    /// Bundled languages with missing or incompatible assets return a visible failure instead.
    /// Returned intervals are sorted, non-overlapping, and merge adjacent identical paint roles.
    pub fn highlight(&self, path: &Path, text: &Rope) -> Result<Option<SourceStyles>> {
        let Some(language) = self.recognize(path, text) else {
            return Ok(None);
        };
        let name = &self.loader.language(language).config().language_id;
        tracing::debug!(path = %path.display(), language = %name, "preparing source syntax");
        let syntax = Syntax::new(text.slice(..), language, &self.loader)
            .map_err(|error| return parser_failure(path, name, error))?;
        let length = u32::try_from(text.len_bytes()).with_context(|| {
            return format!(
                "Cannot highlight {}: source exceeds the parser byte-offset limit",
                path.display()
            );
        })?;
        let mut highlighter = syntax.highlighter(text.slice(..), &self.loader, ..);
        let mut spans = Vec::new();
        let mut start = 0;
        while start < length {
            let end = highlighter.next_event_offset().min(length);
            if start < end {
                // The last active capture is the most specific current source classification.
                if let Some(highlight) = highlighter.active_highlights().next_back() {
                    append_span(
                        &mut spans,
                        StyleSpan {
                            start: text.byte_to_char(start as usize),
                            end: text.byte_to_char(end as usize),
                            style: highlight.idx() + 1,
                        },
                    );
                }
            }
            if end == length {
                break;
            }
            // advance updates the engine's active set; no duplicate external highlight stack is needed.
            highlighter.advance();
            start = end;
        }
        tracing::debug!(path = %path.display(), spans = spans.len(), "source syntax prepared");
        return Ok(Some(SourceStyles::from(spans)));
    }
}

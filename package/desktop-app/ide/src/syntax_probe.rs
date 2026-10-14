//! Temporary measurement of Markdown highlighting layers, removed with the fix.

use crate::{runtime, syntax::provisioned_grammars_from, syntax_loader::OwnLoader};
use helix_core::{
    Rope,
    syntax::{Loader, config::Configuration},
};
use std::{collections::BTreeMap, path::Path};
use tree_house::{Syntax, highlighter::Highlighter};

/// Every capture name the pinned Markdown queries emit, so each one is counted on its own.
const PROBE_SCOPES: &[&str] = &[
    "markup.heading.1",
    "markup.heading.2",
    "markup.heading.3",
    "markup.heading.4",
    "markup.heading.5",
    "markup.heading.6",
    "markup.heading.marker",
    "markup.raw.block",
    "markup.raw.inline",
    "markup.link.url",
    "markup.link.label",
    "markup.link.text",
    "markup.list.unnumbered",
    "markup.list.numbered",
    "markup.list.checked",
    "markup.list.unchecked",
    "markup.quote",
    "markup.italic",
    "markup.bold",
    "markup.strikethrough",
    "label",
    "punctuation.bracket",
    "punctuation.special",
    "string.escape",
    "constant.character.escape",
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
    "property",
    "number",
];

/// The production roles, to count painted spans the way the application does.
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

/// Build a loader over the process runtime.
fn loader(scopes: &'static [&'static str]) -> OwnLoader {
    let source = runtime::current().expect("runtime");
    let (encoded, location) = source.manifest().expect("manifest");
    let provisioned = provisioned_grammars_from(&encoded, &location, source.remedy()).expect("manifest");
    let config: Configuration = helix_loader::config::default_lang_config()
        .try_into()
        .expect("config");
    let count = config.language.len();
    let helix = Loader::new(config).expect("loader");
    return OwnLoader::new(helix, count, provisioned, scopes);
}

/// Print the layers and capture counts of the files in `target/probe-input`.
#[test]
fn probe_markdown_layers() {
    let Ok(entries) = std::fs::read_dir("target/probe-input") else {
        return;
    };
    let mut files: Vec<String> = entries
        .map(|entry| entry.expect("entry").path().display().to_string())
        .collect();
    files.sort();
    for file in files.iter() {
        println!("=== {file}");
        let text = Rope::from_str(&std::fs::read_to_string(file).expect("probe file"));
        let path = Path::new(file);
        for (label, scopes) in [("probe-scopes", PROBE_SCOPES), ("production-scopes", SCOPES)] {
            let loader = loader(scopes);
            let chosen = loader.helix.language_for_filename(path);
            println!(
                "[{label}] language_for_filename: {:?}",
                chosen.map(|language| loader.helix.language(language).config().language_id.clone())
            );
            let Some(language) = chosen else { continue };
            for name in ["markdown", "markdown.inline", "yaml", "toml", "rust", "javascript", "json", "bash", "html"] {
                let found = loader.helix.language_for_name(name.to_string());
                match found {
                    None => println!("[{label}] language {name}: unknown to the registry"),
                    Some(language) => match loader.prepared(language) {
                        Ok(_) => println!("[{label}] language {name}: compiled"),
                        Err(reason) => println!("[{label}] language {name}: FAILED {reason}"),
                    },
                }
            }
            let syntax = match Syntax::new(text.slice(..), language, std::time::Duration::from_millis(500), &loader) {
                Ok(syntax) => syntax,
                Err(error) => {
                    println!("[{label}] Syntax::new failed: {error}");
                    continue;
                }
            };
            let length = text.len_bytes() as u32;
            // Layers seen at every byte, by language name.
            let mut layers: BTreeMap<String, usize> = BTreeMap::new();
            let mut seen = std::collections::BTreeSet::new();
            for byte in 0..length {
                for layer in syntax.layers_for_byte_range(byte, byte) {
                    if seen.insert(format!("{layer:?}")) {
                        let name = loader
                            .helix
                            .language(syntax.layer(layer).language)
                            .config()
                            .language_id
                            .clone();
                        *layers.entry(name).or_default() += 1;
                    }
                }
            }
            println!("[{label}] layers by language (distinct layer ids): {layers:?}");
            let mut counts: BTreeMap<String, (usize, usize)> = BTreeMap::new();
            let mut spans = 0;
            let mut highlighter = Highlighter::new(&syntax, text.slice(..), &loader, ..);
            let mut start = 0;
            while start < length {
                let end = highlighter.next_event_offset().min(length);
                if start < end
                    && let Some(highlight) = highlighter.active_highlights().next_back()
                {
                    let name = scopes[highlight.idx()].to_string();
                    let entry = counts.entry(name).or_default();
                    entry.0 += 1;
                    entry.1 += (end - start) as usize;
                    spans += 1;
                }
                if end == length {
                    break;
                }
                highlighter.advance();
                start = end;
            }
            println!("[{label}] painted event spans: {spans}; (events, bytes) by capture: {counts:?}");
        }
    }
}
